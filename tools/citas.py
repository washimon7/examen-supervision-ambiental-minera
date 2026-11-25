#!/usr/bin/env python3
"""Valida los archivos de preguntas y genera los recortes del PDF con la cita resaltada.

Uso:
  python3 tools/citas.py                  # valida todo data/*.js y genera recortes/*.png
  python3 tools/citas.py --check          # solo valida (no escribe imágenes)
  python3 tools/citas.py --check data/oefa-facil.js
  python3 tools/citas.py --buscar ds006 45 "texto"   # dice si el texto está en esa página

Cada cita es [página del PDF, "inicio del fragmento", "fin del fragmento"]. Ambos textos
deben aparecer tal cual en esa página (se ignoran espacios, guiones, mayúsculas y la forma
de las comillas). El recorte resalta en amarillo desde el inicio hasta el fin.
"""
import glob
import json
import os
import re
import sys
import unicodedata

import fitz  # PyMuPDF

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = {
    "oefa": "pdf/reglamento-supervision-oefa.pdf",
    "lpag": "pdf/tuo-lpag-ds-004-2019-jus.pdf",
    "ds006": "pdf/tuo-lpag-ds-006-2026-jus.pdf",
}
NIVELES = {"facil", "medio"}
EXAMENES_POR_NIVEL = 5
PREGUNTAS_POR_EXAMEN = 20
ZOOM = 2.2
MAX_FRAGMENTO = 1600  # caracteres normalizados entre inicio y fin

_TRANS = str.maketrans({
    "“": '"', "”": '"', "«": '"', "»": '"', "„": '"', "‘": "'", "’": "'", "´": "'",
    "–": "", "—": "", "‐": "", "‑": "", "-": "", "­": "", "°": "o", "º": "o",
})


def norm(s):
    s = unicodedata.normalize("NFKC", s).translate(_TRANS).casefold()
    return re.sub(r"\s+", "", s)


class Pagina:
    def __init__(self, page):
        self.page = page
        self.words = page.get_text("words")  # mismo orden que el texto extraído
        partes, dueño = [], []
        for i, w in enumerate(self.words):
            n = norm(w[4])
            partes.append(n)
            dueño.extend([i] * len(n))
        self.texto = "".join(partes)
        self.dueño = dueño

    def buscar(self, inicio, fin):
        a, b = norm(inicio), norm(fin)
        if not a or not b:
            return None, "inicio o fin vacío"
        i = self.texto.find(a)
        if i < 0:
            return None, f"no se encontró el INICIO «{inicio}»"
        j = self.texto.find(b, i)
        if j < 0:
            return None, f"no se encontró el FIN «{fin}» después del inicio"
        k = j + len(b) - 1
        if k - i > MAX_FRAGMENTO:
            return None, f"el fragmento es demasiado largo ({k - i} caracteres); acórtalo"
        return (self.dueño[i], self.dueño[k]), None


_cache = {}


def pagina(doc_id, num):
    clave = (doc_id, num)
    if clave not in _cache:
        d = _docs(doc_id)
        if not 1 <= num <= len(d):
            return None
        _cache[clave] = Pagina(d[num - 1])
    return _cache[clave]


_abiertos = {}


def _docs(doc_id):
    if doc_id not in _abiertos:
        _abiertos[doc_id] = fitz.open(os.path.join(RAIZ, DOCS[doc_id]))
    return _abiertos[doc_id]


