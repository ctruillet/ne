const CACHE_NAME = 'ne-massifs-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './camps.json',
  './regles.json',
  './historique.json',
  './manifest.json'
];

// Installation : Mise en cache des fichiers
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Stratégie Réseau d'abord : utilise le réseau pour avoir le dernier JSON, sinon se rabat sur le cache hors-ligne
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});