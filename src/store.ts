import { CATEGORY_KEYS, type Category, type Puzzle, type RevealedEvent, type Stats } from "./core/types";

export interface GameState {
  kind: "daily" | "free";
  puzzle: Puzzle;
  /** Línea de tiempo ordenada por año (incluye la carta de inicio) */
  placed: RevealedEvent[];
  /** Índice de la carta actual en puzzle.cards; === cards.length cuando terminó */
  step: number;
  misses: number[];
  /** Huecos ya probados (y errados) para la carta actual */
  wrong: number[];
  stats?: Stats | null;
}

interface Saved {
  v: 1;
  daily?: GameState;
  free?: GameState;
  freeCats: Category[];
  seenFree: string[];
  seenHelp: boolean;
  anonId: string;
  streak: { last: string | null; count: number; best: number };
}

const KEY = "aod-futbol-v1";

function fresh(): Saved {
  return {
    v: 1,
    freeCats: [...CATEGORY_KEYS],
    seenFree: [],
    seenHelp: false,
    anonId: crypto.randomUUID?.() ?? String(Math.random()).slice(2),
    streak: { last: null, count: 0, best: 0 },
  };
}

function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw?.v === 1) return { ...fresh(), ...raw };
  } catch {
    /* almacenamiento bloqueado o corrupto */
  }
  return fresh();
}

export const store: Saved = load();

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* modo privado: el juego sigue funcionando sin guardar */
  }
}

export const isDone = (g: GameState) => g.step >= g.puzzle.cards.length;
