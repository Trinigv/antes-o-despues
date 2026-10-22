import { PUZZLE_SIZE } from "./config";
import { addDays, puzzleNumber } from "./dates";
import { seeded } from "./rng";
import { pickSet } from "./select";
import type { GameEvent, PuzzleFile } from "./types";

/**
 * Cuántos días hacia atrás se evitan los eventos ya usados.
 * Con 233 eventos y 9 por día da ~24 días sin repetir nada.
 */
export function cooldownDays(poolSize: number): number {
  return Math.max(0, Math.floor(poolSize / PUZZLE_SIZE) - 2);
}

/**
 * Genera las partidas que faltan entre `from` y `to` (inclusive), sin tocar las existentes.
 * Cada día evita los eventos de los últimos `cooldownDays` días.
 */
export function extendSchedule(
  events: readonly GameEvent[],
  existing: Readonly<Record<string, PuzzleFile>>,
  from: string,
  to: string,
): PuzzleFile[] {
  const approved = events.filter((e) => e.status === "approved");
  const known = new Set(approved.map((e) => e.id));
  const cooldown = cooldownDays(approved.length);
  const all: Record<string, PuzzleFile> = { ...existing };
  const created: PuzzleFile[] = [];

  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (all[d]) continue;
    const avoid = new Set<string>();
    for (let back = 1; back <= cooldown; back++) {
      all[addDays(d, -back)]?.ids.forEach((id) => avoid.add(id));
    }
    const rand = seeded(`dia:${d}`);
    const set =
      pickSet(approved, rand, { avoid }) ??
      // Si el pool quedó corto, relajamos el cooldown a la mitad y después a cero
      pickSet(approved, rand, { avoid: halfAvoid(all, d, Math.floor(cooldown / 2)) }) ??
      pickSet(approved, rand);
    if (!set) throw new Error(`No hay eventos suficientes para armar la partida del ${d}`);
    const file: PuzzleFile = { date: d, number: puzzleNumber(d), ids: set.map((e) => e.id) };
    all[d] = file;
    created.push(file);
  }

  // Avisar si alguna partida existente referencia eventos borrados
  for (const p of Object.values(all)) {
    const missing = p.ids.filter((id) => !known.has(id));
    if (missing.length) console.warn(`La partida del ${p.date} usa eventos que ya no existen: ${missing.join(", ")}`);
  }
  return created;
}

function halfAvoid(all: Record<string, PuzzleFile>, d: string, days: number): Set<string> {
  const s = new Set<string>();
  for (let back = 1; back <= days; back++) all[addDays(d, -back)]?.ids.forEach((id) => s.add(id));
  return s;
}
