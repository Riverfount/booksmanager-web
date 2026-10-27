import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ReservationsPage } from './ReservationsPage'
import { mockApi, pageOf } from '../test/mockApi'

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ReservationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const waiting = { id: 11, bookId: 1, bookTitle: 'Dom Casmurro', readerId: 5, readerName: 'Ana', reservationDate: '2026-11-01', status: 'ACTIVE', queuePosition: 2 }
const holding = { id: 12, bookId: 2, bookTitle: 'Capitães da Areia', readerId: 6, readerName: 'Bia', copyId: 3, assetCode: 'PAT-0003', pickupDeadline: '2026-11-05', reservationDate: '2026-11-01', status: 'ACTIVE' }
const closed = { id: 13, bookId: 1, bookTitle: 'Dom Casmurro', readerId: 7, readerName: 'Caio', reservationDate: '2026-10-01', status: 'CANCELLED' }

afterEach(() => vi.restoreAllMocks())

const lastList = (calls: ReturnType<typeof mockApi>) => calls.filter((c) => c.key === 'GET /api/v1/reservations').at(-1)!.url.searchParams

describe('reservas: lista', () => {
  it('abre nas ativas e mostra fila, exemplar guardado e prazo', async () => {
    const calls = mockApi({ 'GET /api/v1/reservations': () => ({ json: pageOf([waiting, holding]) }) })
    renderPage()
    expect(await screen.findByText('Na fila · 2º')).toBeInTheDocument()
    expect(screen.getByText('Exemplar guardado')).toBeInTheDocument()
    expect(screen.getByText(/PAT-0003/)).toBeInTheDocument()
    expect(screen.getByText(/05\/11\/2026/)).toBeInTheDocument()
    expect(lastList(calls).get('status')).toBe('ACTIVE')
  })

  it('troca a situação e o filtro "Todas" não envia status', async () => {
    const calls = mockApi({ 'GET /api/v1/reservations': () => ({ json: pageOf([closed]) }) })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Retiradas' }))
    await waitFor(() => expect(lastList(calls).get('status')).toBe('FULFILLED'))
    await userEvent.click(screen.getByRole('button', { name: 'Todas' }))
    await waitFor(() => expect(lastList(calls).has('status')).toBe(false))
  })

  it('filtrar por livro nas ativas lê a fila em ordem de chegada', async () => {
    const calls = mockApi({
      'GET /api/v1/books': () => ({ json: pageOf([{ id: 1, title: 'Dom Casmurro', availableCopies: 0 }]) }),
      'GET /api/v1/reservations': () => ({ json: pageOf([waiting]) }),
    })
    renderPage()
    await userEvent.type(await screen.findByLabelText('Filtrar por livro'), 'Dom')
    await userEvent.click(await screen.findByRole('button', { name: /Dom Casmurro/ }))
    await waitFor(() => {
      const q = lastList(calls)
      expect(q.get('bookId')).toBe('1')
      expect(q.get('sort')).toBe('id,asc')
    })
  })

  it('só reservas ativas têm o botão de cancelar', async () => {
    mockApi({ 'GET /api/v1/reservations': () => ({ json: pageOf([waiting, closed]) }) })
    renderPage()
    await screen.findByText('Caio')
    expect(screen.getAllByRole('button', { name: /^Cancelar reserva/ })).toHaveLength(1)
  })
})

describe('reservas: cancelar', () => {
  it('confirma, cancela e avisa quem recebeu o exemplar', async () => {
    const calls = mockApi({
      'GET /api/v1/reservations': () => ({ json: pageOf([holding]) }),
      'POST /api/v1/reservations/12/cancel': () => ({
        json: { reservation: { ...holding, status: 'CANCELLED' }, served: { id: 20, readerId: 8, copyId: 3, pickupDeadline: '2026-11-10' } },
      }),
    })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /^Cancelar reserva/ }))
    const dialog = await screen.findByRole('dialog')
    expect(calls.some((c) => c.key === 'POST /api/v1/reservations/12/cancel')).toBe(false)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar reserva' }))
    expect(await screen.findByText(/Reserva cancelada/)).toBeInTheDocument()
    expect(screen.getByText(/passou para a reserva #20/)).toBeInTheDocument()
    expect(screen.getByText(/10\/11\/2026/)).toBeInTheDocument()
  })

  it('mostra a recusa da API', async () => {
    mockApi({
      'GET /api/v1/reservations': () => ({ json: pageOf([waiting]) }),
      'POST /api/v1/reservations/11/cancel': () => ({ status: 422, json: { detail: 'A reserva já foi encerrada.' } }),
    })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /^Cancelar reserva/ }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar reserva' }))
    expect(await screen.findByText('A reserva já foi encerrada.')).toBeInTheDocument()
  })
})

describe('reservas: nova reserva', () => {
  const readers = { 'GET /api/v1/readers': () => ({ json: pageOf([{ id: 5, name: 'Ana', maskedDocument: '***', blocked: false }]) }) }
  const pick = async (title: string) => {
    await userEvent.type(await screen.findByLabelText('Buscar leitor pelo nome'), 'Ana')
    await userEvent.click(await screen.findByRole('button', { name: /Ana/ }))
    await userEvent.type(screen.getByLabelText('Buscar livro pelo título'), title)
    await userEvent.click(await screen.findByRole('button', { name: new RegExp(title) }))
  }

  it('reserva livro sem exemplar disponível e mostra o lugar na fila', async () => {
    const calls = mockApi({
      ...readers,
      'GET /api/v1/books': () => ({ json: pageOf([{ id: 1, title: 'Dom Casmurro', availableCopies: 0 }]) }),
      'POST /api/v1/reservations': () => ({ status: 201, json: { id: 30, bookId: 1, readerId: 5, reservationDate: '2026-11-01', status: 'ACTIVE', queuePosition: 3 } }),
    })
    renderPage()
    await pick('Dom')
    await userEvent.click(screen.getByRole('button', { name: 'Reservar livro' }))
    expect(await screen.findByText(/lugar 3 na fila/)).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/reservations')?.body).toEqual({ bookId: 1, readerId: 5 })
  })

  it('livro com exemplar disponível não é reservado: é caso de emprestar', async () => {
    const calls = mockApi({ ...readers, 'GET /api/v1/books': () => ({ json: pageOf([{ id: 1, title: 'Dom Casmurro', availableCopies: 2 }]) }) })
    renderPage()
    await pick('Dom')
    await userEvent.click(screen.getByRole('button', { name: 'Reservar livro' }))
    expect(await screen.findAllByText(/tem exemplar disponível/)).not.toHaveLength(0)
    expect(calls.some((c) => c.key === 'POST /api/v1/reservations')).toBe(false)
  })

  it('exige leitor e livro', async () => {
    mockApi({})
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Reservar livro' }))
    expect(await screen.findAllByText(/selecione o leitor/i)).not.toHaveLength(0)
    expect(screen.getAllByText(/selecione o livro/i)).not.toHaveLength(0)
  })
})
