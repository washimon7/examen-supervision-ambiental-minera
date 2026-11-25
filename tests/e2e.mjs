// Prueba de punta a punta en el navegador: la app se usa como en un celular (390 × 844, táctil).
// Uso: node tests/e2e.mjs [carpeta-del-sitio | URL]   (por defecto, la raíz del proyecto)
// Requiere Google Chrome instalado (playwright-core lo usa con channel: "chrome").
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ARG = process.argv[2] || "";
const REMOTO = /^https?:\/\//.test(ARG);
const PROYECTO = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAIZ = REMOTO ? PROYECTO : resolve(ARG || PROYECTO);
const SALIDA = join(RAIZ, "test-results");
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".png": "image/png", ".pdf": "application/pdf" };

let fallos = 0;
let pruebas = 0;
function comprobar(cond, msg) {
  pruebas++;
  if (!cond) {
    fallos++;
    console.log(`  ✗ ${msg}`);
  }
}

const servidor = createServer(async (req, res) => {
  const ruta = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^\/+/, "") || "index.html";
  try {
    const cuerpo = await readFile(join(RAIZ, ruta));
    res.writeHead(200, { "content-type": TIPOS[extname(ruta)] || "application/octet-stream" });
    res.end(cuerpo);
  } catch {
    res.writeHead(404);
    res.end("no encontrado");
  }
});
await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
const URL_APP = REMOTO ? ARG : `http://127.0.0.1:${servidor.address().port}/`;
console.log(`Probando ${URL_APP}`);
await mkdir(SALIDA, { recursive: true });

const navegador = await chromium.launch({ channel: "chrome", headless: true });
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "es-PE",
});
const pagina = await contexto.newPage();
const erroresConsola = [];
pagina.on("pageerror", (e) => erroresConsola.push(String(e)));
pagina.on("console", (m) => { if (m.type() === "error") erroresConsola.push(m.text()); });
const fallidas = [];
pagina.on("response", (r) => { if (r.status() >= 400) fallidas.push(`${r.status()} ${r.url()}`); });

const sinDesborde = () => pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

// ---------- Inicio ----------
console.log("Inicio");
await pagina.goto(URL_APP);
const resumen = await pagina.evaluate(() => {
  const ex = window.EXAMENES || [];
  return {
    examenes: ex.length,
    preguntas: ex.reduce((n, e) => n + e.preguntas.length, 0),
    botones: document.querySelectorAll(".btn-examen").length,
    activos: document.querySelectorAll(".btn-examen:not(:disabled)").length,
    docs: document.querySelectorAll(".documento").length,
    archivos: document.querySelectorAll('script[src^="data/"][src$=".js"]:not([src*="citas-texto"])').length,
  };
});
console.log(`  ${resumen.examenes} exámenes · ${resumen.preguntas} preguntas`);
comprobar(resumen.docs === 3, `deben verse 3 normas (hay ${resumen.docs})`);
comprobar(resumen.botones === 30, `deben verse 30 botones de examen (hay ${resumen.botones})`);
comprobar(resumen.activos === resumen.examenes, `cada examen cargado debe tener su botón activo (${resumen.activos} de ${resumen.examenes})`);
comprobar(resumen.examenes === resumen.archivos && resumen.examenes > 0, `deben cargarse los ${resumen.archivos} exámenes enlazados (hay ${resumen.examenes})`);
comprobar(await sinDesborde(), "el inicio no debe desbordar a lo ancho en el celular");
await pagina.screenshot({ path: join(SALIDA, "inicio.png") });

