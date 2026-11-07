/* ===========================================================
   MotoLog — service worker
   Strategi:
   - App shell di-precache saat install (offline-ready).
   - Navigasi: network-first, fallback ke index.html offline.
   - Aset lain (same-origin GET): stale-while-revalidate.
   =========================================================== */
'use strict';

const CACHE_VERSION = 'motolog-v1.0.2';
const CACHE_NAME = CACHE_VERSION;
const INDEX_URL = new URL('./index.html', self.location).href;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/style.css',
  './assets/core.js',
  './assets/ui.js',
  './assets/sheets.js',
  './assets/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
].map((url) => new URL(url, self.location).href);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigasi halaman: coba jaringan dulu agar update cepat, fallback offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(INDEX_URL, copy));
          }
          return response;
        })
        .catch(() => caches.match(INDEX_URL).then((cached) => cached || caches.match(new URL('./', self.location).href)))
    );
    return;
  }

  // Aset statis: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || Response.error());
      return cached || network;
    })
  );
});
