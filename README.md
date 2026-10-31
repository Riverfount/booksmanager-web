# Books Manager — front-end

Interface web do [Books Manager](https://github.com/Riverfount/BooksManager), o sistema de acervo e empréstimos de uma biblioteca escolar ou comunitária. Este repositório só tem o front-end: ele conversa com a API por HTTP/JSON e **não tem regra de negócio** (as regras ficam no domínio do backend; as validações daqui só dão resposta imediata, e quem decide é a API).

Em português do Brasil, responsivo (menu hambúrguer no celular) e no tema de cores Gruvbox.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS 4 · React Router (modo declarativo) · TanStack Query · openapi-typescript + openapi-fetch · React Hook Form + Zod · Vitest + React Testing Library.

Estado global só para o usuário logado (Context). Sem Redux/Zustand.

## Como rodar

```bash
npm install
npm run dev          # http://localhost:5173
```

O backend precisa estar no ar (`./mvnw spring-boot:run` com o Docker Compose do banco). Em desenvolvimento o Vite repassa `/api` para `http://localhost:8080` (mude com `VITE_API_PROXY` em `.env.local`). Assim o front e a API ficam na mesma origem, o que o cookie do refresh token (`SameSite=Strict`) exige.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | confere os tipos e gera `dist/` |
| `npm test` | testes (máscaras, regras de validação, tela de login) |
| `npm run lint` · `npm run typecheck` | ESLint e TypeScript |
| `npm run api:types` | regera `src/api/schema.d.ts` a partir do OpenAPI do backend em `http://localhost:8080/v3/api-docs` (ou `OPENAPI_URL=...`) |

### Tipos da API

`src/api/schema.d.ts` foi **escrito à mão** a partir dos DTOs do backend, porque o contrato real do SpringDoc não estava disponível quando o projeto foi montado. Com o backend no ar, rode `npm run api:types`: o arquivo é substituído pelo contrato oficial, no mesmo formato, e o `tsc` aponta qualquer divergência.

## Autenticação

- `POST /api/v1/auth/login` devolve o access token (JWT de 15 min). Ele fica **só em memória**, nunca em `localStorage`.
- O refresh token vem em cookie `httpOnly`. Ao recarregar a página, o front chama `/auth/refresh` para recuperar a sessão.
- Uma resposta 401 dispara uma renovação automática e repete a chamada uma vez.
- As rotas `/auth/*` levam o cabeçalho `X-Requested-With: XMLHttpRequest` (proteção CSRF exigida pelo backend).
- O nome e o perfil do usuário logado vêm de `GET /api/v1/users/me`. As telas de **Usuários**, **Auditoria** e **Configuração** só aparecem para `ADMIN`; o backend continua sendo quem autoriza.
- O perfil `READER` não entra nas telas de operador: é levado para a área do leitor (`/meu`), e operador e administrador, na área do leitor, voltam ao painel.

## Telas

| Rota | Tela | Perfil |
| --- | --- | --- |
| `/login` | Entrar | público |
| `/convite` · `/esqueci-senha` · `/redefinir-senha` | Leitor cria o acesso com o link do convite, pede e usa o link de redefinição de senha | público |
| `/` | Painel (números e acervo por categoria, de `reports/dashboard`) | todos |
| `/livros` | Livros e exemplares (busca de autores por texto, status dos exemplares) | todos |
| `/autores` · `/categorias` | Cadastro, edição e inativação | todos |
| `/leitores` · `/leitores/:id` | Leitores (responsável obrigatório para menores de 18) e detalhe com empréstimos, multas, suspensões e o acesso ao sistema (convidar e revogar) | todos |
| `/emprestimos` | Em aberto, atrasados e devolvidos; registrar, renovar e devolver (com a condição do exemplar) | todos |
| `/reservas` | Reservas por situação, leitor e livro (fila em ordem de chegada); reservar livro sem exemplar disponível e cancelar | todos |
| `/relatorios` | Empréstimos em atraso, livros mais emprestados (por período, até 366 dias) e situação do acervo; exportação em PDF e CSV só para ADMIN | todos |
| `/multas` | Multas (pagar, abonar com justificativa) e suspensões (encerrar antes do prazo) | todos |
| `/auditoria` | Trilha de auditoria (quem fez o quê e quando), com filtros por usuário, ação, alvo e período | ADMIN |
| `/meu` · `/meu/catalogo` · `/meu/emprestimos` · `/meu/reservas` · `/meu/dados` | Área do leitor: situação (pode emprestar? multas, suspensão, limites), catálogo com disponibilidade e reserva, empréstimos com renovação, reservas (listar, reservar e cancelar), meus dados (telefone, e-mail, responsável do menor e troca de senha; nome, documento e nascimento só a biblioteca altera) | READER |
| `/usuarios` | Usuários, perfil, bloqueio, redefinição de senha | ADMIN |
| `/configuracao` | Política de penalidade (multa, suspensão, ambas ou nenhuma), prazos e limites | ADMIN |

Os links dos e-mails de convite e de redefinição abrem `/convite?token=…` e `/redefinir-senha?token=…`. O backend monta esses endereços (`APP_READER_ACCESS_INVITATION_URL` e `APP_READER_ACCESS_PASSWORD_RESET_URL`); em produção, aponte-os para o domínio do front.

## Formulários e validação

Todos usam React Hook Form + Zod (`src/lib/schemas.ts`), com o mesmo padrão: asterisco nos obrigatórios, borda vermelha e mensagem abaixo do campo, resumo de erros no topo e aviso de sucesso. As regras repetem as do backend (tamanhos, e-mail, telefone de 8 a 15 dígitos, ISBN-10/13 com dígito verificador, política de senha, responsável para menores, teto de multa não menor que a multa de um dia). Máscaras: CPF (só quando há 11 dígitos; o campo aceita qualquer documento), telefone, ISBN e ano.

Erros da API chegam como `ProblemDetail` (RFC 9457) e a mensagem `detail` é mostrada ao usuário.

## Estrutura

```
src/
  api/         cliente tipado (openapi-fetch), tipos e tratamento de erro
  auth/        sessão em memória, refresh, contexto do usuário
  components/  layout, guardas de rota, componentes de interface
  lib/         datas, máscaras, schemas Zod
  pages/       uma tela por rota
```

## Produção

`npm run build` gera arquivos estáticos em `dist/`, e o `Dockerfile` os empacota numa imagem que só serve esses arquivos (Nginx sem privilégios, na porta **8080**, usuário `nginx`):

```bash
docker build -t booksmanager-web .
docker run --rm -p 8080:8080 booksmanager-web
scripts/smoke-image.sh booksmanager-web   # confere o que a produção usa (precisa de docker e curl)
```

**A imagem espera um proxy reverso na frente**, que termina o TLS e manda `/api/` para a API **na mesma origem**: o front chama `/api/...` com URL relativa (o build não define `VITE_API_URL`, então nenhum endereço fica embutido), e o cookie do refresh token é `SameSite=Strict`, que só vale entre origens do mesmo site. O proxy de produção é o Nginx do repositório do back ([BooksManager](https://github.com/Riverfount/BooksManager), `docs/implantacao.md`).

O Nginx da imagem faz só o que é dele:

- **fallback de SPA:** recarregar `/livros` ou abrir `/convite?token=…` devolve o app;
- **`/assets/*`** (nomes com hash) com cache de um ano (`immutable`); arquivo que não existe ali é 404 de verdade, e não o `index.html`, para um bundle velho falhar de forma visível;
- **`/index.html`** com `no-cache`, para uma nova versão ser vista na hora;
- **`/api/`** devolve 404 (se uma requisição para lá chegar, é erro de roteamento do proxy, e não deve ser respondida com a página do app);
- **`/healthz`** responde `ok` (usado pelo `HEALTHCHECK` e para orquestração);
- não repete os cabeçalhos de segurança (HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`), que o proxy da frente já define.

**Publicação:** ao enviar uma tag de versão (`v1.0.0`), o workflow `Publish image` roda os mesmos checks do CI, confere que a tag aponta para um commit da `main`, constrói a imagem, roda o teste de fumaça e publica em `ghcr.io/riverfount/booksmanager-web` com **duas tags**: a versão (`1.0.0`) e o hash curto do commit (`sha-1a2b3c4`). Não há `latest`: quem implanta nomeia uma versão, e o que roda é sempre conhecido. O CI constrói e testa a imagem em todo pull request, sem publicar.

**Versões que andam juntas:** front e back são publicados separadamente. A ponte entre eles é o contrato OpenAPI do back; as mudanças de contrato estão na tabela de `docs/projeto.md` do back, e `npm run api:types` mostra no `tsc` o que quebrou.

Sem proxy na frente, se front e API ficarem em origens diferentes, defina `VITE_API_URL` no build e `APP_CORS_ALLOWED_ORIGINS` no back; o cookie `SameSite=Strict` do refresh token só funciona entre origens do mesmo site, então esse caminho não serve para a produção.

### Como fazer o deploy em produção

O front não sobe sozinho: ele é um serviço (`web`) da pilha de produção do back, atrás do Nginx que termina o TLS. O guia completo (servidor, `.env.prod`, certificado, backup, problemas comuns) é o [`docs/implantacao.md` do BooksManager](https://github.com/Riverfount/BooksManager/blob/main/docs/implantacao.md); abaixo está só a parte do front.

**1. Publicar uma versão da imagem** (na sua máquina, com a `main` atualizada e o CI verde):

```bash
git switch main && git pull
git tag v1.0.0            # ou v1.0.0-rc.1 para uma pré-versão
git push origin v1.0.0
```

A tag precisa ter o formato `v1.2.3` ou `v1.2.3-rc.1` e apontar para um commit que está na `main`; qualquer outra coisa faz o workflow `Publish image` falhar logo no início. Acompanhe em *Actions → Publish image*. Ele roda lint, tipos, testes e build, constrói a imagem, roda o teste de fumaça, faz um scan com o Trivy (só avisa, não bloqueia) e publica `ghcr.io/riverfount/booksmanager-web:1.0.0` e `:sha-<7 letras>`. Não reaproveite uma versão já publicada (o workflow não impede, e quem já puxou a antiga ficaria com outra imagem sob o mesmo nome): se saiu errada, publique a seguinte.

> Na **primeira** publicação, o pacote nasce privado. Em *Packages → booksmanager-web → Package settings → Change visibility*, deixe-o **público**; do contrário, o servidor precisa de `docker login ghcr.io` com um token que tenha `read:packages`.

**2. Usar a versão no servidor.** No `.env.prod` (modelo: `.env.prod-sample` do back), `WEB_TAG` é **obrigatório** (a pilha não sobe sem ele) e `WEB_IMAGE` já aponta para o registro:

```bash
WEB_IMAGE=ghcr.io/riverfount/booksmanager-web
WEB_TAG=1.0.0
```

```bash
docker compose --env-file .env.prod -f compose.prod.yaml pull app web
docker compose --env-file .env.prod -f compose.prod.yaml up -d
```

O `pull` vem antes de propósito: se a versão não existe no registro (um erro de digitação, por exemplo), ele falha com uma mensagem clara; sem ele o `up` poderia construir uma imagem local com o mesmo nome. **Voltar atrás** é pôr a versão anterior em `WEB_TAG` e repetir os dois comandos. Durante a troca o front continua respondendo; a API fica fora alguns segundos.

**3. Em que ordem atualizar.** Olhe a tabela de mudanças da API em `docs/projeto.md` do back: se todas são *Compatível*, atualize a API primeiro e o front depois; se alguma *Muda o comportamento* ou *Quebra a entrada*, troque `IMAGE_TAG` e `WEB_TAG` no mesmo `up -d` (e volte as duas juntas).

**4. Conferir.** Abra `https://<domínio>/` em um navegador, entre com um usuário de teste e recarregue uma rota interna (por exemplo `/livros`), que deve abrir o app e não uma página 404. O `curl` não basta: só o navegador manda o cabeçalho `Origin`.

| Sintoma | Causa provável |
| --- | --- |
| A pilha não sobe e reclama de `WEB_TAG` | A variável está vazia ou ausente no `.env.prod`. |
| `pull` falha com "manifest unknown" ou "denied" | Versão que não existe, ou pacote ainda privado (veja o aviso acima). |
| Login do navegador responde **403 "Invalid CORS request"** | `DOMAIN` ou `APP_CORS_ALLOWED_ORIGINS` não é o endereço digitado no navegador (`https://<domínio>`, sem barra no fim). |
| 502 ou 504 nas telas | O contêiner `web` ou `app` não está de pé: `docker compose ... ps` e `logs`. |
| Recarregar uma rota devolve 404 do Nginx de fora | O proxy da frente não está mandando `/` para o `web`; use o `deploy/nginx` do back. |

**Antes da versão final**, vale publicar uma pré-versão (`v1.0.0-rc.1`) para ver os workflows rodarem de verdade e puxar a imagem no servidor uma vez; só então a `v1.0.0`.

## Limitações conhecidas

- Os selects de categoria carregam até 100 itens (limite de página da API).
- O ideal é revisar as telas contra o contrato real depois de rodar `npm run api:types`.

## Licença

Distribuído sob a licença GNU General Public License, versão 3 ou posterior (GPL-3.0-or-later). O texto completo está em [`LICENSE`](LICENSE).
