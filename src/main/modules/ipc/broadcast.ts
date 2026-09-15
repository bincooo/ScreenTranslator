import { broadcastToAllWindows } from '../window'

export function broadcastAppEvent(event: string, payload?: unknown): void {
  broadcastToAllWindows('app:event', { event, payload })
}
