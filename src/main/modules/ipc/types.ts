import type { IpcMainInvokeEvent } from 'electron'
import type { WindowLabel } from '../window'

export type IpcHandler = (event: IpcMainInvokeEvent, payload: unknown) => Promise<unknown> | unknown

export interface RegisterIpcHandlersOptions {
  getWindowLabel(event: IpcMainInvokeEvent): WindowLabel
}
