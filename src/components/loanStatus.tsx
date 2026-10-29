import { Badge } from './ui'

export function LoanStatusBadge({ loan }: { loan: { active: boolean; daysLate?: number } }) {
  if (!loan.active) return <Badge color="var(--color-muted)">Devolvido</Badge>
  if ((loan.daysLate ?? 0) > 0) return <Badge color="var(--color-red)">Atrasado · {loan.daysLate} d</Badge>
  return <Badge color="var(--color-green)">Em dia</Badge>
}
