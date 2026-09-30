import { expect, test } from '@playwright/test'
import { connect, mockApi } from './mock-api'

test('shows the connected Telegram username in the sidebar', async ({
  page,
  context,
}) => {
  await mockApi(context, { accountUsername: '@myaccount' })
  await connect(page)
  await expect(
    page.locator('aside[aria-label="Список чатов"] footer'),
  ).toContainText('@myaccount')
  await expect(
    page.locator('aside[aria-label="Список чатов"] footer'),
  ).not.toContainText('Инстанс')
})

test('shows the account phone when no username exists', async ({
  page,
  context,
}) => {
  await mockApi(context, { accountUsername: '', accountPhone: '998901234567' })
  await connect(page)
  await expect(
    page.locator('aside[aria-label="Список чатов"] footer'),
  ).toContainText('+998901234567')
})

test('animates the successful switch to the messenger', async ({
  page,
  context,
}) => {
  await mockApi(context)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await connect(page)
  await expect(page.locator('main.screen-enter')).toBeVisible()
  const duration = await page
    .locator('main.screen-enter')
    .evaluate((element) => getComputedStyle(element).animationDuration)
  expect(duration).toBe('0.42s')
})
