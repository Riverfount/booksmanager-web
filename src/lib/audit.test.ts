import { actionLabel, actions, auditFilterError, targetLabel, targetTypes } from './audit'

describe('rótulos', () => {
  it('toda ação e todo tipo de alvo têm rótulo em português', () => {
    for (const a of actions) expect(actionLabel(a)).toMatch(/\S/)
    for (const t of targetTypes) expect(targetLabel(t)).toMatch(/\S/)
  })
  it('lista as 28 ações e os 10 tipos de alvo da API', () => {
    expect(actions).toHaveLength(28)
    expect(targetTypes).toHaveLength(10)
  })
  it('exemplos', () => {
    expect(actionLabel('LOGIN_FAILURE')).toBe('Login recusado')
    expect(actionLabel('FINE_WAIVED')).toBe('Multa abonada')
    expect(targetLabel('BOOK')).toBe('Livro')
  })
})

describe('auditFilterError', () => {
  it('sem filtros ou com filtros coerentes, não há erro', () => {
    expect(auditFilterError({})).toBeUndefined()
    expect(auditFilterError({ targetType: 'BOOK', targetId: '7', from: '2026-01-01', to: '2026-01-31' })).toBeUndefined()
    expect(auditFilterError({ from: '2026-01-01' })).toBeUndefined()
  })
  it('o id do alvo exige o tipo', () => {
    expect(auditFilterError({ targetId: '7' })).toBe('Escolha o tipo do alvo para filtrar pelo id.')
  })
  it('o id do alvo é um número inteiro positivo', () => {
    expect(auditFilterError({ targetType: 'BOOK', targetId: 'abc' })).toBe('O id do alvo deve ser um número inteiro positivo.')
    expect(auditFilterError({ targetType: 'BOOK', targetId: '0' })).toBe('O id do alvo deve ser um número inteiro positivo.')
  })
  it('o período não pode estar invertido', () => {
    expect(auditFilterError({ from: '2026-02-01', to: '2026-01-31' })).toBe('A data inicial não pode ser depois da final.')
  })
})
