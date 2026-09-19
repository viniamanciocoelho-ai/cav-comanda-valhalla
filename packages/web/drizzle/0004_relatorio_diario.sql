CREATE TABLE `cancelamentos_autorizados` (
	`organizacao_id` text NOT NULL,
	`cancelamento_id` text NOT NULL,
	`item_id` text NOT NULL,
	`mesa_id` integer NOT NULL,
	`produto_id` text NOT NULL,
	`nome` text NOT NULL,
	`preco_centavos` integer NOT NULL,
	`quantidade` integer NOT NULL,
	`destino_producao` text NOT NULL,
	`autorizado_por_id` text NOT NULL,
	`autorizado_por_nome` text NOT NULL,
	`autorizado_em` text NOT NULL,
	PRIMARY KEY(`organizacao_id`, `cancelamento_id`)
);
--> statement-breakpoint
CREATE INDEX `cancelamentos_org_autorizado` ON `cancelamentos_autorizados` (`organizacao_id`,`autorizado_em`);--> statement-breakpoint
CREATE TABLE `itens_fechamento` (
	`organizacao_id` text NOT NULL,
	`fechamento_id` text NOT NULL,
	`item_id` text NOT NULL,
	`mesa_id` integer NOT NULL,
	`produto_id` text NOT NULL,
	`nome` text NOT NULL,
	`preco_centavos` integer NOT NULL,
	`quantidade` integer NOT NULL,
	`destino_producao` text NOT NULL,
	`criado_em` text NOT NULL,
	PRIMARY KEY(`organizacao_id`, `fechamento_id`, `item_id`)
);
--> statement-breakpoint
CREATE INDEX `itens_fechamento_org_fechamento` ON `itens_fechamento` (`organizacao_id`,`fechamento_id`);