# Laboratório de carga — Inst Acessor (10 → 500)

Mede o **nosso** app (páginas e APIs internas de leitura) sob concorrência
crescente. Não é uma prova de capacidade: **só depois de rodar** é que se pode
dizer qualquer coisa sobre aguentar 500.

## Ferramenta

**Harness próprio em Node puro** — sem dependência nenhuma, nada foi
adicionado ao `package.json`. Motivo: qualquer ferramenta de linha de comando
(k6, autocannon) não teria acesso à sessão autenticada do app de forma
simples, e o risco de apontar para produção por engano seria maior. Aqui a
trava é código nosso, versionado e auditável. Usa o `fetch` nativo do Node 18+
(o ambiente tem Node 22).

## Arquivos desta pasta

| Arquivo | Papel |
| --- | --- |
| `guard.mjs` | Trava de segurança (host + rota) e allowlist de endpoints |
| `metrics.mjs` | Percentis, agregação e a classificação VERDE/AMARELO/VERMELHO |
| `auth.mjs` | Sessão em runtime (env), redação e detecção de redirect/login |
| `runner.mjs` | Executa a carga, mede e imprime o relatório |
| `ai-shim.mjs` | Mock de processo para OpenAI/Gemini (nenhuma chamada real) |

## Segurança — duas travas

**1. Trava de alvo.** `guard.mjs` recusa por padrão:
- o domínio oficial de produção (`unitrixapp.com.br` e afins);
- qualquer host `*.vercel.app` (um preview pode apontar ao mesmo banco).

Aceita apenas alvos locais/privados (`localhost`, `127.0.0.1`, `10.x`,
`192.168.x`). Só é possível ir além com uma flag explícita
(`--allow-production` / `--allow-preview`) — que **não** deve ser usada contra
o domínio oficial.

**2. Trava de rota.** `assertInternalEndpoint` recusa qualquer caminho que
pertença a famílias que falam com terceiros ou escrevem
(`/api/webhooks`, `/api/integrations`, `/api/ai`, `/api/upload`,
`/api/billing`, `/api/auth`, `/api/account`, `/api/first-access`, `/api/admin`)
e aceita **apenas** a allowlist de leitura:

```
/dashboard
/calendario
/biblioteca-de-midia
/api/calendar
/api/rank
/api/alertas
/api/padroes
```

## Dependências externas — como ficam fora

- **Meta/Instagram, TikTok, Asaas, InfinitePay, Vercel Blob, webhooks:** não
  estão na allowlist. Nenhum desses caminhos pode ser atingido.
- **OpenAI/Gemini:** as URLs são fixas no código, então o mock entra por
  processo, sem editar `src/`:

  ```bash
  node --import ./bench/load/ai-shim.mjs node_modules/next/dist/bin/next dev
  ```

  O `ai-shim.mjs` intercepta o `fetch` global e responde localmente quando o
  destino é um host de IA; qualquer outro destino passa direto. Cada
  interceptação é registrada no stderr — prova de que nada saiu.

## Limpeza de credenciais na staging (cirúrgica)

Na staging, as credenciais cifradas vieram da produção e não abrem com a
`TOKEN_ENCRYPTION_KEY` local. Dois scripts resolvem isso, com guarda de host:

```bash
# 1) inspeção READ-ONLY (conta o que existe; não lê valores, não escreve)
node bench/staging-inspect.mjs

# 2) limpeza — DRY-RUN por padrão (não escreve)
node bench/staging-cleanup.mjs

# 3) só executa de verdade com a flag explícita
node bench/staging-cleanup.mjs --execute
```

Ambos usam `bench/staging-guard.mjs`, que lê **somente** `.env.local`, exige o
host da staging (`ep-patient-brook-acffelj3…`) nos dois endpoints e **aborta**
se detectar produção (`ep-autumn-sky…`) ou qualquer outro host.

A limpeza altera **apenas**:
- `SocialConnection.tokenEncrypted` → `NULL` (a linha/conexão permanece);
- `SystemSetting`: remove `ai.openai.key` e `ai.gemini.key` (só essas duas).

Depois é preciso **reconectar** Instagram/TikTok e reconfigurar a chave de IA.

> Estes scripts exigem o engine do Prisma para o SEU sistema. Rode-os no
> Windows (onde o `prisma generate` foi feito), não em outro ambiente.

## Prisma CLI contra a staging

O Prisma CLI carrega **somente** `.env` (não lê `.env.local` — isso é
convenção do Next, não do Prisma). Como o `.env` aponta para **produção**,
`npx prisma migrate status` conecta na produção mesmo com o `.env.local` na
staging. Para rodar comandos Prisma apontando para a staging com segurança,
use o wrapper:

```bash
node bench/prisma-staging.mjs check            # só valida os hosts
node bench/prisma-staging.mjs migrate status   # roda o Prisma na staging
```

O wrapper valida que `DATABASE_URL` e `DIRECT_URL` do `.env.local` são da
staging (`ep-patient-brook-acffelj3…`) e **aborta** se detectar produção ou
qualquer outro host. Nunca imprime senha nem connection string.

## Banco — ATENÇÃO

Todos os alvos são **GET de leitura**. O laboratório não escreve nada.

**Importante:** o dev server local lê o banco configurado no `.env.local` —
que, neste projeto, aponta para o **Neon real**. Como o laboratório só faz
leitura, ele **não polui nem destrói** dados; mas a carga **compartilha o pool
de conexões do Neon de produção**. Para os níveis altos (250/500), prefira um
banco de teste/uma branch do Neon dedicada. Ver "Limitação conhecida".

