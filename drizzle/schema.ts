import {
  boolean,
  decimal,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  foreignKey,
  index,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("role", ["user", "admin"]);

export const propertyTypeEnum = pgEnum("tipo", [
  "Apartamento",
  "Casa",
  "Sobrado",
  "Terreno",
  "Cobertura",
]);

export const propertyStatusEnum = pgEnum("status", [
  "Disponivel",
  "Vendido",
  "Alugado",
]);

export const aiMessageRoleEnum = pgEnum("role_mensagem_ia", [
  "user",
  "assistant",
]);

export const users = pgTable(
  "users",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }).unique(),
    passwordHash: varchar("password_hash", { length: 255 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: userRoleEnum("role").default("user").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
  }),
);

export const localSessions = pgTable(
  "local_sessions",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    userId: integer("user_id").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("local_sessions_user_idx").on(table.userId),
    expiryIdx: index("local_sessions_expiry_idx").on(table.expiresAt),
    userFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "local_sessions_user_fk",
    }).onDelete("cascade"),
  }),
);

export const imoveis = pgTable(
  "imoveis",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    ownerId: integer("owner_id"),
    codigo: varchar("codigo", { length: 20 }).notNull().unique(),
    tipo: propertyTypeEnum("tipo").notNull(),
    bairro: varchar("bairro", { length: 100 }).notNull(),
    cidade: varchar("cidade", { length: 100 }).default("São Paulo").notNull(),
    quartos: integer("quartos").default(0).notNull(),
    banheiros: integer("banheiros").default(0).notNull(),
    vagas: integer("vagas").default(0).notNull(),
    areaM2: decimal("area_m2", { precision: 10, scale: 2 }).notNull(),
    aceitaPets: boolean("aceita_pets").default(false).notNull(),
    varanda: boolean("varanda").default(false).notNull(),
    ensolarado: boolean("ensolarado").default(false).notNull(),
    valorVenda: decimal("valor_venda", { precision: 12, scale: 2 }),
    valorAluguel: decimal("valor_aluguel", { precision: 10, scale: 2 }),
    descricaoTecnica: text("descricao_tecnica"),
    descricaoIa: text("descricao_ia"),
    tituloAnuncio: varchar("titulo_anuncio", { length: 200 }),
    status: propertyStatusEnum("status").default("Disponivel").notNull(),
    imagemUrl: varchar("imagem_url", { length: 500 }),
    dataCadastro: timestamp("data_cadastro").defaultNow().notNull(),
  },
  (table) => ({
    catalogIdx: index("imoveis_catalogo_idx").on(
      table.status,
      table.cidade,
      table.bairro,
      table.tipo,
      table.quartos,
      table.vagas,
    ),
    salePriceIdx: index("imoveis_venda_idx").on(
      table.status,
      table.valorVenda,
    ),
    rentPriceIdx: index("imoveis_aluguel_idx").on(
      table.status,
      table.valorAluguel,
    ),
    ownerIdx: index("imoveis_owner_idx").on(table.ownerId),
    ownerFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: "imoveis_owner_fk",
    }).onDelete("set null"),
  }),
);

export const imovelFotos = pgTable(
  "imovel_fotos",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    imovelId: integer("imovel_id").notNull(),
    ownerId: integer("owner_id").notNull(),
    fileKey: varchar("file_key", { length: 500 }).notNull(),
    url: varchar("url", { length: 500 }).notNull(),
    ordem: integer("ordem").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    propertyOrderIdx: index("imovel_fotos_imovel_ordem_idx").on(
      table.imovelId,
      table.ordem,
    ),
    ownerIdx: index("imovel_fotos_owner_idx").on(table.ownerId),
    propertyFk: foreignKey({
      columns: [table.imovelId],
      foreignColumns: [imoveis.id],
      name: "imovel_fotos_imovel_fk",
    }).onDelete("cascade"),
    ownerFk: foreignKey({
      columns: [table.ownerId],
      foreignColumns: [users.id],
      name: "imovel_fotos_owner_fk",
    }).onDelete("cascade"),
  }),
);

