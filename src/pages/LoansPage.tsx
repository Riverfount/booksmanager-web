import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, call, errorMessage } from '../api/client'
import type { LoanDetails, ReturnCondition, ReturnLoanResult } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { CopyStatusBadge, copyStatusInfo } from '../components/copyStatus'
import { LoanStatusBadge } from '../components/loanStatus'
import { Badge, Banner, Button, Card, DataTable, Dialog, EmptyState, ErrorSummary, FormCard, PageHeader, Pagination, Pills, RequiredNote, SelectField, Spinner, TextField } from '../components/ui'
import { addDaysIso, formatDate, formatMoney, todayIso } from '../lib/dates'
import { fid } from '../lib/form'
import { useDebounced } from '../lib/useDebounced'

type Tab = 'ACTIVE' | 'OVERDUE' | 'RETURNED'

export function LoansPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('ACTIVE')
  const [page, setPage] = useState(0)
  const [returning, setReturning] = useState<LoanDetails | null>(null)

  const rules = useQuery({ queryKey: ['rules'], queryFn: () => call(api.GET('/api/v1/library-configuration/rules')), staleTime: 60_000 })
  const loans = useQuery({
    queryKey: ['loans', tab, page],
    queryFn: () => call(api.GET('/api/v1/loans', {
      params: { query: { status: tab === 'RETURNED' ? 'RETURNED' : 'ACTIVE', overdue: tab === 'OVERDUE' ? true : undefined, page } },
    })),
  })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['loans'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
    void qc.invalidateQueries({ queryKey: ['books'] })
    void qc.invalidateQueries({ queryKey: ['copies'] })
  }
  const renew = useMutation({
    mutationFn: (id: number) => call(api.POST('/api/v1/loans/{id}/renew', { params: { path: { id } } })),
    onSuccess: refresh,
  })
  const limit = rules.data?.renewalLimit

  return (
    <>
      <PageHeader title="Empréstimos" subtitle="Registro de saídas e devoluções" />
      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex-[2_1_560px]">
          <Pills value={tab} onChange={(v) => { setTab(v); setPage(0) }} options={[{ value: 'ACTIVE', label: 'Em aberto' }, { value: 'OVERDUE', label: 'Atrasados' }, { value: 'RETURNED', label: 'Devolvidos' }]} />
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
                  { header: 'Livro', width: '2fr', cell: (l) => (<div className="flex flex-col"><span className="font-medium">{l.bookTitle ?? '—'}</span><span className="font-mono text-xs text-muted">{l.assetCode} · renovado {l.renewals}{limit !== undefined ? `/${limit}` : ''}</span></div>) },
                  { header: 'Leitor', width: '1.4fr', cell: (l) => <Link to={`/leitores/${l.readerId}`} className="text-fg2">{l.readerName ?? `Leitor #${l.readerId}`}</Link> },
                  { header: tab === 'RETURNED' ? 'Devolvido em' : 'Devolução', width: '0.9fr', cell: (l) => <span className="font-mono text-[13px] text-fg2">{formatDate(tab === 'RETURNED' ? l.returnDate : l.dueDate)}</span> },
                  { header: 'Situação', width: '1.5fr', cell: (l) => <LoanStatusBadge loan={l} /> },
                  {
                    header: 'Ação',
                    width: '1.6fr',
                    label: false,
                    cell: (l) => l.active && (
                      <div className="flex flex-wrap gap-2">
                        <Button small variant="ghost" disabled={renew.isPending || (limit !== undefined && l.renewals >= limit)} onClick={() => renew.mutate(l.id)}>Renovar</Button>
                        <Button small variant="primary" onClick={() => setReturning(l)}>Devolver</Button>
                      </div>
                    ),
                  },
                ]}
              />
              <Pagination page={loans.data.page} totalPages={loans.data.totalPages} totalItems={loans.data.totalItems} onPage={setPage} />
            </>
          )}
          <p className="m-0 text-xs text-muted">Devoluções em atraso aplicam a penalidade (multa e/ou suspensão) conforme a configuração da biblioteca.</p>
        </Card>
        <NewLoan rules={rules.data} onDone={refresh} />
      </div>
      {returning && <ReturnDialog loan={returning} onClose={() => setReturning(null)} onDone={refresh} />}
    </>
  )
}

