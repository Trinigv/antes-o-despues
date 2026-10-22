import { MAX_SCORE } from "../core/config";
import { squares } from "../core/rules";

export const siteUrl = () => import.meta.env.VITE_SITE_URL || location.origin;

export function shareText(o: { number: number | null; score: number; misses: number[] }): string {
  const head = o.number ? `Antes o Después ⚽ #${o.number}` : "Antes o Después ⚽ (libre)";
  return `${head} · ${o.score}/${MAX_SCORE}\n${squares(o.misses)}\n\nJugá vos: ${siteUrl()}`;
}

/** Copia al portapapeles; si no se puede, devuelve false para mostrar el texto */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Imagen 1080x1350 con el resultado, para compartir en historias o WhatsApp */
export async function shareImage(o: { number: number | null; score: number; misses: number[] }): Promise<"shared" | "downloaded" | "failed"> {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) return "failed";
  await document.fonts?.ready;

  g.fillStyle = "#111111";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#38BDF8";
  g.fillRect(0, 0, W, 16);

  g.fillStyle = "#A3A3A3";
  g.font = "700 40px Figtree, system-ui, sans-serif";
  g.fillText("FÚTBOL ARGENTINO", 90, 170);
  g.fillStyle = "#F2F2F2";
  g.font = "800 96px 'Bricolage Grotesque', Figtree, system-ui, sans-serif";
  g.fillText("Antes o", 90, 280);
  g.fillStyle = "#38BDF8";
  g.fillText("después", 90, 380);

  g.fillStyle = "#A3A3A3";
  g.font = "600 44px Figtree, system-ui, sans-serif";
  g.fillText(o.number ? `Partida #${o.number}` : "Partida libre", 90, 520);

  g.fillStyle = "#F2F2F2";
  g.font = "800 260px 'Bricolage Grotesque', Figtree, system-ui, sans-serif";
  const sc = String(o.score);
  g.fillText(sc, 80, 790);
  const w = g.measureText(sc).width;
  g.fillStyle = "#A3A3A3";
  g.font = "700 80px Figtree, system-ui, sans-serif";
  g.fillText(`/ ${MAX_SCORE}`, 100 + w, 790);

  const colors = ["#22C55E", "#EAB308", "#F97316", "#EF4444"];
  const size = 96, gap = 14;
  o.misses.forEach((m, i) => {
    g.fillStyle = colors[Math.min(m, 3)];
    roundRect(g, 90 + i * (size + gap), 880, size, size, 18);
  });

  g.fillStyle = "#F2F2F2";
  g.font = "700 46px Figtree, system-ui, sans-serif";
  g.fillText("¿Vos cuánto hacés?", 90, 1160);
  g.fillStyle = "#38BDF8";
  g.font = "600 40px Figtree, system-ui, sans-serif";
  g.fillText(siteUrl().replace(/^https?:\/\//, ""), 90, 1230);

  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
  if (!blob) return "failed";
  const file = new File([blob], `antes-o-despues-${o.number ?? "libre"}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText(o) });
      return "shared";
    } catch {
      /* el usuario canceló: caemos a la descarga */
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return "downloaded";
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fill();
}
