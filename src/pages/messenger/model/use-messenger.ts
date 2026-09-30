import { useEffect, useMemo, useState } from 'react'
import { useConversations } from '@/entities/conversation'
import { useSession } from '@/entities/session'
import {
  ApiError,
  createGreenApi,
  errorMessage,
  messageSchema,
} from '@/shared/api/green-api'
import { withInstanceLock } from '@/shared/lib/instance-lock'
import { processNotification } from './notifications'
import { runNotificationLoop, type ConnectionStatus } from './notification-loop'

export function useMessenger() {
  const session = useSession((state) => state.session)
  const api = useMemo(
    () => (session ? createGreenApi(session.credentials) : null),
    [session],
  )
  const [connection, setConnection] = useState<{
    status: ConnectionStatus
    error?: string
  }>({ status: 'connecting' })
  const [accountIdentity, setAccountIdentity] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!api || !session) return
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      session.controller.signal,
    ])
    void api
      .getAccountProfile(signal)
      .then((profile) => {
        if (signal.aborted) return
        const username = profile.username?.trim()
        const phone = profile.phone?.trim().replace(/^\+/, '')
        setAccountIdentity(username || (phone ? `+${phone}` : null))
      })
      .catch(() => {
        if (!signal.aborted) setAccountIdentity(null)
      })
    return () => controller.abort()
  }, [api, session])

  useEffect(() => {
    if (!session || !api) return
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      session.controller.signal,
    ])
    const onStatus = (status: ConnectionStatus, error?: string) => {
      if (!signal.aborted)
        setConnection((previous) =>
          previous.status === status && previous.error === error
            ? previous
            : { status, error },
        )
    }
    const run = async () => {
      const poll = async () => {
        onStatus('connecting')
        const state = await api.getState(signal)
        if (state.stateInstance !== 'authorized') {
          throw new ApiError(
            'Инстанс не авторизован в Telegram. Подключите его в GREEN-API.',
            401,
          )
        }
        onStatus('connected')
        await runNotificationLoop({
          api,
          signal,
          onNotification: processNotification,
          onStatus,
        })
      }
      try {
        const acquired = await withInstanceLock(
          `telegram:${session.credentials.apiUrl}:${session.credentials.idInstance}`,
          signal,
          poll,
        )
        if (!acquired) {
          onStatus(
            'waiting',
            'Этот инстанс уже открыт в другой вкладке. Закройте её и повторите подключение.',
          )
        }
      } catch (error) {
        if (!signal.aborted) onStatus('blocked', errorMessage(error))
      }
    }
    void run()
    return () => controller.abort()
  }, [session, api, attempt])

  async function send(chatId: string, text: string) {
    if (!api || !session || session.controller.signal.aborted) return
    const parsed = messageSchema.safeParse(text)
    if (!parsed.success) return
    const store = useConversations.getState()
    const localId = crypto.randomUUID()
    store.addMessage({
      id: localId,
      chatId,
      text: parsed.data,
      timestamp: Date.now(),
      direction: 'outgoing',
      status: 'pending',
    })
    store.setDraft(chatId, '')
    try {
      const result = await api.sendMessage(
        chatId,
        parsed.data,
        session.controller.signal,
      )
      if (!session.controller.signal.aborted) {
        useConversations
          .getState()
          .acceptMessage(chatId, localId, result.idMessage)
      }
    } catch (error) {
      if (session.controller.signal.aborted) return
      const uncertain = error instanceof ApiError && error.ambiguous
      useConversations
        .getState()
        .failMessage(
          chatId,
          localId,
          uncertain ? 'uncertain' : 'failed',
          uncertain
            ? 'Сервер мог принять сообщение. Проверьте Telegram перед повторной отправкой.'
            : errorMessage(error),
        )
    }
  }

  function disconnect() {
    useSession.getState().disconnect()
    useConversations.getState().reset()
  }

  return {
    api,
    session,
    connection,
    accountIdentity,
    reconnect: () => setAttempt((value) => value + 1),
    send,
    disconnect,
  }
}
