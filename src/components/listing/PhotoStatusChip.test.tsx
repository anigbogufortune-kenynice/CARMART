import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhotoStatusChip } from './PhotoStatusChip'

describe('PhotoStatusChip', () => {
  it('Rejected shows the reason in red', () => {
    render(<PhotoStatusChip status="rejected" reason="This photo doesn't show a car." />)
    expect(screen.getByText('Rejected')).toHaveClass('bg-red-100')
    expect(screen.getByText("This photo doesn't show a car.")).toBeInTheDocument()
  })
  it('Under review is amber with its reason', () => {
    render(<PhotoStatusChip status="in_review" reason="We're double-checking this photo." />)
    expect(screen.getByText('Under review')).toHaveClass('bg-amber-100')
    expect(screen.getByText("We're double-checking this photo.")).toBeInTheDocument()
  })
  it('Passed is green; Checking is grey', () => {
    const { rerender } = render(<PhotoStatusChip status="passed" reason={null} />)
    expect(screen.getByText('Passed')).toHaveClass('bg-green-100')
    rerender(<PhotoStatusChip status="checking" reason={null} />)
    expect(screen.getByText('Checking')).toHaveClass('bg-gray-100')
  })
})
