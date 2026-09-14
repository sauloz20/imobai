# Configuração do banco de dados

O projeto usa **Drizzle ORM com `mysql2`**. O backend é o único componente que acessa o banco; o frontend nunca deve receber `DATABASE_URL`.

## TiDB Cloud Starter

Crie uma instância TiDB Cloud Starter e copie a string MySQL/TLS exibida no painel. Não substitua manualmente os parâmetros de TLS fornecidos pelo provedor.

```bash
cp .env.example .env
```

Preencha pelo menos `DATABASE_URL`, `JWT_SECRET` e as chaves dos serviços usados pela aplicação. Em produção, configure essas variáveis diretamente no gerenciador de secrets do host.

## Migrações

Depois de configurar `DATABASE_URL`, execute:

```bash
npm install
npm run db:push
```

O comando gera e aplica migrações Drizzle. A migração `drizzle/0004_abnormal_wendigo.sql` adiciona índices, chaves estrangeiras, unicidades de negócio e índices de ordenação.

Antes de aplicar em um banco existente, faça backup e verifique se não há registros órfãos ou conversas duplicadas. A migração adiciona uma restrição única para `(imovel_id, comprador_id, proprietario_id)` e para `chats_ia.user_id`.

## Pool de conexões

`server/db.ts` cria um pool por processo Node.js. O padrão é 10 conexões, limitado a 30, e pode ser alterado por `DB_POOL_SIZE`. Ao executar várias réplicas do backend, mantenha a soma dos pools abaixo do limite do provedor.

A meta de 5.000 usuários simultâneos não significa 5.000 conexões no banco. Use cache, paginação, CDN/reverse proxy e rate limiting. Faça teste de carga antes de considerar a meta atendida.

## Verificações locais

```bash
npm run check
npm test -- --run
npm run build
```

O modo demo é permitido durante desenvolvimento e testes. Em `NODE_ENV=production`, uma indisponibilidade do banco não é mascarada por imóveis demonstrativos: a aplicação retorna erro controlado para que o problema seja observável.
