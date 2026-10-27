import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router'
import type { z } from 'zod'
import { api, call, errorMessage } from '../api/client'
import { PublicShell } from '../components/PublicShell'
import { Banner, Button, TextField } from '../components/ui'
import { fid } from '../lib/form'
import { forgotPasswordSchema } from '../lib/schemas'

type Values = z.infer<typeof forgotPasswordSchema>

/** A reader asks for a reset link. The API always answers 204, so the screen never says whether the e-mail exists. */
export function ForgotPasswordPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } })
  const ask = useMutation({ mutationFn: (v: Values) => call(api.POST('/api/v1/auth/forgot-password', { body: { email: v.email } })) })

  return (
    <PublicShell heading="Esqueci a minha senha">
      {ask.isSuccess ? (
        <Banner kind="success">Se este e-mail for de um leitor com acesso, enviamos um link para escolher uma nova senha. Ele vale por tempo limitado.</Banner>
      ) : (
        <form noValidate onSubmit={handleSubmit((v) => ask.mutate(v))} className="flex flex-col gap-4">
          <p className="m-0 text-sm text-fg2">Informe o e-mail do seu cadastro na biblioteca. Vamos enviar um link para você escolher uma nova senha.</p>
          {ask.isError && <Banner kind="error">{errorMessage(ask.error)}</Banner>}
          <TextField id={fid('email')} label="E-mail" required type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <Button type="submit" variant="primary" disabled={ask.isPending}>{ask.isPending ? 'Enviando…' : 'Enviar link'}</Button>
        </form>
      )}
      <Link to="/login" className="text-sm">Voltar para a entrada</Link>
    </PublicShell>
  )
}
