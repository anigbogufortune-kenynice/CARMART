import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PhotoUploader } from './PhotoUploader'

const L = '11111111-1111-4111-8111-111111111111'
type Photo = { image_id: string; position: number; status: string; status_reason: string | null; thumbnail_url: string | null }

let photos: Photo[] = []
let calls: string[] = []
let nextId = 0
let requestReply: () => Response

const server = setupServer(
  http.get(`/api/listings/${L}/images/status`, () => {
    calls.push('status')
    return HttpResponse.json({ data: photos })
  }),
  http.post(`/api/listings/${L}/images`, () => {
    calls.push('request')
    return requestReply()
  }),
  http.put('http://storage.test/upload/:id', ({ params }) => {
    calls.push(`put:${params.id}`)
    return HttpResponse.json({ Key: params.id })
  }),
  http.post(`/api/listings/${L}/images/:imageId/complete`, ({ params }) => {
    calls.push(`complete:${params.imageId}`)
    photos.push({ image_id: String(params.imageId), position: photos.length, status: 'checking', status_reason: null, thumbnail_url: null })
    return HttpResponse.json({ data: { image_id: params.imageId, status: 'checking' } }, { status: 202 })
  }),
  http.put(`/api/listings/${L}/images/order`, async ({ request }) => {
    const { image_ids } = (await request.json()) as { image_ids: string[] }
    calls.push(`order:${image_ids.join(',')}`)
    photos = image_ids.map((id, position) => ({ ...photos.find((p) => p.image_id === id)!, position }))
    return HttpResponse.json({ data: photos.map((p) => ({ image_id: p.image_id, position: p.position })) })
  }),
  http.delete(`/api/listings/${L}/images/:imageId`, ({ params }) => {
    calls.push(`delete:${params.imageId}`)
    photos = photos.filter((p) => p.image_id !== params.imageId)
    return new HttpResponse(null, { status: 204 })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  photos = []
  calls = []
  nextId = 0
  requestReply = () => {
    nextId += 1
    const id = `img-${nextId}`
    return HttpResponse.json({ data: { image_id: id, upload_url: `http://storage.test/upload/${id}?token=t`, expires_in: 7200 } }, { status: 201 })
  }
})
afterEach(() => server.resetHandlers())

const jpg = (name: string) => new File(['jpeg-bytes'], name, { type: 'image/jpeg' })
const photo = (id: string, status: string, position: number, reason: string | null = null): Photo =>
  ({ image_id: id, position, status, status_reason: reason, thumbnail_url: null })

describe('PhotoUploader', () => {
  it('uploads each file: request URL → PUT → complete, then polls until no photo is checking', async () => {
    const user = userEvent.setup()
    render(<PhotoUploader listingId={L} editable pollMs={40} />)
    expect(await screen.findByText('0 / 20 photos (min 4)')).toBeInTheDocument()

    await user.upload(screen.getByLabelText('Add photos'), [jpg('a.jpg'), jpg('b.jpg')])
    await waitFor(() => expect(calls.filter((c) => c.startsWith('complete:'))).toHaveLength(2))
    expect(calls.filter((c) => c === 'request')).toHaveLength(2)
    expect(calls).toEqual(expect.arrayContaining(['put:img-1', 'put:img-2', 'complete:img-1', 'complete:img-2']))
    expect(await screen.findByText('2 / 20 photos (min 4)')).toBeInTheDocument()
    expect(screen.getAllByText('Checking')).toHaveLength(2)

    photos = [photo('img-1', 'passed', 0), photo('img-2', 'rejected', 1, "This photo doesn't show a car.")]
    expect(await screen.findByText('Passed')).toBeInTheDocument()
    expect(screen.getByText("This photo doesn't show a car.")).toBeInTheDocument()

    const settled = calls.filter((c) => c === 'status').length
    await new Promise((r) => setTimeout(r, 200))
    expect(calls.filter((c) => c === 'status').length).toBe(settled)
  })

  it('shows the daily-limit message on 429 and stops the batch', async () => {
    requestReply = () => HttpResponse.json({ error: { code: 'UPLOAD_LIMIT', message: 'limit' } }, { status: 429 })
    const user = userEvent.setup()
    render(<PhotoUploader listingId={L} editable pollMs={40} />)
    await screen.findByText('0 / 20 photos (min 4)')
    await user.upload(screen.getByLabelText('Add photos'), [jpg('a.jpg'), jpg('b.jpg')])
    expect(await screen.findByText('Daily upload limit reached — try again tomorrow')).toBeInTheDocument()
    expect(calls.filter((c) => c === 'request')).toHaveLength(1)
    expect(calls.some((c) => c.startsWith('put:'))).toBe(false)
  })

  it('refuses unsupported files before any request', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<PhotoUploader listingId={L} editable pollMs={40} />)
    await screen.findByText('0 / 20 photos (min 4)')
    await user.upload(screen.getByLabelText('Add photos'), [new File(['%PDF'], 'brochure.pdf', { type: 'application/pdf' })])
    expect(await screen.findByText(/Only JPG, PNG, WebP or iPhone photos/)).toBeInTheDocument()
    expect(calls).not.toContain('request')
  })

  it('reorders with the move buttons and deletes after confirmation', async () => {
    photos = [photo('p1', 'passed', 0), photo('p2', 'passed', 1), photo('p3', 'passed', 2)]
    const user = userEvent.setup()
    render(<PhotoUploader listingId={L} editable pollMs={40} />)
    const items = await screen.findAllByRole('listitem')
    await user.click(within(items[2]).getByRole('button', { name: 'Move photo 3 earlier' }))
    await waitFor(() => expect(calls).toContain('order:p1,p3,p2'))

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const after = await screen.findAllByRole('listitem')
    await user.click(within(after[0]).getByRole('button', { name: 'Delete photo 1' }))
    expect(confirm).toHaveBeenCalled()
    await waitFor(() => expect(calls).toContain('delete:p1'))
    expect(await screen.findByText('2 / 20 photos (min 4)')).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('read-only mode shows statuses without upload or edit controls', async () => {
    photos = [photo('p1', 'in_review', 0, "We're double-checking this photo.")]
    render(<PhotoUploader listingId={L} editable={false} pollMs={40} />)
    expect(await screen.findByText('Under review')).toBeInTheDocument()
    expect(screen.queryByLabelText('Add photos')).toBeNull()
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull()
  })
})
