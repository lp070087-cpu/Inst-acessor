/* ============================================================
   INST ACESSOR — SERVICE WORKER
   ------------------------------------------------------------
   Política de cache DELIBERADAMENTE CONSERVADORA.

   O QUE É CACHEADO
     • apenas arquivos estáticos com hash/estáveis:
       ícones, manifest, fontes já baixadas pelo navegador.

   O QUE NUNCA É CACHEADO (vai SEMPRE para a rede)
     • /api/**            → dados do usuário, nunca versionados aqui
     • /api/auth/**       → sessão, cookies, handshake do NextAuth
     • /api/integrations/** → OAuth Instagram/TikTok, tokens, callbacks
     • qualquer requisição com credenciais, cookie de sessão,
       Authorization ou que não seja GET same-origin
     • documentos HTML (páginas) → sempre rede, para nunca servir
       uma tela autenticada desatualizada a partir do cache

   Sem cache de navegação. Sem "stale-while-revalidate" em HTML.
   Sem precache de rota. Isso é intencional: o objetivo do service
   worker aqui é apenas habilitar a instalação do PWA, não servir o
   aplicativo offline.

   Estratégia para estáticos conhecidos: cache-first com revalidação
   em segundo plano; para todo o resto, apenas passa direto.
   ============================================================ */

const CACHE = "ia-static-v1";

/** Somente esses caminhos podem entrar no cache. */
const STATIC_ALLOWLIST = /^\/(icons\/|manifest\.webmanifest$|favicon\.svg$)/;

/** Nada disso pode ser tocado pelo service worker. */
const NEVER_CACHE = /^\/api\//;

self.addEventListener("install", (event) => {
  // Ativa imediatamente a nova versão, sem esperar as abas antigas fecharem.
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          "/icons/icon-192.svg",
          "/icons/icon-512.svg",
          "/favicon.svg",
          "/manifest.webmanifest",
        ])
      )
      .catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove caches de versões anteriores — evita servir asset velho.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // 1) Só GET. POST/PUT/PATCH/DELETE sempre passam direto.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 2) Só same-origin. Terceiros (Meta, TikTok, Asaas, fontes) passam direto.
  if (url.origin !== self.location.origin) return;

  // 3) APIs: NUNCA. Nem leitura.
  if (NEVER_CACHE.test(url.pathname)) return;

  // 4) Navegação (documento HTML): sempre rede, sem cache.
  if (request.mode === "navigate" || request.destination === "document") return;

  // 5) Requisições com credenciais/cookies: sempre rede — nunca armazenar
  //    resposta que possa depender da sessão do usuário.
  if (request.credentials === "include") return;

  // 6) Fora da allowlist de estáticos: passa direto.
  if (!STATIC_ALLOWLIST.test(url.pathname)) return;

  // 7) Estático permitido: cache-first + revalidação em segundo plano.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === "basic") {
            cache.put(request, response.clone()).catch(() => undefined);
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })()
  );
});

/**
 * Nenhum handler de "push" ou "sync" é registrado de propósito:
 * sem notificações e sem sincronização em segundo plano nesta versão.
 */
