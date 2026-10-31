import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { api, call, errorMessage } from '../../api/client'
import type { OwnProfile } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { PasswordRules } from '../../components/PasswordRules'
import { Banner, Button, Card, ErrorSummary, FormCard, PageHeader, Spinner, TextField } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import { applyServerErrors, errorItems, errorTitle, fid, serverErrors } from '../../lib/form'
import { maskPhone } from '../../lib/masks'
import { changePasswordSchema, ownContactSchemaFor } from '../../lib/schemas'

type ContactValues = z.infer<ReturnType<typeof ownContactSchemaFor>>
type PasswordValues = z.infer<typeof changePasswordSchema>

const contactFields = { email: 'email', phone: 'phone', 'guardian.name': 'guardianName', 'guardian.email': 'guardianEmail', 'guardian.phone': 'guardianPhone' }
// the API refuses a wrong current password with a 422 that has no field: pin it to the password field of each form
const emailPasswordRule: [RegExp, string][] = [[/senha atual/i, 'emailPassword']]
const passwordRule: [RegExp, string][] = [[/senha atual/i, 'currentPassword']]

/** The reader's own registration: contact data and password are theirs to change; the identity data is the library's. */
export function MyProfilePage() {
  const profile = useQuery({ queryKey: ['me', 'profile'], queryFn: () => call(api.GET('/api/v1/me/profile')) })
  return (
    <>
      <PageHeader title="Meus dados" subtitle="Atualize o seu contato e a sua senha" />
      {profile.isPending && <Spinner />}
      {profile.isError && <Banner kind="error">{errorMessage(profile.error)}</Banner>}
      {profile.data && (
        <div className="flex flex-col gap-4">
          <Identity profile={profile.data} />
          <ContactForm profile={profile.data} />
          <PasswordForm />
        </div>
      )}
    </>
  )
}

function Identity({ profile }: { profile: OwnProfile }) {
  return (
    <Card>
      <dl className="m-0 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-fg3">Nome</dt><dd className="m-0 text-fg1">{profile.name}</dd></div>
        <div><dt className="text-fg3">Documento</dt><dd className="m-0 font-mono text-fg1">{profile.document}</dd></div>
        <div><dt className="text-fg3">Data de nascimento</dt><dd className="m-0 text-fg1">{formatDate(profile.birthDate)}</dd></div>
      </dl>
      <p className="m-0 text-[13px] text-fg3">Nome, documento e data de nascimento só a biblioteca altera. Para corrigir, procure o balcão.</p>
    </Card>
  )
}

const contactValues = (p: OwnProfile): ContactValues => ({
  email: p.email,
  phone: p.phone ?? '',
  guardianName: p.guardian?.name ?? '',
  guardianEmail: p.guardian?.email ?? '',
  guardianPhone: p.guardian?.phone ?? '',
  emailPassword: '',
})

