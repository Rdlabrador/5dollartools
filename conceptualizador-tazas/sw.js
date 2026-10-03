// Offline support: the app shell is cached so it opens without internet.
// Network first (so updates arrive as soon as you're online), cache as fallback.
// Bump VERSION when publishing big changes to drop old caches.
const VERSION = 'mymugs-v2';
importScripts('fonts.js');   // self.FUENTES: the typefaces shipped with the app
const FILES = [
  './', './index.html', './fonts.js', './lib/three.min.js', './manifest.webmanifest',
  '../comun/suite.css', '../comun/suite.js',
  './icons/icon-192.png', './icons/icon-512.png',
  ...(self.FUENTES || []).map(f => './fonts/' + f.a),
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('mymugs-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
