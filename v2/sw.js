/* Service worker : met toute l'application en cache pour fonctionner sans réseau */
var VERSION = 'renovexpress-v2-local-billing-1';
var FILES = [
  './', 'index.html', 'forms.css', 'home-search.css', 'config.js', 'appearance.css', 'appearance.js', 'workflow.js', 'storage-tools.js', 'invoice.js', 'app.js', 'pdf-share.js', 'calc.js', 'pdf.js', 'data.js',
  'lib/jspdf.umd.min.js', 'lib/jspdf.plugin.autotable.min.js',
  'fonts/montserrat-latin-400-normal.woff2', 'fonts/montserrat-latin-600-normal.woff2', 'fonts/montserrat-latin-700-normal.woff2',
  'logo.svg', 'logo.png', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
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
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) {
    return r || fetch(e.request).then(function (resp) {
      if (resp.ok && new URL(e.request.url).origin === location.origin) {
        var copy = resp.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
      }
      return resp;
    }).catch(function () { return caches.match('index.html'); });
  }));
});
