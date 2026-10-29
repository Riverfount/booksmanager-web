import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type Ref } from 'react'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

/* ---------- Botões ---------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'danger' | 'ghost'
  small?: boolean
}
export function Button({ variant = 'outline', small, className, type = 'button', ...rest }: ButtonProps) {
  const styles = {
    primary: 'bg-yellow text-bg0-h font-semibold border-0',
    outline: 'bg-transparent text-fg border border-line-strong font-medium',
    danger: 'bg-transparent text-orange border border-orange font-medium',
    ghost: 'bg-transparent text-blue border border-blue font-medium',
  }[variant]
  return (
    <button
      type={type}
      className={cx('rounded-md px-4', small ? 'min-h-11 text-[13px] px-3' : 'min-h-11 text-[15px]', styles, className)}
      {...rest}
    />
  )
}

export function IconButton({ label, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className="inline-flex size-11 items-center justify-center rounded-md bg-transparent text-blue" {...rest}>
      {children}
    </button>
  )
}

/* ---------- Campos ---------- */
type FieldShellProps = { id: string; label: ReactNode; required?: boolean; hint?: string; error?: string; children: ReactNode }
export function FieldShell({ id, label, required, hint, error, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5 text-sm text-fg2">
      <label htmlFor={id}>
        {label} {required && <span aria-hidden="true" className="text-orange">*</span>}
      </label>
      {children}
      {hint && <span id={`${id}-hint`} className="text-xs text-fg3">{hint}</span>}
      <FieldError id={`${id}-err`} message={error} />
    </div>
  )
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null
  return (
    <span id={id} className="flex items-start gap-1.5 text-[13px] text-red-text">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" />
      </svg>
      {message}
    </span>
  )
}

const inputBase = 'h-11 w-full box-border rounded-md bg-bg0-h px-3 text-[15px] text-fg border'
type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode
  error?: string
  hint?: string
  mono?: boolean
  ref?: Ref<HTMLInputElement>
}
export function TextField({ label, error, hint, mono, required, id, className, ...rest }: TextFieldProps) {
  const auto = useId()
  const fid = id ?? auto
  const describedBy = [hint && `${fid}-hint`, error && `${fid}-err`].filter(Boolean).join(' ') || undefined
  return (
    <FieldShell id={fid} label={label} required={required} hint={hint} error={error}>
      <input
        id={fid}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(inputBase, error ? 'border-red' : 'border-line', mono && 'font-mono', className)}
        {...rest}
      />
    </FieldShell>
  )
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string; ref?: Ref<HTMLSelectElement> }
export function SelectField({ label, error, hint, required, id, children, ...rest }: SelectFieldProps) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell id={fid} label={label} required={required} hint={hint} error={error}>
      <select
        id={fid}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fid}-err` : undefined}
        className={cx(inputBase, error ? 'border-red' : 'border-line')}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  )
}

export const SearchInput = ({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className="flex flex-col">
    <span className="sr-only">{label}</span>
    <input type="search" aria-label={label} className={cx(inputBase, 'w-72 max-w-full border-line px-3.5')} {...rest} />
  </label>
)

/* ---------- Avisos ---------- */
export const RequiredNote = () => (
  <span className="text-xs text-fg3"><span aria-hidden="true" className="text-orange">*</span> Campo obrigatório</span>
)

export function ErrorSummary({ title, items }: { title: string; items: { id: string; message: string }[] }) {
  if (items.length === 0) return null
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-lg border border-red bg-bg0 px-4 py-3.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-red-text">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l10 18H2z" /><path d="M12 10v5" /><path d="M12 18h.01" />
        </svg>
        {title}
      </div>
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[13px] text-fg2">
        {items.map((i) => (
          <li key={i.id}><a href={`#${i.id}`}>{i.message}</a></li>
        ))}
      </ul>
    </div>
  )
}

export function Banner({ kind, children }: { kind: 'success' | 'error' | 'info'; children: ReactNode }) {
  const color = { success: 'border-green', error: 'border-red', info: 'border-line-strong' }[kind]
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={cx('flex items-start gap-2.5 rounded-lg border bg-bg0 px-3.5 py-3 text-sm', color)}>
      {kind === 'success' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-green)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
          <path d="M5 12l5 5 9-10" />
        </svg>
      )}
      <span>{children}</span>
    </div>
  )
}

/* ---------- Estrutura ---------- */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-mono text-3xl font-bold">{title}</h1>
        {subtitle && <span className="text-[15px] text-muted">{subtitle}</span>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  )
}

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <section className={cx('flex min-w-0 flex-col gap-3 rounded-[10px] border border-bg1 bg-bg0-s p-5', className)}>{children}</section>
)
export const FormCard = ({ title, children, className }: { title: string; children: ReactNode; className?: string }) => (
  <section className={cx('flex min-w-0 flex-col gap-4 rounded-[10px] bg-bg1 p-6', className)}>
    <h2 className="m-0 font-mono text-lg font-semibold text-yellow">{title}</h2>
    {children}
  </section>
)

export function Badge({ color, children }: { color: string; children: ReactNode }) {
  return <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-bg0-h" style={{ background: color }}>{children}</span>
}

export function Pills<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div role="group" className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx('min-h-9 rounded-full px-3.5 text-[13px]', o.value === value ? 'bg-yellow font-semibold text-bg0-h' : 'border border-line bg-transparent text-fg2')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return <p role="status" className="m-0 py-6 text-center text-sm text-muted">{label}</p>
}
export const EmptyState = ({ children }: { children: ReactNode }) => <p className="m-0 py-6 text-center text-sm text-muted">{children}</p>

export function Pagination({ page, totalPages, totalItems, onPage }: { page: number; totalPages: number; totalItems: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return <span className="text-xs text-muted">{totalItems} {totalItems === 1 ? 'registro' : 'registros'}</span>
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm text-fg2">
      <span>Página {page + 1} de {totalPages} · {totalItems} registros</span>
      <div className="flex gap-2">
        <Button small disabled={page === 0} onClick={() => onPage(page - 1)}>Anterior</Button>
        <Button small disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)}>Próxima</Button>
      </div>
    </nav>
  )
}

/* ---------- Lista em tabela responsiva ---------- */
export type Column<T> = { header: string; width?: string; cell: (row: T) => ReactNode; label?: boolean }
export function DataTable<T>({ columns, rows, rowKey }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string | number }) {
  const cols = columns.map((c) => c.width ?? '1fr').join(' ')
  return (
    <div className="tbl" style={{ ['--cols' as string]: cols }} role="table">
      <div className="thead" role="row">
        {columns.map((c) => <span key={c.header} role="columnheader">{c.header}</span>)}
      </div>
      {rows.map((row) => (
        <div className="trow" role="row" key={rowKey(row)}>
          {columns.map((c, i) => (
            <div key={c.header} role="cell" data-label={i > 0 && c.label !== false ? c.header : undefined} className="min-w-0">
              {c.cell(row)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/* ---------- Diálogo (confirmação / justificativa) ---------- */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className="flex w-full max-w-md flex-col gap-4 rounded-[10px] border border-line bg-bg1 p-6"
      >
        <h2 id={id} className="m-0 font-mono text-lg font-semibold text-yellow">{title}</h2>
        {children}
      </div>
    </div>
  )
}
