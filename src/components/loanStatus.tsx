import { Badge } from './ui'

export function LoanStatusBadge({ loan }: { loan: { active: boolean; daysLate?: number } }) {
  if (!loan.active) return <Badge color="#a89984">Devolvido</Badge>
  if ((loan.daysLate ?? 0) > 0) return <Badge color="#fb4934">Atrasado · {loan.daysLate} d</Badge>
  return <Badge color="#8ec07c">Em dia</Badge>
}
