import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
import { ShopAdminControls } from './ShopAdminControls'

afterEach(() => vi.unstubAllGlobals())
const shop = { id: 's1', name: 'Coastal Cars', status: 'approved', listing_cap: 10, owner_id: 'u1', owner_status: 'active' }

describe('ShopAdminControls', () => {
  it('Suspend opens the reason dialog and POSTs suspend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<ShopAdminControls shop={shop} />)
    await user.click(screen.getByRole('button', { name: 'Suspend shop' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Reason' }), 'Selling stolen cars')
    await user.click(screen.getByRole('button', { name: 'Suspend Coastal Cars' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/shops/s1/suspend', expect.objectContaining({ method: 'POST' })))
  })

  it('a suspended shop offers Unsuspend; a suspended owner offers Unsuspend owner', () => {
    render(<ShopAdminControls shop={{ ...shop, status: 'suspended', owner_status: 'suspended' }} />)
    expect(screen.getByRole('button', { name: 'Unsuspend shop' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unsuspend owner' })).toBeInTheDocument()
  })

  it('the listing cap PATCHes the new cap with a reason', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { listing_cap: 25 } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<ShopAdminControls shop={shop} />)
    const cap = screen.getByRole('spinbutton', { name: 'Listing cap' })
    await user.clear(cap)
    await user.type(cap, '25')
    await user.click(screen.getByRole('button', { name: 'Set cap' }))
    await user.type(screen.getByRole('textbox', { name: 'Reason' }), 'Trusted dealer')
    await user.click(screen.getByRole('button', { name: 'Set cap to 25' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/admin/shops/s1/listing-cap')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ listing_cap: 25, reason: 'Trusted dealer' })
  })
})
