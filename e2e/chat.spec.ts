import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { connect, mockApi, openChat } from './mock-api'

test('connects, creates a chat, sends text, receives a reply and disconnects', async ({
  page,
  context,
}, testInfo) => {
  const api = await mockApi(context)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await connect(page)
  await openChat(page)
  const composer = page.getByRole('textbox', { name: 'Сообщение', exact: true })
  await composer.fill('Привет! Как проходит день?')
  await page.getByRole('button', { name: 'Отправить сообщение' }).click()
  await expect(
    page.getByRole('img', { name: 'Прочитано', exact: true }),
  ).toBeVisible()
  api.incoming('Привет! Всё хорошо. Встретимся в 18:00?')
  await expect(
    page
      .getByRole('list', { name: 'Сообщения' })
      .getByText('Привет! Всё хорошо. Встретимся в 18:00?'),
  ).toBeVisible()
  await expect.poll(() => api.acknowledged.length).toBe(2)
  expect(api.sent).toEqual([
    { chatId: '10001', message: 'Привет! Как проходит день?' },
  ])
  expect(api.maxReceivers()).toBe(1)
  expect(errors).toEqual([])
  await page.screenshot({ path: `artifacts/chat-${testInfo.project.name}.png` })
  if (testInfo.project.name === 'mobile')
    await page.getByRole('button', { name: 'Назад к чатам' }).click()
  await page.getByRole('button', { name: 'Отключиться', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Подключиться', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('API-токен', { exact: true })).toHaveValue('')
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 })
})

test('rejects invalid credentials and unsafe API URLs without sending requests', async ({
  page,
  context,
}) => {
  await mockApi(context)
  await page.goto('/')
  await page.getByRole('button', { name: 'Подключиться', exact: true }).click()
  await expect(
    page.getByText('Введите ID инстанса из личного кабинета'),
  ).toBeVisible()
  await page.getByLabel('ID инстанса', { exact: true }).fill('4100123456')
  await page.getByLabel('API-токен', { exact: true }).fill('test-token-123456')
  await page
    .getByLabel('Сервер API', { exact: true })
    .fill('https://green-api.com.evil.test')
  await page.getByRole('button', { name: 'Подключиться', exact: true }).click()
  await expect(
    page.getByText(
      'Используйте HTTPS-адрес API на green-api.com из личного кабинета',
    ),
  ).toBeVisible()
})

test('explains missing notification settings', async ({ page, context }) => {
  await mockApi(context, { incomingDisabled: true })
  await connect(page)
  await expect(page.getByRole('alert')).toContainText(
    'включите входящие уведомления',
  )
  await expect(
    page.getByRole('button', { name: 'Подключиться', exact: true }),
  ).toBeEnabled()
})

test('reports authentication errors', async ({ page, context }) => {
  await mockApi(context, { unauthorized: true })
  await connect(page)
  await expect(page.getByRole('alert')).toContainText('Доступ отклонён')
})

test('keeps an unknown recipient in the dialog', async ({ page, context }) => {
  await mockApi(context, { accountExists: false })
  await connect(page)
  await page.getByRole('button', { name: 'Новый чат', exact: true }).click()
  await page
    .getByLabel('Телефон или @username', { exact: true })
    .fill('+7 999 123-45-67')
  await page
    .getByRole('button', { name: 'Начать разговор', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    'Аккаунт Telegram не найден',
  )
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('handles ambiguous sends without an automatic retry', async ({
  page,
  context,
}) => {
  const api = await mockApi(context, { failSend: true })
  await connect(page)
  await openChat(page)
  await page
    .getByRole('textbox', { name: 'Сообщение', exact: true })
    .fill('Проверка соединения')
  await page.getByRole('button', { name: 'Отправить сообщение' }).click()
  await expect(
    page.getByText(
      'Сервер мог принять сообщение. Проверьте Telegram перед повторной отправкой.',
    ),
  ).toBeVisible()
  expect(api.sent).toHaveLength(1)
  await page.getByRole('button', { name: 'Вернуть в поле ввода' }).click()
  await expect(
    page.getByRole('textbox', { name: 'Сообщение', exact: true }),
  ).toHaveValue('Проверка соединения')
  expect(api.sent).toHaveLength(1)
})

test('deduplicates incoming messages and recovers after an acknowledgement failure', async ({
  page,
  context,
}) => {
  const api = await mockApi(context, { failAcknowledgement: true })
  await connect(page)
  await openChat(page)
  api.incoming('Один ответ', 'duplicate')
  api.incoming('Один ответ', 'duplicate')
  await expect.poll(() => api.acknowledged.length).toBe(2)
  await expect(
    page
      .getByRole('list', { name: 'Сообщения' })
      .getByText('Один ответ', { exact: true }),
  ).toHaveCount(1)
})

test('supports multiline messages, rejects whitespace and limits message length', async ({
  page,
  context,
}) => {
  const api = await mockApi(context)
  await connect(page)
  await openChat(page)
  const composer = page.getByRole('textbox', { name: 'Сообщение', exact: true })
  await composer.fill('   ')
  await expect(
    page.getByRole('button', { name: 'Отправить сообщение' }),
  ).toBeDisabled()
  await composer.fill('Первая строка')
  await composer.press('Shift+Enter')
  await composer.pressSequentially('Вторая строка')
  await composer.press('Enter')
  await expect.poll(() => api.sent.length).toBe(1)
  expect(api.sent[0]?.message).toBe('Первая строка\nВторая строка')
  await expect(composer).toHaveValue('')
  await expect(composer).toHaveAttribute('maxlength', '4096')
})

test('has accessible connection, dialog, and conversation screens without horizontal overflow', async ({
  page,
  context,
}) => {
  await mockApi(context)
  await page.goto('/')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await connect(page)
  await page.getByRole('button', { name: 'Новый чат', exact: true }).click()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page
    .getByLabel('Телефон или @username', { exact: true })
    .fill('+7 999 123-45-67')
  await page
    .getByRole('button', { name: 'Начать разговор', exact: true })
    .click()
  await expect(
    page.getByRole('textbox', { name: 'Сообщение', exact: true }),
  ).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('allows only one tab to consume an instance queue', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Same-origin tab ownership is checked on desktop',
  )
  await mockApi(context)
  await connect(page)
  await expect(
    page.getByRole('button', { name: 'Новый чат', exact: true }),
  ).toBeEnabled()
  const other = await context.newPage()
  await connect(other)
  await expect(other.getByRole('alert')).toContainText(
    'уже открыт в другой вкладке',
  )
  await expect(
    other.getByRole('button', { name: 'Новый чат', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Отключиться', exact: true }).click()
  await other.getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect(
    other.getByRole('button', { name: 'Новый чат', exact: true }),
  ).toBeEnabled()
})

test('does not persist credentials or conversation data after refresh', async ({
  page,
  context,
}) => {
  await mockApi(context)
  await connect(page)
  await openChat(page)
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Подключиться', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('API-токен', { exact: true })).toHaveValue('')
})
