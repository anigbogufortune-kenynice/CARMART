import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('keeps the filters in every link and marks the current page', () => {
    render(<Pagination page={2} size={24} total={100} params={{ make_id: 'm1', sort: 'price_asc' }} />)
    expect(screen.getByRole('link', { name: 'Previous page' })).toHaveAttribute('href', '/cars?make_id=m1&sort=price_asc')
    expect(screen.getByRole('link', { name: 'Next page' })).toHaveAttribute('href', '/cars?make_id=m1&sort=price_asc&page=3')
    expect(screen.getByRole('link', { name: 'Page 5' })).toHaveAttribute('href', '/cars?make_id=m1&sort=price_asc&page=5')
    expect(screen.getByText('2', { selector: '[aria-current="page"]' })).toBeInTheDocument()
  })

  it('no previous link on page 1, no next on the last page, nothing for a single page', () => {
    const { rerender, container } = render(<Pagination page={1} size={24} total={30} params={{}} />)
    expect(screen.queryByRole('link', { name: 'Previous page' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Next page' })).toHaveAttribute('href', '/cars?page=2')
    rerender(<Pagination page={2} size={24} total={30} params={{}} />)
    expect(screen.queryByRole('link', { name: 'Next page' })).toBeNull()
    rerender(<Pagination page={1} size={24} total={10} params={{}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
