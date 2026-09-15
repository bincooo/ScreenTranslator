import { ipcMain } from 'electron'
import { logger } from '../logger'
import { NeoPotError, type NeoPotErrorPayload } from './ipc/errors'
import { isRecord } from './ipc/payloadGuards'
import type { IpcHandler, RegisterIpcHandlersOptions } from './ipc/types'
import { appHandlers } from './ipc/handlers/app'
import { commandHandlers } from './ipc/handlers/command'
import { configHandlers, httpHandlers } from './ipc/handlers/config'
import { dialogHandlers } from './ipc/handlers/dialog'
import { fsHandlers } from './ipc/handlers/fs'
import { hotkeyHandlers } from './ipc/handlers/hotkey'
import { pluginsHandlers } from './ipc/handlers/plugins'
import { updateHandlers } from './ipc/handlers/update'
import { workflowHandlers } from './ipc/handlers/workflow'

export { migrateAutoStartLoginItem } from './ipc/autoStart'

const normalizeError = (error: unknown): NeoPotErrorPayload => {
  if (error instanceof NeoPotError) {
    return {
      code: error.code,
      message: error.message,
      field: error.field,
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  return {
    code: 'IPC_HANDLER_FAILED',
    message,
  }
}

const summarizePayloadForLog = (payload: unknown): Record<string, unknown> => {
  if (!isRecord(payload)) {
    return {
      payloadType: typeof payload,
    }
  }

  const summary: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    const summaryKey = `payload_${key}`
    if (typeof value === 'string') {
      summary[summaryKey] = `[string length=${value.length}]`
    } else if (Array.isArray(value)) {
      summary[summaryKey] = `[array length=${value.length}]`
    } else if (isRecord(value)) {
      summary[summaryKey] = `[object keys=${Object.keys(value).length}]`
    } else {
      summary[summaryKey] = value
    }
  }

  return summary
}

export function registerIpcHandlers(options: RegisterIpcHandlersOptions): void {
  const handlers: Record<string, IpcHandler> = {
    ...appHandlers(options),
    ...dialogHandlers(),
    ...fsHandlers(),
    ...hotkeyHandlers(),
    ...commandHandlers(),
    ...configHandlers(),
    ...httpHandlers(),
    ...workflowHandlers(),
    ...updateHandlers(),
    ...pluginsHandlers(),
  }

  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (event, payload) => {
      try {
        return await handler(event, payload)
      } catch (error) {
        const normalizedError = normalizeError(error)
        const command =
          isRecord(payload) && typeof payload.command === 'string' ? payload.command : undefined
        logger.error('IPC handler failed.', {
          channel,
          command,
          code: normalizedError.code,
          message: normalizedError.message,
          ...summarizePayloadForLog(payload),
        })
        throw new NeoPotError(normalizedError)
      }
    })
  }

  ipcMain.on('http:stream', (event, payload) => {
    const port = event.ports[0]
    if (!port) {
      logger.error('HTTP stream request did not include a reply port.')
      return
    }

    const controller = new AbortController()
    let closed = false
    const close = () => {
      if (!closed) {
        closed = true
        port.close()
      }
    }
    const post = (message: unknown) => {
      if (!closed) {
        port.postMessage(message)
      }
    }

    port.on('message', (message) => {
      if (isRecord(message.data) && message.data.type === 'cancel') {
        controller.abort()
        close()
      }
    })
    port.on('close', () => {
      controller.abort()
    })
    port.start()

    void import('./http')
      .then(({ streamRendererHttpRequest }) =>
        streamRendererHttpRequest(
          payload,
          {
            onResponse: (response) => {
              post({ type: 'response', ...response })
            },
            onChunk: (data) => {
              post({ type: 'chunk', data })
            },
          },
          controller.signal,
        ),
      )
      .then(() => {
        post({ type: 'end' })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          const normalizedError = normalizeError(error)
          logger.error('HTTP stream request failed.', {
            code: normalizedError.code,
            message: normalizedError.message,
            ...summarizePayloadForLog(payload),
          })
          post({ type: 'error', message: normalizedError.message })
        }
      })
      .finally(close)
  })
}