def recortar(pg, w0, w1, salida):
    words = pg.words
    marcadas = words[w0:w1 + 1]
    # Líneas completas (bloque, línea) que contienen texto marcado.
    lineas = {}
    for w in words:
        lineas.setdefault((w[5], w[6]), fitz.Rect(w[:4]))
        lineas[(w[5], w[6])] |= fitz.Rect(w[:4])
    claves = {(w[5], w[6]) for w in marcadas}
    nucleo = fitz.Rect()
    for c in claves:
        nucleo |= lineas[c]
    alto = sorted(r.height for r in lineas.values())[len(lineas) // 2] or 10
    margen = alto * 1.7
    zona = fitz.Rect(nucleo.x0, nucleo.y0 - margen, nucleo.x1, nucleo.y1 + margen)
    recorte = fitz.Rect(nucleo)
    for r in lineas.values():
        cy = (r.y0 + r.y1) / 2
        if zona.y0 <= cy <= zona.y1 and r.x0 < nucleo.x1 and r.x1 > nucleo.x0:
            recorte |= r
    # Margen vertical: hasta la mitad del espacio con la línea vecina (sin cortarla a medias).
    vecinas = [r for r in lineas.values() if r.x0 < recorte.x1 and r.x1 > recorte.x0]
    arriba = [r.y1 for r in vecinas if (r.y0 + r.y1) / 2 < recorte.y0]
    abajo = [r.y0 for r in vecinas if (r.y0 + r.y1) / 2 > recorte.y1]
    y0 = max(recorte.y0 - 7, min(recorte.y0, (max(arriba) + recorte.y0) / 2)) if arriba else recorte.y0 - 7
    y1 = min(recorte.y1 + 7, max(recorte.y1, (min(abajo) + recorte.y1) / 2)) if abajo else recorte.y1 + 7
    recorte = fitz.Rect(recorte.x0 - 8, y0, recorte.x1 + 8, y1) & pg.page.rect

    annots = []
    for c in claves:
        caja = fitz.Rect()
        for w in marcadas:
            if (w[5], w[6]) == c:
                caja |= fitz.Rect(w[:4])
        a = pg.page.add_highlight_annot(caja)
        a.set_colors(stroke=(1, 0.86, 0.2))
        a.update()
        annots.append(a)
    pix = pg.page.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), clip=recorte, annots=True)
    pix.save(salida)
    for a in annots:
        pg.page.delete_annot(a)


LIGADURAS = "ﬀﬁﬂﬃﬄ"


def texto_cita(pg, w0, w1):
    """Texto legible del fragmento resaltado (une ligaduras y palabras cortadas con guion al final de línea)."""
    out, prev = "", None
    for w in pg.words[w0:w1 + 1]:
        t = unicodedata.normalize("NFKC", w[4])
        if prev is None:
            out = t
        elif prev[4][-1:] in LIGADURAS:
            out += t
        elif (prev[5], prev[6]) != (w[5], w[6]) and out.endswith("-") and t[:1].islower():
            out = out[:-1] + t
        else:
            out += " " + t
        prev = w
    out = re.sub(r"\s+([,.;:)])", r"\1", out)
    return re.sub(r"\(\s+", "(", out).strip()


def actualizar_index(rutas):
    """Pone en index.html una etiqueta <script> por cada examen que existe (sin 404 por exámenes faltantes)."""
    orden = {d: i for i, d in enumerate(DOCS)}
    def clave(r):
        doc, nivel, n = os.path.basename(r)[:-3].split("-")
        return (orden[doc], nivel != "facil", int(n))
    etiquetas = "".join(f'  <script src="data/{os.path.basename(r)}"></script>\n' for r in sorted(rutas, key=clave))
    ruta = os.path.join(RAIZ, "index.html")
    html = open(ruta, encoding="utf-8").read()
    html = re.sub(r"(  <!-- exámenes: [^\n]*-->\n).*?(  <!-- /exámenes -->)", lambda m: m.group(1) + etiquetas + m.group(2), html, flags=re.S)
    open(ruta, "w", encoding="utf-8").write(html)


def cargar(ruta):
    txt = open(ruta, encoding="utf-8").read()
    m = re.search(r"\.push\(\s*(\{.*\})\s*\)\s*;?\s*$", txt, re.S)
    if not m:
        raise ValueError("no tiene la forma (window.EXAMENES = window.EXAMENES || []).push({...});")
    return json.loads(m.group(1))


