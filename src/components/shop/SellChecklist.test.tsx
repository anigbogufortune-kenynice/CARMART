import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SellChecklist, checklistSteps } from './SellChecklist'

describe('SellChecklist', () => {
  it('no shop yet: only step 1 is actionable', () => {
    const steps = checklistSteps({ hasShop: false, phoneVerified: false, shopStatus: null })
    expect(steps.map((s) => [s.key, s.done])).toEqual([['shop', false], ['phone', false], ['submit', false], ['approved', false]])
  })

  it('pending approval: steps 1–3 done', () => {
    const steps = checklistSteps({ hasShop: true, phoneVerified: true, shopStatus: 'pending_approval' })
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual(['shop', 'phone', 'submit'])
  })

  it('renders step labels and done markers', () => {
    render(<SellChecklist state={{ hasShop: true, phoneVerified: false, shopStatus: 'draft' }} />)
    expect(screen.getByText('Create your shop')).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /Create your shop — done/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Verify your phone' })).toHaveAttribute('href', '/sell/phone')
  })
})
