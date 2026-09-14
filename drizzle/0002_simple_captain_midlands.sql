CREATE TABLE `chats_ia` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`titulo` varchar(160) NOT NULL DEFAULT 'Consultoria imobiliária',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chats_ia_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`imovel_id` int,
	`comprador_id` int NOT NULL,
	`proprietario_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `local_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `local_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_sessions_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `mensagens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversa_id` int NOT NULL,
	`remetente_id` int NOT NULL,
	`conteudo` text NOT NULL,
	`lida_em` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mensagens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mensagens_ia` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chat_id` int NOT NULL,
	`user_id` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`conteudo` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mensagens_ia_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `imoveis` ADD `owner_id` int;--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);