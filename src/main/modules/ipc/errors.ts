export interface NeoPotErrorPayload {
  code: 'IPC_UNKNOWN_CHANNEL' | 'IPC_INVALID_PAYLOAD' | 'IPC_HANDLER_FAILED'
  message: string
  field?: string
}

export class NeoPotError extends Error {
  readonly code: NeoPotErrorPayload['code']
  readonly field?: string

  constructor(payload: NeoPotErrorPayload) {
    super(payload.message)
    this.name = 'NeoPotError'
    this.code = payload.code
    this.field = payload.field
  }
}
