// Le site a déménagé sur https://reseau-ensam-meknes.github.io/ : ce service worker remplace l'ancien,
// vide son cache, envoie les pages ouvertes vers la nouvelle adresse et se désinstalle.
const NOUVEAU = 'https://reseau-ensam-meknes.github.io/';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.clients.claim();
  for (const c of await self.clients.matchAll({ type: 'window' })) {
    try { const u = new URL(c.url); await c.navigate(NOUVEAU + u.search + u.hash); } catch { /* la page se redirigera en se rechargeant */ }
  }
  await self.registration.unregister();
})()));
