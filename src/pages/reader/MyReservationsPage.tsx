import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, call, errorMessage } from '../../api/client'
import type { ReaderReservation, ReservationStatus } from '../../api/types'
import { BookPicker, type BookChoice } from '../../components/BookPicker'
import { Badge, Banner, Button, Card, DataTable, Dialog, EmptyState, FormCard, PageHeader, Pagination, Pills, Spinner } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import { fid } from '../../lib/form'
import { reservationState, reservedMessage } from '../../lib/reservations'
import { useReserveMyBook } from '../../lib/useReserveMyBook'

type Tab = ReservationStatus | 'ALL'
const tabs: { value: Tab; label: string }[] = [
  { value: 'ACTIVE', label: 'Ativas' },
  { value: 'FULFILLED', label: 'Retiradas' },
  { value: 'CANCELLED', label: 'Canceladas' },
  { value: 'EXPIRED', label: 'Expiradas' },
  { value: 'ALL', label: 'Todas' },
]

export function MyReservationsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('ACTIVE')
  const [page, setPage] = useState(0)
  const [cancelling, setCancelling] = useState<ReaderReservation | null>(null)
  const [notice, setNotice] = useState('')

  const list = useQuery({
    queryKey: ['me', 'reservations', tab, page],
    queryFn: () => call(api.GET('/api/v1/me/reservations', { params: { query: { status: tab === 'ALL' ? undefined : tab, page } } })),
  })
  const cancel = useMutation({
    mutationFn: (id: number) => call(api.POST('/api/v1/me/reservations/{id}/cancel', { params: { path: { id } } })),
    onSuccess: () => {
      setCancelling(null)
      setNotice('Reserva cancelada.')
      void qc.invalidateQueries({ queryKey: ['me'] })
    },
  })

  return (
    <>
      <PageHeader title="Minhas reservas" subtitle="Fila de espera e exemplares guardados para você" />
      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex-[2_1_480px]">
          <Pills value={tab} onChange={(v) => { setTab(v); setPage(0); setNotice('') }} options={tabs} />
          {notice && <Banner kind="success">{notice}</Banner>}
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
                  {
                    header: 'Situação',
                    width: '1.8fr',
                    cell: (r) => {
                      const state = reservationState(r)
                      return (
                        <div className="flex flex-col items-start gap-1">
                          <Badge color={state.color}>{state.label}</Badge>
                          {r.status === 'ACTIVE' && r.pickupDeadline && <span className="text-xs text-muted">retire até {formatDate(r.pickupDeadline)}</span>}
                        </div>
                      )
                    },
                  },
                  {
                    header: 'Ação',
                    width: '1fr',
                    label: false,
                    cell: (r) => r.status === 'ACTIVE' && (
                      <Button small variant="ghost" aria-label={`Cancelar reserva de ${r.bookTitle ?? `livro #${r.bookId}`}`} onClick={() => { setNotice(''); setCancelling(r) }}>Cancelar</Button>
                    ),
                  },
                ]}
              />
              <Pagination page={list.data.page} totalPages={list.data.totalPages} totalItems={list.data.totalItems} onPage={setPage} />
            </>
          )}
        </Card>
        <NewReservation />
      </div>

      {cancelling && (
        <Dialog title="Cancelar reserva" onClose={() => setCancelling(null)}>
          <p className="m-0 text-sm text-fg2">Cancelar a sua reserva de “{cancelling.bookTitle}”? Se há um exemplar guardado para você, ele passa ao próximo da fila.</p>
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

function NewReservation() {
  const [book, setBook] = useState<BookChoice | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [done, setDone] = useState('')
  const reserve = useReserveMyBook()

  const error = !book ? 'Livro: selecione o livro.' : book.availableCopies > 0 ? 'Livro: tem exemplar disponível; peça o empréstimo na biblioteca em vez de reservar.' : undefined
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setDone('')
    if (!error && book) reserve.mutate(book.id, { onSuccess: (r) => { setDone(reservedMessage(r.queuePosition)); setBook(null); setSubmitted(false) } })
  }

  return (
    <FormCard title="Reservar um livro" className="flex-[1_1_320px]">
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        {done && !reserve.isPending && <Banner kind="success">{done}</Banner>}
        {reserve.isError && <Banner kind="error">{errorMessage(reserve.error)}</Banner>}
        <BookPicker id={fid('book')} reader value={book} onChange={setBook} error={submitted ? error : undefined} />
        <p className="m-0 text-xs text-muted">Só dá para reservar livro sem exemplar disponível. A reserva entra no fim da fila do livro.</p>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={reserve.isPending}>Reservar livro</Button>
        </div>
      </form>
    </FormCard>
  )
}
