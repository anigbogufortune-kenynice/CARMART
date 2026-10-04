import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SpecTable } from './SpecTable'

const car = {
  price_cents: 1_850_000_000, year: 2019, odometer_km: 84_000, condition: 'foreign_used', body_type: 'pickup',
  transmission: 'automatic', fuel: 'diesel', colour: 'White', vin: 'JTFST22P900123456', city: 'Ikeja', state: 'FCT' as const,
}

describe('SpecTable', () => {
  it('lists the specs with friendly labels', () => {
    render(<SpecTable car={car} />)
    const row = (label: string) => screen.getByRole('rowheader', { name: label }).nextElementSibling?.textContent
    expect(row('Price')).toBe('₦18,500,000')
    expect(row('Kilometres')).toBe('84,000 km')
    expect(row('Condition')).toBe('Foreign used (Tokunbo)')
    expect(row('Body type')).toBe('Pickup')
    expect(row('Fuel')).toBe('Diesel')
    expect(row('Location')).toBe('Ikeja, FCT (Abuja)')
  })

  it('shows the VIN in monospace with a reminder to check its history', () => {
    render(<SpecTable car={car} />)
    const vin = screen.getByText('JTFST22P900123456')
    expect(vin.tagName).toBe('CODE')
    expect(screen.getByText(/check this VIN’s history/i)).toBeInTheDocument()
  })
})