## Autenticação

As rotas internas exigem sessão. Sem ela, o laboratório mediria só
`request → auth → redirect`, não o caminho real. A sessão entra **somente em
runtime**, por variável de ambiente — nunca em arquivo, nunca impressa:

```bash
# opção A — variável de ambiente (preferida)
BENCH_SESSION_COOKIE='<SESSAO_LOCAL>' node bench/load/runner.mjs --base http://localhost:3000 --level 10

# opção B — arquivo local NÃO versionado
BENCH_SESSION_FILE=/caminho/fora/do/repo/cookie.txt node bench/load/runner.mjs --base http://localhost:3000 --level 10
```

### Opção recomendada no Windows (arquivo local)

Para **não** ter de colar o cookie na linha de comando toda vez (o valor fica
no histórico do terminal), use `BENCH_SESSION_FILE`:

1. Crie o arquivo (uma vez):
   `bench\load\.session`  → já coberto pelo `.gitignore` (`bench/load/.session*`).
2. Abra o app autenticado no navegador → DevTools (F12) → **Application** →
   **Cookies** → copie o cookie de sessão (ex.: `next-auth.session-token=…`)
   e cole no arquivo. O conteúdo é o header `Cookie` inteiro (`nome=valor`).
3. O arquivo nunca é lido por outro processo, nunca é impresso e nunca é
   versionado. Não cole o valor em nenhum chat/IA.

O jeito mais limpo de gravar sem o valor aparecer na tela (PowerShell):

```powershell
# cria o arquivo e espera você colar (o texto não é ecoado na tela)
Read-Host -AsSecureString | ConvertFrom-SecureString | Set-Content bench\load\.session
```

Se preferir o CMD, `notepad bench\load\.session` e cole lá. Em ambos os casos,
`BENCH_SESSION_FILE` deve apontar para esse caminho na hora de rodar.

O valor é o conteúdo do header `Cookie` da sua sessão autenticada (ex.:
`next-auth.session-token=…`). Como obter: abra o app autenticado no navegador,
em DevTools → Application → Cookies, copie o cookie de sessão. **Não cole esse
valor no código, em arquivo do repositório, nem o mostre em prints.**

Antes de qualquer carga, o runner faz **UMA** requisição de validação. Se a
resposta for redirect para `/login`, 401 ou 403, ele **aborta** (exit 3) — para
não contar login como resultado de performance.

### Somente leitura

Todos os alvos são `GET`. O método está fixo em `GET` no runner (constante
`ALLOWED_METHOD`) — não há caminho que emita POST/PUT/PATCH/DELETE.
`/api/rank` **não** está na allowlist apesar de ser GET: ele grava
(`recomputeGoalProgress` atualiza metas e concede XP).

## Como rodar

Todos os comandos rodam a partir da raiz do projeto.

```bash
# 1) subir o app local (com mock de IA, para não chamar provedor real)
node --import ./bench/load/ai-shim.mjs node_modules/next/dist/bin/next dev

# 2) conferir alvos permitidos, sem rodar nada
node bench/load/runner.mjs --list

# 3) verificar só a sessão (não roda carga)
BENCH_SESSION_COOKIE='<SESSAO_LOCAL>' node bench/load/runner.mjs --base http://localhost:3000 --check-auth --level 10

# 4) nível 10 (ver seção "Comandos" abaixo)
```

O `--base` é livre (ex.: `http://localhost:3001`) — a porta não é fixa. A trava
de produção continua valendo para qualquer `--base`.

Outros níveis (um por vez, analisando entre eles):

```bash
node bench/load/runner.mjs --base http://localhost:3000 --level 25  --duration 30
node bench/load/runner.mjs --base http://localhost:3000 --level 50
node bench/load/runner.mjs --base http://localhost:3000 --level 100
node bench/load/runner.mjs --base http://localhost:3000 --level 250 --confirm-heavy
node bench/load/runner.mjs --base http://localhost:3000 --level 500 --confirm-heavy
```

`--level` = usuários simultâneos (concorrência). `--duration` = segundos
(padrão 20). `--confirm-heavy` é exigido a partir de 250. `--allow-anonymous`
roda sem sessão (mede só a porta) — use apenas para comparar.

## Métricas por nível

Total de requisições, requisições/segundo, média, p50, p95, p99, menor, maior,
taxa de erro, contagem 2xx / 4xx / 5xx e timeouts — em geral e **por
endpoint**.

## Classificação

Feita sobre os números medidos, com a régua fixa (não muda com o nível):

| | Latência (p95 / p99) | Erro (5xx + timeout + rede) |
| --- | --- | --- |
| **VERDE** | p95 ≤ 500 ms e p99 ≤ 1000 ms | ≤ 1% |
| **AMARELO** | p95 ≤ 1500 ms e p99 ≤ 3000 ms | ≤ 5% |
| **VERMELHO** | acima disso | > 5% |

O veredito final é o **pior** entre latência e erro. Sem amostras → `sem-dados`
(nunca inventamos um resultado).

## Limitação conhecida (importante)

Sem uma sessão autenticada, as rotas internas redirecionam para `/login`. Nesse
caso o número mede a **porta** (auth + redirect), não o trabalho da página — o
`runner.mjs` avisa quando isso acontece ("Nenhuma resposta 2xx/3xx"). Para medir
o caminho real (incluindo o calendário, onde estava o N+1), é preciso apontar
para um ambiente já autenticado. A autenticação do app é por cookie de sessão;
o laboratório não carrega credenciais (por regra), então este é o passo manual
que a dona do projeto faz uma vez no ambiente de teste.
