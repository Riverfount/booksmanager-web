import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { AuditPage } from './AuditPage'
import { mockApi, pageOf } from '../test/mockApi'

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AuditPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const entries = [
  { id: 3, occurredAt: '2026-11-02T13:30:00Z', actorId: 1, actorLogin: 'maria', action: 'FINE_WAIVED', targetType: 'FINE', targetId: 12, summary: 'Abono: leitor sem condições de pagar' },
  { id: 2, occurredAt: '2026-11-01T10:00:00Z', action: 'LOGIN_FAILURE', summary: 'Login desconhecido' },
  { id: 1, occurredAt: '2026-10-31T09:00:00Z', actorId: 1, actorLogin: 'maria', action: 'READER_BLOCKED', targetType: 'READER', targetId: 5 },
  { id: 0, occurredAt: '2026-10-30T09:00:00Z', actorId: 1, actorLogin: 'maria', action: 'LIBRARY_CONFIGURATION_UPDATED', targetType: 'LIBRARY_CONFIGURATION' },
]
const routes = {
  'GET /api/v1/audit-log': () => ({ json: pageOf(entries) }),
  'GET /api/v1/users': () => ({ json: pageOf([{ id: 1, login: 'maria', role: 'ADMIN', active: true, blocked: false }]) }),
}
const lastQuery = (calls: ReturnType<typeof mockApi>) => calls.filter((c) => c.key === 'GET /api/v1/audit-log').at(-1)!.url.searchParams

afterEach(() => vi.restoreAllMocks())

describe('auditoria', () => {
  it('lista quem, o quê, em quê e o resumo', async () => {
    mockApi(routes)
    renderPage()
    expect(await screen.findByText('Multa #12')).toBeInTheDocument()
    expect(screen.getByText('Abono: leitor sem condições de pagar')).toBeInTheDocument()
    expect(screen.getByText('Login recusado', { selector: 'span' })).toBeInTheDocument()
  })

  it('registro sem autor aparece como Sistema', async () => {
    mockApi(routes)
    renderPage()
    await screen.findByText('Login desconhecido')
    expect(screen.getByText('Sistema')).toBeInTheDocument()
  })

  it('alvo leitor leva ao detalhe; a configuração aparece sem id', async () => {
    mockApi(routes)
    renderPage()
    expect(await screen.findByRole('link', { name: 'Leitor #5' })).toHaveAttribute('href', '/leitores/5')
    expect(screen.getByText('Configuração da biblioteca', { selector: 'span' })).toBeInTheDocument()
  })

  it('combina os filtros na consulta', async () => {
    const calls = mockApi(routes)
    renderPage()
    await screen.findByText('Login desconhecido')
    await userEvent.type(await screen.findByLabelText('Quem fez'), 'mar')
    await userEvent.click(await screen.findByRole('button', { name: 'maria' }))
    await userEvent.selectOptions(screen.getByLabelText('Ação'), 'Multa abonada')
    await userEvent.selectOptions(screen.getByLabelText('Tipo do alvo'), 'Multa')
    await userEvent.type(screen.getByLabelText('Id do alvo'), '12')
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-11-30' } })
    await waitFor(() => {
      const q = lastQuery(calls)
      expect(q.get('actorId')).toBe('1')
      expect(q.get('action')).toBe('FINE_WAIVED')
      expect(q.get('targetType')).toBe('FINE')
      expect(q.get('targetId')).toBe('12')
      expect(q.get('from')).toBe('2026-10-01')
      expect(q.get('to')).toBe('2026-11-30')
    })
  })

  describe('quem fez', () => {
    it('busca o usuário pelo login em vez de carregar até 100 de uma vez', async () => {
      const calls = mockApi(routes)
      renderPage()
      await userEvent.type(await screen.findByLabelText('Quem fez'), 'mar')
      await userEvent.click(await screen.findByRole('button', { name: 'maria' }))
      const asked = calls.filter((c) => c.key === 'GET /api/v1/users').map((c) => c.url.searchParams)
      expect(asked.some((q) => q.get('login') === 'mar' && q.get('size') === '5')).toBe(true)
      expect(asked.every((q) => q.get('size') !== '100')).toBe(true)
      await waitFor(() => expect(lastQuery(calls).get('actorId')).toBe('1'))
    })

    it('tirar a seleção e limpar os filtros desfazem o filtro por autor da ação', async () => {
      const calls = mockApi(routes)
      renderPage()
      await userEvent.type(await screen.findByLabelText('Quem fez'), 'mar')
      await userEvent.click(await screen.findByRole('button', { name: 'maria' }))
      await waitFor(() => expect(lastQuery(calls).get('actorId')).toBe('1'))
      await userEvent.click(screen.getByRole('button', { name: 'Remover maria' }))
      await waitFor(() => expect(lastQuery(calls).has('actorId')).toBe(false))
      await userEvent.type(screen.getByLabelText('Quem fez'), 'mar')
      await userEvent.click(await screen.findByRole('button', { name: 'maria' }))
      await waitFor(() => expect(lastQuery(calls).get('actorId')).toBe('1'))
      await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
      expect(screen.queryByRole('button', { name: 'Remover maria' })).not.toBeInTheDocument()
      await waitFor(() => expect(lastQuery(calls).has('actorId')).toBe(false))
    })
  })

  it('o id do alvo só vale com o tipo e some ao limpar o tipo', async () => {
    const calls = mockApi(routes)
    renderPage()
    await screen.findByText('Login desconhecido')
    expect(screen.getByLabelText('Id do alvo')).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('Tipo do alvo'), 'Livro')
    await userEvent.type(screen.getByLabelText('Id do alvo'), '7')
    await userEvent.selectOptions(screen.getByLabelText('Tipo do alvo'), 'Qualquer alvo')
    expect(screen.getByLabelText('Id do alvo')).toHaveValue('')
    await waitFor(() => expect(lastQuery(calls).has('targetId')).toBe(false))
  })

  it('período invertido não consulta a API', async () => {
    const calls = mockApi(routes)
    renderPage()
    await screen.findByText('Login desconhecido')
    const before = calls.length
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-12-01' } })
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-11-01' } })
    expect(await screen.findByText('A data inicial não pode ser depois da final.')).toBeInTheDocument()
    expect(calls.slice(before).some((c) => c.key === 'GET /api/v1/audit-log' && c.url.searchParams.get('to') === '2026-11-01')).toBe(false)
  })

  it('"Limpar filtros" volta à lista completa', async () => {
    const calls = mockApi(routes)
    renderPage()
    await screen.findByText('Login desconhecido')
    await userEvent.selectOptions(screen.getByLabelText('Ação'), 'Multa abonada')
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() => expect(lastQuery(calls).has('action')).toBe(false))
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument()
  })

  it('mostra a recusa da API', async () => {
    mockApi({ ...routes, 'GET /api/v1/audit-log': () => ({ status: 403, json: { detail: 'Somente administrador.' } }) })
    renderPage()
    expect(await screen.findByText('Somente administrador.')).toBeInTheDocument()
  })
})
