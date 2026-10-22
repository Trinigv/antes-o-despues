/**
 * Sube eventos y partidas del repo a Supabase (fase 2).
 * El repo sigue siendo la fuente de verdad; esto solo copia.
 * Las estadísticas (plays, first_try_hits) no se pisan porque no se envían.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run sync
 */
import { readEvents, readPuzzles } from "./lib";

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están definidas: no hay nada que sincronizar.");
  process.exit(0);
}

async function upsert(table: string, rows: object[], conflict: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${conflict}`, {
      method: "POST",
      headers: {
        apikey: key!,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  }
  console.log(`✓ ${rows.length} filas en ${table}`);
}

const events = readEvents().map(({ id, year, date, precision, category, title, description, tags, source, status }) => ({
  id, year, date, precision, category, title, description, tags, source, status, updated_at: new Date().toISOString(),
}));
await upsert("events", events, "id");
await upsert("puzzles", Object.values(readPuzzles()), "date");
