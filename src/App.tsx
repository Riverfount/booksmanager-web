import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/Guards'
import { LoginPage } from './pages/LoginPage'
import { Spinner } from './components/ui'
const AuthorsPage = lazy(() => import('./pages/AuthorsPage').then((m) => ({ default: m.AuthorsPage })))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })))

export function App() {
  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="autores" element={<AuthorsPage />} />
          <Route path="categorias" element={<CategoriesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
  )
}
