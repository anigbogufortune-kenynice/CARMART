# E03-F04: SEO, accessibility and legal/trust pages

**Epic:** E03-car-search-and-discovery
**Blocked by:** E03-F02
**PRD coverage:** AC-54, AC-55, AC-56

## User story
As CarMart, I want every public page to be indexable, accessible and backed by clear policies, so that buyers find us and trust us.

## Layers touched
UI/infra: `generateMetadata` for listing and shop pages (title, description, OG image, canonical), `sitemap.ts`, `robots.ts`, site footer, the static pages Terms/Privacy/Prohibited Listings/Buyer Safety/Contact (placeholder support email), axe checks in Playwright, and a 360px layout pass

## Visible result (vertical slice test)
`/sitemap.xml` lists live listings and approved shops; sharing a listing URL shows its first photo; every legal page is linked from the footer; axe finds no serious violations on core pages.

## Rough issue list
1. Metadata + sitemap + robots
2. Footer + legal/trust pages
3. Playwright + axe accessibility checks and mobile fixes on core pages

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
