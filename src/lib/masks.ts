/** Documento: com 11 dígitos numéricos vira CPF (000.000.000-00); qualquer outro vale como está (RG, matrícula...). */
export function maskDocument(text: string): string {
  if (/^[0-9.-]*$/.test(text)) {
    const d = text.replace(/\D/g, '').slice(0, 11)
    let out = d.slice(0, 3)
    if (d.length > 3) out += '.' + d.slice(3, 6)
    if (d.length > 6) out += '.' + d.slice(6, 9)
    if (d.length > 9) out += '-' + d.slice(9, 11)
    return out
  }
  return text.toUpperCase().slice(0, 40)
}

/** Telefone brasileiro: (11) 98765-4321. Com "+" no começo mantém o formato internacional digitado. */
export function maskPhone(text: string): string {
  if (text.trim().startsWith('+')) return text.replace(/[^0-9 ()\-+]/g, '').slice(0, 30)
  const d = text.replace(/\D/g, '').slice(0, 11)
  if (!d) return ''
  const cut = d.length > 10 ? 7 : 6
  let out = '(' + d.slice(0, 2)
  if (d.length > 2) out += ') ' + d.slice(2, cut)
  if (d.length > cut) out += '-' + d.slice(cut)
  return out
}

export const maskIsbn = (text: string) => text.replace(/[^0-9Xx\- ]/g, '').toUpperCase().slice(0, 17)
export const maskYear = (text: string) => text.replace(/\D/g, '').slice(0, 4)
export const onlyDigits = (text: string) => text.replace(/\D/g, '')

/** Igual à normalização do backend: sem pontuação nem espaços, em maiúsculas. */
export const normalizeDocument = (text: string) => text.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase()
