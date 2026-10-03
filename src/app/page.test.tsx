import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Home from './page'

describe('home page', () => {
  it('says what CarMart is and leads sellers to start', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cars from verified Australian sellers')
    expect(screen.getByRole('link', { name: 'Start selling' })).toHaveAttribute('href', '/sell')
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/sign-up')
  })

  it('explains the three steps a car goes through, in order', () => {
    render(<Home />)
    const steps = within(screen.getByRole('list', { name: 'How a car gets on CarMart' })).getAllByRole('listitem')
    expect(steps.map((s) => s.querySelector('h3')?.textContent)).toEqual([
      'Open a shop', 'Add the car and its photos', 'It goes live',
    ])
  })

  it('is honest that car search is not open yet, and has no starter-template content', () => {
    const { container } = render(<Home />)
    expect(screen.getByText(/Car search opens soon/)).toBeInTheDocument()
    expect(container.textContent).not.toContain('src/app/page.tsx')
    expect(container.querySelector('img')).toBeNull()
  })
})
