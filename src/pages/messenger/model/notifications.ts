import { useConversations } from '@/entities/conversation'
import {
  messageEventSchema,
  stateEventSchema,
  statusEventSchema,
} from '@/shared/api/green-api'

export function processNotification(body: unknown): string | void {
  const status = statusEventSchema.safeParse(body)
  if (status.success) {
    const { chatId, idMessage, status: value } = status.data
    useConversations
      .getState()
      .updateStatus(chatId, idMessage, value === 'noAccount' ? 'failed' : value)
    return
  }

  const state = stateEventSchema.safeParse(body)
  if (state.success && state.data.stateInstance !== 'authorized') {
    return 'Инстанс отключён от Telegram. Авторизуйте его в GREEN-API и подключитесь снова.'
  }

  const message = messageEventSchema.safeParse(body)
  if (!message.success || message.data.senderData.chatType === 'group') return
  const { idMessage, timestamp, senderData, messageData, typeWebhook } =
    message.data
  const text =
    messageData.typeMessage === 'textMessage'
      ? messageData.textMessageData?.textMessage
      : messageData.typeMessage === 'extendedTextMessage'
        ? messageData.extendedTextMessageData?.text
        : undefined
  if (text === undefined) return

  useConversations.getState().addMessage(
    {
      id: idMessage,
      remoteId: idMessage,
      chatId: senderData.chatId,
      text,
      timestamp: timestamp * 1000,
      direction:
        typeWebhook === 'incomingMessageReceived' ? 'incoming' : 'outgoing',
      status:
        typeWebhook === 'incomingMessageReceived' ? 'delivered' : 'accepted',
    },
    senderData.senderContactName ||
      senderData.chatName ||
      senderData.senderName,
    senderData.senderPhoneNumber
      ? String(senderData.senderPhoneNumber)
      : undefined,
  )
}
