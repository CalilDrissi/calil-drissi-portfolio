// Minimal root service worker. Its only job is to make the homepage qualify as
// an installable PWA — Chrome fires `beforeinstallprompt` only when a service
// worker with a fetch handler controls the page. Network passthrough otherwise.
// (The arcade's own /arcade/sw.js keeps its narrower scope and still wins there.)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* passthrough — presence of the handler is what matters */ });
