// ══════════════════════════════════════════════════════════════
//  SCUDO CONTROL — Service Worker
//  Estratégia: Cache-first para assets, Network-first para HTML
// ══════════════════════════════════════════════════════════════

const CACHE_NAME  = "scudo-control-v1";
const ASSETS_CACHE = "scudo-assets-v1";

// Arquivos que devem ser cacheados imediatamente na instalação
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/firebase-config.js",
  "./assets/db.js",
  "./assets/app.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  // Google Fonts (opcional — pode falhar offline, tudo bem)
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
];

// ── INSTALL ─────────────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Tenta cachear tudo, ignora falhas individuais
      return Promise.allSettled(
        PRECACHE.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== ASSETS_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Requisições ao Firebase / APIs externas → sempre network
  if (
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("accounts.google.com") ||
    url.hostname.includes("gstatic.com")
  ) {
    return; // deixa o browser resolver normalmente
  }

  // index.html → Network-first (garante versão mais recente)
  if (url.pathname === "/" || url.pathname.endsWith("index.html")) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Assets JS/CSS/imagens → Cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === "opaque") return response;
        const clone = response.clone();
        caches.open(ASSETS_CACHE).then(cache => cache.put(request, clone));
        return response;
      });
    })
  );
});
