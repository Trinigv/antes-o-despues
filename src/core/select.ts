import { PUZZLE_SIZE } from "./config";
import { shuffle } from "./rng";
import type { Category, GameEvent } from "./types";

/**
 * Elige PUZZLE_SIZE eventos con años distintos, repartiendo entre categorías por turnos.
 * Devuelve null si no hay suficientes eventos disponibles.
 */
export function pickSet(
  pool: readonly GameEvent[],
  rand: () => number,
  opts: { avoid?: ReadonlySet<string>; categories?: readonly Category[]; size?: number } = {},
): GameEvent[] | null {
  const size = opts.size ?? PUZZLE_SIZE;
  const avoid = opts.avoid ?? new Set<string>();
  const cats = opts.categories?.length ? opts.categories : [...new Set(pool.map((e) => e.category))];

  const buckets = new Map<Category, GameEvent[]>();
  for (const c of cats) {
    buckets.set(
      c,
      shuffle(
        pool.filter((e) => e.category === c && e.status === "approved" && !avoid.has(e.id)),
        rand,
      ),
    );
  }

  const order = shuffle(cats, rand);
  const out: GameEvent[] = [];
  const years = new Set<number>();
  let idle = 0;
  for (let turn = 0; out.length < size && idle < order.length; turn++) {
    const bucket = buckets.get(order[turn % order.length])!;
    const k = bucket.findIndex((e) => !years.has(e.year));
    if (k < 0) {
      idle++;
      continue;
    }
    idle = 0;
    const [e] = bucket.splice(k, 1);
    out.push(e);
    years.add(e.year);
  }
  return out.length === size ? shuffle(out, rand) : null;
}
