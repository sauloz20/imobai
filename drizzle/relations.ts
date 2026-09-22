import { relations } from "drizzle-orm/relations";
import { users, conversas, imoveis, chatsIa, imovelFotos, localSessions, mensagensIa, mensagens } from "./schema";

export const conversasRelations = relations(conversas, ({one, many}) => ({
	user_compradorId: one(users, {
		fields: [conversas.compradorId],
		references: [users.id],
		relationName: "conversas_compradorId_users_id"
	}),
	imovei: one(imoveis, {
		fields: [conversas.imovelId],
		references: [imoveis.id]
	}),
	user_proprietarioId: one(users, {
		fields: [conversas.proprietarioId],
		references: [users.id],
		relationName: "conversas_proprietarioId_users_id"
	}),
	mensagens: many(mensagens),
}));

export const usersRelations = relations(users, ({many}) => ({
	conversas_compradorId: many(conversas, {
		relationName: "conversas_compradorId_users_id"
	}),
	conversas_proprietarioId: many(conversas, {
		relationName: "conversas_proprietarioId_users_id"
	}),
	chatsIas: many(chatsIa),
	imoveis: many(imoveis),
	imovelFotos: many(imovelFotos),
	localSessions: many(localSessions),
	mensagensIas: many(mensagensIa),
	mensagens: many(mensagens),
}));

export const imoveisRelations = relations(imoveis, ({one, many}) => ({
	conversas: many(conversas),
	user: one(users, {
		fields: [imoveis.ownerId],
		references: [users.id]
	}),
	imovelFotos: many(imovelFotos),
}));

export const chatsIaRelations = relations(chatsIa, ({one, many}) => ({
	user: one(users, {
		fields: [chatsIa.userId],
		references: [users.id]
	}),
	mensagensIas: many(mensagensIa),
}));

export const imovelFotosRelations = relations(imovelFotos, ({one}) => ({
	imovei: one(imoveis, {
		fields: [imovelFotos.imovelId],
		references: [imoveis.id]
	}),
	user: one(users, {
		fields: [imovelFotos.ownerId],
		references: [users.id]
	}),
}));

export const localSessionsRelations = relations(localSessions, ({one}) => ({
	user: one(users, {
		fields: [localSessions.userId],
		references: [users.id]
	}),
}));

export const mensagensIaRelations = relations(mensagensIa, ({one}) => ({
	chatsIa: one(chatsIa, {
		fields: [mensagensIa.chatId],
		references: [chatsIa.id]
	}),
	user: one(users, {
		fields: [mensagensIa.userId],
		references: [users.id]
	}),
}));

export const mensagensRelations = relations(mensagens, ({one}) => ({
	conversa: one(conversas, {
		fields: [mensagens.conversaId],
		references: [conversas.id]
	}),
	user: one(users, {
		fields: [mensagens.remetenteId],
		references: [users.id]
	}),
}));