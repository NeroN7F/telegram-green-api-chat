import { describe, expect, it, vi } from 'vitest'
import { runNotificationLoop } from './notification-loop'

describe('queue interruption', () => {
  it('acknowledges a state change before pausing reception', async () => {
    const receiveNotification = vi
      .fn()
      .mockResolvedValue({ receiptId: 8, body: 'revoked' })
    const deleteNotification = vi.fn().mockResolvedValue({ result: true })
    const onStatus = vi.fn()
    await runNotificationLoop({
      api: { receiveNotification, deleteNotification },
      signal: new AbortController().signal,
      onNotification: () => 'Instance disconnected',
      onStatus,
    })
    expect(deleteNotification).toHaveBeenCalledExactlyOnceWith(
      8,
      expect.any(AbortSignal),
    )
    expect(receiveNotification).toHaveBeenCalledTimes(1)
    expect(onStatus).toHaveBeenLastCalledWith(
      'blocked',
      'Instance disconnected',
    )
  })

  it('acknowledges ignored notifications so later text is not blocked', async () => {
    const controller = new AbortController()
    const receiveNotification = vi
      .fn()
      .mockResolvedValueOnce({ receiptId: 9, body: { type: 'unsupported' } })
      .mockImplementationOnce(() => {
        controller.abort()
        return Promise.resolve(null)
      })
    const deleteNotification = vi.fn().mockResolvedValue({ result: true })
    await runNotificationLoop({
      api: { receiveNotification, deleteNotification },
      signal: controller.signal,
      onNotification: () => undefined,
      onStatus: vi.fn(),
    })
    expect(deleteNotification).toHaveBeenCalledExactlyOnceWith(
      9,
      controller.signal,
    )
  })
})
