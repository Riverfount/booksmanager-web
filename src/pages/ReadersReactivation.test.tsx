import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ReadersPage } from './ReadersPage'
import { mockApi, pageOf } from '../test/mockApi'

const auth = vi.hoisted(() => ({ isAdmin: true }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))

const renderReaders = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ReadersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const inactive = { id: 9, name: 'Ana Leitora', maskedDocument: '***.456.789-**', email: 'ana@example.com', active: false, blocked: false }

afterEach(() => {
  vi.restoreAllMocks()
  auth.isAdmin = true
})

describe('reativação de leitor na lista', () => {
  it('administrador reativa o leitor inativo e a lista é recarregada', async () => {
    let active = false
    const calls = mockApi({
      'GET /api/v1/readers': ({ url }) => ({ json: pageOf(url.searchParams.get('active') === 'false' && !active ? [inactive] : []) }),
      'POST /api/v1/readers/9/reactivate': () => { active = true; return { json: { ...inactive, active: true } } },
    })
    renderReaders()
    await userEvent.click(await screen.findByRole('button', { name: 'Inativos' }))
    await userEvent.click(await screen.findByRole('button', { name: /Reativar\s*Ana Leitora/ }))
    expect(calls.some((c) => c.key === 'POST /api/v1/readers/9/reactivate')).toBe(true)
    await waitFor(() => expect(screen.queryByRole('button', { name: /Reativar\s*Ana Leitora/ })).not.toBeInTheDocument())
    expect(await screen.findByText('Nenhum leitor encontrado.')).toBeInTheDocument()
  })

  it('mostra a recusa da API', async () => {
    mockApi({
      'GET /api/v1/readers': () => ({ json: pageOf([inactive]) }),
      'POST /api/v1/readers/9/reactivate': () => ({ status: 403, json: { detail: 'Você não tem permissão para acessar este recurso.' } }),
    })
    renderReaders()
    await userEvent.click(await screen.findByRole('button', { name: 'Inativos' }))
    await userEvent.click(await screen.findByRole('button', { name: /Reativar\s*Ana Leitora/ }))
    expect(await screen.findByText('Você não tem permissão para acessar este recurso.')).toBeInTheDocument()
  })

  it('operador não vê o botão de reativar', async () => {
    auth.isAdmin = false
    mockApi({ 'GET /api/v1/readers': () => ({ json: pageOf([inactive]) }) })
    renderReaders()
    await userEvent.click(await screen.findByRole('button', { name: 'Inativos' }))
    expect(await screen.findByText('Ana Leitora')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reativar/ })).not.toBeInTheDocument()
  })
})
