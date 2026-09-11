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

Escopos solicitados pelo app (Instagram Business Login):

| Permissão | Uso no produto |
| --- | --- |
| `instagram_business_basic` | Ler perfil profissional (nome, seguidores, mídia, métricas de alcance/impressões) |
| `instagram_business_manage_comments` | Ler comentários das próprias publicações para análise de engajamento |
| `instagram_business_manage_messages` | Ler mensagens diretas recebidas na conta profissional |
| `instagram_business_manage_insights` | Ler métricas e insights da conta e por publicação |
| `instagram_business_content_publish` | Publicar conteúdo agendado na própria conta, a partir do módulo de Publicação |

> Os escopos padrão do código são exatamente os cinco acima
> (`src/lib/integrations/instagram/oauth.ts`). A variável `INSTAGRAM_SCOPES`
> permite sobrescrever a lista, mas só deve ser usada para reduzir/ajustar o conjunto
> aprovado no painel da Meta.

### Produtos da Meta usados

- **Instagram Business Login** (API do Instagram — `graph.instagram.com`) para perfis profissionais
  Business/Creator. O fluxo de autorização é `https://www.instagram.com/oauth/authorize`.
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
2. É redirecionado ao **Instagram Business Login** (`www.instagram.com/oauth/authorize`).
3. Entra com uma conta **profissional** (Business ou Creator). Não é necessário ter
   Página do Facebook nem vínculo com Portfólio Empresarial.
4. Autoriza as permissões solicitadas.
5. Retorna ao app; o Inst Acessor troca o código por um token de **longa duração**
   (~60 dias) e o armazena **criptografado** no servidor.
6. O usuário sincroniza as métricas e acompanha no dashboard.

### 3.3 Por que as permissões são necessárias

- `instagram_business_basic` — **obrigatória** para qualquer leitura de dados do perfil profissional
  (seguidores, mídia, alcance, impressões).
- `instagram_business_manage_insights` — métricas agregadas da conta e por publicação.
- `instagram_business_content_publish` — publicação de conteúdo agendado pelo próprio usuário.
- `instagram_business_manage_comments` — leitura de comentários das próprias publicações.
- `instagram_business_manage_messages` — leitura de mensagens diretas recebidas.

### 3.4 O que o app NÃO faz

- Não publica nada sem ação explícita do usuário no módulo de Publicação.
- Não comenta nem responde em nome do usuário.
- Não envia mensagens diretas.
- Não segue/dessegue contas.
- Não acessa dados de outros usuários.

## 4. Fluxo de dados

```
Instagram (API do Instagram — graph.instagram.com)
   │
   │  Instagram Business Login (OAuth 2.0)
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
2. Tela de autorização do Instagram Business Login.
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

- [ ] Caso de uso "Gerenciar mensagens e conteúdo no Instagram" selecionado no app.
- [ ] App **não** depende de Página do Facebook (Instagram Business Login).
- [ ] Os 5 escopos `instagram_business_*` adicionados no painel da Meta.
- [ ] App Secret apenas no servidor.
- [ ] Token criptografado no banco.
- [ ] Webhook do Instagram **desativado** até a aprovação (ou com URL válida + verificação).
- [ ] Página de privacidade publicada.
- [ ] Termos de serviço publicados.
- [ ] Capturas de tela reais.
- [ ] Conta de teste pronta (conta profissional Business/Creator).
- [ ] URL de callback configurada no painel:
      `https://unitrixapp.com.br/api/integrations/instagram/callback`
- [ ] A MESMA URL definida em `INSTAGRAM_REDIRECT_URI` na Vercel.
