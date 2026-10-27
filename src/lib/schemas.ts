import { z } from 'zod'
import { isMinor, todayIso } from './dates'
import { normalizeDocument } from './masks'

// As regras repetem as do backend só para dar resposta imediata. Quem decide é a API (RN/RF no domínio).

export const EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/

export function isbnValid(text: string): boolean {
  const t = text.replace(/[\s-]/g, '')
  if (/^[0-9]{13}$/.test(t)) {
    let sum = 0
    for (let i = 0; i < 13; i++) sum += Number(t[i]) * (i % 2 ? 3 : 1)
    return sum % 10 === 0
  }
  if (/^[0-9]{9}[0-9Xx]$/.test(t)) {
    let sum = 0
    for (let i = 0; i < 10; i++) {
      const c = t[i].toUpperCase()
      sum += (c === 'X' ? 10 : Number(c)) * (10 - i)
    }
    return sum % 11 === 0
  }
  return false
}

export function isbnMessage(text: string): string {
  const t = text.replace(/[\s-]/g, '')
  if (!t) return 'Informe o ISBN.'
  if (!/^[0-9Xx]+$/.test(t)) return 'Use apenas números, hífens e X.'
  if (t.length !== 10 && t.length !== 13) return 'O ISBN deve ter 10 ou 13 dígitos.'
  return isbnValid(t) ? '' : 'Dígito verificador inválido, confira o número.'
}

export function phoneMessage(text: string): string {
  if (!text.trim()) return ''
  const digits = text.replace(/\D/g, '').length
  const ok = text.length <= 30 && /^\+?[0-9 ()-]+$/.test(text) && digits >= 8 && digits <= 15
  return ok ? '' : 'Telefone inválido. Use DDD e número, ex.: (11) 98765-4321.'
}

export const passwordChecks = (pw: string) => [
  { text: 'De 8 a 25 caracteres', met: Array.from(pw).length >= 8 && Array.from(pw).length <= 25 },
  { text: 'Uma letra maiúscula', met: /\p{Lu}/u.test(pw) },
  { text: 'Uma letra minúscula', met: /\p{Ll}/u.test(pw) },
  { text: 'Um número', met: /\p{Nd}/u.test(pw) },
  { text: 'Um caractere especial', met: /[^\p{L}\p{N}\s]/u.test(pw) },
]

const name = (max: number, what: string) =>
  z.string().trim().min(1, `Informe ${what}.`).max(max, `Use até ${max} caracteres.`)

export const authorSchema = z.object({ name: name(150, 'o nome do autor') })
export const categorySchema = z.object({ name: name(100, 'o nome da categoria') })

/** Publisher and year are required (RF01); a book registered before that rule may still lack them, so edits can leave them empty. */
export const bookSchemaFor = (optional: { publisher?: boolean; year?: boolean } = {}) =>
  z.object({
    isbn: z.string().superRefine((v, ctx) => {
      const m = isbnMessage(v)
      if (m) ctx.addIssue({ code: 'custom', message: m })
    }),
    title: name(255, 'o título do livro'),
    publisher: z
      .string()
      .trim()
      .max(255, 'Use até 255 caracteres.')
      .refine((v) => optional.publisher || v, 'Informe a editora.'),
    year: z
      .string()
      .trim()
      .superRefine((v, ctx) => {
        if (!v) {
          if (!optional.year) ctx.addIssue({ code: 'custom', message: 'Informe o ano de publicação.' })
        } else if (Number(v) < 1450) ctx.addIssue({ code: 'custom', message: 'O ano de publicação deve ser 1450 ou posterior.' })
        else if (Number(v) > new Date().getFullYear()) ctx.addIssue({ code: 'custom', message: 'O ano de publicação não pode ser futuro.' })
      }),
    categoryId: z.string().min(1, 'Selecione a categoria do livro.'),
    authorIds: z.array(z.number()).min(1, 'Selecione ao menos um autor.'),
  })

export const bookSchema = bookSchemaFor()

export const copySchema = z.object({ assetCode: name(50, 'o código de patrimônio') })

const emailField = z
  .string()
  .trim()
  .min(1, 'Informe o e-mail.')
  .refine((v) => v.length <= 254 && EMAIL.test(v), 'E-mail inválido. Use o formato nome@dominio.com.')
const phoneField = z.string().superRefine((v, ctx) => {
  const m = phoneMessage(v)
  if (m) ctx.addIssue({ code: 'custom', message: m })
})

