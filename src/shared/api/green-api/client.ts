import { z } from 'zod'
import {
  credentialsSchema,
  accountLookupSchema,
  recipientSchema,
  notificationSchema,
  type Credentials,
} from './schemas'

export class ApiError extends Error {
  readonly status: number
  readonly retryable: boolean
  readonly ambiguous: boolean

  constructor(message: string, status = 0, ambiguous = false) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryable =
      status === 0 || status === 408 || status === 429 || status >= 500
    this.ambiguous = ambiguous
  }
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Не удалось выполнить запрос. Попробуйте ещё раз.'
}

function statusMessage(status: number) {
  if (status === 401 || status === 403)
    return 'Доступ отклонён. Проверьте ID, токен и состояние инстанса в GREEN-API.'
  if (status === 469)
    return 'Telegram временно ограничил поиск контактов. Повторите попытку позже.'
  if (status === 429) return 'Слишком много запросов. Подождите немного.'
  if (status === 466)
    return 'Достигнут лимит тарифа. Проверьте доступные чаты в GREEN-API.'
  if (status === 400)
    return 'GREEN-API отклонил запрос. Проверьте данные и настройки инстанса.'
  if (status === 404)
    return 'Инстанс не найден. Проверьте ID и адрес сервера API.'
  return 'GREEN-API временно недоступен. Соединение будет восстановлено.'
}

export function createGreenApi(input: Credentials) {
  const credentials = credentialsSchema.parse(input)

  async function request<T>(
    method: string,
    schema: z.ZodType<T>,
    options: {
      verb?: 'GET' | 'POST' | 'DELETE'
      data?: unknown
      suffix?: string
      signal?: AbortSignal
      timeout?: number
    } = {},
  ): Promise<T> {
    const timeoutSignal = AbortSignal.timeout(options.timeout ?? 20000)
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeoutSignal])
      : timeoutSignal
    const url = `${credentials.apiUrl}/waInstance${credentials.idInstance}/${method}/${credentials.apiTokenInstance}${options.suffix ?? ''}`
    try {
      const response = await fetch(url, {
        method: options.verb ?? 'GET',
        signal,
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        ...(options.data === undefined
          ? {}
          : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(options.data),
            }),
      })
      if (!response.ok) {
        throw new ApiError(
          statusMessage(response.status),
          response.status,
          method === 'sendMessage' && response.status >= 500,
        )
      }
      const text = await response.text()
      let payload: unknown
      try {
        payload = text.trim() ? JSON.parse(text) : null
      } catch {
        throw new ApiError(
          'Сервер вернул некорректный ответ.',
          502,
          method === 'sendMessage',
        )
      }
      const parsed = schema.safeParse(payload)
      if (!parsed.success)
        throw new ApiError(
          'Ответ GREEN-API не соответствует ожидаемому формату.',
          502,
          method === 'sendMessage',
        )
      return parsed.data
    } catch (error) {
      if (options.signal?.aborted)
        throw new DOMException('Aborted', 'AbortError')
      if (error instanceof ApiError) throw error
      throw new ApiError(
        timeoutSignal.aborted
          ? 'Сервер не ответил вовремя. Проверьте соединение.'
          : 'Нет соединения с GREEN-API. Проверьте сеть и адрес сервера.',
        0,
        method === 'sendMessage',
      )
    }
  }

  return {
    getState: (signal?: AbortSignal) =>
      request('getStateInstance', z.object({ stateInstance: z.string() }), {
        signal,
      }),
    getAccountProfile: (signal?: AbortSignal) =>
      request(
        'getAccountSettings',
        z.object({
          username: z.string().optional(),
          phone: z.string().optional(),
        }),
        { signal },
      ),
    getSettings: (signal?: AbortSignal) =>
      request(
        'getSettings',
        z.object({
          typeInstance: z.string(),
          webhookUrl: z.string(),
          incomingWebhook: z.string(),
          outgoingWebhook: z.string().optional(),
          outgoingAPIMessageWebhook: z.string().optional(),
          outgoingMessageWebhook: z.string().optional(),
        }),
        { signal },
      ),
    checkAccount: async (recipient: string, signal?: AbortSignal) => {
      const normalized = recipientSchema.parse(recipient)
      const result = await request('checkAccount', accountLookupSchema, {
        verb: 'POST',
        data: normalized.startsWith('@')
          ? { username: normalized }
          : { phoneNumber: Number(normalized) },
        signal,
      })
      if ('status' in result) {
        if (result.data?.reason === 'rate_limit_exceeded') {
          throw new ApiError(
            'Telegram временно ограничил поиск контактов. Повторите попытку позже.',
            429,
          )
        }
        if (result.reason?.includes('not authorized')) {
          throw new ApiError(
            'Инстанс не авторизован в Telegram. Подключите его в GREEN-API.',
            401,
          )
        }
        throw new ApiError(
          'Не удалось найти собеседника. Проверьте телефон или @username.',
          400,
        )
      }
      return result
    },
    sendMessage: (chatId: string, message: string, signal?: AbortSignal) =>
      request(
        'sendMessage',
        z.object({
          idMessage: z.string().min(1),
        }),
        { verb: 'POST', data: { chatId, message }, signal },
      ),
    receiveNotification: (signal?: AbortSignal) =>
      request('receiveNotification', notificationSchema, {
        suffix: '?receiveTimeout=25',
        signal,
        timeout: 35000,
      }),
    deleteNotification: (receiptId: number, signal?: AbortSignal) =>
      request(
        'deleteNotification',
        z.object({
          result: z.boolean(),
        }),
        { verb: 'DELETE', suffix: `/${receiptId}`, signal },
      ),
  }
}

export type GreenApi = ReturnType<typeof createGreenApi>
