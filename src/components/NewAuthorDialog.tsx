import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, call, errorMessage, existingAuthorId } from '../api/client'
import { applyServerErrors, serverErrors } from '../lib/form'
import { authorSchema } from '../lib/schemas'
import { Banner, Button, Dialog, TextField } from './ui'

type Values = { name: string }

/**
 * Registers an author without leaving the page. It is rendered in a portal and stops the submit from bubbling:
 * the picker usually sits inside the book form, and a nested form (or its Enter key) must not submit the outer one.
 */
export function NewAuthorDialog({ initialName, onCreated, onClose }: { initialName: string; onCreated: (author: { id: number; name: string }) => void; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, getValues, setError, formState: { errors } } = useForm<Values>({ resolver: zodResolver(authorSchema), defaultValues: { name: initialName } })
  const save = useMutation({
    mutationFn: (v: { name: string; allowDuplicate: boolean }) => call(api.POST('/api/v1/authors', { body: v })),
    onError: (error) => applyServerErrors(serverErrors(error, { name: 'name' }), setError),
    onSuccess: (a) => {
      void qc.invalidateQueries({ queryKey: ['authors'] })
      onCreated({ id: a.id, name: a.name })
    },
  })
  // The homonym 422 is not a failure to report: it asks the operator to confirm.
  const existingId = existingAuthorId(save.error)
  const homonym = existingId !== undefined
  // The chip must show the name the collection has (it may differ from the typed one in case); if the lookup fails, the typed name is enough.
  const useExisting = useMutation({
    mutationFn: async (id: number) => {
      const typed = getValues('name').trim()
      try {
        const a = await call(api.GET('/api/v1/authors/{id}', { params: { path: { id } } }))
        return { id, name: a.name || typed }
      } catch {
        return { id, name: typed }
      }
    },
    onSuccess: onCreated,
  })
  const serverBanner = save.isError && !homonym ? serverErrors(save.error, { name: 'name' }).banner : undefined

  return createPortal(
    <Dialog title="Novo autor" onClose={onClose}>
      <form
        noValidate
        onSubmit={(e) => {
          e.stopPropagation()
          void handleSubmit((v) => save.mutate({ name: v.name, allowDuplicate: false }))(e)
        }}
        className="flex flex-col gap-4"
      >
        {serverBanner && <Banner kind="error">{serverBanner}</Banner>}
        <TextField label="Nome" required autoFocus autoComplete="off" maxLength={150} error={errors.name?.message} {...register('name')} />
        {homonym ? (
          <>
            <p className="m-0 text-sm text-fg2">{errorMessage(save.error)} Use o autor que já existe ou cadastre este como um homônimo.</p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button onClick={() => save.reset()}>Voltar</Button>
              <Button disabled={save.isPending} onClick={() => save.mutate({ name: getValues('name').trim(), allowDuplicate: true })}>Salvar mesmo assim</Button>
              <Button variant="primary" disabled={useExisting.isPending} onClick={() => useExisting.mutate(existingId)}>Usar autor existente</Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end gap-3">
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={save.isPending}>Cadastrar autor</Button>
          </div>
        )}
      </form>
    </Dialog>,
    document.body,
  )
}
