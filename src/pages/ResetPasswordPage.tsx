import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router'
import type { z } from 'zod'
import { api, call, errorMessage } from '../api/client'
import { PasswordRules } from '../components/PasswordRules'
import { PublicShell } from '../components/PublicShell'
import { Banner, Button, ErrorSummary, TextField } from '../components/ui'
import { errorItems, errorTitle, fid } from '../lib/form'
import { newPasswordSchema } from '../lib/schemas'
import { useLinkToken } from '../lib/useLinkToken'
import { InvalidLink } from './AcceptInvitationPage'

type Values = z.infer<typeof newPasswordSchema>

/** Opened from the reset e-mail (`/redefinir-senha?token=...`): the reader sets a new password. */
export function ResetPasswordPage() {
  const token = useLinkToken()
  const [done, setDone] = useState(false)
  const { register, handleSubmit, watch, formState: { errors, isSubmitted } } = useForm<Values>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })
  const reset = useMutation({
    mutationFn: (v: Values) => call(api.POST('/api/v1/auth/reset-password', { body: { token, password: v.password } })),
    onSuccess: () => setDone(true),
  })
  const items = errorItems(errors, { password: 'Senha', confirmPassword: 'Confirmação da senha' })

  if (!token) return <InvalidLink />
  if (done) {
    return (
      <PublicShell heading="Senha alterada">
        <Banner kind="success">Sua senha foi alterada. Entre com a nova senha.</Banner>
        <Link to="/login" className="text-sm">Ir para a entrada</Link>
      </PublicShell>
    )
  }
  return (
    <PublicShell heading="Escolher uma nova senha">
      <form noValidate onSubmit={handleSubmit((v) => reset.mutate(v))} className="flex flex-col gap-4">
        {reset.isError && <Banner kind="error">{errorMessage(reset.error)}</Banner>}
        <ErrorSummary title={errorTitle(items.length, 'alterar a senha')} items={items} />
        <TextField id={fid('password')} label="Nova senha" required type="password" autoComplete="new-password" maxLength={25} aria-describedby="rules-senha" error={errors.password?.message} {...register('password')} />
        <PasswordRules id="rules-senha" password={watch('password')} submitted={isSubmitted} />
        <TextField id={fid('confirmPassword')} label="Repita a senha" required type="password" autoComplete="new-password" maxLength={25} error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" variant="primary" disabled={reset.isPending}>{reset.isPending ? 'Salvando…' : 'Alterar senha'}</Button>
      </form>
    </PublicShell>
  )
}
