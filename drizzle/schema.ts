import { pgTable, index, uniqueIndex, foreignKey, integer, timestamp, text, varchar, unique, numeric, boolean, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const role = pgEnum("role", ['user', 'admin'])
export const roleMensagemIa = pgEnum("role_mensagem_ia", ['user', 'assistant'])
export const status = pgEnum("status", ['Disponivel', 'Vendido', 'Alugado'])
export const tipo = pgEnum("tipo", ['Apartamento', 'Casa', 'Sobrado', 'Terreno', 'Cobertura'])


export const conversas = pgTable("conversas", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "conversas_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	imovelId: integer("imovel_id"),
	compradorId: integer("comprador_id").notNull(),
	proprietarioId: integer("proprietario_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("conversas_comprador_idx").using("btree", table.compradorId.asc().nullsLast().op("int4_ops"), table.updatedAt.asc().nullsLast().op("timestamp_ops")),
	index("conversas_participantes_idx").using("btree", table.compradorId.asc().nullsLast().op("int4_ops"), table.proprietarioId.asc().nullsLast().op("int4_ops"), table.imovelId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("conversas_participantes_unique").using("btree", table.imovelId.asc().nullsLast().op("int4_ops"), table.compradorId.asc().nullsLast().op("int4_ops"), table.proprietarioId.asc().nullsLast().op("int4_ops")),
	index("conversas_proprietario_idx").using("btree", table.proprietarioId.asc().nullsLast().op("int4_ops"), table.updatedAt.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.compradorId],
			foreignColumns: [users.id],
			name: "conversas_comprador_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.imovelId],
			foreignColumns: [imoveis.id],
			name: "conversas_imovel_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.proprietarioId],
			foreignColumns: [users.id],
			name: "conversas_proprietario_fk"
		}).onDelete("cascade"),
]);

export const historicoBuscas = pgTable("historico_buscas", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "historico_buscas_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	textoBusca: text("texto_busca").notNull(),
	jsonInterpretado: text("json_interpretado").notNull(),
	dataBusca: timestamp("data_busca", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("historico_buscas_data_idx").using("btree", table.dataBusca.asc().nullsLast().op("timestamp_ops")),
]);

export const chatsIa = pgTable("chats_ia", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "chats_ia_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	userId: integer("user_id").notNull(),
	titulo: varchar({ length: 160 }).default('Consultoria imobiliária').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("chats_ia_user_unique").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "chats_ia_user_fk"
		}).onDelete("cascade"),
]);

export const imoveis = pgTable("imoveis", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "imoveis_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	ownerId: integer("owner_id"),
	codigo: varchar({ length: 20 }).notNull(),
	tipo: tipo().notNull(),
	bairro: varchar({ length: 100 }).notNull(),
	cidade: varchar({ length: 100 }).default('São Paulo').notNull(),
	quartos: integer().default(0).notNull(),
	banheiros: integer().default(0).notNull(),
	vagas: integer().default(0).notNull(),
	areaM2: numeric("area_m2", { precision: 10, scale:  2 }).notNull(),
	aceitaPets: boolean("aceita_pets").default(false).notNull(),
	varanda: boolean().default(false).notNull(),
	ensolarado: boolean().default(false).notNull(),
	valorVenda: numeric("valor_venda", { precision: 12, scale:  2 }),
	valorAluguel: numeric("valor_aluguel", { precision: 10, scale:  2 }),
	descricaoTecnica: text("descricao_tecnica"),
	descricaoIa: text("descricao_ia"),
	tituloAnuncio: varchar("titulo_anuncio", { length: 200 }),
	status: status().default('Disponivel').notNull(),
	imagemUrl: varchar("imagem_url", { length: 500 }),
	dataCadastro: timestamp("data_cadastro", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("imoveis_aluguel_idx").using("btree", table.status.asc().nullsLast().op("numeric_ops"), table.valorAluguel.asc().nullsLast().op("enum_ops")),
	index("imoveis_catalogo_idx").using("btree", table.status.asc().nullsLast().op("enum_ops"), table.cidade.asc().nullsLast().op("enum_ops"), table.bairro.asc().nullsLast().op("int4_ops"), table.tipo.asc().nullsLast().op("text_ops"), table.quartos.asc().nullsLast().op("enum_ops"), table.vagas.asc().nullsLast().op("enum_ops")),
	index("imoveis_owner_idx").using("btree", table.ownerId.asc().nullsLast().op("int4_ops")),
	index("imoveis_venda_idx").using("btree", table.status.asc().nullsLast().op("enum_ops"), table.valorVenda.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "imoveis_owner_fk"
		}).onDelete("set null"),
	unique("imoveis_codigo_unique").on(table.codigo),
]);

export const imovelFotos = pgTable("imovel_fotos", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "imovel_fotos_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	imovelId: integer("imovel_id").notNull(),
	ownerId: integer("owner_id").notNull(),
	fileKey: varchar("file_key", { length: 500 }).notNull(),
	url: varchar({ length: 500 }).notNull(),
	ordem: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("imovel_fotos_imovel_ordem_idx").using("btree", table.imovelId.asc().nullsLast().op("int4_ops"), table.ordem.asc().nullsLast().op("int4_ops")),
	index("imovel_fotos_owner_idx").using("btree", table.ownerId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.imovelId],
			foreignColumns: [imoveis.id],
			name: "imovel_fotos_imovel_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "imovel_fotos_owner_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "users_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	openId: varchar({ length: 64 }).notNull(),
	name: text(),
	email: varchar({ length: 320 }),
	passwordHash: varchar("password_hash", { length: 255 }),
	loginMethod: varchar({ length: 64 }),
	role: role().default('user').notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("users_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	unique("users_openId_unique").on(table.openId),
	unique("users_email_unique").on(table.email),
]);

export const localSessions = pgTable("local_sessions", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "local_sessions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	tokenHash: varchar("token_hash", { length: 128 }).notNull(),
	userId: integer("user_id").notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("local_sessions_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index("local_sessions_user_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "local_sessions_user_fk"
		}).onDelete("cascade"),
	unique("local_sessions_token_hash_unique").on(table.tokenHash),
]);

export const mensagensIa = pgTable("mensagens_ia", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "mensagens_ia_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	chatId: integer("chat_id").notNull(),
	userId: integer("user_id").notNull(),
	role: roleMensagemIa().notNull(),
	conteudo: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("mensagens_ia_chat_data_idx").using("btree", table.chatId.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("int4_ops"), table.id.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chatsIa.id],
			name: "mensagens_ia_chat_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "mensagens_ia_user_fk"
		}).onDelete("cascade"),
]);

export const mensagens = pgTable("mensagens", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "mensagens_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	conversaId: integer("conversa_id").notNull(),
	remetenteId: integer("remetente_id").notNull(),
	conteudo: text().notNull(),
	lidaEm: timestamp("lida_em", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("mensagens_conversa_data_idx").using("btree", table.conversaId.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("int4_ops"), table.id.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.conversaId],
			foreignColumns: [conversas.id],
			name: "mensagens_conversa_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.remetenteId],
			foreignColumns: [users.id],
			name: "mensagens_remetente_fk"
		}).onDelete("cascade"),
]);
