import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ListingForm } from './ListingForm'

const TOYOTA = '11111111-1111-4111-8111-111111111111'
const HILUX = '22222222-2222-4222-8222-222222222222'
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let saveResponse: () => Response

beforeEach(() => {
  saveResponse = () => json({ data: { id: 'l1', version: 1 } }, 201)
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === '/api/vehicle-makes') return json({ data: [{ id: TOYOTA, name: 'Toyota' }] })
    if (url === `/api/vehicle-makes/${TOYOTA}/models`) return json({ data: [{ id: HILUX, name: 'HiLux' }] })
    if (url.startsWith('/api/listings') && init?.method) return saveResponse()
    throw new Error(`unexpected fetch ${url}`)
  })
})
afterEach(() => fetchMock.mockReset())

const lastBody = () => {
  const call = fetchMock.mock.calls.filter(([u, i]) => String(u).startsWith('/api/listings') && i?.method).pop()!
  return JSON.parse(call[1].body)
}

describe('ListingForm make/model', () => {
  it('loads models for the chosen make and enables the model select', async () => {
    const user = userEvent.setup()
    render(<ListingForm mode="create" onSaved={vi.fn()} />)
    const make = await screen.findByLabelText('Make')
    await screen.findByRole('option', { name: 'Toyota' })
    expect(screen.getByLabelText('Model')).toBeDisabled()
    await user.selectOptions(make, 'Toyota')
    expect(fetchMock).toHaveBeenCalledWith(`/api/vehicle-makes/${TOYOTA}/models`)
    await screen.findByRole('option', { name: 'HiLux' })
    expect(screen.getByLabelText('Model')).toBeEnabled()
  })

  it('“Other…” make reveals a text field and sends make_id null', async () => {
    const user = userEvent.setup()
    render(<ListingForm mode="create" onSaved={vi.fn()} />)
    await screen.findByRole('option', { name: 'Toyota' })
    await user.selectOptions(screen.getByLabelText('Make'), 'Other…')
    await user.type(screen.getByLabelText('Make name'), 'Holden')
    await user.type(screen.getByLabelText('Model name'), 'Kingswood')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(lastBody()).toMatchObject({ make_id: null, make_other: 'Holden', model_id: null, model_other: 'Kingswood' }))
  })
})

describe('ListingForm fields', () => {
  it('sends the price in cents and shows the VIN uppercase', async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<ListingForm mode="create" onSaved={onSaved} />)
    await screen.findByRole('option', { name: 'Toyota' })
    await user.type(screen.getByLabelText('Price (₦)'), '18,500,000')
    const vin = screen.getByLabelText('VIN')
    await user.type(vin, 'jtfst22p900123456')
    expect(vin).toHaveValue('JTFST22P900123456')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 'l1', version: 1 }))
    expect(lastBody()).toMatchObject({ price_cents: 1_850_000_000, vin: 'JTFST22P900123456' })
    expect(fetchMock).toHaveBeenCalledWith('/api/listings', expect.objectContaining({ method: 'POST' }))
  })

  it('puts a server INVALID_VIN under the VIN field', async () => {
    saveResponse = () => json({ error: { code: 'INVALID_VIN', message: 'vin: INVALID_VIN' } }, 422)
    const user = userEvent.setup()
    render(<ListingForm mode="create" onSaved={vi.fn()} />)
    await screen.findByRole('option', { name: 'Toyota' })
    await user.type(screen.getByLabelText('Year'), '2019')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Enter a valid 17-character VIN')).toBeInTheDocument()
    expect(screen.getByLabelText('VIN')).toHaveAttribute('aria-invalid', 'true')
  })

  it('validates in the browser first: a VIN with an O never reaches the server', async () => {
    const user = userEvent.setup()
    render(<ListingForm mode="create" onSaved={vi.fn()} />)
    await screen.findByRole('option', { name: 'Toyota' })
    await user.type(screen.getByLabelText('VIN'), 'JTFST22P9001234O6')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Enter a valid 17-character VIN')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith('/api/listings'))).toBe(false)
  })

  it('counts description characters and labels every input', async () => {
    const user = userEvent.setup()
    const { container } = render(<ListingForm mode="create" onSaved={vi.fn()} />)
    await screen.findByRole('option', { name: 'Toyota' })
    await user.type(screen.getByLabelText('Description'), 'Clean')
    expect(screen.getByText('5 / 5000')).toBeInTheDocument()
    for (const el of Array.from(container.querySelectorAll('input, select, textarea'))) {
      expect(el.id && container.querySelector(`label[for="${el.id}"]`)).toBeTruthy()
    }
  })

  it('edit mode PATCHes with the version and pre-fills the price in naira', async () => {
    saveResponse = () => json({ data: { id: 'l1', version: 3 } })
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(
      <ListingForm
        mode="edit"
        listing={{ id: 'l1', version: 3, make_id: TOYOTA, model_id: HILUX, make_other: null, model_other: null, year: 2019,
          odometer_km: 84000, price_cents: 1_850_000_000, condition: 'foreign_used', body_type: 'pickup', transmission: 'automatic', fuel: 'diesel', colour: 'White',
          vin: 'JTFST22P900123456', rego: null, rego_expiry: null, description: '', state: 'FCT', city: 'Wuse' }}
        onSaved={onSaved}
      />,
    )
    expect(screen.getByLabelText('Price (₦)')).toHaveValue('18,500,000')
    await screen.findByRole('option', { name: 'HiLux' })
    expect(screen.getByLabelText('Model')).toHaveValue(HILUX)
    await user.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith('/api/listings/l1', expect.objectContaining({ method: 'PATCH' }))
    expect(lastBody()).toMatchObject({ version: 3, year: 2019, price_cents: 1_850_000_000 })
  })
})
