import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, call, errorMessage } from '../api/client'
import type { AuditAction, AuditEntry, AuditTargetType } from '../api/types'
import { Banner, Button, Card, DataTable, EmptyState, PageHeader, Pagination, SelectField, Spinner, TextField } from '../components/ui'
import { actionLabel, actions, auditFilterError, targetLabel, targetTypes } from '../lib/audit'
import { formatDateTime } from '../lib/dates'
import { fid } from '../lib/form'
import { useDebounced } from '../lib/useDebounced'

const none = { actorId: '', action: '', targetType: '', targetId: '', from: '', to: '' }

/** Audit trail (RF27), administrator only: newest first, with optional filters that combine. */
export function AuditPage() {
  const [filters, setFilters] = useState(none)
  const [page, setPage] = useState(0)
  const targetId = useDebounced(filters.targetId.trim())
  const error = auditFilterError({ ...filters, targetId })

  const users = useQuery({
    queryKey: ['users', 'actors'],
    queryFn: () => call(api.GET('/api/v1/users', { params: { query: { size: 100 } } })),
    staleTime: 60_000,
  })
  const trail = useQuery({
    queryKey: ['audit', filters.actorId, filters.action, filters.targetType, targetId, filters.from, filters.to, page],
    enabled: !error,
    queryFn: () => call(api.GET('/api/v1/audit-log', {
      params: {
        query: {
          actorId: filters.actorId ? Number(filters.actorId) : undefined,
          action: (filters.action || undefined) as AuditAction | undefined,
          targetType: (filters.targetType || undefined) as AuditTargetType | undefined,
          targetId: targetId ? Number(targetId) : undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
          page,
        },
      },
    })),
  })
  const set = (key: keyof typeof none, value: string) => {
    // The target id only makes sense with a target type.
    setFilters((f) => ({ ...f, [key]: value, ...(key === 'targetType' && !value ? { targetId: '' } : {}) }))
    setPage(0)
  }
  const filtered = Object.values(filters).some(Boolean)

  return (
    <>
      <PageHeader title="Auditoria" subtitle="Quem fez o quê e quando (só administrador)" />
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SelectField id={fid('actorId')} label="Quem fez" value={filters.actorId} onChange={(e) => set('actorId', e.target.value)}>
            <option value="">Qualquer usuário</option>
            {users.data?.items.map((u) => <option key={u.id} value={u.id}>{u.login}</option>)}
          </SelectField>
          <SelectField id={fid('action')} label="Ação" value={filters.action} onChange={(e) => set('action', e.target.value)}>
            <option value="">Qualquer ação</option>
            {actions.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
          </SelectField>
          <SelectField id={fid('targetType')} label="Tipo do alvo" value={filters.targetType} onChange={(e) => set('targetType', e.target.value)}>
            <option value="">Qualquer alvo</option>
            {targetTypes.map((t) => <option key={t} value={t}>{targetLabel(t)}</option>)}
          </SelectField>
          <TextField id={fid('targetId')} label="Id do alvo" inputMode="numeric" disabled={!filters.targetType} hint="Escolha antes o tipo do alvo." value={filters.targetId} onChange={(e) => set('targetId', e.target.value)} />
          <TextField id={fid('from')} label="De" type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} />
          <TextField id={fid('to')} label="Até" type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} />
        </div>
        {filtered && <div><Button small onClick={() => { setFilters(none); setPage(0) }}>Limpar filtros</Button></div>}
        {error && <Banner kind="error">{error}</Banner>}
        {!error && trail.isPending && <Spinner />}
        {trail.isError && <Banner kind="error">{errorMessage(trail.error)}</Banner>}
        {trail.data && trail.data.items.length === 0 && <EmptyState>Nenhum registro com estes filtros.</EmptyState>}
        {trail.data && trail.data.items.length > 0 && (
          <>
            <DataTable
              rows={trail.data.items}
              rowKey={(e) => e.id}
              columns={[
                { header: 'Quando', width: '1.1fr', cell: (e) => <span className="font-mono text-[13px] text-fg2">{formatDateTime(e.occurredAt)}</span> },
                { header: 'Quem', width: '1fr', cell: (e) => (e.actorLogin ? <span className="font-mono">{e.actorLogin}</span> : <span className="text-muted">Sistema</span>) },
                { header: 'Ação', width: '1.5fr', cell: (e) => <span className="font-medium">{actionLabel(e.action)}</span> },
                { header: 'Alvo', width: '1.2fr', cell: (e) => <Target entry={e} /> },
                { header: 'Resumo', width: '2fr', cell: (e) => <span className="text-fg2">{e.summary ?? '—'}</span> },
              ]}
            />
            <Pagination page={trail.data.page} totalPages={trail.data.totalPages} totalItems={trail.data.totalItems} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  )
}

function Target({ entry }: { entry: AuditEntry }) {
  if (!entry.targetType) return <span className="text-muted">—</span>
  const text = `${targetLabel(entry.targetType)}${entry.targetId !== undefined ? ` #${entry.targetId}` : ''}`
  return entry.targetType === 'READER' && entry.targetId !== undefined ? <Link to={`/leitores/${entry.targetId}`}>{text}</Link> : <span>{text}</span>
}
