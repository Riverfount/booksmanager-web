import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { RequireAdmin, RequireAuth, RequireReader, RequireStaff } from './components/Guards'
import { ReaderLayout } from './components/ReaderLayout'
import { LoginPage } from './pages/LoginPage'
import { AcceptInvitationPage } from './pages/AcceptInvitationPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { Spinner } from './components/ui'
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const BooksPage = lazy(() => import('./pages/BooksPage').then((m) => ({ default: m.BooksPage })))
const AuthorsPage = lazy(() => import('./pages/AuthorsPage').then((m) => ({ default: m.AuthorsPage })))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })))
const ReadersPage = lazy(() => import('./pages/ReadersPage').then((m) => ({ default: m.ReadersPage })))
const ReaderDetailPage = lazy(() => import('./pages/ReaderDetailPage').then((m) => ({ default: m.ReaderDetailPage })))
const LoansPage = lazy(() => import('./pages/LoansPage').then((m) => ({ default: m.LoansPage })))
const ReservationsPage = lazy(() => import('./pages/ReservationsPage').then((m) => ({ default: m.ReservationsPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const PenaltiesPage = lazy(() => import('./pages/PenaltiesPage').then((m) => ({ default: m.PenaltiesPage })))
const UsersPage = lazy(() => import('./pages/UsersPage').then((m) => ({ default: m.UsersPage })))
const AuditPage = lazy(() => import('./pages/AuditPage').then((m) => ({ default: m.AuditPage })))
const MyStandingPage = lazy(() => import('./pages/reader/MyStandingPage').then((m) => ({ default: m.MyStandingPage })))
const CatalogPage = lazy(() => import('./pages/reader/CatalogPage').then((m) => ({ default: m.CatalogPage })))
const MyLoansPage = lazy(() => import('./pages/reader/MyLoansPage').then((m) => ({ default: m.MyLoansPage })))
const MyReservationsPage = lazy(() => import('./pages/reader/MyReservationsPage').then((m) => ({ default: m.MyReservationsPage })))
const ConfigurationPage = lazy(() => import('./pages/ConfigurationPage').then((m) => ({ default: m.ConfigurationPage })))

export function App() {
  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/convite" element={<AcceptInvitationPage />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<RequireStaff />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="livros" element={<BooksPage />} />
            <Route path="autores" element={<AuthorsPage />} />
            <Route path="categorias" element={<CategoriesPage />} />
            <Route path="leitores" element={<ReadersPage />} />
            <Route path="leitores/:id" element={<ReaderDetailPage />} />
            <Route path="emprestimos" element={<LoansPage />} />
            <Route path="reservas" element={<ReservationsPage />} />
            <Route path="relatorios" element={<ReportsPage />} />
            <Route path="multas" element={<PenaltiesPage />} />
            <Route element={<RequireAdmin />}>
              <Route path="usuarios" element={<UsersPage />} />
              <Route path="auditoria" element={<AuditPage />} />
              <Route path="configuracao" element={<ConfigurationPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
        <Route element={<RequireReader />}>
          <Route path="meu" element={<ReaderLayout />}>
            <Route index element={<MyStandingPage />} />
            <Route path="catalogo" element={<CatalogPage />} />
            <Route path="emprestimos" element={<MyLoansPage />} />
            <Route path="reservas" element={<MyReservationsPage />} />
            <Route path="*" element={<Navigate to="/meu" replace />} />
          </Route>
        </Route>
      </Route>
    </Routes>
    </Suspense>
  )
}
