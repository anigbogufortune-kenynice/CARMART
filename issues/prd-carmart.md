# PRD: CarMart v1 — Car-Only Marketplace (Australia)

> Source: Grill Me session 2026-09-28 (`issues/grill-notes.md`, Q1–Q20) and `issues/clientbrief.md`.
> Status: draft — awaiting review of Module Map, Out of Scope and Acceptance Criteria.

## Problem

People who want to sell cars in Australia need somewhere to run their own online shop and reach buyers. General classifieds sites mix cars with everything else, and they're full of scams: stolen or fake photos, AI-generated "cars" that don't exist, and listings that turn out not to be cars. Buyers can't easily tell which sellers are real. CarMart has to be a marketplace where **only cars** are listed, **only car photos** can be uploaded, and **every photo is checked for AI generation** before the public sees it. Sellers have to be verified before their shop goes live.

## Solution

A web marketplace, with Australia as the only launch market. Any user can open **one shop**. A shop goes public only after the owner verifies an Australian mobile number and an admin approves the shop. Shops publish **structured car listings**: make and model come from a car-only list, and a VIN is required and shown publicly so buyers can do a PPSR check.

Every uploaded photo passes through an automated **image verification pipeline** with two checks:
- a vision-model **car check**
- an **AI-generation check** by a detection vendor

Each photo is sorted into **pass**, **reject** (the reason is shown to the seller) or **uncertain** (sent to the admin review queue). A listing goes live only when all its photos pass. Buyers browse and search without an account, and sign in to message shops, save cars and report problems. Payment and handover happen offline: **CarMart never handles money in v1**. Admins get queues for shop approval, image review, duplicate VINs and reports. Every admin action goes into an audit log.

Honesty constraint (Q3): no detector is 100% accurate. CarMart's commitment is that **every image is automatically checked, and suspicious images are blocked or reviewed by a person before publication**. It is not a guarantee that no AI image can ever get through.

## User Stories

### Visitors and buyers
1. As a visitor, I can browse and search live car listings without an account, so I can look around freely.
2. As a visitor, I can filter by make, model, price range, year range, max km, body type, transmission, fuel, state and suburb/postcode, and sort by newest, price, km or year.
3. As a visitor, I can open a listing and see its photos, full details, VIN (with a PPSR check link), location and shop.
4. As a visitor, I can open a shop page and see the shop's details, its verified badge and its active listings.
5. As a buyer, I can sign up with email and password (with email verification) or with Google.
6. As a signed-in buyer, I can message a shop about a specific listing and get replies in a thread.
7. As a signed-in buyer, I can see a shop's phone number if the shop has chosen to show it.
8. As a signed-in buyer, I can save cars to a watchlist and remove them.
9. As a signed-in user, I can report a listing, shop or conversation with a reason.
10. As a signed-in user, I can block a conversation so I stop receiving messages in it.

### Sellers (shop owners)
11. As a user, I can create one shop (name, slug, description, suburb/state) and start drafting listings straight away.
12. As a shop owner, I verify my Australian mobile number with an SMS code before submitting my shop for approval.
13. As a shop owner, I get an email when my shop is approved or rejected (with the reason).
14. As a shop owner, I can create a listing with structured fields and 4–20 photos.
15. As a shop owner, I see each photo's check status (checking, passed, rejected with reason, under review) and can replace rejected photos.
16. As a shop owner, my listing goes live automatically when all photos pass, and I get an email telling me so.
17. As a shop owner, I can edit a live listing. Text and price changes appear immediately, and new photos appear once they pass.
18. As a shop owner, I can mark a listing sold, and renew a listing that has expired.
19. As a shop owner, I get an email 7 days before a listing expires, and whenever a buyer messages me.
20. As a shop owner, I can reply to buyer messages from my dashboard.

