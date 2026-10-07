import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SETTING_DEFINITIONS, type Settings } from '@/services/settings.service'
import { SettingsForm } from './SettingsForm'

afterEach(() => vi.unstubAllGlobals())
const values = Object.fromEntries(SETTING_DEFINITIONS.map((d) => [d.key, 1])) as Settings
values.ai_review_threshold = 0.5
values.ai_reject_threshold = 0.9
values.min_photos = 4
values.max_photos = 20

describe('SettingsForm', () => {
  it('explains each threshold', () => {
    render(<SettingsForm initial={values} />)
    expect(screen.getByText('Photos scoring at or above this are rejected as AI-made.')).toBeInTheDocument()
    expect(screen.getAllByRole('spinbutton')).toHaveLength(SETTING_DEFINITIONS.length)
  })

  it('shows an inline error for review ≥ reject and doesn’t send it', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<SettingsForm initial={values} />)
    const row = screen.getByRole('group', { name: 'AI photo: review at' })
    const input = within(row).getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '0.95')
    expect(within(row).getByRole('alert')).toHaveTextContent('must be below ai_reject_threshold')
    expect(within(row).getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('saves a valid change with PATCH', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { key: 'ai_review_threshold', value: 0.6 } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<SettingsForm initial={values} />)
    const row = screen.getByRole('group', { name: 'AI photo: review at' })
    const input = within(row).getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '0.6')
    await user.click(within(row).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(within(row).getByRole('status')).toHaveTextContent('Saved'))
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/admin/settings')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ key: 'ai_review_threshold', value: 0.6 })
  })
})
