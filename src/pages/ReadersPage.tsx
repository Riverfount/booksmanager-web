import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import type { z } from 'zod'
import { api, call, errorMessage } from '../api/client'
import type { Reader, ReaderSummary } from '../api/types'
import { Icon } from '../components/Icon'
import { Badge, Banner, Button, Card, DataTable, Dialog, EmptyState, ErrorSummary, FormCard, IconButton, PageHeader, Pagination, Pills, RequiredNote, SearchInput, Spinner, TextField } from '../components/ui'
import { isMinor } from '../lib/dates'
import { applyServerErrors, errorItems, errorTitle, fid, serverErrors } from '../lib/form'
import { maskDocument, maskPhone } from '../lib/masks'
import { readerSchema } from '../lib/schemas'
import { useDebounced } from '../lib/useDebounced'

type Values = z.infer<typeof readerSchema>
/** Field paths of the API → form fields. */
const serverFields = { name: 'name', document: 'document', email: 'email', phone: 'phone', birthDate: 'birthDate', 'guardian.name': 'guardianName', 'guardian.email': 'guardianEmail', 'guardian.phone': 'guardianPhone' }
const empty: Values = { name: '', document: '', email: '', phone: '', birthDate: '', guardianName: '', guardianEmail: '', guardianPhone: '' }
type Filter = 'active' | 'inactive' | 'blocked'

const situation = (r: ReaderSummary) =>
  !r.active ? { text: 'Inativo', color: 'var(--color-muted)' } : r.blocked ? { text: 'Bloqueado', color: 'var(--color-red)' } : { text: 'Ativo', color: 'var(--color-green)' }

