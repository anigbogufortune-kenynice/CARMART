# Project: CarMart

## Stack
- Frontend: Next.js 14 (App Router), React 18
- Backend: Supabase (Postgres, Auth, Storage, Edge Functions)
- Language: TypeScript (strict mode)
- Testing: Vitest + Testing Library
- Styling: Tailwind CSS

## Skills
Custom skills for this workflow live in `.claude/skills/<name>/SKILL.md`.
Invoke a skill by typing its name as a slash command (e.g. `/grill-me`,
`/write-prd`, `/feature-to-issues`, `/plan-issues`, `/implement`, `/audit`).
Codex reads the same skills via a symlink at `.codex/skills`.

## Spec Documents
Live in `docs/`. Read them when referenced in the issue. They are source of truth.
- `docs/schema.md`        — database schema, table definitions, RLS policies
- `docs/api-contracts.md` — all API routes, request/response shapes, status codes
- `docs/auth.md`          — authentication flows, session handling, RLS rules
- `docs/architecture.md`  — system architecture, service boundaries, data flow
- `docs/decisions.md`     — architectural decision records (ADRs)
- `docs/env.md`           — all environment variables and their purpose
Do not modify spec docs unless the issue explicitly instructs it.

## Architecture
This project uses deep modules. Each service exposes a minimal public interface
and contains all related logic internally. Do not create shallow utility files
or fragment logic across many small files.

## Module Map
- `src/services/[name].service.ts` — business logic, one service per domain
- `src/app/api/[name]/route.ts`    — Next.js route handlers only, no logic
- `src/lib/supabase/`              — Supabase client (server + browser)
- `src/lib/env.ts`                 — validated environment variables (Zod)
- `src/lib/utils.ts`               — shared utilities (keep minimal)
- `src/components/`                — UI components, co-located tests
- `src/types/`                     — shared TypeScript types (`result.ts` = Result<T, AppError>)
- `supabase/config.toml`           — Supabase local stack config
- `supabase/migrations/`           — database migrations

## Naming Conventions
- Files: kebab-case (`user-profile.service.ts`)
- Components: PascalCase (`UserProfile.tsx`)
- Functions/variables: camelCase (`getUserProfile`)
- Constants: SCREAMING_SNAKE_CASE (`MAX_RETRY_COUNT`)
- Types/interfaces: PascalCase, no `I` prefix (`UserProfile`, not `IUserProfile`)
- Database tables: snake_case plural (`user_profiles`)
- Database columns: snake_case (`created_at`, `user_id`)
- Migrations: `[timestamp]_[description].sql`
- Test files: co-located, same name + `.test.ts` (`user.service.test.ts`)

## Error Handling
- Services return `Result<T, AppError>` — never throw across service boundaries
- Route handlers catch all errors and return structured JSON
- Every catch block must log+rethrow OR handle+return — never swallow silently
- Validate all API inputs with Zod at the route handler boundary
- Error response shape: `{ error: { code: string, message: string } }`

## Security Standards
- All Supabase tables have RLS enabled — no exceptions
- Never use service role key in client-side code
- Validate and sanitise all user input — never trust client data
- Auth check in every route handler before any data access
- Secrets only via environment variables — never hardcoded

## API Design
- REST: GET/POST/PUT/PATCH/DELETE used correctly
- Paths: plural nouns, kebab-case (`/api/user-profiles`)
- Success: `{ data: T }` — Failure: `{ error: { code, message } }`
- Status codes: 200, 201, 400, 401, 403, 404, 422, 500

## Performance
- React Server Components by default — `'use client'` only when needed
- `select()` specific columns — never `select('*')`
- `Promise.all` for independent async ops — no sequential awaits
- No N+1 queries

## TDD Rules
- Write the failing test FIRST — before any implementation code
- Red: confirm test fails with the expected error, not a setup error
- Green: write the minimum code to make the test pass — nothing more
- One test per acceptance criterion in the issue
- Tests must be independent — no shared mutable state
- Mock only external third-party services — never mock internal modules

## Coding Standards
- TypeScript strict mode — no `any`, no `@ts-ignore`, no unsafe casts
- Every public service method has a corresponding test
- No `console.log` in committed code — use the structured logger
- `const` by default — `let` only when reassignment is necessary
- No unused imports, variables, or parameters

## Communication Style
- Be concise. Sacrifice grammar for brevity.
- Report findings as bullet points before taking action
- Ask before making changes outside the scope of the current task
- When uncertain about scope, surface the question — do not assume

## Test Integrity
Never mock internal modules. Tests must exercise real code paths.
A test that mocks the module under test is not a test.
