import { assertShortcutPayload } from '../payloadGuards'
import type { IpcHandler } from '../types'

export function hotkeyHandlers(): Record<string, IpcHandler> {
  return {
    'hotkey:register': (_event, payload) => {
      const { name, shortcut } = assertShortcutPayload(payload)
      return name
        ? import('../../hotkey').then(({ registerGlobalShortcutByName }) =>
            registerGlobalShortcutByName(name, shortcut),
          )
        : false
    },
    'hotkey:unregister': (_event, payload) => {
      const { shortcut } = assertShortcutPayload(payload)
      return import('../../hotkey').then(({ unregisterGlobalShortcut }) =>
        unregisterGlobalShortcut(shortcut),
      )
    },
    'hotkey:is-registered': (_event, payload) => {
      const { shortcut } = assertShortcutPayload(payload)
      return import('../../hotkey').then(({ isGlobalShortcutRegistered }) =>
        isGlobalShortcutRegistered(shortcut),
      )
    },
  }
}
