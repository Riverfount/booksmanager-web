import { lendingIssue, reservationState, reservedMessage } from './reservations'

describe('reservationState', () => {
  it('reserva que espera exemplar mostra o lugar na fila', () => {
    expect(reservationState({ status: 'ACTIVE', queuePosition: 2 }).label).toBe('Na fila · 2º')
  })
  it('reserva que segura exemplar', () => {
    expect(reservationState({ status: 'ACTIVE', copyId: 9 }).label).toBe('Exemplar guardado')
  })
  it('reserva do leitor não traz o exemplar: o prazo de retirada indica que há um guardado', () => {
    expect(reservationState({ status: 'ACTIVE', pickupDeadline: '2026-11-05' }).label).toBe('Exemplar guardado')
    expect(reservationState({ status: 'ACTIVE', queuePosition: 1 }).label).toBe('Na fila · 1º')
  })
  it('situações encerradas', () => {
    expect(reservationState({ status: 'FULFILLED' }).label).toBe('Retirada')
    expect(reservationState({ status: 'CANCELLED' }).label).toBe('Cancelada')
    expect(reservationState({ status: 'EXPIRED' }).label).toBe('Expirada')
  })
})

describe('lendingIssue', () => {
  it('exemplar disponível pode ser emprestado', () => {
    expect(lendingIssue('AVAILABLE', undefined, 1)).toBeUndefined()
  })
  it('exemplar reservado só sai para o dono da reserva', () => {
    expect(lendingIssue('RESERVED', { readerId: 1 }, 1)).toBeUndefined()
    expect(lendingIssue('RESERVED', { readerId: 2 }, 1)).toBe('reserved-for-other')
  })
  it('sem leitor escolhido ou sem a reserva carregada, quem decide é a API', () => {
    expect(lendingIssue('RESERVED', { readerId: 2 }, undefined)).toBeUndefined()
    expect(lendingIssue('RESERVED', undefined, 1)).toBeUndefined()
  })
  it('emprestado, danificado e perdido não saem', () => {
    expect(lendingIssue('BORROWED', undefined, 1)).toBe('unavailable')
    expect(lendingIssue('DAMAGED', undefined, 1)).toBe('unavailable')
    expect(lendingIssue('LOST', undefined, 1)).toBe('unavailable')
  })
})

describe('reservedMessage', () => {
  it('diz o lugar na fila quando a resposta o traz', () => {
    expect(reservedMessage(3)).toBe('Reserva registrada: lugar 3 na fila.')
    expect(reservedMessage(undefined)).toBe('Reserva registrada.')
  })
})
