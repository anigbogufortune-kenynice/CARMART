# E01-F01: Sign up, sign in and account basics

**Epic:** E01-verified-seller-shops
**Blocked by:** nothing
**PRD coverage:** AC-01, AC-02, AC-03, AC-05, AC-52 (users)

## User story
As a visitor, I want to create an account with email or Google and sign in, so that I can use CarMart's member features.

## Layers touched
DB: `profiles` + `handle_new_user` trigger, helper functions (`is_admin`, `is_active_user`), `app_settings`, `admin_actions` (append-only), `notifications` outbox + `enqueue_notification`, RLS · Lib: Supabase server/browser/middleware clients, `env.ts`, `logger.ts`, domain Zod types · Service: profile.service · Routes: `/auth/callback`, `GET/PATCH /api/profile/me` · UI: `/sign-up`, `/sign-in`, `/verify-email`, `/auth/reset`, `/suspended`, site header with account menu

## Visible result (vertical slice test)
A visitor signs up, verifies their email, signs in, sees their name in the header and edits their display name. A suspended user is redirected to /suspended.

## Rough issue list
1. Foundation migration: profiles, helper functions, app_settings, admin_actions, notifications + RLS tests (tracer)
2. Supabase clients, middleware, env + logger, and the sign-up/sign-in/verify/reset pages
3. Profile API (me, display name) + header account menu + suspended screen
4. Job runner skeleton: service-role client, /api/internal auth, dispatch-notifications with the log provider, lint rule restricting the service role

## Reference docs
See the parent epic's reference docs; system specs apply where the feature touches shop onboarding, the listing lifecycle or image verification.
