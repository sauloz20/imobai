# IMOBai

Portal imobiliário desenvolvido com React e TypeScript. O visitante pode explorar o catálogo, consultar seus favoritos e acessar o concierge. O projeto também reúne mensagens, configurações de conta e uma área para gerenciar imóveis.

## Explore a interface

| Tela | O que observar |
| --- | --- |
| [Catálogo](client/src/pages/Catalog.tsx) | Como a interface apresenta as opções de imóveis. |
| [Favoritos](client/src/pages/Favorites.tsx) | Como os imóveis salvos ganham uma área própria. |
| [Navegação](client/src/App.tsx) | Como as rotas conectam catálogo, favoritos, mensagens e conta. |

## Uma decisão de acessibilidade

O componente raiz usa `MotionConfig reducedMotion="user"` do Framer Motion. Assim, as animações dos componentes seguem a preferência de movimento reduzido configurada no sistema do visitante.

## Executar localmente

Com Node.js 22.12+ e pnpm 10.4.1 instalados, execute na raiz do projeto:

```sh
pnpm install
pnpm dev
```

Abra o endereço exibido no terminal. Consulte [as variáveis de exemplo](.env.example) para configurar os serviços usados por recursos como persistência e integrações externas. Para conferir os tipos, execute `pnpm check`. Para gerar a versão de produção, use `pnpm build`.

## Tecnologias e estrutura

O projeto combina React, TypeScript, Vite, Express, tRPC e Drizzle ORM. O backend usa o driver MySQL; veja [DATABASE_SETUP.md](DATABASE_SETUP.md) para configuração e migrações.

- `client/`: interface e páginas.
- `server/`: API, autenticação, integrações e testes.
- `shared/`: tipos e utilitários compartilhados.
- `drizzle/`: esquema e migrações do banco.
- `.env.example`: nomes das variáveis para configuração local.

Para executar os testes configurados, use `pnpm test`. O repositório também contém `package-lock.json`; os comandos deste README usam o pnpm e seu respectivo lockfile. Mantenha ambos até definir qual gerenciador será adotado.

Antes de aplicar migrações em um banco existente, revise o destino e faça backup. As integrações externas exigem credenciais e podem ter custos ou limites de uso; nunca publique segredos nos arquivos versionados.
