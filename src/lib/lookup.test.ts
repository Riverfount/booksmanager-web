import type { BookLookup } from '../api/types'
import { suggestionToForm } from './lookup'

const found: BookLookup = {
  isbn: '9788533302273',
  outcome: 'FOUND',
  message: 'ok',
  suggestion: {
    title: 'Dom Casmurro',
    publisher: 'Garnier',
    publicationYear: 1899,
    authors: [{ name: 'Machado de Assis', existingAuthorId: 7 }, { name: 'Fulano' }],
  },
}

describe('suggestionToForm', () => {
  it('preenche título, editora e ano', () => {
    const r = suggestionToForm(found.suggestion!)
    expect(r.values).toEqual({ title: 'Dom Casmurro', publisher: 'Garnier', year: '1899' })
  })

  it('separa autores que já existem dos que ainda não estão cadastrados', () => {
    const r = suggestionToForm(found.suggestion!)
    expect(r.known).toEqual([{ id: 7, name: 'Machado de Assis' }])
    expect(r.unknown).toEqual(['Fulano'])
  })

  it('editora e ano ausentes viram campo vazio', () => {
    const r = suggestionToForm({ title: 'X', authors: [] })
    expect(r.values).toEqual({ title: 'X', publisher: '', year: '' })
  })
})
