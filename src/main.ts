import "./styles.css";
import { createEngine, type Engine } from "./api/engine";
import { MAX_SCORE } from "./core/config";
import { addDays, today } from "./core/dates";
import { pointsFor, totalScore } from "./core/rules";
import { CATEGORIES, CATEGORY_KEYS, type Category, type RevealedEvent } from "./core/types";
import { store, save, isDone, type GameState } from "./store";
import { $, esc, reducedMotion, toast } from "./ui/dom";
import { setupDrag } from "./ui/drag";
import { copyText, shareImage, shareText } from "./ui/share";
import { track } from "./analytics";
import { registerSW } from "./pwa";

let engine: Engine;
let G: GameState | null = null;
let busy = false;
let justPlaced: string | null = null;
let firstPaint = true;
let kbIdx: number | null = null;

const color = (c: Category) => `var(--c-${c})`;
const current = () => (G && !isDone(G) ? G.puzzle.cards[G.step] : null);
const score = () => (G ? totalScore(G.misses, G.step) : 0);

/* ---------------- carga de partidas ---------------- */

function newState(kind: GameState["kind"], puzzle: GameState["puzzle"]): GameState {
  return { kind, puzzle, placed: [puzzle.anchor], step: 0, misses: Array(puzzle.cards.length).fill(0), wrong: [] };
}

async function loadDaily(): Promise<void> {
  const d = today();
  if (store.daily?.puzzle.date === d) G = store.daily;
  else {
    G = newState("daily", await engine.daily(d));
    store.daily = G;
    save();
  }
}

async function loadFree(fresh: boolean): Promise<void> {
  if (!fresh && store.free && !isDone(store.free)) {
    G = store.free;
    return;
  }
  const exclude = [...store.seenFree, ...(store.daily?.puzzle.cards.map((c) => c.id) ?? [])];
  const p = await engine.free(store.freeCats, exclude);
  store.seenFree = [...store.seenFree, p.anchor.id, ...p.cards.map((c) => c.id)].slice(-400);
  G = newState("free", p);
  store.free = G;
  save();
}

async function switchTo(fn: () => Promise<void>): Promise<void> {
  firstPaint = true;
  showLoading();
  try {
    await fn();
    render();
  } catch (err) {
    showError(err);
  }
}

/* ---------------- jugar ---------------- */

async function place(slot: number): Promise<void> {
  const g = G;
  const card = current();
  if (!g || !card || busy) return;
  if (g.wrong.includes(slot)) return toast("Ahí ya probaste", true);
  busy = true;
  document.body.classList.add("busy");
  try {
    const res = await engine.check(g.placed.map((e) => e.id), card.id, slot);
    if (res.ok && res.event) {
      const pts = pointsFor(g.step + 1, g.misses[g.step]);
      g.placed.splice(slot, 0, res.event);
      g.step++;
      g.wrong = [];
      justPlaced = res.event.id;
      toast(`¡Sí! Fue en ${res.event.year} · +${pts}`);
      if (isDone(g)) await onFinish(g);
    } else {
      g.misses[g.step]++;
      g.wrong.push(slot);
      toast(res.dir === "left" ? "← No. Más a la izquierda" : "No. Más a la derecha →", true);
      requestAnimationFrame(() => {
        const c = $("drag");
        c?.classList.remove("shake");
        void c?.offsetWidth;
        c?.classList.add("shake");
      });
    }
    save();
    render();
  } catch (err) {
    toast("No se pudo verificar. Probá de nuevo.", true);
    console.error(err);
  } finally {
    busy = false;
    document.body.classList.remove("busy");
  }
}