export const historicoBuscas = pgTable(
  "historico_buscas",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    textoBusca: text("texto_busca").notNull(),
    jsonInterpretado: text("json_interpretado").notNull(),
    dataBusca: timestamp("data_busca").defaultNow().notNull(),
  },
  (table) => ({
    dateIdx: index("historico_buscas_data_idx").on(table.dataBusca),
  }),
);

export const conversas = pgTable(
  "conversas",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    imovelId: integer("imovel_id"),
    compradorId: integer("comprador_id").notNull(),
    proprietarioId: integer("proprietario_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    participantsIdx: index("conversas_participantes_idx").on(
      table.compradorId,
      table.proprietarioId,
      table.imovelId,
    ),
    participantsUniqueIdx: uniqueIndex("conversas_participantes_unique").on(
      table.imovelId,
      table.compradorId,
      table.proprietarioId,
    ),
    buyerIdx: index("conversas_comprador_idx").on(
      table.compradorId,
      table.updatedAt,
    ),
    ownerIdx: index("conversas_proprietario_idx").on(
      table.proprietarioId,
      table.updatedAt,
    ),
    propertyFk: foreignKey({
      columns: [table.imovelId],
      foreignColumns: [imoveis.id],
      name: "conversas_imovel_fk",
    }).onDelete("set null"),
    buyerFk: foreignKey({
      columns: [table.compradorId],
      foreignColumns: [users.id],
      name: "conversas_comprador_fk",
    }).onDelete("cascade"),
    ownerFk: foreignKey({
      columns: [table.proprietarioId],
      foreignColumns: [users.id],
      name: "conversas_proprietario_fk",
    }).onDelete("cascade"),
  }),
);

export const mensagens = pgTable(
  "mensagens",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    conversaId: integer("conversa_id").notNull(),
    remetenteId: integer("remetente_id").notNull(),
    conteudo: text("conteudo").notNull(),
    lidaEm: timestamp("lida_em"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationDateIdx: index("mensagens_conversa_data_idx").on(
      table.conversaId,
      table.createdAt,
      table.id,
    ),
    conversationFk: foreignKey({
      columns: [table.conversaId],
      foreignColumns: [conversas.id],
      name: "mensagens_conversa_fk",
    }).onDelete("cascade"),
    senderFk: foreignKey({
      columns: [table.remetenteId],
      foreignColumns: [users.id],
      name: "mensagens_remetente_fk",
    }).onDelete("cascade"),
  }),
);

export const chatsIa = pgTable(
  "chats_ia",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    userId: integer("user_id").notNull(),
    titulo: varchar("titulo", { length: 160 })
      .default("Consultoria imobiliária")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userUniqueIdx: uniqueIndex("chats_ia_user_unique").on(table.userId),
    userFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "chats_ia_user_fk",
    }).onDelete("cascade"),
  }),
);

export const mensagensIa = pgTable(
  "mensagens_ia",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    chatId: integer("chat_id").notNull(),
    userId: integer("user_id").notNull(),
    role: aiMessageRoleEnum("role").notNull(),
    conteudo: text("conteudo").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    chatDateIdx: index("mensagens_ia_chat_data_idx").on(
      table.chatId,
      table.createdAt,
      table.id,
    ),
    chatFk: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chatsIa.id],
      name: "mensagens_ia_chat_fk",
    }).onDelete("cascade"),
    userFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "mensagens_ia_user_fk",
    }).onDelete("cascade"),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Property = typeof imoveis.$inferSelect;
export type PropertyPhoto = typeof imovelFotos.$inferSelect;
export type SearchHistory = typeof historicoBuscas.$inferSelect;
export type Conversation = typeof conversas.$inferSelect;
export type Message = typeof mensagens.$inferSelect;
export type AiChat = typeof chatsIa.$inferSelect;
export type AiMessage = typeof mensagensIa.$inferSelect;

export type InsertProperty = typeof imoveis.$inferInsert;
export type InsertSearchHistory = typeof historicoBuscas.$inferInsert;