import { passwordChecks } from '../lib/schemas'

/** Lista de regras da senha que acende conforme a pessoa digita. Depois do envio, as que faltam ficam em vermelho. */
export function PasswordRules({ id, password, submitted }: { id: string; password: string; submitted: boolean }) {
  return (
    <ul id={id} aria-label="Regras da senha" className="m-0 flex list-none flex-col gap-1 p-0">
      {passwordChecks(password).map((c) => (
        <li key={c.text} className={`flex items-center gap-2 text-[13px] ${c.met ? 'text-green' : submitted ? 'text-red-text' : 'text-fg3'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
            {c.met ? <path d="M5 12l5 5 9-10" /> : <circle cx="12" cy="12" r="8" />}
          </svg>
          <span>{c.text}<span className="sr-only">{c.met ? ' (atendida)' : ' (não atendida)'}</span></span>
        </li>
      ))}
    </ul>
  )
}
