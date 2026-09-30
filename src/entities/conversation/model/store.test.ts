import { beforeEach, describe, expect, it } from 'vitest'
import { useConversations, type Message } from './store'

const outgoing: Message = {
  id: 'local',
  chatId: 'chat',
  text: 'Hello',
  timestamp: 1000,
  direction: 'outgoing',
  status: 'pending',
}
beforeEach(() => useConversations.getState().reset())

describe('conversation state', () => {
  it('deduplicates notifications and unread counts', () => {
    const incoming: Message = {
      ...outgoing,
      id: 'remote',
      remoteId: 'remote',
      direction: 'incoming',
      status: 'delivered',
    }
    useConversations.getState().addMessage(incoming)
    useConversations.getState().addMessage(incoming)
    expect(
      useConversations.getState().conversations.chat?.messages,
    ).toHaveLength(1)
    expect(useConversations.getState().conversations.chat?.unread).toBe(1)
    useConversations.getState().selectChat('chat')
    expect(useConversations.getState().conversations.chat?.unread).toBe(0)
  })

  it('reconciles an outgoing echo arriving before the send response', () => {
    const store = useConversations.getState()
    store.addMessage(outgoing)
    store.addMessage({
      ...outgoing,
      id: 'remote',
      remoteId: 'remote',
      status: 'accepted',
    })
    store.updateStatus('chat', 'remote', 'read')
    store.acceptMessage('chat', 'local', 'remote')
    const messages = useConversations.getState().conversations.chat?.messages
    expect(messages).toHaveLength(1)
    expect(messages?.[0]).toMatchObject({
      id: 'local',
      remoteId: 'remote',
      status: 'read',
    })
  })

  it('preserves failed delivery received before API acceptance', () => {
    const store = useConversations.getState()
    store.addMessage(outgoing)
    store.updateStatus('chat', 'remote', 'failed')
    store.acceptMessage('chat', 'local', 'remote')
    expect(
      useConversations.getState().conversations.chat?.messages[0]?.status,
    ).toBe('failed')
  })

  it('does not regress a read status on delayed events', () => {
    const store = useConversations.getState()
    store.addMessage({ ...outgoing, remoteId: 'remote', status: 'read' })
    store.updateStatus('chat', 'remote', 'delivered')
    store.updateStatus('chat', 'remote', 'sent')
    expect(
      useConversations.getState().conversations.chat?.messages[0]?.status,
    ).toBe('read')
  })

  it('keeps drafts independent and clears the session completely', () => {
    const store = useConversations.getState()
    store.openChat('a')
    store.setDraft('a', 'Draft A')
    store.openChat('b')
    store.setDraft('b', 'Draft B')
    expect(useConversations.getState().conversations.a?.draft).toBe('Draft A')
    store.reset()
    expect(useConversations.getState().conversations).toEqual({})
    expect(useConversations.getState().earlyStatuses).toEqual({})
  })
})
