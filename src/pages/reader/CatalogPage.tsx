import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, call, errorMessage } from '../../api/client'
import type { ReaderBook } from '../../api/types'
import { CategoryPicker, type CategoryChoice } from '../../components/CategoryPicker'
import { Badge, Banner, Button, Card, DataTable, Dialog, EmptyState, PageHeader, Pagination, SearchInput, Spinner } from '../../components/ui'
import { reservedMessage } from '../../lib/reservations'
import { useDebounced } from '../../lib/useDebounced'
import { useReserveMyBook } from '../../lib/useReserveMyBook'

/** The collection as a reader sees it: only active books and how many copies are available now. */
export function CatalogPage() {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [isbn, setIsbn] = useState('')
  const [category, setCategory] = useState<CategoryChoice | null>(null)
  const [page, setPage] = useState(0)
  const [reserving, setReserving] = useState<ReaderBook | null>(null)
  const [done, setDone] = useState('')
  const reserve = useReserveMyBook()
  const t = useDebounced(title.trim())
  const a = useDebounced(author.trim())
  const i = useDebounced(isbn.trim())

  const books = useQuery({
    queryKey: ['me', 'books', t, a, i, category?.id, page],
    queryFn: () => call(api.GET('/api/v1/me/books', {
      params: { query: { title: t || undefined, author: a || undefined, isbn: i || undefined, categoryId: category?.id, page } },
    })),
  })
  const filter = (set: (v: string) => void) => (e: { target: { value: string } }) => { set(e.target.value); setPage(0) }
  const close = () => { setReserving(null); reserve.reset() }

  return (
    <>
      <PageHeader title="Catálogo" subtitle="Procure um livro da biblioteca" />
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SearchInput label="Buscar por título" placeholder="Título" value={title} onChange={filter(setTitle)} />
          <SearchInput label="Buscar por autor" placeholder="Autor" value={author} onChange={filter(setAuthor)} />
          <SearchInput label="Buscar por ISBN" placeholder="ISBN" value={isbn} onChange={filter(setIsbn)} />
        </div>
        <CategoryPicker id="category-filter" reader compact value={category} onChange={(c) => { setCategory(c); setPage(0) }} searchLabel="Filtrar por categoria" />
        {done && <Banner kind="success">{done}</Banner>}
        {books.isPending && <Spinner />}
        {books.isError && <Banner kind="error">{errorMessage(books.error)}</Banner>}
        {books.data && books.data.items.length === 0 && <EmptyState>Nenhum livro encontrado.</EmptyState>}
        {books.data && books.data.items.length > 0 && (
          <>
            <DataTable
              rows={books.data.items}
              rowKey={(b) => b.id}
              columns={[
                { header: 'Livro', width: '2.2fr', cell: (b) => (<div className="flex flex-col"><span className="font-semibold">{b.title}</span><span className="text-xs text-muted">{[b.publisher, b.publicationYear].filter(Boolean).join(', ') || '—'}</span></div>) },
                { header: 'Autores', width: '1.5fr', cell: (b) => <span className="text-fg2">{b.authors.map((x) => x.name).join(', ')}</span> },
                { header: 'Categoria', width: '1fr', cell: (b) => <span className="text-fg2">{b.category.name}</span> },
                { header: 'Disponibilidade', width: '1.1fr', cell: (b) => <Badge color={b.availableCopies > 0 ? 'var(--color-green)' : 'var(--color-red)'}>{b.availableCopies > 0 ? `${b.availableCopies} ${b.availableCopies === 1 ? 'disponível' : 'disponíveis'}` : 'Indisponível'}</Badge> },
                {
                  header: 'Ação',
                  width: '1fr',
                  label: false,
                  cell: (b) => b.availableCopies === 0 && (
                    <Button small variant="ghost" aria-label={`Reservar ${b.title}`} onClick={() => { setDone(''); setReserving(b) }}>Reservar</Button>
                  ),
                },
              ]}
            />
            <Pagination page={books.data.page} totalPages={books.data.totalPages} totalItems={books.data.totalItems} onPage={setPage} />
          </>
        )}
      </Card>

      {reserving && (
        <Dialog title="Reservar livro" onClose={close}>
          <p className="m-0 text-sm text-fg2">Reservar “{reserving.title}”? Você entra no fim da fila e a biblioteca guarda um exemplar quando chegar a sua vez.</p>
          {reserve.isError && <Banner kind="error">{errorMessage(reserve.error)}</Banner>}
          <div className="flex justify-end gap-3">
            <Button onClick={close}>Voltar</Button>
            <Button variant="primary" disabled={reserve.isPending} onClick={() => reserve.mutate(reserving.id, { onSuccess: (r) => { setDone(reservedMessage(r.queuePosition)); close() } })}>Reservar</Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
