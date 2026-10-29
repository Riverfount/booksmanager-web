import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, call, errorMessage } from '../api/client'
import { exportReport, type ExportPath } from '../api/download'
import { useAuth } from '../auth/AuthContext'
import { copyStatusInfo } from '../components/copyStatus'
import { Badge, Banner, Button, Card, DataTable, EmptyState, PageHeader, Pagination, Pills, Spinner, TextField } from '../components/ui'
import { formatDate, todayIso } from '../lib/dates'
import { fid } from '../lib/form'
import { defaultPeriod, periodError } from '../lib/period'
import type { CopyStatus } from '../api/types'

type Tab = 'overdue' | 'borrowed' | 'collection'
const tabs: { value: Tab; label: string }[] = [
  { value: 'overdue', label: 'Em atraso' },
  { value: 'borrowed', label: 'Mais emprestados' },
  { value: 'collection', label: 'Acervo' },
]

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>('overdue')
  return (
    <>
      <PageHeader title="Relatórios" subtitle="Atrasos, livros mais emprestados e situação do acervo" />
      <Card>
        <Pills value={tab} onChange={setTab} options={tabs} />
        {tab === 'overdue' && <OverdueReport />}
        {tab === 'borrowed' && <BorrowedReport />}
        {tab === 'collection' && <CollectionReport />}
      </Card>
    </>
  )
}

/** PDF and CSV buttons, only for the administrator (the API refuses the operator with 403). */
function ExportButtons({ pdf, csv, name, query, disabled }: { pdf: ExportPath; csv: ExportPath; name: string; query?: { from: string; to: string }; disabled?: boolean }) {
  const { isAdmin } = useAuth()
  const run = useMutation({ mutationFn: (v: { path: ExportPath; ext: string }) => exportReport(v.path, `${name}-${todayIso()}.${v.ext}`, query) })
  if (!isAdmin) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button small disabled={disabled || run.isPending} onClick={() => run.mutate({ path: pdf, ext: 'pdf' })}>Exportar PDF</Button>
        <Button small disabled={disabled || run.isPending} onClick={() => run.mutate({ path: csv, ext: 'csv' })}>Exportar CSV</Button>
        {run.isPending && <span className="text-sm text-muted">Gerando o arquivo…</span>}
      </div>
      {run.isError && <Banner kind="error">{errorMessage(run.error)}</Banner>}
    </div>
  )
}

function OverdueReport() {
  const [page, setPage] = useState(0)
  const report = useQuery({ queryKey: ['reports', 'overdue', page], queryFn: () => call(api.GET('/api/v1/reports/overdue-loans', { params: { query: { page } } })) })
  return (
    <>
      <ExportButtons pdf="/api/v1/reports/overdue-loans/pdf" csv="/api/v1/reports/overdue-loans/csv" name="overdue-loans" />
      {report.isPending && <Spinner />}
      {report.isError && <Banner kind="error">{errorMessage(report.error)}</Banner>}
      {report.data && report.data.items.length === 0 && <EmptyState>Nenhum empréstimo em atraso.</EmptyState>}
      {report.data && report.data.items.length > 0 && (
        <>
          <DataTable
            rows={report.data.items}
            rowKey={(l) => l.loanId}
            columns={[
              { header: 'Livro', width: '2fr', cell: (l) => (<div className="flex flex-col"><span className="font-medium">{l.bookTitle}</span><span className="font-mono text-xs text-muted">{l.assetCode}</span></div>) },
              { header: 'Leitor', width: '1.4fr', cell: (l) => <Link to={`/leitores/${l.readerId}`} className="text-fg2">{l.readerName}</Link> },
              { header: 'Devolução prevista', width: '1fr', cell: (l) => <span className="font-mono text-[13px] text-fg2">{formatDate(l.dueDate)}</span> },
              { header: 'Atraso', width: '0.8fr', cell: (l) => <Badge color="var(--color-red)">{l.daysLate} {l.daysLate === 1 ? 'dia' : 'dias'}</Badge> },
            ]}
          />
          <Pagination page={report.data.page} totalPages={report.data.totalPages} totalItems={report.data.totalItems} onPage={setPage} />
        </>
      )}
    </>
  )
}

