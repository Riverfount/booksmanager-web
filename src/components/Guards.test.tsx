import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { RequireReader, RequireStaff } from './Guards'

const auth = vi.hoisted(() => ({ role: 'OPERATOR' as 'ADMIN' | 'OPERATOR' | 'READER' }))
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: auth.role === 'ADMIN', state: { status: 'authenticated', user: { id: 1, login: 'x', role: auth.role } } }),
}))

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequireStaff />}>
          <Route path="/livros" element={<p>tela de operador</p>} />
          <Route path="/" element={<p>painel</p>} />
        </Route>
        <Route element={<RequireReader />}>
          <Route path="/meu" element={<p>área do leitor</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

describe('separação por perfil', () => {
  it.each(['ADMIN', 'OPERATOR'] as const)('%s entra nas telas de operador', (role) => {
    auth.role = role
    renderAt('/livros')
    expect(screen.getByText('tela de operador')).toBeInTheDocument()
  })

  it('leitor nas telas de operador vai para a área do leitor', () => {
    auth.role = 'READER'
    renderAt('/livros')
    expect(screen.getByText('área do leitor')).toBeInTheDocument()
    expect(screen.queryByText('tela de operador')).not.toBeInTheDocument()
  })

  it('leitor na raiz também vai para a área do leitor', () => {
    auth.role = 'READER'
    renderAt('/')
    expect(screen.getByText('área do leitor')).toBeInTheDocument()
  })

  it('leitor entra na própria área', () => {
    auth.role = 'READER'
    renderAt('/meu')
    expect(screen.getByText('área do leitor')).toBeInTheDocument()
  })

  it.each(['ADMIN', 'OPERATOR'] as const)('%s na área do leitor volta ao painel', (role) => {
    auth.role = role
    renderAt('/meu')
    expect(screen.getByText('painel')).toBeInTheDocument()
    expect(screen.queryByText('área do leitor')).not.toBeInTheDocument()
  })
})
