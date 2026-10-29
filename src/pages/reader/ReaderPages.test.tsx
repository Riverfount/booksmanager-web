import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ReaderLayout } from '../../components/ReaderLayout'
import { mockApi, pageOf } from '../../test/mockApi'
import { CatalogPage } from './CatalogPage'
import { MyLoansPage } from './MyLoansPage'
import { MyReservationsPage } from './MyReservationsPage'
import { MyStandingPage } from './MyStandingPage'

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: false, signOut: vi.fn(), state: { status: 'authenticated', user: { id: 9, login: 'ana', displayName: 'Ana Leitora', role: 'READER' } } }),
}))

const renderPage = (element: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  )

const last = (calls: ReturnType<typeof mockApi>, key: string) => calls.filter((c) => c.key === key).at(-1)!.url.searchParams
const noReaderId = (calls: ReturnType<typeof mockApi>) => calls.filter((c) => c.key.includes('/me/')).every((c) => !c.url.searchParams.has('readerId'))

afterEach(() => vi.restoreAllMocks())

const standing = { canBorrow: true, blocked: false, reasons: [], pendingFineTotal: 0, activeLoans: 1, overdueLoans: 0, loanLimit: 3, activeReservations: 0, reservationLimit: 2 }

describe('minha situação', () => {
  it('leitor em dia: pode emprestar e vê os limites', async () => {
    const calls = mockApi({ 'GET /api/v1/me/standing': () => ({ json: standing }) })
    renderPage(<MyStandingPage />)
    expect(await screen.findByText('Você pode pegar livros emprestados')).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByText('0 / 2')).toBeInTheDocument()
    expect(screen.getByText('Olá, Ana Leitora')).toBeInTheDocument()
    expect(noReaderId(calls)).toBe(true)
  })

  it('mostra todos os motivos, a suspensão e a multa', async () => {
    mockApi({
      'GET /api/v1/me/standing': () => ({
        json: { ...standing, canBorrow: false, blocked: true, reasons: ['Há multa pendente.', 'Leitor suspenso.'], pendingFineTotal: 7.5, overdueLoans: 1, suspension: { startDate: '2026-11-01', releaseDate: '2026-11-08' } },
      }),
    })
    renderPage(<MyStandingPage />)
    expect(await screen.findByText('Empréstimos indisponíveis no momento')).toBeInTheDocument()
    expect(screen.getByText('Há multa pendente.')).toBeInTheDocument()
    expect(screen.getByText('Leitor suspenso.')).toBeInTheDocument()
    expect(screen.getByText(/volta a poder emprestar em 08\/11\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/cadastro está bloqueado/)).toBeInTheDocument()
  })
})

const loan = { id: 4, bookId: 1, bookTitle: 'Dom Casmurro', pickupDate: '2026-10-20', dueDate: '2026-11-03', renewals: 1, active: true, daysLate: 0 }

