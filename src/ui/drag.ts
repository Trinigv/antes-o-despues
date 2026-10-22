import { $ } from "./dom";

/**
 * Drag and drop con Pointer Events (mouse y touch).
 * La carta #drag se arrastra hasta la línea; los huecos .gap[data-gap] se abren al pasar.
 * Al soltar sobre un hueco llama a onDrop(índice).
 */
export function setupDrag(opts: {
  canDrag: () => boolean;
  floatingHtml: () => string;
  floatingColor: () => string;
  onDrop: (slot: number) => void;
  onTap: () => void;
}): { setOver: (i: number | null) => void } {
  const st = { on: false, pending: false, pointer: -1, x0: 0, y0: 0, px: 0, py: 0, idx: null as number | null, raf: 0, fl: null as HTMLDivElement | null };
  const gaps = () => [...$("board").querySelectorAll<HTMLElement>(".gap")];

  function setOver(i: number | null) {
    if (i === st.idx) return;
    st.idx = i;
    gaps().forEach((g, k) => g.classList.toggle("over", k === i));
    $("track").classList.toggle("hot", i !== null);
  }

  function computeIdx(x: number, y: number): number | null {
    const tr = $("track").getBoundingClientRect();
    if (y < tr.top - 40 || y > tr.bottom + 70) return null;
    const evs = [...$("board").querySelectorAll<HTMLElement>(".ev")];
    const over = $("board").querySelector<HTMLElement>(".gap.over");
    const overIdx = over ? Number(over.dataset.gap) : -1;
    const delta = over ? over.getBoundingClientRect().width - 14 : 0;
    let n = 0;
    evs.forEach((el, j) => {
      const r = el.getBoundingClientRect();
      let c = r.left + r.width / 2;
      if (overIdx >= 0 && j >= overIdx) c -= delta;
      if (c < x) n++;
    });
    return n;
  }

  const moveFloat = () => {
    if (st.fl) st.fl.style.transform = `translate(${Math.max(6, Math.min(innerWidth - 186, st.px - 90))}px,${st.py - 120}px) rotate(-3deg)`;
  };

  function loop() {
    if (!st.on) return;
    const b = $("board");
    const r = b.getBoundingClientRect();
    if (st.idx !== null || (st.py > r.top - 40 && st.py < r.bottom + 70)) {
      const edge = 48;
      let v = 0;
      if (st.px < r.left + edge) v = -Math.ceil((r.left + edge - st.px) / 4);
      else if (st.px > r.right - edge) v = Math.ceil((st.px - (r.right - edge)) / 4);
      if (v) {
        b.scrollLeft += v;
        setOver(computeIdx(st.px, st.py));
      }
    }
    st.raf = requestAnimationFrame(loop);
  }

  function start() {
    st.on = true;
    document.body.classList.add("dragging");
    const src = $("drag");
    src.classList.add("lifted");
    src.classList.remove("nudge");
    const f = document.createElement("div");
    f.className = "floating";
    f.style.setProperty("--cc", opts.floatingColor());
    f.innerHTML = opts.floatingHtml();
    document.body.appendChild(f);
    st.fl = f;
    moveFloat();
    st.raf = requestAnimationFrame(loop);
  }

  function end(drop: boolean) {
    cancelAnimationFrame(st.raf);
    const idx = st.idx;
    const fl = st.fl;
    st.on = st.pending = false;
    st.fl = null;
    document.body.classList.remove("dragging");
    setOver(null);
    if (drop && idx !== null) {
      fl?.remove();
      opts.onDrop(idx);
      return;
    }
    const src = $("drag");
    if (fl && src) {
      const r = src.getBoundingClientRect();
      fl.classList.add("back");
      fl.style.transform = `translate(${r.left + 10}px,${r.top + 10}px) scale(.9)`;
      fl.style.opacity = "0";
      setTimeout(() => {
        fl.remove();
        src.classList.remove("lifted");
      }, 260);
    } else src?.classList.remove("lifted");
  }

  document.addEventListener("pointerdown", (e) => {
    const d = (e.target as HTMLElement).closest("#drag");
    if (!d || !opts.canDrag() || e.button > 0) return;
    st.pending = true;
    st.pointer = e.pointerId;
    st.x0 = st.px = e.clientX;
    st.y0 = st.py = e.clientY;
    try {
      (d as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* algunos navegadores no lo permiten */
    }
    e.preventDefault();
  });
  document.addEventListener("pointermove", (e) => {
    if (e.pointerId !== st.pointer) return;
    if (st.pending && !st.on) {
      if (Math.hypot(e.clientX - st.x0, e.clientY - st.y0) > 6) start();
      else return;
    }
    if (!st.on) return;
    st.px = e.clientX;
    st.py = e.clientY;
    moveFloat();
    setOver(computeIdx(st.px, st.py));
  });
  document.addEventListener("pointerup", (e) => {
    if (e.pointerId !== st.pointer) return;
    st.pointer = -1;
    if (st.on) return end(true);
    if (st.pending) {
      st.pending = false;
      opts.onTap();
    }
  });
  document.addEventListener("pointercancel", (e) => {
    if (e.pointerId !== st.pointer) return;
    st.pointer = -1;
    if (st.on) end(false);
    st.pending = false;
  });

  return { setOver };
}
