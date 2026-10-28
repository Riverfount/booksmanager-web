import { defaultPeriod, periodError } from './period'

describe('periodError', () => {
  it('aceita um período válido, com as duas pontas incluídas', () => {
    expect(periodError('2026-01-01', '2026-01-31')).toBeUndefined()
    expect(periodError('2026-05-05', '2026-05-05')).toBeUndefined()
  })
  it('exige as duas datas', () => {
    expect(periodError('', '2026-01-31')).toBe('Informe a data inicial e a final.')
    expect(periodError('2026-01-01', '')).toBe('Informe a data inicial e a final.')
  })
  it('recusa período invertido', () => {
    expect(periodError('2026-02-01', '2026-01-31')).toBe('A data inicial não pode ser depois da final.')
  })
  it('aceita até 366 dias contados com as duas pontas', () => {
    expect(periodError('2024-01-01', '2024-12-31')).toBeUndefined() // 366 days, leap year
    expect(periodError('2026-01-01', '2026-12-31')).toBeUndefined() // 365 days
    expect(periodError('2025-01-01', '2026-01-02')).toBe('O período pode ter no máximo 366 dias.') // 367 days
  })
})

describe('defaultPeriod', () => {
  it('vai dos últimos 30 dias até hoje', () => {
    expect(defaultPeriod('2026-11-30')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(defaultPeriod('2026-03-10')).toEqual({ from: '2026-02-09', to: '2026-03-10' })
  })
})
