import { downloadName } from './download'

describe('downloadName', () => {
  it('usa o nome do Content-Disposition', () => {
    expect(downloadName('attachment; filename="overdue-loans-2026-11-01.pdf"', 'x.pdf')).toBe('overdue-loans-2026-11-01.pdf')
    expect(downloadName('attachment; filename=relatorio.csv', 'x.csv')).toBe('relatorio.csv')
  })
  it('sem o cabeçalho, usa o nome de reserva', () => {
    expect(downloadName(null, 'overdue-loans.pdf')).toBe('overdue-loans.pdf')
    expect(downloadName('attachment', 'overdue-loans.pdf')).toBe('overdue-loans.pdf')
  })
})
