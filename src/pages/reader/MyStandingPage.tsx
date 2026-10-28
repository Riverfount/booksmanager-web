import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { api, call, errorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { Badge, Banner, Card, PageHeader, Spinner } from '../../components/ui'
import { formatDate, formatMoney } from '../../lib/dates'

/** Home of the reader area: whether the reader can borrow today and, if not, why. */
export function MyStandingPage() {
  const { state } = useAuth()
  const standing = useQuery({ queryKey: ['me', 'standing'], queryFn: () => call(api.GET('/api/v1/me/standing')) })
  const s = standing.data
  const name = state.user?.displayName || state.user?.login

  return (
    <>
      <PageHeader title={name ? `Olá, ${name}` : 'Minha situação'} subtitle="Como está a sua conta na biblioteca" />
      {standing.isPending && <Spinner />}
      {standing.isError && <Banner kind="error">{errorMessage(standing.error)}</Banner>}
      {s && (
        <>
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <Badge color={s.canBorrow ? '#8ec07c' : '#fb4934'}>{s.canBorrow ? 'Você pode pegar livros emprestados' : 'Empréstimos indisponíveis no momento'}</Badge>
            </div>
            {s.reasons.length > 0 && (
              <ul aria-label="Motivos" className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-fg2">
                {s.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            )}
            {s.blocked && <p className="m-0 text-sm text-fg2">O seu cadastro está bloqueado. Procure a biblioteca para saber mais.</p>}
            {s.suspension && (
              <p className="m-0 text-sm text-fg2">Você está suspenso desde {formatDate(s.suspension.startDate)} e volta a poder emprestar em {formatDate(s.suspension.releaseDate)}.</p>
            )}
            {s.pendingFineTotal > 0 && <p className="m-0 text-sm text-fg2">Há multas pendentes: pague na biblioteca para voltar a emprestar.</p>}
          </Card>
          <section aria-label="Resumo" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Stat label="Empréstimos ativos" value={`${s.activeLoans} / ${s.loanLimit}`} color="#8ec07c" />
            <Stat label="Em atraso" value={String(s.overdueLoans)} color={s.overdueLoans > 0 ? '#fb4934' : '#a89984'} />
            <Stat label="Reservas ativas" value={`${s.activeReservations} / ${s.reservationLimit}`} color="#83a598" />
            <Stat label="Multas pendentes" value={formatMoney(s.pendingFineTotal)} color={s.pendingFineTotal > 0 ? '#fe8019' : '#a89984'} />
          </section>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link to="/meu/emprestimos">Ver meus empréstimos</Link>
            <Link to="/meu/reservas">Ver minhas reservas</Link>
            <Link to="/meu/catalogo">Procurar um livro</Link>
          </div>
        </>
      )}
    </>
  )
}

const Stat = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="flex flex-col gap-1.5 rounded-[10px] bg-bg1 p-4 sm:p-5">
    <span className="text-sm text-fg2">{label}</span>
    <span className="font-mono text-2xl font-bold sm:text-3xl" style={{ color }}>{value}</span>
  </div>
)
