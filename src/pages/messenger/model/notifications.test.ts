import { beforeEach, describe, expect, it } from 'vitest'
import { useConversations } from '@/entities/conversation'
import { processNotification } from './notifications'

beforeEach(() => useConversations.getState().reset())

describe('notification mapping', () => {
  it('handles text containing links', () => {
    processNotification({
      typeWebhook: 'incomingMessageReceived',
      idMessage: 'url',
      timestamp: 100,
      senderData: { chatId: 'chat', chatType: 'user', chatName: 'Alex' },
      messageData: {
        typeMessage: 'extendedTextMessage',
        extendedTextMessageData: { text: 'https://example.com' },
      },
    })
    expect(
      useConversations.getState().conversations.chat?.messages[0]?.text,
    ).toBe('https://example.com')
  })

  it('ignores unsupported media and group notifications', () => {
    processNotification({
      typeWebhook: 'incomingMessageReceived',
      idMessage: 'media',
      timestamp: 100,
      senderData: { chatId: 'chat', chatType: 'user' },
      messageData: { typeMessage: 'imageMessage' },
    })
    processNotification({
      typeWebhook: 'incomingMessageReceived',
      idMessage: 'group',
      timestamp: 100,
      senderData: { chatId: 'group', chatType: 'group' },
      messageData: {
        typeMessage: 'textMessage',
        textMessageData: { textMessage: 'group text' },
      },
    })
    expect(useConversations.getState().conversations).toEqual({})
  })

  it('turns provider delivery failures into failed messages', () => {
    const store = useConversations.getState()
    store.addMessage({
      id: 'local',
      remoteId: 'remote',
      chatId: 'chat',
      direction: 'outgoing',
      text: 'hello',
      timestamp: 100,
      status: 'accepted',
    })
    processNotification({
      typeWebhook: 'outgoingMessageStatus',
      idMessage: 'remote',
      chatId: 'chat',
      status: 'noAccount',
    })
    expect(
      useConversations.getState().conversations.chat?.messages[0]?.status,
    ).toBe('failed')
  })

  it('returns a pause reason for revoked instance authorization', () => {
    expect(
      processNotification({
        typeWebhook: 'stateInstanceChanged',
        stateInstance: 'notAuthorized',
      }),
    ).toContain('отключён')
  })
})
