import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, call, errorMessage } from '../api/client'
import type { Fine } from '../api/types'
import { formatDate, formatMoney } from '../lib/dates'
import { ReasonDialog } from './ReasonDialog'
import { Badge, Banner, Button, DataTable, EmptyState, Pagination, Pills, Spinner } from './ui'

const fineStatus = { PENDING: { label: 'Pendente', color: '#fabd2f' }, PAID: { label: 'Paga', color: '#8ec07c' }, WAIVED: { label: 'Abonada', color: '#83a598' } } as const
type FineFilter = 'ALL' | 'PENDING' | 'PAID' | 'WAIVED'

export function FinesList({ readerId }: { readerId?: number }) {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<FineFilter>(readerId ? 'ALL' : 'PENDING')
  const [page, setPage] = useState(0)
  const [waiving, setWaiving] = useState<Fine | null>(null)
  const fines = useQuery({
    queryKey: ['fines', readerId, filter, page],
    queryFn: () => call(api.GET('/api/v1/fines', { params: { query: { readerId, status: filter === 'ALL' ? undefined : filter, page } } })),
  })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['fines'] })
    void qc.invalidateQueries({ queryKey: ['loans'] })
  }
  const pay = useMutation({
    mutationFn: (id: number) => call(api.POST('/api/v1/fines/{id}/pay', { params: { path: { id } } })),
    onSuccess: refresh,
  })
  const waive = useMutation({
    mutationFn: (v: { id: number; reason: string }) => call(api.POST('/api/v1/fines/{id}/waive', { params: { path: { id: v.id } }, body: { reason: v.reason } })),
    onSuccess: () => { setWaiving(null); refresh() },
  })

  return (
    <div className="flex flex-col gap-3">
      <Pills value={filter} onChange={(v) => { setFilter(v); setPage(0) }} options={[{ value: 'PENDING', label: 'Pendentes' }, { value: 'PAID', label: 'Pagas' }, { value: 'WAIVED', label: 'Abonadas' }, { value: 'ALL', label: 'Todas' }]} />
      {pay.isError && <Banner kind="error">{errorMessage(pay.error)}</Banner>}
      {fines.isPending && <Spinner />}
      {fines.isError && <Banner kind="error">{errorMessage(fines.error)}</Banner>}
      {fines.data && fines.data.items.length === 0 && <EmptyState>Nenhuma multa nesta situação.</EmptyState>}
      {fines.data && fines.data.items.length > 0 && (
        <>
          <DataTable
            rows={fines.data.items}
            rowKey={(f) => f.id}
            columns={[
              { header: 'Leitor', width: '1.2fr', cell: (f) => <Link to={`/leitores/${f.readerId}`}>Leitor #{f.readerId}</Link> },
              { header: 'Empréstimo', width: '1fr', cell: (f) => <span className="font-mono text-[13px]">#{f.loanId}</span> },
              { header: 'Valor', width: '1fr', cell: (f) => <span className="font-mono">{formatMoney(f.amount)}</span> },
              { header: 'Situação', width: '1fr', cell: (f) => (<div className="flex flex-col gap-1"><Badge color={fineStatus[f.status].color}>{fineStatus[f.status].label}</Badge>{f.waiverReason && <span className="text-xs text-muted">{f.waiverReason}</span>}</div>) },
              {
                header: 'Ações',
                width: '1.6fr',
                label: false,
                cell: (f) => f.status === 'PENDING' && (
                  <div className="flex flex-wrap gap-2">
                    <Button small variant="primary" disabled={pay.isPending} onClick={() => pay.mutate(f.id)}>Registrar pagamento</Button>
                    <Button small onClick={() => setWaiving(f)}>Abonar</Button>
                  </div>
                ),
              },
            ]}
          />
          <Pagination page={fines.data.page} totalPages={fines.data.totalPages} totalItems={fines.data.totalItems} onPage={setPage} />
        </>
      )}
      {waiving && (
        <ReasonDialog
          title="Abonar multa"
          description={`A multa de ${formatMoney(waiving.amount)} deixa de ser cobrada e o leitor volta a poder emprestar. A justificativa fica registrada.`}
          confirm="Abonar multa"
          pending={waive.isPending}
          error={waive.error}
          onSubmit={(reason) => waive.mutate({ id: waiving.id, reason })}
          onClose={() => { setWaiving(null); waive.reset() }}
        />
      )}
    </div>
  )
}

type SuspFilter = 'FORCE' | 'ALL'

export function SuspensionsList({ readerId }: { readerId?: number }) {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<SuspFilter>(readerId ? 'ALL' : 'FORCE')
  const [page, setPage] = useState(0)
  const [ending, setEnding] = useState<number | null>(null)
  const list = useQuery({
    queryKey: ['suspensions', readerId, filter, page],
    queryFn: () => call(api.GET('/api/v1/suspensions', { params: { query: { readerId, inForce: filter === 'FORCE' ? true : undefined, page } } })),
  })
  const end = useMutation({
    mutationFn: (v: { id: number; reason: string }) => call(api.POST('/api/v1/suspensions/{id}/end', { params: { path: { id: v.id } }, body: { reason: v.reason } })),
    onSuccess: () => {
      setEnding(null)
      void qc.invalidateQueries({ queryKey: ['suspensions'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  return (
    <div className="flex flex-col gap-3">
      <Pills value={filter} onChange={(v) => { setFilter(v); setPage(0) }} options={[{ value: 'FORCE', label: 'Em vigor' }, { value: 'ALL', label: 'Todas' }]} />
      {list.isPending && <Spinner />}
      {list.isError && <Banner kind="error">{errorMessage(list.error)}</Banner>}
      {list.data && list.data.items.length === 0 && <EmptyState>Nenhuma suspensão nesta situação.</EmptyState>}
      {list.data && list.data.items.length > 0 && (
        <>
          <DataTable
            rows={list.data.items}
            rowKey={(s) => s.id}
            columns={[
              { header: 'Leitor', width: '1.1fr', cell: (s) => <Link to={`/leitores/${s.readerId}`}>Leitor #{s.readerId}</Link> },
              { header: 'Início', width: '0.9fr', cell: (s) => <span className="font-mono text-[13px]">{formatDate(s.startDate)}</span> },
              { header: 'Libera em', width: '0.9fr', cell: (s) => <span className="font-mono text-[13px]">{formatDate(s.releaseDate)}</span> },
              { header: 'Situação', width: '1.4fr', cell: (s) => (<div className="flex flex-col gap-1"><Badge color={s.inForce ? '#fb4934' : '#a89984'}>{s.inForce ? 'Em vigor' : 'Encerrada'}</Badge>{s.endedEarlyReason && <span className="text-xs text-muted">Encerrada antes: {s.endedEarlyReason}</span>}</div>) },
              { header: 'Ações', width: '1fr', label: false, cell: (s) => s.inForce && <Button small onClick={() => setEnding(s.id)}>Encerrar antes</Button> },
            ]}
          />
          <Pagination page={list.data.page} totalPages={list.data.totalPages} totalItems={list.data.totalItems} onPage={setPage} />
        </>
      )}
      {ending !== null && (
        <ReasonDialog
          title="Encerrar suspensão antes do prazo"
          description="O leitor volta a poder emprestar a partir de hoje. A justificativa fica registrada na suspensão."
          confirm="Encerrar suspensão"
          pending={end.isPending}
          error={end.error}
          onSubmit={(reason) => end.mutate({ id: ending, reason })}
          onClose={() => { setEnding(null); end.reset() }}
        />
      )}
    </div>
  )
}
