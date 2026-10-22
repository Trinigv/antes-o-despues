import type { Direction } from "./types";

/** Puntos del evento #k (1..8) con m errores: k − m, nunca menos de 0 */
export const pointsFor = (k: number, misses: number) => Math.max(0, k - misses);

export function totalScore(misses: readonly number[], placedCount = misses.length): number {
  let s = 0;
  for (let i = 0; i < placedCount; i++) s += pointsFor(i + 1, misses[i] ?? 0);
  return s;
}

/**
 * ¿Va el año `year` en el hueco `slot` de una línea ordenada?
 * slot 0 = a la izquierda de todo; slot = years.length = a la derecha de todo.
 */
export function fits(sortedYears: readonly number[], year: number, slot: number): boolean {
  if (slot < 0 || slot > sortedYears.length) return false;
  const left = slot === 0 ? -Infinity : sortedYears[slot - 1];
  const right = slot === sortedYears.length ? Infinity : sortedYears[slot];
  return left < year && year < right;
}

/** Si erró, ¿para qué lado tiene que mover la carta? */
export function direction(sortedYears: readonly number[], year: number, slot: number): Direction {
  return slot > 0 && year < sortedYears[slot - 1] ? "left" : "right";
}

export function isSorted(years: readonly number[]): boolean {
  for (let i = 1; i < years.length; i++) if (years[i - 1] >= years[i]) return false;
  return true;
}

/** Cuadraditos para compartir */
export function squares(misses: readonly number[]): string {
  return misses.map((m) => (m === 0 ? "🟩" : m === 1 ? "🟨" : m === 2 ? "🟧" : "🟥")).join("");
}
