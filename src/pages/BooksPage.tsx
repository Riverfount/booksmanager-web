import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { api, call, errorMessage } from '../api/client'
import type { Book } from '../api/types'
import { AuthorPicker, type AuthorChip } from '../components/AuthorPicker'
import { CopyStatusBadge } from '../components/copyStatus'
import { Icon } from '../components/Icon'
import { Badge, Banner, Button, Card, DataTable, Dialog, EmptyState, ErrorSummary, FormCard, IconButton, PageHeader, Pagination, Pills, RequiredNote, SearchInput, SelectField, Spinner, TextField } from '../components/ui'
import { errorItems, errorTitle, fid } from '../lib/form'
import { maskIsbn, maskYear } from '../lib/masks'
import { bookSchema, bookSchemaFor, copySchema } from '../lib/schemas'
import { useDebounced } from '../lib/useDebounced'

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
  const title = useDebounced(search.trim())

  const books = useQuery({
    queryKey: ['books', title, active, page],
    queryFn: () => call(api.GET('/api/v1/books', { params: { query: { title: title || undefined, active: active === 'true', page } } })),
  })
  const categories = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => call(api.GET('/api/v1/categories', { params: { query: { size: 100, active: true } } })),
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
      reset(empty)
      void refresh()
    },
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
    setChosen(b.authors)
    reset({ isbn: b.isbn, title: b.title, publisher: b.publisher ?? '', year: b.publicationYear ? String(b.publicationYear) : '', categoryId: String(b.categoryId), authorIds: b.authors.map((a) => a.id) })
  }
  const cancel = () => {
    setEditing(null)
    setChosen([])
    setDone(false)
    reset(empty)
  }
  const setAuthors = (list: AuthorChip[]) => {
    setChosen(list)
    setValue('authorIds', list.map((a) => a.id), { shouldValidate: isSubmitted })
  }
  const items = errorItems(errors, { isbn: 'ISBN', title: 'Título', publisher: 'Editora', year: 'Ano', categoryId: 'Categoria', authorIds: 'Autores' })
  const isbnField = register('isbn', { onChange: (e) => setValue('isbn', maskIsbn(e.target.value)) })
  const yearField = register('year', { onChange: (e) => setValue('year', maskYear(e.target.value)) })

  return (
    <>
      <PageHeader title="Livros e exemplares" subtitle="Acervo da biblioteca" actions={<SearchInput label="Buscar livro" placeholder="Buscar por título" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />} />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-6">
          <Card>
            <Pills value={active} onChange={(v) => { setActive(v); setPage(0) }} options={[{ value: 'true', label: 'Ativos' }, { value: 'false', label: 'Inativos' }]} />
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
                      cell: (b) => b.active && (
                        <div className="flex gap-1">
                          <IconButton label={`Ver exemplares de ${b.title}`} onClick={() => setSelected(b)}><Icon name="eye" size={18} /></IconButton>
                          <IconButton label={`Editar ${b.title}`} onClick={() => startEdit(b)}><Icon name="edit" size={18} /></IconButton>
                          <IconButton label={`Inativar ${b.title}`} onClick={() => setRemoving(b)} style={{ color: '#fe8019' }}><Icon name="ban" size={18} /></IconButton>
                        </div>
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
            <TextField id={fid('title')} label="Título" required maxLength={255} autoComplete="off" error={errors.title?.message} {...register('title')} />
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
              <TextField id={fid('publisher')} label="Editora" required maxLength={255} autoComplete="off" error={errors.publisher?.message} {...register('publisher')} />
              <TextField id={fid('year')} label="Ano" required inputMode="numeric" placeholder="1899" error={errors.year?.message} {...yearField} />
            </div>
            <SelectField id={fid('categoryId')} label="Categoria" required error={errors.categoryId?.message} {...register('categoryId')}>
              <option value="">Selecione uma categoria</option>
              {categories.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectField>
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
          <p className="m-0 text-sm text-fg2">“{removing.title}” sai da lista de ativos; o histórico de empréstimos é mantido. Livros com exemplares emprestados não podem ser inativados.</p>
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
  const copies = useQuery({
    queryKey: ['copies', book.id],
    queryFn: () => call(api.GET('/api/v1/copies', { params: { query: { bookId: book.id, size: 100 } } })),
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
  const error = add.error ?? changeStatus.error ?? inactivate.error

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold">Exemplares de “{book.title}”</h2>
        <Button small onClick={onClose}>Fechar</Button>
      </div>
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
              cell: (c) => c.active && c.status !== 'BORROWED' && (
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
