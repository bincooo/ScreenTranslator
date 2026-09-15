import { type Rectangle } from 'electron'

import { NeoPotError } from './errors'

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const assertNoPayload = (payload: unknown) => {
  if (payload !== undefined) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected no payload.',
    })
  }
}

export const assertKeyPayload = (payload: unknown): { key: string; value?: unknown } => {
  if (!isRecord(payload) || typeof payload.key !== 'string' || payload.key.length === 0) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected a non-empty config key.',
      field: 'key',
    })
  }

  return {
    key: payload.key,
    value: payload.value,
  }
}

export const assertPluginInstallPayload = (payload: unknown): { file: string } => {
  if (!isRecord(payload) || typeof payload.file !== 'string' || payload.file.length === 0) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected a plugin file path.',
      field: 'file',
    })
  }

  return { file: payload.file }
}

export const assertPluginInstallUrlPayload = (payload: unknown): { url: string } => {
  if (!isRecord(payload) || typeof payload.url !== 'string' || payload.url.length === 0) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected a plugin URL or local source path.',
      field: 'url',
    })
  }

  return { url: payload.url }
}

export const assertOptionalPluginListPayload = (payload: unknown): { type?: string } => {
  if (payload === undefined) {
    return {}
  }

  if (!isRecord(payload)) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected plugin list payload.',
    })
  }

  return {
    type: typeof payload.type === 'string' ? payload.type : undefined,
  }
}

export const assertPluginIdentityPayload = (payload: unknown): { type: string; name: string } => {
  if (
    !isRecord(payload) ||
    typeof payload.type !== 'string' ||
    payload.type.length === 0 ||
    typeof payload.name !== 'string' ||
    payload.name.length === 0
  ) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected plugin type and name.',
    })
  }

  return { type: payload.type, name: payload.name }
}

export const assertPluginEnabledPayload = (
  payload: unknown,
): { type: string; name: string; enabled: boolean } => {
  const { type, name } = assertPluginIdentityPayload(payload)
  if (!isRecord(payload) || typeof payload.enabled !== 'boolean') {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected plugin enabled state.',
      field: 'enabled',
    })
  }

  return { type, name, enabled: payload.enabled }
}

export const assertBooleanPayload = (payload: unknown, field: string): boolean => {
  if (!isRecord(payload) || typeof payload[field] !== 'boolean') {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: `Expected boolean field: ${field}.`,
      field,
    })
  }

  return payload[field]
}

export const assertWindowBoundsPayload = (payload: unknown) => {
  if (!isRecord(payload)) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected window bounds object.',
    })
  }

  const bounds: Rectangle = {
    x: Number(payload.x ?? 0),
    y: Number(payload.y ?? 0),
    width: Number(payload.width ?? 0),
    height: Number(payload.height ?? 0),
  }

  return {
    x: typeof payload.x === 'number' ? bounds.x : undefined,
    y: typeof payload.y === 'number' ? bounds.y : undefined,
    width: typeof payload.width === 'number' ? bounds.width : undefined,
    height: typeof payload.height === 'number' ? bounds.height : undefined,
  }
}

export const assertEventPayload = (payload: unknown): { event: string; payload?: unknown } => {
  if (!isRecord(payload) || typeof payload.event !== 'string' || payload.event.length === 0) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected a non-empty event name.',
      field: 'event',
    })
  }

  return {
    event: payload.event,
    payload: payload.payload,
  }
}

export const assertShortcutPayload = (payload: unknown): { name?: string; shortcut: string } => {
  if (!isRecord(payload) || typeof payload.shortcut !== 'string') {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected shortcut string.',
      field: 'shortcut',
    })
  }

  return {
    name: typeof payload.name === 'string' ? payload.name : undefined,
    shortcut: payload.shortcut,
  }
}

export const assertCommandPayload = (
  payload: unknown,
): { command: string; payload?: Record<string, unknown> } => {
  if (!isRecord(payload) || typeof payload.command !== 'string' || payload.command.length === 0) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected command string.',
      field: 'command',
    })
  }

  return {
    command: payload.command,
    payload: isRecord(payload.payload) ? payload.payload : undefined,
  }
}

export const assertDialogOpenPayload = (payload: unknown) => {
  if (!isRecord(payload)) {
    return {}
  }

  const allowedProperties = new Set(['openFile', 'openDirectory', 'multiSelections'])
  const properties = Array.isArray(payload.properties)
    ? payload.properties.filter(
        (property): property is 'openFile' | 'openDirectory' | 'multiSelections' =>
          typeof property === 'string' && allowedProperties.has(property),
      )
    : undefined

  const filters = Array.isArray(payload.filters)
    ? payload.filters
        .filter(
          (filter) =>
            isRecord(filter) && typeof filter.name === 'string' && Array.isArray(filter.extensions),
        )
        .map((filter) => ({
          name: filter.name as string,
          extensions: (filter.extensions as unknown[]).filter(
            (extension): extension is string => typeof extension === 'string',
          ),
        }))
    : undefined

  return {
    multiple: payload.multiple === true,
    directory: payload.directory === true,
    properties,
    filters,
  }
}