export function ReadersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('active')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Reader | null>(null)
  const [removing, setRemoving] = useState<ReaderSummary | null>(null)
  const [done, setDone] = useState(false)
  const name = useDebounced(search.trim())

  const readers = useQuery({
    queryKey: ['readers', name, filter, page],
    queryFn: () => call(api.GET('/api/v1/readers', { params: { query: { name: name || undefined, active: filter !== 'inactive', blocked: filter === 'blocked' ? true : undefined, page } } })),
  })

  const form = useForm<Values>({ resolver: zodResolver(readerSchema), defaultValues: empty })
  const { register, handleSubmit, reset, setValue, setError, watch, formState: { errors } } = form
  const [birthDate, gName, gEmail, gPhone] = watch(['birthDate', 'guardianName', 'guardianEmail', 'guardianPhone'])
  const minor = isMinor(birthDate)
  const guardianRequired = minor || Boolean(gName || gEmail || gPhone)

  const refresh = () => qc.invalidateQueries({ queryKey: ['readers'] })
  const save = useMutation({
    mutationFn: (v: Values) => {
      const hasGuardian = Boolean(v.guardianName || v.guardianEmail || v.guardianPhone)
      const guardian = hasGuardian ? { name: v.guardianName, email: v.guardianEmail, phone: v.guardianPhone || undefined } : undefined
      const body = { name: v.name, document: v.document, email: v.email, phone: v.phone || undefined, birthDate: v.birthDate, guardian }
      return editing
        ? call(api.PATCH('/api/v1/readers/{id}', { params: { path: { id: editing.id } }, body }))
        : call(api.POST('/api/v1/readers', { body }))
    },
    onError: (error) => applyServerErrors(serverErrors(error, serverFields), setError),
    onSuccess: () => { setDone(true); setEditing(null); reset(empty); void refresh() },
  })
  const inactivate = useMutation({
    mutationFn: (id: number) => call(api.DELETE('/api/v1/readers/{id}', { params: { path: { id } } })),
    onSuccess: () => { setRemoving(null); void refresh() },
  })
  const toggleBlock = useMutation({
    mutationFn: (r: ReaderSummary) =>
      call(r.blocked
        ? api.POST('/api/v1/readers/{id}/unblock', { params: { path: { id: r.id } } })
        : api.POST('/api/v1/readers/{id}/block', { params: { path: { id: r.id } } })),
    onSuccess: refresh,
  })
  const loadForEdit = useMutation({
    mutationFn: (id: number) => call(api.GET('/api/v1/readers/{id}', { params: { path: { id } } })),
    onSuccess: (r) => {
      setDone(false)
      setEditing(r)
      reset({ name: r.name, document: r.document, email: r.email, phone: r.phone ?? '', birthDate: r.birthDate, guardianName: r.guardian?.name ?? '', guardianEmail: r.guardian?.email ?? '', guardianPhone: r.guardian?.phone ?? '' })
    },
  })

  const serverBanner = save.isError ? serverErrors(save.error, serverFields).banner : undefined
  const items = errorItems(errors, { name: 'Nome', document: 'Documento', email: 'E-mail', phone: 'Telefone', birthDate: 'Nascimento', guardianName: 'Nome do responsável', guardianEmail: 'E-mail do responsável', guardianPhone: 'Telefone do responsável' })
  const docField = register('document', { onChange: (e) => setValue('document', maskDocument(e.target.value)) })
  const phoneField = register('phone', { onChange: (e) => setValue('phone', maskPhone(e.target.value)) })
  const gPhoneField = register('guardianPhone', { onChange: (e) => setValue('guardianPhone', maskPhone(e.target.value)) })
  const star = guardianRequired ? <span aria-hidden="true" className="text-orange"> *</span> : null
  const actionError = toggleBlock.error ?? inactivate.error ?? loadForEdit.error

  return (
    <>
      <PageHeader title="Leitores" subtitle="Quem pode pegar livros emprestados" actions={<SearchInput label="Buscar leitor" placeholder="Buscar por nome" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />} />
      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex-[2_1_560px]">
          <Pills value={filter} onChange={(v) => { setFilter(v); setPage(0) }} options={[{ value: 'active', label: 'Ativos' }, { value: 'inactive', label: 'Inativos' }, { value: 'blocked', label: 'Só bloqueados' }]} />
          {actionError && <Banner kind="error">{errorMessage(actionError)}</Banner>}
          {readers.isPending && <Spinner />}
          {readers.isError && <Banner kind="error">{errorMessage(readers.error)}</Banner>}
          {readers.data && readers.data.items.length === 0 && <EmptyState>Nenhum leitor encontrado.</EmptyState>}
          {readers.data && readers.data.items.length > 0 && (
            <>
              <DataTable
                rows={readers.data.items}
                rowKey={(r) => r.id}
                columns={[
                  { header: 'Nome', width: '1.7fr', cell: (r) => (<div className="flex flex-col gap-0.5"><Link to={`/leitores/${r.id}`} className="font-semibold">{r.name}</Link><span className="font-mono text-xs text-muted">{r.maskedDocument}</span></div>) },
                  { header: 'E-mail', width: '1.6fr', cell: (r) => <span className="text-[13px] break-words text-fg2">{r.email}</span> },
                  { header: 'Situação', width: '1fr', cell: (r) => <Badge color={situation(r).color}>{situation(r).text}</Badge> },
                  {
                    header: 'Ações',
                    width: '1.5fr',
                    label: false,
                    cell: (r) => r.active && (
                      <div className="flex gap-1">
                        <IconButton label={`Editar ${r.name}`} onClick={() => loadForEdit.mutate(r.id)}><Icon name="edit" size={18} /></IconButton>
                        <IconButton label={r.blocked ? `Desbloquear ${r.name}` : `Bloquear ${r.name}`} onClick={() => toggleBlock.mutate(r)} style={{ color: 'var(--color-yellow)' }}><Icon name="lock" size={18} /></IconButton>
                        <IconButton label={`Inativar ${r.name}`} onClick={() => setRemoving(r)} style={{ color: 'var(--color-orange)' }}><Icon name="ban" size={18} /></IconButton>
                      </div>
                    ),
                  },
                ]}
              />
              <Pagination page={readers.data.page} totalPages={readers.data.totalPages} totalItems={readers.data.totalItems} onPage={setPage} />
            </>
          )}
        </Card>

        <FormCard title={editing ? 'Editar leitor' : 'Novo leitor'} className="flex-[1_1_340px]">
          <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="flex flex-col gap-4">
            <RequiredNote />
            {done && !save.isPending && <Banner kind="success">Leitor salvo com sucesso.</Banner>}
            {serverBanner && <Banner kind="error">{serverBanner}</Banner>}
            <ErrorSummary title={errorTitle(items.length, 'salvar o leitor')} items={items} />
            <TextField id={fid('name')} label="Nome" required maxLength={150} autoComplete="off" error={errors.name?.message} {...register('name')} />
            <TextField id={fid('document')} label="Documento" required mono maxLength={40} autoComplete="off" placeholder="CPF, RG ou outro documento" hint="Pontos e traços são ignorados. Deve ser único entre os leitores." error={errors.document?.message} {...docField} />
            <TextField id={fid('email')} label="E-mail" required inputMode="email" maxLength={254} autoComplete="off" placeholder="nome@exemplo.com" error={errors.email?.message} {...register('email')} />
            <div className="grid grid-cols-2 gap-3">
              <TextField id={fid('phone')} label="Telefone" inputMode="tel" maxLength={30} autoComplete="off" placeholder="(11) 98765-4321" error={errors.phone?.message} {...phoneField} />
              <TextField id={fid('birthDate')} label="Nascimento" required type="date" error={errors.birthDate?.message} {...register('birthDate')} />
            </div>
            <fieldset className="m-0 flex flex-col gap-3 rounded-lg border border-line p-3.5">
              <legend className="px-1.5 text-sm text-fg2">Responsável</legend>
              <span className={`text-[13px] ${minor ? 'text-orange' : 'text-fg3'}`}>{minor ? 'Leitor menor de 18 anos: o responsável é obrigatório.' : 'Obrigatório para leitores menores de 18 anos.'}</span>
              <TextField id={fid('guardianName')} label={<>Nome do responsável{star}</>} maxLength={150} autoComplete="off" error={errors.guardianName?.message} {...register('guardianName')} />
              <TextField id={fid('guardianEmail')} label={<>E-mail do responsável{star}</>} inputMode="email" autoComplete="off" error={errors.guardianEmail?.message} {...register('guardianEmail')} />
              <TextField id={fid('guardianPhone')} label="Telefone do responsável" inputMode="tel" maxLength={30} autoComplete="off" placeholder="(11) 98765-4321" error={errors.guardianPhone?.message} {...gPhoneField} />
            </fieldset>
            <div className="flex justify-end gap-3">
              <Button onClick={() => { setEditing(null); setDone(false); reset(empty) }}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={save.isPending}>Salvar leitor</Button>
            </div>
          </form>
        </FormCard>
      </div>

      {removing && (
        <Dialog title="Inativar leitor" onClose={() => setRemoving(null)}>
          <p className="m-0 text-sm text-fg2">{removing.name} deixa de poder pegar livros e perde o acesso ao sistema; o histórico é mantido. Não é possível reativar um leitor.</p>
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
