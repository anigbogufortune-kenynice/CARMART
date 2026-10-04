import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { PhotoGallery } from './PhotoGallery'

const photo = (n: number) => ({ id: `p${n}`, position: n - 1, urls: { sm: `/sm${n}.webp`, md: `/md${n}.webp`, lg: `/lg${n}.webp` } })
const photos = [photo(1), photo(2), photo(3)]

describe('PhotoGallery', () => {
  it('shows the first photo large with srcset and descriptive alt text', () => {
    render(<PhotoGallery title="2019 Toyota HiLux" photos={photos} />)
    const main = screen.getByRole('img', { name: '2019 Toyota HiLux photo 1 of 3' })
    expect(main).toHaveAttribute('src', '/lg1.webp')
    expect(main.getAttribute('srcset')).toContain('/md1.webp 1024w')
    expect(main.getAttribute('srcset')).toContain('/lg1.webp 1600w')
  })

  it('thumbnails and the arrow keys change the photo', async () => {
    const user = userEvent.setup()
    render(<PhotoGallery title="2019 Toyota HiLux" photos={photos} />)
    await user.click(screen.getByRole('button', { name: 'Show photo 3' }))
    expect(screen.getByRole('img', { name: '2019 Toyota HiLux photo 3 of 3' })).toBeInTheDocument()
    const region = screen.getByRole('region', { name: 'Photos' })
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    expect(screen.getByRole('img', { name: '2019 Toyota HiLux photo 1 of 3' })).toBeInTheDocument()
    fireEvent.keyDown(region, { key: 'ArrowLeft' })
    expect(screen.getByRole('img', { name: '2019 Toyota HiLux photo 3 of 3' })).toBeInTheDocument()
  })

  it('no photos → a placeholder', () => {
    render(<PhotoGallery title="x" photos={[]} />)
    expect(screen.getByText('No photos yet')).toBeInTheDocument()
  })
})
