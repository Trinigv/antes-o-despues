// Función `api` (Supabase Edge Function, Deno).
// Rutas:
//   GET  /api/puzzle?date=YYYY-MM-DD  → partida del día SIN años (salvo la carta de inicio)
//   POST /api/free    {categories, exclude}
//   POST /api/check   {placed, eventId, slot} → {ok, dir?, event?}
//   POST /api/finish  {date, anonId, ids, misses} → {players, average, percentile}
import { createClient } from "jsr:@supabase/supabase-js@2";

type Category = "sel" | "clu" | "ido" | "mun";
interface Row {
  id: string;
  year: number;
  category: Category;
  title: string;
  description: string;
  status: string;
}

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const CORS = {
  "access-control-allow-origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "access-control-allow-headers": "content-type, authorization, apikey, x-client-info",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

const pub = (e: Row) => ({ id: e.id, category: e.category, title: e.title, description: e.description });
const revealed = (e: Row) => ({ ...pub(e), year: e.year });

async function eventsById(ids: string[]): Promise<Map<string, Row>> {
  const { data, error } = await db.from("events").select("id,year,category,title,description,status").in("id", ids);
  if (error) throw error;
  return new Map((data as Row[]).map((e) => [e.id, e]));
}

function toPuzzle(ids: string[], map: Map<string, Row>, date: string | null, number: number | null) {
  const evs = ids.map((id) => map.get(id)).filter((e): e is Row => !!e);
  if (evs.length !== ids.length) throw new Error("La partida referencia eventos inexistentes");
  return { date, number, anchor: revealed(evs[0]), cards: evs.slice(1).map(pub) };
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function daily(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "fecha inválida" }, 400);
  const { data, error } = await db.from("puzzles").select("date,number,ids").eq("date", date).maybeSingle();
  if (error) throw error;
  if (!data) return json({ error: "no hay partida para esa fecha" }, 404);
  return json(toPuzzle(data.ids, await eventsById(data.ids), data.date, data.number));
}

async function free(body: { categories?: Category[]; exclude?: string[] }) {
  let q = db.from("events").select("id,year,category,title,description,status").eq("status", "approved");
  if (body.categories?.length) q = q.in("category", body.categories);
  const { data, error } = await q;
  if (error) throw error;
  const exclude = new Set(body.exclude ?? []);
  const pool = shuffle((data as Row[]).filter((e) => !exclude.has(e.id)));
  const fallback = shuffle(data as Row[]);
  const pick = (src: Row[]) => {
    const years = new Set<number>();
    const out: Row[] = [];
    for (const e of src) {
      if (years.has(e.year)) continue;
      years.add(e.year);
      out.push(e);
      if (out.length === 9) break;
    }
    return out;
  };
  let set = pick(pool);
  if (set.length < 9) set = pick(fallback);
  if (set.length < 9) return json({ error: "no hay eventos suficientes" }, 422);
  return json(toPuzzle(set.map((e) => e.id), new Map(set.map((e) => [e.id, e])), null, null));
}

async function check(body: { placed: string[]; eventId: string; slot: number }) {
  const { placed, eventId, slot } = body;
  if (!Array.isArray(placed) || !placed.length || placed.length > 9 || typeof eventId !== "string" || !Number.isInteger(slot)) {
    return json({ error: "pedido inválido" }, 400);
  }
  const map = await eventsById([...placed, eventId]);
  const years = placed.map((id) => map.get(id)?.year);
  const target = map.get(eventId);
  if (!target || years.some((y) => y === undefined)) return json({ error: "evento desconocido" }, 400);
  const ys = years as number[];
  for (let i = 1; i < ys.length; i++) if (ys[i - 1] >= ys[i]) return json({ error: "línea desordenada" }, 400);
  const left = slot === 0 ? -Infinity : ys[slot - 1];
  const right = slot === ys.length ? Infinity : ys[slot];
  if (slot < 0 || slot > ys.length) return json({ error: "hueco inválido" }, 400);
  if (left < target.year && target.year < right) return json({ ok: true, event: revealed(target) });
  return json({ ok: false, dir: slot > 0 && target.year < ys[slot - 1] ? "left" : "right" });
}

async function finish(body: { date: string | null; anonId: string; ids: string[]; misses: number[] }) {
  const { date, anonId, ids, misses } = body;
  if (!Array.isArray(misses) || misses.length !== 8 || !Array.isArray(ids) || ids.length !== 9) return json({ error: "pedido inválido" }, 400);
  const score = misses.reduce((s, m, i) => s + Math.max(0, i + 1 - Math.max(0, m | 0)), 0);
  await db.rpc("record_play", { p_ids: ids, p_misses: misses });
  if (!date) return json(null); // partida libre: sin ranking
  if (typeof anonId === "string" && anonId.length <= 64) {
    await db.from("plays").upsert({ date, anon_id: anonId, score, misses }, { onConflict: "date,anon_id", ignoreDuplicates: true });
  }
  const { data, error } = await db.rpc("day_stats", { p_date: date, p_score: score });
  if (error) throw error;
  const row = (data as { players: number; average: number; percentile: number }[])[0];
  return json({ players: Number(row.players), average: Number(row.average), percentile: Number(row.percentile) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const route = url.pathname.replace(/^.*\/api/, "") || "/";
  try {
    if (req.method === "GET" && route === "/puzzle") return await daily(url.searchParams.get("date") ?? "");
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (route === "/free") return await free(body);
      if (route === "/check") return await check(body);
      if (route === "/finish") return await finish(body);
    }
    return json({ error: "ruta desconocida" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: "error interno" }, 500);
  }
});