function ContactForm({ profile }: { profile: OwnProfile }) {
  const qc = useQueryClient()
  const [done, setDone] = useState(false)
  const { register, handleSubmit, setError, setValue, reset, watch, formState: { errors } } = useForm<ContactValues>({
    resolver: zodResolver(ownContactSchemaFor(profile.minor, profile.email)),
    defaultValues: contactValues(profile),
  })
  useEffect(() => reset(contactValues(profile)), [profile, reset])
  const emailChanged = watch('email').trim() !== profile.email

  const save = useMutation({
    mutationFn: (v: ContactValues) =>
      call(api.PATCH('/api/v1/me/profile', {
        body: {
          email: v.email.trim() !== profile.email ? v.email.trim() : undefined,
          phone: v.phone || undefined,
          guardian: profile.minor ? { name: v.guardianName, email: v.guardianEmail, phone: v.guardianPhone || undefined } : undefined,
          currentPassword: v.email.trim() !== profile.email ? v.emailPassword : undefined,
        },
      })),
    onError: (error) => applyServerErrors(serverErrors(error, contactFields, emailPasswordRule), setError),
    onSuccess: (updated) => {
      setDone(true)
      qc.setQueryData(['me', 'profile'], updated)
    },
  })
  const serverBanner = save.isError ? serverErrors(save.error, contactFields, emailPasswordRule).banner : undefined
  const items = errorItems(errors, { email: 'E-mail', phone: 'Telefone', emailPassword: 'Senha atual', guardianName: 'Nome do responsável', guardianEmail: 'E-mail do responsável', guardianPhone: 'Telefone do responsável' })
  const phoneField = register('phone', { onChange: (e) => setValue('phone', maskPhone(e.target.value)) })
  const gPhoneField = register('guardianPhone', { onChange: (e) => setValue('guardianPhone', maskPhone(e.target.value)) })

  return (
    <FormCard title="Contato">
      <form noValidate onSubmit={handleSubmit((v) => { setDone(false); save.mutate(v) })} className="flex flex-col gap-4">
        {serverBanner && <Banner kind="error">{serverBanner}</Banner>}
        {done && !save.isPending && <Banner kind="success">Dados salvos.</Banner>}
        <ErrorSummary title={errorTitle(items.length, 'salvar os dados')} items={items} />
        <TextField id={fid('email')} label="E-mail" required type="email" autoComplete="email" maxLength={254} hint="É para este e-mail que vão os avisos e o link de redefinição de senha." error={errors.email?.message} {...register('email')} />
        <TextField id={fid('phone')} label="Telefone" type="tel" autoComplete="tel" error={errors.phone?.message} {...phoneField} />
        {emailChanged && (
          <TextField id={fid('emailPassword')} label="Senha atual" required type="password" autoComplete="current-password" hint="Necessária para trocar o e-mail." error={errors.emailPassword?.message} {...register('emailPassword')} />
        )}
        {profile.minor && (
          <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
            <legend className="mb-2 p-0 text-sm font-semibold text-fg1">Responsável</legend>
            <TextField id={fid('guardianName')} label="Nome do responsável" required maxLength={150} error={errors.guardianName?.message} {...register('guardianName')} />
            <TextField id={fid('guardianEmail')} label="E-mail do responsável" required type="email" maxLength={254} error={errors.guardianEmail?.message} {...register('guardianEmail')} />
            <TextField id={fid('guardianPhone')} label="Telefone do responsável" type="tel" error={errors.guardianPhone?.message} {...gPhoneField} />
          </fieldset>
        )}
        <div><Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar'}</Button></div>
      </form>
    </FormCard>
  )
}

function PasswordForm() {
  const { signOut } = useAuth()
  const [done, setDone] = useState(false)
  const { register, handleSubmit, setError, watch, reset, formState: { errors, isSubmitted } } = useForm<PasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  })
  const change = useMutation({
    mutationFn: (v: PasswordValues) => call(api.POST('/api/v1/me/password', { body: { currentPassword: v.currentPassword, newPassword: v.password } })),
    onError: (error) => applyServerErrors(serverErrors(error, { newPassword: 'password', currentPassword: 'currentPassword' }, passwordRule), setError),
    onSuccess: () => { reset(); setDone(true) },
  })
  const serverBanner = change.isError ? serverErrors(change.error, { newPassword: 'password', currentPassword: 'currentPassword' }, passwordRule).banner : undefined
  const items = errorItems(errors, { currentPassword: 'Senha atual', password: 'Nova senha', confirmPassword: 'Confirmação da senha' })

  if (done) {
    // the API ends every session of the reader on a password change, so the next step is to sign in again
    return (
      <FormCard title="Trocar a senha">
        <Banner kind="success">Senha alterada. Por segurança, todas as sessões foram encerradas: entre de novo com a nova senha.</Banner>
        <div><Button variant="primary" onClick={() => void signOut()}>Entrar de novo</Button></div>
      </FormCard>
    )
  }
  return (
    <FormCard title="Trocar a senha">
      <form noValidate onSubmit={handleSubmit((v) => change.mutate(v))} className="flex flex-col gap-4">
        {serverBanner && <Banner kind="error">{serverBanner}</Banner>}
        <ErrorSummary title={errorTitle(items.length, 'trocar a senha')} items={items} />
        <TextField id={fid('currentPassword')} label="Senha atual" required type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
        <TextField id={fid('password')} label="Nova senha" required type="password" autoComplete="new-password" maxLength={25} aria-describedby="rules-nova-senha" error={errors.password?.message} {...register('password')} />
        <PasswordRules id="rules-nova-senha" password={watch('password')} submitted={isSubmitted} />
        <TextField id={fid('confirmPassword')} label="Repita a nova senha" required type="password" autoComplete="new-password" maxLength={25} error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <div><Button type="submit" variant="primary" disabled={change.isPending}>{change.isPending ? 'Salvando…' : 'Trocar a senha'}</Button></div>
      </form>
    </FormCard>
  )
}
