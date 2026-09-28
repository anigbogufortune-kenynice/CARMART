import type { AppError, Result } from '@/types/result'

/** Provider contracts: docs/systems/image-verification.md → Provider contracts. */
export type CarView = 'exterior' | 'interior' | 'engine' | 'dashboard' | 'wheel_detail' | 'other_car_detail' | 'not_car'

export type CarCheckResult = {
  provider: 'claude' | 'fake'
  isCar: boolean
  confidence: number
  view: CarView
  isScreenOrPrint: boolean
  plateVisible: boolean
  faceVisible: boolean
  notes: string
}

export type AiCheckResult = { provider: 'sightengine' | 'fake'; score: number; raw: unknown }

export interface CarCheckProvider {
  check(jpeg: Buffer): Promise<Result<CarCheckResult, AppError>>
}

export interface AiCheckProvider {
  check(original: Buffer, mime: string): Promise<Result<AiCheckResult, AppError>>
}
