import { BrowserWindow, app, clipboard, shell } from 'electron'
import { isLogLevel, toLogTransportLevel } from '../../../../shared/logLevel'
import { getMainLogTransportLevel, logger, setMainLogTransportLevel } from '../../../logger'
import { setClipboardMonitorEnabled } from '../../clipboard'
import { applyProxyToSession } from '../../proxy'
import { updateTrayMenu } from '../../tray'
import {
  getCurrentScreenshotAction,
  getCurrentWorkflowText,
  imageTranslate,
  openUpdater,
  recognizeWindow,
  textTranslate,
} from '../../workflow'
import { NeoPotError } from '../errors'
import { assertBooleanPayload, assertCommandPayload } from '../payloadGuards'
import { assertTextPayload, assertUrlPayload } from '../paths'
import { listSystemFonts } from '../systemFonts'
import type { IpcHandler } from '../types'

export function commandHandlers(): Record<string, IpcHandler> {
  return {
    'command:invoke': async (_event, payload) => {
      const { command, payload: args } = assertCommandPayload(payload)

      switch (command) {
        case 'register_shortcut_by_frontend': {
          if (!args || typeof args.name !== 'string' || typeof args.shortcut !== 'string') {
            throw new NeoPotError({
              code: 'IPC_INVALID_PAYLOAD',
              message: 'Expected name and shortcut.',
            })
          }
          const { name, shortcut } = args
          return import('../../hotkey').then(({ registerGlobalShortcutByName }) =>
            registerGlobalShortcutByName(name, shortcut),
          )
        }
        case 'screenshot': {
          const { captureDisplayForPoint, getCaptureUrl } = await import('../../screenshot')
          await captureDisplayForPoint({
            x: Number(args?.x ?? 0),
            y: Number(args?.y ?? 0),
          })
          return getCaptureUrl()
        }
        case 'cut_image': {
          const { cropCapture } = await import('../../screenshot')
          cropCapture({
            x: Number(args?.left ?? 0),
            y: Number(args?.top ?? 0),
            width: Number(args?.width ?? 0),
            height: Number(args?.height ?? 0),
          })
          return ''
        }
        case 'screenshot_complete':
          if (getCurrentScreenshotAction() === 'translate') {
            await imageTranslate()
          } else {
            await recognizeWindow()
          }
          return undefined
        case 'get_base64': {
          const { getLastCroppedBase64 } = await import('../../screenshot')
          return getLastCroppedBase64()
        }
        case 'copy_img': {
          const { getClipboardImage } = await import('../../screenshot')
          const image = getClipboardImage()
          if (!image.isEmpty()) {
            clipboard.writeImage(image)
          }
          return undefined
        }
        case 'get_text':
          return getCurrentWorkflowText()
        case 'translate_text':
          return textTranslate(assertTextPayload(args))
        case 'lang_detect': {
          const { detectLanguage } = await import('../../lang-detect')
          return detectLanguage(assertTextPayload(args))
        }
        case 'font_list':
          return listSystemFonts()
        case 'update_tray':
          updateTrayMenu()
          return undefined
        case 'updater_window':
          await openUpdater()
          return undefined
        case 'open_url': {
          const { safeOpenExternal } = await import('../../shellSafety')
          await safeOpenExternal(assertUrlPayload(args))
          return undefined
        }
        case 'open_log_dir':
          await shell.openPath(app.getPath('logs'))
          return undefined
        case 'open_config_dir':
          await shell.openPath(app.getPath('userData'))
          return undefined
        case 'set_proxy':
          await applyProxyToSession(true)
          return true
        case 'unset_proxy':
          await applyProxyToSession(false)
          return true
        case 'set_clipboard_monitor':
          setClipboardMonitorEnabled(assertBooleanPayload(args, 'enabled'))
          return true
        case 'run_binary': {
          if (
            !args ||
            typeof args.pluginType !== 'string' ||
            typeof args.pluginName !== 'string' ||
            typeof args.cmdName !== 'string'
          ) {
            throw new NeoPotError({
              code: 'IPC_INVALID_PAYLOAD',
              message: 'Expected plugin type, plugin name, and command name.',
            })
          }
          const { runPluginBinary } = await import('../../../plugins/binary')
          return runPluginBinary({
            pluginType: args.pluginType,
            pluginName: args.pluginName,
            cmdName: args.cmdName,
            args: args.args,
          })
        }
        case 'open_devtools':
          BrowserWindow.getFocusedWindow()?.webContents.openDevTools({ mode: 'detach' })
          return undefined
        case 'log:set-level': {
          const level =
            args && typeof args === 'object' && 'level' in args ? String(args.level) : ''
          if (!isLogLevel(level)) {
            throw new NeoPotError({
              code: 'IPC_INVALID_PAYLOAD',
              message: `Invalid log level: ${level}`,
            })
          }
          const transportLevel = toLogTransportLevel(level)
          setMainLogTransportLevel(transportLevel)
          logger.info('Log level changed.', {
            level,
          })
          return true
        }
        case 'log:get-level':
          return getMainLogTransportLevel()
        default:
          throw new NeoPotError({
            code: 'IPC_UNKNOWN_CHANNEL',
            message: `Unsupported command: ${command}`,
          })
      }
    },
  }
}
