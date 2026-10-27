import type { ReactNode } from 'react'
import { Logo } from './Logo'

/** Page frame for the screens that need no session (login, invitation, password reset). */
export function PublicShell({ heading, children }: { heading?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg0 p-4">
      <main className="flex w-full max-w-sm flex-col gap-6 rounded-[10px] bg-bg1 p-8">
        <div className="flex items-center gap-2.5">
          <Logo size={40} />
          <h1 className="m-0 font-mono text-2xl font-bold">books manager</h1>
        </div>
        {heading && <h2 className="m-0 text-lg font-semibold">{heading}</h2>}
        {children}
      </main>
    </div>
  )
}
