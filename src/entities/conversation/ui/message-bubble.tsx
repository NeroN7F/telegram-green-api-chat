import { Check, CheckCheck, CircleAlert, Clock3 } from 'lucide-react'
import type { Message, MessageStatus } from '../model/store'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

const timeFormat = new Intl.DateTimeFormat('ru', {
  hour: '2-digit',
  minute: '2-digit',
})
const labels: Record<MessageStatus, string> = {
  pending: 'Отправляется',
  accepted: 'Принято сервером',
  sent: 'Отправлено',
  delivered: 'Доставлено',
  read: 'Прочитано',
  failed: 'Не отправлено',
  uncertain: 'Статус неизвестен',
}

export function MessageBubble({
  message,
  onEdit,
}: {
  message: Message
  onEdit: (text: string) => void
}) {
  const outgoing = message.direction === 'outgoing'
  const failed = message.status === 'failed' || message.status === 'uncertain'
  const StatusIcon = failed
    ? CircleAlert
    : message.status === 'pending'
      ? Clock3
      : message.status === 'read' || message.status === 'delivered'
        ? CheckCheck
        : Check

  return (
    <li
      className={cn(
        'message-item flex px-4 sm:px-9',
        outgoing ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={cn(
          'max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-[0_1px_2px_#2326420a] sm:max-w-[72%]',
          outgoing ? 'rounded-br-md bg-outgoing' : 'rounded-bl-md bg-card',
        )}
      >
        <p className="text-[15px] leading-[1.45] wrap-anywhere whitespace-pre-wrap">
          {message.text}
        </p>
        <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
          <time dateTime={new Date(message.timestamp).toISOString()}>
            {timeFormat.format(message.timestamp)}
          </time>
          {outgoing && (
            <span
              role="img"
              aria-label={labels[message.status]}
              title={labels[message.status]}
            >
              <StatusIcon
                className={cn(
                  'size-3.5',
                  failed
                    ? 'text-destructive'
                    : message.status === 'read'
                      ? 'text-primary'
                      : '',
                )}
              />
            </span>
          )}
        </div>
        {failed && (
          <div className="mt-2 border-t border-foreground/10 pt-2">
            <p className="max-w-72 text-xs leading-5 text-destructive">
              {message.error || 'Telegram не смог доставить сообщение.'}
            </p>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 pt-1 text-xs"
              onClick={() => onEdit(message.text)}
            >
              Вернуть в поле ввода
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}
