import { dialog } from 'electron'
import { assertDialogOpenPayload } from '../payloadGuards'
import type { IpcHandler } from '../types'

export function dialogHandlers(): Record<string, IpcHandler> {
  return {
    'dialog:open': async (_event, payload) => {
      const options = assertDialogOpenPayload(payload)
      const properties: Array<'openFile' | 'openDirectory' | 'multiSelections'> =
        options.properties && options.properties.length > 0
          ? options.properties
          : [options.directory ? 'openDirectory' : 'openFile']
      if (options.multiple && !properties.includes('multiSelections')) {
        properties.push('multiSelections')
      }

      const result = await dialog.showOpenDialog({
        properties,
        filters: options.filters,
      })

      if (result.canceled) {
        return null
      }

      return options.multiple ? result.filePaths : result.filePaths[0]
    },
  }
}
