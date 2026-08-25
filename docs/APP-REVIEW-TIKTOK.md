# Inst Acessor — App Review TikTok

> Documento de submissão para a revisão de aplicativo (App Review) do **TikTok for Developers**.
> Mantenha este arquivo atualizado sempre que alterar escopos ou fluxos de dados.

---

## 1. Informações do aplicativo

| Campo | Valor |
| --- | --- |
| Nome do app | Inst Acessor |
| Plataforma | Web (SaaS) |
| URL de login | `https://<dominio>/login` |
| URL de callback | `https://<dominio>/api/integrations/tiktok/callback` |
| URL de privacidade | `https://<dominio>/privacidade` |
| Termos de serviço | `https://<dominio>/termos` |
| Modelo de negócio | SaaS de análise e crescimento de perfis no Instagram e TikTok |

## 2. Escopos solicitados

| Escopo | O que permite | Uso no produto |
| --- | --- | --- |
| `user.info.basic` | Ler dados básicos do perfil (nome, avatar, bio, contagens de seguidores/seguindo/likes/vídeos) | Dashboard de métricas: exibe seguidores, seguindo, curtidas e vídeos |
| `video.list` | Listar vídeos publicados com métricas de engajamento (curtidas, comentários, compartilhamentos, views) | Seção de evolução e análise de conteúdo |

**Nenhum escopo de publicação (`video.publish`, `video.upload`, `comment`) é solicitado.**
O Inst Acessor **não publica** conteúdo, **não comenta** e **não interage** com contas de terceiros.

## 3. Caso de uso

### 3.1 O que o produto faz

O Inst Acessor conecta o perfil profissional do usuário ao TikTok e apresenta métricas de
crescimento em um dashboard:

- **Visão geral** — seguidores, seguindo, curtidas e vídeos atuais.
- **Evolução** — histórico 7/30/90 dias a partir de snapshots temporais.
- **Comparação de períodos** — crescimento semanal e mensal de seguidores.
- **Melhores momentos** — pico de seguidores, maior ganho diário, maior queda diária.

### 3.2 Fluxo do usuário

1. O usuário clica em **"Conectar TikTok"** na página *Redes Sociais*.
2. É redirecionado ao fluxo OAuth oficial do TikTok (com PKCE).
3. Autoriza os escopos `user.info.basic` e `video.list`.
4. Retorna ao app; o Inst Acessor armazena o token **criptografado** no servidor.
5. O usuário sincroniza as métricas (manual ou automaticamente) e acompanha no dashboard.

### 3.3 Por que cada escopo é necessário

- `user.info.basic` — **obrigatório** para identificar o perfil e exibir as contagens
  de seguidores/seguindo/curtidas/vídeos. Sem ele o dashboard não tem dados.
- `video.list` — **necessário** para a seção de evolução de conteúdo: entendemos que
  crescimento não é só seguidores, mas também engajamento nos vídeos publicados.

### 3.4 O que o app NÃO faz

- Não publica vídeos nem fotos.
- Não comenta em vídeos.
- Não envia mensagens.
- Não segue/dessegue contas.
- Não acessa dados de outros usuários.
- Não lê mensagens diretas (DMs).

## 4. Fluxo de dados

```
TikTok (Graph API)
   │
   │  OAuth 2.0 + PKCE
   ▼
Inst Acessor (servidor)
   │
   ├── Token criptografado (AES-256-GCM)  → banco (Neon)
   ├── Métricas normalizadas              → banco (snapshots)
   │
   ▼
Dashboard (somente leitura, dados do próprio usuário)
```

### 4.1 Segurança de credenciais

| Item | Garantia |
| --- | --- |
| Client Secret | **Somente no servidor**. Nunca `NEXT_PUBLIC_*`. Nunca enviado ao frontend. |
| Access/Refresh token | Criptografados com AES-256-GCM (`TOKEN_ENCRYPTION_KEY`). Nunca em texto puro. |
| Logs | Nenhum token ou secret é logado. |
| URLs finais | Nenhum token aparece na URL de retorno. |
| Acesso a dados | Toda consulta é limitada ao `userId` da sessão autenticada. |

## 5. Capturas de tela (sugeridas para submissão)

Ao submeter no portal do TikTok, inclua:

1. Página **Redes Sociais** — botão "Conectar TikTok".
2. Tela de autorização OAuth do TikTok (antes de conceder).
3. Dashboard com métricas reais do TikTok conectado.
4. Seção **Evolução** com o gráfico de 7/30/90 dias.
5. Fluxo de **desconexão** (botão "Desconectar").

> As capturas devem ser de dados reais, com conta de teste do próprio desenvolvedor.
> Nunca envie capturas com dados fictícios para a revisão.

## 6. Conta de teste (sugestão)

Crie uma **conta de teste** no TikTok para a equipe de revisão:

- E-mail de teste dedicado (ex.: `review@instacessor.com`).
- Perfil com pelo menos 1–3 vídeos públicos.
- Sem dados pessoais sensíveis no perfil.

## 7. Checklist antes de submeter

- [ ] Escopos limitados a `user.info.basic` + `video.list`.
- [ ] Client Secret apenas no servidor.
- [ ] Token criptografado no banco.
- [ ] Webhook do TikTok **desativado** até a aprovação (ou com URL válida + verificação).
- [ ] Página de privacidade publicada.
- [ ] Termos de serviço publicados.
- [ ] Capturas de tela reais.
- [ ] Conta de teste pronta.
- [ ] URL de callback configurada no portal.
