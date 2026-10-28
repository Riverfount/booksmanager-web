import createClient, { type Middleware } from 'openapi-fetch'
import type { paths } from './schema'
import { refreshSession } from '../auth/session'
import { getAccessToken } from '../auth/tokenStore'

export const API_URL: string = import.meta.env.VITE_API_URL ?? ''

export type FieldError = { field?: string; message: string }

/** Erro de API já com mensagem em português pronta para mostrar. */
export class ApiError extends Error {
  status: number
  /** Id do autor que já tem o nome, nos 422 de homônimo (cadastro, edição e reativação de autor). */
  existingAuthorId?: number
  /** Campos que falharam, nos 400 de requisição inválida (`field` falta quando o erro é do objeto inteiro). */
  fieldErrors?: FieldError[]
  constructor(message: string, status: number, existingAuthorId?: number, fieldErrors?: FieldError[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.existingAuthorId = existingAuthorId
    this.fieldErrors = fieldErrors
  }
}

const copies = new WeakMap<Request, Request>()

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = getAccessToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    copies.set(request, request.clone())
    return request
  },
  async onResponse({ request, response }) {
    // Access token vencido (15 min): troca pelo refresh token e repete a chamada uma vez.
    if (response.status !== 401 || !getAccessToken()) return undefined
    const original = copies.get(request)
    if (!original) return undefined
    const token = await refreshSession()
    if (!token) return undefined
    original.headers.set('Authorization', `Bearer ${token}`)
    return fetch(original)
  },
}

// Resolves `fetch` on each call (not once, at creation) so tests can replace it.
export const api = createClient<paths>({ baseUrl: API_URL, fetch: (request) => globalThis.fetch(request) })
api.use(authMiddleware)

type Result<T> = { data?: T; error?: unknown; response: Response }

function messageFor(status: number, error: unknown): string {
  const detail = (error as { detail?: string } | undefined)?.detail
  if (detail) return detail
  switch (status) {
    case 400: return 'Dados inválidos. Confira os campos.'
    case 401: return 'Sessão expirada. Entre novamente.'
    case 403: return 'Você não tem permissão para esta ação.'
    case 404: return 'Registro não encontrado.'
    case 409: return 'Outra pessoa alterou este registro ao mesmo tempo. Tente de novo.'
    case 422: return 'Operação não permitida.'
    default: return 'Não foi possível concluir. Tente novamente.'
  }
}

/** Resolve o resultado do openapi-fetch ou lança ApiError (formato ProblemDetail, RFC 9457). */
export async function call<T>(request: Promise<Result<T>>): Promise<T> {
  let result: Result<T>
  try {
    result = await request
  } catch {
    throw new ApiError('Sem conexão com o servidor. Verifique a rede e tente de novo.', 0)
  }
  if (!result.response.ok) {
    const { status } = result.response
    const existing = (result.error as { existingAuthorId?: unknown } | undefined)?.existingAuthorId
    const errors = (result.error as { errors?: unknown } | undefined)?.errors
    throw new ApiError(messageFor(status, result.error), status, status === 422 && typeof existing === 'number' ? existing : undefined, status === 400 && Array.isArray(errors) ? (errors as FieldError[]) : undefined)
  }
  return result.data as T
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.'
}

/** Id do autor homônimo quando o erro é o 422 de nome duplicado; indefinido nos demais erros. */
export const existingAuthorId = (error: unknown): number | undefined => (error instanceof ApiError ? error.existingAuthorId : undefined)
