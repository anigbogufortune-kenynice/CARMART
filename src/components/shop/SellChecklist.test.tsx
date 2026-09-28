import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

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

  it('offers Submit once shop + phone are done, and explains what is missing otherwise', async () => {
    const onSubmit = vi.fn()
    const { rerender } = render(<SellChecklist state={{ hasShop: true, phoneVerified: false, shopStatus: 'draft' }} onSubmit={onSubmit} />)
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeDisabled()
    expect(screen.getByText('Verify your phone first')).toBeInTheDocument()
    rerender(<SellChecklist state={{ hasShop: true, phoneVerified: true, shopStatus: 'draft' }} onSubmit={onSubmit} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Submit for approval' }))
    expect(onSubmit).toHaveBeenCalled()
  })

  it('shows Waiting for approval, and Resubmit for rejected shops', () => {
    const { rerender } = render(<SellChecklist state={{ hasShop: true, phoneVerified: true, shopStatus: 'pending_approval' }} onSubmit={vi.fn()} />)
    expect(screen.getByText('Waiting for approval')).toBeInTheDocument()
    rerender(<SellChecklist state={{ hasShop: true, phoneVerified: true, shopStatus: 'rejected' }} onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Resubmit' })).toBeEnabled()
  })

  it('renders step labels and done markers', () => {
    render(<SellChecklist state={{ hasShop: true, phoneVerified: false, shopStatus: 'draft' }} />)
    expect(screen.getByText('Create your shop')).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /Create your shop — done/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Verify your phone' })).toHaveAttribute('href', '/sell/phone')
  })
})
