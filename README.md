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
