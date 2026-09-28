# Issue Conventions (read with every issue)

- **Files to Modify** lists up to 6 implementation files. Tests co-located with a listed file (`x.ts` → `x.test.ts`) and any file listed under **Test files** are also in scope. Nothing else may be touched: out-of-scope bugs go to `issues/discovered/`.
- **Test commands**
  - `npm run test`: unit tests (`src/**/*.test.ts(x)`), no database
  - `npm run test:integration`: `tests/**/*.test.ts` against the local Supabase stack (`npx supabase start`, `npx supabase db reset`)
  - `npm run test:e2e`: Playwright (`e2e/*.spec.ts`) against `npm run dev` with fake providers
- **Migrations:** `supabase/migrations/20260928NNNN00_<slug>.sql`, where NNNN is the issue number zero-padded to 4 digits (issue 014 → `20260928001400_…`). Never edit a migration from an earlier issue; add a new one (`create or replace` for functions).
- **SQL errors** raise `P0001` with `message = '<ERROR_CODE>'` (for example `INVALID_STATE`). Services map these to `AppError` codes from `docs/api-contracts.md`.
- **Route handlers** use `src/lib/api/route-helpers.ts` (`withRoute({ auth, body, query }, handler)`) once issue 005 has merged.
- **Integration test helpers** (`tests/helpers/supabase-test.ts`, from issue 001): `resetDb()`, `createUser({ email, verified, role })`, `asUser(user)` (an anon-key client with that user's JWT), `adminDb()` (a service-role client, **tests only**), `anonDb()`.
- **Fake providers and fixtures** (issue 017): `tests/fixtures/images/*` + `manifest.json`. CI runs with `CAR_CHECK_PROVIDER=fake`, `AI_CHECK_PROVIDER=fake`, `EMAIL_PROVIDER=log`.
- **Exception to "first issue of a feature must be visible":** E01-F01 starts with two foundation issues (001 dev/test infrastructure, 002 foundation schema). Nothing can be visible before the app has a database and a test harness. Issue 003 is the first visible slice.
