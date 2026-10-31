import { describedBy } from './aria'

describe('describedBy', () => {
  it('junta os ids na ordem em que chegam', () => {
    expect(describedBy('regras', 'campo-hint', 'campo-err')).toBe('regras campo-hint campo-err')
  })

  it('ignora o que está vazio, falso ou ausente', () => {
    expect(describedBy(undefined, '', false, null, 'campo-err')).toBe('campo-err')
    expect(describedBy(false, undefined, null)).toBeUndefined()
  })

  it('devolve undefined quando não há nada a descrever', () => {
    expect(describedBy()).toBeUndefined()
    expect(describedBy('', undefined, false)).toBeUndefined()
  })

  it('aceita vários ids numa string só e não repete nenhum', () => {
    expect(describedBy('a b', 'b', 'c a')).toBe('a b c')
  })

  it('normaliza espaços sobrando', () => {
    expect(describedBy('  a   b ', ' c ')).toBe('a b c')
  })
})
