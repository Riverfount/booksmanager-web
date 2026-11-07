# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Front-end do Books Manager (React 19 + TypeScript + Vite + Tailwind 4), em português do Brasil. Backend (Java/Spring Boot) fica em `../BooksManager`, outro repositório, tem especificação completa (`docs/requisitos.md`, IDs RF/RN). Este repositório **não tem regra de negócio**: validações aqui só dão resposta imediata, API decide. Ao mudar regra, mude no backend e só espelhe aqui.

## Comandos

- `npm run dev`: servidor em http://localhost:5173. Backend precisa estar no ar; Vite repassa `/api` para `http://localhost:8080` (mude com `VITE_API_PROXY` em `.env.local`).
- `npm test`: Vitest (uma vez). Um arquivo: `npx vitest run src/lib/schemas.test.ts`. Um teste: `npx vitest run -t "trecho do nome"`. Modo observação: `npm run test:watch`.
- `npm run lint` · `npm run typecheck` · `npm run build` (confere tipos e gera `dist/`).
- `npm run api:types`: regera `src/api/schema.d.ts` a partir de `http://localhost:8080/v3/api-docs` (ou `OPENAPI_URL=...`). Rode sempre que backend mudar contrato; `tsc` aponta o que quebrou.

CI (`.github/workflows/ci.yml`) roda `lint`, `typecheck`, `test` e `build`, nessa ordem. Rode os quatro antes de considerar tarefa concluída.

## Arquitetura

- **Cliente da API** (`src/api/client.ts`): `openapi-fetch` tipado por `schema.d.ts`. Toda chamada passa por `call(api.GET(...))`, que devolve dado ou lança `ApiError` com mensagem em português: usa `detail` do `ProblemDetail` (RFC 9457) da API, na falta dele, texto por status. `errorMessage(error)` é o que telas mostram. `src/api/types.ts` dá apelidos aos tipos do schema (`Book`, `Author`...): prefira-os a redeclarar tipos.
- **Sessão** (`src/auth/`): access token (JWT de 15 min) vive **só em memória** (`tokenStore.ts`), nunca em `localStorage`. Refresh token é cookie `httpOnly`; por isso front e API precisam estar na mesma origem (proxy do Vite em dev, proxy reverso em produção). Rotas `/auth/*` levam `X-Requested-With: XMLHttpRequest` (CSRF exigido pelo backend). 401 faz middleware do cliente renovar token (`refreshSession`, que junta chamadas simultâneas) e repetir requisição uma vez.
- **Rotas** (`src/App.tsx`): páginas carregadas com `lazy`. Telas públicas (`/login`, `/convite`, `/esqueci-senha`, `/redefinir-senha`) ficam fora da sessão. Depois de `RequireAuth`, perfil separa duas áreas: `RequireStaff` + `Layout` para operador e administrador, `RequireReader` + `ReaderLayout` para leitor, em `/meu/*` (telas em `src/pages/reader/`). Perfil que cai na área do outro é redirecionado. `usuarios`, `auditoria` e `configuracao` ficam atrás de `RequireAdmin` (só esconde tela; autorização real é do backend). Uma página por rota em `src/pages/`.
- **Dados do servidor**: TanStack Query. Convenção de `queryKey`: `[recurso, ...filtros]` (ex.: `['books', title, active, page]`); invalidar pelo prefixo (`['books']`) cobre todas variações. Estado global só para usuário logado (Context); sem Redux/Zustand.
- **Formulários**: React Hook Form + Zod, schemas centralizados em `src/lib/schemas.ts`. Padrão se repete nas telas: `errorItems`/`errorTitle` (`src/lib/form.ts`) montam resumo de erros no topo, `fid(nome)` gera id do campo para resumo ancorar nele. Erros do servidor por campo: 400 traz `errors: [{field, message}]`, que `ApiError` guarda em `fieldErrors`; `serverErrors`/`applyServerErrors` (`src/lib/form.ts`) levam cada campo da API para campo do formulário (mapa por tela) e deixam no banner só o que não tem campo. Máscaras (CPF, telefone, ISBN, ano) ficam em `src/lib/masks.ts`.
- **CRUD de nome simples**: `components/NamedCrud.tsx` serve autores e categorias (lista, busca, ativos/inativos, formulário, inativação). `BooksPage` e demais telas são escritas à mão.
- **Inativação**: backend nunca exclui (RN14); `DELETE` significa inativar. Reativação é `POST /{id}/reactivate`, só administrador pode (livros, autores, categorias e exemplares).
- **PATCH parcial**: backend lê campo ausente/nulo como "manter valor atual", então front não consegue limpar campo opcional (ex.: editora, ano do livro).

## Convenções

- Texto da interface e mensagens ao usuário em português; identificadores e comentários de código em inglês, conforme preferência do usuário (hoje parte dos comentários e nomes de teste está em português: siga o arquivo que estiver editando).
- Estilo com Tailwind e tokens do tema Gruvbox (`bg-bg0`, `text-fg2`, `border-line`...), definidos em `src/index.css`; não use cores em hex soltas (em `style` ou atributos SVG, use `var(--color-green)` etc.). `src/lib/theme.test.ts` falha se algum arquivo de código tiver hex.
- Componentes de interface compartilhados estão em `src/components/ui.tsx`; reutilize-os antes de criar outro.

## Pontos de atenção

- Rode `npm run api:types` antes de usar endpoints novos do backend: `schema.d.ts` só acompanha contrato até última regeração.
- Em livros (formulário e filtro), categoria é escolhida por busca (`components/CategoryPicker.tsx`, até 5 resultados por consulta). Só filtro do catálogo do leitor (`/meu`) ainda usa select, que carrega no máximo 100 categorias (limite de página da API).