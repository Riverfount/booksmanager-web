import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ReadersPage } from './ReadersPage'
import { UsersPage } from './UsersPage'
import { mockApi } from '../test/mockApi'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ isAdmin: true, user: { id: 1, login: 'admin', role: 'ADMIN' } }) }))

const renderPage = (page: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  )

afterEach(() => vi.restoreAllMocks())

describe('leitores: erros de campo do servidor', () => {
  it('guardian.email do 400 marca o campo E-mail do responsável, sem banner', async () => {
    mockApi({
      'POST /api/v1/readers': () => ({ status: 400, json: { detail: 'Dados inválidos.', errors: [{ field: 'guardian.email', message: 'o e-mail do responsável é inválido' }] } }),
    })
    renderPage(<ReadersPage />)
    await userEvent.type((await screen.findAllByLabelText(/^Nome/))[0], 'Ana Leitora')
    await userEvent.type(screen.getByLabelText(/^Documento/), '12345678900')
    await userEvent.type(screen.getAllByLabelText(/^E-mail/)[0], 'ana@example.com')
    fireEvent.change(screen.getByLabelText(/^Nascimento/), { target: { value: '1990-05-20' } })
    await userEvent.type(screen.getByLabelText(/^Nome do responsável/), 'Beto Responsável')
    await userEvent.type(screen.getByLabelText(/^E-mail do responsável/), 'beto@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar leitor' }))
    expect(await screen.findByText('Corrija 1 campo para salvar o leitor.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^E-mail do responsável/)).toHaveAccessibleDescription('O e-mail do responsável é inválido')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})

describe('usuários: erros de campo do servidor', () => {
  it('login do 400 marca o campo Login, sem banner', async () => {
    mockApi({
      'POST /api/v1/users': () => ({ status: 400, json: { detail: 'Dados inválidos.', errors: [{ field: 'login', message: 'o login não pode ter espaços' }] } }),
    })
    renderPage(<UsersPage />)
    await userEvent.type(await screen.findByLabelText(/^Login/), 'maria')
    await userEvent.click(screen.getByLabelText(/Operador/))
    await userEvent.type(screen.getByLabelText(/^Senha/), 'Abcdef1!')
    await userEvent.click(screen.getByRole('button', { name: /^Criar usuário|^Salvar usuário/ }))
    expect(await screen.findByText('Corrija 1 campo para criar o usuário.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Login/)).toHaveAccessibleDescription(/O login não pode ter espaços/)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})
