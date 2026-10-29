import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, call, errorMessage } from '../api/client'
import { longDate, formatDate } from '../lib/dates'
import { LoanStatusBadge } from '../components/loanStatus'
import { Banner, Card, DataTable, EmptyState, PageHeader, Spinner } from '../components/ui'

const palette = ['var(--color-yellow)', 'var(--color-blue)', 'var(--color-pink)', 'var(--color-orange)', 'var(--color-green)']

export function DashboardPage() {
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: () => call(api.GET('/api/v1/reports/dashboard')) })
  const recent = useQuery({
    queryKey: ['loans', 'recent'],
    queryFn: () => call(api.GET('/api/v1/loans', { params: { query: { size: 5 } } })),
  })
  const d = dashboard.data
  const max = Math.max(1, ...(d?.copiesByCategory.map((c) => c.copies) ?? [1]))
  const stats = d && [
    { label: 'Exemplares no acervo', value: d.totalCopies, hint: 'total ativo', color: 'var(--color-yellow)' },
    { label: 'Empréstimos ativos', value: d.activeLoans, hint: 'em andamento hoje', color: 'var(--color-green)' },
    { label: 'Atrasados', value: d.overdueLoans, hint: 'devolução vencida', color: 'var(--color-red)' },
    { label: 'Leitores suspensos', value: d.suspendedReaders, hint: 'com suspensão em vigor', color: 'var(--color-blue)' },
  ]

  return (
    <>
      <PageHeader
        title="Painel"
        subtitle={longDate()}
        actions={
          <>
            <Link to="/livros" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-line px-4 sm:flex-none font-medium !text-fg no-underline">Cadastrar livro</Link>
            <Link to="/emprestimos" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-yellow px-4 sm:flex-none font-semibold !text-bg0-h no-underline">Novo empréstimo</Link>
          </>
        }
      />
      {dashboard.isError && <Banner kind="error">{errorMessage(dashboard.error)}</Banner>}
      {dashboard.isPending && <Spinner />}
      {stats && (
        <section aria-label="Resumo" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1.5 rounded-[10px] bg-bg1 p-4 sm:gap-2 sm:p-5">
              <span className="text-sm text-fg2">{s.label}</span>
              <span className="font-mono text-3xl font-bold sm:text-4xl" style={{ color: s.color }}>{s.value.toLocaleString('pt-BR')}</span>
              <span className="hidden text-[13px] text-muted sm:block">{s.hint}</span>
            </div>
          ))}
        </section>
      )}
      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex-[2_1_520px]">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-lg font-semibold">Empréstimos recentes</h2>
            <Link to="/emprestimos" className="shrink-0 whitespace-nowrap text-sm">Ver todos</Link>
          </div>
          {recent.isPending && <Spinner />}
          {recent.isError && <Banner kind="error">{errorMessage(recent.error)}</Banner>}
          {recent.data && recent.data.items.length === 0 && <EmptyState>Nenhum empréstimo ainda.</EmptyState>}
          {recent.data && recent.data.items.length > 0 && (
            <DataTable
              rows={recent.data.items}
              rowKey={(l) => l.id}
              columns={[
                { header: 'Livro', width: '2fr', cell: (l) => <span className="font-medium">{l.bookTitle ?? '—'}</span> },
                { header: 'Leitor', width: '1.4fr', cell: (l) => <span className="text-fg2">{l.readerName ?? '—'}</span> },
                { header: 'Devolução', width: '0.9fr', cell: (l) => <span className="font-mono text-[13px] text-fg2">{formatDate(l.dueDate)}</span> },
                { header: 'Situação', width: '1fr', cell: (l) => <LoanStatusBadge loan={l} /> },
              ]}
            />
          )}
        </Card>
        <Card className="flex-[1_1_300px] gap-4">
          <h2 className="m-0 text-lg font-semibold">Acervo por categoria</h2>
          {d && d.copiesByCategory.length === 0 && <EmptyState>Sem categorias cadastradas.</EmptyState>}
          {d?.copiesByCategory.map((c, i) => (
            <div key={c.categoryId} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <div className="text-fg2">{c.categoryName}</div>
                  <div className="text-[13px] text-muted">{c.books} {c.books === 1 ? 'livro' : 'livros'}</div>
                </div>
                <div className="shrink-0 whitespace-nowrap text-sm">
                  <span className="font-mono font-semibold">{c.copies}</span>{' '}
                  <span className="text-[13px] text-muted">{c.copies === 1 ? 'exemplar' : 'exemplares'}</span>
                </div>
              </div>
              <div className="h-2 rounded bg-bg2" role="img" aria-label={`${c.copies} ${c.copies === 1 ? 'exemplar' : 'exemplares'}`}>
                <div className="h-2 rounded" style={{ width: `${(c.copies / max) * 100}%`, background: palette[i % palette.length] }} />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </>
  )
}
