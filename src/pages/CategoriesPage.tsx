import { api, call } from '../api/client'
import { NamedCrud } from '../components/NamedCrud'
import { categorySchema } from '../lib/schemas'

export function CategoriesPage() {
  return (
    <NamedCrud
      title="Categorias"
      subtitle="Como o acervo é organizado"
      noun="categoria"
      article="a"
      namePlaceholder="Ex.: Ficção"
      queryKey="categories"
      schema={categorySchema}
      list={({ name, active, page }) => call(api.GET('/api/v1/categories', { params: { query: { name, active, page } } }))}
      create={(name) => call(api.POST('/api/v1/categories', { body: { name } }))}
      update={(id, name) => call(api.PATCH('/api/v1/categories/{id}', { params: { path: { id } }, body: { name } }))}
      remove={(id) => call(api.DELETE('/api/v1/categories/{id}', { params: { path: { id } } }))}
    />
  )
}
