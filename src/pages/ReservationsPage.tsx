import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, call, errorMessage } from '../api/client'
import type { Reservation, ReservationStatus } from '../api/types'
import { BookPicker, type BookChoice } from '../components/BookPicker'
import { ReaderPicker, type ReaderChoice } from '../components/ReaderPicker'
import { Badge, Banner, Button, Card, DataTable, Dialog, EmptyState, ErrorSummary, FormCard, PageHeader, Pagination, Pills, RequiredNote, Spinner } from '../components/ui'
import { formatDate } from '../lib/dates'
import { fid } from '../lib/form'
import { reservationState } from '../lib/reservations'

type Tab = ReservationStatus | 'ALL'
const tabs: { value: Tab; label: string }[] = [
  { value: 'ACTIVE', label: 'Ativas' },
  { value: 'FULFILLED', label: 'Retiradas' },
  { value: 'CANCELLED', label: 'Canceladas' },
  { value: 'EXPIRED', label: 'Expiradas' },
  { value: 'ALL', label: 'Todas' },
]

export function ReservationsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('ACTIVE')
  const [page, setPage] = useState(0)
  const [reader, setReader] = useState<ReaderChoice | null>(null)
  const [book, setBook] = useState<BookChoice | null>(null)
  const [cancelling, setCancelling] = useState<Reservation | null>(null)
  const [cancelled, setCancelled] = useState('')

  // The queue of a book is read in arrival order; every other list shows the newest first.
  const queue = tab === 'ACTIVE' && !!book
  const list = useQuery({
    queryKey: ['reservations', tab, reader?.id, book?.id, page],
    queryFn: () => call(api.GET('/api/v1/reservations', {
      params: { query: { status: tab === 'ALL' ? undefined : tab, readerId: reader?.id, bookId: book?.id, sort: queue ? 'id,asc' : undefined, page } },
    })),
  })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['reservations'] })
    void qc.invalidateQueries({ queryKey: ['books'] })
    void qc.invalidateQueries({ queryKey: ['copies'] })
  }
  const cancel = useMutation({
    mutationFn: (id: number) => call(api.POST('/api/v1/reservations/{id}/cancel', { params: { path: { id } } })),
    onSuccess: (r) => {
      setCancelling(null)
      setCancelled(r.served ? `Reserva cancelada. O exemplar passou para a reserva #${r.served.id} (retirada até ${formatDate(r.served.pickupDeadline)}).` : 'Reserva cancelada.')
      refresh()
    },
  })

  return (
    <>
      <PageHeader title="Reservas" subtitle="Fila de espera e exemplares guardados" />
      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex-[2_1_560px]">
          <Pills value={tab} onChange={(v) => { setTab(v); setPage(0); setCancelled('') }} options={tabs} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReaderPicker id={fid('filterReader')} label="Filtrar por leitor" required={false} searchLabel="Filtrar por leitor" value={reader} onChange={(r) => { setReader(r); setPage(0) }} />
            <BookPicker id={fid('filterBook')} label="Filtrar por livro" required={false} searchLabel="Filtrar por livro" value={book} onChange={(b) => { setBook(b); setPage(0) }} />
          </div>
          {cancelled && <Banner kind="success">{cancelled}</Banner>}
          {list.isPending && <Spinner />}
          {list.isError && <Banner kind="error">{errorMessage(list.error)}</Banner>}
          {list.data && list.data.items.length === 0 && <EmptyState>Nenhuma reserva nesta lista.</EmptyState>}
          {list.data && list.data.items.length > 0 && (
            <>
              <DataTable
                rows={list.data.items}
                rowKey={(r) => r.id}
                columns={[
                  { header: 'Livro', width: '2fr', cell: (r) => (<div className="flex flex-col"><span className="font-medium">{r.bookTitle ?? `Livro #${r.bookId}`}</span><span className="text-xs text-muted">reservado em {formatDate(r.reservationDate)}</span></div>) },
                  { header: 'Leitor', width: '1.4fr', cell: (r) => <Link to={`/leitores/${r.readerId}`} className="text-fg2">{r.readerName ?? `Leitor #${r.readerId}`}</Link> },
                  {
                    header: 'Situação',
                    width: '1.8fr',
                    cell: (r) => {
                      const state = reservationState(r)
                      return (
                        <div className="flex flex-col items-start gap-1">
                          <Badge color={state.color}>{state.label}</Badge>
                          {r.copyId !== undefined && <span className="font-mono text-xs text-muted">{r.assetCode}{r.pickupDeadline ? ` · retirada até ${formatDate(r.pickupDeadline)}` : ''}</span>}
                        </div>
                      )
                    },
                  },
                  {
                    header: 'Ação',
                    width: '1fr',
                    label: false,
                    cell: (r) => r.status === 'ACTIVE' && (
                      <Button small variant="ghost" aria-label={`Cancelar reserva de ${r.readerName ?? `leitor #${r.readerId}`}`} onClick={() => { setCancelled(''); setCancelling(r) }}>Cancelar</Button>
                    ),
                  },
                ]}
              />
              <Pagination page={list.data.page} totalPages={list.data.totalPages} totalItems={list.data.totalItems} onPage={setPage} />
            </>
          )}
        </Card>
        <NewReservation onDone={refresh} />
      </div>

      {cancelling && (
        <Dialog title="Cancelar reserva" onClose={() => setCancelling(null)}>
          <p className="m-0 text-sm text-fg2">
            Cancelar a reserva de “{cancelling.bookTitle}” feita por {cancelling.readerName}? Se ela guarda um exemplar, ele passa ao próximo da fila ou volta a ficar disponível.
          </p>
          {cancel.isError && <Banner kind="error">{errorMessage(cancel.error)}</Banner>}
          <div className="flex justify-end gap-3">
            <Button onClick={() => setCancelling(null)}>Voltar</Button>
            <Button variant="danger" disabled={cancel.isPending} onClick={() => cancel.mutate(cancelling.id)}>Cancelar reserva</Button>
          </div>
        </Dialog>
      )}
    </>
  )
}

