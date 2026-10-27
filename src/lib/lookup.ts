import type { BookSuggestion } from '../api/types'

export type SuggestedForm = {
  values: { title: string; publisher: string; year: string }
  /** Authors the collection already has: selected right away. */
  known: { id: number; name: string }[]
  /** Authors the collection does not have yet: the operator decides whether to register them. */
  unknown: string[]
}

/** Turns the ISBN lookup suggestion into form values and author chips. */
export function suggestionToForm(s: BookSuggestion): SuggestedForm {
  return {
    values: { title: s.title, publisher: s.publisher ?? '', year: s.publicationYear ? String(s.publicationYear) : '' },
    known: s.authors.flatMap((a) => (a.existingAuthorId ? [{ id: a.existingAuthorId, name: a.name }] : [])),
    unknown: s.authors.filter((a) => !a.existingAuthorId).map((a) => a.name),
  }
}