### Admins
21. As an admin, I can approve or reject pending shops, with a reason.
22. As an admin, I can review uncertain photos. I see the photo, the car-check result and the AI score, then approve or reject with a reason.
23. As an admin, I can review duplicate-VIN cases, with both listings shown side by side.
24. As an admin, I can work through the reports queue: dismiss a report, remove the listing, or suspend the shop or user.
25. As an admin, I can remove any listing with a recorded reason, and suspend or unsuspend shops and users.
26. As an admin, I can raise a specific shop's active-listing cap.
27. As an admin, I can review listings that use an "Other" make or model.
28. As an admin, I can change the image-check thresholds without a redeploy.
29. As an admin, I can view the audit log of every admin action.

## Acceptance Criteria

### Access and accounts
- [ ] AC-01: Anonymous users can load `/`, `/cars`, `/cars/[id]` (live or sold listings only) and `/shops/[slug]` (approved shops only). Anything else redirects them to sign-in.
- [ ] AC-02: Sign-up with email and password sends a verification email. An unverified user cannot message, save, report or create a shop.
- [ ] AC-03: Google sign-in creates an account and marks the email as verified.
- [ ] AC-04: A user who already owns a shop gets `409 SHOP_ALREADY_EXISTS` when trying to create another.
- [ ] AC-05: The `admin` role cannot be set through any API or client. Only a database migration or seed can grant it.

### Shops
- [ ] AC-06: A new shop starts in `draft`. It can be submitted for approval only after the owner's phone is verified (`+61` number, SMS OTP). Otherwise the submission returns `422 PHONE_NOT_VERIFIED`.
- [ ] AC-07: A shop that isn't `approved` returns 404 publicly, and none of its listings appear in search.
- [ ] AC-08: When an admin approves or rejects a shop, the status changes, an audit log entry is written, and the owner is emailed (rejections include the reason).
- [ ] AC-09: An approved, phone-verified shop shows the "Verified shop" badge.
- [ ] AC-10: No part of the app accepts an image upload other than listing photos. There are no logos, avatars, cover images or chat attachments.

### Listings: data and "cars only"
- [ ] AC-11: A listing can't be submitted without every required field: make, model, year, odometer km, price AUD, body type, transmission, fuel, colour, state, suburb, postcode and VIN.
- [ ] AC-12: Body type accepts only sedan, hatchback, SUV, wagon, coupe, convertible, ute or people mover. Anything else returns `422 VALIDATION_ERROR`.
- [ ] AC-13: The VIN must be exactly 17 characters, with no I, O or Q. Otherwise it returns `422 INVALID_VIN`.
- [ ] AC-14: Make and model must come from the reference list, or be "Other" with free text. An "Other" listing goes to `in_review` even when all its photos pass.
- [ ] AC-15: Year must be between 1900 and current year + 1. Price must be between A$1 and A$10,000,000. Odometer must be between 0 and 2,000,000 km. Postcode must be 4 digits and consistent with the state.
- [ ] AC-16: A listing must have between 4 and 20 photos to be submitted. Otherwise it returns `422 PHOTO_COUNT`.
- [ ] AC-17: A shop with 10 active listings (checking, in review or live) gets `422 LISTING_LIMIT_REACHED` on submit, unless an admin has raised its cap. Sold and expired listings don't count toward the cap.

### Image verification
- [ ] AC-18: Photos upload to a private quarantine bucket. No anonymous or public URL can read a quarantined photo.
- [ ] AC-19: Only JPEG, PNG, WebP or HEIC files of at most 10 MB and at least 800×600 are accepted. Anything else is rejected before any vendor is called.
- [ ] AC-20: A shop that exceeds 60 photo uploads in 24 hours gets `429 UPLOAD_LIMIT`.
- [ ] AC-21: Each photo runs the car check and the AI check. The result is stored with the provider name, raw score, decision and reason.
- [ ] AC-22: With the starting thresholds, an AI score of 0.90 or more is `rejected`, 0.50–0.89 is `in_review`, and below 0.50 is `passed` (provided the car check passes).
- [ ] AC-23: A car-check result of "not a car" with high confidence is `rejected` with the reason "This photo doesn't show a car." A low-confidence result is `in_review`. A photo of a screen or printout is `in_review`.
- [ ] AC-24: A photo whose perceptual hash matches a photo used by a *different* shop is `in_review` with the reason "possible reused photo".
- [ ] AC-25: A photo that passes has all its metadata stripped (no EXIF or GPS in the public files), is converted to WebP in 3 sizes, and is copied to the public bucket.
- [ ] AC-26: A vendor error is retried up to 3 times. After that the photo becomes `in_review`, and the listing never goes live on an error.
- [ ] AC-27: Processing the same image-check job twice produces the same result and no duplicate records (idempotent).
- [ ] AC-28: Admins can change thresholds in `app_settings`, and new checks use the new values without a redeploy.
- [ ] AC-29: Automated tests never call a paid vendor. The provider is set by env var, and the test provider is a fake.

