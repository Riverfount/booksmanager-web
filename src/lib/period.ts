import { addDaysIso } from './dates'

const MAX_DAYS = 366
const DAY_MS = 86_400_000
const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))

/** Mirror of the API rule for the most borrowed report: both dates, in order, at most 366 days with both ends counted. */
export function periodError(from: string, to: string): string | undefined {
  if (!from || !to) return 'Informe a data inicial e a final.'
  if (from > to) return 'A data inicial não pode ser depois da final.'
  if ((utc(to) - utc(from)) / DAY_MS + 1 > MAX_DAYS) return `O período pode ter no máximo ${MAX_DAYS} dias.`
  return undefined
}

/** The last 30 days up to `today` (ISO date), the period the report opens with. */
export const defaultPeriod = (today: string): { from: string; to: string } => ({ from: addDaysIso(today, -29), to: today })