// ---------- Recorrer todos los exámenes ----------
const lista = await pagina.evaluate(() => (window.EXAMENES || []).map((e) => ({ doc: e.doc, nivel: e.nivel, numero: e.numero, n: e.preguntas.length })));
let primera = true;
for (const ex of lista) {
  const nombre = `${ex.doc}-${ex.nivel}-${ex.numero}`;
  const idx = await pagina.evaluate(({ doc, nivel, numero }) => {
    const docs = ["oefa", "lpag", "ds006"];
    const niveles = ["facil", "medio"];
    return docs.indexOf(doc) * 10 + niveles.indexOf(nivel) * 5 + (numero - 1);
  }, ex);
  await pagina.locator(".btn-examen").nth(idx).tap();
  await pagina.waitForSelector("#dlg-inicio[open]");
  comprobar(await pagina.isChecked("#chk-mostrar"), `${nombre}: «Mostrar la respuesta» debe venir activado por defecto`);
  await pagina.tap("#btn-comenzar");
  await pagina.waitForSelector("#pantalla-quiz:not([hidden])");

  for (let i = 0; i < ex.n; i++) {
    const opciones = await pagina.locator(".opcion").allTextContents();
    comprobar(opciones.length === 4 && new Set(opciones).size === 4, `${nombre} p${i + 1}: debe haber 4 alternativas distintas`);
    // Se responde al azar para recorrer aciertos y errores.
    await pagina.locator(".opcion").nth(Math.floor(Math.random() * 4)).tap();
    await pagina.waitForSelector("#explicacion:not([hidden]) .ficha");
    const ficha = await pagina.evaluate(async () => {
      const imgs = [...document.querySelectorAll("#explicacion .libro img")];
      await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok; }))));
      const q = (s) => document.querySelector(`#explicacion ${s}`);
      return {
        veredicto: !!q(".veredicto"),
        por: (q(".por .cuerpo")?.textContent || "").trim().length,
        base: (q(".base")?.textContent || "").trim().length,
        imgs: imgs.length,
        imgsOk: imgs.filter((img) => img.naturalWidth > 0).length,
        textos: [...document.querySelectorAll("#explicacion .cita-texto")].filter((b) => b.textContent.trim().length > 15).length,
        pdf: [...document.querySelectorAll("#explicacion .libro .pagina a")].map((a) => a.getAttribute("href")),
        ojo: (q(".ojo .cuerpo")?.textContent || "").trim().length,
        tip: (q(".tip .cuerpo")?.textContent || "").trim().length,
        leer: (q(".leer .cuerpo")?.textContent || "").trim().length,
        correcta: document.querySelectorAll(".opcion.ok, .opcion.revelar").length,
        bloqueadas: [...document.querySelectorAll(".opcion")].every((b) => b.disabled),
      };
    });
    const t = `${nombre} p${i + 1}`;
    comprobar(ficha.veredicto, `${t}: falta el veredicto`);
    comprobar(ficha.correcta === 1, `${t}: debe marcarse exactamente una alternativa correcta`);
    comprobar(ficha.bloqueadas, `${t}: las alternativas deben bloquearse tras responder`);
    comprobar(ficha.por > 20, `${t}: falta la explicación`);
    comprobar(ficha.base > 10, `${t}: falta la base legal`);
    comprobar(ficha.imgs > 0 && ficha.imgsOk === ficha.imgs, `${t}: el recorte del PDF no cargó (${ficha.imgsOk}/${ficha.imgs})`);
    comprobar(ficha.textos === ficha.imgs, `${t}: falta el texto de la cita (${ficha.textos}/${ficha.imgs})`);
    comprobar(ficha.pdf.length === ficha.imgs && ficha.pdf.every((h) => /^pdf\/.+\.pdf#page=\d+$/.test(h)), `${t}: enlace al PDF inválido`);
    comprobar(ficha.ojo > 10 && ficha.tip > 10 && ficha.leer > 10, `${t}: faltan «Ojo», «Tip» o «Para leer más»`);
    if (primera && i === 0) {
      comprobar(await sinDesborde(), `${t}: la ficha no debe desbordar a lo ancho`);
      await pagina.screenshot({ path: join(SALIDA, "pregunta-respondida.png"), fullPage: true });
      // El extracto se amplía al tocarlo.
      await pagina.locator("#explicacion .libro img").first().tap();
      comprobar(await pagina.isVisible("#dlg-libro[open]"), `${t}: el extracto debe ampliarse al tocarlo`);
      await pagina.tap("#visor-cerrar");
    }
    if (i < ex.n - 1) await pagina.tap("#btn-siguiente");
  }
  comprobar(await sinDesborde(), `${nombre}: el examen no debe desbordar a lo ancho`);
  await pagina.tap("#btn-finalizar");
  await pagina.waitForSelector("#pantalla-resultado:not([hidden])");
  const nota = await pagina.textContent("#res-nota");
  comprobar(new RegExp(`^\\d+ / ${ex.n}$`).test(nota.trim()), `${nombre}: nota inválida «${nota}»`);

  if (primera) {
    await pagina.screenshot({ path: join(SALIDA, "resultado.png"), fullPage: true });
    // Practicar las falladas: solo aparecen las preguntas no acertadas.
    const aciertos = Number(nota.split("/")[0]);
    if (aciertos < ex.n) {
      await pagina.tap("#btn-falladas");
      await pagina.waitForSelector("#pantalla-quiz:not([hidden])");
      const total = await pagina.locator("#mapa button").count();
      comprobar(total === ex.n - aciertos, `${nombre}: la práctica de falladas debe tener ${ex.n - aciertos} preguntas (tiene ${total})`);
      await pagina.tap("#btn-salir");
      await pagina.tap("#conf-si");
    } else {
      await pagina.tap("#btn-inicio");
    }
    // La mejor nota queda registrada en el botón del examen.
    await pagina.waitForSelector("#pantalla-inicio:not([hidden])");
    comprobar(await pagina.locator(".btn-examen.hecho").count() >= 1, "la mejor nota debe mostrarse en el inicio");
  } else {
    await pagina.tap("#btn-inicio");
    await pagina.waitForSelector("#pantalla-inicio:not([hidden])");
  }
  primera = false;
}

