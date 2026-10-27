import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, call } from '../api/client'
import { useDebounced } from '../lib/useDebounced'
import { Badge, Button } from './ui'

export type ReaderChoice = { id: number; name: string }

/** Reader by search: type the name, pick one of up to 5 results; the chosen reader shows with a "Trocar" button. */
export function ReaderPicker({ id, value, onChange, error, label = 'Leitor', required = true, searchLabel = 'Buscar leitor pelo nome' }: { id: string; value: ReaderChoice | null; onChange: (r: ReaderChoice | null) => void; error?: string; label?: string; required?: boolean; searchLabel?: string }) {
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim())
  const readers = useQuery({
    queryKey: ['readers', 'picker', q],
    enabled: q.length > 0 && !value,
    queryFn: () => call(api.GET('/api/v1/readers', { params: { query: { name: q, size: 5, active: true } } })),
  })

  return (
    <fieldset id={id} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm text-fg2">{label}{required && <span aria-hidden="true" className="text-orange"> *</span>}</legend>
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-bg2 px-3 py-2 text-sm">
          <span>{value.name}</span>
          <Button small onClick={() => { onChange(null); setQuery('') }}>Trocar</Button>
        </div>
      ) : (
        <>
          <input type="search" aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={(e) => setQuery(e.target.value)} className={`box-border h-11 w-full rounded-md border bg-bg0-h px-3 text-[15px] text-fg ${error ? 'border-red' : 'border-line'}`} />
          {readers.data && readers.data.items.length === 0 && <span className="text-sm text-muted">Nenhum leitor encontrado.</span>}
          {readers.data && readers.data.items.length > 0 && (
            <div className="flex flex-col overflow-hidden rounded-md border border-line bg-bg0-h">
              {readers.data.items.map((r) => (
                <button key={r.id} type="button" onClick={() => onChange({ id: r.id, name: r.name })} className="flex min-h-11 w-full items-center justify-between gap-3 border-0 border-b border-bg1 bg-transparent px-3 text-left text-fg">
                  <span>{r.name} <span className="font-mono text-xs text-muted">{r.maskedDocument}</span></span>
                  {r.blocked && <Badge color="#fb4934">Bloqueado</Badge>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {error && <span className="text-[13px] text-red-text">{error}</span>}
    </fieldset>
  )
}
