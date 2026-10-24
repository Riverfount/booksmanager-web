import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, call } from '../api/client'
import type { CurrentUser } from '../api/types'
import { login as doLogin, logout as doLogout, refreshSession } from './session'

type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: CurrentUser }

type AuthValue = {
  state: AuthState
  isAdmin: boolean
  signIn: (login: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

const loadMe = () => call(api.GET('/api/v1/users/me'))

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null })
  const queryClient = useQueryClient()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const token = await refreshSession()
      if (!token) return !cancelled && setState({ status: 'anonymous', user: null })
      try {
        const user = await loadMe()
        if (!cancelled) setState({ status: 'authenticated', user })
      } catch {
        if (!cancelled) setState({ status: 'anonymous', user: null })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (login: string, password: string) => {
    await doLogin(login, password)
    const user = await loadMe()
    setState({ status: 'authenticated', user })
  }, [])

  const signOut = useCallback(async () => {
    await doLogout()
    queryClient.clear()
    setState({ status: 'anonymous', user: null })
  }, [queryClient])

  const value = useMemo<AuthValue>(
    () => ({ state, isAdmin: state.user?.role === 'ADMIN', signIn, signOut }),
    [state, signIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return value
}
