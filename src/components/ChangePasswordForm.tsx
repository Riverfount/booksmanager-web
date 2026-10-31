import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import type { z } from 'zod'
import { Banner, Button, ErrorSummary, TextField } from './ui'
import { PasswordRules } from './PasswordRules'
import { applyServerErrors, errorItems, errorTitle, fid, serverErrors } from '../lib/form'
import { changePasswordSchema } from '../lib/schemas'

type Values = z.infer<typeof changePasswordSchema>

export type PasswordChange = { currentPassword: string; newPassword: string }

const serverFields = { newPassword: 'password', currentPassword: 'currentPassword' }
// the API refuses a wrong current password with a 422 that has no field: pin it to the current password field
const passwordRule: [RegExp, string][] = [[/senha atual/i, 'currentPassword']]

/**
 * The form of a signed-in user changing their own password, for the reader and for the staff: the current password
 * proves it is them. The rules (policy, lockout, who may) are the API's; the checks here only give an immediate answer.
 * `send` calls the API of each profile, and `onDone` runs when it accepts the change.
 */
export function ChangePasswordForm({ send, onDone, onCancel }: { send: (body: PasswordChange) => Promise<unknown>; onDone: () => void; onCancel?: () => void }) {
  const { register, handleSubmit, setError, watch, formState: { errors, isSubmitted } } = useForm<Values>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  })
  const change = useMutation({
    mutationFn: (v: Values) => send({ currentPassword: v.currentPassword, newPassword: v.password }),
    onError: (error) => applyServerErrors(serverErrors(error, serverFields, passwordRule), setError),
    onSuccess: onDone,
  })
  const serverBanner = change.isError ? serverErrors(change.error, serverFields, passwordRule).banner : undefined
  const items = errorItems(errors, { currentPassword: 'Senha atual', password: 'Nova senha', confirmPassword: 'Confirmação da senha' })

  return (
    <form noValidate onSubmit={handleSubmit((v) => change.mutate(v))} className="flex flex-col gap-4">
      {serverBanner && <Banner kind="error">{serverBanner}</Banner>}
      <ErrorSummary title={errorTitle(items.length, 'trocar a senha')} items={items} />
      <TextField id={fid('currentPassword')} label="Senha atual" required type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
      <TextField id={fid('password')} label="Nova senha" required type="password" autoComplete="new-password" maxLength={25} aria-describedby="rules-nova-senha" error={errors.password?.message} {...register('password')} />
      <PasswordRules id="rules-nova-senha" password={watch('password')} submitted={isSubmitted} />
      <TextField id={fid('confirmPassword')} label="Repita a nova senha" required type="password" autoComplete="new-password" maxLength={25} error={errors.confirmPassword?.message} {...register('confirmPassword')} />
      <div className="flex gap-3">
        {onCancel && <Button onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" variant="primary" disabled={change.isPending}>{change.isPending ? 'Salvando…' : 'Trocar a senha'}</Button>
      </div>
    </form>
  )
}
