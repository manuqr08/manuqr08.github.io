// Generado por build.mjs: no editar a mano.
// Service worker: permite usar la web sin conexión e instalarla en el móvil.
const VERSION = "24c148b40c72";
const BASE = "canuto-base-" + VERSION;
const EXTRA = "canuto-extra";   // fotos grandes y tipografías, al verlas
const TESELAS = "canuto-mapa";  // teselas del mapa ya vistas
const MAX_TESELAS = 300;
const PRECACHE = ["./","index.html","en.html","styles.css","app.js","reservas.js","reservas-validacion.js","vendor/leaflet/leaflet.js","vendor/leaflet/leaflet.css","manifest.json","favicon-32.png","favicon-180.png","icon-192.png","icon-512.png","img/logo.png","img/logo-claro.png","img/marca-clara.png","img/agua-turquesa-800.jpg","img/banos-boveda-800.jpg","img/barranco-800.jpg","img/cueva-800.jpg","img/edificio-camino-800.jpg","img/paredes-karsticas-800.jpg","img/poza-800.jpg","img/prado-farallon-800.jpg","img/sendero-canuto-800.jpg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(BASE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("canuto-base-") && k !== BASE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function recortar(nombre, max) {
  const c = await caches.open(nombre);
  const ks = await c.keys();
  for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]);
}

async function guardar(nombre, req, res) {
  if (res && (res.ok || res.type === "opaque")) {
    const c = await caches.open(nombre);
    await c.put(req, res.clone());
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Páginas: primero la red (contenido al día) y, sin conexión, la copia guardada.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => guardar(BASE, req, res))
        .catch(async () => (await caches.match(req, { ignoreSearch: true })) || caches.match(url.pathname.endsWith("en.html") ? "en.html" : "index.html"))
    );
    return;
  }

  // Teselas del mapa: primero la caché.
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => guardar(TESELAS, req, res).then((r) => (recortar(TESELAS, MAX_TESELAS), r))))
    );
    return;
  }

  // Tipografías de Google: caché y actualización en segundo plano.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.match(req).then((hit) => {
        const red = fetch(req).then((res) => guardar(EXTRA, req, res)).catch(() => hit);
        return hit || red;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Archivos propios: caché y actualización en segundo plano. Si una foto grande
  // no está guardada y no hay red, se sirve su versión de 800 px.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const red = fetch(req)
        .then((res) => guardar(hit ? BASE : EXTRA, req, res))
        .catch(async () => {
          if (hit) return hit;
          if (/\.jpg$/.test(url.pathname) && !/-800\.jpg$/.test(url.pathname)) {
            const peq = await caches.match(url.pathname.replace(/\.jpg$/, "-800.jpg"));
            if (peq) return peq;
          }
          return Response.error();
        });
      return hit || red;
    })
  );
});
