import type { AuditAction, AuditTargetType } from '../api/types'

// Typed as Records of the API enums: when the backend adds an action or a target, the typecheck points here.
const actionLabels: Record<AuditAction, string> = {
  LOGIN_SUCCESS: 'Login realizado',
  LOGIN_FAILURE: 'Login recusado',
  LOGIN_LOCKOUT: 'Acesso bloqueado por tentativas',
  USER_CREATED: 'Usuário criado',
  USER_UPDATED: 'Usuário alterado',
  USER_DEACTIVATED: 'Usuário inativado',
  USER_UNBLOCKED: 'Usuário desbloqueado',
  USER_REACTIVATED: 'Usuário reativado',
  USER_PASSWORD_CHANGED: 'Senha trocada pelo usuário',
  USER_PASSWORD_RESET: 'Senha de usuário redefinida',
  READER_BLOCKED: 'Leitor bloqueado',
  READER_UNBLOCKED: 'Leitor desbloqueado',
  READER_DEACTIVATED: 'Leitor inativado',
  FINE_PAID: 'Multa paga',
  FINE_WAIVED: 'Multa abonada',
  SUSPENSION_ENDED: 'Suspensão encerrada',
  LIBRARY_CONFIGURATION_UPDATED: 'Configuração alterada',
  BOOK_DEACTIVATED: 'Livro inativado',
  BOOK_REACTIVATED: 'Livro reativado',
  AUTHOR_DEACTIVATED: 'Autor inativado',
  AUTHOR_REACTIVATED: 'Autor reativado',
  CATEGORY_DEACTIVATED: 'Categoria inativada',
  CATEGORY_REACTIVATED: 'Categoria reativada',
  COPY_DEACTIVATED: 'Exemplar inativado',
  COPY_REACTIVATED: 'Exemplar reativado',
  READER_ACCESS_INVITED: 'Convite de acesso enviado',
  READER_ACCESS_GRANTED: 'Acesso do leitor criado',
  READER_ACCESS_REVOKED: 'Acesso do leitor revogado',
  READER_PASSWORD_RESET: 'Senha de leitor redefinida',
  RESERVATION_CANCELLED: 'Reserva cancelada',
  READER_PROFILE_UPDATED: 'Cadastro alterado pelo leitor',
  READER_PASSWORD_CHANGED: 'Senha trocada pelo leitor',
}

const targetLabels: Record<AuditTargetType, string> = {
  USER: 'Usuário',
  READER: 'Leitor',
  FINE: 'Multa',
  SUSPENSION: 'Suspensão',
  LIBRARY_CONFIGURATION: 'Configuração da biblioteca',
  BOOK: 'Livro',
  AUTHOR: 'Autor',
  CATEGORY: 'Categoria',
  COPY: 'Exemplar',
  RESERVATION: 'Reserva',
}

export const actions = Object.keys(actionLabels) as AuditAction[]
export const targetTypes = Object.keys(targetLabels) as AuditTargetType[]
export const actionLabel = (a: AuditAction) => actionLabels[a]
export const targetLabel = (t: AuditTargetType) => targetLabels[t]

/** Mirror of the API rules for the filters (the API answers 400 otherwise); empty strings mean "not filtered". */
export function auditFilterError(f: { targetType?: string; targetId?: string; from?: string; to?: string }): string | undefined {
  if (f.targetId) {
    if (!f.targetType) return 'Escolha o tipo do alvo para filtrar pelo id.'
    if (!/^[1-9]\d*$/.test(f.targetId)) return 'O id do alvo deve ser um número inteiro positivo.'
  }
  if (f.from && f.to && f.from > f.to) return 'A data inicial não pode ser depois da final.'
  return undefined
}
