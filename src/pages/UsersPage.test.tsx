import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { UsersPage } from './UsersPage'
import { mockApi, pageOf } from '../test/mockApi'

const user = (id: number, login: string, role: 'ADMIN' | 'OPERATOR' | 'READER', active: boolean) =>
  ({ id, login, displayName: null, role, active, blocked: false, blockedUntil: null })

const renderUsers = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

/** The list the API would answer: the active tab asks for active=true, the inactive one for active=false. */
const listOf = (all: ReturnType<typeof user>[]) => ({ url }: { url: URL }) => ({
  json: pageOf(all.filter((u) => u.active === (url.searchParams.get('active') === 'true'))),
})

const openInactive = async () => userEvent.click(await screen.findByRole('button', { name: 'Inativos' }))

afterEach(() => vi.restoreAllMocks())

describe('usuários: reativação', () => {
  const everyone = () => [
    user(1, 'chefe', 'ADMIN', true),
    user(5, 'maria', 'OPERATOR', false),
    user(6, 'outro', 'ADMIN', false),
    user(8, 'ana', 'READER', false),
  ]

  it('oferece "Reativar" ao administrador e ao operador inativos, e não ao acesso de leitor', async () => {
    mockApi({ 'GET /api/v1/users': listOf(everyone()) })
    renderUsers()
    await openInactive()

    expect(await screen.findByRole('button', { name: 'Reativar maria' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reativar outro' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reativar ana' })).not.toBeInTheDocument()
  })

  it('avisa que o acesso do leitor é reaberto por novo convite', async () => {
    mockApi({ 'GET /api/v1/users': listOf(everyone()) })
    renderUsers()
    await openInactive()

    const row = (await screen.findByText('ana')).closest('[role="row"]') as HTMLElement
    expect(within(row).getByText(/novo convite/i)).toBeInTheDocument()
  })

  it('não oferece "Reativar" na aba dos ativos, que mantém as ações de sempre', async () => {
    mockApi({ 'GET /api/v1/users': listOf(everyone()) })
    renderUsers()

    expect(await screen.findByRole('button', { name: 'Inativar chefe' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar chefe' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Redefinir senha de chefe' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Reativar/ })).not.toBeInTheDocument()
  })

  it('reativa o usuário certo e atualiza a lista, sem pedir confirmação', async () => {
    const users = everyone()
    const calls = mockApi({
      'GET /api/v1/users': listOf(users),
      'POST /api/v1/users/5/reactivate': () => {
        users[1] = user(5, 'maria', 'OPERATOR', true)
        return { json: users[1] }
      },
    })
    renderUsers()
    await openInactive()

    await userEvent.click(await screen.findByRole('button', { name: 'Reativar maria' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reativar maria' })).not.toBeInTheDocument())
    expect(calls.filter((c) => c.key === 'POST /api/v1/users/5/reactivate')).toHaveLength(1)
    expect(calls.filter((c) => c.key === 'GET /api/v1/users').length).toBeGreaterThanOrEqual(3)
    expect(screen.getByRole('button', { name: 'Reativar outro' })).toBeInTheDocument()
  })

  it('o usuário reativado passa a aparecer na aba dos ativos', async () => {
    const users = everyone()
    mockApi({
      'GET /api/v1/users': listOf(users),
      'POST /api/v1/users/5/reactivate': () => {
        users[1] = user(5, 'maria', 'OPERATOR', true)
        return { json: users[1] }
      },
    })
    renderUsers()
    await openInactive()
    await userEvent.click(await screen.findByRole('button', { name: 'Reativar maria' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reativar maria' })).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Ativos' }))

    expect(await screen.findByRole('button', { name: 'Inativar maria' })).toBeInTheDocument()
  })

  it('mostra a recusa da API e não muda nada na tela', async () => {
    mockApi({
      'GET /api/v1/users': listOf(everyone()),
      'POST /api/v1/users/5/reactivate': () => ({ status: 422, json: { detail: 'o acesso do leitor é reaberto por um novo convite' } }),
    })
    renderUsers()
    await openInactive()

    await userEvent.click(await screen.findByRole('button', { name: 'Reativar maria' }))

    expect(await screen.findByText('o acesso do leitor é reaberto por um novo convite')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reativar maria' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reativar outro' })).toBeInTheDocument()
  })
})
