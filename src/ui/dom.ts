export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let toastTimer: number | undefined;
export function toast(msg: string, bad = false): void {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast on" + (bad ? " bad" : "");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.className = "toast" + (bad ? " bad" : "")), 1500);
}
