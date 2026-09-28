import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReasonDialog } from './ReasonDialog'

describe('ReasonDialog', () => {
  it('keeps Confirm disabled until at least 5 characters, then passes the trimmed reason', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<ReasonDialog title="Reject shop" confirmLabel="Reject" onConfirm={onConfirm} onCancel={vi.fn()} />)
    const confirm = screen.getByRole('button', { name: 'Reject' })
    await user.type(screen.getByLabelText('Reason'), 'Bad')
    expect(confirm).toBeDisabled()
    await user.type(screen.getByLabelText('Reason'), ' name  ')
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith('Bad name')
  })

  it('is a labelled modal dialog and Cancel closes it', async () => {
    const onCancel = vi.fn()
    render(<ReasonDialog title="Reject shop" confirmLabel="Reject" onConfirm={vi.fn()} onCancel={onCancel} />)
    expect(screen.getByRole('dialog', { name: 'Reject shop' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
