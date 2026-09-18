CREATE TABLE `auditoria` (
	`auditoria_id` text PRIMARY KEY NOT NULL,
	`organizacao_id` text NOT NULL,
	`funcionario_id` text NOT NULL,
	`acao` text NOT NULL,
	`entidade` text NOT NULL,
	`entidade_id` text,
	`criado_em` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auditoria_org_criado` ON `auditoria` (`organizacao_id`,`criado_em`);--> statement-breakpoint
CREATE TABLE `cardapio` (
	`organizacao_id` text NOT NULL,
	`produto_id` text NOT NULL,
	`nome` text NOT NULL,
	`preco_centavos` integer NOT NULL,
	`destino_producao` text NOT NULL,
	`categoria` text NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	PRIMARY KEY(`organizacao_id`, `produto_id`)
);
--> statement-breakpoint
CREATE TABLE `encerramentos_sem_consumo` (
	`organizacao_id` text NOT NULL,
	`encerramento_id` text NOT NULL,
	`mesa_id` integer NOT NULL,
	`abertura_id` text NOT NULL,
	`motivo` text NOT NULL,
	`observacao` text NOT NULL,
	`rascunhos_descartados` integer NOT NULL,
	`funcionario_id` text NOT NULL,
	`funcionario_nome` text NOT NULL,
	`funcionario_perfil` text NOT NULL,
	`aberta_em` text,
	`encerrada_em` text NOT NULL,
	`duracao_segundos` integer NOT NULL,
	`desfeito_em` text,
	PRIMARY KEY(`organizacao_id`, `encerramento_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `encerramentos_org_abertura` ON `encerramentos_sem_consumo` (`organizacao_id`,`abertura_id`);--> statement-breakpoint
CREATE TABLE `fechamentos` (
	`organizacao_id` text NOT NULL,
	`fechamento_id` text NOT NULL,
	`mesa_id` integer NOT NULL,
	`hora` text NOT NULL,
	`subtotal_centavos` integer NOT NULL,
	`servico_centavos` integer NOT NULL,
	`total_centavos` integer NOT NULL,
	`servico_incluso` integer NOT NULL,
	`divisao_json` text NOT NULL,
	`funcionario_nome` text NOT NULL,
	`garcom_nome` text,
	`criado_em` text NOT NULL,
	PRIMARY KEY(`organizacao_id`, `fechamento_id`)
);
--> statement-breakpoint
CREATE INDEX `fechamentos_org_mesa` ON `fechamentos` (`organizacao_id`,`mesa_id`);--> statement-breakpoint
CREATE TABLE `fichas_producao` (
	`organizacao_id` text NOT NULL,
	`ticket_id` text NOT NULL,
	`pedido_id` text NOT NULL,
	`mesa_id` integer NOT NULL,
	`destino_producao` text NOT NULL,
	`status` text NOT NULL,
	`linhas_json` text NOT NULL,
	`item_ids_json` text NOT NULL,
	`funcionario_id` text NOT NULL,
	`funcionario_nome` text NOT NULL,
	`criado_em` text NOT NULL,
	`enviado_em` text NOT NULL,
	`atualizado_em` text NOT NULL,
	PRIMARY KEY(`organizacao_id`, `ticket_id`)
);
--> statement-breakpoint
CREATE INDEX `fichas_org_status` ON `fichas_producao` (`organizacao_id`,`status`);--> statement-breakpoint
CREATE TABLE `funcionarios` (
	`organizacao_id` text NOT NULL,
	`funcionario_id` text NOT NULL,
	`nome` text NOT NULL,
	`perfil` text NOT NULL,
	`pin_hash` text NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`criado_em` text NOT NULL,
	`atualizado_em` text NOT NULL,
	PRIMARY KEY(`organizacao_id`, `funcionario_id`)
);
--> statement-breakpoint
CREATE INDEX `funcionarios_org_perfil` ON `funcionarios` (`organizacao_id`,`perfil`);--> statement-breakpoint
CREATE TABLE `itens_pedido` (
	`organizacao_id` text NOT NULL,
	`item_id` text NOT NULL,
	`pedido_id` text,
	`mesa_id` integer NOT NULL,
	`pessoa_id` text NOT NULL,
	`produto_id` text NOT NULL,
	`nome` text NOT NULL,
	`preco_centavos` integer NOT NULL,
	`quantidade` integer NOT NULL,
	`observacao` text NOT NULL,
	`destino_producao` text NOT NULL,
	`status` text NOT NULL,
	`funcionario_id` text NOT NULL,
	`funcionario_nome` text NOT NULL,
	`funcionario_perfil` text NOT NULL,
	`criado_em` text NOT NULL,
	`enviado_em` text,
	`atualizado_em` text NOT NULL,
	PRIMARY KEY(`organizacao_id`, `item_id`)
);
--> statement-breakpoint
CREATE INDEX `itens_org_mesa` ON `itens_pedido` (`organizacao_id`,`mesa_id`);--> statement-breakpoint
CREATE INDEX `itens_org_status` ON `itens_pedido` (`organizacao_id`,`status`);--> statement-breakpoint
CREATE TABLE `mesas` (
	`organizacao_id` text NOT NULL,
	`mesa_id` integer NOT NULL,
	`status` text NOT NULL,
	`ativa` integer NOT NULL,
	`demonstracao` integer,
	`pessoas_fixas` integer NOT NULL,
	`total_fixo_centavos` integer NOT NULL,
	`aberta_em` text,
	`garcom_id` text,
	`conta_solicitada` integer NOT NULL,
	`servico_incluso` integer NOT NULL,
	PRIMARY KEY(`organizacao_id`, `mesa_id`)
);
--> statement-breakpoint
CREATE INDEX `mesas_org_status` ON `mesas` (`organizacao_id`,`status`);--> statement-breakpoint
CREATE TABLE `organizacoes` (
	`organizacao_id` text PRIMARY KEY NOT NULL,
	`codigo` text NOT NULL,
	`nome` text NOT NULL,
	`quantidade_mesas` integer DEFAULT 15 NOT NULL,
	`largura_recibo` integer DEFAULT 80 NOT NULL,
	`criado_em` text NOT NULL,
	`atualizado_em` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizacoes_codigo_unico` ON `organizacoes` (`codigo`);--> statement-breakpoint
CREATE TABLE `pessoas_da_comanda` (
	`organizacao_id` text NOT NULL,
	`pessoa_id` text NOT NULL,
	`mesa_id` integer NOT NULL,
	`nome` text NOT NULL,
	PRIMARY KEY(`organizacao_id`, `pessoa_id`)
);
--> statement-breakpoint
CREATE INDEX `pessoas_org_mesa` ON `pessoas_da_comanda` (`organizacao_id`,`mesa_id`);--> statement-breakpoint
CREATE TABLE `sessoes` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`organizacao_id` text NOT NULL,
	`funcionario_id` text NOT NULL,
	`expira_em` text NOT NULL,
	`criado_em` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessoes_org_funcionario` ON `sessoes` (`organizacao_id`,`funcionario_id`);--> statement-breakpoint
CREATE TABLE `versoes_estado` (
	`organizacao_id` text PRIMARY KEY NOT NULL,
	`versao` integer DEFAULT 0 NOT NULL,
	`atualizado_em` text NOT NULL
);
