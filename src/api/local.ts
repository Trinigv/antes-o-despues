import eventsJson from "../../data/events.json";
import { direction, fits } from "../core/rules";
import { pickSet } from "../core/select";
import { seeded } from "../core/rng";
import { puzzleNumber } from "../core/dates";
import { toPublic, toRevealed, type Category, type CheckResult, type GameEvent, type Puzzle, type PuzzleFile } from "../core/types";
import type { Engine } from "./engine";

const EVENTS = (eventsJson as GameEvent[]).filter((e) => e.status === "approved");
const BY_ID = new Map(EVENTS.map((e) => [e.id, e]));

function toPuzzle(ids: string[], date: string | null, number: number | null): Puzzle {
  const evs = ids.map((id) => {
    const e = BY_ID.get(id);
    if (!e) throw new Error(`Evento desconocido: ${id}`);
    return e;
  });
  return { date, number, anchor: toRevealed(evs[0]), cards: evs.slice(1).map(toPublic) };
}

export class LocalEngine implements Engine {
  readonly mode = "local" as const;

  async daily(date: string): Promise<Puzzle> {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}puzzles/${date}.json`, { cache: "no-cache" });
      if (res.ok) {
        const file: PuzzleFile = await res.json();
        if (file.ids.every((id) => BY_ID.has(id))) return toPuzzle(file.ids, date, file.number);
      }
    } catch {
      /* sin red o sin archivo: usamos el respaldo */
    }
    // Respaldo determinístico: todos los que juegan ese día ven la misma partida
    const set = pickSet(EVENTS, seeded(`respaldo:${date}`));
    if (!set) throw new Error("No hay eventos suficientes");
    return toPuzzle(set.map((e) => e.id), date, puzzleNumber(date));
  }

  async free(categories: Category[], exclude: string[]): Promise<Puzzle> {
    const avoid = new Set(exclude);
    const set =
      pickSet(EVENTS, Math.random, { avoid, categories }) ??
      pickSet(EVENTS, Math.random, { categories }) ??
      pickSet(EVENTS, Math.random);
    if (!set) throw new Error("No hay eventos suficientes");
    return toPuzzle(set.map((e) => e.id), null, null);
  }

  async check(placed: string[], eventId: string, slot: number): Promise<CheckResult> {
    const years = placed.map((id) => BY_ID.get(id)!.year);
    const e = BY_ID.get(eventId)!;
    return fits(years, e.year, slot) ? { ok: true, event: toRevealed(e) } : { ok: false, dir: direction(years, e.year, slot) };
  }

  async finish() {
    return null; // sin backend no hay estadísticas globales
  }
}