def validar(rutas, generar):
    errores, total, ids, n_citas, preguntas_vistas = [], 0, set(), 0, {}
    textos = {}
    for ruta in rutas:
        nombre = os.path.relpath(ruta, RAIZ)
        try:
            ex = cargar(ruta)
        except Exception as e:  # noqa: BLE001
            errores.append(f"{nombre}: JSON inválido: {e}")
            continue
        doc, nivel, numero = ex.get("doc"), ex.get("nivel"), ex.get("numero")
        if doc not in DOCS:
            errores.append(f"{nombre}: doc desconocido {doc!r}")
            continue
        if nivel not in NIVELES:
            errores.append(f"{nombre}: nivel desconocido {nivel!r}")
        if numero not in range(1, EXAMENES_POR_NIVEL + 1):
            errores.append(f"{nombre}: «numero» debe ser un entero de 1 a {EXAMENES_POR_NIVEL}")
        esperado = f"{doc}-{nivel}-{numero}.js"
        if os.path.basename(ruta) != esperado:
            errores.append(f"{nombre}: el archivo debe llamarse {esperado}")
        n = len(ex.get("preguntas", []))
        print(f"{nombre}: {n} preguntas")
        if n != PREGUNTAS_POR_EXAMEN:
            errores.append(f"{nombre}: tiene {n} preguntas y deben ser {PREGUNTAS_POR_EXAMEN}")
        for p in ex.get("preguntas", []):
            total += 1
            pid = p.get("id", "?")
            err = lambda m: errores.append(f"{nombre} [{pid}]: {m}")  # noqa: E731
            if pid in ids:
                err("id repetido")
            ids.add(pid)
            prefijo = f"{doc}-{'f' if nivel == 'facil' else 'm'}{numero}-"
            if not re.fullmatch(re.escape(prefijo) + r"\d\d", str(pid)):
                err(f"el id debe tener la forma {prefijo}01")
            clave_q = norm(str(p.get("q", "")))
            if clave_q in preguntas_vistas:
                err(f"pregunta repetida (igual a {preguntas_vistas[clave_q]})")
            preguntas_vistas.setdefault(clave_q, pid)
            for campo in ("id", "tema", "q", "ok", "por", "base", "ojo", "tip", "leer"):
                if not isinstance(p.get(campo), str) or not p[campo].strip():
                    err(f"falta el campo {campo}")
            mal = p.get("mal")
            if not isinstance(mal, list) or len(mal) != 3:
                err("«mal» debe tener exactamente 3 alternativas")
            else:
                todas = [norm(x) for x in [p.get("ok", "")] + mal]
                if len(set(todas)) != 4:
                    err("hay alternativas repetidas")
            citas = p.get("cita")
            if not isinstance(citas, list) or not citas:
                err("falta la cita")
                continue
            for k, c in enumerate(citas):
                n_citas += 1
                if not (isinstance(c, list) and len(c) == 3 and isinstance(c[0], int)):
                    err(f"cita {k + 1} mal formada: {c!r}")
                    continue
                pg = pagina(doc, c[0])
                if pg is None:
                    err(f"cita {k + 1}: la página {c[0]} no existe")
                    continue
                rango, problema = pg.buscar(c[1], c[2])
                if problema:
                    err(f"cita {k + 1} (p. {c[0]}): {problema}")
                    continue
                textos[f"{pid}-{k + 1}"] = texto_cita(pg, *rango)
                if generar:
                    recortar(pg, *rango, os.path.join(RAIZ, "recortes", f"{pid}-{k + 1}.png"))
    if generar and not errores:
        actualizar_index(rutas)
        with open(os.path.join(RAIZ, "data", "citas-texto.js"), "w", encoding="utf-8") as f:
            f.write("// Generado por tools/citas.py: texto de cada cita resaltada, tal como aparece en el PDF.\n")
            f.write("window.CITAS_TEXTO = " + json.dumps(textos, ensure_ascii=False, indent=0) + ";\n")
    return total, n_citas, errores


def main():
    args = sys.argv[1:]
    if args[:1] == ["--buscar"]:
        doc, num, texto = args[1], int(args[2]), " ".join(args[3:])
        pg = pagina(doc, num)
        print("ENCONTRADO" if pg and norm(texto) in pg.texto else "NO ESTÁ en esa página")
        return 0
    generar = "--check" not in args
    rutas = [a for a in args if not a.startswith("--")] or sorted(glob.glob(os.path.join(RAIZ, "data", "*-*-[0-9].js")))
    if generar:
        os.makedirs(os.path.join(RAIZ, "recortes"), exist_ok=True)
    total, n_citas, errores = validar(rutas, generar)
    for e in errores:
        print("ERROR", e)
    print(f"{len(rutas)} archivos · {total} preguntas · {n_citas} citas · {len(errores)} errores")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
