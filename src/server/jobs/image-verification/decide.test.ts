import { describe, expect, it } from 'vitest'
import { decide, DEFAULT_DECISION_SETTINGS as S, REASONS, type DecisionInputs } from './decide'

const car = (isCar: boolean, confidence: number, isScreenOrPrint = false) => ({ isCar, confidence, isScreenOrPrint })
const ok = (over: Partial<DecisionInputs> = {}): DecisionInputs => ({ car: car(true, 0.97), ai: { score: 0.02 }, ...over })

describe('decide(): D10 pass and AI bands (D2/D3)', () => {
  it('passes a confident car with a low AI score', () => {
    expect(decide(ok({ ai: { score: 0.49 } }), S)).toEqual({ outcome: 'passed', reasons: [], sellerReason: null })
  })
  it.each([
    [0.5, 'in_review'],
    [0.89, 'in_review'],
    [0.9, 'rejected'],
    [0.99, 'rejected'],
  ])('AI score %s → %s', (score, outcome) => {
    expect(decide(ok({ ai: { score } }), S).outcome).toBe(outcome)
  })
  it('uses the AI rejection wording', () => {
    expect(decide(ok({ ai: { score: 0.9 } }), S).sellerReason).toMatch(/^This photo appears to be AI-generated/)
  })
})

describe('decide(): car rules (D4–D7)', () => {
  it('rejects "not a car" at ≥ 0.85 confidence', () => {
    const r = decide(ok({ car: car(false, 0.85) }), S)
    expect(r.outcome).toBe('rejected')
    expect(r.sellerReason).toBe(REASONS.notACar)
  })
  it('reviews "not a car" below 0.85', () => {
    expect(decide(ok({ car: car(false, 0.84) }), S).outcome).toBe('in_review')
  })
  it('reviews a car below 0.80 confidence and passes at 0.80', () => {
    expect(decide(ok({ car: car(true, 0.79) }), S).outcome).toBe('in_review')
    expect(decide(ok({ car: car(true, 0.8) }), S).outcome).toBe('passed')
  })
  it('reviews photos of screens or printouts', () => {
    expect(decide(ok({ car: car(true, 0.97, true) }), S)).toMatchObject({ outcome: 'in_review', sellerReason: REASONS.review })
  })
})

describe('decide(): pHash, validation and vendor failure (D1, D8, D9)', () => {
  it('reviews a photo reused by another shop', () => {
    expect(decide(ok({ phashMatch: { matchedImageId: 'x', matchedShopId: 'y', distance: 3 } }), S).outcome).toBe('in_review')
  })
  it('rejects a validation failure with its own reason', () => {
    const reason = 'Photo is too small (minimum 800×600).'
    expect(decide({ validationError: reason }, S)).toEqual({ outcome: 'rejected', reasons: [reason], sellerReason: reason })
  })
  it('never passes on vendor failure (INV-I5)', () => {
    expect(decide({ vendorFailed: true }, S)).toEqual({
      outcome: 'in_review',
      reasons: [REASONS.vendorUnavailable],
      sellerReason: REASONS.vendorUnavailable,
    })
  })
  it('never passes when a check result is missing', () => {
    expect(decide({ car: car(true, 0.99) }, S).outcome).toBe('in_review')
    expect(decide({ ai: { score: 0.01 } }, S).outcome).toBe('in_review')
  })
})

describe('decide(): worst outcome wins', () => {
  it('collects every reason and shows the first rejected one', () => {
    const r = decide(ok({ ai: { score: 0.95 }, car: car(false, 0.99) }), S)
    expect(r.outcome).toBe('rejected')
    expect(r.reasons).toEqual([REASONS.aiGenerated, REASONS.notACar])
    expect(r.sellerReason).toBe(REASONS.aiGenerated)
  })
  it('review beats pass', () => {
    expect(decide(ok({ ai: { score: 0.6 } }), S).outcome).toBe('in_review')
  })
})

describe('decide(): thresholds come from settings, not constants', () => {
  it('a stricter reject threshold flips 0.85 to rejected', () => {
    expect(decide(ok({ ai: { score: 0.85 } }), { ...S, aiRejectThreshold: 0.8 }).outcome).toBe('rejected')
  })
})
