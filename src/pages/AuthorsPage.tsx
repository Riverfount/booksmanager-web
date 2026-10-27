import { api, call } from '../api/client'
import { NamedCrud } from '../components/NamedCrud'
import { authorSchema } from '../lib/schemas'

export function AuthorsPage() {
  return (
    <NamedCrud
      title="Autores"
      subtitle="Quem escreveu os livros do acervo"
      noun="autor"
      article="o"
      namePlaceholder="Ex.: Machado de Assis"
      queryKey="authors"
      schema={authorSchema}
      list={({ name, active, page }) => call(api.GET('/api/v1/authors', { params: { query: { name, active, page } } }))}
      create={(name, allowDuplicate) => call(api.POST('/api/v1/authors', { body: { name, allowDuplicate } }))}
      update={(id, name, allowDuplicate) => call(api.PATCH('/api/v1/authors/{id}', { params: { path: { id } }, body: { name, allowDuplicate } }))}
      remove={(id) => call(api.DELETE('/api/v1/authors/{id}', { params: { path: { id } } }))}
      reactivate={(id, allowDuplicate) => call(api.POST('/api/v1/authors/{id}/reactivate', { params: { path: { id } }, body: { allowDuplicate } }))}
    />
  )
}
