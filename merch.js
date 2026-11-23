// Material para tu ruta: carrusel que se desliza y rota, y reserva de artículos.
// Los artículos y sus precios están en el HTML (.prod: data-prod, data-nombre, data-precio).
// Los textos de la interfaz llegan en #datos-material. El envío usa la misma
// configuración que el calendario (#datos-reservas: envio.endpoint y privacidad.url).
(function () {
  "use strict";
  var raiz = document.querySelector("[data-carrusel]");
  var nodo = document.getElementById("datos-material");
  var panel = document.querySelector("[data-material]");
  if (!raiz || !nodo || !panel) return;

  var cfg = JSON.parse(nodo.textContent);
  var T = cfg.textos;
  var envioCfg = { rutas: [], envio: {}, privacidad: {} };
  try { envioCfg = JSON.parse(document.getElementById("datos-reservas").textContent); } catch (e) {}

  var fmtPrecio = new Intl.NumberFormat(cfg.locale, { style: "currency", currency: "EUR" });
  var fmtLargo = new Intl.DateTimeFormat(cfg.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  function tpl(s, d) { return s.replace(/\{(\w+)\}/g, function (_, k) { return d[k] === undefined ? "" : d[k]; }); }
  function centimos(p) { return Math.round(Number(p) * 100); }
  function eur(c) { return fmtPrecio.format(c / 100); }

  var reducir = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var comportamiento = reducir ? "auto" : "smooth";

  // ------------------------------------------------------------------ Carrusel
  var pista = document.getElementById("car-pista");
  var tarjetas = Array.prototype.slice.call(pista.querySelectorAll(".prod"));
  var estadoTxt = document.getElementById("car-estado");
  var btnAnt = raiz.querySelector('[data-car="ant"]');
  var btnSig = raiz.querySelector('[data-car="sig"]');
  var btnPlay = raiz.querySelector('[data-car="play"]');

  function paso() {
    var t = tarjetas[0];
    var cs = window.getComputedStyle(pista);
    var gap = parseFloat(cs.columnGap || cs.gap) || 0;
    return t.getBoundingClientRect().width + gap;
  }
  function porVista() { return Math.max(1, Math.round((pista.clientWidth + 1) / paso())); }
  function alFinal() { return pista.scrollLeft + pista.clientWidth >= pista.scrollWidth - 3; }

  function mover(direccion, unidades) {
    var avance = paso() * (unidades || porVista());
    if (direccion > 0) {
      if (alFinal()) pista.scrollTo({ left: 0, behavior: comportamiento });
      else pista.scrollBy({ left: avance, behavior: comportamiento });
    } else {
      if (pista.scrollLeft <= 3) pista.scrollTo({ left: pista.scrollWidth, behavior: comportamiento });
      else pista.scrollBy({ left: -avance, behavior: comportamiento });
    }
  }

  var ticket = false;
  function pintarEstado() {
    ticket = false;
    var p = paso();
    var a = Math.min(tarjetas.length, Math.round(pista.scrollLeft / p) + 1);
    var b = alFinal() ? tarjetas.length : Math.min(tarjetas.length, a + porVista() - 1);
    estadoTxt.textContent = tpl(T.mostrando, { a: a, b: b, n: tarjetas.length });
  }
  pista.addEventListener("scroll", function () {
    if (!ticket) { ticket = true; window.requestAnimationFrame(pintarEstado); }
  }, { passive: true });
  window.addEventListener("resize", pintarEstado);

  pista.addEventListener("keydown", function (ev) {
    if (ev.target !== pista) return;
    if (ev.key === "ArrowRight") { ev.preventDefault(); mover(1, 1); }
    else if (ev.key === "ArrowLeft") { ev.preventDefault(); mover(-1, 1); }
  });
  btnAnt.hidden = btnSig.hidden = btnPlay.hidden = false;
  btnAnt.addEventListener("click", function () { parar(); mover(-1); });
  btnSig.addEventListener("click", function () { parar(); mover(1); });

  // Rotación automática: se detiene al interactuar y con «prefiere menos movimiento».
  var rota = !reducir;
  var temporizador = null;
  var encima = false, visible = true;
  function pintarPlay() {
    var etq = rota ? T.pausar : T.reanudar;
    btnPlay.textContent = rota ? "❚❚" : "▶";
    btnPlay.setAttribute("aria-label", etq);
    btnPlay.setAttribute("title", etq);
  }
  function arrancar() {
    detener();
    if (!rota || reducir) return;
    temporizador = window.setInterval(function () {
      if (encima || !visible || document.hidden || raiz.contains(document.activeElement)) return;
      mover(1, 1);
    }, 4200);
  }
  function detener() { if (temporizador) { window.clearInterval(temporizador); temporizador = null; } }
  function parar() { if (rota) { rota = false; pintarPlay(); detener(); } }
  btnPlay.addEventListener("click", function () { rota = !rota; pintarPlay(); arrancar(); });
  raiz.addEventListener("mouseenter", function () { encima = true; });
  raiz.addEventListener("mouseleave", function () { encima = false; });
  pista.addEventListener("pointerdown", parar);
  pista.addEventListener("touchstart", parar, { passive: true });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (ents) { visible = ents.some(function (e) { return e.isIntersecting; }); }).observe(raiz);
  }
  pintarPlay();
  pintarEstado();
  arrancar();

  // -------------------------------------------------------------------- Reserva
  var precios = {};
  tarjetas.forEach(function (t) { precios[t.dataset.prod] = { nombre: t.dataset.nombre, precio: Number(t.dataset.precio) }; });

  var cesta = []; // { clave, id, nombre, opciones: [{etiqueta, valor}], cantidad, precio }
  var MAX_CANT = 10;
  var CLAVE = "canuto-material-" + cfg.idioma;

  var caja = document.getElementById("mr-caja");
  var lista = document.getElementById("mr-lista");
  var vacio = document.getElementById("mr-vacio");
  var totalEl = document.getElementById("mr-total");
  var live = document.getElementById("mr-live");
  var enlace = document.getElementById("mr-enlace");
  var form = document.getElementById("mr-form");
  var listaErrores = document.getElementById("mr-errores");
  var exito = document.getElementById("mr-exito");
  var aviso = document.getElementById("mr-aviso");
  var btnEnviar = document.getElementById("mr-enviar");
  var selRuta = document.getElementById("m-ruta");
  var campoFecha = document.getElementById("m-fecha");
  var cajaPriv = document.getElementById("m-privacidad-caja");

  var ahora = new Date();
  var hoy = ahora.getFullYear() + "-" + String(ahora.getMonth() + 1).padStart(2, "0") + "-" + String(ahora.getDate()).padStart(2, "0");

  // Calendario visible para elegir la fecha de la ruta (mes desplegado, días seleccionables).
  var mcSelMes = document.getElementById("m-mes");
  var mcAnt = document.getElementById("m-mes-ant");
  var mcSig = document.getElementById("m-mes-sig");
  var mcCab = document.getElementById("m-cab");
  var mcDias = document.getElementById("m-dias");
  var mcEstado = document.getElementById("m-fecha-sel");
  var fmtMes = new Intl.DateTimeFormat(cfg.locale, { month: "long", timeZone: "UTC" });
  var fmtSemanaCorta = new Intl.DateTimeFormat(cfg.locale, { weekday: "narrow", timeZone: "UTC" });
  var fmtSemanaLarga = new Intl.DateTimeFormat(cfg.locale, { weekday: "long", timeZone: "UTC" });
  var N_MESES = 24; // desde el mes actual, 2 años
  var mcMeses = [];
  for (var im = 0; im < N_MESES; im++) mcMeses.push({ a: ahora.getFullYear() + Math.floor((ahora.getMonth() + im) / 12), m: (ahora.getMonth() + im) % 12 });
  mcMeses.forEach(function (x, i) {
    var o = document.createElement("option");
    o.value = String(i);
    var t = fmtMes.format(new Date(Date.UTC(x.a, x.m, 1))) + " " + x.a;
    o.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    mcSelMes.appendChild(o);
  });
  for (var dw = 0; dw < 7; dw++) {
    var dd = new Date(Date.UTC(2024, 0, 1 + dw)); // 1 ene 2024 fue lunes
    var th = document.createElement("th");
    th.scope = "col";
    var ab = document.createElement("abbr");
    ab.title = fmtSemanaLarga.format(dd);
    ab.textContent = cfg.idioma === "es" ? "LMXJVSD".charAt(dw) : fmtSemanaCorta.format(dd);
    th.appendChild(ab);
    mcCab.appendChild(th);
  }
  var mcMes = 0;
  var fechaSel = "";
  function isoFecha(a, m, d) { return a + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }
  function utcDe(f) { var p = f.split("-").map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
  function pintarMiniCal() {
    var x = mcMeses[mcMes];
    mcSelMes.value = String(mcMes);
    mcAnt.disabled = mcMes <= 0;
    mcSig.disabled = mcMes >= mcMeses.length - 1;
    mcDias.textContent = "";
    var hueco = (new Date(Date.UTC(x.a, x.m, 1)).getUTCDay() + 6) % 7; // la semana empieza en lunes
    var dias = new Date(Date.UTC(x.a, x.m + 1, 0)).getUTCDate();
    var fila = document.createElement("tr");
    for (var h = 0; h < hueco; h++) fila.appendChild(document.createElement("td"));
    for (var d = 1; d <= dias; d++) {
      var f = isoFecha(x.a, x.m, d);
      var td = document.createElement("td");
      var b = document.createElement("button");
      b.type = "button"; b.className = "cal-dia"; b.dataset.fecha = f;
      var num = document.createElement("span");
      num.className = "cal-num"; num.textContent = String(d);
      b.appendChild(num);
      var largo = fmtLargo.format(utcDe(f));
      b.setAttribute("aria-label", largo);
      if (f < hoy) { b.disabled = true; b.classList.add("pasada"); }
      else { b.classList.add("libre"); b.setAttribute("aria-pressed", f === fechaSel ? "true" : "false"); }
      if (f === hoy) b.classList.add("hoy");
      td.appendChild(b);
      fila.appendChild(td);
      if ((hueco + d) % 7 === 0) { mcDias.appendChild(fila); fila = document.createElement("tr"); }
    }
    if (fila.children.length) {
      while (fila.children.length < 7) fila.appendChild(document.createElement("td"));
      mcDias.appendChild(fila);
    }
  }
  function elegirFecha(f) {
    fechaSel = f;
    campoFecha.value = f;
    mcEstado.textContent = tpl(T.fechaElegida, { fecha: fmtLargo.format(utcDe(f)) });
    pintarMiniCal();
    var b = mcDias.querySelector('[data-fecha="' + f + '"]');
    if (b) b.focus();
  }
  function limpiarFecha() {
    fechaSel = ""; campoFecha.value = "";
    mcEstado.textContent = T.sinFecha;
    mcMes = 0;
    pintarMiniCal();
  }
  mcAnt.addEventListener("click", function () { if (mcMes > 0) { mcMes--; pintarMiniCal(); } });
  mcSig.addEventListener("click", function () { if (mcMes < mcMeses.length - 1) { mcMes++; pintarMiniCal(); } });
  mcSelMes.addEventListener("change", function () { mcMes = Number(mcSelMes.value); pintarMiniCal(); });
  mcDias.addEventListener("click", function (ev) {
    var b = ev.target.closest(".cal-dia");
    if (b && !b.disabled) elegirFecha(b.dataset.fecha);
  });
  mcDias.addEventListener("keydown", function (ev) {
    var salto = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[ev.key];
    if (!salto) return;
    var todos = Array.prototype.slice.call(mcDias.querySelectorAll(".cal-dia"));
    var i = todos.indexOf(document.activeElement);
    if (i === -1) return;
    var j = i + salto;
    if (todos[j] && !todos[j].disabled) { ev.preventDefault(); todos[j].focus(); }
  });
  pintarMiniCal();

  (envioCfg.rutas || []).forEach(function (r) {
    var o = document.createElement("option");
    o.value = r.id; o.textContent = r.nombre;
    selRuta.appendChild(o);
  });
  var rutasPorId = {};
  (envioCfg.rutas || []).forEach(function (r) { rutasPorId[r.id] = r; });

  var simulado = !(envioCfg.envio && envioCfg.envio.endpoint); // sin servidor, el envío se simula
  var puedeEnviar = Boolean(window.ReservasValidacion);
  if (envioCfg.privacidad && envioCfg.privacidad.url) {
    cajaPriv.hidden = false;
    var etqPriv = cajaPriv.querySelector("label");
    var a = document.createElement("a");
    a.href = envioCfg.privacidad.url; a.rel = "noopener"; a.target = "_blank";
    a.textContent = etqPriv.textContent;
    etqPriv.textContent = ""; etqPriv.appendChild(a);
  }
  if (!puedeEnviar) { btnEnviar.disabled = true; if (aviso) aviso.hidden = false; }

  function guardar() { try { sessionStorage.setItem(CLAVE, JSON.stringify(cesta.map(function (l) { return { clave: l.clave, id: l.id, opciones: l.opciones, cantidad: l.cantidad }; }))); } catch (e) {} }
  function cargar() {
    try {
      var g = JSON.parse(sessionStorage.getItem(CLAVE) || "[]");
      if (!Array.isArray(g)) return;
      g.forEach(function (l) {
        var p = l && precios[l.id];
        var cant = Math.floor(Number(l && l.cantidad));
        if (!p || !(cant >= 1)) return;
        var ops = Array.isArray(l.opciones) ? l.opciones.filter(function (o) { return o && typeof o.etiqueta === "string" && typeof o.valor === "string"; }) : [];
        cesta.push({ clave: String(l.clave), id: l.id, nombre: p.nombre, opciones: ops, cantidad: Math.min(MAX_CANT, cant), precio: p.precio });
      });
    } catch (e) {}
  }

  function avisar(txt) { live.textContent = ""; window.setTimeout(function () { live.textContent = txt; }, 30); }
  function textoOpciones(l) { return l.opciones.map(function (o) { return o.etiqueta + ": " + o.valor; }).join(" · "); }
  function unidades() { return cesta.reduce(function (n, l) { return n + l.cantidad; }, 0); }

  function pintarCesta() {
    lista.textContent = "";
    var tot = 0;
    cesta.forEach(function (l, i) {
      tot += centimos(l.precio) * l.cantidad;
      var li = document.createElement("li");
      li.className = "mr-item";
      var txt = document.createElement("div");
      txt.className = "mr-item-txt";
      var n = document.createElement("span");
      n.className = "mr-item-nombre"; n.textContent = l.nombre;
      txt.appendChild(n);
      if (l.opciones.length) {
        var o = document.createElement("span");
        o.className = "mr-item-opc"; o.textContent = textoOpciones(l);
        txt.appendChild(o);
      }
      var pr = document.createElement("span");
      pr.className = "mr-precio"; pr.textContent = eur(centimos(l.precio) * l.cantidad);
      var cant = document.createElement("div");
      cant.className = "mr-cant"; cant.setAttribute("role", "group"); cant.setAttribute("aria-label", T.cantidad + ": " + l.nombre);
      var menos = document.createElement("button");
      menos.type = "button"; menos.dataset.accion = "menos"; menos.dataset.i = String(i);
      menos.setAttribute("aria-label", T.menos + " " + l.nombre); menos.textContent = "−";
      var num = document.createElement("span");
      num.className = "mr-num"; num.textContent = String(l.cantidad);
      var mas = document.createElement("button");
      mas.type = "button"; mas.dataset.accion = "mas"; mas.dataset.i = String(i);
      mas.setAttribute("aria-label", T.mas + " " + l.nombre); mas.textContent = "+";
      mas.disabled = l.cantidad >= MAX_CANT;
      cant.appendChild(menos); cant.appendChild(num); cant.appendChild(mas);
      var q = document.createElement("button");
      q.type = "button"; q.className = "enlace mr-quitar"; q.dataset.accion = "quitar"; q.dataset.i = String(i);
      q.textContent = T.quitar;
      q.setAttribute("aria-label", T.quitarDe + " " + l.nombre + (l.opciones.length ? " (" + textoOpciones(l) + ")" : ""));
      li.appendChild(txt); li.appendChild(pr); li.appendChild(cant); li.appendChild(q);
      lista.appendChild(li);
    });
    var hay = cesta.length > 0;
    lista.hidden = !hay; totalEl.hidden = !hay; vacio.hidden = hay; form.hidden = !hay;
    caja.classList.toggle("con-form", hay);
    totalEl.querySelector("strong").textContent = eur(tot);
    enlace.hidden = !hay;
    if (hay) enlace.textContent = tpl(T.verReserva, { n: unidades() });
    guardar();
  }

  function anadir(tarjeta) {
    var id = tarjeta.dataset.prod;
    var p = precios[id];
    if (!p) return;
    var ops = Array.prototype.map.call(tarjeta.querySelectorAll("select[data-opcion]"), function (s) {
      return { etiqueta: s.dataset.etiqueta, valor: s.value };
    });
    var clave = id + "|" + ops.map(function (o) { return o.valor; }).join("|");
    var linea = cesta.filter(function (l) { return l.clave === clave; })[0];
    if (linea) linea.cantidad = Math.min(MAX_CANT, linea.cantidad + 1);
    else cesta.push({ clave: clave, id: id, nombre: p.nombre, opciones: ops, cantidad: 1, precio: p.precio });
    pintarCesta();
    exito.hidden = true;
    avisar(tpl(T.anadido, { nombre: p.nombre }) + ". " + tpl(T.verReserva, { n: unidades() }));
  }

  pista.addEventListener("click", function (ev) {
    var b = ev.target.closest(".prod-reservar");
    if (!b) return;
    var t = b.closest(".prod");
    anadir(t);
    if (!b.dataset.etq) b.dataset.etq = b.firstChild.nodeValue;
    b.firstChild.nodeValue = "✓ " + b.dataset.etq;
    window.clearTimeout(b._t);
    b._t = window.setTimeout(function () { b.firstChild.nodeValue = b.dataset.etq; }, 1500);
  });
  tarjetas.forEach(function (t) { t.querySelector(".prod-reservar").hidden = false; });

  lista.addEventListener("click", function (ev) {
    var b = ev.target.closest("button[data-accion]");
    if (!b) return;
    var i = Number(b.dataset.i);
    var l = cesta[i];
    if (!l) return;
    var accion = b.dataset.accion;
    if (accion === "mas") l.cantidad = Math.min(MAX_CANT, l.cantidad + 1);
    else if (accion === "menos") l.cantidad -= 1;
    else if (accion === "quitar") l.cantidad = 0;
    var quitada = l.cantidad <= 0;
    if (quitada) cesta.splice(i, 1);
    pintarCesta();
    if (quitada) {
      avisar(tpl(T.quitado, { nombre: l.nombre }));
      var sig = lista.querySelector("button[data-accion]");
      (sig || document.getElementById("mr-t")).focus();
    } else {
      var otro = lista.querySelector('button[data-accion="' + accion + '"][data-i="' + i + '"]') || lista.querySelector('button[data-accion="menos"][data-i="' + i + '"]');
      if (otro) otro.focus();
    }
  });

  // ------------------------------------------------------------------- Envío
  function limpiarErrores() {
    form.querySelectorAll("[aria-invalid]").forEach(function (c) { c.removeAttribute("aria-invalid"); });
    form.querySelectorAll(".campo-error").forEach(function (p) { p.textContent = ""; p.hidden = true; });
    listaErrores.hidden = true;
    listaErrores.querySelector("ul").textContent = "";
  }
  function mostrarErrores(errores) {
    var ul = listaErrores.querySelector("ul");
    Object.keys(errores).forEach(function (campo) {
      var control = document.getElementById(campo === "fecha" ? "m-cal" : "m-" + campo);
      var p = document.getElementById("merr-" + campo);
      if (p) { p.textContent = errores[campo]; p.hidden = false; }
      if (control && campo !== "fecha") control.setAttribute("aria-invalid", "true");
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + (control ? control.id : "mr-t");
      a.textContent = errores[campo];
      li.appendChild(a);
      ul.appendChild(li);
    });
    listaErrores.hidden = false;
    listaErrores.focus();
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    limpiarErrores();
    if (!puedeEnviar) return;
    var fd = new FormData(form);
    if (fd.get("web")) return; // campo trampa para bots
    var datos = {
      nombre: fd.get("nombre"), email: fd.get("email"), telefono: fd.get("telefono"),
      ruta: fd.get("ruta"), fecha: fd.get("fecha"), participantes: 1,
      comentarios: fd.get("comentarios"), privacidad: fd.get("privacidad") === "on",
    };
    var r = window.ReservasValidacion.validarSolicitud(datos, {
      rutas: (envioCfg.rutas || []).map(function (x) { return x.id; }),
      plazas: Infinity, hoy: hoy, requierePrivacidad: Boolean(envioCfg.privacidad && envioCfg.privacidad.url), idioma: cfg.idioma,
    });
    var errores = r.errores;
    if (!cesta.length) errores.material = T.sinMaterial;
    if (Object.keys(errores).length) { mostrarErrores(errores); return; }

    var material = cesta.map(function (l) {
      return { id: l.id, nombre: l.nombre, opciones: l.opciones, cantidad: l.cantidad, precio: l.precio };
    });
    var total = cesta.reduce(function (n, l) { return n + centimos(l.precio) * l.cantidad; }, 0) / 100;
    var carga = {
      tipo: "material", nombre: r.limpio.nombre, email: r.limpio.email, telefono: r.limpio.telefono,
      ruta: r.limpio.ruta, fecha: r.limpio.fecha, comentarios: r.limpio.comentarios, privacidad: r.limpio.privacidad,
      material: material, total: total,
    };
    var n = unidades();
    btnEnviar.disabled = true;
    btnEnviar.textContent = T.enviando;
    var envio = simulado
      ? new Promise(function (ok) { window.setTimeout(function () { ok({ ok: true }); }, 700); })
      : fetch(envioCfg.envio.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(carga),
        });
    envio
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        var p = r.limpio.fecha.split("-").map(Number);
        var rt = rutasPorId[r.limpio.ruta];
        exito.querySelector("[data-exito-detalle]").textContent = tpl(T.exito, {
          n: n, u: n === 1 ? T.unidad : T.unidades, ruta: rt ? rt.nombre : "",
          fecha: fmtLargo.format(new Date(Date.UTC(p[0], p[1] - 1, p[2]))),
        });
        form.reset();
        limpiarFecha();
        cesta = [];
        pintarCesta();
        exito.hidden = false;
        exito.focus();
      })
      .catch(function () { mostrarErrores({ envio: T.errorEnvio }); })
      .then(function () { btnEnviar.disabled = false; btnEnviar.textContent = T.enviar; });
  });

  cargar();
  panel.hidden = false;
  pintarCesta();
})();
