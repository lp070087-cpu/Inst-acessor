# PASSKEY / BIOMETRIA (WebAuthn) — PENDÊNCIA CONTROLADA

> Status: **PENDÊNCIA CONTROLADA** · Nada falso é implementado · Senha continua sempre disponível

## Decisão (fiel à instrução do projeto)

A instrução exige:

> **Passkey/Face ID**: implementar APENAS via WebAuthn, **nunca fingir biometria**.
> Se for complexo demais → preparar models/arquitetura + documentar como **pendência controlada**.
> **Passkey é opcional; senha é sempre o fallback obrigatório.**

Como WebAuthn exige configuração externa de produção (HTTPS com origin estável, RP ID,
attestation) e libs de validação (`@simplewebauthn/server`), esta fase **não** ativa o
fluxo no cliente. Fica tudo preparado no schema e na camada de serviço, com resposta
honesta de "não habilitado".

## O que já está pronto

1. **Model `PasskeyCredential`** no `prisma/schema.prisma` e no shim de tipos
   (`src/types/prisma-shim.d.ts`) — pronto para persistir credenciais WebAuthn
   (credentialID, publicKey, counter, transports, userId, deviceName, createdAt).

2. **Camada de serviço honesta** `src/lib/webauthn/index.ts`:
   - `getPasskeyStatus()` → sempre `{ enabled: false, reason }`;
   - `startPasskeyRegistration()` → erro honesto, **não** gera challenge falso;
   - `verifyPasskeyAssertion()` → erro honesto, **nunca** aceita credencial falsa.

3. **Senha é sempre o caminho funcional** — o fluxo de primeiro acesso/login usa
   bcrypt (12 salt rounds) e não depende de passkey em hipótese alguma.

## O que falta para PRODUÇÃO (configuração externa + código real)

- [ ] Domínio **HTTPS estável** definido (origin/`RP ID`) no ambiente de produção.
- [ ] Adicionar `@simplewebauthn/server` (ou lib equivalente) no backend.
- [ ] Servidor de **challenge** (registro/autenticação) com TTL + uso único.
- [ ] Validação de **attestation/assertion** e verificação de contramedida (`counter`).
- [ ] Endpoints `/api/passkey/register` e `/api/passkey/authenticate`.
- [ ] Integração ao login (fallback: senha) e tela de gerenciamento de passkeys.
- [ ] Persistência em `PasskeyCredential` (vinculada ao `User`).

## Garantias

- Nenhuma credencial/registro WebAuthn falso é aceito.
- A UI **não exibe** "Face ID/Passkey ativo" enquanto `enabled === false`.
- A ativação do passkey **não** bloqueia o primeiro acesso nem o login por senha.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `prisma/schema.prisma` → `PasskeyCredential` | Model pronto |
| `src/types/prisma-shim.d.ts` | Tipos do model (sem `prisma generate` ainda) |
| `src/lib/webauthn/index.ts` | Serviço honesto (pendência controlada) |
| `docs/PASSKEY-PENDENCIA.md` | Este documento |
