import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }) }))

import { FilterPanel, SortSelect } from './FilterPanel'

const TOYOTA = '11111111-1111-4111-8111-111111111111'
const HILUX = '22222222-2222-4222-8222-222222222222'
const makes = [{ id: TOYOTA, name: 'Toyota' }]
const fetchMock = vi.fn()

beforeEach(() => {
  replace.mockReset()
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: HILUX, name: 'HiLux' }] }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('FilterPanel', () => {
  it('choosing a make updates the URL (page reset) and loads its models', async () => {
    const user = userEvent.setup()
    render(<FilterPanel makes={makes} current={{ page: '3', sort: 'price_asc' }} />)
    await user.selectOptions(screen.getByLabelText('Make'), TOYOTA)
    expect(replace).toHaveBeenLastCalledWith(`/cars?sort=price_asc&make_id=${TOYOTA}`, { scroll: false })
    await screen.findByRole('option', { name: 'HiLux' })
    expect(fetchMock).toHaveBeenCalledWith(`/api/vehicle-makes/${TOYOTA}/models`)
    expect(screen.getByLabelText('Model')).toBeEnabled()
  })

  it('price is chosen in naira and sent in kobo; Clear filters goes back to /cars', async () => {
    const user = userEvent.setup()
    render(<FilterPanel makes={makes} current={{}} />)
    await user.selectOptions(screen.getByLabelText('Max price'), '₦10,000,000')
    expect(replace).toHaveBeenLastCalledWith('/cars?price_max=1000000000', { scroll: false })
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(replace).toHaveBeenLastCalledWith('/cars', { scroll: false })
  })

  it('city applies on Enter, not on every key', async () => {
    const user = userEvent.setup()
    render(<FilterPanel makes={makes} current={{}} />)
    await user.type(screen.getByLabelText('City or area'), 'Ikeja')
    expect(replace).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith('/cars?city=Ikeja', { scroll: false }))
  })

  it('on small screens the filters open in a drawer', async () => {
    const user = userEvent.setup()
    render(<FilterPanel makes={makes} current={{}} />)
    const toggle = screen.getByRole('button', { name: 'Filters' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('SortSelect', () => {
  it('changes the sort and keeps the filters, resetting the page', async () => {
    render(<SortSelect current={{ make_id: TOYOTA, page: '2' }} />)
    await userEvent.setup().selectOptions(screen.getByLabelText('Sort by'), 'price_asc')
    expect(replace).toHaveBeenLastCalledWith(`/cars?make_id=${TOYOTA}&sort=price_asc`, { scroll: false })
  })
})
