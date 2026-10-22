import type { Category } from "../../src/core/types";

/** Un hecho crudo que trae una fuente. La fecha SIEMPRE viene de la fuente, nunca del LLM. */
export interface Candidate {
  /** Id estable en la fuente (ej. "wikidata:Q123", "inbox:<hash>") para no proponerlo dos veces */
  sourceId: string;
  year: number;
  date: string | null;
  category: Category;
  /** Descripción factual en lenguaje llano para que el LLM redacte la carta */
  facts: string;
  sourceUrl: string | null;
}
