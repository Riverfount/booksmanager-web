import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { Layout } from './Layout'

const auth = vi.hoisted(() => ({ isAdmin: false, signOut: vi.fn(), state: { status: 'authenticated', user: { id: 7, login: 'maria', displayName: 'Maria Souza', role: 'OPERATOR' } } }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))

const renderLayout = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<p>conteúdo</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )

afterEach(() => { auth.signOut.mockClear(); auth.isAdmin = false; auth.state.user.role = 'OPERATOR' })

describe('layout da equipe: alterar a própria senha', () => {
  it.each([['operador', false, 'OPERATOR'], ['administrador', true, 'ADMIN']])('o %s tem "Alterar senha" no cartão do usuário, junto de "Sair"', (_label, isAdmin, role) => {
    auth.isAdmin = isAdmin
    auth.state.user.role = role
    renderLayout()

    expect(screen.getByRole('button', { name: 'Alterar senha' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })

  it('abre o diálogo de troca de senha e não sai da sessão por isso', async () => {
    renderLayout()

    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Alterar senha')
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('fechar o diálogo volta à tela, sem sair da sessão', async () => {
    renderLayout()
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(auth.signOut).not.toHaveBeenCalled()
  })
})
