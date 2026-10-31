import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChangeOwnPasswordDialog } from './ChangeOwnPasswordDialog'
import { mockApi } from '../test/mockApi'

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ signOut }) }))

const renderDialog = (onClose = vi.fn()) => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChangeOwnPasswordDialog onClose={onClose} />
    </QueryClientProvider>,
  )
  return onClose
}

const fill = async (current: string, next: string, repeat = next) => {
  await userEvent.type(screen.getByLabelText(/^Senha atual/), current)
  await userEvent.type(screen.getByLabelText(/^Nova senha/), next)
  await userEvent.type(screen.getByLabelText(/^Repita a nova senha/), repeat)
}
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Trocar a senha' }))
const URL_KEY = 'POST /api/v1/users/me/password'

afterEach(() => { vi.restoreAllMocks(); signOut.mockClear() })

describe('alterar a própria senha (equipe)', () => {
  it('pede a senha atual, a nova e a repetição, mostrando as regras da senha', () => {
    renderDialog()

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Alterar senha')
    expect(screen.getByLabelText(/^Senha atual/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Nova senha/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Repita a nova senha/)).toBeInTheDocument()
    expect(screen.getByText(/De 8 a 25 caracteres/)).toBeInTheDocument()
  })

  it('envia as duas senhas e, ao dar certo, sai da sessão avisando para entrar de novo', async () => {
    const calls = mockApi({ [URL_KEY]: () => ({ status: 204 }) })
    renderDialog()

    await fill('Antiga#123', 'Nova#Senha1')
    await submit()

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1))
    expect(signOut).toHaveBeenCalledWith('Senha trocada. Entre de novo com a nova senha.')
    expect(calls.find((c) => c.key === URL_KEY)?.body).toEqual({ currentPassword: 'Antiga#123', newPassword: 'Nova#Senha1' })
  })

  it('não chama a API quando a repetição não confere', async () => {
    const calls = mockApi({})
    renderDialog()

    await fill('Antiga#123', 'Nova#Senha1', 'Outra#Senha2')
    await submit()

    expect(await screen.findByText(/Corrija 1 campo/)).toBeInTheDocument()
    expect(calls.some((c) => c.key === URL_KEY)).toBe(false)
    expect(signOut).not.toHaveBeenCalled()
  })

  it('não chama a API com a senha atual em branco', async () => {
    const calls = mockApi({})
    renderDialog()

    await userEvent.type(screen.getByLabelText(/^Nova senha/), 'Nova#Senha1')
    await userEvent.type(screen.getByLabelText(/^Repita a nova senha/), 'Nova#Senha1')
    await submit()

    expect(await screen.findByText('Informe a senha atual.')).toBeInTheDocument()
    expect(calls.some((c) => c.key === URL_KEY)).toBe(false)
  })

  it('marca a senha atual com a mensagem da API quando ela está errada e mantém o diálogo aberto', async () => {
    mockApi({ [URL_KEY]: () => ({ status: 422, json: { detail: 'a senha atual está incorreta' } }) })
    renderDialog()

    await fill('Errada#123', 'Nova#Senha1')
    await submit()

    await waitFor(() => expect(screen.getByLabelText(/^Senha atual/)).toHaveAccessibleDescription(/senha atual está incorreta/i))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
  })

  it.each([
    ['conta bloqueada', 'a conta está bloqueada temporariamente por tentativas de senha erradas; tente mais tarde'],
    ['usuário inativo', 'o usuário inativo não pode trocar a senha'],
  ])('mostra a mensagem da API quando há outra recusa (%s)', async (_label, detail) => {
    mockApi({ [URL_KEY]: () => ({ status: 422, json: { detail } }) })
    renderDialog()

    await fill('Antiga#123', 'Nova#Senha1')
    await submit()

    expect(await screen.findByText(new RegExp(detail.slice(0, 30), 'i'))).toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('o botão Cancelar fecha o diálogo sem chamar a API nem sair da sessão', async () => {
    const calls = mockApi({})
    const onClose = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(calls.some((c) => c.key === URL_KEY)).toBe(false)
    expect(signOut).not.toHaveBeenCalled()
  })
})
