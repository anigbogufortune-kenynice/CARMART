import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShopForm } from './ShopForm'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)
afterEach(() => fetchMock.mockReset())

const existing = {
  id: 's1', name: 'Coastal Cars', slug: 'coastal-cars', description: 'Family run', city: 'Ikeja',
  state: 'Lagos', status: 'pending_approval', show_phone: false,
}

describe('ShopForm (edit mode)', () => {
  it('pre-fills the values and PATCHes only the changed fields', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { ...existing, name: 'Coastal Cars Lagos' } }), { status: 200 }))
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<ShopForm mode="edit" shop={existing} onSaved={onSaved} />)
    const name = screen.getByLabelText('Shop name')
    expect(name).toHaveValue('Coastal Cars')
    await user.clear(name)
    await user.type(name, 'Coastal Cars Lagos')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/shops/me', expect.objectContaining({ method: 'PATCH' }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: 'Coastal Cars Lagos' })
    expect(onSaved).toHaveBeenCalled()
  })

  it('locks the web address once the shop is submitted', () => {
    render(<ShopForm mode="edit" shop={existing} onSaved={vi.fn()} />)
    expect(screen.getByLabelText('Shop web address')).toHaveAttribute('readonly')
    expect(screen.getByText('The web address can’t be changed after you submit your shop.')).toBeInTheDocument()
  })

  it('the phone toggle is off by default and PATCHes { show_phone: true }', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { ...existing, show_phone: true } }), { status: 200 }))
    const user = userEvent.setup()
    render(<ShopForm mode="edit" shop={existing} onSaved={vi.fn()} />)
    const toggle = screen.getByRole('checkbox', { name: 'Show my phone number to signed-in buyers' })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    expect(fetchMock).toHaveBeenCalledWith('/api/shops/me', expect.objectContaining({ method: 'PATCH' }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ show_phone: true })
    expect(toggle).toBeChecked()
  })

  it('has no file upload control', () => {
    const { container } = render(<ShopForm mode="edit" shop={existing} onSaved={vi.fn()} />)
    expect(container.querySelector('input[type=file]')).toBeNull()
  })
})
