// Service worker minimale: mette in cache l'app shell così il gioco
// funziona sempre offline, anche alla primissima apertura senza rete
// dopo il primo caricamento andato a buon fine.
const CACHE_NAME = 'magic-tris-v2';
const APP_SHELL = [
  './index.html',
  './style.css',
  './game.js',
  './manifest.json',
  './simo-studio-intro.mp4',
  './vittoria.mp3',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