async function onFinish(g: GameState): Promise<void> {
  if (g.kind === "daily" && g.puzzle.date) {
    const s = store.streak;
    if (s.last !== g.puzzle.date) {
      s.count = s.last === addDays(g.puzzle.date, -1) ? s.count + 1 : 1;
      s.best = Math.max(s.best, s.count);
      s.last = g.puzzle.date;
    }
  }
  track("finish", { kind: g.kind, score: totalScore(g.misses) });
  g.stats = await engine.finish({
    date: g.kind === "daily" ? g.puzzle.date : null,
    anonId: store.anonId,
    ids: [g.puzzle.anchor.id, ...g.puzzle.cards.map((c) => c.id)],
    misses: g.misses,
  });
}

/* ---------------- render ---------------- */

function showLoading() {
  $("board").innerHTML = `<div class="loading">Cargando la partida…</div>`;
  $("dock").innerHTML = "";
}

function showError(err: unknown) {
  console.error(err);
  $("board").innerHTML = "";
  $("dock").innerHTML = `<div class="dock-in"><div class="error-box">No se pudo cargar la partida. Revisá tu conexión.</div><button class="go" id="retry">Reintentar</button></div>`;
}

function render(): void {
  if (!G) return;
  const g = G;
  $("tab-daily").setAttribute("aria-pressed", String(g.kind === "daily"));
  $("tab-free").setAttribute("aria-pressed", String(g.kind === "free"));
  $("s-score").textContent = String(score());
  $("s-max").textContent = `/${MAX_SCORE}`;

  $("dots").innerHTML = g.puzzle.cards
    .map((_, k) => {
      const fin = k < g.step;
      return `<i class="${fin ? "m" + Math.min(g.misses[k], 3) : k === g.step ? "cur" : ""}"></i>`;
    })
    .join("");

  const fr = $("free");
  fr.hidden = g.kind !== "free";
  if (g.kind === "free") {
    fr.innerHTML =
      CATEGORY_KEYS.map(
        (k) => `<button class="chip" data-cat="${k}" aria-pressed="${store.freeCats.includes(k)}" style="--cc:${color(k)}"><i></i>${CATEGORIES[k]}</button>`,
      ).join("") + `<button class="chip new" id="new-free">↻ Nueva partida</button>`;
  }

  renderBoard(g);
  renderDock(g);
}

function renderBoard(g: GameState): void {
  const b = $("board");
  const prev = b.scrollLeft;
  const done = isDone(g);
  b.classList.toggle("done", done);
  const gap = (i: number) =>
    `<div class="gap${g.wrong.includes(i) ? " no" : ""}" data-gap="${i}"><span class="mark">${g.wrong.includes(i) ? "✕" : ""}</span><div class="ph"><span class="q">?</span><span class="slotcard"></span></div></div>`;
  let h = "";
  g.placed.forEach((e, i) => {
    h += gap(i);
    const k = g.puzzle.cards.findIndex((c) => c.id === e.id);
    const tag = k < 0 ? `<b>inicio</b>` : `<b class="${pointsFor(k + 1, g.misses[k]) === k + 1 ? "full" : pointsFor(k + 1, g.misses[k]) === 0 ? "zero" : ""}">+${pointsFor(k + 1, g.misses[k])}</b>`;
    h += `<div class="ev${e.id === justPlaced ? " new" : ""}" id="ev-${esc(e.id)}" data-ev="${esc(e.id)}" style="--cc:${color(e.category)}" role="button" tabindex="0" aria-label="${e.year}: ${esc(e.title)}. Ver detalle">
      <div class="yr">${e.year}</div><div class="stem"></div>
      <div class="card"><div class="dt"><span>${CATEGORIES[e.category]}</span>${tag}</div><div class="t">${esc(e.title)}</div></div></div>`;
  });
  h += gap(g.placed.length);
  b.innerHTML = h;
  b.scrollLeft = prev;

  const smooth: ScrollBehavior = reducedMotion() ? "auto" : "smooth";
  const center = (el: Element | null, behavior: ScrollBehavior) => {
    if (!(el instanceof HTMLElement)) return;
    b.scrollTo({ left: Math.max(0, el.offsetLeft - (b.clientWidth - el.offsetWidth) / 2), behavior });
  };
  if (justPlaced && done) b.scrollTo({ left: 0, behavior: smooth });
  else if (justPlaced) center(document.getElementById(`ev-${justPlaced}`), smooth);
  else if (firstPaint) center(b.querySelector(".ev"), "auto");
  justPlaced = null;
  firstPaint = false;
  $("hint").hidden = b.scrollWidth <= b.clientWidth + 4;
}

