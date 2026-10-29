import { render, screen, waitFor, within } from '@testing-library/react'
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
    const filter = within(screen.getByLabelText('Filtrar por categoria').closest('fieldset')!)
    await userEvent.type(await screen.findByLabelText('Filtrar por categoria'), 'rom')
    await userEvent.click(await filter.findByRole('button', { name: 'Romance' }))
    await waitFor(() => {
      const q = calls.filter((c) => c.key === 'GET /api/v1/books').at(-1)!.url.searchParams
      expect(q.get('author')).toBe('machado')
      expect(q.get('categoryId')).toBe('3')
    })
    await userEvent.click(screen.getByRole('button', { name: 'Remover Romance' }))
    await waitFor(() => expect(calls.filter((c) => c.key === 'GET /api/v1/books').at(-1)!.url.searchParams.has('categoryId')).toBe(false))
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

describe('livros: categoria por busca', () => {
  const book = {
    id: 4, isbn: ISBN, title: 'Dom Casmurro', publisher: 'Garnier', publicationYear: 1899, active: true, availableCopies: 1, totalCopies: 1, categoryId: 3,
    category: { id: 3, name: 'Romance' }, authorIds: [7], authors: [{ id: 7, name: 'Machado de Assis' }],
  }
  const edit = async () => userEvent.click(await screen.findByRole('button', { name: 'Editar Dom Casmurro' }))
  const routes = (romanceActive: boolean) => ({
    'GET /api/v1/books': () => ({ json: pageOf([book]) }),
    'GET /api/v1/categories/3': () => ({ json: { id: 3, name: 'Romance', active: romanceActive } }),
    'GET /api/v1/categories': () => ({ json: pageOf([{ id: 5, name: 'Ficção', active: true }]) }),
    'PATCH /api/v1/books/4': () => ({ json: book }),
  })

  it('marca a categoria inativa do livro e a mantém ao salvar', async () => {
    const calls = mockApi(routes(false))
    renderBooks()
    await edit()
    expect(await screen.findByText('Romance (inativa)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar livro' }))
    await waitFor(() => expect(calls.find((c) => c.key === 'PATCH /api/v1/books/4')?.body).toMatchObject({ categoryId: 3 }))
  })

  it('não marca como inativa a categoria ativa', async () => {
    const calls = mockApi(routes(true))
    renderBooks()
    await edit()
    expect(await screen.findByRole('button', { name: 'Remover Romance' })).toBeInTheDocument()
    await waitFor(() => expect(calls.some((c) => c.key === 'GET /api/v1/categories/3')).toBe(true))
    expect(screen.queryByText(/inativa/)).not.toBeInTheDocument()
  })

  it('busca pelo nome e troca a categoria do livro', async () => {
    const calls = mockApi(routes(true))
    renderBooks()
    await edit()
    await userEvent.type(await screen.findByLabelText('Buscar categoria pelo nome'), 'fic')
    await userEvent.click(await screen.findByRole('button', { name: 'Ficção' }))
    expect(await screen.findByRole('button', { name: 'Remover Ficção' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar livro' }))
    await waitFor(() => expect(calls.find((c) => c.key === 'PATCH /api/v1/books/4')?.body).toMatchObject({ categoryId: 5 }))
    await waitFor(() => {
      const search = calls.filter((c) => c.key === 'GET /api/v1/categories').map((c) => c.url.searchParams).find((q) => q.get('name') === 'fic')
      expect(search?.get('active')).toBe('true')
      expect(search?.get('size')).toBe('5')
    })
  })

  it('exige a categoria no livro novo e não mostra seleção antes de escolher', async () => {
    mockApi({ 'GET /api/v1/categories': () => ({ json: pageOf([{ id: 5, name: 'Ficção', active: true }]) }) })
    renderBooks()
    expect(await screen.findByText('Nenhuma categoria selecionada.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar livro' }))
    expect((await screen.findAllByText('Selecione a categoria do livro.')).length).toBeGreaterThan(0)
  })
})

describe('livros: erros do servidor nos campos', () => {
  const routes = {
    'GET /api/v1/books/lookup': () => ({ json: { isbn: ISBN, outcome: 'NOT_FOUND', message: 'Nada encontrado.' } }),
    'GET /api/v1/categories': () => ({ json: pageOf([{ id: 3, name: 'Romance', active: true }]) }),
    'GET /api/v1/authors': () => ({ json: pageOf([{ id: 7, name: 'Machado de Assis', active: true }]) }),
  }
  const fillAndSave = async () => {
    await typeIsbn()
    await userEvent.type(screen.getByLabelText(/^Título/), 'Dom Casmurro')
    await userEvent.type(screen.getByLabelText(/^Editora/), 'Garnier')
    await userEvent.type(screen.getByLabelText(/^Ano/), '1899')
    await userEvent.type(screen.getByLabelText('Buscar categoria pelo nome'), 'rom')
    await userEvent.click(await within(screen.getByLabelText('Buscar categoria pelo nome').closest('fieldset')!).findByRole('button', { name: 'Romance' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Machado de Assis' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar livro' }))
  }

  it('ISBN duplicado (422) marca o campo do ISBN, sem banner', async () => {
    mockApi({ ...routes, 'POST /api/v1/books': () => ({ status: 422, json: { detail: `já existe um livro com o ISBN '${ISBN}'` } }) })
    renderBooks()
    await fillAndSave()
    expect(await screen.findByText('Corrija 1 campo para salvar o livro.')).toBeInTheDocument()
    const isbn = screen.getByLabelText(/^ISBN/)
    expect(isbn).toHaveAttribute('aria-invalid', 'true')
    expect(isbn).toHaveAccessibleDescription(new RegExp(`Já existe um livro com o ISBN '${ISBN}'`))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('400 com errors marca cada campo do formulário (publicationYear vira Ano)', async () => {
    mockApi({
      ...routes,
      'POST /api/v1/books': () => ({
        status: 400,
        json: { detail: 'Dados inválidos.', errors: [{ field: 'publicationYear', message: 'o ano de publicação é inválido' }, { field: 'publisher', message: 'a editora é inválida' }] },
      }),
    })
    renderBooks()
    await fillAndSave()
    expect(await screen.findByText('Corrija 2 campos para salvar o livro.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Ano/)).toHaveAccessibleDescription('O ano de publicação é inválido')
    expect(screen.getByLabelText(/^Editora/)).toHaveAccessibleDescription('A editora é inválida')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('erro que não é de campo continua no banner', async () => {
    mockApi({ ...routes, 'POST /api/v1/books': () => ({ status: 422, json: { detail: 'A categoria Romance está inativa.' } }) })
    renderBooks()
    await fillAndSave()
    expect(await screen.findByText('A categoria Romance está inativa.')).toBeInTheDocument()
    expect(screen.queryByText(/Corrija/)).not.toBeInTheDocument()
  })
})

describe('livros: painel de exemplares', () => {
  const book = {
    id: 4, isbn: ISBN, title: 'Dom Casmurro', publisher: 'Garnier', publicationYear: 1899, active: true, availableCopies: 2, totalCopies: 2, categoryId: 3,
    category: { id: 3, name: 'Romance' }, authorIds: [7], authors: [{ id: 7, name: 'Machado de Assis' }],
  }
  const copy = (id: number, assetCode: string, status = 'AVAILABLE') => ({ id, bookId: 4, assetCode, status, active: true })
  const copiesPage = (items: unknown[], page = 0, totalPages = 1) => ({ items, page, size: 20, totalItems: items.length, totalPages })
  const openPanel = async () => userEvent.click(await screen.findByRole('button', { name: 'Ver exemplares de Dom Casmurro' }))

  describe('confirmação de danificado e perdido', () => {
    const routes = () => ({
      'GET /api/v1/books': () => ({ json: pageOf([book]) }),
      'GET /api/v1/copies': () => ({ json: copiesPage([copy(11, 'PAT-0001')]) }),
      'PATCH /api/v1/copies/11': () => ({ json: copy(11, 'PAT-0001', 'DAMAGED') }),
    })

    it.each([
      ['Danificado', 'DAMAGED', /PAT-0001 fica indisponível para empréstimo/],
      ['Perdido', 'LOST', /PAT-0001 deixa de poder ser emprestado e passa a constar como perdido/],
    ])('%s pede confirmação antes de mudar o status', async (label, status, text) => {
      const calls = mockApi(routes())
      renderBooks()
      await openPanel()
      await userEvent.click(await screen.findByRole('button', { name: label }))
      const dialog = await screen.findByRole('dialog')
      expect(dialog).toHaveTextContent(text)
      expect(calls.some((c) => c.key === 'PATCH /api/v1/copies/11')).toBe(false)
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
      await waitFor(() => expect(calls.find((c) => c.key === 'PATCH /api/v1/copies/11')?.body).toEqual({ status }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('cancelar não muda o status', async () => {
      const calls = mockApi(routes())
      renderBooks()
      await openPanel()
      await userEvent.click(await screen.findByRole('button', { name: 'Perdido' }))
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(calls.some((c) => c.key === 'PATCH /api/v1/copies/11')).toBe(false)
    })

    it.each([['danificado', 'DAMAGED'], ['perdido', 'LOST']])('exemplar %s volta a disponível direto, sem confirmação', async (_label, status) => {
      const calls = mockApi({ ...routes(), 'GET /api/v1/copies': () => ({ json: copiesPage([copy(11, 'PAT-0001', status)]) }), 'PATCH /api/v1/copies/11': () => ({ json: copy(11, 'PAT-0001') }) })
      renderBooks()
      await openPanel()
      await userEvent.click(await screen.findByRole('button', { name: 'Voltou a disponível' }))
      await waitFor(() => expect(calls.find((c) => c.key === 'PATCH /api/v1/copies/11')?.body).toEqual({ status: 'AVAILABLE' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('o perdido não oferece "Perdido" nem "Danificado" de novo', async () => {
      mockApi({ ...routes(), 'GET /api/v1/copies': () => ({ json: copiesPage([copy(11, 'PAT-0001', 'LOST')]) }) })
      renderBooks()
      await openPanel()
      await screen.findByRole('button', { name: 'Voltou a disponível' })
      expect(screen.queryByRole('button', { name: 'Perdido' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Danificado' })).not.toBeInTheDocument()
    })

    it('o emprestado e o disponível não oferecem "Voltou a disponível"', async () => {
      mockApi({ ...routes(), 'GET /api/v1/copies': () => ({ json: copiesPage([copy(11, 'PAT-0001', 'AVAILABLE'), copy(12, 'PAT-0002', 'BORROWED')]) }) })
      renderBooks()
      await openPanel()
      await screen.findByText('PAT-0002')
      expect(screen.queryByRole('button', { name: 'Voltou a disponível' })).not.toBeInTheDocument()
    })
  })

  describe('paginação', () => {
    it('pagina a lista em vez de pedir 100 de uma vez', async () => {
      const calls = mockApi({
        'GET /api/v1/books': () => ({ json: pageOf([book]) }),
        'GET /api/v1/copies': ({ url }) =>
          url.searchParams.get('page') === '1'
            ? { json: copiesPage([copy(21, 'PAT-0021')], 1, 2) }
            : { json: copiesPage([copy(11, 'PAT-0011')], 0, 2) },
      })
      renderBooks()
      await openPanel()
      expect(await screen.findByText('PAT-0011')).toBeInTheDocument()
      expect(screen.getByText(/Página 1 de 2/)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Próxima' }))
      expect(await screen.findByText('PAT-0021')).toBeInTheDocument()
      expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument()
      const asked = calls.filter((c) => c.key === 'GET /api/v1/copies').map((c) => c.url.searchParams)
      expect(asked.every((q) => q.get('size') !== '100')).toBe(true)
      expect(asked.at(-1)!.get('page')).toBe('1')
    })

    it('volta à página anterior quando a página atual fica vazia', async () => {
      mockApi({
        'GET /api/v1/books': () => ({ json: pageOf([book]) }),
        'GET /api/v1/copies': ({ url }) =>
          url.searchParams.get('page') === '1' ? { json: copiesPage([], 1, 1) } : { json: copiesPage([copy(11, 'PAT-0011')], 0, 2) },
      })
      renderBooks()
      await openPanel()
      await userEvent.click(await screen.findByRole('button', { name: 'Próxima' }))
      expect(await screen.findByText('PAT-0011')).toBeInTheDocument()
      expect(await screen.findByText(/Página 1 de 2/)).toBeInTheDocument()
    })

    it('volta à primeira página ao trocar entre ativos e inativos', async () => {
      const calls = mockApi({
        'GET /api/v1/books': () => ({ json: pageOf([book]) }),
        'GET /api/v1/copies': ({ url }) => ({ json: copiesPage([copy(11, 'PAT-0011')], Number(url.searchParams.get('page') ?? 0), 2) }),
      })
      renderBooks()
      await openPanel()
      await userEvent.click(await screen.findByRole('button', { name: 'Próxima' }))
      await waitFor(() => expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument())
      const panel = within(screen.getByText(/Exemplares de/).closest('div')!.parentElement!)
      await userEvent.click(panel.getByRole('button', { name: 'Inativos' }))
      await waitFor(() => {
        const last = calls.filter((c) => c.key === 'GET /api/v1/copies').at(-1)!.url.searchParams
        expect(last.get('active')).toBe('false')
        expect(last.get('page') ?? '0').toBe('0')
      })
    })
  })

  it('o título do painel acompanha a edição do livro', async () => {
    let title = 'Dom Casmurro'
    mockApi({
      'GET /api/v1/books': () => ({ json: pageOf([{ ...book, title }]) }),
      'GET /api/v1/copies': () => ({ json: copiesPage([copy(11, 'PAT-0001')]) }),
      'PATCH /api/v1/books/4': () => {
        title = 'Memórias Póstumas'
        return { json: { ...book, title } }
      },
    })
    renderBooks()
    await openPanel()
    expect(await screen.findByText('Exemplares de “Dom Casmurro”')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Editar Dom Casmurro' }))
    const field = await screen.findByLabelText(/^Título/)
    await userEvent.clear(field)
    await userEvent.type(field, 'Memórias Póstumas')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar livro' }))
    expect(await screen.findByText('Exemplares de “Memórias Póstumas”')).toBeInTheDocument()
  })
})
