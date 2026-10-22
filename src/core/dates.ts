import { LAUNCH_DATE, TIME_ZONE } from "./config";

/** Fecha de hoy (YYYY-MM-DD) en la hora argentina */
export function today(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const toUTC = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));

export function addDays(d: string, n: number): string {
  return new Date(toUTC(d) + n * 864e5).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 864e5);
}

/** Número de partida (#1 = día de lanzamiento) */
export const puzzleNumber = (d: string) => daysBetween(LAUNCH_DATE, d) + 1;
