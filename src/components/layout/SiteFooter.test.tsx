import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteFooter } from './SiteFooter'

describe('SiteFooter', () => {
  it('links to the legal and trust pages and shows the copyright', () => {
    render(<SiteFooter />)
    for (const [name, href] of [['Terms', '/terms'], ['Privacy', '/privacy'], ['Prohibited listings', '/prohibited-listings'], ['Buyer safety', '/buyer-safety'], ['Contact', '/contact']]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
    }
    expect(screen.getByText(/© \d{4} CarMart/)).toBeInTheDocument()
    expect(screen.getByText(/inspect the car and its papers in person/)).toBeInTheDocument()
  })
})
