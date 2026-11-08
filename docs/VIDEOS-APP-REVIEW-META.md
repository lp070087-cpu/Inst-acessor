# Vídeos para o App Review da Meta (Instagram)

Complementa `docs/APP-REVIEW-INSTAGRAM.md`. Um vídeo (screencast) por permissão
pedida, gravado no app em produção (`https://unitrixapp.com.br`) com a conta de
teste profissional — nunca com dados fictícios.

## Formato técnico

A Meta não publica proporção ou resolução obrigatória para screencasts de App
Review (as specs de 9:16 / 4 GB que aparecem em buscas são de **anúncios e
Reels**, não valem aqui). Padrão recomendado e aceito na prática:

| Item | Recomendação |
| --- | --- |
| Proporção | **16:9 horizontal** (gravação de tela do navegador no desktop) |
| Resolução | **1920×1080** (mínimo 1280×720); texto da tela precisa ser legível |
| Formato | **MP4 (H.264)** — MOV também é aceito |
| Tamanho | Manter cada arquivo **abaixo de ~100 MB** (uploads grandes falham no painel) |
| Duração | 1 a 4 minutos por permissão; sem cortes que escondam etapas |
| Áudio | Opcional/desnecessário; não colocar música |
| Idioma | **Interface em inglês** ou **legendas/anotações em inglês** em cada passo (exigência da Meta) |
| Cursor | Visível; destacar cliques importantes |

## O que todo vídeo deve mostrar

1. Login no Inst Acessor (tela inicial → `/login`).
2. Clique em **Conectar Instagram** → tela oficial do Instagram Business Login
   com a lista de permissões → aprovação → retorno ao app.
3. Uso real, ponta a ponta, da permissão que o vídeo justifica.
4. Onde o dado aparece para o usuário (nunca só uma chamada “invisível”).

## Roteiro por permissão

| Vídeo | Permissão | Cenas obrigatórias |
| --- | --- | --- |
| 1 | `instagram_business_basic` | Conectar → perfil (nome, foto, seguidores) e lista de publicações carregados |
| 2 | `instagram_business_manage_insights` | Dashboard com métricas reais; abrir **Insights da publicação** |
| 3 | `instagram_business_manage_comments` | Comentar na conta de teste pelo celular → comentário aparece em **Respostas Inteligentes** → aprovar resposta → mostrar a resposta publicada no Instagram |
| 4 | `instagram_business_content_publish` | Montar post na **Central de Publicação** → confirmar → post aparecendo no perfil do Instagram |
| 5 | `instagram_business_manage_messages` | Enviar DM para a conta de teste de outra conta → mensagem chega no app → responder pelo app → resposta visível no Direct do Instagram (dentro da janela de 24 h) |

Encerrar pelo menos um vídeo com **Desconectar** a conta.

## Pré-requisitos antes de gravar

- Deploy com as correções da branch `fix/instagram-api-2026` em produção.
- Vercel: `INSTAGRAM_GRAPH_VERSION=v26.0` e `INSTAGRAM_WEBHOOK_AUTOSUBSCRIBE=true`.
- URL de webhook conferida no painel da Meta e conta de teste reconectada.
- Conta de teste adicionada como **testadora** do app no painel da Meta.
- Interface do app em inglês ou legendas em inglês preparadas.
