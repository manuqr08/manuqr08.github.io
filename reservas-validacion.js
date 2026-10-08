// Validación de solicitudes de reserva.
// Se usa en el navegador y debe repetirse en el servidor que reciba las
// solicitudes: `const { validarSolicitud } = require("./reservas-validacion.js")`.
// El servidor además debe comprobar la fecha contra su propia disponibilidad.
(function (raiz) {
  "use strict";

  var LIMITES = { nombre: 120, email: 254, telefono: 25, comentarios: 1000 };

  // Mensajes por idioma (contexto.idioma: "es" por defecto, o "en").
  var MENSAJES = {
    es: {
      nombre: "Escribe tu nombre y al menos un apellido.",
      nombreLargo: function (n) { return "El nombre es demasiado largo (máximo " + n + " caracteres)."; },
      emailVacio: "Escribe tu correo electrónico.",
      email: "Revisa el correo: debe tener el formato nombre@dominio.es.",
      telefonoVacio: "Escribe un teléfono de contacto.",
      telefono: "Revisa el teléfono: usa solo números (9 a 15 cifras) y, si quieres, el prefijo con +.",
      ruta: "Elige una de las rutas.",
      fecha: "Elige una fecha disponible en el calendario.",
      fechaPasada: "La fecha elegida ya ha pasado.",
      participantes: "Indica cuántas personas participaréis (1 o más).",
      plazas: function (n) { return "Para esta fecha quedan " + n + (n === 1 ? " plaza." : " plazas."); },
      comentarios: function (n) { return "Los comentarios no pueden superar " + n + " caracteres."; },
      privacidad: "Debes aceptar la política de privacidad para enviar la solicitud.",
    },
    en: {
      nombre: "Enter your first name and at least one surname.",
      nombreLargo: function (n) { return "The name is too long (maximum " + n + " characters)."; },
      emailVacio: "Enter your email address.",
      email: "Check your email: it should look like name@domain.com.",
      telefonoVacio: "Enter a contact phone number.",
      telefono: "Check the phone number: use digits only (9 to 15) and, if you like, the country code with +.",
      ruta: "Choose one of the routes.",
      fecha: "Choose an available date in the calendar.",
      fechaPasada: "The chosen date has already passed.",
      participantes: "Enter how many people will take part (1 or more).",
      plazas: function (n) { return "Only " + n + (n === 1 ? " place is" : " places are") + " left for this date."; },
      comentarios: function (n) { return "Comments cannot be longer than " + n + " characters."; },
      privacidad: "You must accept the privacy policy to send the request.",
    },
  };

  function texto(v) {
    return typeof v === "string" ? v.trim() : "";
  }

  function fechaValida(f) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
    var p = f.split("-").map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
  }

  // datos: objeto con los campos del formulario.
  // contexto: { rutas: [ids], plazas: número de plazas libres para esa fecha y ruta,
  //             hoy: "AAAA-MM-DD", requierePrivacidad: bool, idioma: "es" | "en" }
  // Devuelve { valido, errores: { campo: mensaje }, limpio }.
  function validarSolicitud(datos, contexto) {
    datos = datos || {};
    contexto = contexto || {};
    var e = {};
    var M = MENSAJES[contexto.idioma] || MENSAJES.es;
    var limpio = {
      nombre: texto(datos.nombre).replace(/\s+/g, " "),
      email: texto(datos.email).toLowerCase(),
      telefono: texto(datos.telefono),
      ruta: texto(datos.ruta),
      fecha: texto(datos.fecha),
      participantes: Number(datos.participantes),
      comentarios: texto(datos.comentarios),
      privacidad: datos.privacidad === true || datos.privacidad === "on" || datos.privacidad === "true",
    };

    if (limpio.nombre.length < 3 || !/\s/.test(limpio.nombre))
      e.nombre = M.nombre;
    else if (limpio.nombre.length > LIMITES.nombre)
      e.nombre = M.nombreLargo(LIMITES.nombre);

    if (!limpio.email) e.email = M.emailVacio;
    else if (limpio.email.length > LIMITES.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpio.email))
      e.email = M.email;

    var digitos = limpio.telefono.replace(/\D/g, "");
    if (!limpio.telefono) e.telefono = M.telefonoVacio;
    else if (!/^\+?[\d\s().-]+$/.test(limpio.telefono) || digitos.length < 9 || digitos.length > 15 || limpio.telefono.length > LIMITES.telefono)
      e.telefono = M.telefono;

    if (!limpio.ruta || (contexto.rutas && contexto.rutas.indexOf(limpio.ruta) === -1))
      e.ruta = M.ruta;

    if (!fechaValida(limpio.fecha)) e.fecha = M.fecha;
    else if (contexto.hoy && limpio.fecha < contexto.hoy) e.fecha = M.fechaPasada;

    var max = Number(contexto.plazas);
    if (!Number.isInteger(limpio.participantes) || limpio.participantes < 1)
      e.participantes = M.participantes;
    else if (Number.isFinite(max) && limpio.participantes > max)
      e.participantes = M.plazas(max);

    if (limpio.comentarios.length > LIMITES.comentarios)
      e.comentarios = M.comentarios(LIMITES.comentarios);

    if (contexto.requierePrivacidad && !limpio.privacidad)
      e.privacidad = M.privacidad;

    return { valido: Object.keys(e).length === 0, errores: e, limpio: limpio };
  }

  var api = { validarSolicitud: validarSolicitud, LIMITES: LIMITES };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.ReservasValidacion = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