function BorrowedReport() {
  const [period, setPeriod] = useState(() => defaultPeriod(todayIso()))
  const [page, setPage] = useState(0)
  const error = periodError(period.from, period.to)
  const report = useQuery({
    queryKey: ['reports', 'borrowed', period.from, period.to, page],
    enabled: !error,
    queryFn: () => call(api.GET('/api/v1/reports/most-borrowed-books', { params: { query: { from: period.from, to: period.to, page } } })),
  })
  const change = (key: 'from' | 'to', value: string) => { setPeriod({ ...period, [key]: value }); setPage(0) }
  const first = report.data ? report.data.page * report.data.size : 0

  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-40"><TextField id={fid('from')} label="De" type="date" required value={period.from} onChange={(e) => change('from', e.target.value)} /></div>
        <div className="min-w-40"><TextField id={fid('to')} label="Até" type="date" required value={period.to} onChange={(e) => change('to', e.target.value)} /></div>
      </div>
      {error && <Banner kind="error">{error}</Banner>}
      <ExportButtons pdf="/api/v1/reports/most-borrowed-books/pdf" csv="/api/v1/reports/most-borrowed-books/csv" name="most-borrowed-books" query={period} disabled={!!error} />
      {!error && report.isPending && <Spinner />}
      {report.isError && <Banner kind="error">{errorMessage(report.error)}</Banner>}
      {report.data && report.data.items.length === 0 && <EmptyState>Nenhum empréstimo neste período.</EmptyState>}
      {report.data && report.data.items.length > 0 && (
        <>
          <DataTable
            rows={report.data.items.map((b, i) => ({ ...b, position: first + i + 1 }))}
            rowKey={(b) => b.bookId}
            columns={[
              { header: '#', width: '0.4fr', cell: (b) => <span className="font-mono text-muted">{b.position}</span> },
              { header: 'Livro', width: '3fr', cell: (b) => <span className="font-medium">{b.title}</span> },
              { header: 'Empréstimos', width: '1fr', cell: (b) => <span className="font-mono">{b.totalLoans}</span> },
            ]}
          />
          <Pagination page={report.data.page} totalPages={report.data.totalPages} totalItems={report.data.totalItems} onPage={setPage} />
        </>
      )}
    </>
  )
}

function CollectionReport() {
  const report = useQuery({ queryKey: ['reports', 'collection'], queryFn: () => call(api.GET('/api/v1/reports/collection-status')) })
  const d = report.data
  const statuses = Object.keys(copyStatusInfo) as CopyStatus[]
  return (
    <>
      <ExportButtons pdf="/api/v1/reports/collection-status/pdf" csv="/api/v1/reports/collection-status/csv" name="collection-status" />
      {report.isPending && <Spinner />}
      {report.isError && <Banner kind="error">{errorMessage(report.error)}</Banner>}
      {d && (
        <section aria-label="Situação do acervo" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Exemplares ativos" value={d.totalCopies} color="var(--color-yellow)" />
          {statuses.map((s) => <Stat key={s} label={copyStatusInfo[s].label} value={d.activeByStatus[s] ?? 0} color={copyStatusInfo[s].color} />)}
          <Stat label="Inativos" value={d.inactiveCopies} color="var(--color-muted)" />
        </section>
      )}
    </>
  )
}

const Stat = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="flex flex-col gap-1 rounded-[10px] bg-bg0 p-4">
    <span className="text-sm text-fg2">{label}</span>
    <span className="font-mono text-3xl font-bold" style={{ color }}>{value.toLocaleString('pt-BR')}</span>
  </div>
)
