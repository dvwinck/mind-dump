# Como contribuir

Obrigado por querer ajudar com o Mind Dump! Este guia resume o que você precisa para abrir um PR sem retrabalho.

## Pré-requisitos

- Node.js 20 ou superior
- npm (vem com o Node)

## Rodando localmente

```bash
npm ci          # instala as dependências exatamente como no lockfile
npm run dev     # servidor estático em http://localhost:3000
npm test        # testes (Vitest + jsdom)
```

## Fluxo de trabalho

1. Crie um branch a partir da `main`, com nome no formato `tipo/descricao-curta` (ex.: `fix/importacao-json`).
2. Faça commits pequenos seguindo [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`).
3. Adicione ou atualize testes em `tests/` para qualquer mudança de comportamento.
4. Abra o PR e preencha o checklist. O CI (testes em Node 20 e 22, auditoria de dependências e CodeQL) precisa passar.

## Regras específicas do projeto

- **Service worker:** troque `CACHE_NAME` em `service-worker.js` sempre que um arquivo em cache mudar. Arquivo novo entra em `ASSETS_TO_CACHE`.
- **Nova categoria:** siga o passo a passo "Adicionar nova categoria" do README; `npm test` falha se faltar algum ponto.
- **Escape de HTML:** todo texto de nota passa por `src/render.js`. Nunca insira texto de nota com `innerHTML` sem escapar.
- **Persistência:** somente `src/storage.js` acessa o `localStorage`.
- **Idioma:** textos da interface em português do Brasil.
- **Dependências de terceiros:** `vendor/` é uma cópia local do Bootstrap. Não edite à mão; atualize substituindo os arquivos e trocando o `CACHE_NAME`.

## Reportando problemas

- Bugs e ideias: abra uma issue usando um dos templates.
- Vulnerabilidades: **não** abra issue pública. Veja [SECURITY.md](SECURITY.md).

## Licença

Ao contribuir, você concorda que sua contribuição será licenciada sob a [MIT License](LICENSE).
