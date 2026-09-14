CREATE TABLE `historico_buscas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`texto_busca` text NOT NULL,
	`json_interpretado` text NOT NULL,
	`data_busca` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historico_buscas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `imoveis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(20) NOT NULL,
	`tipo` enum('Apartamento','Casa','Sobrado','Terreno','Cobertura') NOT NULL,
	`bairro` varchar(100) NOT NULL,
	`cidade` varchar(100) NOT NULL DEFAULT 'São Paulo',
	`quartos` int NOT NULL DEFAULT 0,
	`banheiros` int NOT NULL DEFAULT 0,
	`vagas` int NOT NULL DEFAULT 0,
	`area_m2` decimal(10,2) NOT NULL,
	`aceita_pets` boolean NOT NULL DEFAULT false,
	`varanda` boolean NOT NULL DEFAULT false,
	`ensolarado` boolean NOT NULL DEFAULT false,
	`valor_venda` decimal(12,2),
	`valor_aluguel` decimal(10,2),
	`descricao_tecnica` text,
	`descricao_ia` text,
	`titulo_anuncio` varchar(200),
	`status` enum('Disponivel','Vendido','Alugado') NOT NULL DEFAULT 'Disponivel',
	`imagem_url` varchar(500),
	`data_cadastro` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `imoveis_id` PRIMARY KEY(`id`),
	CONSTRAINT `imoveis_codigo_unique` UNIQUE(`codigo`)
);
