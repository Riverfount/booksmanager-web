import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, call } from '../api/client'
import { useDebounced } from '../lib/useDebounced'
import { Badge, Button } from './ui'

export type BookChoice = { id: number; title: string; availableCopies: number }

/** Book by title search: up to 5 results with their availability; the chosen book shows with a "Trocar" button. */
export function BookPicker({ id, label = 'Livro', required = true, searchLabel = 'Buscar livro pelo título', reader = false, value, onChange, error }: { id: string; label?: string; required?: boolean; searchLabel?: string; reader?: boolean; value: BookChoice | null; onChange: (b: BookChoice | null) => void; error?: string }) {
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim())
  const books = useQuery({
    queryKey: [reader ? 'me' : 'books', 'books', 'picker', q],
    enabled: q.length > 0 && !value,
    // The reader area searches the reader's own catalog (/me/books); both answer id, title and availableCopies.
    queryFn: () => (reader
      ? call(api.GET('/api/v1/me/books', { params: { query: { title: q, size: 5 } } }))
      : call(api.GET('/api/v1/books', { params: { query: { title: q, size: 5, active: true } } }))),
  })

  return (
    <fieldset id={id} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1.5 p-0 text-sm text-fg2">{label}{required && <span aria-hidden="true" className="text-orange"> *</span>}</legend>
      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-bg2 px-3 py-2 text-sm">
          <span>{value.title}</span>
          <Button small onClick={() => { onChange(null); setQuery('') }}>Trocar</Button>
        </div>
      ) : (
        <>
          <input type="search" aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={(e) => setQuery(e.target.value)} className={`box-border h-11 w-full rounded-md border bg-bg0-h px-3 text-[15px] text-fg ${error ? 'border-red' : 'border-line'}`} />
          {books.data && books.data.items.length === 0 && <span className="text-sm text-muted">Nenhum livro encontrado.</span>}
          {books.data && books.data.items.length > 0 && (
            <div className="flex flex-col overflow-hidden rounded-md border border-line bg-bg0-h">
              {books.data.items.map((b) => (
                <button key={b.id} type="button" onClick={() => onChange({ id: b.id, title: b.title, availableCopies: b.availableCopies })} className="flex min-h-11 w-full items-center justify-between gap-3 border-0 border-b border-bg1 bg-transparent px-3 text-left text-fg">
                  <span>{b.title}</span>
                  <Badge color={b.availableCopies === 0 ? 'var(--color-red)' : 'var(--color-green)'}>{b.availableCopies} disponíveis</Badge>
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
