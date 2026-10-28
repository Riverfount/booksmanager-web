import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { AuthorsPage } from './AuthorsPage'
import { BooksPage } from './BooksPage'
import { CategoriesPage } from './CategoriesPage'
import { ReadersPage } from './ReadersPage'
import { mockApi, pageOf } from '../test/mockApi'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ isAdmin: true }) }))

const renderPage = (page: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  )

const openDialog = async (name: string) => {
  await userEvent.click(await screen.findByRole('button', { name: `Inativar ${name}` }))
  return screen.findByRole('dialog')
}

afterEach(() => vi.restoreAllMocks())

describe('textos do diálogo de inativação', () => {
  it('livro: não promete bloqueio por empréstimo e diz quem reativa', async () => {
    mockApi({
      'GET /api/v1/books': () => ({
        json: pageOf([{ id: 4, isbn: '9788533302273', title: 'Dom Casmurro', active: true, availableCopies: 1, totalCopies: 1, categoryId: 3, authorIds: [7], category: { id: 3, name: 'Romance' }, authors: [{ id: 7, name: 'Machado de Assis' }] }]),
      }),
    })
    renderPage(<BooksPage />)
    const dialog = await openDialog('Dom Casmurro')
    expect(dialog).not.toHaveTextContent(/não podem ser inativados/)
    expect(dialog).toHaveTextContent(/Só um administrador pode reativar o livro\./)
  })

  it('autor: diz que os livros mantêm o autor e que ele não vale para livros novos', async () => {
    mockApi({ 'GET /api/v1/authors': () => ({ json: pageOf([{ id: 7, name: 'Machado de Assis', active: true }]) }) })
    renderPage(<AuthorsPage />)
    const dialog = await openDialog('Machado de Assis')
    expect(dialog).not.toHaveTextContent(/Não é possível inativar/)
    expect(dialog).toHaveTextContent(/não pode ser usado em livros novos/)
    expect(dialog).toHaveTextContent(/os livros que já o têm continuam com ele/)
    expect(dialog).toHaveTextContent(/Só um administrador pode reativar o autor\./)
  })

  it('categoria: concorda no feminino', async () => {
    mockApi({ 'GET /api/v1/categories': () => ({ json: pageOf([{ id: 3, name: 'Romance', active: true }]) }) })
    renderPage(<CategoriesPage />)
    const dialog = await openDialog('Romance')
    expect(dialog).not.toHaveTextContent(/Não é possível inativar/)
    expect(dialog).toHaveTextContent(/não pode ser usada em livros novos/)
    expect(dialog).toHaveTextContent(/os livros que já a têm continuam com ela/)
    expect(dialog).toHaveTextContent(/Só um administrador pode reativar a categoria\./)
  })

  it('leitor: não promete bloqueio por empréstimo, avisa do acesso e que não há reativação', async () => {
    mockApi({
      'GET /api/v1/readers': () => ({
        json: pageOf([{ id: 9, name: 'Ana Leitora', maskedDocument: '***.456.789-**', email: 'ana@example.com', active: true, blocked: false }]),
      }),
    })
    renderPage(<ReadersPage />)
    const dialog = await openDialog('Ana Leitora')
    expect(dialog).not.toHaveTextContent(/não podem ser inativados/)
    expect(dialog).toHaveTextContent(/perde o acesso ao sistema/)
    expect(dialog).toHaveTextContent(/Não é possível reativar um leitor\./)
  })
})
