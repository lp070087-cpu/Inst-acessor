# Relatório — Páginas Legais Públicas (Meta App Review)

**Data:** 1º de setembro de 2026
**Escopo:** Implementação das 3 páginas legais públicas ausentes, acessíveis sem login, compatíveis com a revisão da Meta.
**Domínio oficial:** `https://inst-acessor.vercel.app`

---

## 1. Objetivo

A auditoria anterior confirmou que o projeto **não possuía** páginas públicas de Política de Privacidade, Termos de Uso e instruções de exclusão de dados. Este trabalho **implementou** as 3 páginas reais, públicas e sem login, com URLs prontas para os campos exigidos pela Meta (Privacy Policy URL, Terms of Service URL, Data Deletion Instructions URL).

---

## 2. Arquivos criados

| Arquivo | Função |
|---|---|
| `src/app/privacidade/page.tsx` | Política de Privacidade (rota `/privacidade`) |
| `src/app/termos/page.tsx` | Termos de Uso (rota `/termos`) |
| `src/app/data-deletion/page.tsx` | Instruções de exclusão de dados (rota `/data-deletion`) |
| `src/app/legal.css` | Stylesheet próprio das páginas legais (identidade aprovada, `legal-` scoped) |
| `src/components/legal/legal-shell.tsx` | Shell server-component compartilhado (topbar, hero, rodapé institucional) |
| `docs/RELATORIO-PAGINAS-LEGAIS-META.md` | Este relatório |

### Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/components/landing/sections-d.tsx` | Rodapé da landing: links legais de `#` → rotas reais |

Antes:

```ts
{ t: "Legal", links: [["Segurança", "#seguranca"], ["Termos de uso", "#"], ["Privacidade", "#"]] },
```

Depois:

```ts
{ t: "Legal", links: [["Segurança", "#seguranca"], ["Termos de uso", "/termos"], ["Privacidade", "/privacidade"], ["Exclusão de dados", "/data-deletion"]] },
```

Nenhum texto comercial, ordem de seções ou design aprovado da landing foi alterado — apenas os `href` dos links legais.

---

## 3. URLs públicas finais

| Página | URL | Campo Meta correspondente |
|---|---|---|
| Política de Privacidade | `https://inst-acessor.vercel.app/privacidade` | **Privacy Policy URL** |
| Termos de Uso | `https://inst-acessor.vercel.app/termos` | **Terms of Service URL** |
| Exclusão de dados | `https://inst-acessor.vercel.app/data-deletion` | **Data Deletion Instructions URL** |

As 3 rotas estão **fora** do matcher do middleware (`src/middleware.ts`) — conferido item a item. Nenhuma exige login.

---

## 4. Conteúdo de cada página

### 4.1 Política de Privacidade (`/privacidade`) — 14 seções

Cobre: visão geral; dados coletados (cadastro, sessão, integrações sociais, tokens criptografados, conteúdo do usuário, pagamento, dados técnicos); finalidades de uso; integrações Instagram/TikTok (OAuth, revogação, comentários/DM só com permissão); **IA** (provedores externos, o que é enviado, sem treinamento com dados do usuário); compartilhamento com terceiros (tabela: Vercel/Neon, Meta/TikTok, InfinitePay/Asaas, provedores de IA); armazenamento e retenção; segurança (senha hash, tokens AES-256-GCM, TLS, menor privilégio); cookies e sessão; direitos LGPD; revogação de permissões; exclusão de dados (aponta para `/data-deletion`); alterações; contato.

**Sem inventar:** não há CNPJ, endereço, certificações, selos ou garantias jurídicas inexistentes. O e-mail de contato usado é o único real do projeto (`lp070087@gmail.com`), com nota honesta de que deve ser substituído se houver canal oficial de privacidade.

### 4.2 Termos de Uso (`/termos`) — 17 seções

Aceitação; descrição do serviço; contas e credenciais; conexão Instagram/TikTok (APIs oficiais, OAuth, responsabilidade do usuário, não afiliação); permissões; conteúdo do usuário; **IA e recomendações** (informativo, sem garantia de resultado, revisão pré-publicação); **publicação e agendamento** (responsabilidade do usuário, limites das APIs, sem garantia de envio); responsabilidades; disponibilidade; planos e pagamentos (InfinitePay/Asaas, sem armazenamento de cartão); cancelamento e acesso; uso aceitável e proibições; propriedade intelectual; limitação de responsabilidade; alterações; contato.

