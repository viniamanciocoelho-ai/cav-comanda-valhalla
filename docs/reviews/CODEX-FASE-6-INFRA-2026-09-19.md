# CODEX - Fase 6: infraestrutura e entrega para deploy

Data: 2026-09-19

## Estado revisado

- Branch: `feat/persistencia-notinha-pin-cardapio`
- Commit base: `85fe51ad5cd876d2f08943808d3bdac7f4161f3a`
- Repositório: `viniamanciocoelho-ai/cav-comanda-valhalla`
- URL da branch: `https://github.com/viniamanciocoelho-ai/cav-comanda-valhalla/tree/feat/persistencia-notinha-pin-cardapio`
- Nenhuma branch foi criada ou mesclada.
- Nenhum deploy ou acesso a banco remoto foi executado.

## Commits da fase

| Hash | Mensagem |
| --- | --- |
| `38743e9` | `fix: bloquear travessia com barra invertida codificada` |
| `03f771d` | `docs: consolidar variaveis de ambiente` |
| `62b83e5` | `chore: confirmar remocao do modo demonstracao` |
| `4124d40` | `feat: adicionar setup automatizado de deploy` |
| `8485d6a` | `feat: adicionar caminho de deploy com docker` |
| `1502822` | `feat: adicionar exemplos de deploy direto em vps` |
| `b204df5` | `fix: tornar falha de backup s3 explicita` |
| `efe8e86` | `docs: criar guia rapido de instalacao` |
| `410ebde` | `docs: atualizar guia completo de implantacao` |
| `eed9648` | `fix: completar fonte unica de variaveis` |

O commit que contém este relatório é informado na entrega final, pois um commit não pode
referenciar o próprio hash sem alterar esse hash.

## Itens executados

### 1. Caminho estático

`resolverArquivoEstatico()` normaliza barra invertida para `/` depois da decodificação e antes
da resolução. A simulação POSIX reproduziu o comportamento anterior, que aceitava
`..%5csegredo.txt`, e confirmou a rejeição após a correção. Os sete cenários existentes foram
preservados sem alteração no teste.

### 2. Variáveis de ambiente

Foi criado `.env.example` na raiz com as variáveis realmente consumidas, comentários de
obrigatoriedade, efeitos de ausência e valores fictícios. Os templates redundantes da raiz e
do pacote mobile foram removidos. `.env` continua ignorado e somente `.env.example` está
versionado.

Os PINs de garçom, produção e caixa não foram inventados como variáveis: o código não os lê e
eles são cadastrados pela interface.

### 3. Modo demonstrativo

`CAV_DEMO_MODE` já não existia em nenhum arquivo versionado da base recebida. A busca foi
registrada em commit próprio sem criar alteração artificial.

### 4. Setup em um comando

`bun run deploy:setup`:

1. reutiliza `validarConfiguracaoAmbiente()`;
2. conta e aplica migrations pendentes com o migrator libSQL do Drizzle;
3. reutiliza `verificarSaude()`;
4. imprime resumo sem valores secretos;
5. termina com código diferente de zero na primeira falha.

Em SQLite temporário, a primeira execução aplicou cinco migrations e a segunda aplicou zero,
confirmando idempotência.

### 5. Docker

Foram adicionados `Dockerfile` multi-stage com Bun `1.3.14`, usuário não-root, health check e
entrada com setup; `docker-compose.yml` com `.env`, volumes nomeados e restart; e
`.dockerignore` sem segredos, bancos, backups ou artefatos locais.

### 6. VPS direta

Foram adicionados exemplos de unit `systemd` e nginx com placeholders. O unit usa usuário
dedicado, `EnvironmentFile`, `Restart=always` e setup antes do servidor. O nginx envia os
cabeçalhos de proxy e suporta upgrade de WebSocket. O PM2 deixou de forçar a porta de
desenvolvimento e passa a respeitar o `.env`.

### 7. Backup

Foi adicionado cron diário de exemplo. Configuração S3 parcial agora informa exatamente as
variáveis ausentes. O teste executa o processo real, confirma código não zero, mensagem no
stderr e preservação explícita do backup local.

### 8. README

O README foi reduzido a um guia operacional com stack, desenvolvimento, Docker, VPS direta,
backup, testes e escopo. O documento declara que não existe emissão de NFC-e e que cada
instalação atende uma organização.

### 9. Implantação

