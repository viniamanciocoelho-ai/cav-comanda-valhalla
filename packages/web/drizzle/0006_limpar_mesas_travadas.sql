UPDATE `mesas`
SET `atendimento_id` = NULL
WHERE `status` = 'livre' AND `ativa` = 0 AND `atendimento_id` IS NOT NULL;
