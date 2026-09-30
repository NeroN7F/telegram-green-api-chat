import { beforeEach, expect, it } from 'vitest'
import { useConversations } from './store'

beforeEach(() => useConversations.getState().reset())

it('preserves arrival order when a reply has second precision and the local send has milliseconds', () => {
  const store = useConversations.getState()
  store.addMessage({
    id: 'sent',
    chatId: 'chat',
    text: 'Hello',
    timestamp: 1500,
    direction: 'outgoing',
    status: 'accepted',
  })
  store.addMessage({
    id: 'reply',
    chatId: 'chat',
    text: 'Hi',
    timestamp: 1000,
    direction: 'incoming',
    status: 'delivered',
  })
  expect(
    useConversations
      .getState()
      .conversations.chat?.messages.map((message) => message.id),
  ).toEqual(['sent', 'reply'])
})