### Listing lifecycle
- [ ] AC-30: On submit, a listing moves `draft → checking`. It becomes `live` only when every photo is `passed`, and `in_review` if any photo is uncertain. It becomes `rejected` if any photo is a clear fail, and the seller sees the reason for each photo.
- [ ] AC-31: Only one listing per VIN can be active across CarMart. A second submission with an active VIN goes to `in_review` and appears in the duplicate-VIN queue.
- [ ] AC-32: Editing the title, description, price, colour or rego of a live listing keeps it live, and the changes show immediately.
- [ ] AC-33: Adding photos to a live listing keeps the old photos public until the new ones pass. New photos never show before they pass.
- [ ] AC-34: Changing the VIN, make, model or year of a live listing moves it back to `checking`, and it leaves search until it passes again.
- [ ] AC-35: A listing marked `sold` shows a SOLD banner and stays reachable by URL for 7 days, but drops out of search immediately. After 7 days it returns 404 publicly.
- [ ] AC-36: A live listing expires 60 days after going live. An email goes out 7 days before. Renewing an expired listing moves it to `checking`.
- [ ] AC-37: An admin can move a listing in any state to `removed` with a required reason. `removed` is terminal, and the seller is notified.
- [ ] AC-38: A listing with 3 or more open reports from different users automatically moves to `in_review` and is hidden from search.

### Search
- [ ] AC-39: `/cars` returns only `live` listings from `approved` shops, 24 per page, newest first by default.
- [ ] AC-40: Each filter and sort (Q12) narrows or orders the results correctly, and filters combine with AND.
- [ ] AC-41: A keyword search matches make, model and description.

### Messaging
- [ ] AC-42: A signed-in buyer can start one conversation per listing. A second attempt reopens the existing thread.
- [ ] AC-43: Only the buyer and the shop owner can read a conversation. Admins can read it only when it has been reported.
- [ ] AC-44: Messages are text only, 1–2000 characters. File attachments are rejected.
- [ ] AC-45: A buyer who starts more than 20 new conversations in 24 hours gets `429 CONVERSATION_LIMIT`.
- [ ] AC-46: A new message emails the recipient, at most once every 15 minutes per thread.
- [ ] AC-47: A blocked conversation rejects new messages from the blocked side with `403 CONVERSATION_BLOCKED`.
- [ ] AC-48: The shop phone number is returned only to signed-in users, and only if the shop has `show_phone = true`.

### Admin and audit
- [ ] AC-49: Every `/admin` route and admin API returns 403 to non-admins.
- [ ] AC-50: Each queue (shops, images, duplicate VINs, reports, "Other" make/model) lists pending items oldest first, and each action removes the item from the queue.
- [ ] AC-51: Every admin action writes an `admin_actions` row with the actor, action, target and reason. The table is append-only: no update or delete is possible, even for admins.
- [ ] AC-52: A suspended user cannot sign in to any protected route. A suspended shop's listings disappear from search immediately.

