import { inputTranslate, ocrRecognize, ocrTranslate, selectionTranslate } from '../../workflow'
import { NeoPotError } from '../errors'
import { assertNoPayload, isRecord } from '../payloadGuards'
import type { IpcHandler } from '../types'

export function workflowHandlers(): Record<string, IpcHandler> {
  return {
    'workflow:selection-translate': (_event, payload) => {
      assertNoPayload(payload)
      return selectionTranslate()
    },
    'workflow:input-translate': (_event, payload) => {
      assertNoPayload(payload)
      return inputTranslate()
    },
    'workflow:ocr-recognize': (_event, payload) => {
      assertNoPayload(payload)
      return ocrRecognize()
    },
    'workflow:ocr-translate': (_event, payload) => {
      assertNoPayload(payload)
      return ocrTranslate()
    },
    'services:translate': async (_event, payload) => {
      if (!isRecord(payload)) {
        throw new NeoPotError({
          code: 'IPC_INVALID_PAYLOAD',
          message: 'Expected a translation request object.',
        })
      }

      const { translate } = await import('../../../services')
      return translate(payload)
    },
  }
}
