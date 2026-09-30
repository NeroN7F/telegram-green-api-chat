import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Conversation } from '@/entities/conversation'
import { Composer } from './composer'

const conversation: Conversation = {
  id: 'chat',
  name: 'Alex',
  updatedAt: 1000,
  unread: 0,
  draft: 'Привет',
  messages: [],
}

describe('composer keyboard behavior', () => {
  it('does not submit Enter while composing text or inserting a line break', () => {
    const onSend = vi.fn(() => Promise.resolve())
    render(
      <Composer conversation={conversation} disabled={false} onSend={onSend} />,
    )
    const input = screen.getByRole('textbox', { name: 'Сообщение' })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('prevents duplicate submissions before the first request settles', async () => {
    let finish: () => void = () => undefined
    const onSend = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    render(
      <Composer conversation={conversation} disabled={false} onSend={onSend} />,
    )
    const input = screen.getByRole('textbox', { name: 'Сообщение' })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledExactlyOnceWith('chat', 'Привет')
    finish()
    await Promise.resolve()
  })

  it('blocks sending when the connection is paused', () => {
    const onSend = vi.fn(() => Promise.resolve())
    render(<Composer conversation={conversation} disabled onSend={onSend} />)
    expect(
      screen.getByRole('button', { name: 'Отправить сообщение' }),
    ).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Сообщение' })).toBeDisabled()
  })
})