### Quality
- [ ] AC-53: Every table has RLS enabled, with tests for owner, other user, anonymous and admin access.
- [ ] AC-54: Listing and shop pages render on the server with a title, description, Open Graph image (the first photo) and canonical URL. `sitemap.xml` lists live listings and approved shops.
- [ ] AC-55: Core pages pass an automated WCAG 2.1 AA check (axe) with no serious violations, and work at 360px width.
- [ ] AC-56: Legal pages exist and are linked in the footer: Terms, Privacy, Prohibited Listings, Buyer Safety and Contact.

## Data Model

All tables use `uuid` primary keys (`gen_random_uuid()`), plus `created_at` and `updated_at` timestamps. RLS is enabled on every table.

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | One row per auth user | `id` (= auth.users.id), `display_name`, `role` (`user`\|`admin`), `status` (`active`\|`suspended`), `phone_verified_at` |
| `shops` | One shop per owner | `owner_id` (unique → profiles), `name`, `slug` (unique), `description`, `suburb`, `state`, `postcode`, `country` (default `AU`), `currency` (default `AUD`), `status` (`draft`\|`pending_approval`\|`approved`\|`rejected`\|`suspended`), `rejection_reason`, `plan` (default `free`), `listing_cap` (default 10), `show_phone` (default false) |
| `vehicle_makes` | Car-only reference list | `name` (unique), `active` |
| `vehicle_models` | Models per make | `make_id` → vehicle_makes, `name`; unique (`make_id`, `name`) |
| `listings` | A car for sale | `shop_id`, `make_id`/`model_id` (nullable when "Other"), `make_other`/`model_other`, `year`, `odometer_km`, `price_cents`, `currency`, `body_type` (enum), `transmission` (enum), `fuel` (enum), `colour`, `vin` (char 17), `rego`, `rego_expiry`, `description`, `state`, `suburb`, `postcode`, `status` (`draft`\|`checking`\|`in_review`\|`rejected`\|`live`\|`sold`\|`expired`\|`removed`), `status_reason`, `live_at`, `expires_at`, `sold_at`, `version`, `search_vector` (tsvector) |
| `listing_images` | A photo on a listing | `listing_id`, `position`, `quarantine_path`, `public_paths` (jsonb: sm/md/lg), `status` (`uploaded`\|`checking`\|`passed`\|`rejected`\|`in_review`), `status_reason`, `phash`, `width`, `height`, `mime_type`, `bytes` |
| `image_checks` | Job queue and results per image | `image_id`, `state` (`queued`\|`running`\|`done`\|`failed`), `attempts`, `car_check` (jsonb: provider, is_car, confidence, view, is_screen, plate_visible, face_visible), `ai_check` (jsonb: provider, score), `metadata_signals` (jsonb), `decision`, `decided_by` (`auto`\|admin id), `decided_at` |
| `upload_events` | Per-shop upload rate limiting | `shop_id`, `created_at` |
| `conversations` | One thread per buyer + listing | `listing_id`, `buyer_id`, `shop_id`, `blocked_by` (nullable), `last_message_at`; unique (`listing_id`, `buyer_id`) |
| `messages` | Text messages | `conversation_id`, `sender_id`, `body` (1–2000 chars), `read_at` |
| `saved_listings` | Buyer watchlist | `user_id`, `listing_id`; unique pair |
| `reports` | User reports | `reporter_id`, `target_type` (`listing`\|`shop`\|`conversation`), `target_id`, `reason` (enum), `note`, `status` (`open`\|`dismissed`\|`actioned`), `resolved_by`, `resolved_at` |
| `admin_actions` | Append-only audit log | `actor_id`, `action`, `target_type`, `target_id`, `reason`, `details` (jsonb) |
| `app_settings` | Admin-configurable settings | `key` (pk), `value` (jsonb), e.g. `ai_reject_threshold` = 0.90, `ai_review_threshold` = 0.50, `car_confidence_threshold`, `listing_expiry_days` = 60, `sold_visible_days` = 7 |
| `notification_log` | Email de-duplication and throttling | `user_id`, `kind`, `ref_id`, `sent_at` |

