ALTER TABLE `chats_ia` ADD CONSTRAINT `chats_ia_user_unique` UNIQUE(`user_id`);--> statement-breakpoint
ALTER TABLE `conversas` ADD CONSTRAINT `conversas_participantes_unique` UNIQUE(`imovel_id`,`comprador_id`,`proprietario_id`);--> statement-breakpoint
ALTER TABLE `chats_ia` ADD CONSTRAINT `chats_ia_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversas` ADD CONSTRAINT `conversas_imovel_fk` FOREIGN KEY (`imovel_id`) REFERENCES `imoveis`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversas` ADD CONSTRAINT `conversas_comprador_fk` FOREIGN KEY (`comprador_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversas` ADD CONSTRAINT `conversas_proprietario_fk` FOREIGN KEY (`proprietario_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `imoveis` ADD CONSTRAINT `imoveis_owner_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `imovel_fotos` ADD CONSTRAINT `imovel_fotos_imovel_fk` FOREIGN KEY (`imovel_id`) REFERENCES `imoveis`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `imovel_fotos` ADD CONSTRAINT `imovel_fotos_owner_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `local_sessions` ADD CONSTRAINT `local_sessions_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mensagens` ADD CONSTRAINT `mensagens_conversa_fk` FOREIGN KEY (`conversa_id`) REFERENCES `conversas`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mensagens` ADD CONSTRAINT `mensagens_remetente_fk` FOREIGN KEY (`remetente_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mensagens_ia` ADD CONSTRAINT `mensagens_ia_chat_fk` FOREIGN KEY (`chat_id`) REFERENCES `chats_ia`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mensagens_ia` ADD CONSTRAINT `mensagens_ia_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `conversas_participantes_idx` ON `conversas` (`comprador_id`,`proprietario_id`,`imovel_id`);--> statement-breakpoint
CREATE INDEX `conversas_comprador_idx` ON `conversas` (`comprador_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `conversas_proprietario_idx` ON `conversas` (`proprietario_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `historico_buscas_data_idx` ON `historico_buscas` (`data_busca`);--> statement-breakpoint
CREATE INDEX `imoveis_catalogo_idx` ON `imoveis` (`status`,`cidade`,`bairro`,`tipo`,`quartos`,`vagas`);--> statement-breakpoint
CREATE INDEX `imoveis_venda_idx` ON `imoveis` (`status`,`valor_venda`);--> statement-breakpoint
CREATE INDEX `imoveis_aluguel_idx` ON `imoveis` (`status`,`valor_aluguel`);--> statement-breakpoint
CREATE INDEX `imoveis_owner_idx` ON `imoveis` (`owner_id`);--> statement-breakpoint
CREATE INDEX `imovel_fotos_imovel_ordem_idx` ON `imovel_fotos` (`imovel_id`,`ordem`);--> statement-breakpoint
CREATE INDEX `imovel_fotos_owner_idx` ON `imovel_fotos` (`owner_id`);--> statement-breakpoint
CREATE INDEX `local_sessions_user_idx` ON `local_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `local_sessions_expiry_idx` ON `local_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `mensagens_conversa_data_idx` ON `mensagens` (`conversa_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `mensagens_ia_chat_data_idx` ON `mensagens_ia` (`chat_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);