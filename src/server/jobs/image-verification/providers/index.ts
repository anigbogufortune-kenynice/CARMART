import type { JobsEnv } from '../../env'
import { ClaudeCarCheckProvider } from './claude-car-check.provider'
import { FakeAiCheckProvider, FakeCarCheckProvider } from './fake.provider'
import { SightengineAiCheckProvider } from './sightengine-ai-check.provider'
import type { AiCheckProvider, CarCheckProvider } from './types'

export type Providers = { car: CarCheckProvider; ai: AiCheckProvider }

/** Provider selection per environment (ADR-004). jobsEnv has already validated the credentials. */
export function getProviders(env: JobsEnv): Providers {
  const car = env.CAR_CHECK_PROVIDER === 'claude'
    ? ClaudeCarCheckProvider.fromKey(env.ANTHROPIC_API_KEY!, env.ANTHROPIC_CAR_CHECK_MODEL)
    : new FakeCarCheckProvider()
  const ai = env.AI_CHECK_PROVIDER === 'sightengine'
    ? new SightengineAiCheckProvider(env.SIGHTENGINE_API_USER!, env.SIGHTENGINE_API_SECRET!)
    : new FakeAiCheckProvider()
  return { car, ai }
}
