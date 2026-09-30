import { useRef } from 'react'
import { Send } from 'lucide-react'
import { useConversations, type Conversation } from '@/entities/conversation'
import { MESSAGE_LENGTH_LIMIT } from '@/shared/api/green-api'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'

export function Composer({
  conversation,
  disabled,
  onSend,
}: {
  conversation: Conversation
  disabled: boolean
  onSend: (chatId: string, text: string) => Promise<void>
}) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const valid =
    !!conversation.draft.trim() &&
    conversation.draft.trim().length <= MESSAGE_LENGTH_LIMIT
  const sending = conversation.messages.some(
    (message) => message.status === 'pending',
  )
  const locked = useRef(false)
  const submit = async () => {
    if (!valid || disabled || sending || locked.current) return
    locked.current = true
    textarea.current?.focus()
    try {
      await onSend(conversation.id, conversation.draft)
    } finally {
      locked.current = false
    }
  }

  return (
    <form
      className="shrink-0 border-t bg-card px-4 pt-3 pb-2 sm:px-7 sm:pt-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="flex items-end gap-3">
        <Textarea
          ref={textarea}
          aria-label="Сообщение"
          aria-describedby="composer-help"
          placeholder="Напишите сообщение…"
          className="max-h-36 min-h-11 resize-none border-0 bg-secondary px-4 py-3 shadow-none focus-visible:ring-2"
          value={conversation.draft}
          disabled={disabled}
          onChange={(event) =>
            useConversations
              .getState()
              .setDraft(conversation.id, event.target.value)
          }
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              void submit()
            }
          }}
          rows={1}
          maxLength={MESSAGE_LENGTH_LIMIT}
        />
        <Button
          type="submit"
          className="size-11 shrink-0 rounded-xl"
          size="icon"
          aria-label="Отправить сообщение"
          disabled={!valid || disabled || sending}
        >
          <Send className="size-5" />
        </Button>
      </div>
      <div
        id="composer-help"
        className="flex h-6 items-center justify-between text-[10px] text-muted-foreground"
      >
        <span>Enter - отправить · Shift + Enter - новая строка</span>
        <span aria-live="off">
          {conversation.draft.length
            ? `${conversation.draft.length} / 4 096`
            : 'Только текст'}
        </span>
      </div>
    </form>
  )
}
