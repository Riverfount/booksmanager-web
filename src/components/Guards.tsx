import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { Spinner } from './ui'

export function RequireAuth() {
  const { state } = useAuth()
  const location = useLocation()
  if (state.status === 'loading') return <div className="p-10"><Spinner label="Entrando…" /></div>
  if (state.status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Operator and administrator screens: a reader who lands here is sent to the reader area. */
export function RequireStaff() {
  const { state } = useAuth()
  if (state.user?.role === 'READER') return <Navigate to="/meu" replace />
  return <Outlet />
}

/** The reader area: operators and administrators go back to the panel. */
export function RequireReader() {
  const { state } = useAuth()
  if (state.user?.role !== 'READER') return <Navigate to="/" replace />
  return <Outlet />
}

export function RequireAdmin() {
  const { isAdmin } = useAuth()
  if (!isAdmin) {
    return (
      <div role="alert" className="rounded-lg border border-line bg-bg0-s p-6 text-fg2">
        Esta área é só para administradores.
      </div>
    )
  }
  return <Outlet />
}
