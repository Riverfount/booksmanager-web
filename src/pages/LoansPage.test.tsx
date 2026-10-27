import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { LoansPage } from './LoansPage'
import { mockApi, pageOf } from '../test/mockApi'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ isAdmin: false, state: { user: { login: 'op', displayName: 'Operador' } } }) }))

const renderLoans = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <LoansPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const copy = (status: string) => ({ id: 3, bookId: 1, assetCode: 'PAT-0003', status, active: true })
const routes = (status: string) => ({
  'GET /api/v1/readers': () => ({ json: pageOf([{ id: 6, name: 'Bia', maskedDocument: '***', blocked: false }, { id: 5, name: 'Ana', maskedDocument: '***', blocked: false }]) }),
  'GET /api/v1/copies': () => ({ json: pageOf([copy(status)]) }),
  'GET /api/v1/books/1': () => ({ json: { id: 1, title: 'Dom Casmurro' } }),
  'GET /api/v1/reservations': () => ({ json: pageOf([{ id: 8, bookId: 1, readerId: 5, readerName: 'Ana', copyId: 3, pickupDeadline: '2026-11-05', status: 'ACTIVE', reservationDate: '2026-11-01' }]) }),
  'POST /api/v1/loans': () => ({ status: 201, json: { id: 1 } }),
})

const fill = async (readerName: string, status: string) => {
  const calls = mockApi(routes(status))
  renderLoans()
  await userEvent.type(await screen.findByLabelText('Buscar leitor pelo nome'), readerName)
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(readerName) }))
  await userEvent.type(screen.getByLabelText(/^Exemplar/), 'PAT-0003')
  await screen.findByText('Dom Casmurro')
  return calls
}

afterEach(() => vi.restoreAllMocks())

describe('empréstimo de exemplar reservado', () => {
  it('o dono da reserva retira o exemplar', async () => {
    const calls = await fill('Ana', 'RESERVED')
    expect(await screen.findByText(/Reservado para Ana/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar empréstimo' }))
    expect(await screen.findByText('Empréstimo registrado.')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/loans')?.body).toEqual({ copyId: 3, readerId: 5 })
  })

  it('outro leitor é barrado antes de chamar a API', async () => {
    const calls = await fill('Bia', 'RESERVED')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar empréstimo' }))
    expect(await screen.findAllByText(/reservado para outro leitor/i)).not.toHaveLength(0)
    expect(calls.some((c) => c.key === 'POST /api/v1/loans')).toBe(false)
  })

  it('exemplar emprestado continua barrado', async () => {
    const calls = await fill('Ana', 'BORROWED')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar empréstimo' }))
    expect(await screen.findAllByText(/não está disponível \(emprestado\)/)).not.toHaveLength(0)
    expect(calls.some((c) => c.key === 'POST /api/v1/loans')).toBe(false)
  })
})
