import type { FieldErrors, FieldValues } from 'react-hook-form'

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
