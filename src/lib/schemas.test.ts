import { acceptInvitationSchema, authorSchema, changePasswordSchema, ownContactSchemaFor, forgotPasswordSchema, newPasswordSchema, bookSchema, bookSchemaFor, configSchema, isbnValid, passwordChecks, readerSchema, userSchema } from './schemas'
import { isMinor } from './dates'

const msgs = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.success ? [] : r.error!.issues.map((i) => i.message))

describe('ISBN', () => {
  it('valida ISBN-13 e ISBN-10 pelo dígito verificador', () => {
    expect(isbnValid('9788533302273')).toBe(true)
    expect(isbnValid('978-85-333-0227-3')).toBe(true)
    expect(isbnValid('9788533302274')).toBe(false)
    expect(isbnValid('0306406152')).toBe(true)
    expect(isbnValid('123')).toBe(false)
  })
})

describe('autor', () => {
  it('exige nome e limita em 150', () => {
    expect(msgs(authorSchema.safeParse({ name: '  ' }))).toContain('Informe o nome do autor.')
    expect(authorSchema.safeParse({ name: 'x'.repeat(151) }).success).toBe(false)
    expect(authorSchema.safeParse({ name: 'Machado de Assis' }).success).toBe(true)
  })
})

describe('livro', () => {
  const ok = { isbn: '9788533302273', title: 'Dom Casmurro', publisher: 'Garnier', year: '1899', categoryId: '1', authorIds: [1] }
  it('aceita o mínimo válido', () => expect(bookSchema.safeParse(ok).success).toBe(true))
  it('exige categoria e ao menos um autor', () => {
    const r = msgs(bookSchema.safeParse({ ...ok, categoryId: '', authorIds: [] }))
    expect(r).toContain('Selecione a categoria do livro.')
    expect(r).toContain('Selecione ao menos um autor.')
  })
  it('recusa ano futuro', () => {
    expect(bookSchema.safeParse({ ...ok, year: String(new Date().getFullYear() + 1) }).success).toBe(false)
  })
  it('exige editora e ano no cadastro', () => {
    const r = msgs(bookSchema.safeParse({ ...ok, publisher: '  ', year: '' }))
    expect(r).toContain('Informe a editora.')
    expect(r).toContain('Informe o ano de publicação.')
  })
  it('limita a editora em 255 caracteres', () => {
    expect(bookSchema.safeParse({ ...ok, publisher: 'x'.repeat(256) }).success).toBe(false)
    expect(bookSchema.safeParse({ ...ok, publisher: 'x'.repeat(255) }).success).toBe(true)
  })
  it('aceita ano a partir de 1450', () => {
    expect(bookSchema.safeParse({ ...ok, year: '1449' }).success).toBe(false)
    expect(bookSchema.safeParse({ ...ok, year: '1450' }).success).toBe(true)
  })
  it('livro antigo sem editora ou ano continua editável', () => {
    const legacy = bookSchemaFor({ publisher: true, year: true })
    expect(legacy.safeParse({ ...ok, publisher: '', year: '' }).success).toBe(true)
    expect(bookSchemaFor({ publisher: true }).safeParse({ ...ok, publisher: '', year: '' }).success).toBe(false)
  })
})

describe('leitor', () => {
  const base = { name: 'Ana', document: '123.456.789-01', email: 'ana@exemplo.com', phone: '', birthDate: '1990-01-01', guardianName: '', guardianEmail: '', guardianPhone: '' }
  it('adulto sem responsável é válido', () => expect(readerSchema.safeParse(base).success).toBe(true))
  it('menor de 18 anos exige responsável', () => {
    const year = new Date().getFullYear() - 10
    const r = readerSchema.safeParse({ ...base, birthDate: `${year}-06-15` })
    expect(r.success).toBe(false)
    expect(msgs(r)).toEqual(expect.arrayContaining(['Informe o nome do responsável.', 'Informe o e-mail do responsável.']))
  })
  it('e-mail e telefone inválidos', () => {
    expect(readerSchema.safeParse({ ...base, email: 'ana@' }).success).toBe(false)
    expect(readerSchema.safeParse({ ...base, phone: '123' }).success).toBe(false)
    expect(readerSchema.safeParse({ ...base, phone: '(11) 98765-4321' }).success).toBe(true)
  })
  it('data de nascimento futura é recusada', () => {
    expect(readerSchema.safeParse({ ...base, birthDate: '2999-01-01' }).success).toBe(false)
  })
  it('isMinor usa a data de referência', () => {
    const now = new Date(2026, 9, 18)
    expect(isMinor('2008-10-19', now)).toBe(true)
    expect(isMinor('2008-10-18', now)).toBe(false)
  })
})

describe('usuário e senha', () => {
  it('lista as regras atendidas', () => {
    expect(passwordChecks('Abcdef1!').every((c) => c.met)).toBe(true)
    expect(passwordChecks('abc').filter((c) => c.met)).toHaveLength(1)
  })
  it('login sem espaços e senha dentro da política', () => {
    const ok = { login: 'maria', displayName: '', role: 'OPERATOR' as const, password: 'Abcdef1!' }
    expect(userSchema.safeParse(ok).success).toBe(true)
    expect(userSchema.safeParse({ ...ok, login: 'ma ria' }).success).toBe(false)
    expect(userSchema.safeParse({ ...ok, password: 'fraca' }).success).toBe(false)
  })
})

