import { expect, test, type APIRequestContext } from '@playwright/test'

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

/** Poll Mailpit (local Supabase's email catcher) for the newest message to `email`. */
async function latestEmailText(request: APIRequestContext, email: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const search = await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
    const { messages } = (await search.json()) as { messages: { ID: string }[] }
    if (messages?.length) {
      const message = await request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`)
      const { Text, HTML } = (await message.json()) as { Text: string; HTML: string }
      return `${Text}\n${HTML}`
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`No email for ${email} in Mailpit`)
}

test('a visitor signs up, confirms by email and lands signed in', async ({ page, request, context }) => {
  const email = `e2e-${Date.now()}@test.local`
  await page.goto('/sign-up')
  await page.getByLabel('Display name').fill('E2E Seller')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('long-enough-pass')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Check your email to verify your account')).toBeVisible()

  const body = await latestEmailText(request, email)
  const link = body.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]+/)?.[0]?.replace(/&amp;/g, '&')
  expect(link, 'confirmation link in email').toBeTruthy()

  await page.goto(link!)
  await page.waitForURL((url) => url.pathname === '/')
  const cookies = await context.cookies()
  expect(cookies.some((c) => /^sb-.*-auth-token/.test(c.name))).toBe(true)
})
