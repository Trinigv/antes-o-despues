# Antes o Después · Fútbol ⚽

Juego diario: arrastrá cada momento del fútbol argentino a su lugar en la línea de tiempo.
Partida nueva todos los días, igual para todos, sin repetir eventos durante semanas.

- **Puntaje**: el evento #k vale k puntos, cada error resta 1 (mínimo 0). Máximo 36.
- **Modos**: partida del día y partida libre (con filtro por categoría).
- **Categorías**: Selección, Clubes, Ídolos, Mundial.

## Arquitectura

```
data/events.json        ← fuente de verdad de los eventos (git = CMS, PR = revisión)
data/inbox.md           ← ideas cargadas a mano; la ingesta las convierte en cartas
data/ingest-state.json  ← fuentes ya procesadas (para no re-proponer lo descartado)
public/puzzles/*.json   ← partidas del día pre-generadas (inmutables una vez publicadas)
src/core/               ← lógica pura compartida: reglas, selección, calendario, validación
src/api/                ← motor local (estático) o remoto (Supabase), elegido en build
src/ui/, src/main.ts    ← interfaz: drag and drop, compartir, PWA
scripts/                ← validate, build-puzzles, ingest (Wikidata + Claude), sync-supabase
supabase/               ← fase 2: SQL + función `api` que valida jugadas en el servidor
.github/workflows/      ← CI, ingesta nocturna con PR, deploy de Supabase
```

### Flujo de datos

1. **Todas las noches** (`nightly.yml`, 03:00 ART):
   - `npm run puzzles` genera las partidas de los próximos 30 días y las commitea a `main` → Netlify redeploya.
   - `npm run ingest` busca hechos nuevos en Wikidata y en `data/inbox.md`, Claude redacta título y descripción, y se abre un **PR** con las cartas nuevas.
2. **Vos revisás el PR**: corregís lo que haga falta, borrás lo que no sirve y mergeás. Mergear = publicar.
3. Las partidas nuevas incluyen esos eventos a partir del día siguiente.

**Regla de oro:** la fecha de un evento siempre sale de una fuente estructurada o de vos. El LLM solo escribe el texto.

### Partidas sin repetir

`src/core/schedule.ts` arma cada día 9 eventos con años distintos, repartidos por categoría, evitando todo lo usado en los últimos `floor(eventos/9) − 2` días (~24 días con 233 eventos). Cuantos más eventos, más larga la ventana. Las partidas publicadas nunca se regeneran.

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest: reglas, calendario, validación de datos
npm run validate     # chequea events.json y partidas (años en el texto, duplicados, etc.)
npm run puzzles      # genera partidas faltantes (hoy → +30 días)
npm run ingest -- --dry --since 2020   # prueba la ingesta sin escribir
npm run build
```

### Cargar eventos a mano

Opción A: agregá una línea a `data/inbox.md` y esperá la ingesta (o corré el workflow a mano):

```
- 2001-12-27 | clu | Racing sale campeón con Mostaza Merlo | https://es.wikipedia.org/wiki/...
```

Opción B: editá `data/events.json` directo. `npm run validate` te avisa si el título menciona un año, usa "antes/después", etc.

## Deploy (fase 1, estático)

1. En Netlify: **Add new site → Import from Git** → este repo. La config ya está en `netlify.toml`.
2. Variables de entorno opcionales: `VITE_SITE_URL` (link para compartir), `VITE_PLAUSIBLE_DOMAIN` (analítica).
3. En GitHub → Settings → Secrets → Actions: `ANTHROPIC_API_KEY` para que la ingesta redacte con Claude. Sin la key, la ingesta usa una plantilla y deja las cartas en `pending`.
4. Settings → Actions → General → Workflow permissions: **Read and write** y **Allow GitHub Actions to create pull requests**.

## Fase 2: Supabase (validación en el servidor y estadísticas)

En fase 1 los años viajan en el bundle (cualquiera puede verlos en el código). En fase 2 el navegador solo recibe el año **después** de ubicar bien cada carta, y se guardan estadísticas.

1. Creá un proyecto en Supabase.
2. Cargá estos secrets en GitHub: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.
3. Corré el workflow **Supabase** (aplica la migración, deploya la función `api` y sincroniza datos).
4. En Netlify: `VITE_API_URL=https://<ref>.supabase.co/functions/v1/api` y redeploy.

Con eso:
- `GET /puzzle?date=` devuelve la partida sin años, `POST /check` corrige cada jugada.
- `POST /finish` guarda el puntaje y devuelve jugadores del día, promedio y percentil.
- La vista `event_difficulty` muestra qué porcentaje acierta cada evento al primer intento.

## Próximos pasos sugeridos

- Usar `event_difficulty` para ordenar las cartas de fácil a difícil dentro de cada partida.
- Sumar una fuente de resultados en vivo (API-Football, football-data.org) a `scripts/ingest/`.
- Notificaciones push diarias desde la PWA.