// ---------- Continuar un examen tras recargar la página ----------
console.log("Continuar tras recargar");
await pagina.locator(".btn-examen").first().tap();
await pagina.tap("#btn-comenzar");
await pagina.locator(".opcion").first().tap();
await pagina.tap("#btn-siguiente");
await pagina.reload();
comprobar(await pagina.isVisible("#continuar"), "tras recargar debe ofrecer continuar el examen");
await pagina.tap("#btn-continuar");
comprobar((await pagina.textContent("#quiz-contador")).startsWith("Pregunta 2 "), "debe continuar en la pregunta 2");
comprobar(await pagina.locator("#mapa button.ok, #mapa button.mal").count() === 1, "debe conservar la respuesta dada");

// ---------- Modo examen (sin respuestas) ----------
console.log("Modo examen");
await pagina.tap("#btn-salir");
await pagina.tap("#conf-si");
await pagina.tap("#btn-descartar");
await pagina.locator(".btn-examen").nth(1).tap();
await pagina.locator("#chk-mostrar").setChecked(false, { force: true });
await pagina.tap("#btn-comenzar");
await pagina.locator(".opcion").first().tap();
comprobar(await pagina.isHidden("#explicacion"), "en modo examen no debe mostrarse la respuesta");
comprobar(await pagina.locator(".opcion.sel").count() === 1, "en modo examen la alternativa elegida queda marcada");
await pagina.tap("#btn-salir");
await pagina.tap("#conf-si");

// ---------- Modo oscuro ----------
await pagina.emulateMedia({ colorScheme: "dark" });
await pagina.screenshot({ path: join(SALIDA, "inicio-oscuro.png"), fullPage: false });

const ruido = erroresConsola.filter((e) => !/favicon/i.test(e));
comprobar(ruido.length === 0, `no debe haber errores en la consola: ${ruido.slice(0, 3).join(" | ")}`);
comprobar(fallidas.length === 0, `no debe haber archivos que falten: ${fallidas.slice(0, 5).join(" | ")}`);

await navegador.close();
servidor.close();
console.log(`${pruebas} comprobaciones · ${fallos} fallos · capturas en test-results/`);
process.exit(fallos ? 1 : 0);
