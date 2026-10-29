import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, call } from '../api/client'
import { useDebounced } from '../lib/useDebounced'

export type UserChoice = { id: number; login: string }

/** User by search on the login (not a dropdown, which the API page limit would cap): type, see up to 5 results and pick one. */
export function UserPicker({ label, value, onChange }: { label: string; value: UserChoice | null; onChange: (v: UserChoice | null) => void }) {
  const id = useId()
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim())
  const results = useQuery({
    queryKey: ['users', 'picker', q],
    queryFn: () => call(api.GET('/api/v1/users', { params: { query: { login: q, size: 5 } } })),
    enabled: q !== '',
  })
  const items = results.data?.items ?? []

  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-sm text-fg2">
      <label htmlFor={id}>{label}</label>
      {value && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-9 items-center gap-0.5 rounded-full bg-bg2 py-0 pr-0.5 pl-3 text-sm text-fg">
            {value.login}
            <button type="button" aria-label={`Remover ${value.login}`} onClick={() => onChange(null)} className="inline-flex h-9 w-11 items-center justify-center bg-transparent text-fg2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
            </button>
          </span>
        </div>
      )}
      <input
        id={id}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={value ? 'Trocar usuário' : 'Qualquer usuário'}
        autoComplete="off"
        className="box-border h-11 w-full rounded-md border border-line bg-bg0-h px-3 text-[15px] text-fg"
      />
      {q !== '' && (
        <div className="flex flex-col overflow-hidden rounded-md border border-line bg-bg0-h">
          {results.isPending && <span className="p-3 text-sm text-muted">Buscando…</span>}
          {results.data && items.length === 0 && <span className="p-3 text-sm text-muted">Nenhum usuário encontrado.</span>}
          {items.map((u) => (
            <button
              key={u.id}
              type="button"
              aria-pressed={value?.id === u.id}
              onClick={() => { onChange({ id: u.id, login: u.login }); setQuery('') }}
              className={`flex min-h-11 w-full items-center justify-between gap-3 border-0 border-b border-bg1 px-3 text-left text-fg ${value?.id === u.id ? 'bg-bg1' : 'bg-transparent'}`}
            >
              <span>{u.login}</span>
            </button>
          ))}
          {results.data && results.data.totalItems > items.length && (
            <span className="bg-bg0 px-3 py-2.5 text-xs text-muted">Mostrando {items.length} de {results.data.totalItems}. Continue digitando para filtrar.</span>
          )}
        </div>
      )}
    </div>
  )
}