Key constraints:
- A partial unique index on `listings(vin) WHERE status IN ('checking','in_review','live')` enforces one active listing per VIN. A duplicate is caught before insert and routed to `in_review`.
- Storage buckets: `listing-quarantine` (private) and `listing-public` (public read). Only the pipeline's service role writes to `listing-public`.

## Module Map

All modules are new (the repo is a fresh scaffold).

**Services (business logic, deep modules)**
- `src/services/profile.service.ts`: profile read and update, role and status checks, phone verification state
- `src/services/shop.service.ts`: create, update, submit for approval, public lookup by slug, verified-badge logic
- `src/services/listing.service.ts`: create, update, submit, edit rules (Q8), mark sold, renew, state transitions, VIN rules, listing cap
- `src/services/search.service.ts`: filtered, sorted, paginated search over live listings
- `src/services/image-verification/image-verification.service.ts`: decision logic (thresholds → pass, reject or review) and provider orchestration
- `src/services/image-verification/providers/claude-car-check.provider.ts`: car check via the Claude vision API (structured output)
- `src/services/image-verification/providers/sightengine-ai-check.provider.ts`: AI-generation score
- `src/services/image-verification/providers/hive-ai-check.provider.ts`: backup AI provider
- `src/services/image-verification/providers/fake.provider.ts`: deterministic fake for tests and development
- `src/services/image-upload.service.ts`: signed upload URLs, file validation, upload rate limiting
- `src/services/messaging.service.ts`: conversations, messages, blocking, phone reveal, conversation limit
- `src/services/moderation.service.ts`: admin queues, approve/reject/remove/suspend, reports, audit log
- `src/services/notification.service.ts`: transactional email via Resend, with throttling and de-duplication
- `src/services/settings.service.ts`: typed access to `app_settings`

**Background worker**
- `supabase/functions/process-image-checks/index.ts`: Edge Function that claims queued `image_checks`, runs the pipeline (validation → pHash → car check → AI check → strip metadata → WebP variants → publish), and updates the image and listing status

**Database**
- `supabase/migrations/*`: tables, enums, RLS policies, indexes, storage buckets and policies, `app_settings` defaults
- `supabase/seed.sql`: Australian car makes and models, a dev admin user, and sample shops and listings

**App routes (UI)**
- `src/app/page.tsx`: home (search bar, latest cars)
- `src/app/cars/page.tsx`, `src/app/cars/[id]/page.tsx`: search results and listing detail
- `src/app/shops/[slug]/page.tsx`: public shop page
- `src/app/(auth)/sign-in`, `sign-up`, `verify-email`: auth screens
- `src/app/account/saved`, `src/app/account/messages`: buyer area
- `src/app/sell/*`: seller dashboard (shop setup, phone verification, listings, photo status, messages)
- `src/app/admin/*`: admin queues, settings, audit log
- `src/app/(legal)/terms`, `privacy`, `prohibited-listings`, `buyer-safety`, `contact`: legal and trust pages
- `src/app/sitemap.ts`, `src/app/robots.ts`: SEO

**API route handlers (thin: Zod validation → auth → service)**
- `src/app/api/shops/*`, `src/app/api/listings/*`, `src/app/api/uploads/*`, `src/app/api/conversations/*`, `src/app/api/reports/*`, `src/app/api/saved-listings/*`, `src/app/api/admin/*`

**Shared**
- `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts` + `src/middleware.ts`: session handling and route protection
- `src/lib/env.ts`: Zod-validated environment variables
- `src/lib/rate-limit.ts`: DB-backed rate limits
- `src/lib/vin.ts`, `src/lib/au-postcode.ts`: VIN and postcode/state validation
- `src/types/result.ts` (exists), `src/types/domain.ts`: shared types and enums
- `src/components/*`: UI components with co-located tests

**Testing**
- `tests/fixtures/images/*`: car, non-car, screen-photo and "AI-flagged" fixtures for the fake provider
- `tests/rls/*.test.ts`: RLS policy tests against local Supabase
- `e2e/*.spec.ts` + `playwright.config.ts`: end-to-end journeys

