import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, call } from '../api/client'
import { useDebounced } from '../lib/useDebounced'
import { NewCategoryDialog } from './NewCategoryDialog'
import { Button, FieldError } from './ui'

export type CategoryChoice = { id: number; name: string }

/** Category by search (not a dropdown, which the API page limit would cap): type, see up to 5 results and pick one. */
export function CategoryPicker({ value, onChange, error, id, legend, searchLabel = 'Buscar categoria pelo nome', required, compact, reader, creatable }: {
  value: CategoryChoice | null
  onChange: (v: CategoryChoice | null) => void
  error?: string
  id: string
  /** Visible title of the field; omit it when the page already labels the field (e.g. a filter). */
  legend?: string
  searchLabel?: string
  required?: boolean
  /** For filters: shows no placeholder and lists results only while the user is typing. */
  compact?: boolean
  /** For the reader area: searches `/me/categories` (active ones only) and skips the staff-only lookup by id. */
  reader?: boolean
  /** Offers "Cadastrar nova categoria" (staff form only; ignored for filters and the reader area). */
  creatable?: boolean
}) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const q = useDebounced(query.trim())
  const results = useQuery({
    queryKey: ['categories', 'picker', reader ? 'me' : 'staff', q],
    queryFn: () => reader
      ? call(api.GET('/api/v1/me/categories', { params: { query: { name: q || undefined, size: 5 } } }))
      : call(api.GET('/api/v1/categories', { params: { query: { name: q || undefined, size: 5, active: true } } })),
  })
  // The list shows only active categories; the real flag of the chosen one tells whether it was deactivated later.
  const chosen = useQuery({
    queryKey: ['categories', value?.id],
    queryFn: () => call(api.GET('/api/v1/categories/{id}', { params: { path: { id: value!.id } } })),
    enabled: !!value && !reader,
  })
  const items = results.data?.items ?? []
  const inactive = !!value && chosen.data?.active === false
  const canCreate = !!creatable && !compact && !reader

  return (
    <fieldset id={id} aria-describedby={error ? `${id}-err` : undefined} className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
      {legend && (
        <legend className="mb-1.5 p-0 text-sm text-fg2">
          {legend} {required && <span aria-hidden="true" className="text-orange">*</span>}
        </legend>
      )}
      {(value || !compact) && (
        <div className="flex flex-wrap items-center gap-2">
          {!value && <span className="text-[13px] text-muted">Nenhuma categoria selecionada.</span>}
          {value && (
            <span className="inline-flex min-h-9 items-center gap-0.5 rounded-full bg-bg2 py-0 pr-0.5 pl-3 text-sm">
              {inactive ? `${value.name} (inativa)` : value.name}
              <button type="button" aria-label={`Remover ${value.name}`} onClick={() => onChange(null)} className="inline-flex h-9 w-11 items-center justify-center bg-transparent text-fg2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </span>
          )}
        </div>
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={compact ? 'Categoria' : 'Buscar categoria pelo nome'}
        aria-label={searchLabel}
        className={`box-border h-11 w-full rounded-md border bg-bg0-h px-3 text-[15px] text-fg ${error ? 'border-red' : 'border-line'}`}
      />
      {(!compact || q) && (
        <div className="flex flex-col overflow-hidden rounded-md border border-line bg-bg0-h">
          {results.isPending && <span className="p-3 text-sm text-muted">Buscando…</span>}
          {results.data && items.length === 0 && <span className="p-3 text-sm text-muted">Nenhuma categoria encontrada.</span>}
          {items.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={value?.id === c.id}
              onClick={() => onChange({ id: c.id, name: c.name })}
              className={`flex min-h-11 w-full items-center justify-between gap-3 border-0 border-b border-bg1 px-3 text-left text-fg ${value?.id === c.id ? 'bg-bg1' : 'bg-transparent'}`}
            >
              <span>{c.name}</span>
              {value?.id === c.id && <span className="text-xs text-green">Selecionada</span>}
            </button>
          ))}
          {(canCreate || (results.data && results.data.totalItems > items.length)) && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-bg0 px-3 py-2.5 text-xs text-muted">
              <span>{results.data && results.data.totalItems > items.length ? `Mostrando ${items.length} de ${results.data.totalItems}. Continue digitando para filtrar.` : ''}</span>
              {canCreate && <Button small variant="ghost" onClick={() => setCreating(true)}>Cadastrar nova categoria</Button>}
            </div>
          )}
        </div>
      )}
      <FieldError id={`${id}-err`} message={error} />
      {creating && (
        <NewCategoryDialog
          initialName={query.trim()}
          onClose={() => setCreating(false)}
          onCreated={(c) => {
            onChange(c)
            setCreating(false)
          }}
        />
      )}
    </fieldset>
  )
}
