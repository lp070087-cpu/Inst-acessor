/* Inst Acessor — Service Worker (PWA)
 * Estratégia network-first com fallback de cache para navegação e assets estáticos.
 * Nunca intercepta requisições autenticadas (cookies), POST, ou /api/* — o app
 * permanece 100% funcional com sessão, sem risco de servir dados de outro usuário.
 */
const VERSION = "v1";
const STATIC_CACHE = `instacessor-${VERSION}`;
const PRECACHE_ASSETS = [
  "/",
  "/icon-192.png",
  "/icon-512.png",
  "/maskable-512.png",
  "/apple-touch-icon.png",
  "/favicon.svg",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("instacessor-") && k !== STATIC_CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Só intercepta requisições GET do mesmo origin (https).
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Nunca intercepta API, webhooks ou auth — mantém sessão/estado intactos.
  if (url.pathname.startsWith("/api/")) return;

  // Navegações (documentos HTML): network-first com fallback ao cache da raiz.
  // Só atualiza o cache da raiz "/" quando a navegação é de fato a landing pública —
  // páginas autenticadas (/dashboard, /login, etc.) nunca são gravadas no cache.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic" && url.pathname === "/") {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put("/", clone));
          }
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Assets estáticos (/icon, /favicon, /_next/static): stale-while-revalidate.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname.endsWith(".png") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok && res.type === "basic") {
              const clone = res.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(req, clone));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }
});
