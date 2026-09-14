CREATE TABLE `imovel_fotos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`imovel_id` int NOT NULL,
	`owner_id` int NOT NULL,
	`file_key` varchar(500) NOT NULL,
	`url` varchar(500) NOT NULL,
	`ordem` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `imovel_fotos_id` PRIMARY KEY(`id`)
);
