import { BrowserWindow, app } from 'electron'
import { broadcastAppEvent } from '../broadcast'
import { isAutoStartEnabled, setAutoStartEnabled } from '../autoStart'
import {
  assertBooleanPayload,
  assertEventPayload,
  assertNoPayload,
  assertWindowBoundsPayload,
} from '../payloadGuards'
import type { IpcHandler, RegisterIpcHandlersOptions } from '../types'
import { getCurrentWindowDisplayInfo, markWindowReady } from '../../window'

export function appHandlers(options: RegisterIpcHandlersOptions): Record<string, IpcHandler> {
  return {
    'app:get-window-label': (event, payload) => {
      assertNoPayload(payload)
      return options.getWindowLabel(event)
    },
    'app:get-version': (_event, payload) => {
      assertNoPayload(payload)
      return app.getVersion()
    },
    'app:renderer-ready': (event, payload) => {
      assertNoPayload(payload)
      markWindowReady(options.getWindowLabel(event))
    },
    'app:close-current-window': (event, payload) => {
      assertNoPayload(payload)
      BrowserWindow.fromWebContents(event.sender)?.close()
    },
    'app:hide-current-window': (event, payload) => {
      assertNoPayload(payload)
      BrowserWindow.fromWebContents(event.sender)?.hide()
    },
    'app:show-current-window': (event, payload) => {
      assertNoPayload(payload)
      BrowserWindow.fromWebContents(event.sender)?.show()
    },
    'app:focus-current-window': (event, payload) => {
      assertNoPayload(payload)
      BrowserWindow.fromWebContents(event.sender)?.focus()
    },
    'app:set-current-window-always-on-top': (event, payload) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      const alwaysOnTop = assertBooleanPayload(payload, 'alwaysOnTop')
      if (alwaysOnTop) {
        window?.setAlwaysOnTop(true, 'screen-saver')
      } else {
        window?.setAlwaysOnTop(false)
      }
    },
    'app:set-current-window-resizable': (event, payload) => {
      BrowserWindow.fromWebContents(event.sender)?.setResizable(
        assertBooleanPayload(payload, 'resizable'),
      )
    },
    'app:set-current-window-bounds': (event, payload) => {
      BrowserWindow.fromWebContents(event.sender)?.setBounds(assertWindowBoundsPayload(payload))
    },
    'app:get-current-window-bounds': (event, payload) => {
      assertNoPayload(payload)
      return (
        BrowserWindow.fromWebContents(event.sender)?.getBounds() ?? {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        }
      )
    },
    'app:get-current-display': (event, payload) => {
      assertNoPayload(payload)
      return getCurrentWindowDisplayInfo(event.sender)
    },
    'app:is-current-window-maximized': (event, payload) => {
      assertNoPayload(payload)
      return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
    },
    'app:set-auto-start': (_event, payload) => {
      setAutoStartEnabled(assertBooleanPayload(payload, 'enabled'))
    },
    'app:is-auto-start-enabled': (_event, payload) => {
      assertNoPayload(payload)
      return isAutoStartEnabled()
    },
    'app:minimize-current-window': (event, payload) => {
      assertNoPayload(payload)
      event.sender.send('app:event', { event: 'neopot://minimize' })
      BrowserWindow.fromWebContents(event.sender)?.minimize()
    },
    'app:maximize-current-window': (event, payload) => {
      assertNoPayload(payload)
      BrowserWindow.fromWebContents(event.sender)?.maximize()
    },
    'app:unmaximize-current-window': (event, payload) => {
      assertNoPayload(payload)
      BrowserWindow.fromWebContents(event.sender)?.unmaximize()
    },
    'app:emit': (_event, payload) => {
      const emitted = assertEventPayload(payload)
      broadcastAppEvent(emitted.event, emitted.payload)
    },
  }
}
