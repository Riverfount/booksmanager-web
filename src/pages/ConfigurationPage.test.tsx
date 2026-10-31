import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigurationPage } from './ConfigurationPage'
import { mockApi } from '../test/mockApi'

const config = {
  penaltyPolicy: 'FINE', dailyFineAmount: 1, fineCap: 10, suspensionDaysPerDay: 1, suspensionCapDays: 365,
  loanPeriodDays: 14, loanLimit: 3, renewalLimit: 2, reservationPickupDays: 3, dueSoonNoticeDays: 2, assetCodePrefix: 'PAT',
}
const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  render(
    <QueryClientProvider client={client}>
      <ConfigurationPage />
    </QueryClientProvider>,
  )
  return invalidate
}
const prefixField = () => screen.findByLabelText(/^Prefixo do patrimônio/)

afterEach(() => vi.restoreAllMocks())

describe('configuração: prefixo do patrimônio', () => {
  it('mostra o prefixo vigente e explica o formato e o que acontece ao trocar', async () => {
    mockApi({ 'GET /api/v1/library-configuration': () => ({ json: config }) })
    renderPage()
    const field = await prefixField()
    expect(field).toHaveValue('PAT')
    expect(field).toHaveAttribute('maxLength', '4')
    expect(field).toHaveAccessibleDescription(/PAT-00001/)
    expect(field).toHaveAccessibleDescription(/recomeça a numeração/)
  })

  it('digita em maiúsculas e não passa de 4 caracteres', async () => {
    mockApi({ 'GET /api/v1/library-configuration': () => ({ json: config }) })
    renderPage()
    const field = await prefixField()
    await userEvent.clear(field)
    await userEvent.type(field, 'bibl')
    expect(field).toHaveValue('BIBL')
  })

  it('o exemplo do campo acompanha o que está sendo digitado', async () => {
    mockApi({ 'GET /api/v1/library-configuration': () => ({ json: config }) })
    renderPage()
    const field = await prefixField()
    await userEvent.clear(field)
    await userEvent.type(field, 'esc')
    expect(field).toHaveAccessibleDescription(/ESC-00001/)
  })

  it.each(['PA', 'P4T', 'PA-'])('recusa "%s" sem chamar a API e marca o campo', async (value) => {
    const calls = mockApi({ 'GET /api/v1/library-configuration': () => ({ json: config }) })
    renderPage()
    const field = await prefixField()
    await userEvent.clear(field)
    await userEvent.type(field, value)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }))
    expect(await screen.findByText('Corrija 1 campo para salvar a configuração.')).toBeInTheDocument()
    expect(field).toHaveAccessibleDescription(/Prefixo do patrimônio: use de 3 a 4 letras, de A a Z\./)
    expect(calls.some((c) => c.key === 'PATCH /api/v1/library-configuration')).toBe(false)
  })

  it('envia o prefixo junto com o resto e renova a sugestão do patrimônio', async () => {
    const calls = mockApi({
      'GET /api/v1/library-configuration': () => ({ json: config }),
      'PATCH /api/v1/library-configuration': ({ body }) => ({ json: { ...config, ...(body as object) } }),
    })
    const invalidate = renderPage()
    const field = await prefixField()
    await userEvent.clear(field)
    await userEvent.type(field, 'bib')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }))
    await screen.findByText(/Configuração salva/)
    expect(calls.find((c) => c.key === 'PATCH /api/v1/library-configuration')?.body).toMatchObject({ assetCodePrefix: 'BIB', loanLimit: 3 })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['next-asset-code'] })
  })

  it('marca o campo com o erro que a API devolveu, sem banner', async () => {
    mockApi({
      'GET /api/v1/library-configuration': () => ({ json: config }),
      'PATCH /api/v1/library-configuration': () => ({ status: 400, json: { detail: 'Dados inválidos.', errors: [{ field: 'assetCodePrefix', message: 'o prefixo é inválido' }] } }),
    })
    renderPage()
    await prefixField()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar configuração' }))
    await waitFor(() => expect(screen.getByLabelText(/^Prefixo do patrimônio/)).toHaveAccessibleDescription(/O prefixo é inválido/))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})
