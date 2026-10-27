import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { RequireAdmin, RequireAuth } from './components/Guards'
import { LoginPage } from './pages/LoginPage'
import { Spinner } from './components/ui'
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const BooksPage = lazy(() => import('./pages/BooksPage').then((m) => ({ default: m.BooksPage })))
const AuthorsPage = lazy(() => import('./pages/AuthorsPage').then((m) => ({ default: m.AuthorsPage })))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })))
const ReadersPage = lazy(() => import('./pages/ReadersPage').then((m) => ({ default: m.ReadersPage })))
const ReaderDetailPage = lazy(() => import('./pages/ReaderDetailPage').then((m) => ({ default: m.ReaderDetailPage })))
const LoansPage = lazy(() => import('./pages/LoansPage').then((m) => ({ default: m.LoansPage })))
const ReservationsPage = lazy(() => import('./pages/ReservationsPage').then((m) => ({ default: m.ReservationsPage })))
const PenaltiesPage = lazy(() => import('./pages/PenaltiesPage').then((m) => ({ default: m.PenaltiesPage })))
const UsersPage = lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })))
const ConfigurationPage = lazy(() => import('./pages/ConfigurationPage').then((m) => ({ default: m.ConfigurationPage })))

export function App() {
  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="livros" element={<BooksPage />} />
          <Route path="autores" element={<AuthorsPage />} />
          <Route path="categorias" element={<CategoriesPage />} />
          <Route path="leitores" element={<ReadersPage />} />
          <Route path="leitores/:id" element={<ReaderDetailPage />} />
          <Route path="emprestimos" element={<LoansPage />} />
          <Route path="reservas" element={<ReservationsPage />} />
          <Route path="multas" element={<PenaltiesPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="usuarios" element={<UsersPage />} />
            <Route path="configuracao" element={<ConfigurationPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
  )
}