describe('configuração', () => {
  const ok = { penaltyPolicy: 'BOTH' as const, dailyFineAmount: '1.00', fineCap: '10.00', suspensionDaysPerDay: '1', suspensionCapDays: '365', loanPeriodDays: '14', loanLimit: '3', renewalLimit: '2', reservationPickupDays: '3', dueSoonNoticeDays: '2' }
  it('aceita os valores iniciais da política', () => expect(configSchema.safeParse(ok).success).toBe(true))
  it('teto não pode ficar abaixo da multa de um dia', () => {
    expect(configSchema.safeParse({ ...ok, dailyFineAmount: '5', fineCap: '2' }).success).toBe(false)
  })
  it('exige inteiros nos prazos e limites', () => {
    expect(configSchema.safeParse({ ...ok, loanPeriodDays: '0' }).success).toBe(false)
    expect(configSchema.safeParse({ ...ok, loanLimit: '2.5' }).success).toBe(false)
    expect(configSchema.safeParse({ ...ok, renewalLimit: '0' }).success).toBe(true)
  })
  it('aviso de vencimento: inteiro de pelo menos 1 dia', () => {
    expect(configSchema.safeParse({ ...ok, dueSoonNoticeDays: '0' }).success).toBe(false)
    expect(configSchema.safeParse({ ...ok, dueSoonNoticeDays: '' }).success).toBe(false)
    expect(configSchema.safeParse({ ...ok, dueSoonNoticeDays: '1' }).success).toBe(true)
  })
})

describe('acesso do leitor', () => {
  const strong = 'Abcdef1!'
  it('convite: login sem espaços, senha forte e confirmação igual', () => {
    const ok = { login: 'ana.leitora', password: strong, confirmPassword: strong }
    expect(acceptInvitationSchema.safeParse(ok).success).toBe(true)
    expect(msgs(acceptInvitationSchema.safeParse({ ...ok, login: '' }))).toContain('Informe o login.')
    expect(msgs(acceptInvitationSchema.safeParse({ ...ok, login: 'ana leitora' }))).toContain('O login não pode ter espaços.')
    expect(acceptInvitationSchema.safeParse({ ...ok, login: 'x'.repeat(51) }).success).toBe(false)
    expect(msgs(acceptInvitationSchema.safeParse({ ...ok, password: 'fraca' }))).toContain('A senha não atende às regras abaixo.')
    expect(msgs(acceptInvitationSchema.safeParse({ ...ok, confirmPassword: 'Outra123!' }))).toContain('As senhas não são iguais.')
  })

  it('nova senha: política e confirmação', () => {
    expect(newPasswordSchema.safeParse({ password: strong, confirmPassword: strong }).success).toBe(true)
    expect(msgs(newPasswordSchema.safeParse({ password: '', confirmPassword: '' }))).toContain('Informe a senha.')
    expect(msgs(newPasswordSchema.safeParse({ password: strong, confirmPassword: '' }))).toContain('As senhas não são iguais.')
  })

  it('esqueci a senha: e-mail válido', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'ana@exemplo.com' }).success).toBe(true)
    expect(forgotPasswordSchema.safeParse({ email: 'ana@' }).success).toBe(false)
    expect(msgs(forgotPasswordSchema.safeParse({ email: '' }))[0]).toBeTruthy()
  })
})

describe('cadastro do próprio leitor', () => {
  const base = { email: 'ana@exemplo.com', phone: '', guardianName: '', guardianEmail: '', guardianPhone: '', emailPassword: '' }

  it('não pede a senha enquanto o e-mail não muda', () => {
    expect(ownContactSchemaFor(false, 'ana@exemplo.com').safeParse(base).success).toBe(true)
  })

  it('pede a senha atual para trocar o e-mail', () => {
    const schema = ownContactSchemaFor(false, 'ana@exemplo.com')
    expect(msgs(schema.safeParse({ ...base, email: 'nova@exemplo.com' }))).toContain('Informe a senha atual para trocar o e-mail.')
    expect(schema.safeParse({ ...base, email: 'nova@exemplo.com', emailPassword: 'x' }).success).toBe(true)
  })

  it('valida o formato do e-mail e do telefone', () => {
    const schema = ownContactSchemaFor(false, 'ana@exemplo.com')
    expect(schema.safeParse({ ...base, email: 'ana@', emailPassword: 'x' }).success).toBe(false)
    expect(schema.safeParse({ ...base, phone: 'abc' }).success).toBe(false)
  })

  it('exige nome e e-mail do responsável só do menor', () => {
    expect(msgs(ownContactSchemaFor(true, 'ana@exemplo.com').safeParse(base))).toEqual(['Informe o nome do responsável.', 'Informe o e-mail do responsável.'])
    expect(ownContactSchemaFor(true, 'ana@exemplo.com').safeParse({ ...base, guardianName: 'Carla', guardianEmail: 'carla' }).success).toBe(false)
    expect(ownContactSchemaFor(true, 'ana@exemplo.com').safeParse({ ...base, guardianName: 'Carla', guardianEmail: 'carla@exemplo.com' }).success).toBe(true)
    expect(ownContactSchemaFor(false, 'ana@exemplo.com').safeParse(base).success).toBe(true)
  })

  it('troca de senha: pede a atual, aplica as regras e confere a confirmação', () => {
    const ok = { currentPassword: 'Antiga#123', password: 'Nova#Senha1', confirmPassword: 'Nova#Senha1' }
    expect(changePasswordSchema.safeParse(ok).success).toBe(true)
    expect(msgs(changePasswordSchema.safeParse({ ...ok, currentPassword: '' }))).toContain('Informe a senha atual.')
    expect(changePasswordSchema.safeParse({ ...ok, password: 'fraca', confirmPassword: 'fraca' }).success).toBe(false)
    expect(msgs(changePasswordSchema.safeParse({ ...ok, confirmPassword: 'Outra#Senha1' }))).toContain('As senhas não são iguais.')
  })
})
