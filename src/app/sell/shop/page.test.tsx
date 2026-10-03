import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ShopPage from './page'

const fetchMock = vi.fn()
afterEach(() => fetchMock.mockReset())
vi.stubGlobal('fetch', fetchMock)

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }))

async function fillAndSubmit(slug: string) {
  const user = userEvent.setup()
  render(<ShopPage />)
  await user.type(await screen.findByLabelText('Shop name'), 'Coastal Cars')
  const slugInput = screen.getByLabelText('Shop web address')
  await user.clear(slugInput)
  await user.type(slugInput, slug)
  await user.type(screen.getByLabelText('City or area'), 'Ikeja')
  await user.selectOptions(screen.getByLabelText('State'), 'Lagos')
  await user.click(screen.getByRole('button', { name: 'Create shop' }))
}

describe('/sell/shop create form', () => {
  it('suggests a slug from the shop name', async () => {
    fetchMock.mockImplementation(() => reply(404, { error: { code: 'NOT_FOUND', message: 'x' } }))
    render(<ShopPage />)
    await userEvent.setup().type(await screen.findByLabelText('Shop name'), 'Coastal Cars Lagos')
    expect(screen.getByLabelText('Shop web address')).toHaveValue('coastal-cars-lagos')
  })

  it('validates the slug before submitting', async () => {
    fetchMock.mockImplementation(() => reply(404, { error: { code: 'NOT_FOUND', message: 'x' } }))
    await fillAndSubmit('Coastal Cars')
    expect(await screen.findByText('Use lowercase letters, numbers and hyphens')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST')).toBe(false)
  })

  it('creates the shop and confirms', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? reply(201, { data: { slug: 'coastal-cars', status: 'draft' } })
        : reply(404, { error: { code: 'NOT_FOUND', message: 'x' } }),
    )
    await fillAndSubmit('coastal-cars')
    expect(await screen.findByText('Shop created (draft)')).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST')!
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({
      name: 'Coastal Cars', slug: 'coastal-cars', city: 'Ikeja', state: 'Lagos',
    })
  })

  it('shows server errors in plain words', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? reply(409, { error: { code: 'SLUG_TAKEN', message: 'x' } })
        : reply(404, { error: { code: 'NOT_FOUND', message: 'x' } }),
    )
    await fillAndSubmit('coastal-cars')
    expect(await screen.findByText('That web address is taken — try another')).toBeInTheDocument()
  })
})
