# Examen de Supervisión Ambiental Minera

Exámenes de práctica para preparar la evaluación de **Especialista en Supervisión Ambiental del sector minero**, sobre tres normas:

| Norma | Enfoque |
| --- | --- |
| Reglamento de Supervisión del OEFA | Todo el reglamento |
| TUO de la Ley 27444, LPAG (D. S. 004-2019-JUS) | Plazos y procedimiento administrativo sancionador (PAS), fiscalización, notificación y recursos, aplicados al sector minero |
| Nuevo TUO de la LPAG (D. S. 006-2026-JUS) | Qué cambió: la nueva numeración de los artículos, las normas modificatorias y el PAS en el texto de 2026 |

Son 2 niveles por norma (Fácil y Medio), 5 exámenes por nivel, 20 preguntas por examen y 4 alternativas: 600 preguntas en total.

Por defecto, al responder cada pregunta se muestra:

- si acertaste y por qué;
- la base legal (artículo y numeral);
- el texto exacto de la norma y el extracto de la página del PDF con la cita resaltada, más el enlace para abrir el PDF en esa página;
- un **Ojo**, con la trampa típica;
- un **Tip** para recordarlo;
- dónde **leer más** (sección, artículos y páginas).

Al terminar, la app muestra los temas para repasar y permite **practicar las preguntas falladas**. Si se cierra la página a mitad del examen, el avance se puede continuar después.

Abrir: https://washimon7.github.io/examen-supervision-ambiental-minera/

## Desarrollo

Es una app estática en HTML, CSS y JavaScript, sin dependencias ni compilación.

- `data/<norma>-<nivel>-<n>.js`: las preguntas (`oefa`, `lpag`, `ds006`; `facil`, `medio`; 1–5).
- `pdf/`: las normas en PDF.
- `tools/citas.py`: valida las preguntas y comprueba que cada cita exista en la página indicada del PDF. Además genera `recortes/*.png` y `data/citas-texto.js`. Requiere PyMuPDF.
- `tests/e2e.mjs`: prueba en Chrome con tamaño de celular. Recorre los 30 exámenes y revisa en cada respuesta la ficha, el recorte, el enlace al PDF, el modo examen, la práctica de falladas, la opción de continuar y que nada desborde a lo ancho.

```bash
python3 tools/citas.py          # valida y regenera los recortes
npm install && npm test         # validación + prueba en el navegador
```
