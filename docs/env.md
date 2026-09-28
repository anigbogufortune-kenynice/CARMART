# Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | YES | Supabase URL | `https://abc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | YES | Supabase anon key | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | YES (server only) | Service role key | `eyJ...` |

## Startup validation (`src/lib/env.ts`)

```typescript
import { z } from 'zod'
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})
export const env = envSchema.parse(process.env)
```
