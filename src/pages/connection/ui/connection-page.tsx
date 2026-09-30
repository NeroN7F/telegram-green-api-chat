import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle } from 'lucide-react'
import { useConversations } from '@/entities/conversation'
import { useSession } from '@/entities/session'
import { credentialsSchema, errorMessage } from '@/shared/api/green-api'
import { delay } from '@/shared/lib/delay'
import { cn } from '@/shared/lib/utils'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Brand } from '@/shared/ui/brand'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { validateConnection } from '../model/connect'

export function ConnectionPage() {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  async function connect(form: HTMLFormElement) {
    if (controller.current && !controller.current.signal.aborted) return
    const result = credentialsSchema.safeParse(
      Object.fromEntries(new FormData(form)),
    )
    if (!result.success) {
      setFields(
        Object.fromEntries(
          result.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      )
      setError('')
      return
    }
    setFields({})
    setError('')
    setBusy(true)
    const request = new AbortController()
    controller.current = request
    try {
      await validateConnection(result.data, request.signal)
      if (request.signal.aborted) return
      setExiting(true)
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)')
        .matches
        ? 0
        : 280
      if (duration) await delay(duration, request.signal)
      if (request.signal.aborted) return
      useConversations.getState().reset()
      useSession.getState().connect(result.data)
    } catch (failure) {
      if (!request.signal.aborted) {
        setExiting(false)
        setError(errorMessage(failure))
      }
    } finally {
      if (!request.signal.aborted) {
        controller.current = null
        setBusy(false)
      }
    }
  }

  return (
    <main className={cn('flex min-h-dvh flex-col', exiting && 'screen-exit')}>
      <header className="mx-auto flex w-full max-w-7xl items-center px-6 py-7 sm:px-10">
        <Brand compact />
      </header>
      <div className="flex flex-1 items-center justify-center px-5 py-8 sm:py-12">
        <section className="grid w-full max-w-[940px] overflow-hidden rounded-3xl border bg-card shadow-[0_16px_64px_-28px_#223b4930] md:grid-cols-[1.1fr_1fr]">
          <div className="p-7 sm:p-12">
            <div className="mb-7 flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
              <KeyRound className="size-5" aria-hidden="true" />
            </div>
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight">
              Ваш Telegram.
              <br />
              Всегда под рукой.
            </h1>
            <form
              className="mt-10 space-y-5"
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                void connect(event.currentTarget)
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="idInstance">ID инстанса</Label>
                <Input
                  className="h-11 bg-card"
                  id="idInstance"
                  name="idInstance"
                  placeholder="Например, 4100123456"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  aria-invalid={!!fields.idInstance}
                  aria-describedby={fields.idInstance ? 'id-error' : undefined}
                  disabled={busy}
                />
                {fields.idInstance && (
                  <p id="id-error" className="text-xs text-destructive">
                    {fields.idInstance}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiTokenInstance">API-токен</Label>
                <div className="relative">
                  <Input
                    className="h-11 bg-card pr-11"
                    id="apiTokenInstance"
                    name="apiTokenInstance"
                    type={visible ? 'text' : 'password'}
                    placeholder="apiTokenInstance"
                    autoComplete="off"
                    spellCheck={false}
                    required
                    aria-invalid={!!fields.apiTokenInstance}
                    aria-describedby={
                      fields.apiTokenInstance ? 'token-error' : undefined
                    }
                    disabled={busy}
                  />
                  <Button
                    className="absolute top-1 right-1 text-muted-foreground"
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={visible ? 'Скрыть токен' : 'Показать токен'}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
                {fields.apiTokenInstance && (
                  <p id="token-error" className="text-xs text-destructive">
                    {fields.apiTokenInstance}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiUrl">Сервер API</Label>
                <Input
                  className="h-11 bg-card"
                  id="apiUrl"
                  name="apiUrl"
                  type="url"
                  placeholder="https://4100.api.green-api.com"
                  autoComplete="url"
                  spellCheck={false}
                  required
                  aria-invalid={!!fields.apiUrl}
                  aria-describedby={fields.apiUrl ? 'api-error' : undefined}
                  disabled={busy}
                />
                {fields.apiUrl && (
                  <p id="api-error" className="text-xs text-destructive">
                    {fields.apiUrl}
                  </p>
                )}
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                className="h-11 w-full rounded-xl"
                type="submit"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <LoaderCircle className="animate-spin" />
                    Подключаемся…
                  </>
                ) : (
                  <>
                    Подключиться
                    <ArrowRight />
                  </>
                )}
              </Button>
            </form>
          </div>
          <aside className="chat-surface hidden flex-col justify-center border-l p-10 md:flex">
            <img src="/telegram-logo.svg" alt="" className="mx-auto size-24" />
            <h2 className="mt-8 text-center text-xl font-semibold tracking-tight">
              Личные сообщения
            </h2>
            <p className="mt-3 text-center text-sm leading-6 text-muted-foreground">
              По номеру или @username.
              <br />
              Только нужные функции.
            </p>
            <ol className="mt-10 space-y-5">
              {[
                'Подключите свой инстанс',
                'Найдите собеседника',
                'Начните разговор',
              ].map((text, index) => (
                <li key={text} className="flex items-center gap-3 text-sm">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  {text}
                </li>
              ))}
            </ol>
          </aside>
        </section>
      </div>
      <footer className="px-6 pt-4 pb-7 text-center text-xs text-muted-foreground">
        Независимый клиент Telegram · Текстовые сообщения через GREEN-API
      </footer>
    </main>
  )
}
