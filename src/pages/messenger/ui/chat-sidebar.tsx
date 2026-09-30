import { useDeferredValue, useState } from 'react'
import { LogOut, MessageCircle, Plus, Search } from 'lucide-react'
import { ContactAvatar, useConversations } from '@/entities/conversation'
import { cn } from '@/shared/lib/utils'
import { Brand } from '@/shared/ui/brand'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

const timeFormat = new Intl.DateTimeFormat('ru', {
  hour: '2-digit',
  minute: '2-digit',
})

export function ChatSidebar({
  onNewChat,
  onDisconnect,
  disabled,
  accountIdentity,
  status,
}: {
  onNewChat: () => void
  onDisconnect: () => void
  disabled: boolean
  accountIdentity: string | null
  status: string
}) {
  const conversations = useConversations((state) => state.conversations)
  const activeId = useConversations((state) => state.activeId)
  const [search, setSearch] = useState('')
  const query = useDeferredValue(search.trim().toLocaleLowerCase('ru'))
  const chats = Object.values(conversations)
    .filter((chat) =>
      `${chat.name} ${chat.phone ?? ''}`
        .toLocaleLowerCase('ru')
        .includes(query),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <aside
      className={cn(
        'flex h-full w-full shrink-0 flex-col border-r bg-card md:flex md:w-[320px] lg:w-[350px]',
        activeId ? 'hidden' : '',
      )}
      aria-label="Список чатов"
    >
      <header className="flex h-[78px] shrink-0 items-center justify-between px-5">
        <Brand compact />
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          aria-label="Новый чат"
          onClick={onNewChat}
          disabled={disabled}
        >
          <Plus className="size-5" />
        </Button>
      </header>
      <div className="px-5 pb-4">
        <div className="relative">
          <Search
            className="absolute top-3 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="h-10 rounded-xl border-0 bg-secondary pl-9 shadow-none"
            aria-label="Поиск чатов"
            placeholder="Поиск"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center justify-between px-6 pb-3">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground">
          СООБЩЕНИЯ
        </h2>
        <span className="text-xs text-muted-foreground">
          {Object.keys(conversations).length}
        </span>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2" aria-label="Чаты">
        {chats.length ? (
          chats.map((chat) => {
            const last = chat.messages.at(-1)
            return (
              <button
                key={chat.id}
                onClick={() => useConversations.getState().selectChat(chat.id)}
                className={cn(
                  'mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  activeId === chat.id ? 'bg-accent' : 'hover:bg-secondary',
                )}
                aria-current={activeId === chat.id ? 'true' : undefined}
              >
                <ContactAvatar name={chat.name} id={chat.id} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {chat.name}
                    </span>
                    {last && (
                      <time
                        className="shrink-0 text-[10px] text-muted-foreground"
                        dateTime={new Date(last.timestamp).toISOString()}
                      >
                        {timeFormat.format(last.timestamp)}
                      </time>
                    )}
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="block min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {chat.draft
                        ? `Черновик: ${chat.draft}`
                        : last
                          ? `${last.direction === 'outgoing' ? 'Вы: ' : ''}${last.text}`
                          : 'Начните разговор'}
                    </span>
                    {chat.unread > 0 && (
                      <span
                        className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white"
                        aria-label={`Непрочитанных: ${chat.unread}`}
                      >
                        {chat.unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            )
          })
        ) : (
          <div className="px-5 py-12 text-center">
            <MessageCircle
              className="mx-auto size-8 text-muted-foreground/60"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <p className="mt-4 text-sm font-medium">
              {query ? 'Ничего не найдено' : 'Здесь будут ваши чаты'}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {query
                ? 'Попробуйте другое имя или номер.'
                : 'Найдите собеседника по телефону или @username.'}
            </p>
            {!query && (
              <Button
                variant="link"
                className="mt-2 text-xs"
                onClick={onNewChat}
                disabled={disabled}
              >
                Создать первый чат
                <Plus className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </nav>
      <footer className="mx-5 flex items-center justify-between border-t py-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <span
              className={cn(
                'size-1.5 rounded-full',
                status === 'connected' ? 'bg-success' : 'bg-muted-foreground',
              )}
            />
            {status === 'connected'
              ? 'Подключено'
              : status === 'reconnecting'
                ? 'Переподключение'
                : status === 'connecting'
                  ? 'Подключение'
                  : 'Приём приостановлен'}
          </p>
          {accountIdentity && (
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {accountIdentity}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          aria-label="Отключиться"
          onClick={onDisconnect}
        >
          <LogOut className="size-4" />
        </Button>
      </footer>
    </aside>
  )
}
