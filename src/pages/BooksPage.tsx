import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { api, call, errorMessage, existingAuthorId } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { Book } from '../api/types'
import { AuthorPicker, type AuthorChip } from '../components/AuthorPicker'
import { CategoryPicker, type CategoryChoice } from '../components/CategoryPicker'
import { CopyStatusBadge } from '../components/copyStatus'
import { Icon } from '../components/Icon'
import { Badge, Banner, Button, Card, DataTable, Dialog, EmptyState, ErrorSummary, FormCard, IconButton, PageHeader, Pagination, Pills, RequiredNote, SearchInput, Spinner, TextField } from '../components/ui'
import { errorItems, errorTitle, fid } from '../lib/form'
import { maskIsbn, maskYear } from '../lib/masks'
import { suggestionToForm } from '../lib/lookup'
import { bookSchema, bookSchemaFor, copySchema, isbnValid } from '../lib/schemas'
import { useDebounced } from '../lib/useDebounced'

type LookupState = { kind: 'FOUND' | 'NOT_FOUND' | 'ALREADY_REGISTERED' | 'FAILED'; message: string; registeredBookId?: number; unknownAuthors: string[] }

type Values = z.infer<typeof bookSchema>
const empty: Values = { isbn: '', title: '', publisher: '', year: '', categoryId: '', authorIds: [] }

