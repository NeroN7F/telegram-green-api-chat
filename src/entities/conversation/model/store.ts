import { create } from 'zustand'

export type MessageStatus =
  | 'pending'
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'uncertain'

export type Message = {
  id: string
  remoteId?: string
  chatId: string
  text: string
  timestamp: number
  direction: 'incoming' | 'outgoing'
  status: MessageStatus
  error?: string
}

export type Conversation = {
  id: string
  name: string
  phone?: string
  updatedAt: number
  unread: number
  draft: string
  messages: Message[]
}

type ConversationState = {
  conversations: Record<string, Conversation>
  activeId: string | null
  earlyStatuses: Record<string, MessageStatus>
  openChat: (id: string, phone?: string, name?: string) => void
  selectChat: (id: string | null) => void
  setDraft: (id: string, draft: string) => void
  addMessage: (message: Message, name?: string, phone?: string) => void
  acceptMessage: (chatId: string, localId: string, remoteId: string) => void
  failMessage: (
    chatId: string,
    localId: string,
    status: 'failed' | 'uncertain',
    error: string,
  ) => void
  updateStatus: (
    chatId: string,
    remoteId: string,
    status: MessageStatus,
  ) => void
  reset: () => void
}

const progress: Record<MessageStatus, number> = {
  pending: 0,
  uncertain: 1,
  failed: 2,
  accepted: 3,
  sent: 4,
  delivered: 5,
  read: 6,
}

function advanceStatus(
  current: MessageStatus,
  next: MessageStatus,
): MessageStatus {
  if (current === 'read' || (current === 'delivered' && next !== 'read'))
    return current
  if (next === 'failed') return next
  return progress[next] > progress[current] ? next : current
}

function newConversation(
  id: string,
  phone?: string,
  name?: string,
): Conversation {
  return {
    id,
    phone,
    name: name || (phone ? `+${phone}` : `Чат ${id}`),
    updatedAt: Date.now(),
    unread: 0,
    draft: '',
    messages: [],
  }
}

export const useConversations = create<ConversationState>((set) => ({
  conversations: {},
  activeId: null,
  earlyStatuses: {},
  openChat: (id, phone, name) =>
    set((state) => ({
      activeId: id,
      conversations: {
        ...state.conversations,
        [id]: {
          ...(state.conversations[id] ?? newConversation(id, phone, name)),
          unread: 0,
        },
      },
    })),
  selectChat: (id) =>
    set((state) => ({
      activeId: id,
      conversations:
        id && state.conversations[id]
          ? {
              ...state.conversations,
              [id]: { ...state.conversations[id], unread: 0 },
            }
          : state.conversations,
    })),
  setDraft: (id, draft) =>
    set((state) => {
      const chat = state.conversations[id]
      return chat
        ? {
            conversations: { ...state.conversations, [id]: { ...chat, draft } },
          }
        : state
    }),
  addMessage: (message, name, phone) =>
    set((state) => {
      const chat =
        state.conversations[message.chatId] ??
        newConversation(message.chatId, phone, name)
      if (
        chat.messages.some(
          (existing) =>
            existing.id === message.id ||
            (message.remoteId && existing.remoteId === message.remoteId),
        )
      )
        return state
      const earlyStatus = message.remoteId
        ? state.earlyStatuses[`${message.chatId}:${message.remoteId}`]
        : undefined
      const nextMessage = earlyStatus
        ? { ...message, status: advanceStatus(message.status, earlyStatus) }
        : message
      return {
        conversations: {
          ...state.conversations,
          [chat.id]: {
            ...chat,
            name: name || chat.name,
            phone: phone || chat.phone,
            updatedAt: Math.max(chat.updatedAt, message.timestamp),
            unread:
              chat.unread +
              (message.direction === 'incoming' && state.activeId !== chat.id
                ? 1
                : 0),
            messages: [...chat.messages, nextMessage].sort(
              (a, b) =>
                Math.floor(a.timestamp / 1000) - Math.floor(b.timestamp / 1000),
            ),
          },
        },
      }
    }),
  acceptMessage: (chatId, localId, remoteId) =>
    set((state) => {
      const chat = state.conversations[chatId]
      if (!chat) return state
      const echo = chat.messages.find(
        (message) => message.remoteId === remoteId && message.id !== localId,
      )
      const status =
        state.earlyStatuses[`${chatId}:${remoteId}`] ??
        echo?.status ??
        'accepted'
      return {
        conversations: {
          ...state.conversations,
          [chatId]: {
            ...chat,
            messages: chat.messages
              .filter(
                (message) =>
                  message.remoteId !== remoteId || message.id === localId,
              )
              .map((message) =>
                message.id === localId
                  ? {
                      ...message,
                      remoteId,
                      status: advanceStatus('accepted', status),
                    }
                  : message,
              ),
          },
        },
      }
    }),
  failMessage: (chatId, localId, status, error) =>
    set((state) => {
      const chat = state.conversations[chatId]
      return chat
        ? {
            conversations: {
              ...state.conversations,
              [chatId]: {
                ...chat,
                messages: chat.messages.map((message) =>
                  message.id === localId
                    ? { ...message, status, error }
                    : message,
                ),
              },
            },
          }
        : state
    }),
  updateStatus: (chatId, remoteId, status) =>
    set((state) => {
      const chat = state.conversations[chatId]
      const key = `${chatId}:${remoteId}`
      const nextStatus = advanceStatus(
        state.earlyStatuses[key] ?? 'pending',
        status,
      )
      const entries = Object.entries({
        ...state.earlyStatuses,
        [key]: nextStatus,
      }).slice(-1000)
      return {
        earlyStatuses: Object.fromEntries(entries),
        conversations: chat
          ? {
              ...state.conversations,
              [chatId]: {
                ...chat,
                messages: chat.messages.map((message) =>
                  message.remoteId === remoteId
                    ? {
                        ...message,
                        status: advanceStatus(message.status, status),
                      }
                    : message,
                ),
              },
            }
          : state.conversations,
      }
    }),
  reset: () => set({ conversations: {}, activeId: null, earlyStatuses: {} }),
}))
