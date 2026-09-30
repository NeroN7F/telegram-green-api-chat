import { expect, type BrowserContext, type Page } from '@playwright/test'

type QueuedNotification = { receiptId: number; body: unknown }

export async function mockApi(
  context: BrowserContext,
  options: {
    unauthorized?: boolean
    instanceType?: string
    lookupLimited?: boolean
    incomingDisabled?: boolean
    accountUsername?: string
    accountPhone?: string
    accountExists?: boolean
    failSend?: boolean
    failAcknowledgement?: boolean
  } = {},
) {
  const queue: QueuedNotification[] = []
  const sent: { chatId: string; message: string }[] = []
  const acknowledged: number[] = []
  let receipt = 0
  let ackFailed = false
  let maxReceivers = 0
  let receivers = 0
  const enqueue = (body: unknown) => {
    const item = { receiptId: ++receipt, body }
    queue.push(item)
    return item.receiptId
  }

  await context.route('https://4100.api.green-api.com/**', async (route) => {
    const request = route.request()
    const method = new URL(request.url()).pathname.split('/')[2]
    const reply = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    if (method === 'getStateInstance')
      return options.unauthorized
        ? reply({}, 401)
        : reply({ stateInstance: 'authorized' })
    if (method === 'getAccountSettings')
      return reply({
        username: options.accountUsername ?? '@myaccount',
        phone: options.accountPhone ?? '998901234567',
      })
    if (method === 'getSettings')
      return reply({
        typeInstance: options.instanceType ?? 'telegram',
        webhookUrl: '',
        incomingWebhook: options.incomingDisabled ? 'no' : 'yes',
        outgoingWebhook: 'yes',
        outgoingAPIMessageWebhook: 'yes',
        outgoingMessageWebhook: 'yes',
      })
    if (method === 'checkAccount') {
      if (options.lookupLimited)
        return reply({
          status: false,
          data: { reason: 'rate_limit_exceeded', retryAfter: 3600 },
        })
      const data = request.postDataJSON() as {
        phoneNumber?: number
        username?: string
      }
      return reply({
        exist: options.accountExists !== false,
        chatId:
          data.phoneNumber === 79991234567 || data.username === '@alex'
            ? '10001'
            : '10002',
      })
    }
    if (method === 'sendMessage') {
      const data = request.postDataJSON() as { chatId: string; message: string }
      sent.push(data)
      if (options.failSend) return route.abort('failed')
      const idMessage = `sent-${sent.length}`
      enqueue({
        typeWebhook: 'outgoingMessageStatus',
        chatId: data.chatId,
        idMessage,
        status: 'read',
      })
      return reply({ idMessage })
    }
    if (method === 'receiveNotification') {
      receivers++
      maxReceivers = Math.max(maxReceivers, receivers)
      if (!queue.length)
        await new Promise((resolve) => setTimeout(resolve, 100))
      receivers--
      return reply(queue[0] ?? null)
    }
    if (method === 'deleteNotification') {
      if (options.failAcknowledgement && !ackFailed) {
        ackFailed = true
        return reply({}, 500)
      }
      const receiptId = Number(
        new URL(request.url()).pathname.split('/').at(-1),
      )
      const index = queue.findIndex((item) => item.receiptId === receiptId)
      if (index >= 0) queue.splice(index, 1)
      acknowledged.push(receiptId)
      return reply({ result: index >= 0 })
    }
    return reply({}, 404)
  })

  return {
    enqueue,
    sent,
    acknowledged,
    maxReceivers: () => maxReceivers,
    incoming: (
      text: string,
      id = 'incoming-1',
      chatId = '10001',
      name = 'Алексей',
    ) =>
      enqueue({
        typeWebhook: 'incomingMessageReceived',
        idMessage: id,
        timestamp: Math.floor(Date.now() / 1000),
        senderData: {
          chatId,
          chatName: name,
          chatType: 'user',
          senderPhoneNumber: chatId === '10001' ? 79991234567 : 79997654321,
        },
        messageData: {
          typeMessage: 'textMessage',
          textMessageData: { textMessage: text },
        },
      }),
  }
}

export async function connect(page: Page) {
  await page.goto('/')
  await page.getByLabel('ID инстанса', { exact: true }).fill('4100123456')
  await page.getByLabel('API-токен', { exact: true }).fill('test-token-123456')
  await page
    .getByLabel('Сервер API', { exact: true })
    .fill('https://4100.api.green-api.com')
  await page.getByRole('button', { name: 'Подключиться', exact: true }).click()
}

export async function openChat(page: Page, phone = '+7 999 123-45-67') {
  await expect(
    page.getByRole('button', { name: 'Новый чат', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Новый чат', exact: true }).click()
  await page.getByLabel('Телефон или @username', { exact: true }).fill(phone)
  await page
    .getByRole('button', { name: 'Начать разговор', exact: true })
    .click()
  await expect(
    page.getByRole('textbox', { name: 'Сообщение', exact: true }),
  ).toBeVisible()
}
