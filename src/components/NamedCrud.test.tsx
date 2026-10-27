import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthorsPage } from '../pages/AuthorsPage'
import { mockApi, pageOf } from '../test/mockApi'

const admin = vi.hoisted(() => ({ isAdmin: true }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => admin }))

const renderAuthors = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthorsPage />
    </QueryClientProvider>,
  )

describe('autores: homônimo', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    admin.isAdmin = true
  })

  it('pede confirmação no 422 e repete com allowDuplicate', async () => {
    const calls = mockApi({
      'POST /api/v1/authors': ({ body }) =>
        (body as { allowDuplicate?: boolean }).allowDuplicate
          ? { status: 201, json: { id: 2, name: 'Ana', active: true } }
          : { status: 422, json: { detail: 'Já existe um autor ativo com este nome.', existingAuthorId: 1 } },
    })
    renderAuthors()
    await userEvent.type(await screen.findByLabelText(/Nome/), 'Ana')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar autor' }))

    expect(await screen.findByText(/Já existe um autor ativo com este nome\./)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar mesmo assim' }))

    expect(await screen.findByText('Autor salvo.')).toBeInTheDocument()
    const posts = calls.filter((c) => c.key === 'POST /api/v1/authors')
    expect(posts.map((c) => (c.body as { allowDuplicate?: boolean }).allowDuplicate)).toEqual([false, true])
  })

  it('"Voltar" fecha a confirmação sem salvar de novo', async () => {
    const calls = mockApi({ 'POST /api/v1/authors': () => ({ status: 422, json: { detail: 'Nome repetido.', existingAuthorId: 1 } }) })
    renderAuthors()
    await userEvent.type(await screen.findByLabelText(/Nome/), 'Ana')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar autor' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Voltar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(calls.filter((c) => c.key === 'POST /api/v1/authors')).toHaveLength(1)
  })
})

describe('autores: reativação', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    admin.isAdmin = true
  })
  const inactive = pageOf([{ id: 5, name: 'Beto', active: false }])

  it('administrador reativa e o homônimo pede confirmação', async () => {
    const calls = mockApi({
      'GET /api/v1/authors': () => ({ json: inactive }),
      'POST /api/v1/authors/5/reactivate': ({ body }) =>
        (body as { allowDuplicate?: boolean }).allowDuplicate
          ? { json: { id: 5, name: 'Beto', active: true } }
          : { status: 422, json: { detail: 'Já existe um autor ativo com este nome.', existingAuthorId: 9 } },
    })
    renderAuthors()
    await userEvent.click(await screen.findByRole('button', { name: 'Inativos' }))
    await userEvent.click(await screen.findByRole('button', { name: /Reativar/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Reativar mesmo assim' }))
    const posts = calls.filter((c) => c.key === 'POST /api/v1/authors/5/reactivate')
    expect(posts.map((c) => (c.body as { allowDuplicate?: boolean }).allowDuplicate)).toEqual([false, true])
  })

  it('operador não vê o botão de reativar', async () => {
    admin.isAdmin = false
    mockApi({ 'GET /api/v1/authors': () => ({ json: inactive }) })
    renderAuthors()
    await userEvent.click(await screen.findByRole('button', { name: 'Inativos' }))
    expect(await screen.findByText('Beto')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reativar/ })).not.toBeInTheDocument()
  })
})
