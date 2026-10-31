import { maskAssetCodePrefix, maskDocument, maskPhone, maskIsbn, normalizeDocument } from './masks'

describe('máscaras', () => {
  it('formata CPF conforme digita', () => {
    expect(maskDocument('12345678901')).toBe('123.456.789-01')
    expect(maskDocument('1234')).toBe('123.4')
  })
  it('não força CPF em documento com letras', () => {
    expect(maskDocument('mg-12.345.678')).toBe('MG-12.345.678')
  })
  it('formata telefone brasileiro de 10 e 11 dígitos', () => {
    expect(maskPhone('1198765432')).toBe('(11) 9876-5432')
    expect(maskPhone('11987654321')).toBe('(11) 98765-4321')
    expect(maskPhone('1')).toBe('(1')
    expect(maskPhone('')).toBe('')
  })
  it('mantém telefone internacional', () => {
    expect(maskPhone('+351 912 345 678')).toBe('+351 912 345 678')
  })
  it('limpa ISBN e normaliza documento como o backend', () => {
    expect(maskIsbn('978-85-333x!')).toBe('978-85-333X')
    expect(normalizeDocument('123.456.789-01')).toBe('12345678901')
    expect(normalizeDocument('mg 12.345')).toBe('MG12345')
  })
  it('prefixo do patrimônio: maiúsculas, no máximo 4 caracteres, sem esconder o que está errado', () => {
    expect(maskAssetCodePrefix('bib')).toBe('BIB')
    expect(maskAssetCodePrefix('abcdef')).toBe('ABCD')
    // digits and symbols stay visible, so the schema can point at them
    expect(maskAssetCodePrefix('p4t')).toBe('P4T')
    expect(maskAssetCodePrefix('')).toBe('')
  })
})
