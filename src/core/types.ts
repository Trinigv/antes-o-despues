export type Category = "sel" | "clu" | "ido" | "mun";

export const CATEGORIES: Record<Category, string> = {
  sel: "Selección",
  clu: "Clubes",
  ido: "Ídolos",
  mun: "Mundial",
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

/** Evento completo, tal como vive en data/events.json */
export interface GameEvent {
  id: string;
  year: number;
  /** YYYY-MM-DD o YYYY-MM; null si solo se conoce el año */
  date: string | null;
  precision: "day" | "month" | "year";
  category: Category;
  title: string;
  description: string;
  tags: string[];
  source: string | null;
  status: "approved" | "pending" | "rejected";
}

/** Lo que ve el jugador antes de ubicar la carta (sin año) */
export interface PublicEvent {
  id: string;
  category: Category;
  title: string;
  description: string;
}

/** Una carta ya ubicada: ahora sí con su año */
export interface RevealedEvent extends PublicEvent {
  year: number;
}

export interface Puzzle {
  /** YYYY-MM-DD para la partida del día; null para partida libre */
  date: string | null;
  number: number | null;
  anchor: RevealedEvent;
  cards: PublicEvent[];
}

/** Archivo public/puzzles/YYYY-MM-DD.json */
export interface PuzzleFile {
  date: string;
  number: number;
  /** ids[0] es la carta de inicio; el resto se juega en ese orden */
  ids: string[];
}

export type Direction = "left" | "right";

export interface CheckResult {
  ok: boolean;
  /** Si erró: para qué lado está la respuesta */
  dir?: Direction;
  /** Si acertó: el evento con su año */
  event?: RevealedEvent;
}

export interface Stats {
  players: number;
  average: number;
  /** Porcentaje de jugadores con menos puntaje que vos (0-100) */
  percentile: number;
}

export const toPublic = (e: GameEvent): PublicEvent => ({
  id: e.id,
  category: e.category,
  title: e.title,
  description: e.description,
});

export const toRevealed = (e: GameEvent): RevealedEvent => ({ ...toPublic(e), year: e.year });