## Implementation Decisions

1. **Listing marketplace, no money handling (Q1).** Keeps CarMart out of escrow, refunds and payment licensing. Payment and handover happen offline.
2. **Verified shops (Q2).** Anyone can draft; the shop goes public only after SMS phone verification and admin approval. One shop per account.
3. **Automated checks plus human review, with honest wording (Q3).** Three outcomes per photo, and the listing goes live only when every photo passes. No 100% detection promise.
4. **A separate provider for each check, all swappable (Q4).** Claude vision for the car check, Sightengine for AI detection, Hive as the backup. Vendor pricing and accuracy to be confirmed at sign-up.
5. **Free in v1 with guardrails (Q5).** 10 active listings per shop, 60 uploads a day per shop, and `shops.plan` ready for paid plans later.
6. **Australia only, with the market stored as data (Q6).** AUD, km, +61, and the Australian Privacy Act. Country and currency are stored on shops and listings.
7. **Structured car-only listings with a required public VIN (Q7).** Enables PPSR checks. Only car body types exist, so non-car listings are impossible by design.
8. **The listing state machine and edit rules (Q8).** One active listing per VIN, 60-day expiry, 7-day sold visibility.
9. **No non-car uploads anywhere (Q10, Q13).** No logos, avatars or chat attachments, so "only car images" holds for the whole app.
10. **An async, idempotent image pipeline (Q16).** A job table plus an Edge Function. Photos are quarantined until they pass, and metadata is stripped before publishing, which protects sellers' GPS locations.
11. **Hosting in Australia (Q19).** Vercel plus Supabase in the Sydney region.
12. **Deep modules, a Result type, and Zod at every boundary.** As set out in CLAUDE.md.

## Out of Scope (v1)

- Online payments, deposits, escrow, subscriptions, paid plans, featured or boosted listings
- More than one shop per account, and shop staff or team members
- Countries other than Australia, and multiple currencies
- Distance or radius search, saved searches, new-listing alerts
- Automatic blurring of number plates or faces (the flags are stored for later)
- Camera-only photo capture, and video uploads
- Logos, avatars, cover images, chat attachments, or any non-car image upload
- Shop reviews or ratings, buyer reviews
- Automated PPSR lookups (a link to the government PPSR site is provided instead)
- Finance, insurance, trade-in valuations, vehicle history reports
- Bulk import or dealer feeds (CSV/API)
- Native mobile apps (the web app is mobile-first)
- In-app chat with real-time presence or typing indicators (messages refresh on load or by polling)

## Testing Strategy

- **Unit (Vitest):** every public service method, including VIN and postcode validation, the threshold decision table (every band edge: 0.49 / 0.50 / 0.89 / 0.90), listing state transitions, and edit rules.
- **Integration (Vitest + local Supabase):** service ↔ database round trips, the unique-VIN partial index, rate limits, and idempotent image-job processing (run the same job twice and assert one result).
- **RLS tests:** for every table, the owner, another user, an anonymous visitor and an admin each try select, insert, update and delete, and each result is asserted. `admin_actions` updates and deletes fail for everyone.
- **Image pipeline:** the fake provider plus fixture images cover every branch (pass, not a car, screen photo, AI score in each band, vendor error → retry → review, reused-photo pHash). No real vendor calls in CI. A separate, manually run smoke script calls the real vendors with a few photos before launch.
- **End-to-end (Playwright):**
  1. A seller signs up, creates a shop, verifies their phone (test OTP) and gets admin approval.
  2. The seller creates a listing with 4 photos, which pass and go live.
  3. A buyer searches, opens the listing and sends a message; the seller replies.
  4. An admin reviews an uncertain photo and removes a reported listing.
- **Accessibility:** axe checks in the Playwright runs on the home, search, listing, shop, sign-up and sell pages.
- **Manual QA before launch:** mobile (360px) and desktop pass on every page, checks on real Australian car photos and on known AI images, email deliverability, and lawyer review of the legal pages.
