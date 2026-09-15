import { setClipboardMonitorEnabled } from '../../clipboard'
import { getRedactedConfig, setConfig } from '../../config'
import { logger } from '../../../logger'
import { applyProxyToSession } from '../../proxy'
import { broadcastAppEvent } from '../broadcast'
import { assertKeyPayload } from '../payloadGuards'
import type { IpcHandler } from '../types'

export function configHandlers(): Record<string, IpcHandler> {
  return {
    'config:get': (_event, payload) => {
      const { key } = assertKeyPayload(payload)
      return getRedactedConfig(key)
    },
    'config:set': async (_event, payload) => {
      const { key, value } = assertKeyPayload(payload)
      await setConfig(key, value)
      if (key === 'clipboard_monitor') {
        setClipboardMonitorEnabled(Boolean(value))
      }
      if (
        [
          'proxy_enable',
          'proxy_host',
          'proxy_port',
          'proxy_username',
          'proxy_password',
          'no_proxy',
        ].includes(key)
      ) {
        await applyProxyToSession()
      }
      broadcastAppEvent('config:changed', { key })
      logger.info('Config value change broadcasted.', {
        key,
      })
    },
  }
}

export function httpHandlers(): Record<string, IpcHandler> {
  return {
    'http:request': async (_event, payload) => {
      const { rendererHttpRequest } = await import('../../http')
      return rendererHttpRequest(payload)
    },
  }
}
