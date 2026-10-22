/** Registra el service worker (solo en producción) para que el juego se pueda instalar */
export function registerSW(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const go = () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sin SW el juego funciona igual */
    });
  if (document.readyState === "complete") go();
  else addEventListener("load", go);
}
