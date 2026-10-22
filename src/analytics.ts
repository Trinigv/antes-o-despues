/**
 * Analítica opcional con Plausible (sin cookies).
 * Se activa definiendo VITE_PLAUSIBLE_DOMAIN en el build.
 */
type Plausible = (event: string, opts?: { props?: Record<string, string | number> }) => void;
declare global {
  interface Window {
    plausible?: Plausible & { q?: unknown[] };
  }
}

const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN;

if (domain && typeof document !== "undefined") {
  window.plausible =
    window.plausible ||
    Object.assign((...args: unknown[]) => (window.plausible!.q = window.plausible!.q || []).push(args), { q: [] as unknown[] });
  const s = document.createElement("script");
  s.defer = true;
  s.dataset.domain = domain;
  s.src = "https://plausible.io/js/script.manual.js";
  document.head.appendChild(s);
}

export function track(event: string, props?: Record<string, string | number>): void {
  if (!domain || !window.plausible) return;
  window.plausible(event === "pageview" ? "pageview" : event, props ? { props } : undefined);
}
