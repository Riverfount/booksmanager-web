import { useRef, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { api, call, errorMessage } from '../api/client'
import type { User } from '../api/types'
import { Icon } from '../components/Icon'
import { PasswordRules } from '../components/PasswordRules'
import { Badge, Banner, Button, Card, DataTable, Dialog, EmptyState, ErrorSummary, FormCard, IconButton, PageHeader, Pagination, Pills, RequiredNote, SearchInput, Spinner, TextField } from '../components/ui'
import { formatDateTime } from '../lib/dates'
import { errorItems, errorTitle, fid } from '../lib/form'
import { resetPasswordSchema, userEditSchema, userSchema } from '../lib/schemas'
import { useDebounced } from '../lib/useDebounced'

type Values = z.infer<typeof userSchema>
const roleLabel = { ADMIN: 'administrador', OPERATOR: 'operador', READER: 'leitor' } as const
const empty: Values = { login: '', displayName: '', role: 'OPERATOR', password: '' }

export function UsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<'true' | 'false'>('true')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<User | null>(null)
  const [resetting, setResetting] = useState<User | null>(null)
  const [removing, setRemoving] = useState<User | null>(null)
  const [done, setDone] = useState(false)
  const login = useDebounced(search.trim())

  const users = useQuery({
    queryKey: ['users', login, active, page],
    queryFn: () => call(api.GET('/api/v1/users', { params: { query: { login: login || undefined, active: active === 'true', page } } })),
  })

  const editingRef = useRef(false)
  editingRef.current = editing !== null
  const resolver: Resolver<Values> = (values, context, options) =>
    (editingRef.current ? zodResolver(userEditSchema) : zodResolver(userSchema))(values, context, options) as ReturnType<Resolver<Values>>
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitted } } = useForm<Values>({ resolver, defaultValues: empty })
  const password = watch('password')

  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] })
  const save = useMutation({
    mutationFn: (v: Values) =>
      editing
        ? call(api.PATCH('/api/v1/users/{id}', { params: { path: { id: editing.id } }, body: { role: v.role, displayName: v.displayName || undefined } }))
        : call(api.POST('/api/v1/users', { body: { login: v.login, password: v.password, role: v.role, displayName: v.displayName || undefined } })),
    onSuccess: () => { setDone(true); setEditing(null); reset(empty); void refresh() },
  })
  const unblock = useMutation({
    mutationFn: (id: number) => call(api.POST('/api/v1/users/{id}/unblock', { params: { path: { id } } })),
    onSuccess: refresh,
  })
  const inactivate = useMutation({
    mutationFn: (id: number) => call(api.DELETE('/api/v1/users/{id}', { params: { path: { id } } })),
    onSuccess: () => { setRemoving(null); void refresh() },
  })

  const startEdit = (u: User) => {
    // Readers get access through the reader registration, not this form.
    if (u.role === 'READER') return
    setDone(false)
    setEditing(u)
    reset({ login: u.login, displayName: u.displayName ?? '', role: u.role, password: '' })
  }
  const items = errorItems(errors, { login: 'Login', displayName: 'Nome de exibição', password: 'Senha' })

  return (
    <>
      <PageHeader title="Usuários" subtitle="Administradores e operadores que entram no sistema" actions={<SearchInput label="Buscar usuário" placeholder="Buscar por login" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />} />
      <div className="flex flex-wrap items-start gap-6">
        <Card className="flex-[2_1_540px]">
          <Pills value={active} onChange={(v) => { setActive(v); setPage(0) }} options={[{ value: 'true', label: 'Ativos' }, { value: 'false', label: 'Inativos' }]} />
          {unblock.isError && <Banner kind="error">{errorMessage(unblock.error)}</Banner>}
          {users.isPending && <Spinner />}
          {users.isError && <Banner kind="error">{errorMessage(users.error)}</Banner>}
          {users.data && users.data.items.length === 0 && <EmptyState>Nenhum usuário encontrado.</EmptyState>}
          {users.data && users.data.items.length > 0 && (
            <>
              <DataTable
                rows={users.data.items}
                rowKey={(u) => u.id}
                columns={[
                  { header: 'Login', width: '1.5fr', cell: (u) => (<div className="flex flex-col"><span className="font-mono font-semibold">{u.login}</span>{u.displayName && <span className="text-xs text-muted">{u.displayName}</span>}</div>) },
                  { header: 'Perfil', width: '1fr', cell: (u) => <Badge color={u.role === 'ADMIN' ? '#fe8019' : '#8ec07c'}>{roleLabel[u.role]}</Badge> },
                  { header: 'Situação', width: '1.5fr', cell: (u) => <span className="text-[13px] font-medium" style={{ color: !u.active ? '#a89984' : u.blocked ? '#fb4934' : '#8ec07c' }}>{!u.active ? 'Inativo' : u.blocked ? `Bloqueado até ${formatDateTime(u.blockedUntil)}` : 'Ativo'}</span> },
                  {
                    header: 'Ações',
                    width: '1.7fr',
                    label: false,
                    cell: (u) => u.active && (
                      <div className="flex gap-1">
                        <IconButton label={`Editar ${u.login}`} onClick={() => startEdit(u)}><Icon name="edit" size={18} /></IconButton>
                        <IconButton label={`Redefinir senha de ${u.login}`} onClick={() => setResetting(u)}><Icon name="key" size={18} /></IconButton>
                        {u.blocked && <IconButton label={`Desbloquear ${u.login}`} onClick={() => unblock.mutate(u.id)} style={{ color: '#fabd2f' }}><Icon name="lock" size={18} /></IconButton>}
                        <IconButton label={`Inativar ${u.login}`} onClick={() => setRemoving(u)} style={{ color: '#fe8019' }}><Icon name="ban" size={18} /></IconButton>
                      </div>
                    ),
                  },
                ]}
              />
              <Pagination page={users.data.page} totalPages={users.data.totalPages} totalItems={users.data.totalItems} onPage={setPage} />
            </>
          )}
        </Card>

        <FormCard title={editing ? 'Editar usuário' : 'Novo usuário'} className="flex-[1_1_340px]">
          <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="flex flex-col gap-4">
            <RequiredNote />
            {done && !save.isPending && <Banner kind="success">Usuário salvo com sucesso.</Banner>}
            {save.isError && <Banner kind="error">{errorMessage(save.error)}</Banner>}
            <ErrorSummary title={errorTitle(items.length, editing ? 'salvar o usuário' : 'criar o usuário')} items={items} />
            <TextField id={fid('login')} label="Login" required mono readOnly={!!editing} maxLength={50} autoComplete="off" autoCapitalize="none" placeholder="Ex.: maria" hint="Único, guardado em minúsculas e não pode ser alterado depois." error={errors.login?.message} {...register('login')} />
            <TextField id={fid('displayName')} label="Nome de exibição" maxLength={100} autoComplete="off" placeholder="Ex.: Maria Souza" hint="É o que aparece na barra lateral. Sem ele, vale o login." error={errors.displayName?.message} {...register('displayName')} />
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1.5 p-0 text-sm text-fg2">Perfil de acesso <span aria-hidden="true" className="text-orange">*</span></legend>
              {([['OPERATOR', 'Operador', 'Registra empréstimos e devoluções'], ['ADMIN', 'Administrador', 'Faz tudo do operador e gerencia usuários e parâmetros']] as const).map(([value, title, text]) => (
                <label key={value} className="box-border flex min-h-11 items-start gap-3 rounded-md border border-line bg-bg0-h p-3 text-sm">
                  <input type="radio" value={value} className="mt-0.5 accent-yellow" {...register('role')} />
                  <span className="flex flex-col gap-0.5"><span className="font-semibold">{title}</span><span className="text-[13px] text-muted">{text}</span></span>
                </label>
              ))}
            </fieldset>
            {!editing && (
              <>
                <TextField id={fid('password')} label="Senha" required type="password" autoComplete="new-password" maxLength={25} aria-describedby="rules-senha" error={errors.password?.message} {...register('password')} />
                <PasswordRules id="rules-senha" password={password} submitted={isSubmitted} />
              </>
            )}
            <div className="flex justify-end gap-3">
              <Button onClick={() => { setEditing(null); setDone(false); reset(empty) }}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={save.isPending}>{editing ? 'Salvar usuário' : 'Criar usuário'}</Button>
            </div>
          </form>
        </FormCard>
      </div>

      {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}
      {removing && (
        <Dialog title="Inativar usuário" onClose={() => setRemoving(null)}>
          <p className="m-0 text-sm text-fg2">{removing.login} deixa de poder entrar no sistema. Não é possível inativar a si mesmo nem o último administrador ativo.</p>
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

function ResetPasswordDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const [saved, setSaved] = useState(false)
  const { register, handleSubmit, watch, formState: { errors, isSubmitted } } = useForm<z.infer<typeof resetPasswordSchema>>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '' } })
  const reset = useMutation({
    mutationFn: (password: string) => call(api.PUT('/api/v1/users/{id}/password', { params: { path: { id: user.id } }, body: { password } })),
    onSuccess: () => setSaved(true),
  })
  return (
    <Dialog title={`Redefinir senha de ${user.login}`} onClose={onClose}>
      {saved ? (
        <>
          <Banner kind="success">Senha redefinida. Quem estava logado precisa entrar de novo.</Banner>
          <div className="flex justify-end"><Button variant="primary" onClick={onClose}>Concluir</Button></div>
        </>
      ) : (
        <form noValidate onSubmit={handleSubmit((v) => reset.mutate(v.password))} className="flex flex-col gap-4">
          {reset.isError && <Banner kind="error">{errorMessage(reset.error)}</Banner>}
          <TextField id={fid('password')} label="Nova senha" required type="password" autoComplete="new-password" maxLength={25} autoFocus error={errors.password?.message} {...register('password')} />
          <PasswordRules id="rules-nova" password={watch('password')} submitted={isSubmitted} />
          <div className="flex justify-end gap-3">
            <Button onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={reset.isPending}>Redefinir senha</Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
