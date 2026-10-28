import { ApiError } from '../api/client'
import { serverErrors } from './form'

const map = { publicationYear: 'year', 'guardian.email': 'guardianEmail', authorIds: 'authorIds', isbn: 'isbn' }
const rules: [RegExp, string][] = [[/isbn/i, 'isbn']]
const bad = (errors: { field?: string; message: string }[]) => new ApiError('Dados inválidos. Confira os campos.', 400, undefined, errors)

describe('serverErrors', () => {
  it('não devolve nada quando não há erro', () => {
    expect(serverErrors(undefined, map)).toEqual({ fields: [] })
    expect(serverErrors(null, map)).toEqual({ fields: [] })
  })

  it('leva cada campo da API para o campo do formulário, com a primeira letra maiúscula, e dispensa o banner', () => {
    const r = serverErrors(bad([{ field: 'publicationYear', message: 'o ano é inválido' }, { field: 'guardian.email', message: 'e-mail inválido' }]), map)
    expect(r.fields).toEqual([{ field: 'year', message: 'O ano é inválido' }, { field: 'guardianEmail', message: 'E-mail inválido' }])
    expect(r.banner).toBeUndefined()
  })

  it('ignora o índice da lista no caminho do campo', () => {
    expect(serverErrors(bad([{ field: 'authorIds[1]', message: 'autor inválido' }]), map).fields).toEqual([{ field: 'authorIds', message: 'Autor inválido' }])
  })

  it('o que não tem campo no formulário vai para o banner, sem perder os campos que casaram', () => {
    const r = serverErrors(bad([{ field: 'publicationYear', message: 'o ano é inválido' }, { field: 'outro', message: 'campo desconhecido' }, { message: 'dados incompletos' }]), map)
    expect(r.fields).toEqual([{ field: 'year', message: 'O ano é inválido' }])
    expect(r.banner).toBe('campo desconhecido dados incompletos')
  })

  it('sem campo que case, mantém a mensagem da API no banner', () => {
    expect(serverErrors(bad([{ field: 'outro', message: 'x' }]), map)).toEqual({ fields: [], banner: 'Dados inválidos. Confira os campos.' })
    expect(serverErrors(new ApiError('Sem conexão.', 0), map)).toEqual({ fields: [], banner: 'Sem conexão.' })
  })

  it('422 que fala do ISBN marca o campo do ISBN e dispensa o banner', () => {
    const r = serverErrors(new ApiError("já existe um livro com o ISBN '9788533302273'", 422), map, rules)
    expect(r.fields).toEqual([{ field: 'isbn', message: "Já existe um livro com o ISBN '9788533302273'" }])
    expect(r.banner).toBeUndefined()
  })

  it('422 de outra regra continua no banner', () => {
    expect(serverErrors(new ApiError('A categoria está inativa.', 422), map, rules)).toEqual({ fields: [], banner: 'A categoria está inativa.' })
  })

  it('erro que não é da API vira banner', () => {
    expect(serverErrors(new Error('falhou'), map)).toEqual({ fields: [], banner: 'falhou' })
  })
})
