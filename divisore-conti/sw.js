/* Service worker: tiene l'app (e il lettore di scontrini) sul telefono per l'uso offline.
   Dopo ogni modifica ai file, cambia VERSION (es. conti-v2) così il telefono si aggiorna. */
var VERSION = 'conti-v1';
var SHELL = [
  './', 'index.html', 'style.css', 'core.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];
var OCR = [
  'vendor/tesseract/tesseract.min.js',
  'vendor/tesseract/worker.min.js',
  'vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  'vendor/tesseract/core/tesseract-core-lstm.wasm.js',
  'vendor/tesseract/lang/ita.traineddata.gz'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (cache) {
      return cache.addAll(SHELL).then(function () {
        // Il lettore pesa circa 9 MB: se un file non arriva, l'app parte lo stesso.
        return Promise.all(OCR.map(function (u) { return cache.add(u).catch(function () {}); }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  var pesante = req.url.indexOf('/vendor/') !== -1;

  e.respondWith(caches.open(VERSION).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (hit) {
      var rete = fetch(req).then(function (res) {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(function () { return null; });

      if (hit) {
        if (!pesante) rete.catch(function () {}); // aggiorna in silenzio per la prossima apertura
        return hit;
      }
      return rete.then(function (res) {
        if (res) return res;
        if (req.mode === 'navigate') return cache.match('index.html');
        return new Response('', { status: 504 });
      });
    });
  }));
});