export const readerSchema = z
  .object({
    name: name(150, 'o nome do leitor'),
    document: z.string().superRefine((v, ctx) => {
      const n = normalizeDocument(v)
      if (!n) ctx.addIssue({ code: 'custom', message: 'Informe o documento.' })
      else if (n.length > 30) ctx.addIssue({ code: 'custom', message: 'Use até 30 caracteres.' })
    }),
    email: emailField,
    phone: phoneField,
    birthDate: z.string().min(1, 'Informe a data de nascimento.').refine((v) => v <= todayIso(), 'A data não pode ser futura.'),
    guardianName: z.string().trim().max(150, 'Use até 150 caracteres.'),
    guardianEmail: z.string().trim(),
    guardianPhone: phoneField,
  })
  .superRefine((v, ctx) => {
    const any = Boolean(v.guardianName || v.guardianEmail || v.guardianPhone.trim())
    if (!(isMinor(v.birthDate) || any)) return
    if (!v.guardianName) ctx.addIssue({ code: 'custom', path: ['guardianName'], message: 'Informe o nome do responsável.' })
    if (!v.guardianEmail) ctx.addIssue({ code: 'custom', path: ['guardianEmail'], message: 'Informe o e-mail do responsável.' })
    else if (v.guardianEmail.length > 254 || !EMAIL.test(v.guardianEmail))
      ctx.addIssue({ code: 'custom', path: ['guardianEmail'], message: 'E-mail inválido. Use o formato nome@dominio.com.' })
  })

const passwordField = z.string().superRefine((v, ctx) => {
  if (!v) ctx.addIssue({ code: 'custom', message: 'Informe a senha.' })
  else if (!passwordChecks(v).every((c) => c.met)) ctx.addIssue({ code: 'custom', message: 'A senha não atende às regras abaixo.' })
})

const loginField = z
  .string()
  .min(1, 'Informe o login.')
  .max(50, 'Use até 50 caracteres.')
  .refine((v) => !/\s/.test(v), 'O login não pode ter espaços.')

export const userSchema = z.object({
  login: loginField,
  displayName: z.string().trim().max(100, 'Use até 100 caracteres.'),
  role: z.enum(['OPERATOR', 'ADMIN']),
  password: passwordField,
})

export const userEditSchema = z.object({
  login: z.string(),
  displayName: z.string().trim().max(100, 'Use até 100 caracteres.'),
  role: z.enum(['OPERATOR', 'ADMIN']),
  password: z.string(),
})

export const resetPasswordSchema = z.object({ password: passwordField })

type WithConfirmation = { password: string; confirmPassword: string }
const mustMatch = (v: WithConfirmation, ctx: z.RefinementCtx) => {
  if (v.password !== v.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'As senhas não são iguais.' })
}

/** A reader chooses login and password from the invitation link. */
export const acceptInvitationSchema = z.object({ login: loginField, password: passwordField, confirmPassword: z.string() }).superRefine(mustMatch)

/** A reader sets a new password from the reset link. */
export const newPasswordSchema = z.object({ password: passwordField, confirmPassword: z.string() }).superRefine(mustMatch)

export const forgotPasswordSchema = z.object({ email: emailField })

export const reasonSchema = z.object({
  reason: z.string().trim().min(1, 'Informe a justificativa.').max(500, 'Use até 500 caracteres.'),
})

export const loginSchema = z.object({
  login: z.string().trim().min(1, 'Informe o login.'),
  password: z.string().min(1, 'Informe a senha.'),
})

export const configSchema = z
  .object({
    penaltyPolicy: z.enum(['FINE', 'SUSPENSION', 'BOTH', 'NONE']),
    dailyFineAmount: z.string(),
    fineCap: z.string(),
    suspensionDaysPerDay: z.string(),
    suspensionCapDays: z.string(),
    loanPeriodDays: z.string(),
    loanLimit: z.string(),
    renewalLimit: z.string(),
    reservationPickupDays: z.string(),
    dueSoonNoticeDays: z.string(),
  })
  .superRefine((v, ctx) => {
    const num = (k: keyof typeof v) => Number(String(v[k]).replace(',', '.'))
    const whole = (k: keyof typeof v, min: number, label: string) => {
      const n = num(k)
      if (!String(v[k]).trim() || !Number.isInteger(n) || n < min)
        ctx.addIssue({ code: 'custom', path: [k], message: `${label}: informe um número inteiro, no mínimo ${min}.` })
    }
    const fine = num('dailyFineAmount')
    if (!String(v.dailyFineAmount).trim() || Number.isNaN(fine) || fine < 0 || Math.round(fine * 100) !== fine * 100)
      ctx.addIssue({ code: 'custom', path: ['dailyFineAmount'], message: 'Informe um valor de zero ou mais, com até duas casas decimais.' })
    const cap = num('fineCap')
    if (!String(v.fineCap).trim() || Number.isNaN(cap) || cap <= 0 || Math.round(cap * 100) !== cap * 100)
      ctx.addIssue({ code: 'custom', path: ['fineCap'], message: 'Informe um teto maior que zero, com até duas casas decimais.' })
    else if (!Number.isNaN(fine) && cap < fine)
      ctx.addIssue({ code: 'custom', path: ['fineCap'], message: 'O teto não pode ficar abaixo da multa de um dia.' })
    whole('suspensionDaysPerDay', 1, 'Dias de suspensão por dia de atraso')
    whole('suspensionCapDays', 1, 'Teto da suspensão')
    whole('loanPeriodDays', 1, 'Prazo de empréstimo')
    whole('loanLimit', 1, 'Limite de empréstimos')
    whole('renewalLimit', 0, 'Limite de renovações')
    whole('reservationPickupDays', 1, 'Prazo de retirada de reservas')
    whole('dueSoonNoticeDays', 1, 'Aviso de vencimento')
  })
