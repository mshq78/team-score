/* Teamkeshi service worker — makes the app open without a connection.
 * - Pages: network first (fresh version when online), cached copy when offline.
 * - Hashed build assets and fonts: cache first.
 * - /api/* is never cached (the sync engine handles offline itself).
 */
const CACHE = 'teamkeshi-v1';

async function precache() {
  const cache = await caches.open(CACHE);
  const res = await fetch('/index.html', { cache: 'no-store' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await cache.put('/index.html', res);

  const assets = new Set(['/manifest.webmanifest', '/icon.svg']);
  for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) assets.add(m[1]);

  // Fonts are referenced from the CSS bundle
  for (const url of [...assets].filter((u) => u.endsWith('.css'))) {
    try {
      const css = await (await fetch(url)).text();
      for (const m of css.matchAll(/url\((?:\.\/|\/assets\/)?([^)"']+\.woff2)\)/g)) {
        assets.add('/assets/' + m[1].split('/').pop());
      }
    } catch {
      // best effort
    }
  }
  await Promise.all(
    [...assets].map((url) => cache.add(url).catch(() => undefined))
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const fresh = await Promise.race([fetch(req), timeout(4000)]);
          if (fresh.ok) cache.put('/index.html', fresh.clone());
          return fresh;
        } catch {
          return (await cache.match('/index.html')) || Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return Response.error();
      }
    })()
  );
});
