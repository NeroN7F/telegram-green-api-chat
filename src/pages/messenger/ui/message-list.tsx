import { memo } from 'react'
import {
  MessageBubble,
  useConversations,
  type Message,
} from '@/entities/conversation'

const dateFormat = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'long',
})

export const MessageList = memo(function MessageList({
  messages,
  chatId,
}: {
  messages: Message[]
  chatId: string
}) {
  return (
    <ol className="space-y-2.5" aria-label="Сообщения">
      {messages.map((message, index) => {
        const previous = messages[index - 1]
        const showDate =
          !previous ||
          new Date(previous.timestamp).toDateString() !==
            new Date(message.timestamp).toDateString()
        return (
          <MessageGroup
            key={message.id}
            date={showDate ? dateFormat.format(message.timestamp) : null}
          >
            <MessageBubble
              message={message}
              onEdit={(text) =>
                useConversations.getState().setDraft(chatId, text)
              }
            />
          </MessageGroup>
        )
      })}
    </ol>
  )
})

function MessageGroup({
  date,
  children,
}: {
  date: string | null
  children: React.ReactNode
}) {
  return (
    <>
      {date && (
        <li className="flex justify-center py-3">
          <span className="rounded-full bg-card/80 px-3 py-1 text-[11px] text-muted-foreground">
            {date}
          </span>
        </li>
      )}
      {children}
    </>
  )
}
