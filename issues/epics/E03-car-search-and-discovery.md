# E03: Car Search and Discovery

**PRD:** issues/prd-carmart.md · **Stories:** 1–4, 8 · **ACs:** AC-01, AC-35 (public view), AC-39 to AC-41, AC-54 to AC-56
**Blocked by:** E02

## Summary
Anyone can find cars. The home page shows the latest cars. `/cars` has every filter and sort, with shareable URLs. The listing page has a photo gallery, full specs, the VIN with a PPSR check link, and a shop card. Signed-in buyers can save cars to a watchlist. Pages are SEO-ready (server-rendered metadata, Open Graph, sitemap), accessible (WCAG 2.1 AA) and mobile-first. The legal and trust pages ship here.

## User value
Buyers can quickly find a car they trust, and Google can find CarMart's listings.

## Features (titles only)
- F01 Search and filter live cars (/cars) + home page latest cars
- F02 Listing detail page with gallery, VIN/PPSR link and SOLD state
- F03 Saved cars (watchlist)
- F04 SEO, accessibility and legal/trust pages (sitemap, OG, footer, Terms, Privacy, Prohibited Listings, Buyer Safety, Contact)

## Reference docs
docs/api-contracts.md (search, listing detail, saved listings) · docs/schema.md (listing indexes, saved_listings) · docs/architecture.md (page map)

## Blocking relationships
Blocked by E02. Blocks E04 (the message button lives on the listing page).