function renderDock(g: GameState): void {
  const dock = $("dock");
  const card = current();
  if (card) {
    const v = pointsFor(g.step + 1, g.misses[g.step]);
    dock.innerHTML = `<div class="dock-in"><div class="meta"><span>Evento ${g.step + 1} de ${g.puzzle.cards.length}</span><span class="val">vale ${v} pt${v === 1 ? "" : "s"}</span></div>
      <div class="drag${g.step === 0 && g.misses[0] === 0 && !reducedMotion() ? " nudge" : ""}" id="drag" tabindex="0" role="button" style="--cc:${color(card.category)}" aria-label="${esc(card.title)}. Arrastralo a la línea de tiempo, o usá las flechas y Enter">
        <span class="grip"><i><b></b><b></b><b></b><b></b><b></b><b></b></i></span>
        <span><span class="cat">${CATEGORIES[card.category]}</span><div class="tt">${esc(card.title)}</div>${card.description ? `<div class="dd">${esc(card.description)}</div>` : ""}</span></div>
      <div class="instr">Arrastrá la carta hasta la línea y soltala donde va</div></div>`;
    return;
  }
  const sc = score();
  const verdict = sc === MAX_SCORE ? "Perfecto, ni un error." : sc >= 28 ? "Muy buena memoria futbolera." : sc >= 18 ? "Bien jugado." : "La próxima sale mejor.";
  const s = g.stats;
  const statsLine = s ? `<p class="stats-line">Jugaron <b>${s.players}</b> · promedio <b>${s.average.toFixed(1)}</b> · superaste al <b>${Math.round(s.percentile)}%</b></p>` : "";
  const streak = g.kind === "daily" && store.streak.count > 1 ? ` Racha: ${store.streak.count} días.` : "";
  dock.innerHTML = `<div class="dock-in"><div class="res-top"><div><small>${g.puzzle.number ? "Partida del día #" + g.puzzle.number : "Partida libre"}</small>
    <div class="big">${sc}<span> / ${MAX_SCORE}</span></div></div><div class="sq">${g.misses.map((m) => (m === 0 ? "🟩" : m === 1 ? "🟨" : m === 2 ? "🟧" : "🟥")).join("")}</div></div>
    <p class="verdict">${verdict}${streak} ${g.kind === "daily" ? "Mañana hay una partida nueva." : ""}</p>${statsLine}
    <div class="row3"><button class="go" id="share">Copiar resultado</button><button class="ghost" id="share-img">Compartir imagen</button>
    <button class="ghost wide" id="again">${g.kind === "daily" ? "Jugar partida libre" : "Otra partida"}</button></div>
    <div id="share-out"></div></div>`;
}

function openInfo(id: string): void {
  const e = G?.placed.find((x) => x.id === id) as RevealedEvent | undefined;
  if (!e) return;
  const c = $("info-card");
  c.style.setProperty("--cc", color(e.category));
  c.innerHTML = `<span class="info-meta">${CATEGORIES[e.category]}</span><span class="info-yr">${e.year}</span><p class="info-t">${esc(e.title)}</p><p class="info-d">${esc(e.description)}</p><button class="go" id="close-info">Cerrar</button>`;
  $("info").hidden = false;
  $("close-info").focus();
}

/* ---------------- eventos de la interfaz ---------------- */

const drag = setupDrag({
  canDrag: () => !!current() && !busy,
  floatingHtml: () => {
    const c = current()!;
    return `<small>${CATEGORIES[c.category]}</small>${esc(c.title)}`;
  },
  floatingColor: () => color(current()!.category),
  onDrop: (slot) => void place(slot),
  onTap: () => toast("Arrastrá la carta hasta la línea ↑"),
});

