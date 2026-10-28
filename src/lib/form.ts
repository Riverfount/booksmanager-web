import type { FieldErrors, FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError, errorMessage } from '../api/client'

/** Id do campo no HTML (usado pelo resumo de erros para ancorar no campo). */
export const fid = (name: string) => `f-${name}`

type Labels = Record<string, string>

/** Lista de erros do formulário (para o resumo no topo), na ordem dos rótulos informados. */
export function errorItems<T extends FieldValues>(errors: FieldErrors<T>, labels: Labels): { id: string; message: string }[] {
  return Object.keys(labels).flatMap((name) => {
    const message = (errors as Record<string, { message?: string } | undefined>)[name]?.message
    return message ? [{ id: fid(name), message: `${labels[name]}: ${message.charAt(0).toLowerCase()}${message.slice(1)}` }] : []
  })
}

export const errorTitle = (n: number, what: string) =>
  n === 1 ? `Corrija 1 campo para ${what}.` : `Corrija ${n} campos para ${what}.`

export type ServerErrors = {
  /** Errors that land on a form field, ready for `setError`. */
  fields: { field: string; message: string }[]
  /** What is left for the banner: undefined when the fields already say everything. */
  banner?: string
}

const capitalize = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`

/**
 * Splits an API error between the form fields and the banner.
 * `map` goes from the field path of the API (`publicationYear`, `guardian.email`; list indexes are ignored) to the form field.
 * `textRules` pins a 422 without field (a business rule) to a field by its message, e.g. the duplicated ISBN.
 */
export function serverErrors(error: unknown, map: Record<string, string>, textRules: [RegExp, string][] = []): ServerErrors {
  if (error === null || error === undefined) return { fields: [] }
  const banner = errorMessage(error)
  if (!(error instanceof ApiError)) return { fields: [], banner }
  const fields: ServerErrors['fields'] = []
  const rest: string[] = []
  for (const e of error.fieldErrors ?? []) {
    const target = e.field ? map[e.field.replace(/\[\d+\]/g, '')] : undefined
    if (target) fields.push({ field: target, message: capitalize(e.message) })
    else rest.push(e.message)
  }
  const rule = error.status === 422 ? textRules.find(([pattern]) => pattern.test(error.message)) : undefined
  if (rule) fields.push({ field: rule[1], message: capitalize(error.message) })
  if (fields.length === 0) return { fields, banner }
  return { fields, banner: rest.length > 0 ? rest.join(' ') : undefined }
}

/** Puts the server errors on the form fields; the first one takes the focus. */
export function applyServerErrors<T extends FieldValues>(errors: ServerErrors, setError: UseFormSetError<T>) {
  errors.fields.forEach(({ field, message }, i) => setError(field as Path<T>, { type: 'server', message }, { shouldFocus: i === 0 }))
}
