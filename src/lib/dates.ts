const pad = (n: number) => String(n).padStart(2, '0')

/** Hoje no fuso do navegador, em ISO (yyyy-mm-dd). */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Menor data de nascimento que ainda é menor de 18 anos, em ISO. */
export function adultCutoffIso(now: Date = new Date()): string {
  return `${now.getFullYear() - 18}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Leitor menor de 18 anos (a mesma conta do backend: nascimento + 18 anos depois de hoje). */
export function isMinor(birthIso: string, now: Date = new Date()): boolean {
  return Boolean(birthIso) && birthIso <= todayIso(now) && birthIso > adultCutoffIso(now)
}

/** yyyy-mm-dd -> dd/mm/aaaa, sem passar por Date (evita deslocar o dia pelo fuso). */
export function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return todayIso(date)
}

export function longDate(now: Date = new Date()): string {
  const text = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}
