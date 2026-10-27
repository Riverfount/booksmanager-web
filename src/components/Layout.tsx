import { Logo } from './Logo'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { Icon, type IconName } from './Icon'

type Item = { to: string; label: string; icon: IconName; admin?: boolean }
const items: Item[] = [
  { to: '/', label: 'Painel', icon: 'dashboard' },
  { to: '/livros', label: 'Livros', icon: 'book' },
  { to: '/autores', label: 'Autores', icon: 'author' },
  { to: '/categorias', label: 'Categorias', icon: 'tag' },
  { to: '/leitores', label: 'Leitores', icon: 'reader' },
  { to: '/emprestimos', label: 'Empréstimos', icon: 'loans' },
  { to: '/reservas', label: 'Reservas', icon: 'bookmark' },
  { to: '/multas', label: 'Multas e suspensões', icon: 'fines' },
  { to: '/usuarios', label: 'Usuários', icon: 'users', admin: true },
  { to: '/configuracao', label: 'Configuração', icon: 'gear', admin: true },
]

export function Layout() {
  const { state, isAdmin, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const [lastPath, setLastPath] = useState(location.pathname)
  // Fecha o menu do celular ao trocar de tela.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setOpen(false)
  }
  const user = state.user
  const name = user?.displayName || user?.login || ''
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="flex min-h-screen flex-wrap bg-bg0">
      <header className="sticky top-0 z-50 box-border flex h-14 flex-[1_0_100%] items-center justify-between border-b border-bg1 bg-bg0-h pr-1.5 pl-4 min-[901px]:hidden">
        <span className="flex items-center gap-2.5 font-mono text-[17px] font-bold"><Logo size={26} />books manager</span>
        <button
          type="button"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          aria-controls="menu-principal"
          onClick={() => setOpen(!open)}
          className="inline-flex size-11 items-center justify-center rounded-md bg-transparent text-fg"
        >
          <Icon name={open ? 'close' : 'menu'} size={24} />
        </button>
      </header>

      <aside
        id="menu-principal"
        className={`${open ? 'fixed inset-x-0 top-14 bottom-0 z-40 flex overflow-y-auto' : 'hidden'} flex-col gap-6 border-bg1 bg-bg0-h px-4 py-6 min-[901px]:static min-[901px]:flex min-[901px]:w-62 min-[901px]:shrink-0 min-[901px]:border-r`}
      >
        <div className="hidden items-center gap-2.5 px-3 min-[901px]:flex">
          <Logo size={32} />
          <span className="font-mono text-lg font-bold">books manager</span>
        </div>
        <nav aria-label="Principal" className="flex grow flex-col gap-1">
          {items.filter((i) => !i.admin || isAdmin).map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/'}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-[15px] no-underline ${isActive ? 'bg-bg1 font-medium !text-yellow' : '!text-fg2'}`
              }
            >
              <Icon name={i.icon} />
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3 rounded-lg bg-bg0 p-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-blue font-semibold text-bg0-h" aria-hidden="true">{initials}</div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{name}</span>
            <span className={`font-mono text-xs ${isAdmin ? 'text-orange' : 'text-green'}`}>{isAdmin ? 'administrador' : 'operador'}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-transparent text-sm text-fg2"
        >
          <Icon name="logout" size={18} />Sair
        </button>
      </aside>

      <main className="box-border flex min-w-0 flex-[999_1_560px] flex-col gap-6 px-4 py-5 min-[901px]:px-10 min-[901px]:py-8">
        <Outlet />
      </main>
    </div>
  )
}
