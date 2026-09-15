import { app } from 'electron'
import path from 'node:path'

import { NeoPotError } from './errors'
import { isRecord } from './payloadGuards'

type SupportedBaseDirectory = 'AppConfig' | 'AppCache' | 'AppLog'

const supportedBaseDirectories = new Set<SupportedBaseDirectory>([
  'AppConfig',
  'AppCache',
  'AppLog',
])

const resolveBaseDirectory = (baseDir: unknown): string | null => {
  switch (baseDir) {
    case 'AppConfig':
      return app.getPath('userData')
    case 'AppCache':
      return path.join(app.getPath('userData'), 'Cache')
    case 'AppLog':
      return app.getPath('logs')
    default:
      return null
  }
}

const assertPathPayload = (
  payload: unknown,
): { filePath: string; baseDir?: SupportedBaseDirectory } => {
  if (!isRecord(payload) || typeof payload.path !== 'string') {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected file path.',
      field: 'path',
    })
  }

  return {
    filePath: payload.path,
    baseDir:
      typeof payload.baseDir === 'string' &&
      supportedBaseDirectories.has(payload.baseDir as SupportedBaseDirectory)
        ? (payload.baseDir as SupportedBaseDirectory)
        : undefined,
  }
}

function assertPathInside(parent: string, child: string): void {
  const parentPath = path.resolve(parent)
  const childPath = path.resolve(child)
  const comparisonParent = process.platform === 'win32' ? parentPath.toLowerCase() : parentPath
  const comparisonChild = process.platform === 'win32' ? childPath.toLowerCase() : childPath
  if (
    comparisonChild !== comparisonParent &&
    !comparisonChild.startsWith(comparisonParent + path.sep)
  ) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Resolved path is outside the allowed base directory.',
      field: 'path',
    })
  }
}

function allowedFileRoots(): string[] {
  return [app.getPath('userData'), path.join(app.getPath('userData'), 'Cache'), app.getPath('logs')]
}

export const resolveFilePath = (payload: unknown): string => {
  const { filePath, baseDir } = assertPathPayload(payload)
  const basePath = resolveBaseDirectory(baseDir)
  if (basePath) {
    const resolvedPath = path.resolve(basePath, filePath)
    assertPathInside(basePath, resolvedPath)
    return resolvedPath
  }

  if (!path.isAbsolute(filePath)) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Relative filesystem paths require a supported baseDir.',
      field: 'baseDir',
    })
  }

  const resolvedPath = path.resolve(filePath)
  if (
    !allowedFileRoots().some((root) => {
      try {
        assertPathInside(root, resolvedPath)
        return true
      } catch {
        return false
      }
    })
  ) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Absolute filesystem paths are limited to NeoPot app data paths.',
      field: 'path',
    })
  }

  return resolvedPath
}

export const resolveRemovableFilePath = (payload: unknown): string => {
  const { baseDir } = assertPathPayload(payload)
  if (baseDir !== 'AppCache') {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Renderer delete operations are limited to AppCache.',
      field: 'baseDir',
    })
  }

  return resolveFilePath(payload)
}

export const assertTextPayload = (payload: unknown): string => {
  if (!isRecord(payload) || typeof payload.text !== 'string') {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected text string.',
      field: 'text',
    })
  }

  return payload.text
}

export const assertUrlPayload = (payload: unknown): string => {
  if (!isRecord(payload) || typeof payload.url !== 'string' || payload.url.length === 0) {
    throw new NeoPotError({
      code: 'IPC_INVALID_PAYLOAD',
      message: 'Expected URL string.',
      field: 'url',
    })
  }

  return payload.url
}