describe('meus empréstimos', () => {
  it('lista os em aberto e renova', async () => {
    const calls = mockApi({
      'GET /api/v1/me/loans': () => ({ json: pageOf([loan]) }),
      'POST /api/v1/me/loans/4/renew': () => ({ json: { ...loan, renewals: 2, dueDate: '2026-11-17' } }),
    })
    renderPage(<MyLoansPage />)
    expect(await screen.findByText('Dom Casmurro')).toBeInTheDocument()
    expect(screen.getByText('renovado 1 vez')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Renovar Dom Casmurro' }))
    expect(await screen.findByText(/nova data de devolução é 17\/11\/2026/)).toBeInTheDocument()
    expect(last(calls, 'GET /api/v1/me/loans').get('status')).toBe('ACTIVE')
    expect(noReaderId(calls)).toBe(true)
  })

  it('mostra a recusa da renovação com o motivo da API', async () => {
    mockApi({
      'GET /api/v1/me/loans': () => ({ json: pageOf([loan]) }),
      'POST /api/v1/me/loans/4/renew': () => ({ status: 422, json: { detail: 'Outro leitor espera este livro na fila de reservas.' } }),
    })
    renderPage(<MyLoansPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Renovar Dom Casmurro' }))
    expect(await screen.findByText('Outro leitor espera este livro na fila de reservas.')).toBeInTheDocument()
  })

  it('aba de atrasados filtra e a de devolvidos mostra multa e suspensão', async () => {
    const calls = mockApi({
      'GET /api/v1/me/loans': () => ({ json: pageOf([{ ...loan, active: false, returnDate: '2026-11-10', daysLate: 7, fine: { id: 1, amount: 3.5, status: 'PENDING' }, suspension: { id: 2, startDate: '2026-11-10', endDate: '2026-11-17' } }]) }),
    })
    renderPage(<MyLoansPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Atrasados' }))
    await waitFor(() => expect(last(calls, 'GET /api/v1/me/loans').get('overdue')).toBe('true'))
    await userEvent.click(screen.getByRole('button', { name: 'Devolvidos' }))
    await waitFor(() => expect(last(calls, 'GET /api/v1/me/loans').get('status')).toBe('RETURNED'))
    expect(await screen.findByText(/Multa R\$\s*3,50/)).toBeInTheDocument()
    expect(screen.getByText('Suspensão até 17/11/2026')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Renovar/ })).not.toBeInTheDocument()
  })
})

const waiting = { id: 11, bookId: 1, bookTitle: 'Dom Casmurro', reservationDate: '2026-11-01', status: 'ACTIVE', queuePosition: 2 }
const holding = { id: 12, bookId: 2, bookTitle: 'Capitães da Areia', reservationDate: '2026-11-01', status: 'ACTIVE', pickupDeadline: '2026-11-05' }

describe('minhas reservas', () => {
  it('mostra a fila e o prazo do exemplar guardado', async () => {
    mockApi({ 'GET /api/v1/me/reservations': () => ({ json: pageOf([waiting, holding]) }) })
    renderPage(<MyReservationsPage />)
    expect(await screen.findByText('Na fila · 2º')).toBeInTheDocument()
    expect(screen.getByText('Exemplar guardado')).toBeInTheDocument()
    expect(screen.getByText('retire até 05/11/2026')).toBeInTheDocument()
  })

  it('cancela só depois de confirmar', async () => {
    const calls = mockApi({
      'GET /api/v1/me/reservations': () => ({ json: pageOf([waiting]) }),
      'POST /api/v1/me/reservations/11/cancel': () => ({ json: { ...waiting, status: 'CANCELLED' } }),
    })
    renderPage(<MyReservationsPage />)
    await userEvent.click(await screen.findByRole('button', { name: /^Cancelar reserva de/ }))
    const dialog = await screen.findByRole('dialog')
    expect(calls.some((c) => c.key === 'POST /api/v1/me/reservations/11/cancel')).toBe(false)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar reserva' }))
    expect(await screen.findByText('Reserva cancelada.')).toBeInTheDocument()
    expect(noReaderId(calls)).toBe(true)
  })

  it('reserva livro sem exemplar disponível e mostra o lugar na fila', async () => {
    const calls = mockApi({
      'GET /api/v1/me/books': () => ({ json: pageOf([{ id: 1, title: 'Dom Casmurro', availableCopies: 0 }]) }),
      'POST /api/v1/me/reservations': () => ({ status: 201, json: { ...waiting, queuePosition: 3 } }),
    })
    renderPage(<MyReservationsPage />)
    await userEvent.type(await screen.findByLabelText('Buscar livro pelo título'), 'Dom')
    await userEvent.click(await screen.findByRole('button', { name: /Dom Casmurro/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Reservar livro' }))
    expect(await screen.findByText(/lugar 3 na fila/)).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/me/reservations')?.body).toEqual({ bookId: 1 })
  })

  it('livro com exemplar disponível não é reservado', async () => {
    const calls = mockApi({ 'GET /api/v1/me/books': () => ({ json: pageOf([{ id: 1, title: 'Dom Casmurro', availableCopies: 2 }]) }) })
    renderPage(<MyReservationsPage />)
    await userEvent.type(await screen.findByLabelText('Buscar livro pelo título'), 'Dom')
    await userEvent.click(await screen.findByRole('button', { name: /Dom Casmurro/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Reservar livro' }))
    expect(await screen.findByText(/tem exemplar disponível/)).toBeInTheDocument()
    expect(calls.some((c) => c.key === 'POST /api/v1/me/reservations')).toBe(false)
  })
})

const book = { id: 1, isbn: '9788533302273', title: 'Dom Casmurro', publisher: 'Garnier', publicationYear: 1899, availableCopies: 0, category: { id: 3, name: 'Romance' }, authors: [{ id: 7, name: 'Machado de Assis' }] }

describe('catálogo', () => {
  const routes = {
    'GET /api/v1/me/books': () => ({ json: pageOf([book, { ...book, id: 2, title: 'Quincas Borba', availableCopies: 2 }]) }),
    'GET /api/v1/me/categories': () => ({ json: pageOf([{ id: 3, name: 'Romance' }]) }),
  }

  it('lista os livros com a disponibilidade e só oferece reserva dos indisponíveis', async () => {
    mockApi(routes)
    renderPage(<CatalogPage />)
    expect(await screen.findByText('Dom Casmurro')).toBeInTheDocument()
    expect(screen.getByText('Indisponível')).toBeInTheDocument()
    expect(screen.getByText('2 disponíveis')).toBeInTheDocument()
    expect(screen.getAllByText('Garnier, 1899')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /^Reservar / })).toHaveLength(1)
  })

  it('envia título, autor, ISBN e categoria', async () => {
    const calls = mockApi(routes)
    renderPage(<CatalogPage />)
    await userEvent.type(await screen.findByLabelText('Buscar por autor'), 'machado')
    await userEvent.type(await screen.findByLabelText('Filtrar por categoria'), 'rom')
    await userEvent.click(await screen.findByRole('button', { name: 'Romance' }))
    await waitFor(() => {
      const q = last(calls, 'GET /api/v1/me/books')
      expect(q.get('author')).toBe('machado')
      expect(q.get('categoryId')).toBe('3')
    })
    await userEvent.click(screen.getByRole('button', { name: 'Remover Romance' }))
    await waitFor(() => expect(last(calls, 'GET /api/v1/me/books').has('categoryId')).toBe(false))
  })

  it('busca a categoria só nas rotas do leitor, em vez de carregar até 100 de uma vez', async () => {
    const calls = mockApi(routes)
    renderPage(<CatalogPage />)
    await userEvent.type(await screen.findByLabelText('Filtrar por categoria'), 'rom')
    await userEvent.click(await screen.findByRole('button', { name: 'Romance' }))
    await waitFor(() => expect(calls.some((c) => c.key === 'GET /api/v1/me/books' && c.url.searchParams.get('categoryId') === '3')).toBe(true))
    const asked = calls.filter((c) => c.key === 'GET /api/v1/me/categories').map((c) => c.url.searchParams)
    expect(asked.some((q) => q.get('name') === 'rom' && q.get('size') === '5')).toBe(true)
    expect(asked.every((q) => q.get('size') !== '100')).toBe(true)
    // the staff routes answer 403 to a reader (the by-id lookup of the inactive mark must not run)
    expect(calls.some((c) => c.url.pathname.startsWith('/api/v1/categories'))).toBe(false)
  })

  it('reserva depois de confirmar e mostra o lugar na fila', async () => {
    const calls = mockApi({ ...routes, 'POST /api/v1/me/reservations': () => ({ status: 201, json: { ...waiting, queuePosition: 1 } }) })
    renderPage(<CatalogPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Reservar Dom Casmurro' }))
    expect(calls.some((c) => c.key === 'POST /api/v1/me/reservations')).toBe(false)
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reservar' }))
    expect(await screen.findByText(/lugar 1 na fila/)).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/me/reservations')?.body).toEqual({ bookId: 1 })
  })

  it('mostra todos os motivos da recusa', async () => {
    mockApi({ ...routes, 'POST /api/v1/me/reservations': () => ({ status: 422, json: { detail: 'Há multa pendente; o limite de reservas foi atingido.' } }) })
    renderPage(<CatalogPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Reservar Dom Casmurro' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reservar' }))
    expect(await screen.findByText('Há multa pendente; o limite de reservas foi atingido.')).toBeInTheDocument()
  })
})

describe('layout do leitor', () => {
  it('tem a navegação do portal e o nome de quem entrou', () => {
    renderPage(
      <Routes>
        <Route path="/" element={<ReaderLayout />}>
          <Route index element={<p>conteúdo</p>} />
        </Route>
      </Routes>,
    )
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Minha situação', 'Catálogo', 'Meus empréstimos', 'Minhas reservas'])
    expect(screen.getByText('Ana Leitora')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    expect(screen.getByText('conteúdo')).toBeInTheDocument()
  })
})
