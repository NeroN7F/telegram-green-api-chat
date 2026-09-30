import { useState } from 'react'
import { CircleAlert, Plus, RefreshCw } from 'lucide-react'
import { useConversations } from '@/entities/conversation'
import { Button } from '@/shared/ui/button'
import { ChatSidebar } from './chat-sidebar'
import { ConversationPanel } from './conversation-panel'
import { NewChatDialog } from './new-chat-dialog'
import { useMessenger } from '../model/use-messenger'

export function MessengerPage() {
  const {
    api,
    session,
    connection,
    reconnect,
    send,
    disconnect,
    accountIdentity,
  } = useMessenger()
  const active = useConversations((state) =>
    state.activeId ? state.conversations[state.activeId] : undefined,
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const disabled =
    connection.status === 'blocked' ||
    connection.status === 'waiting' ||
    connection.status === 'connecting'

  if (!api || !session) return null
  return (
    <main className="screen-enter flex h-dvh items-center justify-center sm:p-5 lg:p-8">
      <h1 className="sr-only">Telegram - сообщения</h1>
      <div className="flex h-full max-h-[980px] w-full max-w-[1440px] flex-col overflow-hidden bg-card sm:rounded-2xl sm:border sm:shadow-[0_8px_48px_-24px_#223b4930]">
        {connection.error && (
          <div
            role="alert"
            className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b bg-accent px-4 py-2.5 text-xs"
          >
            <CircleAlert
              className="size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>{connection.error}</span>
            {(connection.status === 'blocked' ||
              connection.status === 'waiting') && (
              <Button
                variant="link"
                size="sm"
                className="h-6 text-xs"
                onClick={reconnect}
              >
                <RefreshCw className="size-3" />
                Повторить
              </Button>
            )}
          </div>
        )}
        <div className="flex min-h-0 flex-1">
          <ChatSidebar
            onNewChat={() => setDialogOpen(true)}
            onDisconnect={disconnect}
            disabled={disabled}
            accountIdentity={accountIdentity}
            status={connection.status}
          />
          {active ? (
            <ConversationPanel
              key={active.id}
              conversation={active}
              onSend={send}
              disabled={disabled}
            />
          ) : (
            <section
              className="chat-surface hidden min-w-0 flex-1 flex-col items-center justify-center px-8 text-center md:flex"
              aria-label="Начало разговора"
            >
              <div className="flex size-24 items-center justify-center rounded-[32px] bg-card text-primary shadow-[0_8px_24px_-12px_#1674a540]">
                <img src="/telegram-logo.svg" alt="" className="size-14" />
              </div>
              <h2 className="mt-7 text-2xl font-semibold tracking-tight">
                Хороший разговор
                <br />
                начинается с сообщения
              </h2>
              <p className="mt-4 max-w-72 text-sm leading-6 text-muted-foreground">
                Выберите чат слева или добавьте нового собеседника по номеру
                телефона.
              </p>
              <Button
                className="mt-7 rounded-xl px-5"
                onClick={() => setDialogOpen(true)}
                disabled={disabled}
              >
                <Plus />
                Новый разговор
              </Button>
              <p className="mt-12 text-[11px] text-muted-foreground">
                Сообщения этой сессии доступны до обновления страницы.
              </p>
            </section>
          )}
        </div>
        <NewChatDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          api={api}
          signal={session.controller.signal}
        />
      </div>
    </main>
  )
}
