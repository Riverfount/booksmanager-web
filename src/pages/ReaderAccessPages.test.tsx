import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AcceptInvitationPage } from './AcceptInvitationPage'
import { ForgotPasswordPage } from './ForgotPasswordPage'
import { ReaderDetailPage } from './ReaderDetailPage'
import { ResetPasswordPage } from './ResetPasswordPage'
import { mockApi, pageOf } from '../test/mockApi'

const strong = 'Abcdef1!'
const renderAt = (path: string, route: string, element: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={element} />
          <Route path="/login" element={<p>tela de entrada</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

afterEach(() => vi.restoreAllMocks())

describe('convite de acesso', () => {
  const open = () => renderAt('/convite?token=tok-123', '/convite', <AcceptInvitationPage />)
  const fill = async (login: string, password = strong, confirm = strong) => {
    await userEvent.type(screen.getByLabelText(/^Login/), login)
    await userEvent.type(screen.getByLabelText(/^Senha/), password)
    await userEvent.type(screen.getByLabelText(/^Repita a senha/), confirm)
    await userEvent.click(screen.getByRole('button', { name: 'Criar acesso' }))
  }

  it('envia token, login e senha e confirma o acesso', async () => {
    const calls = mockApi({ 'POST /api/v1/auth/accept-invitation': () => ({ status: 204 }) })
    open()
    await fill('Ana.Leitora')
    expect(await screen.findByText('Acesso criado')).toBeInTheDocument()
    expect(screen.getByText('ana.leitora')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/auth/accept-invitation')?.body).toEqual({ token: 'tok-123', login: 'Ana.Leitora', password: strong })
  })

  it('login já usado: mostra a recusa e mantém o formulário', async () => {
    mockApi({ 'POST /api/v1/auth/accept-invitation': () => ({ status: 422, json: { detail: 'Este login já está em uso.' } }) })
    open()
    await fill('ana')
    expect(await screen.findByText('Este login já está em uso.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Login/)).toHaveValue('ana')
  })

  it('senhas diferentes não chamam a API', async () => {
    const calls = mockApi({})
    open()
    await fill('ana', strong, 'Outra123!')
    expect(await screen.findAllByText(/As senhas não são iguais/)).not.toHaveLength(0)
    expect(calls.some((c) => c.key === 'POST /api/v1/auth/accept-invitation')).toBe(false)
  })

  it('sem token mostra link inválido', () => {
    renderAt('/convite', '/convite', <AcceptInvitationPage />)
    expect(screen.getByText('Link inválido')).toBeInTheDocument()
  })
})

describe('redefinição de senha', () => {
  const open = () => renderAt('/redefinir-senha?token=tok-9', '/redefinir-senha', <ResetPasswordPage />)

  it('troca a senha com o token do link', async () => {
    const calls = mockApi({ 'POST /api/v1/auth/reset-password': () => ({ status: 204 }) })
    open()
    await userEvent.type(screen.getByLabelText(/^Nova senha/), strong)
    await userEvent.type(screen.getByLabelText(/^Repita a senha/), strong)
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))
    expect(await screen.findByText('Senha alterada')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/auth/reset-password')?.body).toEqual({ token: 'tok-9', password: strong })
  })

  it('link vencido: mostra a recusa da API', async () => {
    mockApi({ 'POST /api/v1/auth/reset-password': () => ({ status: 422, json: { detail: 'Link inválido ou expirado.' } }) })
    open()
    await userEvent.type(screen.getByLabelText(/^Nova senha/), strong)
    await userEvent.type(screen.getByLabelText(/^Repita a senha/), strong)
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))
    expect(await screen.findByText('Link inválido ou expirado.')).toBeInTheDocument()
  })

  it('senha fraca não chama a API', async () => {
    const calls = mockApi({})
    open()
    await userEvent.type(screen.getByLabelText(/^Nova senha/), 'fraca')
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))
    expect(await screen.findAllByText(/não atende às regras/)).not.toHaveLength(0)
    expect(calls.some((c) => c.key === 'POST /api/v1/auth/reset-password')).toBe(false)
  })
})

describe('esqueci a senha', () => {
  it('mostra sempre a mesma resposta, sem dizer se o e-mail existe', async () => {
    const calls = mockApi({ 'POST /api/v1/auth/forgot-password': () => ({ status: 204 }) })
    renderAt('/esqueci-senha', '/esqueci-senha', <ForgotPasswordPage />)
    await userEvent.type(screen.getByLabelText(/^E-mail/), 'ana@exemplo.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }))
    expect(await screen.findByText(/Se este e-mail for de um leitor com acesso/)).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/auth/forgot-password')?.body).toEqual({ email: 'ana@exemplo.com' })
  })

  it('e-mail inválido não chama a API', async () => {
    const calls = mockApi({})
    renderAt('/esqueci-senha', '/esqueci-senha', <ForgotPasswordPage />)
    await userEvent.type(screen.getByLabelText(/^E-mail/), 'ana@')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }))
    expect(await screen.findByText(/E-mail inválido/)).toBeInTheDocument()
    expect(calls.some((c) => c.key === 'POST /api/v1/auth/forgot-password')).toBe(false)
  })
})

describe('acesso do leitor no detalhe', () => {
  const reader = (active = true) => ({ id: 5, name: 'Ana', document: '123', email: 'ana@exemplo.com', birthDate: '1990-01-01', active, blocked: false })
  const routes = (active = true) => ({
    'GET /api/v1/readers/5': () => ({ json: reader(active) }),
    'GET /api/v1/loans': () => ({ json: pageOf([]) }),
  })
  const open = () => renderAt('/leitores/5', '/leitores/:id', <ReaderDetailPage />)

  it('convida e mostra até quando o link vale', async () => {
    const calls = mockApi({ ...routes(), 'POST /api/v1/readers/5/access-invitations': () => ({ status: 202, json: { readerId: 5, expiresAt: '2026-11-04T15:30:00Z' } }) })
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Convidar para acessar o sistema' }))
    expect(await screen.findByText(/Convite enviado para ana@exemplo.com/)).toBeInTheDocument()
    expect(calls.some((c) => c.key === 'POST /api/v1/readers/5/access-invitations')).toBe(true)
  })

  it('leitor que já tem acesso: mostra a recusa da API', async () => {
    mockApi({ ...routes(), 'POST /api/v1/readers/5/access-invitations': () => ({ status: 422, json: { detail: 'O leitor já tem acesso ao sistema.' } }) })
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Convidar para acessar o sistema' }))
    expect(await screen.findByText('O leitor já tem acesso ao sistema.')).toBeInTheDocument()
  })

  it('leitor inativo não pode ser convidado', async () => {
    mockApi(routes(false))
    open()
    expect(await screen.findByRole('button', { name: 'Convidar para acessar o sistema' })).toBeDisabled()
  })

  it('revoga só depois de confirmar', async () => {
    const calls = mockApi({ ...routes(), 'DELETE /api/v1/readers/5/access': () => ({ status: 204 }) })
    open()
    await userEvent.click(await screen.findByRole('button', { name: 'Revogar acesso' }))
    expect(calls.some((c) => c.key === 'DELETE /api/v1/readers/5/access')).toBe(false)
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revogar acesso' }))
    expect(await screen.findByText(/Acesso revogado/)).toBeInTheDocument()
  })
})