### 4.3 Exclusão de dados (`/data-deletion`) — 6 seções

O que a página cobre (adequada ao campo Data Deletion Instructions URL); **como solicitar** (e-mail `lp070087@gmail.com`, assunto "Exclusão de dados", confirmação de titularidade, confirmação de conclusão); o que é excluído; **diferença entre desconectar Instagram/TikTok e apagar conta/dados**; o que acontece após o pedido (prazo LGPD até 30 dias, revogação de tokens, confirmação); contato + CTA de solicitação.

**Honestidade exigida pela Meta:** a página declara explicitamente que **não existe** formulário automático nem endpoint de autodeleção no aplicativo hoje, e que o processo real é feito por **contato direto** (e-mail). Ela será atualizada quando um fluxo automático for implementado. **Não** foi afirmado nenhum sistema que não existe.

---

## 5. Identidade visual

- Reutiliza os tokens aprovados do projeto (paleta `--bg/#f7f8fa`, `--ink`, `--purple #8b5cf6`, `--magenta #f43f8e`, gradiente de marca `#f43f8e→#a855f7→#6366f1`, fontes Sora/Plus Jakarta/Space Grotesk) via CSS variables com fallback.
- `legal.css` é **scoped** (classes `legal-*`), sem tocar em `globals.css` nem `landing.css`.
- Shell reutiliza o `LogoMark` já exportado de `src/components/landing/sections-a.tsx`.
- Responsivo (breakpoint 720px), respeita `prefers-reduced-motion`, sem sobrecarga de cards, sem aparência genérica de IA.

---

## 6. SEO

Cada página exporta `metadata` com `title`, `description` e `canonical` apontando para a URL pública oficial:
- `/privacidade` → `https://inst-acessor.vercel.app/privacidade`
- `/termos` → `https://inst-acessor.vercel.app/termos`
- `/data-deletion` → `https://inst-acessor.vercel.app/data-deletion`

---

## 7. Acesso público (middleware)

`src/middleware.ts` protege apenas as rotas listadas no matcher (`/dashboard`, `/ia-acessor`, `/publishing`, `/admin`, `/api/admin/*`, etc.). **Conferido:** `/privacidade`, `/termos` e `/data-deletion` **não** aparecem no matcher → são públicas e acessíveis sem login.

---

## 8. Validação técnica

| Etapa | Resultado |
|---|---|
| `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit` | **EXIT 0** (sem erros de tipo) |
| `npm run build` | **EXIT 1** — falha **somente** por `@next/swc-linux-x64-gnu` ausente no sandbox Linux (limitação de ambiente conhecida, **não** é erro de código). A DONA compila localmente no Windows. |
| Conferência de classes CSS usadas × `legal.css` | Todas as classes presentes (check automático, 0 ausentes) |
| Conferência de links legais no rodapé | `grep` confirma `/termos`, `/privacidade`, `/data-deletion` |

---

## 9. Pendências externas (para a DONA)

1. **Compilar localmente (Windows):** `npm run build` para confirmar o build completo (no sandbox Linux falha só no SWC).
2. **Substituir o e-mail de contato** (`lp070087@gmail.com`) por um canal oficial dedicado a privacidade, se existir, nas 3 páginas e no `LegalShell`.
3. **Cadastrar as URLs na Meta App Review:**
   - Privacy Policy URL → `https://inst-acessor.vercel.app/privacidade`
   - Terms of Service URL → `https://inst-acessor.vercel.app/termos`
   - Data Deletion Instructions URL → `https://inst-acessor.vercel.app/data-deletion`
4. **Quando houver fluxo automático de exclusão de dados**, atualizar `/data-deletion` (hoje o processo é manual por e-mail e isso é declarado na página).
5. **Commit/push/deploy** ficam a cargo da DONA (não executados por determinação do escopo).

---

## 10. NÃO foi feito (conforme escopo)

- Nenhuma alteração em banco de dados/Prisma/Neon.
- Nenhuma alteração em autenticação, integrações Meta/TikTok, billing, preços ou planos.
- Nenhuma alteração na landing além dos 3 links legais do rodapé.
- Nenhuma certificação, CNPJ, endereço ou dado empresarial inventado.
- Nenhuma afirmação de endpoint/sistema automático de exclusão que não exista.
- Nenhum commit, push ou deploy.
