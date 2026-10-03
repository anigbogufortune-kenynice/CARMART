# Deploying CarMart to Netlify

> ADR-014. The app (Next.js) runs on Netlify; the database, sign-in and photo storage run on Supabase.
> Netlify builds from GitHub on every push to `main`, and builds a deploy preview for every pull request.

## 1. Create the Supabase project (once)

1. At supabase.com → **New project**. Region: **London (eu-west-2)**. Save the database password.
2. **Project Settings → API**: copy the **Project URL**, the **anon** key and the **service_role** key.
3. Apply the database (tables, security rules, storage buckets, car makes and models) from your computer, in the project folder:
   ```
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   `supabase/seed.sql` is for local use only. Don't run it on production.
4. **Authentication → URL Configuration**:
   - Site URL: your Netlify address, e.g. `https://carmart.netlify.app`
   - Redirect URLs: add `https://carmart.netlify.app/**`, plus `https://deploy-preview-*--carmart.netlify.app/**` if you want sign-in to work on deploy previews
5. **Authentication → Providers → Phone**: connect Twilio (a sender that can reach Nigerian +234 numbers). Shops need a verified mobile before approval.

## 2. Create the Netlify site (once)

1. At app.netlify.com → **Add new project → Import an existing project → GitHub** → choose **CARMART**.
2. The build settings come from `netlify.toml` (`npm run build`, publish `.next`, Node 22). Leave them as they are.
3. **Site configuration → Environment variables**. Add these, then deploy:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-site>.netlify.app` (later your real domain) |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Your support address |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (keep secret) |
| `INTERNAL_JOB_SECRET` | A long random string, e.g. the output of `openssl rand -base64 32` |
| `CAR_CHECK_PROVIDER` | `claude` |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `AI_CHECK_PROVIDER` | `sightengine` |
| `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET` | From your Sightengine dashboard |
| `EMAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY` / `EMAIL_FROM` | From Resend (verified sending domain) |

For a private test site without vendor accounts you can use `CAR_CHECK_PROVIDER=fake`, `AI_CHECK_PROVIDER=fake` and `EMAIL_PROVIDER=log`. **The fake checks pass every photo**, so never use them on a public site.

4. **Pro plan only (recommended):** Cloud compute → Functions → Region → **EU (London)** or the nearest European region, then redeploy. Every request talks to the London database, and the default region is US East.

## 3. Connect the database to the site (once, after the first deploy)

Supabase → **SQL Editor**, run (use your site address and the same secret as `INTERNAL_JOB_SECRET`):

```sql
select public.configure_internal_jobs(
  'https://<your-site>.netlify.app',
  '<INTERNAL_JOB_SECRET>',
  '/.netlify/functions/process-image-checks'
);
```

This tells Postgres where to send photo checks (the Netlify background function) and emails. Run it again whenever the site address or the secret changes.

## 4. Check it works

1. Open the site and sign up; confirm the email.
2. Create a shop. Approve it: make your account an admin (below), then use `/admin/shops`.
3. Create a listing and upload a real car photo. Within about a minute it should show **Passed**. If it stays on **Checking**, open Netlify → Logs → Functions → `process-image-checks`, and check that step 3 used the right address and secret.

**First admin:** in the SQL Editor, `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');`

## Custom domain (later)

Netlify → Domain management → add the domain. Then update `NEXT_PUBLIC_SITE_URL`, the Supabase Site URL and redirect URLs, and run step 3 again with the new address.
