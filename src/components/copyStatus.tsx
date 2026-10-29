import type { CopyStatus } from '../api/types'
import { Badge } from './ui'

export const copyStatusInfo: Record<CopyStatus, { label: string; color: string }> = {
  AVAILABLE: { label: 'Disponível', color: 'var(--color-green)' },
  BORROWED: { label: 'Emprestado', color: 'var(--color-yellow)' },
  RESERVED: { label: 'Reservado', color: 'var(--color-blue)' },
  DAMAGED: { label: 'Danificado', color: 'var(--color-orange)' },
  LOST: { label: 'Perdido', color: 'var(--color-red)' },
}

export const CopyStatusBadge = ({ status }: { status: CopyStatus }) => (
  <Badge color={copyStatusInfo[status].color}>{copyStatusInfo[status].label}</Badge>
)
