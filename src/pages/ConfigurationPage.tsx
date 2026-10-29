import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { api, call, errorMessage } from '../api/client'
import type { LibraryConfiguration } from '../api/types'
import { Banner, Button, Card, ErrorSummary, PageHeader, RequiredNote, SelectField, Spinner, TextField } from '../components/ui'
import { applyServerErrors, errorItems, errorTitle, fid, serverErrors } from '../lib/form'
import { configSchema } from '../lib/schemas'

type Values = z.infer<typeof configSchema>

const toValues = (c: LibraryConfiguration): Values => ({
  penaltyPolicy: c.penaltyPolicy,
  dailyFineAmount: String(c.dailyFineAmount),
  fineCap: String(c.fineCap),
  suspensionDaysPerDay: String(c.suspensionDaysPerDay),
  suspensionCapDays: String(c.suspensionCapDays),
  loanPeriodDays: String(c.loanPeriodDays),
  loanLimit: String(c.loanLimit),
  renewalLimit: String(c.renewalLimit),
  reservationPickupDays: String(c.reservationPickupDays),
  dueSoonNoticeDays: String(c.dueSoonNoticeDays),
})
/** Field paths of the API → form fields (same names; the policy has no error slot, so its errors stay in the banner). */
const serverFields = {
  dailyFineAmount: 'dailyFineAmount', fineCap: 'fineCap', suspensionDaysPerDay: 'suspensionDaysPerDay', suspensionCapDays: 'suspensionCapDays',
  loanPeriodDays: 'loanPeriodDays', loanLimit: 'loanLimit', renewalLimit: 'renewalLimit', reservationPickupDays: 'reservationPickupDays', dueSoonNoticeDays: 'dueSoonNoticeDays',
}
const dec = (s: string) => Number(s.replace(',', '.'))

