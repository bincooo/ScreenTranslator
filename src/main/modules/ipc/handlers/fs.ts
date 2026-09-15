import { app } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { assertNoPayload, isRecord } from '../payloadGuards'
import { resolveFilePath, resolveRemovableFilePath } from '../paths'
import type { IpcHandler } from '../types'

export function fsHandlers(): Record<string, IpcHandler> {
  return {
    'fs:read-dir': async (_event, payload) => {
      const entries = await readdir(resolveFilePath(payload), { withFileTypes: true }).catch(
        () => [],
      )
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      }))
    },
    'fs:read-text-file': (_event, payload) => {
      return readFile(resolveFilePath(payload), 'utf8')
    },
    'fs:read-file': async (_event, payload) => {
      return [...(await readFile(resolveFilePath(payload)))]
    },
    'fs:exists': (_event, payload) => {
      return existsSync(resolveFilePath(payload))
    },
    'fs:remove': async (_event, payload) => {
      const targetPath = resolveRemovableFilePath(payload)
      if (isRecord(payload) && payload.recursive === true) {
        await rm(targetPath, { recursive: true, force: true })
        return
      }

      await rm(targetPath, { force: true })
    },
    'path:app-config-dir': (_event, payload) => {
      assertNoPayload(payload)
      return app.getPath('userData')
    },
    'path:app-cache-dir': async (_event, payload) => {
      assertNoPayload(payload)
      const cachePath = path.join(app.getPath('userData'), 'Cache')
      await mkdir(cachePath, { recursive: true })
      return cachePath
    },
  }
}
