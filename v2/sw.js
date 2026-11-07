/* Service worker : met toute l'application en cache pour fonctionner sans réseau */
var VERSION = 'renovexpress-v2-recette-complete-1';
var FILES = [
  './', 'index.html', 'forms.css', 'home-search.css', 'config.js', 'brand.config.json', 'branding.js', 'appearance.css', 'appearance.js', 'workflow.js', 'context-flow.js', 'context-progress.css', 'storage-tools.js', 'invoice.js', 'app.js', 'pdf-share.js', 'calc.js', 'pdf.js', 'data.js',
  'lib/jspdf.umd.min.js', 'lib/jspdf.plugin.autotable.min.js',
  'fonts/montserrat-latin-400-normal.woff2', 'fonts/montserrat-latin-600-normal.woff2', 'fonts/montserrat-latin-700-normal.woff2',
  'logo.svg', 'logo-clair.svg', 'logo.png', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('renovexpress-v2-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (cached) {
    if (cached) return cached;
    return fetch(e.request).then(function (response) {
      if (response.ok) {
        var copy = response.clone();
        e.waitUntil(caches.open(VERSION).then(function (c) { return c.put(e.request, copy); }));
      }
      return response;
    }).catch(function () {
      // Ne jamais renvoyer index.html à la place d'un PDF, JS, CSS ou image.
      if (e.request.mode === 'navigate') return caches.match('index.html');
      return Response.error();
    });
  }));
});
