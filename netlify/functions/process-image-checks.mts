/**
 * Netlify background function (ADR-014): Postgres (pg_net) calls it when photos are queued for
 * checking. Netlify answers 202 at once and runs this for up to 15 minutes.
 * Postgres finds it through the Vault setting `image_check_path` = `/.netlify/functions/process-image-checks`.
 */
import type { Config } from '@netlify/functions'
import { handleImageCheckRequest } from '../../src/server/jobs/image-verification/background'
import { runImageChecks } from '../../src/server/jobs/image-verification/pipeline'

export default async (req: Request) => handleImageCheckRequest(req, process.env.INTERNAL_JOB_SECRET ?? '', runImageChecks)

export const config: Config = { background: true }
