import { useEffect, useRef, useState } from 'react'
import { ArrowRight, LoaderCircle, UserRoundPlus } from 'lucide-react'
import { useConversations } from '@/entities/conversation'
import {
  errorMessage,
  recipientSchema,
  type GreenApi,
} from '@/shared/api/green-api'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

export function NewChatDialog({
  open,
  onOpenChange,
  api,
  signal,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  api: GreenApi
  signal: AbortSignal
}) {
  const [recipient, setRecipient] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])

  function changeOpen(next: boolean) {
    if (!next) {
      pending.current?.abort()
      pending.current = null
      setRecipient('')
      setError('')
      setBusy(false)
    }
    onOpenChange(next)
  }

  async function createChat() {
    if (pending.current) return
    const parsed = recipientSchema.safeParse(recipient)
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? 'Проверьте телефон или @username',
      )
      return
    }
    const existing = Object.values(
      useConversations.getState().conversations,
    ).find(
      (chat) =>
        chat.phone === parsed.data || chat.name.toLowerCase() === parsed.data,
    )
    if (existing) {
      useConversations.getState().selectChat(existing.id)
      changeOpen(false)
      return
    }
    setBusy(true)
    setError('')
    const request = new AbortController()
    pending.current = request
    const combined = AbortSignal.any([signal, request.signal])
    try {
      const result = await api.checkAccount(parsed.data, combined)
      if (combined.aborted) return
      if (!result.exist || !result.chatId) {
        setError(
          'Аккаунт Telegram не найден. Проверьте данные или попробуйте @username, если номер скрыт.',
        )
        return
      }
      const phone = parsed.data.startsWith('@')
        ? result.phoneNumber
          ? String(result.phoneNumber)
          : undefined
        : parsed.data
      const name =
        result.username ||
        (parsed.data.startsWith('@') ? parsed.data : undefined)
      useConversations.getState().openChat(result.chatId, phone, name)
      changeOpen(false)
    } catch (failure) {
      if (!combined.aborted) setError(errorMessage(failure))
    } finally {
      if (pending.current === request) {
        pending.current = null
        setBusy(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="bg-card sm:max-w-[410px]">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
          <UserRoundPlus className="size-6" aria-hidden="true" />
        </div>
        <DialogHeader>
          <DialogTitle>Новый разговор</DialogTitle>
          <DialogDescription className="leading-6">
            Найдите собеседника в Telegram по международному номеру телефона или
            @username.
          </DialogDescription>
        </DialogHeader>
        <form
          className="mt-2 space-y-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void createChat()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="recipient">Телефон или @username</Label>
            <Input
              id="recipient"
              type="text"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="+998 90 123-45-67 или @username"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="h-11"
              disabled={busy}
              aria-invalid={!!error}
              aria-describedby="recipient-help"
            />
            <p
              id="recipient-help"
              className={
                error
                  ? 'text-xs leading-5 text-destructive'
                  : 'text-xs text-muted-foreground'
              }
              role={error ? 'alert' : undefined}
            >
              {error ||
                'Номер может быть скрыт настройками приватности Telegram.'}
            </p>
          </div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle className="animate-spin" />
                Ищем собеседника…
              </>
            ) : (
              <>
                Начать разговор
                <ArrowRight />
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
