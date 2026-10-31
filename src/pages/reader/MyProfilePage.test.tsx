import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { mockApi } from '../../test/mockApi'
import { MyProfilePage } from './MyProfilePage'

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }))
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: false, signOut, state: { status: 'authenticated', user: { id: 9, login: 'ana', displayName: 'Ana Leitora', role: 'READER' } } }),
}))

const adult = { name: 'Ana Souza', document: '*********11', email: 'ana@example.com', phone: '11 91111-1111', birthDate: '1990-05-10', minor: false }
const minor = { name: 'Pedro Lima', document: '*********22', email: 'pedro@example.com', birthDate: '2014-03-01', minor: true, guardian: { name: 'Carla Lima', email: 'carla@example.com', phone: '11 93333-3333' } }

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><MyProfilePage /></MemoryRouter>
    </QueryClientProvider>,
  )
// the password form also has a "Senha atual" field, so the contact one is looked up inside its own card
const contact = () => within(screen.getByRole('heading', { name: 'Contato' }).closest('section')!)
const sent = (calls: ReturnType<typeof mockApi>, key: string) => calls.filter((c) => c.key === key)

afterEach(() => { vi.restoreAllMocks(); signOut.mockClear() })

describe('meus dados', () => {
  it('mostra o que só a biblioteca altera e deixa editar só o contato', async () => {
    const calls = mockApi({ 'GET /api/v1/me/profile': () => ({ json: adult }) })
    renderPage()
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('*********11')).toBeInTheDocument()
    expect(screen.getByText('10/05/1990')).toBeInTheDocument()
    expect(screen.getByLabelText(/E-mail/)).toHaveValue('ana@example.com')
    expect(screen.getByLabelText(/Telefone/)).toHaveValue('11 91111-1111')
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
    expect(screen.queryByText('Responsável')).not.toBeInTheDocument()
    expect(calls.every((c) => !c.url.searchParams.has('readerId'))).toBe(true)
  })

  it('mostra o responsável só para o menor de 18 anos', async () => {
    mockApi({ 'GET /api/v1/me/profile': () => ({ json: minor }) })
    renderPage()
    expect(await screen.findByLabelText(/Nome do responsável/)).toHaveValue('Carla Lima')
    expect(screen.getByLabelText(/E-mail do responsável/)).toHaveValue('carla@example.com')
  })

  it('salva só o telefone sem pedir a senha e sem mandar o e-mail', async () => {
    const calls = mockApi({
      'GET /api/v1/me/profile': () => ({ json: adult }),
      'PATCH /api/v1/me/profile': () => ({ json: { ...adult, phone: '21 98888-7777' } }),
    })
    renderPage()
    const phone = await screen.findByLabelText(/Telefone/)
    await userEvent.clear(phone)
    await userEvent.type(phone, '21988887777')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Dados salvos.')).toBeInTheDocument()
    expect(contact().queryByLabelText(/Senha atual/)).not.toBeInTheDocument()
    expect(sent(calls, 'PATCH /api/v1/me/profile')[0].body).toEqual({ phone: '(21) 98888-7777' })
  })

  it('pede a senha atual ao trocar o e-mail e não envia sem ela', async () => {
    const calls = mockApi({ 'GET /api/v1/me/profile': () => ({ json: adult }) })
    renderPage()
    const email = await screen.findByLabelText(/E-mail/)
    await userEvent.clear(email)
    await userEvent.type(email, 'nova@example.com')
    expect(await contact().findByLabelText(/Senha atual/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect((await screen.findAllByText(/Informe a senha atual para trocar o e-mail/)).length).toBeGreaterThan(0)
    expect(sent(calls, 'PATCH /api/v1/me/profile')).toHaveLength(0)
  })

  it('envia o e-mail novo com a senha atual', async () => {
    const calls = mockApi({
      'GET /api/v1/me/profile': () => ({ json: adult }),
      'PATCH /api/v1/me/profile': () => ({ json: { ...adult, email: 'nova@example.com' } }),
    })
    renderPage()
    const email = await screen.findByLabelText(/E-mail/)
    await userEvent.clear(email)
    await userEvent.type(email, 'nova@example.com')
    await userEvent.type(await contact().findByLabelText(/Senha atual/), 'Senha#Atual1')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Dados salvos.')).toBeInTheDocument()
    expect(sent(calls, 'PATCH /api/v1/me/profile')[0].body).toMatchObject({ email: 'nova@example.com', currentPassword: 'Senha#Atual1' })
  })

  it('mostra no campo da senha o 422 de senha atual errada', async () => {
    mockApi({
      'GET /api/v1/me/profile': () => ({ json: adult }),
      'PATCH /api/v1/me/profile': () => ({ status: 422, json: { status: 422, detail: 'a senha atual está incorreta' } }),
    })
    renderPage()
    const email = await screen.findByLabelText(/E-mail/)
    await userEvent.clear(email)
    await userEvent.type(email, 'nova@example.com')
    await userEvent.type(await contact().findByLabelText(/Senha atual/), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect((await screen.findAllByText('A senha atual está incorreta')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Dados salvos.')).not.toBeInTheDocument()
  })

  it('manda o responsável do menor', async () => {
    const calls = mockApi({
      'GET /api/v1/me/profile': () => ({ json: minor }),
      'PATCH /api/v1/me/profile': () => ({ json: minor }),
    })
    renderPage()
    const guardianEmail = await screen.findByLabelText(/E-mail do responsável/)
    await userEvent.clear(guardianEmail)
    await userEvent.type(guardianEmail, 'nova@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(sent(calls, 'PATCH /api/v1/me/profile')).toHaveLength(1))
    expect(sent(calls, 'PATCH /api/v1/me/profile')[0].body).toMatchObject({ guardian: { name: 'Carla Lima', email: 'nova@example.com', phone: '11 93333-3333' } })
  })

  it('troca a senha e leva o leitor a entrar de novo', async () => {
    const calls = mockApi({
      'GET /api/v1/me/profile': () => ({ json: adult }),
      'POST /api/v1/me/password': () => ({ status: 204 }),
    })
    renderPage()
    await screen.findByText('Ana Souza')
    const fields = screen.getAllByLabelText(/^Senha atual/)
    await userEvent.type(fields[fields.length - 1], 'Antiga#123')
    await userEvent.type(screen.getByLabelText(/^Nova senha/), 'Nova#Senha1')
    await userEvent.type(screen.getByLabelText(/^Repita a nova senha/), 'Nova#Senha1')
    await userEvent.click(screen.getByRole('button', { name: 'Trocar a senha' }))
    expect(await screen.findByText(/todas as sessões foram encerradas/)).toBeInTheDocument()
    expect(sent(calls, 'POST /api/v1/me/password')[0].body).toEqual({ currentPassword: 'Antiga#123', newPassword: 'Nova#Senha1' })
    await userEvent.click(screen.getByRole('button', { name: 'Entrar de novo' }))
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('não troca a senha se a confirmação não confere', async () => {
    const calls = mockApi({ 'GET /api/v1/me/profile': () => ({ json: adult }) })
    renderPage()
    await screen.findByText('Ana Souza')
    await userEvent.type(screen.getByLabelText(/^Senha atual/), 'Antiga#123')
    await userEvent.type(screen.getByLabelText(/^Nova senha/), 'Nova#Senha1')
    await userEvent.type(screen.getByLabelText(/^Repita a nova senha/), 'Outra#Senha1')
    await userEvent.click(screen.getByRole('button', { name: 'Trocar a senha' }))
    expect((await screen.findAllByText(/As senhas não são iguais/)).length).toBeGreaterThan(0)
    expect(sent(calls, 'POST /api/v1/me/password')).toHaveLength(0)
  })

  it('mostra o 422 de senha atual errada no campo da troca de senha', async () => {
    mockApi({
      'GET /api/v1/me/profile': () => ({ json: adult }),
      'POST /api/v1/me/password': () => ({ status: 422, json: { status: 422, detail: 'a senha atual está incorreta' } }),
    })
    renderPage()
    await screen.findByText('Ana Souza')
    await userEvent.type(screen.getByLabelText(/^Senha atual/), 'errada')
    await userEvent.type(screen.getByLabelText(/^Nova senha/), 'Nova#Senha1')
    await userEvent.type(screen.getByLabelText(/^Repita a nova senha/), 'Nova#Senha1')
    await userEvent.click(screen.getByRole('button', { name: 'Trocar a senha' }))
    expect((await screen.findAllByText('A senha atual está incorreta')).length).toBeGreaterThan(0)
    expect(signOut).not.toHaveBeenCalled()
  })
})
