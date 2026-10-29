/* Service Worker — دفتر کهاته سلطان: پشتیبانی آفلاین */
const VERSION = 'khata-v2';
const CACHE = 'khata-cache-' + VERSION;
const LOCAL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-180.png',
  './offline-bot.js'
];
const CDN_FILES = [
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(LOCAL_FILES.map(async url => {
      try {
        const response = await fetch(new Request(url, {cache: 'reload'}));
        if (response && response.ok) await cache.put(url, response);
      } catch (_) {}
    }));
    // Firebase scripts are cached while online so the app can open offline later.
    await Promise.all(CDN_FILES.map(async url => {
      try {
        const response = await fetch(url, {mode: 'no-cors', cache: 'reload'});
        if (response) await cache.put(url, response);
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('khata-cache-') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Firebase CDN scripts: use the cached copy if internet is unavailable.
  if (CDN_FILES.includes(request.url)) {
    event.respondWith((async () => {
      const cached = await caches.match(request.url);
      if (cached) {
        fetch(request).then(async response => {
          if (response) {
            const cache = await caches.open(CACHE);
            await cache.put(request.url, response.clone());
          }
        }).catch(() => {});
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response) (await caches.open(CACHE)).put(request.url, response.clone());
        return response;
      } catch (_) {
        return new Response('', {status: 503, statusText: 'Offline'});
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match('./index.html')) ||
               (await caches.match('./')) ||
               new Response('برای استفادهٔ آفلاین، برنامه را یک‌بار با اینترنت باز کنید.', {
                 status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}
               });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request, {ignoreSearch: true});
    if (cached) {
      fetch(request).then(response => {
        if (response && response.ok) cache.put(request, response.clone());
      }).catch(() => {});
      return cached;
    }
    try {
      const response = await fetch(request);
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    } catch (_) {
      return new Response('', {status: 504});
    }
  })());
});
