import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createGreenApi, ApiError } from './client'
import { credentialsSchema, messageSchema, phoneSchema } from './schemas'

const credentials = {
  apiUrl: 'https://4100.api.green-api.com',
  idInstance: '4100123456',
  apiTokenInstance: 'test-token-123456',
}
const root = `${credentials.apiUrl}/waInstance${credentials.idInstance}`
const server = setupServer()
const api = createGreenApi(credentials)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('GREEN-API transport', () => {
  it('sends text with the documented method and body', async () => {
    let payload: unknown
    server.use(
      http.post(`${root}/sendMessage/:token`, async ({ request }) => {
        payload = await request.json()
        return HttpResponse.json({ idMessage: 'remote-1' })
      }),
    )
    await expect(api.sendMessage('10000', 'Привет')).resolves.toEqual({
      idMessage: 'remote-1',
    })
    expect(payload).toEqual({ chatId: '10000', message: 'Привет' })
  })

  it('accepts both null and empty long-poll responses', async () => {
    server.use(
      http.get(
        `${root}/receiveNotification/:token`,
        () => new HttpResponse(''),
      ),
    )
    await expect(api.receiveNotification()).resolves.toBeNull()
    server.use(
      http.get(`${root}/receiveNotification/:token`, () =>
        HttpResponse.json(null),
      ),
    )
    await expect(api.receiveNotification()).resolves.toBeNull()
  })

  it('uses DELETE with the receipt identifier', async () => {
    server.use(
      http.delete(`${root}/deleteNotification/:token/42`, () =>
        HttpResponse.json({ result: true }),
      ),
    )
    await expect(api.deleteNotification(42)).resolves.toEqual({ result: true })
  })

  it('does not expose provider errors or credentials', async () => {
    server.use(
      http.get(
        `${root}/getStateInstance/:token`,
        () => new HttpResponse('secret test-token-123456', { status: 401 }),
      ),
    )
    await expect(api.getState()).rejects.toMatchObject({
      status: 401,
      retryable: false,
    })
    await expect(api.getState()).rejects.not.toThrow('test-token-123456')
  })

  it('treats a broken send response as ambiguous and never resends', async () => {
    let calls = 0
    server.use(
      http.post(`${root}/sendMessage/:token`, () => {
        calls++
        return new HttpResponse('broken-json')
      }),
    )
    await expect(api.sendMessage('10000', 'Привет')).rejects.toMatchObject({
      ambiguous: true,
    })
    expect(calls).toBe(1)
  })

  it('rejects malformed successful responses', async () => {
    server.use(
      http.get(`${root}/getStateInstance/:token`, () =>
        HttpResponse.json({ unexpected: true }),
      ),
    )
    await expect(api.getState()).rejects.toBeInstanceOf(ApiError)
  })

  it('aborts requests when the session ends', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(api.getState(controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})

describe('input validation', () => {
  it('normalizes supported international phone formats', () => {
    expect(phoneSchema.parse('+7 (999) 123-45-67')).toBe('79991234567')
    expect(phoneSchema.parse('+375 29 123-45-67')).toBe('375291234567')
    expect(phoneSchema.safeParse('abc79991234567').success).toBe(false)
    expect(phoneSchema.parse('+998 90 123-45-67')).toBe('998901234567')
  })

  it('rejects untrusted API hosts and URL credentials', () => {
    for (const apiUrl of [
      'https://green-api.com.evil.test',
      'http://4100.api.green-api.com',
      'https://token@4100.api.green-api.com',
      'https://4100.api.green-api.com/path',
      'https://4100.api.green-api.com?token=value',
    ]) {
      expect(
        credentialsSchema.safeParse({ ...credentials, apiUrl }).success,
      ).toBe(false)
    }
  })

  it('rejects empty and oversized messages', () => {
    expect(messageSchema.safeParse('   ').success).toBe(false)
    expect(messageSchema.safeParse('x'.repeat(4097)).success).toBe(false)
    expect(messageSchema.parse(' Привет ')).toBe('Привет')
  })
})
