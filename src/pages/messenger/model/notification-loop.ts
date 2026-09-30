import { ApiError, type GreenApi } from '@/shared/api/green-api'
import { delay } from '@/shared/lib/delay'

export type ConnectionStatus =
  'connecting' | 'connected' | 'reconnecting' | 'blocked' | 'waiting'

export async function runNotificationLoop({
  api,
  signal,
  onNotification,
  onStatus,
}: {
  api: Pick<GreenApi, 'receiveNotification' | 'deleteNotification'>
  signal: AbortSignal
  onNotification: (body: unknown) => string | void
  onStatus: (status: ConnectionStatus, error?: string) => void
}) {
  let receiptId: number | null = null
  let stopReason: string | void = undefined
  let failures = 0

  while (!signal.aborted) {
    try {
      if (receiptId !== null) {
        await api.deleteNotification(receiptId, signal)
        receiptId = null
        if (!signal.aborted && stopReason) {
          onStatus('blocked', stopReason)
          break
        }
      } else {
        const notification = await api.receiveNotification(signal)
        if (signal.aborted) break
        if (notification) {
          stopReason = onNotification(notification.body)
          receiptId = notification.receiptId
        } else {
          await delay(250, signal)
        }
      }
      if (signal.aborted) break
      failures = 0
      onStatus('connected')
    } catch (error) {
      if (signal.aborted) break
      const permanent = !(error instanceof ApiError) || !error.retryable
      onStatus(
        permanent ? 'blocked' : 'reconnecting',
        error instanceof ApiError
          ? error.message
          : 'Не удалось обработать уведомление.',
      )
      if (permanent) break
      failures++
      try {
        await delay(
          Math.min(1000 * 2 ** Math.min(failures - 1, 5), 30000),
          signal,
        )
      } catch {
        break
      }
    }
  }
}
