import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, MessageCircle } from 'lucide-react'
import {
  ContactAvatar,
  useConversations,
  type Conversation,
} from '@/entities/conversation'
import { Button } from '@/shared/ui/button'
import { Composer } from './composer'
import { MessageList } from './message-list'

export function ConversationPanel({
  conversation,
  disabled,
  onSend,
}: {
  conversation: Conversation
  disabled: boolean
  onSend: (chatId: string, text: string) => Promise<void>
}) {
  const scroll = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const [showBottom, setShowBottom] = useState(false)
  const lastMessage = conversation.messages.at(-1)
  useEffect(() => {
    if (
      scroll.current &&
      (atBottom.current || lastMessage?.direction === 'outgoing')
    ) {
      scroll.current.scrollTop = scroll.current.scrollHeight
    }
  }, [lastMessage?.id, lastMessage?.direction, lastMessage?.status])

  function toBottom() {
    scroll.current?.scrollTo({
      top: scroll.current.scrollHeight,
      behavior: 'instant',
    })
    atBottom.current = true
    setShowBottom(false)
  }

  return (
    <section
      className="flex h-full min-h-0 flex-1 flex-col"
      aria-label={`Разговор с ${conversation.name}`}
    >
      <header className="flex h-[78px] shrink-0 items-center gap-3 border-b bg-card px-4 sm:px-7">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Назад к чатам"
          onClick={() => useConversations.getState().selectChat(null)}
        >
          <ArrowLeft />
        </Button>
        <ContactAvatar
          name={conversation.name}
          id={conversation.id}
          className="size-10"
        />
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">
            {conversation.name}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {conversation.phone &&
            conversation.name !== `+${conversation.phone}`
              ? `+${conversation.phone}`
              : 'Личный разговор'}
          </p>
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scroll}
          className="chat-surface flex-1 overflow-y-auto overscroll-contain py-6"
          onScroll={() => {
            const element = scroll.current
            if (!element) return
            atBottom.current =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              100
            setShowBottom(!atBottom.current)
          }}
        >
          {conversation.messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="flex size-16 items-center justify-center rounded-3xl bg-card/90 text-primary">
                <MessageCircle className="size-8" strokeWidth={1.5} />
              </div>
              <h3 className="mt-5 text-base font-semibold">
                Начните с «Привет»
              </h3>
              <p className="mt-2 max-w-64 text-sm leading-6 text-muted-foreground">
                Напишите первое сообщение.
                <br />
                Ответ появится здесь автоматически.
              </p>
            </div>
          ) : (
            <MessageList
              messages={conversation.messages}
              chatId={conversation.id}
            />
          )}
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {lastMessage?.direction === 'incoming'
              ? `Новое сообщение: ${lastMessage.text}`
              : ''}
          </p>
        </div>
        {showBottom && (
          <Button
            className="absolute right-5 bottom-4 rounded-full shadow-md"
            variant="secondary"
            size="icon"
            aria-label="К последним сообщениям"
            onClick={toBottom}
          >
            <ArrowDown />
          </Button>
        )}
      </div>
      <Composer
        key={conversation.id}
        conversation={conversation}
        disabled={disabled}
        onSend={onSend}
      />
    </section>
  )
}
