import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { errorMessage, existingAuthorId } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { Paged } from '../api/types'
import { applyServerErrors, errorItems, errorTitle, fid, serverErrors } from '../lib/form'
import { useDebounced } from '../lib/useDebounced'
import { Badge, Banner, Button, Card, Dialog, ErrorSummary, FormCard, IconButton, PageHeader, Pagination, Pills, RequiredNote, SearchInput, Spinner, TextField, EmptyState, DataTable } from './ui'
import { Icon } from './Icon'

type Item = { id: number; name: string; active: boolean }
type Values = { name: string }

type Props = {
  title: string
  subtitle: string
  noun: string // "autor", "categoria"
  article: 'o' | 'a'
  namePlaceholder: string
  queryKey: string
  schema: z.ZodType<Values, Values>
  list: (q: { name?: string; active: boolean; page: number }) => Promise<Paged<Item>>
  /** `allowDuplicate` confirms a homonym; only authors use it (the API answers 422 with `existingAuthorId`). */
  create: (name: string, allowDuplicate: boolean) => Promise<unknown>
  update: (id: number, name: string, allowDuplicate: boolean) => Promise<unknown>
  remove: (id: number) => Promise<unknown>
  reactivate: (id: number, allowDuplicate: boolean) => Promise<unknown>
}