export function BooksPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<'true' | 'false'>('true')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Book | null>(null)
  const [chosen, setChosen] = useState<AuthorChip[]>([])
  const [selected, setSelected] = useState<Book | null>(null)
  const [removing, setRemoving] = useState<Book | null>(null)
  const [done, setDone] = useState(false)
  const [authorFilter, setAuthorFilter] = useState('')
  const [isbnFilter, setIsbnFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryChoice | null>(null)
  const [category, setCategory] = useState<CategoryChoice | null>(null)
  const [lookup, setLookup] = useState<LookupState | null>(null)
  const { isAdmin } = useAuth()
  const title = useDebounced(search.trim())
  const author = useDebounced(authorFilter.trim())
  const isbn = useDebounced(isbnFilter.trim())

  const books = useQuery({
    queryKey: ['books', title, author, isbn, categoryFilter?.id, active, page],
    queryFn: () => call(api.GET('/api/v1/books', {
      params: { query: { title: title || undefined, author: author || undefined, isbn: isbn || undefined, categoryId: categoryFilter?.id, active: active === 'true', page } },
    })),
  })

  const form = useForm<Values>({ resolver: zodResolver(editing ? bookSchemaFor({ publisher: !editing.publisher, year: !editing.publicationYear }) : bookSchema), defaultValues: empty })
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitted } } = form

  const refresh = () => qc.invalidateQueries({ queryKey: ['books'] })
  const save = useMutation({
    mutationFn: (v: Values) => {
      if (editing) {
        const publicationYear = v.year ? Number(v.year) : undefined
        const publisher = v.publisher || undefined
        return call(api.PATCH('/api/v1/books/{id}', {
          params: { path: { id: editing.id } },
          body: { title: v.title, publisher, publicationYear, categoryId: Number(v.categoryId), authorIds: v.authorIds },
        }))
      }
      return call(api.POST('/api/v1/books', {
        body: { isbn: v.isbn.replace(/[\s-]/g, ''), title: v.title, publisher: v.publisher, publicationYear: Number(v.year), categoryId: Number(v.categoryId), authorIds: v.authorIds },
      }))
    },
    onSuccess: () => {
      setDone(true)
      setEditing(null)
      setChosen([])
      setCategory(null)
      setLookup(null)
      reset(empty)
      void refresh()
    },
  })
  const reactivate = useMutation({
    mutationFn: (id: number) => call(api.POST('/api/v1/books/{id}/reactivate', { params: { path: { id } } })),
    onSuccess: () => void refresh(),
  })
  const inactivate = useMutation({
    mutationFn: (id: number) => call(api.DELETE('/api/v1/books/{id}', { params: { path: { id } } })),
    onSuccess: () => {
      setRemoving(null)
      if (selected?.id === removing?.id) setSelected(null)
      void refresh()
    },
  })

  const startEdit = (b: Book) => {
    setDone(false)
    setEditing(b)
    setLookup(null)
    setChosen(b.authors)
    setCategory(b.category)
    reset({ isbn: b.isbn, title: b.title, publisher: b.publisher ?? '', year: b.publicationYear ? String(b.publicationYear) : '', categoryId: String(b.categoryId), authorIds: b.authors.map((a) => a.id) })
  }
  const cancel = () => {
    setEditing(null)
    setChosen([])
    setCategory(null)
    setLookup(null)
    setDone(false)
    reset(empty)
  }
  const setCategoryChoice = (c: CategoryChoice | null) => {
    setCategory(c)
    setValue('categoryId', c ? String(c.id) : '', { shouldValidate: isSubmitted })
  }
  const setAuthors = (list: AuthorChip[]) => {
    setChosen(list)
    setValue('authorIds', list.map((a) => a.id), { shouldValidate: isSubmitted })
  }
  // Looks the ISBN up once it is valid and pre-fills only what the operator has not typed yet.
  const lookupIsbn = async (raw: string) => {
    const value = raw.replace(/[\s-]/g, '')
    if (editing || !isbnValid(raw)) return
    try {
      const r = await qc.fetchQuery({
        queryKey: ['lookup', value],
        queryFn: () => call(api.GET('/api/v1/books/lookup', { params: { query: { isbn: value } } })),
        staleTime: 5 * 60_000,
      })
      if (r.outcome === 'FOUND' && r.suggestion) {
        const f = suggestionToForm(r.suggestion)
        const current = form.getValues()
        if (!current.title) setValue('title', f.values.title)
        if (!current.publisher) setValue('publisher', f.values.publisher)
        if (!current.year) setValue('year', f.values.year)
        setAuthors([...chosen, ...f.known.filter((k) => !chosen.some((c) => c.id === k.id))])
        setLookup({ kind: 'FOUND', message: r.message, unknownAuthors: f.unknown })
      } else {
        setLookup({ kind: r.outcome, message: r.message, registeredBookId: r.registeredBookId, unknownAuthors: [] })
      }
    } catch {
      setLookup({ kind: 'FAILED', message: 'Não foi possível consultar o ISBN agora. Preencha os dados à mão.', unknownAuthors: [] })
    }
  }
  const registerAuthor = useMutation({
    mutationFn: (name: string) => call(api.POST('/api/v1/authors', { body: { name } })),
    onSuccess: (a) => {
      setAuthors([...chosen, { id: a.id, name: a.name }])
      setLookup((l) => (l ? { ...l, unknownAuthors: l.unknownAuthors.filter((n) => n !== a.name) } : l))
      void qc.invalidateQueries({ queryKey: ['authors'] })
    },
  })
  // Registers the suggested authors one by one; a homonym (422) reuses the author who already has the name.
  // Stops at the first other failure, keeping the ones already registered.
  const registerAll = useMutation({
    mutationFn: async (names: string[]) => {
      const added: AuthorChip[] = []
      for (const name of names) {
        try {
          const a = await call(api.POST('/api/v1/authors', { body: { name } }))
          added.push({ id: a.id, name: a.name })
        } catch (error) {
          const existing = existingAuthorId(error)
          if (existing === undefined) return { added, failure: error }
          added.push({ id: existing, name })
        }
      }
      return { added, failure: undefined }
    },
    onSuccess: ({ added }) => {
      setAuthors([...chosen, ...added.filter((a) => !chosen.some((c) => c.id === a.id))])
      const done = new Set(added.map((a) => a.name))
      setLookup((l) => (l ? { ...l, unknownAuthors: l.unknownAuthors.filter((n) => !done.has(n)) } : l))
      void qc.invalidateQueries({ queryKey: ['authors'] })
    },
  })
  const showRegistered = useMutation({
    mutationFn: (id: number) => call(api.GET('/api/v1/books/{id}', { params: { path: { id } } })),
    onSuccess: (b) => {
      setSearch('')
      setAuthorFilter('')
      setCategoryFilter(null)
      setIsbnFilter(b.isbn)
      setActive(b.active ? 'true' : 'false')
      setPage(0)
    },
  })

  const items = errorItems(errors, { isbn: 'ISBN', title: 'Título', publisher: 'Editora', year: 'Ano', categoryId: 'Categoria', authorIds: 'Autores' })
  const isbnField = register('isbn', { onChange: (e) => setValue('isbn', maskIsbn(e.target.value)), onBlur: (e) => void lookupIsbn(e.target.value) })
  const yearField = register('year', { onChange: (e) => setValue('year', maskYear(e.target.value)) })

  return (
    <>
      <PageHeader title="Livros e exemplares" subtitle="Acervo da biblioteca" actions={<SearchInput label="Buscar livro" placeholder="Buscar por título" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />} />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-6">
          <Card>
            <Pills value={active} onChange={(v) => { setActive(v); setPage(0) }} options={[{ value: 'true', label: 'Ativos' }, { value: 'false', label: 'Inativos' }]} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SearchInput label="Filtrar por autor" placeholder="Autor" value={authorFilter} onChange={(e) => { setAuthorFilter(e.target.value); setPage(0) }} />
              <SearchInput label="Filtrar por ISBN" placeholder="ISBN" value={isbnFilter} onChange={(e) => { setIsbnFilter(e.target.value); setPage(0) }} />
            </div>
            <CategoryPicker id="category-filter" value={categoryFilter} onChange={(c) => { setCategoryFilter(c); setPage(0) }} searchLabel="Filtrar por categoria" compact />
            {reactivate.isError && <Banner kind="error">{errorMessage(reactivate.error)}</Banner>}
            {showRegistered.isError && <Banner kind="error">{errorMessage(showRegistered.error)}</Banner>}
            {books.isPending && <Spinner />}
            {books.isError && <Banner kind="error">{errorMessage(books.error)}</Banner>}
            {books.data && books.data.items.length === 0 && <EmptyState>Nenhum livro encontrado.</EmptyState>}
            {books.data && books.data.items.length > 0 && (
              <>
                <DataTable
                  rows={books.data.items}
                  rowKey={(b) => b.id}
                  columns={[
                    { header: 'Livro', width: '2.2fr', cell: (b) => (<div className="flex flex-col"><span className="font-semibold">{b.title}</span><span className="font-mono text-xs text-muted">{b.isbn}</span></div>) },
                    { header: 'Autor', width: '1.5fr', cell: (b) => <span className="text-fg2">{b.authors.map((a) => a.name).join(', ')}</span> },
                    { header: 'Categoria', width: '1fr', cell: (b) => <span className="text-fg2">{b.category.name}</span> },
                    { header: 'Disponíveis', width: '0.9fr', cell: (b) => <Badge color={b.totalCopies === 0 ? '#a89984' : b.availableCopies === 0 ? '#fb4934' : '#8ec07c'}>{b.availableCopies} / {b.totalCopies}</Badge> },
                    {
                      header: 'Ações',
                      width: '1.2fr',
                      label: false,
                      cell: (b) => b.active ? (
                        <div className="flex gap-1">
                          <IconButton label={`Ver exemplares de ${b.title}`} onClick={() => setSelected(b)}><Icon name="eye" size={18} /></IconButton>
                          <IconButton label={`Editar ${b.title}`} onClick={() => startEdit(b)}><Icon name="edit" size={18} /></IconButton>
                          <IconButton label={`Inativar ${b.title}`} onClick={() => setRemoving(b)} style={{ color: '#fe8019' }}><Icon name="ban" size={18} /></IconButton>
                        </div>
                      ) : isAdmin && (
                        <Button small disabled={reactivate.isPending} onClick={() => reactivate.mutate(b.id)}>Reativar<span className="sr-only"> {b.title}</span></Button>
                      ),
                    },
                  ]}
                />
                <Pagination page={books.data.page} totalPages={books.data.totalPages} totalItems={books.data.totalItems} onPage={setPage} />
              </>
            )}
          </Card>
          {selected && <CopiesPanel book={selected} onChanged={refresh} onClose={() => setSelected(null)} />}
        </div>

        <FormCard title={editing ? 'Editar livro' : 'Novo livro'} className="flex-[1_1_340px]">
          <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="flex flex-col gap-4">
            <RequiredNote />
            {done && !save.isPending && <Banner kind="success">Livro salvo com sucesso.</Banner>}
            {save.isError && <Banner kind="error">{errorMessage(save.error)}</Banner>}
            <ErrorSummary title={errorTitle(items.length, 'salvar o livro')} items={items} />
            <TextField id={fid('isbn')} label="ISBN" required mono readOnly={!!editing} autoComplete="off" placeholder="978-85-0000-000-0" hint={editing ? 'O ISBN não pode ser alterado.' : 'ISBN-10 ou ISBN-13. Não pode ser alterado depois do cadastro.'} error={errors.isbn?.message} {...isbnField} />
            {lookup && (
              <div className="flex flex-col gap-2">
                <Banner kind={lookup.kind === 'FOUND' ? 'success' : 'info'}>{lookup.message}</Banner>
                {lookup.kind === 'ALREADY_REGISTERED' && lookup.registeredBookId !== undefined && (
                  <div><Button small disabled={showRegistered.isPending} onClick={() => showRegistered.mutate(lookup.registeredBookId!)}>Ver livro já cadastrado</Button></div>
                )}
                {lookup.unknownAuthors.length > 0 && (
                  <div className="flex flex-col gap-1.5 text-sm text-fg2">
                    <span>Autores sugeridos que ainda não estão no acervo:</span>
                    {registerAuthor.isError && <Banner kind="error">{errorMessage(registerAuthor.error)}</Banner>}
                    {registerAll.data?.failure !== undefined && <Banner kind="error">{errorMessage(registerAll.data.failure)}</Banner>}
                    {lookup.unknownAuthors.length > 1 && (
                      <div><Button small disabled={registerAll.isPending} onClick={() => registerAll.mutate(lookup.unknownAuthors)}>Cadastrar todos e selecionar</Button></div>
                    )}
                    {lookup.unknownAuthors.map((n) => (
                      <div key={n} className="flex flex-wrap items-center justify-between gap-2">
                        <span>{n}</span>
                        <Button small disabled={registerAuthor.isPending} onClick={() => registerAuthor.mutate(n)}>Cadastrar e selecionar<span className="sr-only"> {n}</span></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <TextField id={fid('title')} label="Título" required maxLength={255} autoComplete="off" error={errors.title?.message} {...register('title')} />
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
              <TextField id={fid('publisher')} label="Editora" required maxLength={255} autoComplete="off" error={errors.publisher?.message} {...register('publisher')} />
              <TextField id={fid('year')} label="Ano" required inputMode="numeric" placeholder="1899" error={errors.year?.message} {...yearField} />
            </div>
            <CategoryPicker id={fid('categoryId')} legend="Categoria" required value={category} onChange={setCategoryChoice} error={errors.categoryId?.message} />
            <AuthorPicker id={fid('authorIds')} value={chosen} onChange={setAuthors} error={errors.authorIds?.message} />
            <div className="flex justify-end gap-3 pt-1">
              <Button onClick={cancel}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={save.isPending}>Salvar livro</Button>
            </div>
          </form>
        </FormCard>
      </div>

      {removing && (
        <Dialog title="Inativar livro" onClose={() => setRemoving(null)}>
          <p className="m-0 text-sm text-fg2">“{removing.title}” sai da lista de ativos; o histórico de empréstimos é mantido. Só um administrador pode reativar o livro.</p>
          {inactivate.isError && <Banner kind="error">{errorMessage(inactivate.error)}</Banner>}
          <div className="flex justify-end gap-3">
            <Button onClick={() => setRemoving(null)}>Cancelar</Button>
            <Button variant="danger" disabled={inactivate.isPending} onClick={() => inactivate.mutate(removing.id)}>Inativar</Button>
          </div>
        </Dialog>
      )}
    </>
  )
}

function CopiesPanel({ book, onChanged, onClose }: { book: Book; onChanged: () => void; onClose: () => void }) {
  const qc = useQueryClient()
  const [added, setAdded] = useState(false)
  const [showActive, setShowActive] = useState<'true' | 'false'>('true')
  const { isAdmin } = useAuth()
  const copies = useQuery({
    queryKey: ['copies', book.id, showActive],
    queryFn: () => call(api.GET('/api/v1/copies', { params: { query: { bookId: book.id, active: showActive === 'true', size: 100 } } })),
  })
  const form = useForm<z.infer<typeof copySchema>>({ resolver: zodResolver(copySchema), defaultValues: { assetCode: '' } })
  const { register, handleSubmit, reset, formState: { errors } } = form
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['copies', book.id] })
    onChanged()
  }
  const add = useMutation({
    mutationFn: (v: { assetCode: string }) => call(api.POST('/api/v1/copies', { body: { bookId: book.id, assetCode: v.assetCode } })),
    onSuccess: () => { setAdded(true); reset({ assetCode: '' }); refresh() },
  })
  const changeStatus = useMutation({
    mutationFn: (v: { id: number; status: 'AVAILABLE' | 'DAMAGED' | 'LOST' }) => call(api.PATCH('/api/v1/copies/{id}', { params: { path: { id: v.id } }, body: { status: v.status } })),
    onSuccess: refresh,
  })
  const inactivate = useMutation({
    mutationFn: (id: number) => call(api.DELETE('/api/v1/copies/{id}', { params: { path: { id } } })),
    onSuccess: refresh,
  })
  const reactivate = useMutation({
    mutationFn: (id: number) => call(api.POST('/api/v1/copies/{id}/reactivate', { params: { path: { id } } })),
    onSuccess: refresh,
  })
  const error = add.error ?? changeStatus.error ?? inactivate.error ?? reactivate.error

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold">Exemplares de “{book.title}”</h2>
        <Button small onClick={onClose}>Fechar</Button>
      </div>
      <Pills value={showActive} onChange={setShowActive} options={[{ value: 'true', label: 'Ativos' }, { value: 'false', label: 'Inativos' }]} />
      {error && <Banner kind="error">{errorMessage(error)}</Banner>}
      {copies.isPending && <Spinner />}
      {copies.data && copies.data.items.length === 0 && <EmptyState>Nenhum exemplar cadastrado.</EmptyState>}
      {copies.data && copies.data.items.length > 0 && (
        <DataTable
          rows={copies.data.items}
          rowKey={(c) => c.id}
          columns={[
            { header: 'Patrimônio', width: '1.2fr', cell: (c) => <span className="font-mono">{c.assetCode}</span> },
            { header: 'Status', width: '1fr', cell: (c) => <CopyStatusBadge status={c.status} /> },
            {
              header: 'Ações',
              width: '2.4fr',
              label: false,
              cell: (c) => !c.active ? isAdmin && (
                <Button small disabled={reactivate.isPending} onClick={() => reactivate.mutate(c.id)}>Reativar<span className="sr-only"> {c.assetCode}</span></Button>
              ) : c.status !== 'BORROWED' && (
                <div className="flex flex-wrap gap-2">
                  {c.status === 'DAMAGED' && <Button small variant="ghost" onClick={() => changeStatus.mutate({ id: c.id, status: 'AVAILABLE' })}>Voltou a disponível</Button>}
                  {c.status !== 'DAMAGED' && c.status !== 'LOST' && <Button small variant="danger" onClick={() => changeStatus.mutate({ id: c.id, status: 'DAMAGED' })}>Danificado</Button>}
                  {c.status !== 'LOST' && <Button small variant="danger" onClick={() => changeStatus.mutate({ id: c.id, status: 'LOST' })}>Perdido</Button>}
                  <Button small onClick={() => inactivate.mutate(c.id)}>Inativar</Button>
                </div>
              ),
            },
          ]}
        />
      )}
      <form noValidate onSubmit={handleSubmit((v) => { setAdded(false); add.mutate(v) })} className="flex flex-wrap items-start gap-3 pt-1">
        <div className="min-w-56 flex-1">
          <TextField id={fid('assetCode')} label="Novo exemplar" required mono maxLength={50} autoComplete="off" placeholder="Código de patrimônio, ex.: PAT-0006" error={errors.assetCode?.message} {...register('assetCode')} />
        </div>
        <Button type="submit" variant="primary" disabled={add.isPending} className="mt-[26px]">Adicionar exemplar</Button>
      </form>
      {added && !add.isPending && <Banner kind="success">Exemplar adicionado.</Banner>}
    </Card>
  )
}
