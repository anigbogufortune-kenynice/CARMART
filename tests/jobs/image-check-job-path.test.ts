import { afterAll, describe, expect, it } from 'vitest'
import { adminDb, asUser, createUser, resetDb } from '../helpers/supabase-test'

const BASE = 'http://host.docker.internal:3000'
const SECRET = 'ci-internal-job-secret-0123456789abcdef'

afterAll(async () => {
  // Leave Vault as the e2e stage expects: Next.js route on the local app.
  await adminDb().rpc('configure_internal_jobs', { p_base_url: BASE, p_secret: SECRET })
  await resetDb()
})

describe('image check job path (ADR-014)', () => {
  it('defaults to the Next.js route; Netlify sets its background function; clearing restores the default', async () => {
    await adminDb().rpc('configure_internal_jobs', { p_base_url: BASE, p_secret: SECRET })
    expect((await adminDb().rpc('image_check_job_path')).data).toBe('/api/internal/process-image-checks')

    const netlify = await adminDb().rpc('configure_internal_jobs', {
      p_base_url: 'https://carmart.netlify.app', p_secret: SECRET, p_image_check_path: '/.netlify/functions/process-image-checks',
    })
    expect(netlify.error).toBeNull()
    expect((await adminDb().rpc('image_check_job_path')).data).toBe('/.netlify/functions/process-image-checks')

    await adminDb().rpc('configure_internal_jobs', { p_base_url: BASE, p_secret: SECRET })
    expect((await adminDb().rpc('image_check_job_path')).data).toBe('/api/internal/process-image-checks')
  })

  it('rejects a path that isn’t a plain absolute path; users can’t call either function', async () => {
    const bad = await adminDb().rpc('configure_internal_jobs', { p_base_url: BASE, p_secret: SECRET, p_image_check_path: 'https://evil.example/x' })
    expect(bad.error?.message).toContain('VALIDATION_ERROR')
    const user = await asUser(await createUser({ email: 'u@x.au' }))
    expect((await user.rpc('image_check_job_path')).error).not.toBeNull()
    expect((await user.rpc('configure_internal_jobs', { p_base_url: BASE, p_secret: SECRET, p_image_check_path: '/x' })).error).not.toBeNull()
  })
})
