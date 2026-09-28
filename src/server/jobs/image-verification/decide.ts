/**
 * Image decision table (docs/systems/image-verification.md, D1–D10; ADR-009).
 * Pure function: every row is evaluated and the worst outcome wins
 * (rejected > in_review > passed). A vendor failure or a missing check result
 * can never produce `passed` (INV-I5).
 */

export type DecisionOutcome = 'passed' | 'in_review' | 'rejected'

export type DecisionSettings = {
  aiRejectThreshold: number
  aiReviewThreshold: number
  carRejectConfidence: number
  carPassConfidence: number
}

export const DEFAULT_DECISION_SETTINGS: DecisionSettings = {
  aiRejectThreshold: 0.9,
  aiReviewThreshold: 0.5,
  carRejectConfidence: 0.85,
  carPassConfidence: 0.8,
}

export const REASONS = {
  aiGenerated:
    'This photo appears to be AI-generated or digitally created. Please upload a real photo of the car.',
  notACar: "This photo doesn't show a car. Only photos of the car for sale are allowed.",
  review: "We're double-checking this photo. This usually takes less than a day.",
  vendorUnavailable: 'Automatic check unavailable, under manual review.',
} as const

export type DecisionInputs = {
  validationError?: string
  car?: { isCar: boolean; confidence: number; isScreenOrPrint: boolean }
  ai?: { score: number }
  phashMatch?: { matchedImageId: string; matchedShopId: string; distance: number } | null
  vendorFailed?: boolean
}

export type Decision = { outcome: DecisionOutcome; reasons: string[]; sellerReason: string | null }

type Finding = { outcome: Exclude<DecisionOutcome, 'passed'>; reason: string }

const SEVERITY: Record<DecisionOutcome, number> = { passed: 0, in_review: 1, rejected: 2 }

function findings(input: DecisionInputs, s: DecisionSettings): Finding[] {
  // D1: validation failed: nothing else ran.
  if (input.validationError) return [{ outcome: 'rejected', reason: input.validationError }]
  // D9: vendor failure after retries, or a result missing for any reason.
  if (input.vendorFailed || !input.car || !input.ai) {
    return [{ outcome: 'in_review', reason: REASONS.vendorUnavailable }]
  }

  const out: Finding[] = []
  const { car, ai } = input
  if (ai.score >= s.aiRejectThreshold) out.push({ outcome: 'rejected', reason: REASONS.aiGenerated }) // D2
  else if (ai.score >= s.aiReviewThreshold) out.push({ outcome: 'in_review', reason: REASONS.review }) // D3

  if (!car.isCar && car.confidence >= s.carRejectConfidence) out.push({ outcome: 'rejected', reason: REASONS.notACar }) // D4
  if (!car.isCar && car.confidence < s.carRejectConfidence) out.push({ outcome: 'in_review', reason: REASONS.review }) // D5
  if (car.isCar && car.confidence < s.carPassConfidence) out.push({ outcome: 'in_review', reason: REASONS.review }) // D6
  if (car.isScreenOrPrint) out.push({ outcome: 'in_review', reason: REASONS.review }) // D7
  if (input.phashMatch) out.push({ outcome: 'in_review', reason: REASONS.review }) // D8
  return out
}

export function decide(input: DecisionInputs, settings: DecisionSettings): Decision {
  const found = findings(input, settings)
  if (found.length === 0) return { outcome: 'passed', reasons: [], sellerReason: null } // D10

  const outcome = found.reduce<DecisionOutcome>(
    (worst, f) => (SEVERITY[f.outcome] > SEVERITY[worst] ? f.outcome : worst),
    'passed',
  )
  const reasons = Array.from(new Set(found.map((f) => f.reason)))
  const sellerReason = (found.find((f) => f.outcome === outcome) ?? found[0]).reason
  return { outcome, reasons, sellerReason }
}
