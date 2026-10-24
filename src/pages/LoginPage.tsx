import { Logo } from '../components/Logo'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useLocation, useNavigate } from 'react-router'
import type { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import { loginSchema } from '../lib/schemas'
import { errorMessage } from '../api/client'
import { fid } from '../lib/form'
import { Banner, Button, TextField } from '../components/ui'

type Values = z.infer<typeof loginSchema>

export function LoginPage() {
  const { state, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [failure, setFailure] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(loginSchema), defaultValues: { login: '', password: '' } })

  if (state.status === 'authenticated') return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />

  const submit = handleSubmit(async (values) => {
    setFailure('')
    try {
      await signIn(values.login, values.password)
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true })
    } catch (e) {
      setFailure(errorMessage(e))
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg0 p-4">
      <main className="flex w-full max-w-sm flex-col gap-6 rounded-[10px] bg-bg1 p-8">
        <div className="flex items-center gap-2.5">
          <Logo size={40} />
          <h1 className="m-0 font-mono text-2xl font-bold">books manager</h1>
        </div>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {failure && <Banner kind="error">{failure}</Banner>}
          <TextField id={fid('login')} label="Login" required autoComplete="username" autoCapitalize="none" error={errors.login?.message} {...register('login')} />
          <TextField id={fid('password')} label="Senha" required type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
          <Button type="submit" variant="primary" disabled={isSubmitting}>{isSubmitting ? 'Entrando…' : 'Entrar'}</Button>
        </form>
        <p className="m-0 text-xs text-fg3">Depois de 3 senhas erradas seguidas, o acesso fica bloqueado por 15 minutos.</p>
      </main>
    </div>
  )
}
