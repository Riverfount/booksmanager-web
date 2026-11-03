import type { CopyStatus } from '../api/types'

// A reader's own reservation has no copy id, only the pickup deadline of the copy being held. The API sends null,
// not absence, for what a queued reservation does not have.
type StateInput = { status: 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED'; copyId?: number | null; pickupDeadline?: string | null; queuePosition?: number | null }

/** Label and color for a reservation: an active one either waits in the queue or holds a copy. */
export function reservationState(r: StateInput): { label: string; color: string } {
  switch (r.status) {
    case 'ACTIVE':
      return r.copyId != null || r.pickupDeadline != null
        ? { label: 'Exemplar guardado', color: 'var(--color-blue)' }
        : { label: r.queuePosition != null ? `Na fila · ${r.queuePosition}º` : 'Na fila', color: 'var(--color-yellow)' }
    case 'FULFILLED': return { label: 'Retirada', color: 'var(--color-green)' }
    case 'CANCELLED': return { label: 'Cancelada', color: 'var(--color-muted)' }
    case 'EXPIRED': return { label: 'Expirada', color: 'var(--color-red)' }
  }
}

/**
 * Immediate feedback for the loan form; the API decides. A reserved copy only goes to the reader who owns the
 * reservation, so without a chosen reader or a loaded reservation nothing is blocked here.
 */
export function lendingIssue(status: CopyStatus, owner: { readerId: number } | undefined, readerId: number | undefined): 'unavailable' | 'reserved-for-other' | undefined {
  if (status === 'AVAILABLE') return undefined
  if (status !== 'RESERVED') return 'unavailable'
  return owner && readerId !== undefined && owner.readerId !== readerId ? 'reserved-for-other' : undefined
}

/** Confirmation after a reservation is made: the API answers with the place in the book's queue. */
export const reservedMessage = (queuePosition?: number): string =>
  queuePosition !== undefined ? `Reserva registrada: lugar ${queuePosition} na fila.` : 'Reserva registrada.'
