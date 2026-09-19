CREATE TABLE `fila_impressoes` (
	`organizacao_id` text NOT NULL,
	`impressao_id` text NOT NULL,
	`destino` text NOT NULL,
	`tipo` text NOT NULL,
	`referencia_id` text NOT NULL,
	`mesa_id` integer NOT NULL,
	`texto` text NOT NULL,
	`largura` integer NOT NULL,
	`status` text NOT NULL,
	`tentativas` integer DEFAULT 0 NOT NULL,
	`ultimo_erro` text,
	`criado_em` text NOT NULL,
	`atualizado_em` text NOT NULL,
	PRIMARY KEY(`organizacao_id`, `impressao_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fila_impressoes_org_referencia` ON `fila_impressoes` (`organizacao_id`,`tipo`,`referencia_id`);--> statement-breakpoint
CREATE INDEX `fila_impressoes_org_status` ON `fila_impressoes` (`organizacao_id`,`status`);--> statement-breakpoint
CREATE TABLE `impressoras` (
	`organizacao_id` text NOT NULL,
	`destino` text NOT NULL,
	`nome` text NOT NULL,
	`host` text NOT NULL,
	`porta` integer NOT NULL,
	`largura` integer NOT NULL,
	`ativa` integer DEFAULT false NOT NULL,
	`criado_em` text NOT NULL,
	`atualizado_em` text NOT NULL,
	PRIMARY KEY(`organizacao_id`, `destino`)
);
--> statement-breakpoint
CREATE INDEX `impressoras_org_ativa` ON `impressoras` (`organizacao_id`,`ativa`);