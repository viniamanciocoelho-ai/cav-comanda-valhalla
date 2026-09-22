ALTER TABLE `mesas` ADD `atendimento_id` text;
--> statement-breakpoint
UPDATE `mesas`
SET `atendimento_id` = 'mesa:' || `mesa_id` || ':' || COALESCE(`aberta_em`, 'legado')
WHERE `ativa` = 1;
--> statement-breakpoint
CREATE TABLE `balcoes` (
  `organizacao_id` text NOT NULL,
  `balcao_id` integer NOT NULL,
  `atendimento_id` text,
  `status` text NOT NULL,
  `ativa` integer NOT NULL,
  `aberta_em` text,
  `garcom_id` text,
  `conta_solicitada` integer NOT NULL,
  `servico_incluso` integer NOT NULL,
  PRIMARY KEY(`organizacao_id`, `balcao_id`)
);
--> statement-breakpoint
CREATE INDEX `balcoes_org_status` ON `balcoes` (`organizacao_id`,`status`);
--> statement-breakpoint
CREATE TABLE `pessoas_da_comanda_nova` (
  `organizacao_id` text NOT NULL,
  `pessoa_id` text NOT NULL,
  `atendimento_id` text NOT NULL,
  `mesa_id` integer,
  `balcao_id` integer,
  `nome` text NOT NULL,
  PRIMARY KEY(`organizacao_id`, `pessoa_id`),
  CHECK ((`mesa_id` IS NOT NULL AND `balcao_id` IS NULL) OR (`mesa_id` IS NULL AND `balcao_id` IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `pessoas_da_comanda_nova`
SELECT p.`organizacao_id`, p.`pessoa_id`,
  COALESCE(m.`atendimento_id`, 'mesa:' || p.`mesa_id` || ':legado'),
  p.`mesa_id`, NULL, p.`nome`
FROM `pessoas_da_comanda` p
JOIN `mesas` m ON m.`organizacao_id` = p.`organizacao_id` AND m.`mesa_id` = p.`mesa_id`;
--> statement-breakpoint
DROP TABLE `pessoas_da_comanda`;
--> statement-breakpoint
ALTER TABLE `pessoas_da_comanda_nova` RENAME TO `pessoas_da_comanda`;
--> statement-breakpoint
CREATE INDEX `pessoas_org_mesa` ON `pessoas_da_comanda` (`organizacao_id`,`mesa_id`);
--> statement-breakpoint
CREATE INDEX `pessoas_org_balcao` ON `pessoas_da_comanda` (`organizacao_id`,`balcao_id`);
--> statement-breakpoint
CREATE INDEX `pessoas_org_atendimento` ON `pessoas_da_comanda` (`organizacao_id`,`atendimento_id`);
--> statement-breakpoint
CREATE TABLE `itens_pedido_nova` (
  `organizacao_id` text NOT NULL,
  `item_id` text NOT NULL,
  `pedido_id` text,
  `atendimento_id` text NOT NULL,
  `mesa_id` integer,
  `balcao_id` integer,
  `pessoa_id` text NOT NULL,
  `produto_id` text NOT NULL,
  `nome` text NOT NULL,
  `preco_centavos` integer NOT NULL,
  `quantidade` integer NOT NULL,
  `observacao` text NOT NULL,
  `destino_producao` text NOT NULL,
  `status` text NOT NULL,
  `status_anterior` text,
  `funcionario_id` text NOT NULL,
  `funcionario_nome` text NOT NULL,
  `funcionario_perfil` text NOT NULL,
  `criado_em` text NOT NULL,
  `enviado_em` text,
  `atualizado_em` text NOT NULL,
  PRIMARY KEY(`organizacao_id`, `item_id`),
  CHECK ((`mesa_id` IS NOT NULL AND `balcao_id` IS NULL) OR (`mesa_id` IS NULL AND `balcao_id` IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `itens_pedido_nova`
SELECT i.`organizacao_id`, i.`item_id`, i.`pedido_id`,
  COALESCE(m.`atendimento_id`, 'mesa:' || i.`mesa_id` || ':legado'),
  i.`mesa_id`, NULL,
  i.`pessoa_id`, i.`produto_id`, i.`nome`, i.`preco_centavos`, i.`quantidade`, i.`observacao`,
  i.`destino_producao`, i.`status`, i.`status_anterior`, i.`funcionario_id`, i.`funcionario_nome`,
  i.`funcionario_perfil`, i.`criado_em`, i.`enviado_em`, i.`atualizado_em`
FROM `itens_pedido` i
JOIN `mesas` m ON m.`organizacao_id` = i.`organizacao_id` AND m.`mesa_id` = i.`mesa_id`;
--> statement-breakpoint
DROP TABLE `itens_pedido`;
--> statement-breakpoint
ALTER TABLE `itens_pedido_nova` RENAME TO `itens_pedido`;
--> statement-breakpoint
CREATE INDEX `itens_org_mesa` ON `itens_pedido` (`organizacao_id`,`mesa_id`);
--> statement-breakpoint
CREATE INDEX `itens_org_balcao` ON `itens_pedido` (`organizacao_id`,`balcao_id`);
--> statement-breakpoint
CREATE INDEX `itens_org_atendimento` ON `itens_pedido` (`organizacao_id`,`atendimento_id`);
--> statement-breakpoint
CREATE INDEX `itens_org_status` ON `itens_pedido` (`organizacao_id`,`status`);
--> statement-breakpoint
CREATE TABLE `fichas_producao_nova` (
  `organizacao_id` text NOT NULL,
  `ticket_id` text NOT NULL,
  `pedido_id` text NOT NULL,
  `atendimento_id` text NOT NULL,
  `mesa_id` integer,
  `balcao_id` integer,
  `destino_producao` text NOT NULL,
  `status` text NOT NULL,
  `linhas_json` text NOT NULL,
  `item_ids_json` text NOT NULL,
  `funcionario_id` text NOT NULL,
  `funcionario_nome` text NOT NULL,
  `criado_em` text NOT NULL,
  `enviado_em` text NOT NULL,
  `atualizado_em` text NOT NULL,
  PRIMARY KEY(`organizacao_id`, `ticket_id`),
  CHECK ((`mesa_id` IS NOT NULL AND `balcao_id` IS NULL) OR (`mesa_id` IS NULL AND `balcao_id` IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `fichas_producao_nova`
SELECT f.`organizacao_id`, f.`ticket_id`, f.`pedido_id`,
  COALESCE(m.`atendimento_id`, 'mesa:' || f.`mesa_id` || ':legado'),
  f.`mesa_id`, NULL,
  f.`destino_producao`, f.`status`, f.`linhas_json`, f.`item_ids_json`, f.`funcionario_id`,
  f.`funcionario_nome`, f.`criado_em`, f.`enviado_em`, f.`atualizado_em`
FROM `fichas_producao` f
JOIN `mesas` m ON m.`organizacao_id` = f.`organizacao_id` AND m.`mesa_id` = f.`mesa_id`;
--> statement-breakpoint
DROP TABLE `fichas_producao`;
--> statement-breakpoint
ALTER TABLE `fichas_producao_nova` RENAME TO `fichas_producao`;
--> statement-breakpoint
CREATE INDEX `fichas_org_atendimento` ON `fichas_producao` (`organizacao_id`,`atendimento_id`);
--> statement-breakpoint
CREATE INDEX `fichas_org_status` ON `fichas_producao` (`organizacao_id`,`status`);
--> statement-breakpoint
CREATE TABLE `fila_impressoes_nova` (
  `organizacao_id` text NOT NULL,
  `impressao_id` text NOT NULL,
  `destino` text NOT NULL,
  `tipo` text NOT NULL,
  `referencia_id` text NOT NULL,
  `atendimento_id` text NOT NULL,
  `mesa_id` integer,
  `balcao_id` integer,
  `texto` text NOT NULL,
  `largura` integer NOT NULL,
  `status` text NOT NULL,
  `tentativas` integer DEFAULT 0 NOT NULL,
  `ultimo_erro` text,
  `impresso_em` text,
  `criado_em` text NOT NULL,
  `atualizado_em` text NOT NULL,
  PRIMARY KEY(`organizacao_id`, `impressao_id`),
  CHECK ((`mesa_id` IS NOT NULL AND `balcao_id` IS NULL) OR (`mesa_id` IS NULL AND `balcao_id` IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `fila_impressoes_nova`
SELECT f.`organizacao_id`, f.`impressao_id`, f.`destino`, f.`tipo`, f.`referencia_id`,
  COALESCE(m.`atendimento_id`, 'mesa:' || f.`mesa_id` || ':legado'), f.`mesa_id`, NULL,
  f.`texto`, f.`largura`, f.`status`, f.`tentativas`, f.`ultimo_erro`, NULL,
  f.`criado_em`, f.`atualizado_em`
FROM `fila_impressoes` f
LEFT JOIN `mesas` m ON m.`organizacao_id` = f.`organizacao_id` AND m.`mesa_id` = f.`mesa_id`;
--> statement-breakpoint
DROP TABLE `fila_impressoes`;
--> statement-breakpoint
ALTER TABLE `fila_impressoes_nova` RENAME TO `fila_impressoes`;
--> statement-breakpoint
CREATE UNIQUE INDEX `fila_impressoes_org_referencia` ON `fila_impressoes` (`organizacao_id`,`tipo`,`referencia_id`);
--> statement-breakpoint
CREATE INDEX `fila_impressoes_org_status` ON `fila_impressoes` (`organizacao_id`,`status`);
--> statement-breakpoint
CREATE TABLE `fechamentos_nova` (
  `organizacao_id` text NOT NULL,
  `fechamento_id` text NOT NULL,
  `atendimento_id` text NOT NULL,
  `mesa_id` integer,
  `balcao_id` integer,
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
INSERT INTO `fechamentos_nova`
SELECT f.`organizacao_id`, f.`fechamento_id`,
  COALESCE(m.`atendimento_id`, 'mesa:' || f.`mesa_id` || ':legado'),
  f.`mesa_id`, NULL, f.`hora`, f.`subtotal_centavos`, f.`servico_centavos`,
  f.`total_centavos`, f.`servico_incluso`, f.`divisao_json`, f.`funcionario_nome`,
  f.`garcom_nome`, f.`criado_em`
FROM `fechamentos` f
LEFT JOIN `mesas` m ON m.`organizacao_id` = f.`organizacao_id` AND m.`mesa_id` = f.`mesa_id`;
--> statement-breakpoint
DROP TABLE `fechamentos`;
--> statement-breakpoint
ALTER TABLE `fechamentos_nova` RENAME TO `fechamentos`;
--> statement-breakpoint
CREATE INDEX `fechamentos_org_mesa` ON `fechamentos` (`organizacao_id`,`mesa_id`);
--> statement-breakpoint
CREATE INDEX `fechamentos_org_balcao` ON `fechamentos` (`organizacao_id`,`balcao_id`);
--> statement-breakpoint
CREATE INDEX `fechamentos_org_atendimento` ON `fechamentos` (`organizacao_id`,`atendimento_id`);
--> statement-breakpoint
CREATE TABLE `itens_fechamento_nova` (
  `organizacao_id` text NOT NULL,
  `fechamento_id` text NOT NULL,
  `item_id` text NOT NULL,
  `atendimento_id` text NOT NULL,
  `mesa_id` integer,
  `balcao_id` integer,
  `produto_id` text NOT NULL,
  `nome` text NOT NULL,
  `preco_centavos` integer NOT NULL,
  `quantidade` integer NOT NULL,
  `destino_producao` text NOT NULL,
  `criado_em` text NOT NULL,
  PRIMARY KEY(`organizacao_id`, `fechamento_id`, `item_id`)
);
--> statement-breakpoint
INSERT INTO `itens_fechamento_nova`
SELECT i.`organizacao_id`, i.`fechamento_id`, i.`item_id`, f.`atendimento_id`,
  i.`mesa_id`, NULL, i.`produto_id`, i.`nome`, i.`preco_centavos`, i.`quantidade`,
  i.`destino_producao`, i.`criado_em`
FROM `itens_fechamento` i
JOIN `fechamentos` f
  ON f.`organizacao_id` = i.`organizacao_id` AND f.`fechamento_id` = i.`fechamento_id`;
--> statement-breakpoint
DROP TABLE `itens_fechamento`;
--> statement-breakpoint
ALTER TABLE `itens_fechamento_nova` RENAME TO `itens_fechamento`;
--> statement-breakpoint
CREATE INDEX `itens_fechamento_org_fechamento` ON `itens_fechamento` (`organizacao_id`,`fechamento_id`);
--> statement-breakpoint
CREATE INDEX `itens_fechamento_org_atendimento` ON `itens_fechamento` (`organizacao_id`,`atendimento_id`);
--> statement-breakpoint
CREATE TABLE `cancelamentos_autorizados_nova` (
  `organizacao_id` text NOT NULL,
  `cancelamento_id` text NOT NULL,
  `item_id` text NOT NULL,
  `atendimento_id` text NOT NULL,
  `mesa_id` integer,
  `balcao_id` integer,
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
INSERT INTO `cancelamentos_autorizados_nova`
SELECT c.`organizacao_id`, c.`cancelamento_id`, c.`item_id`,
  COALESCE(m.`atendimento_id`, 'mesa:' || c.`mesa_id` || ':legado'),
  c.`mesa_id`, NULL, c.`produto_id`, c.`nome`, c.`preco_centavos`, c.`quantidade`,
  c.`destino_producao`, c.`autorizado_por_id`, c.`autorizado_por_nome`, c.`autorizado_em`
FROM `cancelamentos_autorizados` c
LEFT JOIN `mesas` m ON m.`organizacao_id` = c.`organizacao_id` AND m.`mesa_id` = c.`mesa_id`;
--> statement-breakpoint
DROP TABLE `cancelamentos_autorizados`;
--> statement-breakpoint
ALTER TABLE `cancelamentos_autorizados_nova` RENAME TO `cancelamentos_autorizados`;
--> statement-breakpoint
CREATE INDEX `cancelamentos_org_autorizado` ON `cancelamentos_autorizados` (`organizacao_id`,`autorizado_em`);
--> statement-breakpoint
CREATE INDEX `cancelamentos_org_atendimento` ON `cancelamentos_autorizados` (`organizacao_id`,`atendimento_id`);
--> statement-breakpoint
CREATE TABLE `encerramentos_sem_consumo_nova` (
  `organizacao_id` text NOT NULL,
  `encerramento_id` text NOT NULL,
  `atendimento_id` text NOT NULL,
  `mesa_id` integer,
  `balcao_id` integer,
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
  PRIMARY KEY(`organizacao_id`, `encerramento_id`),
  UNIQUE(`organizacao_id`, `abertura_id`)
);
--> statement-breakpoint
INSERT INTO `encerramentos_sem_consumo_nova`
SELECT e.`organizacao_id`, e.`encerramento_id`,
  COALESCE(m.`atendimento_id`, 'mesa:' || e.`mesa_id` || ':legado'),
  e.`mesa_id`, NULL, e.`abertura_id`, e.`motivo`, e.`observacao`,
  e.`rascunhos_descartados`, e.`funcionario_id`, e.`funcionario_nome`,
  e.`funcionario_perfil`, e.`aberta_em`, e.`encerrada_em`, e.`duracao_segundos`, e.`desfeito_em`
FROM `encerramentos_sem_consumo` e
LEFT JOIN `mesas` m ON m.`organizacao_id` = e.`organizacao_id` AND m.`mesa_id` = e.`mesa_id`;
--> statement-breakpoint
DROP TABLE `encerramentos_sem_consumo`;
--> statement-breakpoint
ALTER TABLE `encerramentos_sem_consumo_nova` RENAME TO `encerramentos_sem_consumo`;
--> statement-breakpoint
CREATE INDEX `encerramentos_org_atendimento` ON `encerramentos_sem_consumo` (`organizacao_id`,`atendimento_id`);
