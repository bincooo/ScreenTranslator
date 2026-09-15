import { app } from 'electron'

import { APP_USER_MODEL_ID } from '../appIdentity'
import { AUTO_START_HIDDEN_ARG } from '../autoStart'

type AutoStartLoginItemCompareOptions = {
  path?: string
  args?: string[]
}

type AutoStartLoginItemSetOptions = AutoStartLoginItemCompareOptions & {
  name?: string
}

export function getAutoStartLoginItemCompareOptions(): AutoStartLoginItemCompareOptions {
  if (process.platform !== 'win32' || !app.isPackaged) {
    return {}
  }

  return {
    path: process.execPath,
    args: [AUTO_START_HIDDEN_ARG],
  }
}

function getLegacyAutoStartLoginItemCompareOptions(): AutoStartLoginItemCompareOptions {
  if (process.platform !== 'win32' || !app.isPackaged) {
    return {}
  }

  return {
    path: process.execPath,
    args: [],
  }
}

function getAutoStartLoginItemSetOptions(): AutoStartLoginItemSetOptions {
  if (process.platform !== 'win32' || !app.isPackaged) {
    return {}
  }

  return {
    ...getAutoStartLoginItemCompareOptions(),
    name: APP_USER_MODEL_ID,
  }
}

function getLegacyAutoStartLoginItemSetOptions(): AutoStartLoginItemSetOptions {
  return {
    ...getLegacyAutoStartLoginItemCompareOptions(),
    ...(process.platform === 'win32' && app.isPackaged ? { name: APP_USER_MODEL_ID } : {}),
  }
}

export function migrateAutoStartLoginItem(): void {
  if (process.platform !== 'win32' || !app.isPackaged) {
    return
  }

  const current = app.getLoginItemSettings(getAutoStartLoginItemCompareOptions())
  const legacy = app.getLoginItemSettings(getLegacyAutoStartLoginItemCompareOptions())
  if (current.openAtLogin || !legacy.openAtLogin) {
    return
  }

  app.setLoginItemSettings({
    openAtLogin: true,
    ...getAutoStartLoginItemSetOptions(),
  })
}

export function setAutoStartEnabled(enabled: boolean): void {
  if (process.platform !== 'win32' || !app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: enabled })
    return
  }

  if (!enabled) {
    app.setLoginItemSettings({
      openAtLogin: false,
      ...getAutoStartLoginItemSetOptions(),
    })
    app.setLoginItemSettings({
      openAtLogin: false,
      ...getLegacyAutoStartLoginItemSetOptions(),
    })
    return
  }

  app.setLoginItemSettings({
    openAtLogin: false,
    ...getLegacyAutoStartLoginItemSetOptions(),
  })
  app.setLoginItemSettings({
    openAtLogin: true,
    ...getAutoStartLoginItemSetOptions(),
  })
}

export function isAutoStartEnabled(): boolean {
  const current = app.getLoginItemSettings(getAutoStartLoginItemCompareOptions())
  if (current.openAtLogin || process.platform !== 'win32' || !app.isPackaged) {
    return current.openAtLogin
  }

  return app.getLoginItemSettings(getLegacyAutoStartLoginItemCompareOptions()).openAtLogin
}
