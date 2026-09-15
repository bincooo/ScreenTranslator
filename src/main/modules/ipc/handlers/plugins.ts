import { shell } from 'electron'
import { mkdir } from 'node:fs/promises'
import {
  assertNoPayload,
  assertOptionalPluginListPayload,
  assertPluginEnabledPayload,
  assertPluginIdentityPayload,
  assertPluginInstallPayload,
  assertPluginInstallUrlPayload,
} from '../payloadGuards'
import type { IpcHandler } from '../types'

export function pluginsHandlers(): Record<string, IpcHandler> {
  return {
    'plugins:install': async (_event, payload) => {
      const { file } = assertPluginInstallPayload(payload)
      const { installPlugin } = await import('../../../plugins/installer')
      return installPlugin(file)
    },
    'plugins:install-url': async (_event, payload) => {
      const { url } = assertPluginInstallUrlPayload(payload)
      const { installPluginFromUrl } = await import('../../../plugins/installer')
      return installPluginFromUrl(url)
    },
    'plugins:inspect-source': async (_event, payload) => {
      const { url } = assertPluginInstallUrlPayload(payload)
      const { readPluginManifestFromSource } = await import('../../../plugins/installer')
      return readPluginManifestFromSource(url)
    },
    'plugins:inspect-marketplace': async (_event, payload) => {
      const { url } = assertPluginInstallUrlPayload(payload)
      const { readPluginMarketplaceFromSource } = await import('../../../plugins/marketplace')
      return readPluginMarketplaceFromSource(url)
    },
    'plugins:list-installed': async (_event, payload) => {
      const { type } = assertOptionalPluginListPayload(payload)
      const { listInstalledPlugins } = await import('../../../plugins/installer')
      return listInstalledPlugins(type)
    },
    'plugins:uninstall': async (_event, payload) => {
      const { type, name } = assertPluginIdentityPayload(payload)
      const { uninstallPlugin } = await import('../../../plugins/installer')
      return uninstallPlugin(type, name)
    },
    'plugins:set-enabled': async (_event, payload) => {
      const { type, name, enabled } = assertPluginEnabledPayload(payload)
      const { setPluginEnabled } = await import('../../../plugins/installer')
      return setPluginEnabled(type, name, enabled)
    },
    'plugins:open-folder': async (_event, payload) => {
      assertNoPayload(payload)
      const { pluginRoot } = await import('../../../plugins/installer')
      await mkdir(pluginRoot(), { recursive: true })
      return shell.openPath(pluginRoot())
    },
  }
}
