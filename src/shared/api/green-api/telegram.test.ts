import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createGreenApi } from './client'
import {
  credentialsSchema,
  messageSchema,
  phoneSchema,
  recipientSchema,
} from './schemas'

const credentials = {
  apiUrl: 'https://4100.api.green-api.com',
  idInstance: '4100123456',
  apiTokenInstance: 'test-token-123456',
}
const api = createGreenApi(credentials)
const url = `${credentials.apiUrl}/waInstance${credentials.idInstance}/checkAccount/:token`
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Telegram account lookup', () => {
  it('sends exactly one username field and accepts hidden phone numbers', async () => {
    let payload: unknown
    server.use(
      http.post(url, async ({ request }) => {
        payload = await request.json()
        return HttpResponse.json({
          exist: true,
          chatId: '10001',
          username: '@alex',
        })
      }),
    )
    await expect(api.checkAccount('@Alex')).resolves.toEqual({
      exist: true,
      chatId: '10001',
      username: '@alex',
    })
    expect(payload).toEqual({ username: '@alex' })
  })

  it('sends an international phone number as an integer', async () => {
    let payload: unknown
    server.use(
      http.post(url, async ({ request }) => {
        payload = await request.json()
        return HttpResponse.json({
          exist: true,
          chatId: '10002',
          phoneNumber: 998901234567,
        })
      }),
    )
    await api.checkAccount('+998 90 123-45-67')
    expect(payload).toEqual({ phoneNumber: 998901234567 })
  })

  it('reports a lookup limit returned with HTTP 200', async () => {
    server.use(
      http.post(url, () =>
        HttpResponse.json({
          status: false,
          data: { reason: 'rate_limit_exceeded', retryAfter: 3600 },
        }),
      ),
    )
    await expect(api.checkAccount('@alex')).rejects.toMatchObject({
      status: 429,
    })
  })

  it('reports account restrictions returned with HTTP 469', async () => {
    server.use(
      http.post(url, () =>
        HttpResponse.json({ status: false }, { status: 469 }),
      ),
    )
    await expect(api.checkAccount('@alex')).rejects.toMatchObject({
      status: 469,
    })
  })

  it('reports expired authorization returned with HTTP 200', async () => {
    server.use(
      http.post(url, () =>
        HttpResponse.json({
          status: false,
          reason: 'instance is starting or not authorized',
        }),
      ),
    )
    await expect(api.checkAccount('@alex')).rejects.toMatchObject({
      status: 401,
    })
  })
})

describe('Telegram input rules', () => {
  it('accepts international numbers without a country allowlist', () => {
    expect(phoneSchema.parse('+998 90 123-45-67')).toBe('998901234567')
    expect(phoneSchema.parse('+1 (202) 555-0123')).toBe('12025550123')
    for (const input of [
      '0123456789',
      '12345',
      '1234567890123456',
      '12abc345678',
    ]) {
      expect(phoneSchema.safeParse(input).success).toBe(false)
    }
  })

  it('normalizes usernames and rejects malformed input', () => {
    expect(recipientSchema.parse(' @Alex_42 ')).toBe('@alex_42')
    for (const input of [
      '@',
      '@user name',
      '@user/name',
      '@' + 'a'.repeat(33),
    ]) {
      expect(recipientSchema.safeParse(input).success).toBe(false)
    }
  })

  it('accepts the full Telegram message length', () => {
    expect(messageSchema.safeParse('a'.repeat(4096)).success).toBe(true)
    expect(messageSchema.safeParse('a'.repeat(4097)).success).toBe(false)
  })

  it('normalizes the API origin and rejects path prefixes', () => {
    expect(
      credentialsSchema.parse({
        ...credentials,
        apiUrl: 'https://4100.api.green-api.com/',
      }).apiUrl,
    ).toBe(credentials.apiUrl)
    expect(
      credentialsSchema.safeParse({
        ...credentials,
        apiUrl: credentials.apiUrl + '/legacy',
      }).success,
    ).toBe(false)
  })
})
