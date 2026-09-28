import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const FORBIDDEN_IMPORT = "import { adminClient } from '@/server/jobs/supabase-admin'\nexport const x = adminClient\n"
const FORBIDDEN_ENV = 'export const key = process.env.SUPABASE_SERVICE_ROLE_KEY\n'

async function lint(code: string, filePath: string) {
  const eslint = new ESLint({ cwd: process.cwd() })
  const [result] = await eslint.lintText(code, { filePath })
  return result.messages.filter((m) =>
    ['no-restricted-imports', 'no-restricted-syntax'].includes(m.ruleId ?? ''),
  )
}

describe('service-role lint guard (ADR-006)', () => {
  it('forbids importing the service-role client from app code', async () => {
    const messages = await lint(FORBIDDEN_IMPORT, 'src/app/x.ts')
    expect(messages).toHaveLength(1)
    expect(messages[0].ruleId).toBe('no-restricted-imports')
  })

  it('allows the import inside src/server/jobs', async () => {
    expect(await lint(FORBIDDEN_IMPORT, 'src/server/jobs/x.ts')).toHaveLength(0)
  })

  it('forbids reading SUPABASE_SERVICE_ROLE_KEY outside jobs and tests', async () => {
    const messages = await lint(FORBIDDEN_ENV, 'src/services/x.ts')
    expect(messages).toHaveLength(1)
    expect(messages[0].ruleId).toBe('no-restricted-syntax')
  })

  it('allows reading the key in tests', async () => {
    expect(await lint(FORBIDDEN_ENV, 'tests/helpers/x.ts')).toHaveLength(0)
  })
}, 30_000)