export function NamedCrud(p: Props) {
  const qc = useQueryClient()
  const { isAdmin } = useAuth()
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<'true' | 'false'>('true')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Item | null>(null)
  const [removing, setRemoving] = useState<Item | null>(null)
  const [done, setDone] = useState('')
  const name = useDebounced(search.trim())

  const query = useQuery({
    queryKey: [p.queryKey, name, active, page],
    queryFn: () => p.list({ name: name || undefined, active: active === 'true', page }),
  })

  const form = useForm<Values>({ resolver: zodResolver(p.schema), defaultValues: { name: '' } })
  const { register, handleSubmit, reset, setError, formState: { errors } } = form
  const invalidate = () => qc.invalidateQueries({ queryKey: [p.queryKey] })

  const save = useMutation({
    mutationFn: (v: Values & { allowDuplicate?: boolean }) => (editing ? p.update(editing.id, v.name, !!v.allowDuplicate) : p.create(v.name, !!v.allowDuplicate)),
    onError: (error) => applyServerErrors(serverErrors(error, { name: 'name' }), setError),
    onSuccess: () => {
      setDone(`${p.noun.charAt(0).toUpperCase()}${p.noun.slice(1)} salv${p.article}.`)
      setEditing(null)
      reset({ name: '' })
      void invalidate()
    },
  })
  const inactivate = useMutation({
    mutationFn: (id: number) => p.remove(id),
    onSuccess: () => {
      setRemoving(null)
      void invalidate()
    },
  })

  const reactivate = useMutation({
    mutationFn: (v: { item: Item; allowDuplicate?: boolean }) => p.reactivate(v.item.id, !!v.allowDuplicate),
    onSuccess: () => void invalidate(),
  })
  // The homonym 422 is not a failure to report: it asks the operator to confirm.
  const saveHomonym = existingAuthorId(save.error) !== undefined
  const reactivateHomonym = existingAuthorId(reactivate.error) !== undefined
  const serverBanner = save.isError && !saveHomonym ? serverErrors(save.error, { name: 'name' }).banner : undefined

  const items = errorItems(errors, { name: 'Nome' })
  const startEdit = (item: Item) => {
    setEditing(item)
    setDone('')
    reset({ name: item.name })
  }
  const cancel = () => {
    setEditing(null)
    setDone('')
    reset({ name: '' })
  }

  return (
    <>
      <PageHeader title={p.title} subtitle={p.subtitle} actions={<SearchInput label={`Buscar ${p.noun}`} placeholder="Buscar por nome" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />} />
      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex-[2_1_520px]">
          <Pills value={active} onChange={(v) => { setActive(v); setPage(0) }} options={[{ value: 'true', label: 'Ativos' }, { value: 'false', label: 'Inativos' }]} />
          {reactivate.isError && !reactivateHomonym && <Banner kind="error">{errorMessage(reactivate.error)}</Banner>}
          {query.isPending && <Spinner />}
          {query.isError && <Banner kind="error">{errorMessage(query.error)}</Banner>}
          {query.data && query.data.items.length === 0 && <EmptyState>Nada por aqui.</EmptyState>}
          {query.data && query.data.items.length > 0 && (
            <>
              <DataTable
                rows={query.data.items}
                rowKey={(i) => i.id}
                columns={[
                  { header: 'Nome', width: '3fr', cell: (i) => <span className="font-semibold">{i.name}</span> },
                  { header: 'Situação', width: '1fr', cell: (i) => <Badge color={i.active ? '#8ec07c' : '#a89984'}>{i.active ? 'Ativo' : 'Inativo'}</Badge> },
                  {
                    header: 'Ações',
                    width: '1fr',
                    label: false,
                    cell: (i) => i.active ? (
                      <div className="flex gap-1">
                        <IconButton label={`Editar ${i.name}`} onClick={() => startEdit(i)}><Icon name="edit" size={18} /></IconButton>
                        <IconButton label={`Inativar ${i.name}`} onClick={() => setRemoving(i)} style={{ color: '#fe8019' }}><Icon name="ban" size={18} /></IconButton>
                      </div>
                    ) : isAdmin && (
                      <Button small disabled={reactivate.isPending} onClick={() => reactivate.mutate({ item: i })}>Reativar<span className="sr-only"> {i.name}</span></Button>
                    ),
                  },
                ]}
              />
              <Pagination page={query.data.page} totalPages={query.data.totalPages} totalItems={query.data.totalItems} onPage={setPage} />
            </>
          )}
        </Card>

        <FormCard title={editing ? `Editar ${p.noun}` : `Nov${p.article} ${p.noun}`} className="flex-[1_1_320px]">
          <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="flex flex-col gap-4">
            <RequiredNote />
            {done && !save.isPending && <Banner kind="success">{done}</Banner>}
            {serverBanner && <Banner kind="error">{serverBanner}</Banner>}
            <ErrorSummary title={errorTitle(items.length, `salvar ${p.article} ${p.noun}`)} items={items} />
            <TextField id={fid('name')} label="Nome" required placeholder={p.namePlaceholder} error={errors.name?.message} {...register('name')} />
            <div className="flex justify-end gap-3">
              <Button onClick={cancel}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={save.isPending}>Salvar {p.noun}</Button>
            </div>
          </form>
        </FormCard>
      </div>

      {saveHomonym && (
        <Dialog title="Nome já cadastrado" onClose={() => save.reset()}>
          <p className="m-0 text-sm text-fg2">{errorMessage(save.error)} Salvar mesmo assim, como um homônimo?</p>
          <div className="flex justify-end gap-3">
            <Button onClick={() => save.reset()}>Voltar</Button>
            <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate({ name: form.getValues('name'), allowDuplicate: true })}>Salvar mesmo assim</Button>
          </div>
        </Dialog>
      )}

      {reactivateHomonym && reactivate.variables && (
        <Dialog title="Nome já cadastrado" onClose={() => reactivate.reset()}>
          <p className="m-0 text-sm text-fg2">{errorMessage(reactivate.error)} Reativar mesmo assim, como um homônimo?</p>
          <div className="flex justify-end gap-3">
            <Button onClick={() => reactivate.reset()}>Voltar</Button>
            <Button variant="primary" disabled={reactivate.isPending} onClick={() => reactivate.mutate({ item: reactivate.variables!.item, allowDuplicate: true })}>Reativar mesmo assim</Button>
          </div>
        </Dialog>
      )}

      {removing && (
        <Dialog title={`Inativar ${p.noun}`} onClose={() => setRemoving(null)}>
          <p className="m-0 text-sm text-fg2">
            {removing.name} deixa de aparecer nas listas e não pode ser us{p.article === 'o' ? 'ado' : 'ada'} em livros novos; os livros que já {p.article} têm continuam com {p.article === 'o' ? 'ele' : 'ela'}. Só um administrador pode reativar {p.article} {p.noun}.
          </p>
          {inactivate.isError && <Banner kind="error">{errorMessage(inactivate.error)}</Banner>}
          <div className="flex justify-end gap-3">
            <Button onClick={() => setRemoving(null)}>Cancelar</Button>
            <Button variant="danger" disabled={inactivate.isPending} onClick={() => inactivate.mutate(removing.id)}>Inativar</Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