document.addEventListener("click", async (e) => {
  if (document.body.classList.contains("dragging")) return;
  const t = e.target as HTMLElement;
  const ev = t.closest<HTMLElement>(".ev[data-ev]");
  if (ev) return openInfo(ev.dataset.ev!);
  const chip = t.closest<HTMLElement>(".chip[data-cat]");
  if (chip) {
    const k = chip.dataset.cat as Category;
    store.freeCats = store.freeCats.includes(k) ? (store.freeCats.length > 1 ? store.freeCats.filter((x) => x !== k) : store.freeCats) : [...store.freeCats, k];
    save();
    return switchTo(() => loadFree(true));
  }
  const id = t.closest("button")?.id ?? t.id;
  switch (id) {
    case "tab-daily":
      return switchTo(loadDaily);
    case "tab-free":
      return switchTo(() => loadFree(false));
    case "new-free":
      return switchTo(() => loadFree(true));
    case "again":
      return switchTo(() => loadFree(true));
    case "retry":
      return switchTo(G?.kind === "free" ? () => loadFree(false) : loadDaily);
    case "help":
      $("sheet").hidden = false;
      return $("close-help").focus();
    case "close-help":
    case "sheet":
      $("sheet").hidden = true;
      store.seenHelp = true;
      return save();
    case "close-info":
    case "info":
      $("info").hidden = true;
      return;
    case "share": {
      if (!G) return;
      const txt = shareText({ number: G.puzzle.number, score: score(), misses: G.misses });
      const out = $("share-out");
      if (await copyText(txt)) out.innerHTML = `<span class="copied">Copiado. Pegalo en WhatsApp.</span>`;
      else {
        out.innerHTML = `<textarea class="share" id="share-ta" readonly></textarea>`;
        const ta = $("share-ta") as HTMLTextAreaElement;
        ta.value = txt;
        ta.select();
      }
      track("share", { type: "text" });
      return;
    }
    case "share-img": {
      if (!G) return;
      const r = await shareImage({ number: G.puzzle.number, score: score(), misses: G.misses });
      if (r === "downloaded") toast("Imagen descargada");
      if (r === "failed") toast("No se pudo crear la imagen", true);
      track("share", { type: "image" });
      return;
    }
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    $("info").hidden = true;
    $("sheet").hidden = true;
    kbIdx = null;
    drag.setOver(null);
    return;
  }
  const t = e.target as HTMLElement;
  if (t.id === "drag" && G && current()) {
    const n = G.placed.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      kbIdx = kbIdx === null ? Math.floor(n / 2) : Math.max(0, Math.min(n, kbIdx + (e.key === "ArrowLeft" ? -1 : 1)));
      drag.setOver(kbIdx);
      $("board").querySelectorAll(".gap")[kbIdx]?.scrollIntoView({ inline: "center", block: "nearest" });
    }
    if ((e.key === "Enter" || e.key === " ") && kbIdx !== null) {
      e.preventDefault();
      const i = kbIdx;
      kbIdx = null;
      drag.setOver(null);
      void place(i).then(() => $("drag")?.focus());
    }
    return;
  }
  if (e.key === "Enter" && t.matches(".ev[data-ev]")) openInfo(t.dataset.ev!);
});

$("board").addEventListener(
  "wheel",
  (e) => {
    const b = e.currentTarget as HTMLElement;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && b.scrollWidth > b.clientWidth) {
      b.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  },
  { passive: false },
);
addEventListener("resize", () => {
  const b = $("board");
  $("hint").hidden = b.scrollWidth <= b.clientWidth + 4;
});

/* ---------------- arranque ---------------- */

(async () => {
  showLoading();
  engine = await createEngine();
  await switchTo(loadDaily);
  if (!store.seenHelp) $("sheet").hidden = false;
  track("pageview");
  registerSW();
})();