export function ConfigurationPage() {
  const qc = useQueryClient()
  const [done, setDone] = useState(false)
  const config = useQuery({ queryKey: ['configuration'], queryFn: () => call(api.GET('/api/v1/library-configuration')) })
  const { register, handleSubmit, reset, setError, watch, formState: { errors } } = useForm<Values>({ resolver: zodResolver(configSchema) })
  useEffect(() => { if (config.data) reset(toValues(config.data)) }, [config.data, reset])
  const policy = watch('penaltyPolicy')
  const usesFine = policy === 'FINE' || policy === 'BOTH'
  const usesSuspension = policy === 'SUSPENSION' || policy === 'BOTH'

  const save = useMutation({
    mutationFn: (v: Values) => call(api.PATCH('/api/v1/library-configuration', {
      body: {
        penaltyPolicy: v.penaltyPolicy,
        dailyFineAmount: dec(v.dailyFineAmount),
        fineCap: dec(v.fineCap),
        suspensionDaysPerDay: Number(v.suspensionDaysPerDay),
        suspensionCapDays: Number(v.suspensionCapDays),
        loanPeriodDays: Number(v.loanPeriodDays),
        loanLimit: Number(v.loanLimit),
        renewalLimit: Number(v.renewalLimit),
        reservationPickupDays: Number(v.reservationPickupDays),
        dueSoonNoticeDays: Number(v.dueSoonNoticeDays),
      },
    })),
    onError: (error) => applyServerErrors(serverErrors(error, serverFields), setError),
    onSuccess: (c) => {
      setDone(true)
      reset(toValues(c))
      void qc.invalidateQueries({ queryKey: ['configuration'] })
      void qc.invalidateQueries({ queryKey: ['rules'] })
    },
  })

  const serverBanner = save.isError ? serverErrors(save.error, serverFields).banner : undefined
  const items = errorItems(errors, {
    dailyFineAmount: 'Multa por dia', fineCap: 'Teto da multa', suspensionDaysPerDay: 'Dias de suspensão por dia', suspensionCapDays: 'Teto da suspensão',
    loanPeriodDays: 'Prazo de empréstimo', loanLimit: 'Limite de empréstimos', renewalLimit: 'Limite de renovações', reservationPickupDays: 'Prazo de retirada de reservas', dueSoonNoticeDays: 'Aviso de vencimento',
  })

  return (
    <>
      <PageHeader title="Configuração" subtitle="Política de penalidade e regras de empréstimo (só administrador)" />
      {config.isPending && <Spinner />}
      {config.isError && <Banner kind="error">{errorMessage(config.error)}</Banner>}
      {config.data && (
        <Card className="max-w-3xl">
          <form noValidate onSubmit={handleSubmit((v) => { setDone(false); save.mutate(v) })} className="flex flex-col gap-5">
            <RequiredNote />
            {done && !save.isPending && <Banner kind="success">Configuração salva. A nova política vale só para atrasos futuros.</Banner>}
            {serverBanner && <Banner kind="error">{serverBanner}</Banner>}
            <ErrorSummary title={errorTitle(items.length, 'salvar a configuração')} items={items} />

            <fieldset className="m-0 flex flex-col gap-3 rounded-lg border border-line p-4">
              <legend className="px-1.5 text-sm text-fg2">Penalidade por atraso</legend>
              <SelectField id={fid('penaltyPolicy')} label="Política" required {...register('penaltyPolicy')}>
                <option value="FINE">Multa</option>
                <option value="SUSPENSION">Suspensão</option>
                <option value="BOTH">Multa e suspensão</option>
                <option value="NONE">Nenhuma</option>
              </SelectField>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField id={fid('dailyFineAmount')} label="Multa por dia (R$)" required inputMode="decimal" disabled={!usesFine} error={errors.dailyFineAmount?.message} {...register('dailyFineAmount')} />
                <TextField id={fid('fineCap')} label="Teto da multa (R$)" required inputMode="decimal" disabled={!usesFine} error={errors.fineCap?.message} {...register('fineCap')} />
                <TextField id={fid('suspensionDaysPerDay')} label="Dias de suspensão por dia de atraso" required inputMode="numeric" disabled={!usesSuspension} error={errors.suspensionDaysPerDay?.message} {...register('suspensionDaysPerDay')} />
                <TextField id={fid('suspensionCapDays')} label="Teto da suspensão (dias)" required inputMode="numeric" disabled={!usesSuspension} error={errors.suspensionCapDays?.message} {...register('suspensionCapDays')} />
              </div>
              <p className="m-0 text-xs text-muted">Mudar a política vale só para devoluções em atraso futuras; multas e suspensões já geradas não mudam.</p>
            </fieldset>

            <fieldset className="m-0 flex flex-col gap-3 rounded-lg border border-line p-4">
              <legend className="px-1.5 text-sm text-fg2">Empréstimos</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField id={fid('loanPeriodDays')} label="Prazo de empréstimo (dias)" required inputMode="numeric" error={errors.loanPeriodDays?.message} {...register('loanPeriodDays')} />
                <TextField id={fid('loanLimit')} label="Empréstimos simultâneos por leitor" required inputMode="numeric" error={errors.loanLimit?.message} {...register('loanLimit')} />
                <TextField id={fid('renewalLimit')} label="Renovações por empréstimo" required inputMode="numeric" error={errors.renewalLimit?.message} {...register('renewalLimit')} />
                <TextField id={fid('reservationPickupDays')} label="Prazo de retirada de reservas (dias)" required inputMode="numeric" error={errors.reservationPickupDays?.message} {...register('reservationPickupDays')} />
                <TextField id={fid('dueSoonNoticeDays')} label="Aviso de vencimento (dias antes)" required inputMode="numeric" hint="Antecedência do e-mail avisando que o empréstimo vai vencer." error={errors.dueSoonNoticeDays?.message} {...register('dueSoonNoticeDays')} />
              </div>
            </fieldset>

            <div className="flex justify-end gap-3">
              <Button onClick={() => { reset(toValues(config.data)); setDone(false) }}>Descartar alterações</Button>
              <Button type="submit" variant="primary" disabled={save.isPending}>Salvar configuração</Button>
            </div>
          </form>
        </Card>
      )}
    </>
  )
}
