// Modo oscuro, visor de fotos, mapa y registro del service worker.
// Los textos llegan desde build.mjs en #datos-app y #datos-mapa.
(function () {
  "use strict";
  var datos = {};
  try { datos = JSON.parse(document.getElementById("datos-app").textContent); } catch (e) {}
  var raizHtml = document.documentElement;

  // --- Modo oscuro --------------------------------------------------------
  // Sin elección guardada se sigue la preferencia del sistema.
  var botonTema = document.querySelector("[data-tema]");
  var prefiereOscuro = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function temaActual() {
    return raizHtml.dataset.tema || (prefiereOscuro && prefiereOscuro.matches ? "oscuro" : "claro");
  }
  function pintarTema() {
    var oscuro = temaActual() === "oscuro";
    if (botonTema) botonTema.setAttribute("aria-pressed", String(oscuro));
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", oscuro ? "#0a110d" : "#101b15");
  }
  if (botonTema) {
    botonTema.hidden = false;
    botonTema.addEventListener("click", function () {
      var nuevo = temaActual() === "oscuro" ? "claro" : "oscuro";
      raizHtml.dataset.tema = nuevo;
      try { localStorage.setItem("tema", nuevo); } catch (e) {}
      pintarTema();
    });
    if (prefiereOscuro && prefiereOscuro.addEventListener) prefiereOscuro.addEventListener("change", pintarTema);
    pintarTema();
  }

  // --- Visor de fotos (galería) -------------------------------------------
  var visor = document.getElementById("visor");
  var enlaces = Array.prototype.slice.call(document.querySelectorAll("[data-lightbox]"));
  if (visor && typeof visor.showModal === "function" && enlaces.length) {
    var img = document.getElementById("visor-img");
    var pie = document.getElementById("visor-pie");
    var cuenta = document.getElementById("visor-cuenta");
    var actual = 0;
    var origen = null;

    var mostrar = function (i) {
      actual = (i + enlaces.length) % enlaces.length;
      var a = enlaces[actual];
      img.src = a.getAttribute("href");
      img.alt = a.dataset.alt || "";
      pie.textContent = a.dataset.pie || a.dataset.alt || "";
      cuenta.textContent = "(" + (actual + 1) + " " + (datos.de || "/") + " " + enlaces.length + ")";
    };
    var abrir = function (i) {
      origen = enlaces[i];
      mostrar(i);
      visor.showModal();
      visor.querySelector('[data-visor="cerrar"]').focus();
    };

    enlaces.forEach(function (a, i) {
      a.addEventListener("click", function (ev) {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button === 1) return;
        ev.preventDefault();
        abrir(i);
      });
    });
    visor.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-visor]");
      if (b) {
        var accion = b.dataset.visor;
        if (accion === "cerrar") visor.close();
        else mostrar(actual + (accion === "sig" ? 1 : -1));
      } else if (ev.target === visor) {
        visor.close(); // clic en el fondo
      }
    });
    visor.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowRight") { mostrar(actual + 1); ev.preventDefault(); }
      else if (ev.key === "ArrowLeft") { mostrar(actual - 1); ev.preventDefault(); }
    });
    // Deslizar en pantallas táctiles.
    var x0 = null;
    visor.addEventListener("touchstart", function (ev) { x0 = ev.touches[0].clientX; }, { passive: true });
    visor.addEventListener("touchend", function (ev) {
      if (x0 === null) return;
      var dx = ev.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) mostrar(actual + (dx < 0 ? 1 : -1));
      x0 = null;
    });
    visor.addEventListener("close", function () {
      img.src = "data:,";
      if (origen) origen.focus();
    });
  }

  // --- Mapa ----------------------------------------------------------------
  var lienzo = document.querySelector("[data-mapa]");
  var aviso = document.getElementById("mapa-aviso");
  var nodoMapa = document.getElementById("datos-mapa");
  if (lienzo && nodoMapa) {
    var cfg = JSON.parse(nodoMapa.textContent);
    var mapa = null;
    var marcadores = [];

    var crear = function () {
      if (mapa || !window.L) return;
      if (!navigator.onLine) { aviso.textContent = datos.offline || ""; aviso.hidden = false; return; }
      lienzo.hidden = false;
      aviso.hidden = true;
      mapa = L.map(lienzo, { scrollWheelZoom: false, tap: false }).setView(cfg.centro, cfg.zoom);
      lienzo.setAttribute("role", "region");
      lienzo.setAttribute("aria-label", cfg.region);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapa);
      var limites = [];
      cfg.puntos.forEach(function (p, i) {
        var icono = L.divIcon({
          className: "mapa-marca mp-" + p.tipo,
          html: "<span>" + (i + 1) + "</span>",
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -16],
        });
        var popup = document.createElement("div");
        var titulo = document.createElement("strong");
        titulo.textContent = p.nombre;
        var texto = document.createElement("p");
        texto.textContent = p.texto;
        popup.appendChild(titulo);
        popup.appendChild(texto);
        var m = L.marker([p.lat, p.lon], { icon: icono, title: p.nombre, alt: p.nombre, keyboard: true }).addTo(mapa).bindPopup(popup);
        marcadores.push(m);
        limites.push([p.lat, p.lon]);
      });
      mapa.fitBounds(limites, { padding: [48, 48], maxZoom: cfg.zoom });
      document.querySelectorAll("[data-mapa-punto]").forEach(function (b) {
        b.hidden = false;
        b.addEventListener("click", function () {
          var m = marcadores[Number(b.dataset.mapaPunto)];
          if (!m) return;
          lienzo.scrollIntoView({ behavior: "smooth", block: "center" });
          mapa.setView(m.getLatLng(), Math.max(mapa.getZoom(), 15));
          m.openPopup();
          var el = m.getElement();
          if (el) el.focus({ preventScroll: true });
        });
      });
    };

    // El mapa se crea al acercarse a la sección, para no cargar teselas antes de tiempo.
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (ents) {
        if (ents.some(function (e) { return e.isIntersecting; })) { crear(); if (mapa) io.disconnect(); }
      }, { rootMargin: "300px" });
      io.observe(lienzo.parentNode);
    } else {
      crear();
    }
    window.addEventListener("online", function () { crear(); });
  }

  // --- Service worker (web instalable y uso sin conexión) -----------------
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
