import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CategoryPicker, type CategoryChoice } from './CategoryPicker'
import { mockApi } from '../test/mockApi'

const parentSubmit = vi.fn()

function Harness(props: { creatable?: boolean; compact?: boolean; reader?: boolean }) {
  const [value, setValue] = useState<CategoryChoice | null>(null)
  return (
    <form onSubmit={(e) => { e.preventDefault(); parentSubmit() }}>
      <CategoryPicker id="category" value={value} onChange={setValue} {...props} />
      <output aria-label="id selecionado">{value?.id ?? ''}</output>
    </form>
  )
}

const renderPicker = (props: Parameters<typeof Harness>[0] = { creatable: true }) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Harness {...props} />
    </QueryClientProvider>,
  )

const open = async (typed = '') => {
  if (typed) await userEvent.type(screen.getByLabelText('Buscar categoria pelo nome'), typed)
  await userEvent.click(await screen.findByRole('button', { name: 'Cadastrar nova categoria' }))
  return screen.findByRole('dialog')
}

afterEach(() => {
  vi.restoreAllMocks()
  parentSubmit.mockClear()
})

describe('CategoryPicker: cadastrar nova categoria', () => {
  it('abre o diálogo com o texto buscado, cadastra e seleciona a categoria', async () => {
    const calls = mockApi({ 'POST /api/v1/categories': () => ({ status: 201, json: { id: 7, name: 'Poesia', active: true } }) })
    renderPicker()
    const dialog = await open('Poesia')
    expect(within(dialog).getByLabelText(/^Nome/)).toHaveValue('Poesia')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar categoria' }))
    expect(await screen.findByRole('button', { name: 'Remover Poesia' })).toBeInTheDocument()
    expect(screen.getByLabelText('id selecionado')).toHaveTextContent('7')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/categories')?.body).toEqual({ name: 'Poesia' })
  })

  it('não envia o formulário de fora ao apertar Enter no diálogo', async () => {
    mockApi({ 'POST /api/v1/categories': () => ({ status: 201, json: { id: 7, name: 'Poesia', active: true } }) })
    renderPicker()
    const dialog = await open()
    await userEvent.type(within(dialog).getByLabelText(/^Nome/), 'Poesia{Enter}')
    expect(await screen.findByRole('button', { name: 'Remover Poesia' })).toBeInTheDocument()
    expect(parentSubmit).not.toHaveBeenCalled()
  })

  it('recusa nome vazio sem chamar a API', async () => {
    const calls = mockApi({})
    renderPicker()
    const dialog = await open()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar categoria' }))
    expect(await within(dialog).findByText('Informe o nome da categoria.')).toBeInTheDocument()
    expect(calls.some((c) => c.key === 'POST /api/v1/categories')).toBe(false)
  })

  it('cancela sem cadastrar nada', async () => {
    const calls = mockApi({})
    renderPicker()
    const dialog = await open('Poesia')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(calls.some((c) => c.key === 'POST /api/v1/categories')).toBe(false)
  })

  it('mostra o erro da API (nome repetido) sem fechar o diálogo', async () => {
    mockApi({ 'POST /api/v1/categories': () => ({ status: 422, json: { detail: 'Já existe uma categoria com este nome.' } }) })
    renderPicker()
    const dialog = await open('Poesia')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar categoria' }))
    expect(await within(dialog).findByText(/Já existe uma categoria com este nome\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover Poesia' })).not.toBeInTheDocument()
  })

  it('400 com errors marca o campo Nome, sem banner', async () => {
    mockApi({ 'POST /api/v1/categories': () => ({ status: 400, json: { detail: 'Dados inválidos.', errors: [{ field: 'name', message: 'o nome tem caracteres inválidos' }] } }) })
    renderPicker()
    const dialog = await open('Poesia')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar categoria' }))
    expect(await within(dialog).findByText('O nome tem caracteres inválidos')).toBeInTheDocument()
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['sem creatable', { }],
    ['filtro (compact)', { creatable: true, compact: true }],
    ['área do leitor', { creatable: true, reader: true }],
  ])('não oferece o cadastro: %s', async (_, props) => {
    const calls = mockApi({})
    renderPicker(props)
    await waitFor(() => expect(calls.some((c) => c.key === 'GET /api/v1/categories' || c.key === 'GET /api/v1/me/categories')).toBe(true))
    expect(screen.queryByRole('button', { name: 'Cadastrar nova categoria' })).not.toBeInTheDocument()
  })
})
