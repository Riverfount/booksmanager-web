import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { errorMessage } from '../api/client'
import { fid } from '../lib/form'
import { reasonSchema } from '../lib/schemas'
import { Banner, Button, Dialog, TextField } from './ui'

/** Diálogo com justificativa obrigatória (abono de multa, encerramento antecipado de suspensão). */
export function ReasonDialog(props: { title: string; description: string; confirm: string; pending: boolean; error: unknown; onSubmit: (reason: string) => void; onClose: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof reasonSchema>>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: '' } })
  return (
    <Dialog title={props.title} onClose={props.onClose}>
      <form noValidate onSubmit={handleSubmit((v) => props.onSubmit(v.reason))} className="flex flex-col gap-4">
        <p className="m-0 text-sm text-fg2">{props.description}</p>
        {props.error != null && <Banner kind="error">{errorMessage(props.error)}</Banner>}
        <TextField id={fid('reason')} label="Justificativa" required maxLength={500} autoComplete="off" autoFocus error={errors.reason?.message} {...register('reason')} />
        <div className="flex justify-end gap-3">
          <Button onClick={props.onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={props.pending}>{props.confirm}</Button>
        </div>
      </form>
    </Dialog>
  )
}
