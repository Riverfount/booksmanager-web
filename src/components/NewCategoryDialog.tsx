import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, call } from '../api/client'
import { applyServerErrors, serverErrors } from '../lib/form'
import { categorySchema } from '../lib/schemas'
import { Banner, Button, Dialog, TextField } from './ui'

type Values = { name: string }

/**
 * Registers a category without leaving the page. Like `NewAuthorDialog`, it is rendered in a portal and stops the submit
 * from bubbling: the picker sits inside the book form, and a nested form (or its Enter key) must not submit the outer one.
 */
export function NewCategoryDialog({ initialName, onCreated, onClose }: { initialName: string; onCreated: (category: { id: number; name: string }) => void; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({ resolver: zodResolver(categorySchema), defaultValues: { name: initialName } })
  const save = useMutation({
    mutationFn: (name: string) => call(api.POST('/api/v1/categories', { body: { name } })),
    onError: (error) => applyServerErrors(serverErrors(error, { name: 'name' }), setError),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      onCreated({ id: c.id, name: c.name })
    },
  })
  const banner = save.isError ? serverErrors(save.error, { name: 'name' }).banner : undefined

  return createPortal(
    <Dialog title="Nova categoria" onClose={onClose}>
      <form
        noValidate
        onSubmit={(e) => {
          e.stopPropagation()
          void handleSubmit((v) => save.mutate(v.name))(e)
        }}
        className="flex flex-col gap-4"
      >
        {banner && <Banner kind="error">{banner}</Banner>}
        <TextField label="Nome" required autoFocus autoComplete="off" maxLength={100} error={errors.name?.message} {...register('name')} />
        <div className="flex justify-end gap-3">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>Cadastrar categoria</Button>
        </div>
      </form>
    </Dialog>,
    document.body,
  )
}
