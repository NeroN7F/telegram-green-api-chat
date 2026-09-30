import { expect, test } from '@playwright/test'
import { connect, mockApi, openChat } from './mock-api'

test('looks up a Telegram username and reuses its canonical chat for phone lookup', async ({
  page,
  context,
}, testInfo) => {
  const api = await mockApi(context)
  await connect(page)
  const lookup = page.waitForRequest(
    (request) =>
      request.url().includes('/checkAccount/') && request.method() === 'POST',
  )
  await openChat(page, '@Alex')
  expect((await lookup).postDataJSON()).toEqual({ username: '@alex' })
  await expect(
    page.getByRole('heading', { name: '@alex', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Сообщение', exact: true })
    .fill('Привет из Telegram')
  await page.getByRole('button', { name: 'Отправить сообщение' }).click()
  api.incoming('Ответ в Telegram')
  await expect(
    page.getByRole('list', { name: 'Сообщения' }).getByText('Ответ в Telegram'),
  ).toBeVisible()
  expect(api.sent[0]?.chatId).toBe('10001')
  if (testInfo.project.name === 'mobile')
    await page.getByRole('button', { name: 'Назад к чатам' }).click()
  await openChat(page)
  expect(await page.locator('nav[aria-label="Чаты"] > button').count()).toBe(1)
})

test('creates a chat using an Uzbekistan number', async ({ page, context }) => {
  await mockApi(context)
  await connect(page)
  const lookup = page.waitForRequest(
    (request) =>
      request.url().includes('/checkAccount/') && request.method() === 'POST',
  )
  await openChat(page, '+998 90 123-45-67')
  expect((await lookup).postDataJSON()).toEqual({ phoneNumber: 998901234567 })
  await expect(
    page.getByRole('heading', { name: '+998901234567', exact: true }),
  ).toBeVisible()
})

test('rejects an instance for a different messenger', async ({
  page,
  context,
}) => {
  await mockApi(context, { instanceType: 'whatsapp' })
  await connect(page)
  await expect(page.getByRole('alert')).toContainText('нужен инстанс Telegram')
})

test('explains Telegram contact lookup restrictions', async ({
  page,
  context,
}) => {
  await mockApi(context, { lookupLimited: true })
  await connect(page)
  await page.getByRole('button', { name: 'Новый чат', exact: true }).click()
  await page.getByLabel('Телефон или @username', { exact: true }).fill('@alex')
  await page
    .getByRole('button', { name: 'Начать разговор', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    'Telegram временно ограничил поиск',
  )
  await expect(
    page.getByRole('button', { name: 'Начать разговор', exact: true }),
  ).toBeEnabled()
})

test('sends a full 4096-character message', async ({ page, context }) => {
  const api = await mockApi(context)
  await connect(page)
  await openChat(page)
  const text = 'a'.repeat(4096)
  await page.getByRole('textbox', { name: 'Сообщение', exact: true }).fill(text)
  await page.getByRole('button', { name: 'Отправить сообщение' }).click()
  await expect.poll(() => api.sent.length).toBe(1)
  expect(api.sent[0]?.message).toBe(text)
})
