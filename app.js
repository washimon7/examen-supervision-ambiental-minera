(() => {
  const DOCS = [
    {
      id: "oefa",
      titulo: "Reglamento de Supervisión del OEFA",
      norma: "Organismo de Evaluación y Fiscalización Ambiental",
      pdf: "pdf/reglamento-supervision-oefa.pdf",
      color: "var(--doc-oefa)",
      enfoque: "Todo el reglamento: principios, Autoridad de Supervisión, tipos de supervisión, acta e informe, medidas administrativas y plazos.",
    },
    {
      id: "lpag",
      titulo: "TUO de la LPAG",
      norma: "Ley N.º 27444 · D. S. N.º 004-2019-JUS",
      pdf: "pdf/tuo-lpag-ds-004-2019-jus.pdf",
      color: "var(--doc-lpag)",
      enfoque: "Plazos y procedimiento administrativo sancionador (PAS), fiscalización, notificación y recursos, aplicados al sector minero.",
    },
    {
      id: "ds006",
      titulo: "Nuevo TUO de la LPAG",
      norma: "D. S. N.º 006-2026-JUS · El Peruano, 30/04/2026",
      pdf: "pdf/tuo-lpag-ds-006-2026-jus.pdf",
      color: "var(--doc-ds006)",
      enfoque: "Qué cambió: la nueva numeración de los artículos, las normas modificatorias y el PAS en el texto de 2026.",
    },
  ];
  const NIVELES = [
    { id: "facil", nombre: "Fácil", color: "var(--facil)", desc: "Conceptos centrales y plazos principales." },
    { id: "medio", nombre: "Medio", color: "var(--medio)", desc: "Plazos específicos, excepciones y casos prácticos." },
  ];
  const LETRAS = ["A", "B", "C", "D"];
  const EXAMENES_POR_NIVEL = 5;
  const CLAVE_CURSO = "sam-examen-en-curso";
  const CLAVE_MEJORES = "sam-mejores";

  const $ = (sel) => document.querySelector(sel);
  const pantallas = {
    inicio: $("#pantalla-inicio"),
    quiz: $("#pantalla-quiz"),
    resultado: $("#pantalla-resultado"),
  };
  const dlg = $("#dlg-inicio");
  const dlgConfirmar = $("#dlg-confirmar");
  const dlgLibro = $("#dlg-libro");
  const chkMostrar = $("#chk-mostrar");
  const chkMezclar = $("#chk-mezclar");

  const examenes = window.EXAMENES || [];
  const buscar = (doc, nivel, numero) => examenes.find((e) => e.doc === doc && e.nivel === nivel && e.numero === numero);
  const docPorId = (id) => DOCS.find((d) => d.id === id);
  const nivelPorId = (id) => NIVELES.find((n) => n.id === id);

  let seleccion = null; // { doc, nivel, numero } elegido en el diálogo
  let estado = null; // examen en curso

  // ---------- Utilidades ----------
  function mostrarPantalla(nombre) {
    for (const [k, e] of Object.entries(pantallas)) e.hidden = k !== nombre;
    window.scrollTo(0, 0);
  }

  function barajar(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Crea un elemento. El HTML solo viene de los archivos de datos (texto propio, nunca del usuario).
  function el(tag, clase, contenido, html = false) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (contenido != null) e[html ? "innerHTML" : "textContent"] = contenido;
    return e;
  }

  // El almacenamiento local puede no estar disponible (ventana privada, permisos): la app funciona igual.
  const guardar = (clave, valor) => {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
  };
  const leer = (clave) => {
    try { return JSON.parse(localStorage.getItem(clave)); } catch { return null; }
  };
  const borrar = (clave) => {
    try { localStorage.removeItem(clave); } catch { /* sin almacenamiento */ }
  };

  const enlacePdf = (doc, pagina) => `${doc.pdf}#page=${pagina}`;

  // ---------- Inicio ----------
  function pintarInicio() {
    const mejores = leer(CLAVE_MEJORES) || {};
    const cont = $("#documentos");
    cont.replaceChildren();
    DOCS.forEach((doc, i) => {
      const caja = el("article", "documento");
      caja.style.setProperty("--color", doc.color);
      const cab = el("div", "doc-cab");
      cab.append(el("span", "doc-num", String(i + 1)));
      const tit = el("div");
      tit.append(el("h2", null, doc.titulo), el("p", "doc-norma", doc.norma));
      cab.append(tit);
      caja.append(cab, el("p", "doc-enfoque", doc.enfoque));

      const niveles = el("div", "doc-niveles");
      for (const nivel of NIVELES) {
        const fila = el("div", "nivel");
        fila.style.setProperty("--nivel", nivel.color);
        const cab = el("p", "nivel-cab");
        cab.append(el("strong", null, nivel.nombre), el("span", null, ` · ${nivel.desc}`));
        const lista = el("div", "lista-examenes");
        for (let n = 1; n <= EXAMENES_POR_NIVEL; n++) {
          const ex = buscar(doc.id, nivel.id, n);
          const b = el("button", "btn-examen");
          b.type = "button";
          b.disabled = !ex;
          b.setAttribute("aria-label", `${doc.titulo}, nivel ${nivel.nombre}, examen ${n}`);
          b.append(el("span", "num", String(n)));
          const mejor = mejores[`${doc.id}-${nivel.id}-${n}`];
          if (mejor) {
            b.classList.add("hecho");
            b.append(el("span", "mejor", `${mejor.aciertos}/${mejor.total}`));
          }
          if (ex) b.addEventListener("click", () => abrirDialogo(doc, nivel, n));
          lista.append(b);
        }
        const disponibles = examenes.filter((e) => e.doc === doc.id && e.nivel === nivel.id).length;
        if (disponibles < EXAMENES_POR_NIVEL) cab.append(el("span", "en-preparacion", " · Algunos exámenes están en preparación."));
        fila.append(cab, lista);
        niveles.append(fila);
      }
      const verPdf = el("a", "doc-pdf", "Ver el PDF completo ↗");
      verPdf.href = doc.pdf;
      verPdf.target = "_blank";
      verPdf.rel = "noopener";
      caja.append(niveles, verPdf);
      cont.append(caja);
    });
    pintarContinuar();
  }

  function pintarContinuar() {
    const guardado = leer(CLAVE_CURSO);
    const caja = $("#continuar");
    const restaurable = guardado && reconstruir(guardado);
    caja.hidden = !restaurable;
    if (restaurable) {
      const resp = restaurable.respuestas.filter((r) => r !== null).length;
      $("#continuar-texto").textContent =
        `${nombreExamen(restaurable)} · ${resp} de ${restaurable.preguntas.length} respondidas.`;
    }
  }

  $("#btn-continuar").addEventListener("click", () => {
    const restaurado = reconstruir(leer(CLAVE_CURSO));
    if (!restaurado) return pintarContinuar();
    estado = restaurado;
    entrarAlQuiz();
  });
  $("#btn-descartar").addEventListener("click", () => {
    borrar(CLAVE_CURSO);
    pintarContinuar();
  });

  // ---------- Diálogo de inicio ----------
  function textoAyuda() {
    return chkMostrar.checked
      ? "Activado: al responder verás si acertaste, por qué, la base legal, la cita del PDF con su página, un «Ojo», un tip y dónde leer más."
      : "Desactivado (modo examen): no verás las respuestas hasta terminar; la revisión completa aparece al final.";
  }

  function abrirDialogo(doc, nivel, numero) {
    seleccion = { doc, nivel, numero };
    const n = buscar(doc.id, nivel.id, numero).preguntas.length;
    $("#dlg-titulo").textContent = `${doc.titulo} · ${nivel.nombre} · Examen ${numero}`;
    $("#dlg-detalle").textContent = `${n} preguntas con 4 alternativas cada una.`;
    chkMostrar.checked = true; // por defecto se muestra la respuesta: la meta es aprender
    chkMezclar.checked = false;
    $("#dlg-ayuda").textContent = textoAyuda();
    dlg.showModal();
  }

  chkMostrar.addEventListener("change", () => { $("#dlg-ayuda").textContent = textoAyuda(); });
  $("#btn-cancelar").addEventListener("click", () => dlg.close());
  $("#btn-comenzar").addEventListener("click", () => {
    dlg.close();
    const { doc, nivel, numero } = seleccion;
    iniciar(doc, nivel, numero, buscar(doc.id, nivel.id, numero).preguntas, { mostrar: chkMostrar.checked, mezclar: chkMezclar.checked });
  });

  // ---------- Confirmación dentro de la página ----------
  // No se usa confirm(): algunos navegadores y visores embebidos no muestran los diálogos nativos.
  let alConfirmar = null;
  function confirmar(titulo, texto, boton, accion) {
    $("#conf-titulo").textContent = titulo;
    $("#conf-texto").textContent = texto;
    $("#conf-si").textContent = boton;
    alConfirmar = accion;
    dlgConfirmar.showModal();
  }
  $("#conf-no").addEventListener("click", () => dlgConfirmar.close());
  $("#conf-si").addEventListener("click", () => {
    const accion = alConfirmar;
    alConfirmar = null;
    dlgConfirmar.close();
    if (accion) accion();
  });

  // ---------- Examen ----------
  function prepararOpciones(p, orden) {
    const opciones = orden || barajar([p.ok, ...p.mal]);
    return { ...p, opciones, correcta: opciones.indexOf(p.ok) };
  }

  function nombreExamen(e, corto = false) {
    const parte = e.practica ? "Falladas" : `${e.nivel.nombre} · Examen ${e.numero}`;
    return corto ? parte : `${e.doc.titulo} · ${parte}`;
  }

  function iniciar(doc, nivel, numero, preguntasBase, { mostrar, mezclar, practica = false }) {
    const lista = mezclar ? barajar(preguntasBase) : preguntasBase.slice();
    estado = {
      doc,
      nivel,
      numero,
      mostrar,
      mezclar,
      practica,
      preguntas: lista.map((p) => prepararOpciones(p)),
      respuestas: lista.map(() => null),
      actual: 0,
    };
    persistir();
    entrarAlQuiz();
  }

  function entrarAlQuiz() {
    const { doc, mostrar } = estado;
    const titulo = $("#quiz-titulo");
    // En el celular se oculta el nombre de la norma para que el título quepa en una línea.
    titulo.replaceChildren(el("span", "pal-larga", `${doc.titulo} · `), nombreExamen(estado, true));
    titulo.title = nombreExamen(estado);
    const badge = $("#quiz-modo");
    badge.textContent = mostrar ? "Con respuestas" : "Modo examen";
    badge.classList.toggle("con-respuestas", mostrar);
    mostrarPantalla("quiz");
    pintarPregunta();
  }

  // Guarda el avance para poder continuar si se cierra o recarga la página (frecuente en el celular).
  function persistir() {
    if (!estado) return;
    guardar(CLAVE_CURSO, {
      doc: estado.doc.id,
      nivel: estado.nivel.id,
      numero: estado.numero,
      mostrar: estado.mostrar,
      mezclar: estado.mezclar,
      practica: estado.practica,
      items: estado.preguntas.map((p) => ({ id: p.id, opciones: p.opciones })),
      respuestas: estado.respuestas,
      actual: estado.actual,
    });
  }

  function reconstruir(g) {
    if (!g || !Array.isArray(g.items) || !g.items.length) return null;
    const doc = docPorId(g.doc);
    const nivel = nivelPorId(g.nivel);
    const numero = g.numero | 0;
    if (!doc || !nivel || numero < 1 || numero > EXAMENES_POR_NIVEL) return null;
    const todas = examenes.filter((e) => e.doc === doc.id).flatMap((e) => e.preguntas);
    const preguntas = [];
    for (const it of g.items) {
      const p = todas.find((x) => x.id === it.id);
      const mismas = p && Array.isArray(it.opciones) && it.opciones.length === 4 &&
        [p.ok, ...p.mal].every((o) => it.opciones.includes(o));
      if (!mismas) return null; // las preguntas cambiaron desde que se guardó
      preguntas.push(prepararOpciones(p, it.opciones));
    }
    const respuestas = preguntas.map((_, i) => {
      const r = g.respuestas && g.respuestas[i];
      return Number.isInteger(r) && r >= 0 && r < 4 ? r : null;
    });
    const actual = Math.min(Math.max(0, g.actual | 0), preguntas.length - 1);
    return { doc, nivel, numero, mostrar: !!g.mostrar, mezclar: !!g.mezclar, practica: !!g.practica, preguntas, respuestas, actual };
  }

  function pintarPregunta(desplazar = false) {
    const { preguntas, respuestas, actual, mostrar } = estado;
    const p = preguntas[actual];
    const elegida = respuestas[actual];
    const bloqueada = mostrar && elegida !== null;

    $("#quiz-contador").textContent = `Pregunta ${actual + 1} de ${preguntas.length}`;
    const aciertos = $("#quiz-aciertos");
    if (mostrar) {
      const resp = respuestas.filter((r) => r !== null).length;
      const ok = preguntas.filter((q, i) => respuestas[i] === q.correcta).length;
      aciertos.textContent = resp ? ` · ${ok} de ${resp} correctas` : "";
    } else {
      aciertos.textContent = "";
    }
    $("#progreso-relleno").style.width = `${((actual + 1) / preguntas.length) * 100}%`;
    $("#pregunta-tema").textContent = p.tema;
    $("#pregunta-texto").textContent = p.q;

    const cont = $("#opciones");
    cont.replaceChildren();
    p.opciones.forEach((texto, i) => {
      const b = el("button", "opcion");
      b.type = "button";
      b.disabled = bloqueada;
      b.append(el("span", "letra", LETRAS[i]), el("span", null, texto));
      if (bloqueada) {
        if (i === p.correcta) b.classList.add(i === elegida ? "ok" : "revelar");
        else if (i === elegida) b.classList.add("mal");
      } else if (i === elegida) {
        b.classList.add("sel");
      }
      b.addEventListener("click", () => responder(i));
      cont.append(b);
    });

    const exp = $("#explicacion");
    exp.hidden = !bloqueada;
    exp.replaceChildren();
    if (bloqueada) {
      const acierto = elegida === p.correcta;
      const veredicto = el("p", `veredicto ${acierto ? "ok" : "mal"}`,
        acierto ? "¡Correcto!" : `Incorrecto. La respuesta correcta es la ${LETRAS[p.correcta]}: «${p.ok}».`);
      exp.append(veredicto, ficha(p, estado.doc));
      if (desplazar) {
        const r = veredicto.getBoundingClientRect();
        if (r.bottom > window.innerHeight - 40) veredicto.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else if (mostrar) {
      precargar(p); // el recorte ya estará descargado al responder
    }

    $("#btn-anterior").disabled = actual === 0;
    const ultima = actual === preguntas.length - 1;
    $("#btn-siguiente").hidden = ultima;
    $("#btn-finalizar").hidden = !ultima;
    pintarMapa();
  }

  // ---------- Ficha de la respuesta ----------
  const recorte = (p, k) => `recortes/${p.id}-${k + 1}.png`;

  function precargar(p) {
    (p.cita || []).forEach((_, k) => { new Image().src = recorte(p, k); });
  }

  function seccion(clase, titulo, contenido, html = true) {
    const s = el("section", `bloque ${clase}`);
    s.append(el("h3", null, titulo), el("div", "cuerpo", contenido, html));
    return s;
  }

  function ficha(p, doc) {
    const f = el("div", "ficha");
    f.append(seccion("por", "¿Por qué?", p.por));

    const base = el("p", "base");
    base.append(el("span", "base-etq", "Base legal"), el("span", null, p.base));
    f.append(base);

    if (p.cita && p.cita.length) {
      const fig = el("figure", "libro");
      const cab = el("figcaption", null, "Lo dice la norma");
      cab.append(el("span", "ampliar", "Toca la imagen para ampliarla"));
      fig.append(cab);
      const textos = window.CITAS_TEXTO || {};
      p.cita.forEach(([pagina], k) => {
        const texto = textos[`${p.id}-${k + 1}`];
        if (texto) fig.append(el("blockquote", "cita-texto", texto));
        const img = el("img");
        img.src = recorte(p, k);
        img.alt = `Extracto de la página ${pagina} del PDF, con la cita resaltada.`;
        img.loading = "lazy";
        img.decoding = "async";
        const pie = `${doc.titulo} · PDF, pág. ${pagina}`;
        img.addEventListener("click", () => ampliar(img, pie, enlacePdf(doc, pagina)));
        const linea = el("p", "pagina");
        linea.append(el("span", null, `PDF, pág. ${pagina}`));
        const a = el("a", null, "Abrir en el PDF ↗");
        a.href = enlacePdf(doc, pagina);
        a.target = "_blank";
        a.rel = "noopener";
        linea.append(a);
        fig.append(img, linea);
      });
      f.append(fig);
    }

    if (p.ojo) f.append(seccion("ojo", "Ojo", p.ojo));
    const pie = el("div", "pie");
    if (p.tip) pie.append(seccion("tip", "Tip", p.tip));
    if (p.leer) pie.append(seccion("leer", "Para leer más", p.leer));
    if (pie.childElementCount) f.append(pie);
    return f;
  }

  // En el celular el extracto se ve pequeño: al tocarlo se abre a todo el ancho.
  function ampliar(img, pie, href) {
    $("#visor-img").src = img.src;
    $("#visor-img").alt = img.alt;
    $("#visor-texto").textContent = pie;
    $("#visor-pdf").href = href;
    dlgLibro.showModal();
  }
  $("#visor-cerrar").addEventListener("click", () => dlgLibro.close());
  dlgLibro.addEventListener("click", (e) => {
    if (e.target === dlgLibro || e.target.id === "visor-img") dlgLibro.close();
  });

  function pintarMapa() {
    const { preguntas, respuestas, actual, mostrar } = estado;
    const mapa = $("#mapa");
    mapa.replaceChildren();
    preguntas.forEach((p, i) => {
      const b = el("button", null, String(i + 1));
      b.type = "button";
      b.setAttribute("aria-label", `Ir a la pregunta ${i + 1}`);
      if (respuestas[i] !== null) {
        if (mostrar) b.classList.add(respuestas[i] === p.correcta ? "ok" : "mal");
        else b.classList.add("respondida");
      }
      if (i === actual) {
        b.classList.add("actual");
        b.setAttribute("aria-current", "true");
      }
      b.addEventListener("click", () => irA(i));
      mapa.append(b);
    });
  }

  function responder(i) {
    if (estado.mostrar && estado.respuestas[estado.actual] !== null) return;
    estado.respuestas[estado.actual] = i;
    persistir();
    pintarPregunta(true);
  }

  function irA(i) {
    if (i < 0 || i >= estado.preguntas.length) return;
    estado.actual = i;
    persistir();
    pintarPregunta();
    window.scrollTo(0, 0);
  }

  $("#btn-anterior").addEventListener("click", () => irA(estado.actual - 1));
  $("#btn-siguiente").addEventListener("click", () => irA(estado.actual + 1));
  $("#btn-finalizar").addEventListener("click", () => {
    const sin = estado.respuestas.filter((r) => r === null).length;
    if (sin === 0) return mostrarResultado();
    confirmar(
      "¿Finalizar el examen?",
      `Te ${sin === 1 ? "falta 1 pregunta" : `faltan ${sin} preguntas`} sin responder. Las que no respondas cuentan como no acertadas.`,
      "Finalizar",
      mostrarResultado,
    );
  });
  $("#btn-salir").addEventListener("click", () => {
    confirmar("¿Salir del examen?", "Podrás continuarlo después desde el inicio, en este mismo dispositivo.", "Salir", volverInicio);
  });

  document.addEventListener("keydown", (e) => {
    if (pantallas.quiz.hidden || dlg.open || dlgConfirmar.open || dlgLibro.open || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const idx = "abcd".indexOf(k);
    if (idx >= 0) responder(idx);
    else if (k === "arrowleft") irA(estado.actual - 1);
    else if (k === "arrowright") irA(estado.actual + 1);
  });

  // ---------- Resultado ----------
  function mostrarResultado() {
    const { doc, nivel, numero, preguntas, respuestas, mostrar, practica } = estado;
    borrar(CLAVE_CURSO);
    const aciertos = preguntas.filter((p, i) => respuestas[i] === p.correcta).length;
    const total = preguntas.length;
    const pct = Math.round((aciertos / total) * 100);

    if (!practica) {
      const mejores = leer(CLAVE_MEJORES) || {};
      const clave = `${doc.id}-${nivel.id}-${numero}`;
      const previo = mejores[clave];
      if (!previo || aciertos / total > previo.aciertos / previo.total) {
        mejores[clave] = { aciertos, total, fecha: new Date().toISOString().slice(0, 10) };
        guardar(CLAVE_MEJORES, mejores);
      }
    }

    $("#res-titulo").textContent = nombreExamen(estado);
    $("#res-nota").textContent = `${aciertos} / ${total}`;
    $("#res-porcentaje").textContent = `${pct}% de aciertos`;
    $("#res-mensaje").textContent =
      pct >= 90 ? "Excelente dominio de la norma." :
      pct >= 70 ? "Muy bien. Repasa los temas donde fallaste y vuelve a intentarlo." :
      pct >= 50 ? "Vas por buen camino: conviene releer los artículos de los temas que fallaste." :
      "Necesitas repasar la norma con más detalle. Practica las falladas con las respuestas activadas.";

    // Temas a repasar: dónde se concentran los errores.
    const temas = {};
    preguntas.forEach((p, i) => {
      if (respuestas[i] !== p.correcta) temas[p.tema] = (temas[p.tema] || 0) + 1;
    });
    const resTemas = $("#res-temas");
    resTemas.replaceChildren();
    const ordenados = Object.entries(temas).sort((a, b) => b[1] - a[1]);
    if (ordenados.length) {
      resTemas.append(el("h3", null, "Temas para repasar"));
      const ul = el("ul");
      for (const [tema, n] of ordenados) {
        const li = el("li");
        li.append(el("span", null, tema), el("span", "cuenta", `${n} ${n === 1 ? "error" : "errores"}`));
        ul.append(li);
      }
      resTemas.append(ul);
    }

    const falladas = preguntas.filter((p, i) => respuestas[i] !== p.correcta);
    const btnF = $("#btn-falladas");
    btnF.hidden = falladas.length === 0;
    btnF.textContent = `Practicar las que fallé (${falladas.length})`;

    const btnRev = $("#btn-revisar");
    btnRev.textContent = mostrar ? "Ver revisión completa" : "Revisar mis respuestas";
    btnRev.disabled = false;
    $("#revision").hidden = true;
    $("#revision").replaceChildren();
    mostrarPantalla("resultado");
  }

  function pintarRevision() {
    const { preguntas, respuestas, doc } = estado;
    const cont = $("#revision");
    cont.replaceChildren();
    preguntas.forEach((p, i) => {
      const elegida = respuestas[i];
      const acierto = elegida === p.correcta;
      const item = el("div", `rev-item ${acierto ? "ok" : "mal"}`);
      item.append(el("p", "etiqueta-tema", p.tema), el("h3", null, `${i + 1}. ${p.q}`));
      const linea = (etq, txt) => {
        const par = el("p");
        par.append(el("span", "etq", `${etq}: `), el("span", null, txt));
        return par;
      };
      item.append(
        linea("Tu respuesta", elegida === null ? "Sin responder" : `${LETRAS[elegida]}. ${p.opciones[elegida]}`),
        linea("Correcta", `${LETRAS[p.correcta]}. ${p.opciones[p.correcta]}`),
        ficha(p, doc),
      );
      cont.append(item);
    });
    cont.hidden = false;
  }

  $("#btn-revisar").addEventListener("click", () => {
    pintarRevision();
    $("#btn-revisar").disabled = true;
    $("#revision").scrollIntoView({ behavior: "smooth" });
  });
  $("#btn-falladas").addEventListener("click", () => {
    const { doc, nivel, numero, preguntas, respuestas } = estado;
    const falladas = preguntas.filter((p, i) => respuestas[i] !== p.correcta);
    if (falladas.length) iniciar(doc, nivel, numero, falladas, { mostrar: true, mezclar: false, practica: true });
  });
  $("#btn-repetir").addEventListener("click", () => {
    const { doc, nivel, numero, mostrar, mezclar } = estado;
    iniciar(doc, nivel, numero, buscar(doc.id, nivel.id, numero).preguntas, { mostrar, mezclar });
  });
  $("#btn-inicio").addEventListener("click", volverInicio);

  function volverInicio() {
    estado = null;
    pintarInicio();
    mostrarPantalla("inicio");
  }

  pintarInicio();
})();
