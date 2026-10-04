import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import BuyerSafety from './buyer-safety/page'
import Contact from './contact/page'
import Privacy from './privacy/page'
import Prohibited from './prohibited-listings/page'
import Terms from './terms/page'

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL = 'help@carmart.ng'
  delete process.env.LEGAL_REVIEWED
})
afterEach(() => { delete process.env.LEGAL_REVIEWED })

const pages: [string, () => JSX.Element, string][] = [
  ['Terms', Terms, 'Terms of use'], ['Privacy', Privacy, 'Privacy policy'], ['Prohibited', Prohibited, 'Prohibited listings'],
  ['Buyer safety', BuyerSafety, 'Buyer safety'], ['Contact', Contact, 'Contact us'],
]

describe('legal and trust pages', () => {
  it.each(pages)('%s: one h1, a last-updated date and the draft banner', (_n, Page, heading) => {
    render(<Page />)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    expect(screen.getByText(/^Last updated \d{1,2} \w+ 2026$/)).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Draft — pending legal review')
  })

  it('the banner goes once LEGAL_REVIEWED=true', () => {
    process.env.LEGAL_REVIEWED = 'true'
    render(<Terms />)
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('uses the support email', () => {
    render(<Contact />)
    expect(screen.getByRole('link', { name: 'help@carmart.ng' })).toHaveAttribute('href', 'mailto:help@carmart.ng')
  })

  it('Prohibited listings: cars only, the allowed body types, no trucks/motorbikes/parts, no AI or stock photos', () => {
    render(<Prohibited />)
    expect(screen.getByText(/Sedan, Hatchback, SUV/)).toBeInTheDocument()
    for (const t of [/Trucks/, /Motorbikes/, /Car parts/, /boats/]) expect(screen.getByText(t)).toBeInTheDocument()
    expect(screen.getByText(/AI-generated images, stock photos/)).toBeInTheDocument()
    expect(screen.getByText(/may be suspended/)).toBeInTheDocument()
  })

  it('Buyer safety: inspect first, check the VIN, never pay deposits to strangers, how to report', () => {
    render(<BuyerSafety />)
    expect(screen.getByRole('heading', { name: 'Inspect before you pay' })).toBeInTheDocument()
    expect(screen.getByText(/history report for the VIN/)).toBeInTheDocument()
    expect(screen.getByText(/Never pay a deposit/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Report a problem' })).toBeInTheDocument()
  })

  it('Privacy: what is collected, metadata stripped, where data is held, how to ask for deletion', () => {
    render(<Privacy />)
    expect(screen.getByText(/verified Nigerian mobile number/)).toBeInTheDocument()
    expect(screen.getByText(/stripped from every public photo/)).toBeInTheDocument()
    expect(screen.getByText(/London, United Kingdom/)).toBeInTheDocument()
    expect(screen.getAllByText(/Nigeria Data Protection Act 2023/).length).toBeGreaterThan(0)
    expect(screen.getByText(/access, correct or delete your personal data/)).toBeInTheDocument()
  })

  it('Terms: not a party to sales; photo checks are not a guarantee', () => {
    render(<Terms />)
    expect(screen.getByText(/CarMart is not a party to any sale/)).toBeInTheDocument()
    expect(screen.getByText(/they are not a guarantee/)).toBeInTheDocument()
  })
})
