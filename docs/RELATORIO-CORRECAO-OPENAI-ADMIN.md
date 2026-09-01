# RELATÓRIO — CORREÇÃO OPENAI (SALVAR CHAVE) + ADMIN ÚNICO

**Data:** 2026-09-01
**Contexto:** O painel `/admin/ia` mostrava "TESTAR: Conexão com OpenAI OK" mas
"SALVAR: Não foi possível processar a solicitação." Este relatório documenta a causa
raiz, o nome exato da variável, a correção aplicada e o que a DONA precisa fazer no
Vercel.

---

## 1. Sintoma

| Ação | Resultado antes |
|---|---|
| **Testar** chave OpenAI no `/admin/ia` | ✅ "Conexão com OpenAI OK" |
| **Salvar** a mesma chave | ❌ toast genérico "Não foi possível processar a solicitação." |
| **Remover** chave | ✅ funcionava |
| **Status** | ✅ mostrava "Configurado (via variável de ambiente)" se `OPENAI_API_KEY` existisse |

O teste funcionava e o save falhava — a diferença está exatamente no caminho de código:
o **teste não grava nada**; o **save criptografa e grava**.

## 2. Causa raiz (confirmada no código)

Fluxo do SAVE (`src/app/api/admin/ia/route.ts` → `saveAIProvider` em
`src/lib/admin/ai-config.ts`):

```
saveAIProvider()
  └─ encryptToken(apiKey)          ← src/lib/crypto.ts
       └─ getKey()
            └─ lê process.env.TOKEN_ENCRYPTION_KEY
                 ├─ ausente  → throw "TOKEN_ENCRYPTION_KEY não configurada (mín. 32 caracteres)"
                 └─ < 32    → throw (mesmo erro)
```

O `throw` cai no `catch` genérico da rota, que devolve:

```json
{ "error": "Não foi possível processar a solicitação." }
```

Ou seja: **a variável `TOKEN_ENCRYPTION_KEY` não estava configurada (ou tinha menos de
32 caracteres) no ambiente em que o `/admin/ia` estava rodando.** O teste não passa por
`encryptToken`, por isso "funcionava".

### Nome exato da variável

- **Nome (código):** `TOKEN_ENCRYPTION_KEY`
- **Lida em:** `src/lib/crypto.ts` (`getKey()`)
- **Documentada em:** `.env.example` (linha 67)
- **Requisito:** string de **no mínimo 32 caracteres** (256 bits para AES-256-GCM)
- **Uso:** derivar a chave AES que criptografa/descriptografa credenciais de IA
  (formato persistido: `<iv>.<tag>.<ciphertext>`)

> ⚠️ Se a DONA configurou no Vercel um nome diferente (ex.: `ENCRYPTION_KEY`,
> `TOKEN_ENCRYPTION_KEY_VALUE`), o código **não** reconhece. O nome oficial é
> **`TOKEN_ENCRYPTION_KEY`**.

## 3. Correção aplicada (código)

1. **`src/app/api/admin/ia/route.ts`** — pré-checagem no SAVE:
   - `encryptionReady()` → `(process.env.TOKEN_ENCRYPTION_KEY ?? "").trim().length >= 32`
   - se falsa, devolve **HTTP 400** com mensagem acionável:
     > "Não foi possível salvar: a variável TOKEN_ENCRYPTION_KEY não está configurada no
     > servidor (mín. 32 caracteres). O teste funciona porque ele não grava nada."
   - **nunca revela a chave** — apenas o nome da variável e o requisito.

2. **`src/app/api/admin/ia/status/route.ts`** — adicionado `encryptionReady` (booleano)
   ao GET, para o painel saber antecipadamente se o SAVE é possível.

3. **`src/components/admin/admin-ai-client.tsx`** — quando `encryptionReady === false`,
   o painel exibe aviso destacado explicando que salvar exige `TOKEN_ENCRYPTION_KEY` no
   servidor e que o teste não grava. O aviso some ao clicar em "Atualizar status" após a
   DONA configurar a variável.

## 4. Comportamento esperado pós-correção

| Cenário | Resultado |
|---|---|
| `TOKEN_ENCRYPTION_KEY` ausente/curta + clicar Salvar | Toast claro explicando a variável e o mínimo de 32 chars (400) — **sem 500 genérico** |
| `TOKEN_ENCRYPTION_KEY` ausente/curta | Painel mostra aviso "Salvar chave indisponível" (via status) |
| `TOKEN_ENCRYPTION_KEY` OK (≥32) + chave OpenAI válida | Salvar funciona: chave criptografada (AES-256-GCM), `SystemSetting` gravado |
| Testar chave | Inalterado — continua sem gravar |

## 5. O que a DONA faz no Vercel

1. Projeto → **Settings → Environment Variables**.
2. Criar/adicionar:
   - **Key:** `TOKEN_ENCRYPTION_KEY`
   - **Value:** string aleatória com **pelo menos 32 caracteres** (ex.: 64 chars hex).
     Gere com: `openssl rand -hex 32`
3. Aplicar à **Production** (e Preview/Development se quiser testar o save fora de prod).
4. Redeployar (ou aguardar o próximo deploy) para a variável entrar em vigor.
5. Abrir `/admin/ia` → "Atualizar status" → o aviso deve sumir → **Salvar** a chave
   OpenAI.

> ⚠️ Se o SAVE ainda falhar depois disso, verificar: (a) nome exato da variável (sem
> espaços no final), (b) valor com ≥32 caracteres, (c) deploy aplicado na Environment
> correta (Production). O teste continua sendo o único caminho que não grava.

## 6. Segurança

- A chave OpenAI **nunca** é exibida completa — apenas sufixo mascarado
  (`sk-••••••••••••abcd`).
- `TOKEN_ENCRYPTION_KEY` nunca é revelada em logs, respostas ou frontend (só o booleano
  `encryptionReady`).
- O admin único (`lp070087@gmail.com`, conta ativa) é o único capaz de chegar a
  `/admin/ia` e `POST /api/admin/ia` — `requireAdminSession` +
  `isOfficialAdminEmail`; `role === "ADMIN"` sozinho não concede nada.

## 7. Arquivos alterados

- `src/app/api/admin/ia/route.ts`
- `src/app/api/admin/ia/status/route.ts`
- `src/components/admin/admin-ai-client.tsx`

## 8. Validação

- `npx tsc --noEmit` → EXIT 0.
- Suítes: billing 31/31 · first-access 39/39 · publishing 25/25 · growth 28/28.