function NewLoan({ rules, onDone }: { rules?: { loanPeriodDays: number; loanLimit: number }; onDone: () => void }) {
  const { state } = useAuth()
  const [readerQuery, setReaderQuery] = useState('')
  const [reader, setReader] = useState<{ id: number; name: string } | null>(null)
  const [code, setCode] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [done, setDone] = useState(false)
  const q = useDebounced(readerQuery.trim())
  const codeQ = useDebounced(code.trim())

  const readers = useQuery({
    queryKey: ['readers', 'picker', q],
    enabled: q.length > 0 && !reader,
    queryFn: () => call(api.GET('/api/v1/readers', { params: { query: { name: q, size: 5, active: true } } })),
  })
  const copy = useQuery({
    queryKey: ['copies', 'code', codeQ],
    enabled: codeQ.length > 0,
    queryFn: async () => (await call(api.GET('/api/v1/copies', { params: { query: { assetCode: codeQ, size: 1 } } }))).items[0] ?? null,
  })
  const book = useQuery({
    queryKey: ['book', copy.data?.bookId],
    enabled: !!copy.data,
    queryFn: () => call(api.GET('/api/v1/books/{id}', { params: { path: { id: copy.data!.bookId } } })),
  })

  const register = useMutation({
    mutationFn: () => call(api.POST('/api/v1/loans', { body: { copyId: copy.data!.id, readerId: reader!.id } })),
    onSuccess: () => { setDone(true); setSubmitted(false); setReader(null); setReaderQuery(''); setCode(''); onDone() },
  })

  const lookingUp = code.trim() !== codeQ || copy.isFetching
  const errors: { id: string; message: string }[] = []
  if (!reader) errors.push({ id: fid('reader'), message: 'Leitor: selecione o leitor.' })
  if (!code.trim()) errors.push({ id: fid('assetCode'), message: 'Exemplar: informe o código de patrimônio.' })
  else if (!lookingUp && copy.data === null) errors.push({ id: fid('assetCode'), message: 'Exemplar: nenhum exemplar com este código.' })
  else if (!lookingUp && copy.data && copy.data.status !== 'AVAILABLE') errors.push({ id: fid('assetCode'), message: `Exemplar: não está disponível (${copyStatusInfo[copy.data.status].label.toLowerCase()}).` })
  const shown = (id: string) => (submitted ? errors.find((e) => e.id === id)?.message : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setDone(false)
    if (errors.length === 0 && !lookingUp) register.mutate()
  }
  const today = todayIso()

  return (
    <FormCard title="Novo empréstimo" className="flex-[1_1_340px]">
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <RequiredNote />
        {done && !register.isPending && <Banner kind="success">Empréstimo registrado.</Banner>}
        {register.isError && <Banner kind="error">{errorMessage(register.error)}</Banner>}
        <ErrorSummary title={errors.length === 1 ? 'Corrija 1 campo para registrar o empréstimo.' : `Corrija ${errors.length} campos para registrar o empréstimo.`} items={submitted ? errors : []} />

        <fieldset id={fid('reader')} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-1.5 p-0 text-sm text-fg2">Leitor <span aria-hidden="true" className="text-orange">*</span></legend>
          {reader ? (
            <div className="flex items-center justify-between gap-2 rounded-md bg-bg2 px-3 py-2 text-sm">
              <span>{reader.name}</span>
              <Button small onClick={() => setReader(null)}>Trocar</Button>
            </div>
          ) : (
            <>
              <input type="search" aria-label="Buscar leitor pelo nome" placeholder="Buscar leitor pelo nome" value={readerQuery} onChange={(e) => setReaderQuery(e.target.value)} className={`box-border h-11 w-full rounded-md border bg-bg0-h px-3 text-[15px] text-fg ${shown(fid('reader')) ? 'border-red' : 'border-line'}`} />
              {readers.data && readers.data.items.length === 0 && <span className="text-sm text-muted">Nenhum leitor encontrado.</span>}
              {readers.data && readers.data.items.length > 0 && (
                <div className="flex flex-col overflow-hidden rounded-md border border-line bg-bg0-h">
                  {readers.data.items.map((r) => (
                    <button key={r.id} type="button" onClick={() => setReader({ id: r.id, name: r.name })} className="flex min-h-11 w-full items-center justify-between gap-3 border-0 border-b border-bg1 bg-transparent px-3 text-left text-fg">
                      <span>{r.name} <span className="font-mono text-xs text-muted">{r.maskedDocument}</span></span>
                      {r.blocked && <Badge color="#fb4934">Bloqueado</Badge>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {shown(fid('reader')) && <span className="text-[13px] text-red-text">{shown(fid('reader'))}</span>}
        </fieldset>

        <TextField id={fid('assetCode')} label="Exemplar" required mono maxLength={50} autoComplete="off" placeholder="Ex.: PAT-0004" hint="Só exemplares disponíveis podem ser emprestados." error={shown(fid('assetCode'))} value={code} onChange={(e) => setCode(e.target.value)} />
        {copy.data && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-bg0 px-3 py-2 text-sm">
            <span className="font-medium">{book.data?.title ?? 'Carregando livro…'}</span>
            <CopyStatusBadge status={copy.data.status} />
          </div>
        )}

        <div className="flex flex-col gap-1 rounded-md bg-bg0 p-3 text-sm">
          <span className="text-fg2">Prazo definido pela biblioteca</span>
          {rules ? (
            <>
              <span className="font-mono text-yellow">{rules.loanPeriodDays} dias · devolução em {formatDate(addDaysIso(today, rules.loanPeriodDays))}</span>
              <span className="text-xs text-muted">Limite de {rules.loanLimit} empréstimos ativos por leitor.</span>
            </>
          ) : <span className="text-muted">Carregando…</span>}
        </div>
        <div className="flex flex-col gap-0.5 text-sm"><span className="text-xs text-muted">Operador responsável</span><span>{state.user?.displayName || state.user?.login}</span></div>
        <div className="flex justify-end gap-3">
          <Button onClick={() => { setReader(null); setReaderQuery(''); setCode(''); setSubmitted(false); setDone(false) }}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={register.isPending}>Registrar empréstimo</Button>
        </div>
      </form>
    </FormCard>
  )
}

const conditions: { value: ReturnCondition; label: string }[] = [
  { value: 'GOOD', label: 'Em bom estado' },
  { value: 'DAMAGED', label: 'Danificado' },
  { value: 'LOST', label: 'Perdido' },
]

function ReturnDialog({ loan, onClose, onDone }: { loan: LoanDetails; onClose: () => void; onDone: () => void }) {
  const [condition, setCondition] = useState<ReturnCondition>('GOOD')
  const [result, setResult] = useState<ReturnLoanResult | null>(null)
  const give = useMutation({
    mutationFn: () => call(api.POST('/api/v1/loans/{id}/return', { params: { path: { id: loan.id } }, body: { condition } })),
    onSuccess: (r) => { setResult(r); onDone() },
  })

  return (
    <Dialog title="Devolver exemplar" onClose={onClose}>
      <p className="m-0 text-sm text-fg2">{loan.bookTitle} · <span className="font-mono">{loan.assetCode}</span> · {loan.readerName}</p>
      {!result ? (
        <>
          <SelectField label="Condição do exemplar" value={condition} onChange={(e) => setCondition(e.target.value as ReturnCondition)}>
            {conditions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </SelectField>
          {give.isError && <Banner kind="error">{errorMessage(give.error)}</Banner>}
          <div className="flex justify-end gap-3">
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="primary" disabled={give.isPending} onClick={() => give.mutate()}>Confirmar devolução</Button>
          </div>
        </>
      ) : (
        <>
          <Banner kind="success">Devolução registrada.</Banner>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
            <li>{result.daysLate > 0 ? `Atraso de ${result.daysLate} ${result.daysLate === 1 ? 'dia' : 'dias'}.` : 'Devolvido no prazo.'}</li>
            {result.fine && <li className="text-orange">Multa gerada: {formatMoney(result.fine.amount)} (pendente até o pagamento ou abono).</li>}
            {result.suspension && <li className="text-orange">Leitor suspenso até {formatDate(result.suspension.endDate)}.</li>}
          </ul>
          <div className="flex justify-end"><Button variant="primary" onClick={onClose}>Concluir</Button></div>
        </>
      )}
    </Dialog>
  )
}
