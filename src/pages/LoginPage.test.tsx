import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import { LoginPage } from './LoginPage'

function renderLogin() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('mostra os erros dos campos vazios sem chamar a API de login', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }))
    renderLogin()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Informe o login.')).toBeInTheDocument()
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/auth/login'))).toBe(false)
  })

  it('mostra o aviso quando o login ou a senha estão errados', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }))
    renderLogin()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/Login/), 'maria')
    await userEvent.type(screen.getByLabelText(/Senha/), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Login ou senha inválidos.')).toBeInTheDocument()
  })

  it('mostra o aviso deixado por quem saiu da sessão, como a troca da própria senha', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }))
    function LeavesWithANotice() {
      const { signOut } = useAuth()
      return <button type="button" onClick={() => void signOut('Senha trocada. Entre de novo com a nova senha.')}>sair com aviso</button>
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <LeavesWithANotice />
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument())
    expect(screen.queryByText(/Senha trocada/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'sair com aviso' }))

    expect(await screen.findByText('Senha trocada. Entre de novo com a nova senha.')).toBeInTheDocument()
  })

  it('sem aviso, a tela de login não mostra nenhuma mensagem de sucesso', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }))
    renderLogin()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument())

    expect(screen.queryByText(/Senha trocada/)).not.toBeInTheDocument()
  })
})
