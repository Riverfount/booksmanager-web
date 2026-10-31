import { render, screen } from '@testing-library/react'
import { SelectField, TextField } from './ui'

/** What a screen reader reads with the field: the description built from the ids in aria-describedby. */
const withRules = (field: React.ReactNode) =>
  render(
    <>
      {field}
      <p id="regras">Use 8 a 25 caracteres</p>
    </>,
  )

describe('TextField: aria-describedby', () => {
  it('a descrição de quem chama, a dica e o erro valem juntos, nessa ordem', () => {
    withRules(<TextField label="Senha" hint="Dica do campo" error="Informe a senha." aria-describedby="regras" />)

    const input = screen.getByLabelText(/^Senha/)
    expect(input).toHaveAttribute('aria-describedby', expect.stringMatching(/^regras .+-hint .+-err$/))
    expect(input).toHaveAccessibleDescription('Use 8 a 25 caracteres Dica do campo Informe a senha.')
  })

  it('com a descrição de quem chama e o erro, o erro continua sendo lido', () => {
    withRules(<TextField label="Senha" error="A senha não atende às regras abaixo." aria-describedby="regras" />)

    expect(screen.getByLabelText(/^Senha/)).toHaveAccessibleDescription('Use 8 a 25 caracteres A senha não atende às regras abaixo.')
  })

  it('sem erro, só a descrição de quem chama', () => {
    withRules(<TextField label="Senha" aria-describedby="regras" />)

    expect(screen.getByLabelText(/^Senha/)).toHaveAccessibleDescription('Use 8 a 25 caracteres')
  })

  it('sem nada a descrever, não há aria-describedby', () => {
    render(<TextField label="Login" />)

    expect(screen.getByLabelText(/^Login/)).not.toHaveAttribute('aria-describedby')
  })

  it('só a dica ou só o erro mantêm o comportamento de antes', () => {
    render(<><TextField label="A" hint="só dica" /><TextField label="B" error="só erro" /></>)

    expect(screen.getByLabelText(/^A/)).toHaveAccessibleDescription('só dica')
    expect(screen.getByLabelText(/^B/)).toHaveAccessibleDescription('só erro')
  })

  it('um id repetido na descrição de quem chama não duplica a leitura', () => {
    render(<TextField id="campo" label="Senha" error="Erro." aria-describedby="campo-err" />)

    expect(screen.getByLabelText(/^Senha/)).toHaveAttribute('aria-describedby', 'campo-err')
  })
})

describe('SelectField: aria-describedby', () => {
  const options = <><option value="A">A</option><option value="B">B</option></>

  it('liga a dica e o erro ao campo', () => {
    render(<SelectField label="Perfil" hint="Escolha um perfil" error="Informe o perfil.">{options}</SelectField>)

    expect(screen.getByLabelText(/^Perfil/)).toHaveAccessibleDescription('Escolha um perfil Informe o perfil.')
  })

  it('só a dica já basta para o campo ser descrito', () => {
    render(<SelectField label="Perfil" hint="Escolha um perfil">{options}</SelectField>)

    expect(screen.getByLabelText(/^Perfil/)).toHaveAccessibleDescription('Escolha um perfil')
  })

  it('a descrição de quem chama também vale', () => {
    withRules(<SelectField label="Perfil" error="Informe o perfil." aria-describedby="regras">{options}</SelectField>)

    expect(screen.getByLabelText(/^Perfil/)).toHaveAccessibleDescription('Use 8 a 25 caracteres Informe o perfil.')
  })

  it('sem dica nem erro, não há aria-describedby', () => {
    render(<SelectField label="Perfil">{options}</SelectField>)

    expect(screen.getByLabelText(/^Perfil/)).not.toHaveAttribute('aria-describedby')
  })
})
