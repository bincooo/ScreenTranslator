import { assertNoPayload } from '../payloadGuards'
import type { IpcHandler } from '../types'

export function updateHandlers(): Record<string, IpcHandler> {
  return {
    'update:check': async (_event, payload) => {
      assertNoPayload(payload)
      const { check } = await import('../../updater')
      return check()
    },
    'update:download': async (_event, payload) => {
      assertNoPayload(payload)
      const { download } = await import('../../updater')
      return download()
    },
    'update:install': async (_event, payload) => {
      assertNoPayload(payload)
      const { install } = await import('../../updater')
      install()
    },
    'update:open-release-page': async (_event, payload) => {
      assertNoPayload(payload)
      const { openReleasePage } = await import('../../updater')
      return openReleasePage()
    },
  }
}
