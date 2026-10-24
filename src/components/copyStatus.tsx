import type { CopyStatus } from '../api/types'
import { Badge } from './ui'

export const copyStatusInfo: Record<CopyStatus, { label: string; color: string }> = {
  AVAILABLE: { label: 'Disponível', color: '#8ec07c' },
  BORROWED: { label: 'Emprestado', color: '#fabd2f' },
  RESERVED: { label: 'Reservado', color: '#83a598' },
  DAMAGED: { label: 'Danificado', color: '#fe8019' },
  LOST: { label: 'Perdido', color: '#fb4934' },
}

export const CopyStatusBadge = ({ status }: { status: CopyStatus }) => (
  <Badge color={copyStatusInfo[status].color}>{copyStatusInfo[status].label}</Badge>
)
