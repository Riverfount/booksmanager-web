/**
 * The value of an `aria-describedby`: the ids that describe a field, joined in the order given, without repeats. Empty,
 * false or missing entries are ignored, and an entry may hold several ids ("a b"). It returns `undefined` when there is
 * nothing to describe, so the attribute is left out.
 *
 * A field component builds its own ids (the hint and the error) and a caller may add more (the list of password rules).
 * Both must count: spreading the caller's props after the generated attribute would replace it, and the error would stop
 * being read with the field.
 */
export function describedBy(...ids: (string | false | null | undefined)[]): string | undefined {
  const all = ids.flatMap((id) => (id ? id.split(/\s+/) : [])).filter(Boolean)
  const unique = [...new Set(all)]
  return unique.length > 0 ? unique.join(' ') : undefined
}
