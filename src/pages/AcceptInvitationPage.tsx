import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router'
import type { z } from 'zod'
import { api, call } from '../api/client'
import { PasswordRules } from '../components/PasswordRules'
import { PublicShell } from '../components/PublicShell'
import { Banner, Button, ErrorSummary, TextField } from '../components/ui'
import { applyServerErrors, errorItems, errorTitle, fid, serverErrors } from '../lib/form'
import { acceptInvitationSchema } from '../lib/schemas'
import { useLinkToken } from '../lib/useLinkToken'

type Values = z.infer<typeof acceptInvitationSchema>

/** Field paths of the API → form fields. */
const serverFields = { login: 'login', password: 'password' }

/** Opened from the invitation e-mail (`/convite?token=...`): the reader picks a login and a password. */
export function AcceptInvitationPage() {
  const token = useLinkToken()
  const [created, setCreated] = useState('')
  const { register, handleSubmit, setError, watch, formState: { errors, isSubmitted } } = useForm<Values>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { login: '', password: '', confirmPassword: '' },
  })
  const accept = useMutation({
    mutationFn: (v: Values) => call(api.POST('/api/v1/auth/accept-invitation', { body: { token, login: v.login, password: v.password } })),
    onError: (error) => applyServerErrors(serverErrors(error, serverFields), setError),
    onSuccess: (_, v) => setCreated(v.login.trim().toLowerCase()),
  })
  const serverBanner = accept.isError ? serverErrors(accept.error, serverFields).banner : undefined
  const items = errorItems(errors, { login: 'Login', password: 'Senha', confirmPassword: 'Confirmação da senha' })

  if (!token) return <InvalidLink />
  if (created) {
    return (
      <PublicShell heading="Acesso criado">
        <Banner kind="success">Pronto! Entre com o login <strong>{created}</strong> e a senha que você escolheu.</Banner>
        <Link to="/login" className="text-sm">Ir para a entrada</Link>
      </PublicShell>
    )
  }
  return (
    <PublicShell heading="Criar o seu acesso">
      <form noValidate onSubmit={handleSubmit((v) => accept.mutate(v))} className="flex flex-col gap-4">
        <p className="m-0 text-sm text-fg2">Escolha o login e a senha que você vai usar para entrar.</p>
        {serverBanner && <Banner kind="error">{serverBanner}</Banner>}
        <ErrorSummary title={errorTitle(items.length, 'criar o acesso')} items={items} />
        <TextField id={fid('login')} label="Login" required maxLength={50} autoComplete="username" autoCapitalize="none" hint="Sem espaços. Não diferencia maiúsculas de minúsculas." error={errors.login?.message} {...register('login')} />
        <TextField id={fid('password')} label="Senha" required type="password" autoComplete="new-password" maxLength={25} aria-describedby="rules-senha" error={errors.password?.message} {...register('password')} />
        <PasswordRules id="rules-senha" password={watch('password')} submitted={isSubmitted} />
        <TextField id={fid('confirmPassword')} label="Repita a senha" required type="password" autoComplete="new-password" maxLength={25} error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" variant="primary" disabled={accept.isPending}>{accept.isPending ? 'Criando…' : 'Criar acesso'}</Button>
      </form>
    </PublicShell>
  )
}

export function InvalidLink() {
  return (
    <PublicShell heading="Link inválido">
      <Banner kind="error">Este link está incompleto. Abra de novo o link do e-mail ou peça um novo à biblioteca.</Banner>
      <Link to="/login" className="text-sm">Ir para a entrada</Link>
    </PublicShell>
  )
}
