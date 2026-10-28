# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Front-end do Books Manager (React 19 + TypeScript + Vite + Tailwind 4), em português do Brasil. O backend (Java/Spring Boot) fica em `../BooksManager`, é outro repositório e tem a especificação completa (`docs/requisitos.md`, IDs RF/RN). Este repositório **não tem regra de negócio**: as validações daqui só dão resposta imediata, e quem decide é a API. Ao mudar uma regra, mude no backend e só espelhe aqui.

## Comandos

- `npm run dev`: servidor em http://localhost:5173. O backend precisa estar no ar; o Vite repassa `/api` para `http://localhost:8080` (mude com `VITE_API_PROXY` em `.env.local`).
- `npm test`: Vitest (uma vez). Um arquivo: `npx vitest run src/lib/schemas.test.ts`. Um teste: `npx vitest run -t "trecho do nome"`. Modo observação: `npm run test:watch`.
- `npm run lint` · `npm run typecheck` · `npm run build` (confere tipos e gera `dist/`).
- `npm run api:types`: regera `src/api/schema.d.ts` a partir de `http://localhost:8080/v3/api-docs` (ou `OPENAPI_URL=...`). Rode sempre que o backend mudar o contrato; o `tsc` aponta o que quebrou.

A CI (`.github/workflows/ci.yml`) roda `lint`, `typecheck`, `test` e `build`, nessa ordem. Rode os quatro antes de considerar uma tarefa concluída.

## Arquitetura

- **Cliente da API** (`src/api/client.ts`): `openapi-fetch` tipado por `schema.d.ts`. Toda chamada passa por `call(api.GET(...))`, que devolve o dado ou lança `ApiError` com a mensagem em português: usa o `detail` do `ProblemDetail` (RFC 9457) da API e, na falta dele, um texto por status. `errorMessage(error)` é o que as telas mostram. `src/api/types.ts` dá apelidos aos tipos do schema (`Book`, `Author`...): prefira-os a redeclarar tipos.
- **Sessão** (`src/auth/`): o access token (JWT de 15 min) vive **só em memória** (`tokenStore.ts`), nunca em `localStorage`. O refresh token é cookie `httpOnly`; por isso front e API precisam estar na mesma origem (proxy do Vite em dev, proxy reverso em produção). As rotas `/auth/*` levam `X-Requested-With: XMLHttpRequest` (CSRF exigido pelo backend). Um 401 faz o middleware do cliente renovar o token (`refreshSession`, que junta chamadas simultâneas) e repetir a requisição uma vez.
- **Rotas** (`src/App.tsx`): páginas carregadas com `lazy`. Telas públicas (`/login`, `/convite`, `/esqueci-senha`, `/redefinir-senha`) ficam fora da sessão. Depois de `RequireAuth`, o perfil separa duas áreas: `RequireStaff` + `Layout` para operador e administrador, e `RequireReader` + `ReaderLayout` para o leitor, em `/meu/*` (telas em `src/pages/reader/`). Um perfil que cai na área do outro é redirecionado. `usuarios`, `auditoria` e `configuracao` ficam atrás de `RequireAdmin` (só esconde a tela; a autorização real é do backend). Uma página por rota em `src/pages/`.
- **Dados do servidor**: TanStack Query. Convenção de `queryKey`: `[recurso, ...filtros]` (ex.: `['books', title, active, page]`); invalidar pelo prefixo (`['books']`) cobre todas as variações. Estado global só para o usuário logado (Context); sem Redux/Zustand.
- **Formulários**: React Hook Form + Zod, com schemas centralizados em `src/lib/schemas.ts`. O padrão se repete nas telas: `errorItems`/`errorTitle` (`src/lib/form.ts`) montam o resumo de erros no topo, e `fid(nome)` gera o id do campo para o resumo ancorar nele. Máscaras (CPF, telefone, ISBN, ano) ficam em `src/lib/masks.ts`.
- **CRUD de nome simples**: `components/NamedCrud.tsx` serve autores e categorias (lista, busca, ativos/inativos, formulário, inativação). `BooksPage` e as demais telas são escritas à mão.
- **Inativação**: o backend nunca exclui (RN14); `DELETE` significa inativar. A reativação é `POST /{id}/reactivate` e só o administrador pode (livros, autores, categorias e exemplares).
- **PATCH parcial**: o backend lê campo ausente/nulo como "manter o valor atual", então o front não consegue limpar um campo opcional (ex.: editora, ano do livro).

## Convenções

- Texto da interface e mensagens ao usuário em português; identificadores e comentários de código em inglês, conforme a preferência do usuário (hoje parte dos comentários e dos nomes de teste está em português: siga o arquivo que estiver editando).
- Estilo com Tailwind e tokens do tema Gruvbox (`bg-bg0`, `text-fg2`, `border-line`...), definidos em `src/index.css`; evite cores em hex soltas.
- Componentes de interface compartilhados estão em `src/components/ui.tsx`; reutilize-os antes de criar outro.

## Pontos de atenção

- Rode `npm run api:types` antes de usar endpoints novos do backend: o `schema.d.ts` só acompanha o contrato até a última vez que foi regerado.
- Em livros (formulário e filtro), a categoria é escolhida por busca (`components/CategoryPicker.tsx`, até 5 resultados por consulta). Só o filtro do catálogo do leitor (`/meu`) ainda usa um select, que carrega no máximo 100 categorias (limite de página da API).
- A revisão de livros e autores contra a API está em `.claude/revisao.md`, com os problemas conhecidos e a ordem sugerida.
