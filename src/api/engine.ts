import type { Category, CheckResult, Puzzle, Stats } from "../core/types";

/**
 * El juego habla con un "motor" que arma partidas y corrige jugadas.
 * - LocalEngine: todo en el navegador con data/events.json (fase 1, 100% estático).
 * - RemoteEngine: una API que nunca manda los años por adelantado (fase 2, Supabase).
 */
export interface Engine {
  readonly mode: "local" | "remote";
  daily(date: string): Promise<Puzzle>;
  free(categories: Category[], exclude: string[]): Promise<Puzzle>;
  /** placed: ids de la línea ya ordenada; slot: hueco elegido (0..placed.length) */
  check(placed: string[], eventId: string, slot: number): Promise<CheckResult>;
  finish(result: FinishInput): Promise<Stats | null>;
}

export interface FinishInput {
  date: string | null;
  anonId: string;
  ids: string[];
  misses: number[];
}

export async function createEngine(): Promise<Engine> {
  // VITE_API_URL se reemplaza en build: si no está, el código remoto ni se incluye
  if (import.meta.env.VITE_API_URL) {
    const { RemoteEngine } = await import("./remote");
    return new RemoteEngine(import.meta.env.VITE_API_URL);
  }
  const { LocalEngine } = await import("./local");
  return new LocalEngine();
}
