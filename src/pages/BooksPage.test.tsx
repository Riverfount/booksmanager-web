import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { BooksPage } from './BooksPage'
import { mockApi, pageOf } from '../test/mockApi'

const auth = vi.hoisted(() => ({ isAdmin: true }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))

const ISBN = '9788533302273'
const renderBooks = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <BooksPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const found = {
  isbn: ISBN,
  outcome: 'FOUND',
  message: 'Dados sugeridos pela fonte externa.',
  suggestion: { title: 'Dom Casmurro', publisher: 'Garnier', publicationYear: 1899, authors: [{ name: 'Machado de Assis', existingAuthorId: 7 }, { name: 'Fulano' }] },
}
const typeIsbn = async () => {
  await userEvent.type(await screen.findByLabelText(/^ISBN/), ISBN)
  await userEvent.tab()
}

afterEach(() => {
  vi.restoreAllMocks()
  auth.isAdmin = true
})

describe('livros: lookup de ISBN', () => {
  it('pré-preenche o formulário e seleciona o autor que já existe', async () => {
    mockApi({ 'GET /api/v1/books/lookup': () => ({ json: found }) })
    renderBooks()
    await typeIsbn()
    expect(await screen.findByDisplayValue('Dom Casmurro')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Garnier')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1899')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover Machado de Assis' })).toBeInTheDocument()
    expect(screen.getByText('Dados sugeridos pela fonte externa.')).toBeInTheDocument()
  })

  it('não sobrescreve o que o operador já digitou', async () => {
    mockApi({ 'GET /api/v1/books/lookup': () => ({ json: found }) })
    renderBooks()
    await userEvent.type(await screen.findByLabelText(/^Título/), 'Meu título')
    await typeIsbn()
    expect(await screen.findByDisplayValue('Garnier')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Meu título')).toBeInTheDocument()
  })

  it('cadastra e seleciona o autor sugerido que ainda não existe', async () => {
    const calls = mockApi({
      'GET /api/v1/books/lookup': () => ({ json: found }),
      'POST /api/v1/authors': () => ({ status: 201, json: { id: 31, name: 'Fulano', active: true } }),
    })
    renderBooks()
    await typeIsbn()
    await userEvent.click(await screen.findByRole('button', { name: /Cadastrar e selecionar/ }))
    expect(await screen.findByRole('button', { name: 'Remover Fulano' })).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/authors')?.body).toEqual({ name: 'Fulano' })
  })

  describe('vários autores sugeridos que ainda não existem', () => {
    const many = {
      ...found,
      suggestion: { ...found.suggestion, authors: [{ name: 'Machado de Assis', existingAuthorId: 7 }, { name: 'Fulano' }, { name: 'Beltrano' }] },
    }

    it('cadastra e seleciona todos de uma vez', async () => {
      let next = 30
      const calls = mockApi({
        'GET /api/v1/books/lookup': () => ({ json: many }),
        'POST /api/v1/authors': ({ body }) => ({ status: 201, json: { id: ++next, name: (body as { name: string }).name, active: true } }),
      })
      renderBooks()
      await typeIsbn()
      await userEvent.click(await screen.findByRole('button', { name: 'Cadastrar todos e selecionar' }))
      expect(await screen.findByRole('button', { name: 'Remover Fulano' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Remover Beltrano' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Remover Machado de Assis' })).toBeInTheDocument()
      expect(calls.filter((c) => c.key === 'POST /api/v1/authors').map((c) => c.body)).toEqual([{ name: 'Fulano' }, { name: 'Beltrano' }])
      expect(screen.queryByText(/ainda não estão no acervo/)).not.toBeInTheDocument()
    })

    it('usa o autor que já existe quando o nome é homônimo (422), sem forçar duplicidade', async () => {
      const calls = mockApi({
        'GET /api/v1/books/lookup': () => ({ json: many }),
        'POST /api/v1/authors': ({ body }) =>
          (body as { name: string }).name === 'Fulano'
            ? { status: 422, json: { detail: 'Já existe um autor com este nome.', existingAuthorId: 12 } }
            : { status: 201, json: { id: 31, name: 'Beltrano', active: true } },
      })
      renderBooks()
      await typeIsbn()
      await userEvent.click(await screen.findByRole('button', { name: 'Cadastrar todos e selecionar' }))
      expect(await screen.findByRole('button', { name: 'Remover Fulano' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Remover Beltrano' })).toBeInTheDocument()
      expect(calls.some((c) => (c.body as { allowDuplicate?: boolean } | undefined)?.allowDuplicate)).toBe(false)
    })

    it('mantém os que deram certo e mostra o erro do que falhou', async () => {
      mockApi({
        'GET /api/v1/books/lookup': () => ({ json: many }),
        'POST /api/v1/authors': ({ body }) =>
          (body as { name: string }).name === 'Fulano'
            ? { status: 201, json: { id: 30, name: 'Fulano', active: true } }
            : { status: 500, json: { detail: 'Falha ao cadastrar.' } },
      })
      renderBooks()
      await typeIsbn()
      await userEvent.click(await screen.findByRole('button', { name: 'Cadastrar todos e selecionar' }))
      expect(await screen.findByRole('button', { name: 'Remover Fulano' })).toBeInTheDocument()
      expect(await screen.findByText(/Falha ao cadastrar/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Cadastrar e selecionar.*Beltrano/ })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Remover Beltrano' })).not.toBeInTheDocument()
    })

    it('não oferece o botão em lote quando falta só um autor', async () => {
      mockApi({ 'GET /api/v1/books/lookup': () => ({ json: found }) })
      renderBooks()
      await typeIsbn()
      await screen.findByRole('button', { name: /Cadastrar e selecionar/ })
      expect(screen.queryByRole('button', { name: 'Cadastrar todos e selecionar' })).not.toBeInTheDocument()
    })
  })

  it('avisa do ISBN já cadastrado e filtra a lista pelo livro', async () => {
    const calls = mockApi({
      'GET /api/v1/books/lookup': () => ({ json: { isbn: ISBN, outcome: 'ALREADY_REGISTERED', message: 'Este ISBN já está cadastrado.', registeredBookId: 4 } }),
      'GET /api/v1/books/4': () => ({ json: { id: 4, isbn: ISBN, title: 'Dom Casmurro', active: false } }),
    })
    renderBooks()
    await typeIsbn()
    expect(await screen.findByText('Este ISBN já está cadastrado.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver livro já cadastrado' }))
    expect(await screen.findByLabelText('Filtrar por ISBN')).toHaveValue(ISBN)
    await waitFor(() => {
      const last = calls.filter((c) => c.key === 'GET /api/v1/books').at(-1)!
      expect(last.url.searchParams.get('isbn')).toBe(ISBN)
      expect(last.url.searchParams.get('active')).toBe('false')
    })
  })

  it('NOT_FOUND mostra o aviso e deixa o cadastro manual', async () => {
    mockApi({ 'GET /api/v1/books/lookup': () => ({ json: { isbn: ISBN, outcome: 'NOT_FOUND', message: 'Nada encontrado. Cadastre à mão.' } }) })
    renderBooks()
    await typeIsbn()
    expect(await screen.findByText('Nada encontrado. Cadastre à mão.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Título/)).toHaveValue('')
  })

  it('falha na consulta não impede o cadastro', async () => {
    mockApi({ 'GET /api/v1/books/lookup': () => ({ status: 503, json: { detail: 'fora do ar' } }) })
    renderBooks()
    await typeIsbn()
    expect(await screen.findByText(/Preencha os dados à mão/)).toBeInTheDocument()
  })

  it('ISBN inválido não consulta a API', async () => {
    const calls = mockApi({})
    renderBooks()
    await userEvent.type(await screen.findByLabelText(/^ISBN/), '9788533302274')
    await userEvent.tab()
    expect(calls.some((c) => c.key === 'GET /api/v1/books/lookup')).toBe(false)
  })
})

describe('livros: filtros e reativação', () => {
  it('envia autor, ISBN e categoria na busca', async () => {
    const calls = mockApi({ 'GET /api/v1/categories': () => ({ json: pageOf([{ id: 3, name: 'Romance', active: true }]) }) })
    renderBooks()
    await userEvent.type(await screen.findByLabelText('Filtrar por autor'), 'machado')
    await userEvent.selectOptions(await screen.findByLabelText('Filtrar por categoria'), 'Romance')
    await waitFor(() => {
      const q = calls.filter((c) => c.key === 'GET /api/v1/books').at(-1)!.url.searchParams
      expect(q.get('author')).toBe('machado')
      expect(q.get('categoryId')).toBe('3')
    })
  })

  const inactiveBook = {
    id: 4, isbn: ISBN, title: 'Dom Casmurro', active: false, availableCopies: 0, totalCopies: 0, categoryId: 3, authorIds: [7],
    category: { id: 3, name: 'Romance' }, authors: [{ id: 7, name: 'Machado de Assis' }],
  }

  it('administrador reativa o livro e vê a recusa da API', async () => {
    mockApi({
      'GET /api/v1/books': () => ({ json: pageOf([inactiveBook]) }),
      'POST /api/v1/books/4/reactivate': () => ({ status: 422, json: { detail: 'A categoria Romance está inativa.' } }),
    })
    renderBooks()
    await userEvent.click(await screen.findByRole('button', { name: 'Inativos' }))
    await userEvent.click(await screen.findByRole('button', { name: /Reativar/ }))
    expect(await screen.findByText('A categoria Romance está inativa.')).toBeInTheDocument()
  })

  it('operador não vê o botão de reativar', async () => {
    auth.isAdmin = false
    mockApi({ 'GET /api/v1/books': () => ({ json: pageOf([inactiveBook]) }) })
    renderBooks()
    await userEvent.click(await screen.findByRole('button', { name: 'Inativos' }))
    expect(await screen.findByText('Dom Casmurro')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reativar/ })).not.toBeInTheDocument()
  })
})

describe('livros: categoria na edição', () => {
  const book = {
    id: 4, isbn: ISBN, title: 'Dom Casmurro', publisher: 'Garnier', publicationYear: 1899, active: true, availableCopies: 1, totalCopies: 1, categoryId: 3,
    category: { id: 3, name: 'Romance' }, authorIds: [7], authors: [{ id: 7, name: 'Machado de Assis' }],
  }
  const edit = async () => userEvent.click(await screen.findByRole('button', { name: 'Editar Dom Casmurro' }))

  it('mostra a categoria inativa do livro, marcada, e a mantém selecionada', async () => {
    const calls = mockApi({
      'GET /api/v1/books': () => ({ json: pageOf([book]) }),
      'GET /api/v1/categories': () => ({ json: pageOf([{ id: 5, name: 'Ficção', active: true }]) }),
      'PATCH /api/v1/books/4': () => ({ json: book }),
    })
    renderBooks()
    await edit()
    const select = await screen.findByLabelText(/^Categoria/)
    expect(await screen.findByRole('option', { name: 'Romance (inativa)' })).toBeInTheDocument()
    expect(select).toHaveValue('3')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar livro' }))
    await waitFor(() => expect(calls.find((c) => c.key === 'PATCH /api/v1/books/4')?.body).toMatchObject({ categoryId: 3 }))
  })

  it('não marca como inativa a categoria que está na lista de ativas', async () => {
    mockApi({
      'GET /api/v1/books': () => ({ json: pageOf([book]) }),
      'GET /api/v1/categories': () => ({ json: pageOf([{ id: 3, name: 'Romance', active: true }]) }),
    })
    renderBooks()
    await edit()
    const select = await screen.findByLabelText(/^Categoria/)
    await waitFor(() => expect(select).toHaveValue('3'))
    expect(screen.queryByRole('option', { name: /inativa/ })).not.toBeInTheDocument()
  })

  it('no cadastro de livro novo, não aparece opção de categoria inativa', async () => {
    mockApi({ 'GET /api/v1/categories': () => ({ json: pageOf([{ id: 5, name: 'Ficção', active: true }]) }) })
    renderBooks()
    expect(await screen.findAllByRole('option', { name: 'Ficção' })).toHaveLength(2)
    expect(screen.queryByRole('option', { name: /inativa/ })).not.toBeInTheDocument()
  })
})
