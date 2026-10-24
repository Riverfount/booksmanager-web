import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { api, call, errorMessage } from '../api/client'
import { FinesList, SuspensionsList } from '../components/Penalties'
import { LoanStatusBadge } from '../components/loanStatus'
import { Badge, Banner, Card, DataTable, EmptyState, PageHeader, Spinner } from '../components/ui'
import { formatDate } from '../lib/dates'

export function ReaderDetailPage() {
  const id = Number(useParams().id)
  const reader = useQuery({ queryKey: ['reader', id], queryFn: () => call(api.GET('/api/v1/readers/{id}', { params: { path: { id } } })) })
  const loans = useQuery({ queryKey: ['loans', 'reader', id], queryFn: () => call(api.GET('/api/v1/loans', { params: { query: { readerId: id, size: 20 } } })) })
  const r = reader.data

  return (
    <>
      <PageHeader title={r?.name ?? 'Leitor'} subtitle="Dados, empréstimos, multas e suspensões" actions={<Link to="/leitores" className="text-sm">Voltar aos leitores</Link>} />
      {reader.isPending && <Spinner />}
      {reader.isError && <Banner kind="error">{errorMessage(reader.error)}</Banner>}
      {r && (
        <Card>
          <div className="flex flex-wrap gap-2">
            <Badge color={r.active ? '#8ec07c' : '#a89984'}>{r.active ? 'Ativo' : 'Inativo'}</Badge>
            {r.blocked && <Badge color="#fb4934">Bloqueado</Badge>}
          </div>
          <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-6 gap-y-3 text-sm">
            <Info label="Documento" value={r.document} mono />
            <Info label="E-mail" value={r.email} />
            <Info label="Telefone" value={r.phone ?? '—'} />
            <Info label="Nascimento" value={formatDate(r.birthDate)} />
            {r.guardian && <Info label="Responsável" value={`${r.guardian.name} · ${r.guardian.email}${r.guardian.phone ? ` · ${r.guardian.phone}` : ''}`} />}
          </dl>
        </Card>
      )}
      <Card>
        <h2 className="m-0 text-lg font-semibold">Empréstimos</h2>
        {loans.isPending && <Spinner />}
        {loans.data && loans.data.items.length === 0 && <EmptyState>Nenhum empréstimo.</EmptyState>}
        {loans.data && loans.data.items.length > 0 && (
          <DataTable
            rows={loans.data.items}
            rowKey={(l) => l.id}
            columns={[
              { header: 'Livro', width: '2fr', cell: (l) => (<div className="flex flex-col"><span className="font-medium">{l.bookTitle ?? '—'}</span><span className="font-mono text-xs text-muted">{l.assetCode}</span></div>) },
              { header: 'Retirada', width: '1fr', cell: (l) => <span className="font-mono text-[13px]">{formatDate(l.pickupDate)}</span> },
              { header: 'Devolução', width: '1fr', cell: (l) => <span className="font-mono text-[13px]">{formatDate(l.returnDate ?? l.dueDate)}</span> },
              { header: 'Situação', width: '1fr', cell: (l) => <LoanStatusBadge loan={l} /> },
            ]}
          />
        )}
      </Card>
      <Card><h2 className="m-0 text-lg font-semibold">Multas</h2><FinesList readerId={id} /></Card>
      <Card><h2 className="m-0 text-lg font-semibold">Suspensões</h2><SuspensionsList readerId={id} /></Card>
    </>
  )
}

const Info = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex flex-col gap-0.5">
    <dt className="text-xs text-muted">{label}</dt>
    <dd className={`m-0 text-fg ${mono ? 'font-mono' : ''}`}>{value}</dd>
  </div>
)
