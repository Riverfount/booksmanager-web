import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, call } from '../api/client'
import { useDebounced } from '../lib/useDebounced'
import { FieldError } from './ui'

export type AuthorChip = { id: number; name: string }

/** Autores por busca (não por lista suspensa): digita, vê até 5 resultados e marca; escolhidos viram chips. */
export function AuthorPicker({ value, onChange, error, id }: { value: AuthorChip[]; onChange: (v: AuthorChip[]) => void; error?: string; id: string }) {
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim())
  const results = useQuery({
    queryKey: ['authors', 'picker', q],
    queryFn: () => call(api.GET('/api/v1/authors', { params: { query: { name: q || undefined, size: 5, active: true } } })),
  })
  const selected = new Set(value.map((a) => a.id))
  const toggle = (a: AuthorChip) => onChange(selected.has(a.id) ? value.filter((x) => x.id !== a.id) : [...value, a])
  const items = results.data?.items ?? []

  return (
    <fieldset id={id} aria-describedby={error ? `${id}-err` : undefined} className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm text-fg2">Autores (ao menos um) <span aria-hidden="true" className="text-orange">*</span></legend>
      <div className="flex flex-wrap items-center gap-2">
        {value.length === 0 && <span className="text-[13px] text-muted">Nenhum autor selecionado.</span>}
        {value.map((a) => (
          <span key={a.id} className="inline-flex min-h-9 items-center gap-0.5 rounded-full bg-bg2 py-0 pr-0.5 pl-3 text-sm">
            {a.name}
            <button type="button" aria-label={`Remover ${a.name}`} onClick={() => toggle(a)} className="inline-flex h-9 w-11 items-center justify-center bg-transparent text-fg2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
            </button>
          </span>
        ))}
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar autor pelo nome"
        aria-label="Buscar autor pelo nome"
        className={`box-border h-11 w-full rounded-md border bg-bg0-h px-3 text-[15px] text-fg ${error ? 'border-red' : 'border-line'}`}
      />
      <div className="flex flex-col overflow-hidden rounded-md border border-line bg-bg0-h">
        {results.isPending && <span className="p-3 text-sm text-muted">Buscando…</span>}
        {results.data && items.length === 0 && <span className="p-3 text-sm text-muted">Nenhum autor encontrado.</span>}
        {items.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={selected.has(a.id)}
            onClick={() => toggle({ id: a.id, name: a.name })}
            className={`flex min-h-11 w-full items-center justify-between gap-3 border-0 border-b border-bg1 px-3 text-left text-fg ${selected.has(a.id) ? 'bg-bg1' : 'bg-transparent'}`}
          >
            <span>{a.name}</span>
            {selected.has(a.id) && <span className="text-xs text-green">Selecionado</span>}
          </button>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-bg0 px-3 py-2.5 text-xs text-muted">
          <span>
            {results.data && results.data.totalItems > items.length
              ? `Mostrando ${items.length} de ${results.data.totalItems}. Continue digitando para filtrar.`
              : `${results.data?.totalItems ?? 0} ${(results.data?.totalItems ?? 0) === 1 ? 'autor encontrado' : 'autores encontrados'}`}
          </span>
          <Link to="/autores" className="text-[13px] font-medium">Cadastrar novo autor</Link>
        </div>
      </div>
      <FieldError id={`${id}-err`} message={error} />
    </fieldset>
  )
}
