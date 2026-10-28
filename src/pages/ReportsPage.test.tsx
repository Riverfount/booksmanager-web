import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ReportsPage } from './ReportsPage'
import { mockApi, pageOf } from '../test/mockApi'

const auth = vi.hoisted(() => ({ isAdmin: true }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const overdue = { loanId: 1, readerId: 5, readerName: 'Ana', copyId: 3, assetCode: 'PAT-0003', bookId: 1, bookTitle: 'Dom Casmurro', pickupDate: '2026-10-01', dueDate: '2026-10-15', daysLate: 12 }
const saved: string[] = []

beforeEach(() => {
  saved.length = 0
  URL.createObjectURL = vi.fn(() => 'blob:report')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push(this.download)
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  auth.isAdmin = true
})

describe('relatório de atrasos', () => {
  it('lista os empréstimos em atraso', async () => {
    mockApi({ 'GET /api/v1/reports/overdue-loans': () => ({ json: pageOf([overdue]) }) })
    renderPage()
    expect(await screen.findByText('Dom Casmurro')).toBeInTheDocument()
    expect(screen.getByText('PAT-0003')).toBeInTheDocument()
    expect(screen.getByText('12 dias')).toBeInTheDocument()
  })

  it('administrador exporta em PDF e o arquivo leva o nome enviado pela API', async () => {
    const calls = mockApi({
      'GET /api/v1/reports/overdue-loans': () => ({ json: pageOf([overdue]) }),
      'GET /api/v1/reports/overdue-loans/pdf': () => ({ headers: { 'Content-Disposition': 'attachment; filename="overdue-loans-2026-11-01.pdf"' } }),
    })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar PDF' }))
    await waitFor(() => expect(saved).toEqual(['overdue-loans-2026-11-01.pdf']))
    expect(calls.some((c) => c.key === 'GET /api/v1/reports/overdue-loans/pdf')).toBe(true)
  })

  it('sem o cabeçalho, o arquivo usa o nome de reserva com a data de hoje', async () => {
    mockApi({ 'GET /api/v1/reports/overdue-loans': () => ({ json: pageOf([]) }) })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar CSV' }))
    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]).toMatch(/^overdue-loans-\d{4}-\d{2}-\d{2}\.csv$/)
  })

  it('mostra a recusa da API quando o relatório é grande demais', async () => {
    mockApi({
      'GET /api/v1/reports/overdue-loans': () => ({ json: pageOf([]) }),
      'GET /api/v1/reports/overdue-loans/pdf': () => ({ status: 422, json: { detail: 'O relatório tem mais de 10000 linhas.' } }),
    })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar PDF' }))
    expect(await screen.findByText('O relatório tem mais de 10000 linhas.')).toBeInTheDocument()
    expect(saved).toHaveLength(0)
  })

  it('operador não vê os botões de exportação', async () => {
    auth.isAdmin = false
    mockApi({ 'GET /api/v1/reports/overdue-loans': () => ({ json: pageOf([overdue]) }) })
    renderPage()
    expect(await screen.findByText('Dom Casmurro')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Exportar/ })).not.toBeInTheDocument()
  })
})

describe('relatório de mais emprestados', () => {
  const open = async () => {
    const calls = mockApi({ 'GET /api/v1/reports/most-borrowed-books': () => ({ json: pageOf([{ bookId: 1, title: 'Dom Casmurro', totalLoans: 9 }]) }) })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Mais emprestados' }))
    return calls
  }

  it('abre com os últimos 30 dias e numera a lista', async () => {
    const calls = await open()
    expect(await screen.findByText('Dom Casmurro')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    const q = calls.filter((c) => c.key === 'GET /api/v1/reports/most-borrowed-books').at(-1)!.url.searchParams
    expect(q.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(q.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('período invertido não consulta a API e bloqueia a exportação', async () => {
    const calls = await open()
    await screen.findByText('Dom Casmurro')
    const before = calls.length
    fireEvent.change(screen.getByLabelText(/^De/), { target: { value: '2999-01-01' } })
    expect(await screen.findByText('A data inicial não pode ser depois da final.')).toBeInTheDocument()
    expect(calls.length).toBe(before)
    expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeDisabled()
  })

  it('a exportação leva o período escolhido', async () => {
    const calls = await open()
    await screen.findByText('Dom Casmurro')
    fireEvent.change(screen.getByLabelText(/^De/), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText(/^Até/), { target: { value: '2026-03-31' } })
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await waitFor(() => expect(saved).toHaveLength(1))
    const q = calls.filter((c) => c.key === 'GET /api/v1/reports/most-borrowed-books/csv').at(-1)!.url.searchParams
    expect(q.get('from')).toBe('2026-01-01')
    expect(q.get('to')).toBe('2026-03-31')
  })
})

describe('relatório do acervo', () => {
  it('mostra o total, cada status e os inativos', async () => {
    mockApi({ 'GET /api/v1/reports/collection-status': () => ({ json: { totalCopies: 10, activeByStatus: { AVAILABLE: 6, BORROWED: 3, RESERVED: 1, DAMAGED: 0, LOST: 0 }, inactiveCopies: 2 } }) })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Acervo' }))
    const section = await screen.findByLabelText('Situação do acervo')
    expect(section).toHaveTextContent('Exemplares ativos10')
    expect(section).toHaveTextContent('Disponível6')
    expect(section).toHaveTextContent('Emprestado3')
    expect(section).toHaveTextContent('Reservado1')
    expect(section).toHaveTextContent('Inativos2')
  })
})