function NewReservation({ onDone }: { onDone: () => void }) {
  const [reader, setReader] = useState<ReaderChoice | null>(null)
  const [book, setBook] = useState<BookChoice | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [done, setDone] = useState('')

  const reserve = useMutation({
    mutationFn: () => call(api.POST('/api/v1/reservations', { body: { bookId: book!.id, readerId: reader!.id } })),
    onSuccess: (r) => {
      setDone(r.queuePosition !== undefined ? `Reserva registrada: lugar ${r.queuePosition} na fila.` : 'Reserva registrada.')
      setSubmitted(false)
      setReader(null)
      setBook(null)
      onDone()
    },
  })

  const errors: { id: string; message: string }[] = []
  if (!reader) errors.push({ id: fid('reader'), message: 'Leitor: selecione o leitor.' })
  if (!book) errors.push({ id: fid('book'), message: 'Livro: selecione o livro.' })
  else if (book.availableCopies > 0) errors.push({ id: fid('book'), message: 'Livro: tem exemplar disponível; registre um empréstimo em vez de reservar.' })
  const shown = (id: string) => (submitted ? errors.find((e) => e.id === id)?.message : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setDone('')
    if (errors.length === 0) reserve.mutate()
  }

  return (
    <FormCard title="Nova reserva" className="flex-[1_1_340px]">
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <RequiredNote />
        {done && !reserve.isPending && <Banner kind="success">{done}</Banner>}
        {reserve.isError && <Banner kind="error">{errorMessage(reserve.error)}</Banner>}
        <ErrorSummary title={errors.length === 1 ? 'Corrija 1 campo para registrar a reserva.' : `Corrija ${errors.length} campos para registrar a reserva.`} items={submitted ? errors : []} />
        <ReaderPicker id={fid('reader')} value={reader} onChange={setReader} error={shown(fid('reader'))} />
        <BookPicker id={fid('book')} value={book} onChange={setBook} error={shown(fid('book'))} />
        <p className="m-0 text-xs text-muted">Só se reserva livro sem exemplar disponível. A reserva entra no fim da fila do livro.</p>
        <div className="flex justify-end gap-3">
          <Button onClick={() => { setReader(null); setBook(null); setSubmitted(false); setDone('') }}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={reserve.isPending}>Reservar livro</Button>
        </div>
      </form>
    </FormCard>
  )
}
