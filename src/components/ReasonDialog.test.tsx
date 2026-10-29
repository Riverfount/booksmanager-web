import { render, screen } from '@testing-library/react'
import { ApiError } from '../api/client'
import { ReasonDialog } from './ReasonDialog'

const renderDialog = (error: unknown) =>
  render(<ReasonDialog title="Abonar multa" description="A multa deixa de ser cobrada." confirm="Abonar multa" pending={false} error={error} onSubmit={() => {}} onClose={() => {}} />)

describe('ReasonDialog: erro do servidor', () => {
  it('marca o campo Justificativa quando a API aponta o campo, sem banner', () => {
    renderDialog(new ApiError('Dados inválidos.', 400, undefined, [{ field: 'reason', message: 'a justificativa é longa demais' }]))
    expect(screen.getByLabelText(/^Justificativa/)).toHaveAccessibleDescription('A justificativa é longa demais')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('erro sem campo continua no banner', () => {
    renderDialog(new ApiError('A multa já foi paga.', 422))
    expect(screen.getByRole('alert')).toHaveTextContent('A multa já foi paga.')
    expect(screen.getByLabelText(/^Justificativa/)).not.toHaveAccessibleDescription(/./)
  })

  it('sem erro, nada é mostrado', () => {
    renderDialog(null)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
