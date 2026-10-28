import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, call, errorMessage } from '../../api/client'
import { LoanStatusBadge } from '../../components/loanStatus'
import { Banner, Button, Card, DataTable, EmptyState, PageHeader, Pagination, Pills, Spinner } from '../../components/ui'
import { formatDate, formatMoney } from '../../lib/dates'

type Tab = 'ACTIVE' | 'OVERDUE' | 'RETURNED'

export function MyLoansPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('ACTIVE')
  const [page, setPage] = useState(0)
  const [renewed, setRenewed] = useState('')

  const loans = useQuery({
    queryKey: ['me', 'loans', tab, page],
    queryFn: () => call(api.GET('/api/v1/me/loans', {
      params: { query: { status: tab === 'RETURNED' ? 'RETURNED' : 'ACTIVE', overdue: tab === 'OVERDUE' ? true : undefined, page } },
    })),
  })
  const renew = useMutation({
    mutationFn: (id: number) => call(api.POST('/api/v1/me/loans/{id}/renew', { params: { path: { id } } })),
    onSuccess: (l) => {
      setRenewed(`Empréstimo renovado. A nova data de devolução é ${formatDate(l.dueDate)}.`)
      void qc.invalidateQueries({ queryKey: ['me'] })
    },
  })

  return (
    <>
      <PageHeader title="Meus empréstimos" subtitle="O que você está lendo e o histórico" />
      <Card>
        <Pills value={tab} onChange={(v) => { setTab(v); setPage(0); setRenewed(''); renew.reset() }} options={[{ value: 'ACTIVE', label: 'Em aberto' }, { value: 'OVERDUE', label: 'Atrasados' }, { value: 'RETURNED', label: 'Devolvidos' }]} />
        {renewed && <Banner kind="success">{renewed}</Banner>}
        {renew.isError && <Banner kind="error">{errorMessage(renew.error)}</Banner>}
        {loans.isPending && <Spinner />}
        {loans.isError && <Banner kind="error">{errorMessage(loans.error)}</Banner>}
        {loans.data && loans.data.items.length === 0 && <EmptyState>Nenhum empréstimo nesta lista.</EmptyState>}
        {loans.data && loans.data.items.length > 0 && (
          <>
            <DataTable
              rows={loans.data.items}
              rowKey={(l) => l.id}
              columns={[
                { header: 'Livro', width: '2fr', cell: (l) => (<div className="flex flex-col"><span className="font-medium">{l.bookTitle ?? '—'}</span><span className="text-xs text-muted">{l.renewals === 0 ? 'não renovado' : `renovado ${l.renewals} ${l.renewals === 1 ? 'vez' : 'vezes'}`}</span></div>) },
                { header: 'Retirada', width: '1fr', cell: (l) => <span className="font-mono text-[13px] text-fg2">{formatDate(l.pickupDate)}</span> },
                { header: tab === 'RETURNED' ? 'Devolvido em' : 'Devolução', width: '1fr', cell: (l) => <span className="font-mono text-[13px] text-fg2">{formatDate(tab === 'RETURNED' ? l.returnDate : l.dueDate)}</span> },
                {
                  header: 'Situação',
                  width: '1.6fr',
                  cell: (l) => (
                    <div className="flex flex-col items-start gap-1">
                      <LoanStatusBadge loan={l} />
                      {l.fine && <span className="text-xs text-orange">Multa {formatMoney(l.fine.amount)}</span>}
                      {l.suspension && <span className="text-xs text-orange">Suspensão até {formatDate(l.suspension.endDate)}</span>}
                    </div>
                  ),
                },
                {
                  header: 'Ação',
                  width: '1fr',
                  label: false,
                  cell: (l) => l.active && (
                    <Button small variant="ghost" disabled={renew.isPending} aria-label={`Renovar ${l.bookTitle ?? 'empréstimo'}`} onClick={() => { setRenewed(''); renew.mutate(l.id) }}>Renovar</Button>
                  ),
                },
              ]}
            />
            <Pagination page={loans.data.page} totalPages={loans.data.totalPages} totalItems={loans.data.totalItems} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  )
}
