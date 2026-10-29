import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { AuthorPicker, type AuthorChip } from './AuthorPicker'
import { mockApi } from '../test/mockApi'

const parentSubmit = vi.fn()

function Harness() {
  const [value, setValue] = useState<AuthorChip[]>([])
  return (
    <form onSubmit={(e) => { e.preventDefault(); parentSubmit() }}>
      <AuthorPicker id="authors" value={value} onChange={setValue} />
      <output aria-label="ids selecionados">{value.map((a) => a.id).join(',')}</output>
    </form>
  )
}

const renderPicker = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const open = async (typed = '') => {
  if (typed) await userEvent.type(screen.getByLabelText('Buscar autor pelo nome'), typed)
  await userEvent.click(await screen.findByRole('button', { name: 'Cadastrar novo autor' }))
  return screen.findByRole('dialog')
}

afterEach(() => {
  vi.restoreAllMocks()
  parentSubmit.mockClear()
})

describe('AuthorPicker: cadastrar novo autor', () => {
  it('abre o diálogo com o texto buscado, cadastra e seleciona o autor', async () => {
    const calls = mockApi({ 'POST /api/v1/authors': () => ({ status: 201, json: { id: 31, name: 'Clarice Lispector', active: true } }) })
    renderPicker()
    const dialog = await open('Clarice Lispector')
    const field = within(dialog).getByLabelText(/^Nome/)
    expect(field).toHaveValue('Clarice Lispector')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar autor' }))
    expect(await screen.findByRole('button', { name: 'Remover Clarice Lispector' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/authors')?.body).toEqual({ name: 'Clarice Lispector', allowDuplicate: false })
  })

  it('não envia o formulário de fora ao apertar Enter no diálogo', async () => {
    mockApi({ 'POST /api/v1/authors': () => ({ status: 201, json: { id: 31, name: 'Ana', active: true } }) })
    renderPicker()
    const dialog = await open()
    await userEvent.type(within(dialog).getByLabelText(/^Nome/), 'Ana{Enter}')
    expect(await screen.findByRole('button', { name: 'Remover Ana' })).toBeInTheDocument()
    expect(parentSubmit).not.toHaveBeenCalled()
  })

  it('recusa nome vazio sem chamar a API', async () => {
    const calls = mockApi({})
    renderPicker()
    const dialog = await open()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar autor' }))
    expect(await within(dialog).findByText('Informe o nome do autor.')).toBeInTheDocument()
    expect(calls.some((c) => c.key === 'POST /api/v1/authors')).toBe(false)
  })

  it('cancela sem cadastrar nada', async () => {
    const calls = mockApi({})
    renderPicker()
    const dialog = await open('Ana')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(calls.some((c) => c.key === 'POST /api/v1/authors')).toBe(false)
  })

  it('homônimo: pede confirmação e só repete com allowDuplicate ao confirmar', async () => {
    const calls = mockApi({
      'POST /api/v1/authors': ({ body }) =>
        (body as { allowDuplicate?: boolean }).allowDuplicate
          ? { status: 201, json: { id: 32, name: 'Ana', active: true } }
          : { status: 422, json: { detail: 'Já existe um autor ativo com este nome.', existingAuthorId: 1 } },
    })
    renderPicker()
    const dialog = await open('Ana')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar autor' }))
    expect(await within(dialog).findByText(/Já existe um autor ativo com este nome\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover Ana' })).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar mesmo assim' }))
    expect(await screen.findByRole('button', { name: 'Remover Ana' })).toBeInTheDocument()
    const posts = calls.filter((c) => c.key === 'POST /api/v1/authors')
    expect(posts.map((c) => (c.body as { allowDuplicate?: boolean }).allowDuplicate)).toEqual([false, true])
  })

  it('homônimo: voltar não cadastra e deixa corrigir o nome', async () => {
    const calls = mockApi({ 'POST /api/v1/authors': () => ({ status: 422, json: { detail: 'Já existe um autor ativo com este nome.', existingAuthorId: 1 } }) })
    renderPicker()
    const dialog = await open('Ana')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar autor' }))
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Voltar' }))
    expect(within(dialog).queryByRole('button', { name: 'Salvar mesmo assim' })).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^Nome/)).toHaveValue('Ana')
    expect(calls.filter((c) => c.key === 'POST /api/v1/authors')).toHaveLength(1)
  })

  it('mostra o erro da API sem fechar o diálogo', async () => {
    mockApi({ 'POST /api/v1/authors': () => ({ status: 500, json: { detail: 'Falha ao cadastrar.' } }) })
    renderPicker()
    const dialog = await open('Ana')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar autor' }))
    expect(await within(dialog).findByText(/Falha ao cadastrar/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  describe('homônimo: usar o autor existente', () => {
    const homonym = { 'POST /api/v1/authors': () => ({ status: 422, json: { detail: 'Já existe um autor ativo com este nome.', existingAuthorId: 12 } }) }

    it('seleciona o autor que a API apontou, sem criar outro', async () => {
      const calls = mockApi(homonym)
      renderPicker()
      const dialog = await open('Ana')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar autor' }))
      await userEvent.click(await within(dialog).findByRole('button', { name: 'Usar autor existente' }))
      expect(await screen.findByRole('button', { name: 'Remover Ana' })).toBeInTheDocument()
      expect(screen.getByLabelText('ids selecionados')).toHaveTextContent('12')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(calls.filter((c) => c.key === 'POST /api/v1/authors')).toHaveLength(1)
    })

    it('não duplica o autor que já estava selecionado', async () => {
      mockApi({
        'GET /api/v1/authors': () => ({ json: { items: [{ id: 12, name: 'Ana', active: true }], page: 0, size: 5, totalItems: 1, totalPages: 1 } }),
        ...homonym,
      })
      renderPicker()
      await userEvent.click(await screen.findByRole('button', { name: 'Ana' }))
      const dialog = await open('Ana')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar autor' }))
      await userEvent.click(await within(dialog).findByRole('button', { name: 'Usar autor existente' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.getByLabelText('ids selecionados')).toHaveTextContent(/^12$/)
    })

    it('só oferece a opção no homônimo, não em outros erros', async () => {
      mockApi({ 'POST /api/v1/authors': () => ({ status: 500, json: { detail: 'Falha ao cadastrar.' } }) })
      renderPicker()
      const dialog = await open('Ana')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar autor' }))
      await within(dialog).findByText(/Falha ao cadastrar/)
      expect(within(dialog).queryByRole('button', { name: 'Usar autor existente' })).not.toBeInTheDocument()
    })
  })

  it('400 com errors marca o campo Nome do diálogo, sem banner', async () => {
    mockApi({ 'POST /api/v1/authors': () => ({ status: 400, json: { detail: 'Dados inválidos.', errors: [{ field: 'name', message: 'o nome tem caracteres inválidos' }] } }) })
    renderPicker()
    const dialog = await open('Ana')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar autor' }))
    await waitFor(() => expect(within(dialog).getByLabelText(/^Nome/)).toHaveAccessibleDescription('O nome tem caracteres inválidos'))
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })
})