`docs/IMPLANTACAO.md` documenta as duas alternativas de deploy, `deploy:setup`, saúde,
primeiro acesso, backup e checklist de go-live. Backup restaurado e impressão física nos três
destinos estão marcados como obrigatórios antes de operar.

## Resultados reais

| Validação | Resultado |
| --- | --- |
| `bun install` | Aprovado; 1113 instalações verificadas, sem mudança no lock |
| `bun run typecheck` | Aprovado; 3 de 3 pacotes |
| `bun run build` | Aprovado; web e desktop compilados |
| `cd packages/web && bunx drizzle-kit check` | Aprovado |
| `e2e/backup.ts` | Aprovado |
| `e2e/bootstrap-seguro.ts` | Aprovado |
| `e2e/deploy-setup.ts` | Aprovado |
| `e2e/fase1-api.ts` | Aprovado |
| `e2e/fixtures-funcionarios.ts` | Aprovado, código de saída 0 |
| `e2e/historico-persistencia.ts` | Aprovado |
| `e2e/hono-security.ts` | Aprovado |
| `e2e/impressao.ts` | Aprovado |
| `e2e/limpeza-operacional.ts` | Aprovado |
| `e2e/monetario.ts` | Aprovado; 64 verificações e varreduras sem falha |
| `e2e/offline.ts` | Aprovado |
| `e2e/producao.ts` | Aprovado |
| `e2e/recibo.ts` | Aprovado |
| `e2e/regressao-fina.ts` | Aprovado |
| `e2e/relatorio-diario.ts` | Aprovado |
| `e2e/security-regressao.ts` | Aprovado; 16 cenários |
| `e2e/sem-consumo.ts` | Aprovado; 28 verificações |
| `e2e/static-path.ts` | Aprovado; 7 cenários |
| `e2e/tenant-isolation.ts` | Aprovado |
| `bunx oxlint . --deny-warnings --no-error-on-unmatched-pattern` | Aprovado, sem saída |
| `docker compose config --quiet` | Aprovado |
| `git diff --check` | Aprovado |
| Scan de segredos por padrões de chaves, tokens, JWT e private keys | Nenhum indício |
| Scan de CPF, e-mail, telefone e IP | Nenhum dado pessoal; apenas hashes, Unicode, loopback e IPs reservados de teste |
| Arquivos versionados maiores que 50 MB | Zero |
| Blobs históricos maiores que 50 MB | Zero |
| Arquivos `__*`, `__ports.cjs` e migrations alterados | Zero |

## Arquivos alterados

- `.dockerignore`
- `.env.example`
- `.env.template` removido
- `Dockerfile`
- `README.md`
- `deploy/cav-backup.cron.example`
- `deploy/cav-comanda.service.example`
- `deploy/docker-entrypoint.sh`
- `deploy/nginx.conf.example`
- `docker-compose.yml`
- `docs/BACKUP-E-RESTAURACAO.md`
- `docs/IMPLANTACAO.md`
- `e2e/backup.ts`
- `e2e/deploy-setup.ts`
- `ecosystem.config.cjs`
- `package.json`
- `packages/mobile/.env.template` removido
- `packages/web/scripts/backup.ts`
- `packages/web/scripts/deploy-setup.ts`
- `packages/web/src/api/lib/static-path.ts`

## Limitações do ambiente

- O Bun disponível localmente é `1.4.2`; o projeto declara `1.3.14` e a imagem Docker foi
  fixada em `oven/bun:1.3.14`.
- O Docker Compose está instalado, mas o daemon Docker não estava ativo. A configuração do
  Compose foi validada, porém a imagem não pôde ser construída localmente.
- O nginx não está instalado neste Windows; `nginx -t` não pôde ser executado.
- Nenhuma migration remota, deploy, teste físico de impressora, DNS, TLS, cron real ou
  restauração em infraestrutura de produção foi executado.

## Fora de escopo

Não foram adicionados NFC-e, TEF, pagamento integrado, multi-organização pela interface,
mudança de layout, regra de negócio ou dependência nova. Nenhum documento histórico em
`docs/` foi apagado.

## Conclusão

O código e a documentação da Fase 6 estão aprovados pelos gates locais executáveis. A
implantação permanece condicionada ao checklist de go-live, principalmente build real da
imagem no host Docker, validação do nginx, restauração de backup e testes físicos das três
impressoras.
