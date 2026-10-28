import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { Logo } from './Logo'
import { Icon } from './Icon'

const items = [
  { to: '/meu', label: 'Minha situação', end: true },
  { to: '/meu/catalogo', label: 'Catálogo' },
  { to: '/meu/emprestimos', label: 'Meus empréstimos' },
  { to: '/meu/reservas', label: 'Minhas reservas' },
]

/** Frame of the reader area: a top bar with the navigation, since a reader has only a handful of screens. */
export function ReaderLayout() {
  const { state, signOut } = useAuth()
  const name = state.user?.displayName || state.user?.login || ''

  return (
    <div className="flex min-h-screen flex-col bg-bg0">
      <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-bg1 bg-bg0-h px-4 py-2 min-[901px]:px-10">
        <span className="flex items-center gap-2.5 font-mono text-[17px] font-bold"><Logo size={26} />books manager</span>
        <nav aria-label="Principal" className="order-3 flex w-full flex-wrap gap-1 min-[901px]:order-none min-[901px]:w-auto">
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              className={({ isActive }) => `flex min-h-11 items-center rounded-md px-3 text-[15px] no-underline ${isActive ? 'bg-bg1 font-medium !text-yellow' : '!text-fg2'}`}
            >
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="max-w-40 truncate text-sm text-fg2">{name}</span>
          <button type="button" onClick={() => void signOut()} className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-transparent px-3 text-sm text-fg2">
            <Icon name="logout" size={18} />Sair
          </button>
        </div>
      </header>
      <main className="box-border flex w-full max-w-5xl flex-col gap-6 self-center px-4 py-5 min-[901px]:px-10 min-[901px]:py-8">
        <Outlet />
      </main>
    </div>
  )
}
