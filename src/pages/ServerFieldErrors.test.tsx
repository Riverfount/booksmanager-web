import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AcceptInvitationPage } from './AcceptInvitationPage'
import { ConfigurationPage } from './ConfigurationPage'
import { ForgotPasswordPage } from './ForgotPasswordPage'
import { ReadersPage } from './ReadersPage'
import { ResetPasswordPage } from './ResetPasswordPage'
import { UsersPage } from './UsersPage'
import { mockApi } from '../test/mockApi'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ isAdmin: true, user: { id: 1, login: 'admin', role: 'ADMIN' } }) }))

const renderPage = (page: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  )

const renderAt = (path: string, route: string, element: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

const strong = 'Abcdef1!'
const badRequest = (errors: { field?: string; message: string }[]) => ({ status: 400, json: { detail: 'Dados inválidos.', errors } })

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

describe('configuração: erros de campo do servidor', () => {
  const config = {
    penaltyPolicy: 'BOTH', dailyFineAmount: 2.5, fineCap: 50, suspensionDaysPerDay: 1, suspensionCapDays: 30,
    loanPeriodDays: 14, loanLimit: 3, renewalLimit: 2, reservationPickupDays: 3, dueSoonNoticeDays: 2,
  }

  it('marca cada campo que a API recusou, sem banner', async () => {
    mockApi({
      'GET /api/v1/library-configuration': () => ({ json: config }),
      'PATCH /api/v1/library-configuration': () => badRequest([{ field: 'loanLimit', message: 'o limite de empréstimos é alto demais' }, { field: 'fineCap', message: 'o teto da multa é inválido' }]),
    })
    renderPage(<ConfigurationPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar configuração' }))
    expect(await screen.findByText('Corrija 2 campos para salvar a configuração.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Empréstimos simultâneos/)).toHaveAccessibleDescription('O limite de empréstimos é alto demais')
    expect(screen.getByLabelText(/^Teto da multa/)).toHaveAccessibleDescription('O teto da multa é inválido')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})

describe('telas públicas: erros de campo do servidor', () => {
  it('redefinição: marca a senha e deixa no banner o que não é campo do formulário', async () => {
    mockApi({
      'POST /api/v1/auth/reset-password': () => badRequest([{ field: 'password', message: 'a senha é fraca demais' }, { field: 'token', message: 'o token é obrigatório' }]),
    })
    renderAt('/redefinir-senha?token=tok-9', '/redefinir-senha', <ResetPasswordPage />)
    await userEvent.type(screen.getByLabelText(/^Nova senha/), strong)
    await userEvent.type(screen.getByLabelText(/^Repita a senha/), strong)
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))
    expect(await screen.findByText('Corrija 1 campo para alterar a senha.')).toBeInTheDocument()
    expect(screen.getByText('A senha é fraca demais')).toBeInTheDocument()
    expect(screen.getByText('o token é obrigatório')).toBeInTheDocument()
  })

  it('convite: marca o login, sem banner', async () => {
    mockApi({ 'POST /api/v1/auth/accept-invitation': () => badRequest([{ field: 'login', message: 'o login não pode ter espaços' }]) })
    renderAt('/convite?token=tok-123', '/convite', <AcceptInvitationPage />)
    await userEvent.type(screen.getByLabelText(/^Login/), 'ana')
    await userEvent.type(screen.getByLabelText(/^Senha/), strong)
    await userEvent.type(screen.getByLabelText(/^Repita a senha/), strong)
    await userEvent.click(screen.getByRole('button', { name: 'Criar acesso' }))
    expect(await screen.findByText('Corrija 1 campo para criar o acesso.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Login/)).toHaveAccessibleDescription(/O login não pode ter espaços/)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('esqueci a senha: marca o e-mail, sem banner', async () => {
    mockApi({ 'POST /api/v1/auth/forgot-password': () => badRequest([{ field: 'email', message: 'o e-mail é inválido' }]) })
    renderAt('/esqueci-senha', '/esqueci-senha', <ForgotPasswordPage />)
    await userEvent.type(screen.getByLabelText(/^E-mail/), 'ana@exemplo.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }))
    await waitFor(() => expect(screen.getByLabelText(/^E-mail/)).toHaveAccessibleDescription('O e-mail é inválido'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

