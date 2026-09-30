import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/green-api'
import { runNotificationLoop } from './notification-loop'

afterEach(() => vi.useRealTimers())

describe('notification loop', () => {
  it('processes then acknowledges before receiving the next event', async () => {
    const controller = new AbortController()
    const order: string[] = []
    const receiveNotification = vi
      .fn()
      .mockImplementationOnce(() => {
        order.push('receive')
        return Promise.resolve({ receiptId: 42, body: { text: 'hello' } })
      })
      .mockImplementationOnce(() => {
        order.push('next')
        controller.abort()
        return Promise.resolve(null)
      })
    const deleteNotification = vi.fn(() => {
      order.push('acknowledge')
      return Promise.resolve({ result: true })
    })
    await runNotificationLoop({
      api: { receiveNotification, deleteNotification },
      signal: controller.signal,
      onNotification: () => {
        order.push('process')
      },
      onStatus: vi.fn(),
    })
    expect(order).toEqual(['receive', 'process', 'acknowledge', 'next'])
  })

  it('retries an acknowledgement without processing the message twice', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const receiveNotification = vi
      .fn()
      .mockResolvedValueOnce({ receiptId: 42, body: 'message' })
      .mockImplementationOnce(() => {
        controller.abort()
        return Promise.resolve(null)
      })
    const deleteNotification = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('offline'))
      .mockResolvedValueOnce({ result: true })
    const onNotification = vi.fn()
    const onStatus = vi.fn()
    const run = runNotificationLoop({
      api: { receiveNotification, deleteNotification },
      signal: controller.signal,
      onNotification,
      onStatus,
    })
    await vi.advanceTimersByTimeAsync(1000)
    await run
    expect(deleteNotification).toHaveBeenCalledTimes(2)
    expect(onNotification).toHaveBeenCalledTimes(1)
    expect(onStatus).toHaveBeenCalledWith('reconnecting', 'offline')
  })

  it('stops on authorization errors', async () => {
    const receiveNotification = vi
      .fn()
      .mockRejectedValue(new ApiError('unauthorized', 401))
    const deleteNotification = vi.fn()
    const onStatus = vi.fn()
    await runNotificationLoop({
      api: { receiveNotification, deleteNotification },
      signal: new AbortController().signal,
      onNotification: vi.fn(),
      onStatus,
    })
    expect(receiveNotification).toHaveBeenCalledTimes(1)
    expect(onStatus).toHaveBeenCalledWith('blocked', 'unauthorized')
  })

  it('does not process a response arriving after cancellation', async () => {
    const controller = new AbortController()
    const receiveNotification = vi.fn(() => {
      controller.abort()
      return Promise.resolve({ receiptId: 42, body: 'stale' })
    })
    const onNotification = vi.fn()
    const deleteNotification = vi.fn()
    await runNotificationLoop({
      api: { receiveNotification, deleteNotification },
      signal: controller.signal,
      onNotification,
      onStatus: vi.fn(),
    })
    expect(onNotification).not.toHaveBeenCalled()
    expect(deleteNotification).not.toHaveBeenCalled()
  })
})
