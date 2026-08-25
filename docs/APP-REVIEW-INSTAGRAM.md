# Inst Acessor — App Review Meta (Instagram)

> Documento de submissão para a revisão de aplicativo (App Review) da **Meta for Developers**
> (Graph API do Instagram). Mantenha este arquivo atualizado.

---

## 1. Informações do aplicativo

| Campo | Valor |
| --- | --- |
| Nome do app | Inst Acessor |
| Plataforma | Web (SaaS) |
| URL de login | `https://<dominio>/login` |
| URL de callback | `https://<dominio>/api/integrations/instagram/callback` |
| URL de privacidade | `https://<dominio>/privacidade` |
| Termos de serviço | `https://<dominio>/termos` |
| Modelo de negócio | SaaS de análise e crescimento de perfis no Instagram e TikTok |

## 2. Permissões solicitadas

| Permissão | Uso no produto |
| --- | --- |
| `instagram_business_basic` | Ler perfil profissional (nome, seguidores, mídia, métricas de alcance/impressões) |
| `instagram_business_content_publish` | **Não usado.** O app não publica conteúdo no Instagram. |

> A API do Instagram **exige** `instagram_business_content_publish` para acesso de leitura a certas
> métricas em contas comerciais. O Inst Acessor **não publica** conteúdo — apenas lê métricas.

### Produtos da Meta usados

- **Instagram Graph API** (perfis profissionais Business/Creator).
- **Login da Meta** (OAuth 2.0) para autenticação da conexão.
- **Webhooks do Instagram** (preparado estruturalmente; processamento de eventos futuros).

## 3. Caso de uso

### 3.1 O que o produto faz

O Inst Acessor conecta o perfil profissional do usuário no Instagram e apresenta métricas de
crescimento em um dashboard:

- **Visão geral** — seguidores, engajamento, alcance, impressões, visitas ao perfil, publicações.
- **Evolução** — histórico 7/30/90 dias a partir de snapshots temporais.
- **Comparação de períodos** — crescimento semanal e mensal de seguidores.
- **Score Inteligente** — pontuação derivada apenas de dados reais.
- **Melhores momentos** — melhor dia de alcance, maior ganho diário, pico de seguidores.

### 3.2 Fluxo do usuário

1. O usuário clica em **"Conectar Instagram"** na página *Redes Sociais*.
2. É redirecionado ao fluxo OAuth oficial da Meta.
3. Conecta com uma conta **profissional** (Business ou Creator).
4. Autoriza as permissões de leitura de métricas.
5. Retorna ao app; o Inst Acessor armazena o token **criptografado** no servidor.
6. O usuário sincroniza as métricas e acompanha no dashboard.

### 3.3 Por que a permissão é necessária

- `instagram_business_basic` — **obrigatória** para qualquer leitura de dados do perfil profissional
  via Instagram Graph API (seguidores, mídia, alcance, impressões).

### 3.4 O que o app NÃO faz

- Não publica fotos, reels ou stories.
- Não comenta em publicações.
- Não envia mensagens diretas.
- Não segue/dessegue contas.
- Não acessa dados de outros usuários.
- Não lê mensagens diretas (DMs).

## 4. Fluxo de dados

```
Instagram (Graph API — Meta)
   │
   │  OAuth 2.0 (Login da Meta)
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
| App Secret | **Somente no servidor**. Nunca `NEXT_PUBLIC_*`. Nunca enviado ao frontend. |
| Access token | Criptografado com AES-256-GCM (`TOKEN_ENCRYPTION_KEY`). Nunca em texto puro. |
| Logs | Nenhum token ou secret é logado. |
| URLs finais | Nenhum token aparece na URL de retorno. |
| Acesso a dados | Toda consulta é limitada ao `userId` da sessão autenticada. |

## 5. Capturas de tela (sugeridas para submissão)

Ao submeter no painel da Meta, inclua:

1. Página **Redes Sociais** — botão "Conectar Instagram".
2. Tela de autorização do Login da Meta.
3. Dashboard com métricas reais do Instagram conectado.
4. Seção **Score Inteligente** e **Evolução**.
5. Fluxo de **desconexão** (botão "Desconectar").

> As capturas devem usar dados reais, com conta de teste do próprio desenvolvedor.
> Nunca envie capturas com dados fictícios para a revisão.

## 6. Conta de teste (sugestão)

Crie uma **conta profissional de teste** no Instagram (Business/Creator) para a equipe de revisão:

- E-mail de teste dedicado (ex.: `review@instacessor.com`).
- Perfil público com algumas publicações.
- Sem dados pessoais sensíveis no perfil.

## 7. Checklist antes de submeter

- [ ] App vinculado a uma página do Facebook (Business Verification).
- [ ] Permissão `instagram_business_basic` adicionada.
- [ ] App Secret apenas no servidor.
- [ ] Token criptografado no banco.
- [ ] Webhook do Instagram **desativado** até a aprovação (ou com URL válida + verificação).
- [ ] Página de privacidade publicada.
- [ ] Termos de serviço publicados.
- [ ] Capturas de tela reais.
- [ ] Conta de teste pronta.
- [ ] URL de callback configurada no painel.
