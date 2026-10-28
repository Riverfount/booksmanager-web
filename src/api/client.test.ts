import { ApiError, call, existingAuthorId } from './client'

const failure = (status: number, error: unknown) => Promise.resolve({ error, response: new Response(null, { status }) })

describe('call', () => {
  it('usa o detail do ProblemDetail como mensagem', async () => {
    await expect(call(failure(422, { detail: 'Já existe um autor com este nome.' }))).rejects.toThrow('Já existe um autor com este nome.')
  })

  it('guarda o existingAuthorId do 422 de autor duplicado', async () => {
    const error = await call(failure(422, { detail: 'Duplicado', existingAuthorId: 12 })).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(existingAuthorId(error)).toBe(12)
  })

  it('existingAuthorId é indefinido nos demais erros', async () => {
    const error = await call(failure(422, { detail: 'Outra regra' })).catch((e: unknown) => e)
    expect(existingAuthorId(error)).toBeUndefined()
    expect(existingAuthorId(new Error('x'))).toBeUndefined()
    expect(existingAuthorId(undefined)).toBeUndefined()
  })

  it('só considera o existingAuthorId em respostas 422', async () => {
    const error = await call(failure(400, { existingAuthorId: 3 })).catch((e: unknown) => e)
    expect(existingAuthorId(error)).toBeUndefined()
  })

  it('guarda a lista errors do 400, com os campos que falharam', async () => {
    const errors = [{ field: 'publicationYear', message: 'o ano é inválido' }, { message: 'dados incompletos' }]
    const error = await call(failure(400, { detail: 'Dados inválidos.', errors })).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).fieldErrors).toEqual(errors)
  })

  it('ignora a lista errors fora do 400 e quando ela não é uma lista', async () => {
    const other = await call(failure(422, { detail: 'Regra', errors: [{ field: 'x', message: 'y' }] })).catch((e: unknown) => e)
    expect((other as ApiError).fieldErrors).toBeUndefined()
    const malformed = await call(failure(400, { errors: 'não é lista' })).catch((e: unknown) => e)
    expect((malformed as ApiError).fieldErrors).toBeUndefined()
  })
})
