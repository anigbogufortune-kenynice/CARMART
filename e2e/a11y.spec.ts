import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createLiveListing } from './helpers'

/** WCAG 2 A/AA on the public pages, desktop and phone width: no serious or critical violations. */
let listingId = ''
let shopSlug = ''

test.beforeAll(async () => {
  const live = await createLiveListing({ city: `A11y${Date.now()}` })
  listingId = live.listingId
  shopSlug = live.shopSlug
})

const pages = () => ['/', '/cars', `/cars/${listingId}`, `/shops/${shopSlug}`, '/sign-up', '/sell', '/terms']

for (const width of [1280, 360]) {
  test(`no serious or critical accessibility issues at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 900 })
    const problems: string[] = []
    for (const path of pages()) {
      await page.goto(path)
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      for (const v of violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
        problems.push(`${path} [${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
      }
    }
    expect(problems, problems.join('\n')).toEqual([])
  })
}
