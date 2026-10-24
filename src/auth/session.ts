import { setAccessToken } from './tokenStore'

const BASE: string = import.meta.env.VITE_API_URL ?? ''
// O backend exige este cabeçalho nas rotas que usam o cookie (proteção CSRF).
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' }

type LoginResponse = { accessToken: string; tokenType: string; expiresIn: number }

export class LoginError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function login(loginName: string, password: string): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...CSRF },
      body: JSON.stringify({ login: loginName, password }),
    })
  } catch {
    throw new LoginError('Sem conexão com o servidor. Verifique a rede e tente de novo.', 0)
  }
  if (response.status === 401) throw new LoginError('Login ou senha inválidos.', 401)
  if (!response.ok) throw new LoginError('Não foi possível entrar agora. Tente novamente.', response.status)
  const body = (await response.json()) as LoginResponse
  setAccessToken(body.accessToken)
}

let inFlight: Promise<string | null> | null = null

/** Troca o refresh token (cookie) por um access token novo. Chamadas simultâneas dividem a mesma troca. */
export function refreshSession(): Promise<string | null> {
  inFlight ??= (async () => {
    try {
      const response = await fetch(`${BASE}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include', headers: CSRF })
      if (!response.ok) {
        setAccessToken(null)
        return null
      }
      const body = (await response.json()) as LoginResponse
      setAccessToken(body.accessToken)
      return body.accessToken
    } catch {
      return null
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${BASE}/api/v1/auth/logout`, { method: 'POST', credentials: 'include', headers: CSRF })
  } finally {
    setAccessToken(null)
  }
}
