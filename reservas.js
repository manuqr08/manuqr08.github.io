// Calendario y formulario de solicitud. Lee la configuración que build.mjs
// incrusta desde content.mjs (reservas) en #datos-reservas.
(function () {
  "use strict";
  var raiz = document.querySelector("[data-reservas]");
  var nodoDatos = document.getElementById("datos-reservas");
  if (!raiz || !nodoDatos || !window.ReservasValidacion) return;

  var cfg = JSON.parse(nodoDatos.textContent);
  var validar = window.ReservasValidacion.validarSolicitud;
  var rutasPorId = {};
  cfg.rutas.forEach(function (r) { rutasPorId[r.id] = r; });

  var T = cfg.textos; // textos de la interfaz en el idioma de la página
  var fmtMes = new Intl.DateTimeFormat(cfg.locale, { month: "long", timeZone: "UTC" });
  var fmtLargo = new Intl.DateTimeFormat(cfg.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  function iso(a, m, d) {
    return a + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }
  function utc(f) {
    var p = f.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  }
  var ahora = new Date();
  var hoy = iso(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

  // Índice de disponibilidad: ruta -> fecha -> entrada. Se ignoran entradas mal formadas.
  var dispo = {};
  cfg.disponibilidad.forEach(function (e) {
    if (!e || !rutasPorId[e.ruta] || !/^\d{4}-\d{2}-\d{2}$/.test(e.fecha)) return;
    var a = Number(e.fecha.slice(0, 4));
    if (a < cfg.calendario.desde || a > cfg.calendario.hasta) return;
    (dispo[e.ruta] = dispo[e.ruta] || {})[e.fecha] = {
      estado: e.estado === "disponible" && Number(e.plazas) > 0 ? "disponible" : e.estado === "completa" || (e.estado === "disponible" && Number(e.plazas) <= 0) ? "completa" : "no-disponible",
      plazas: Math.max(0, Math.floor(Number(e.plazas) || 0)),
    };
  });
  function entrada(ruta, f) {
    var e = dispo[ruta] && dispo[ruta][f];
    if (!e || f < hoy) return null;
    return e;
  }
  function fechasLibres(ruta) {
    return Object.keys(dispo[ruta] || {}).filter(function (f) {
      var e = entrada(ruta, f);
      return e && e.estado === "disponible";
    }).sort();
  }

  // Elementos
  var selRuta = document.getElementById("r-ruta");
  var selMes = document.getElementById("r-mes");
  var btnAnt = document.getElementById("r-mes-ant");
  var btnSig = document.getElementById("r-mes-sig");
  var cuerpo = document.getElementById("cal-dias");
  var estado = document.getElementById("cal-estado");
  var form = document.getElementById("r-form");
  var resumen = document.getElementById("r-resumen");
  var campoFecha = document.getElementById("r-fecha");
  var campoPart = document.getElementById("r-participantes");
  var aviso = document.getElementById("r-aviso");
  var btnEnviar = document.getElementById("r-enviar");
  var listaErrores = document.getElementById("r-errores");
  var exito = document.getElementById("r-exito");

  var puedeEnviar = Boolean(cfg.envio && cfg.envio.endpoint && cfg.privacidad && cfg.privacidad.url);

  // Meses del rango
  var meses = [];
  for (var a = cfg.calendario.desde; a <= cfg.calendario.hasta; a++)
    for (var m = 0; m < 12; m++) meses.push({ a: a, m: m });
  meses.forEach(function (x, i) {
    var o = document.createElement("option");
    o.value = String(i);
    var t = fmtMes.format(new Date(Date.UTC(x.a, x.m, 1))) + " " + x.a;
    o.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    selMes.appendChild(o);
  });
  var idxHoy = meses.findIndex(function (x) { return x.a === ahora.getFullYear() && x.m === ahora.getMonth(); });
  var idxMin = Math.max(0, idxHoy); // no se navega a meses ya pasados
  var mesActual = idxMin;
  if (idxHoy === -1 && ahora.getFullYear() > cfg.calendario.hasta) idxMin = mesActual = meses.length - 1;
  Array.prototype.forEach.call(selMes.options, function (o, i) { if (i < idxMin) o.disabled = true; });

  var seleccion = null; // { fecha, plazas }

  function pintar() {
    var ruta = selRuta.value;
    var x = meses[mesActual];
    selMes.value = String(mesActual);
    btnAnt.disabled = mesActual <= idxMin;
    btnSig.disabled = mesActual >= meses.length - 1;

    cuerpo.textContent = "";
    var primero = new Date(Date.UTC(x.a, x.m, 1)).getUTCDay(); // 0 = domingo
    var hueco = (primero + 6) % 7; // semana empieza en lunes
    var dias = new Date(Date.UTC(x.a, x.m + 1, 0)).getUTCDate();
    var fila = document.createElement("tr");
    for (var h = 0; h < hueco; h++) fila.appendChild(document.createElement("td"));
    var libresMes = 0;
    for (var d = 1; d <= dias; d++) {
      var f = iso(x.a, x.m, d);
      var e = entrada(ruta, f);
      var td = document.createElement("td");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cal-dia";
      b.dataset.fecha = f;
      var num = document.createElement("span");
      num.className = "cal-num";
      num.textContent = String(d);
      b.appendChild(num);
      var largo = fmtLargo.format(utc(f));
      if (e && e.estado === "disponible") {
        libresMes++;
        b.classList.add("libre");
        var pl = document.createElement("span");
        pl.className = "cal-plazas";
        pl.textContent = e.plazas + " " + (e.plazas === 1 ? T.plaza : T.plazas);
        b.appendChild(pl);
        b.setAttribute("aria-label", largo + ", " + T.disponible + ", " + pl.textContent);
        b.setAttribute("aria-pressed", seleccion && seleccion.fecha === f ? "true" : "false");
      } else {
        b.disabled = true;
        if (e && e.estado === "completa") {
          b.classList.add("completa");
          b.setAttribute("aria-label", largo + ", " + T.completa.toLowerCase());
          var c = document.createElement("span");
          c.className = "cal-plazas";
          c.textContent = T.completa;
          b.appendChild(c);
        } else {
          if (f < hoy) b.classList.add("pasada");
          b.setAttribute("aria-label", largo + ", " + T.noDisponible.toLowerCase());
        }
      }
      if (f === hoy) b.classList.add("hoy");
      td.appendChild(b);
      fila.appendChild(td);
      if ((hueco + d) % 7 === 0) { cuerpo.appendChild(fila); fila = document.createElement("tr"); }
    }
    if (fila.children.length) {
      while (fila.children.length < 7) fila.appendChild(document.createElement("td"));
      cuerpo.appendChild(fila);
    }

    var todas = fechasLibres(ruta);
    if (!todas.length) {
      estado.textContent = T.sinFechas;
    } else if (!libresMes) {
      var prox = todas[0];
      estado.innerHTML = "";
      estado.appendChild(document.createTextNode(T.sinFechasMes + " "));
      var ir = document.createElement("button");
      ir.type = "button";
      ir.className = "enlace";
      ir.textContent = T.irProxima + " (" + fmtLargo.format(utc(prox)) + ")";
      ir.addEventListener("click", function () { irAFecha(prox, true); });
      estado.appendChild(ir);
    } else {
      estado.textContent = libresMes + " " + (libresMes === 1 ? T.fechaMes : T.fechasMes);
    }
  }

  function irAFecha(f, enfocar) {
    var a = Number(f.slice(0, 4)), m = Number(f.slice(5, 7)) - 1;
    var i = meses.findIndex(function (x) { return x.a === a && x.m === m; });
    if (i >= 0) { mesActual = i; pintar(); }
    if (enfocar) {
      var b = cuerpo.querySelector('[data-fecha="' + f + '"]');
      if (b) b.focus();
    }
  }

  function elegir(f) {
    var e = entrada(selRuta.value, f);
    if (!e || e.estado !== "disponible") return;
    seleccion = { fecha: f, plazas: e.plazas };
    pintar();
    var r = rutasPorId[selRuta.value];
    resumen.textContent = "";
    [[T.ruta, r.nombre], [T.fecha, fmtLargo.format(utc(f))], [T.plazasLibres, String(e.plazas)]].forEach(function (par) {
      var dt = document.createElement("dt"); dt.textContent = par[0];
      var dd = document.createElement("dd"); dd.textContent = par[1];
      resumen.appendChild(dt); resumen.appendChild(dd);
    });
    campoFecha.value = f;
    campoPart.max = String(e.plazas);
    if (Number(campoPart.value) > e.plazas) campoPart.value = String(e.plazas);
    form.hidden = false;
    exito.hidden = true;
    var foco = document.getElementById("r-form-t");
    foco.focus();
  }

  function quitarSeleccion() {
    seleccion = null;
    form.hidden = true;
    campoFecha.value = "";
  }

  // Eventos del calendario
  selRuta.addEventListener("change", function () { quitarSeleccion(); pintar(); });
  selMes.addEventListener("change", function () { mesActual = Number(selMes.value); pintar(); });
  btnAnt.addEventListener("click", function () { if (mesActual > idxMin) { mesActual--; pintar(); } });
  btnSig.addEventListener("click", function () { if (mesActual < meses.length - 1) { mesActual++; pintar(); } });
  cuerpo.addEventListener("click", function (ev) {
    var b = ev.target.closest(".cal-dia");
    if (b && !b.disabled) elegir(b.dataset.fecha);
  });
  cuerpo.addEventListener("keydown", function (ev) {
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
    var libres = Array.prototype.slice.call(cuerpo.querySelectorAll(".cal-dia:not([disabled])"));
    var i = libres.indexOf(document.activeElement);
    if (i === -1) return;
    var j = ev.key === "ArrowRight" ? i + 1 : i - 1;
    if (libres[j]) { ev.preventDefault(); libres[j].focus(); }
  });

  // Formulario
  if (!puedeEnviar) {
    btnEnviar.disabled = true;
    aviso.hidden = false;
  }

  function limpiarErrores() {
    form.querySelectorAll("[aria-invalid]").forEach(function (c) { c.removeAttribute("aria-invalid"); });
    form.querySelectorAll(".campo-error").forEach(function (p) { p.textContent = ""; p.hidden = true; });
    listaErrores.hidden = true;
    listaErrores.querySelector("ul").textContent = "";
  }

  function mostrarErrores(errores) {
    var ul = listaErrores.querySelector("ul");
    Object.keys(errores).forEach(function (campo) {
      var control = campo === "ruta" ? selRuta : form.querySelector('[name="' + campo + '"]:not([type="hidden"])') || campo === "fecha" && cuerpo.querySelector(".cal-dia:not([disabled])");
      var p = document.getElementById("err-" + campo);
      if (p) { p.textContent = errores[campo]; p.hidden = false; }
      if (control && control.setAttribute) control.setAttribute("aria-invalid", "true");
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + (control && control.id ? control.id : "reservas-t");
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
      ruta: selRuta.value, fecha: fd.get("fecha"), participantes: fd.get("participantes"),
      comentarios: fd.get("comentarios"), privacidad: fd.get("privacidad") === "on",
    };
    var r = validar(datos, {
      rutas: cfg.rutas.map(function (x) { return x.id; }),
      plazas: seleccion ? seleccion.plazas : 0, hoy: hoy, requierePrivacidad: true, idioma: cfg.idioma,
    });
    if (!r.valido) { mostrarErrores(r.errores); return; }

    btnEnviar.disabled = true;
    btnEnviar.textContent = T.enviando;
    fetch(cfg.envio.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(r.limpio),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        var rt = rutasPorId[r.limpio.ruta];
        exito.querySelector("[data-exito-detalle]").textContent =
          rt.nombre + ", " + fmtLargo.format(utc(r.limpio.fecha)) + ", " + r.limpio.participantes +
          " " + (r.limpio.participantes === 1 ? T.persona : T.personas) + ".";
        form.reset();
        quitarSeleccion();
        pintar();
        exito.hidden = false;
        exito.focus();
      })
      .catch(function () {
        mostrarErrores({ envio: T.errorEnvio });
      })
      .then(function () {
        btnEnviar.disabled = false;
        btnEnviar.textContent = T.enviar;
      });
  });

  raiz.hidden = false;
  pintar();
})();
