import "./tokens.css";
import "./style.css";
import "./garden/paint.css";
import "./garden/tropical.css";
import "./garden/mediterranean.css";
import "./garden/anchors.css";
import { animate, createDrawable, createTimeline, stagger } from "animejs";
import { arrange } from "./garden/arrange";

// The garden is drawn by scripts/garden into public/garden/<name>.svg. Each plant this screen
// shows is fetched and inlined so CSS can color it, then grown by one progress value: a short
// intro on load, then the scroll. Limbs extend inside a clip shaped like a rounded shoot, and
// leaves, flowers, and fruit unfold from where they attach. The card stays on top, and its
// icons draw themselves in and answer hover with a small gesture. Content is static HTML.

const GA_ID = "G-6L7V5YG0QJ";
const INTRO = 0.5; // how far the garden grows before the visitor scrolls
const UNFOLD = 0.08; // the span of progress a leaf, flower, or fruit takes to open
const FPS = 30; // growth is slow, so the garden redraws at most this often
const LAG = 75; // ms for the smoothed scroll to close about two thirds of the gap to the page
const AUTOPLAY = 6000; // ms touch screens take to play the scroll part of the growth
const GROW_IN = 1800; // ms a garden takes to grow in when the theme switches to it
const ROOM = 8; // how far a growing limb's clip reaches past its edges, in drawing units
const SVG_NS = "http://www.w3.org/2000/svg";

// A limb's spine, from data-sp: points, half widths, unit normals, and distance along it.
type Limb = {
  el: SVGGElement;
  id: string;
  clip: SVGPathElement;
  tip: SVGPathElement;
  x: number[];
  y: number[];
  w: number[];
  nx: number[];
  ny: number[];
  s: number[];
  g0: number;
  g1: number;
  last: number;
  clipped: boolean;
};
type Part = { el: SVGGElement; g: number; o: string; back: string; turn: number; last: number };
// boost scales a plant's growth: 1 normally, and rising from 0 while its garden grows in.
type Plant = { bed: HTMLElement; garden: string; vb: number; k: number; lag: number; boost: number; limbs: Limb[]; parts: Part[] };

const root = document.documentElement;
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const touch = matchMedia("(pointer: coarse)").matches;
const growth = { intro: still ? 1 : 0, scroll: 0 };
const plants: Plant[] = [];
const beds = [...document.querySelectorAll<HTMLElement>(".garden .plant")];
const gardenOf = () => (root.dataset.theme === "dark" ? "mediterranean" : "tropical");
let garden = gardenOf();
let drawn = -1;
let pending = false;
let forceNext = false;
let lastDraw = 0;

// Every visit starts at the top, where the garden starts growing.
history.scrollRestoration = "manual";
setupTheme();
if (import.meta.env.PROD) analytics();
arrange(beds);
plantGarden().then(() => {
  if (!still) animate(growth, { intro: INTRO, duration: 2600, ease: "out(3)", onUpdate: () => requestGarden(), onComplete: touch ? autoplay : nudge });
});
addEventListener(
  "resize",
  debounce(() => {
    arrange(beds);
    plants.forEach((plant) => scaleInk(plant));
    renderGarden(true);
    plantGarden();
  }, 250),
);

if (!still) {
  // Entrance: time-based, on transform and opacity. The scroll drift below uses `translate`.
  animate(".card header", { y: [18, 0], opacity: [0, 1], duration: 700, ease: "out(2)" });
  animate(".link-row", { y: [16, 0], opacity: [0, 1], duration: 550, delay: stagger(60, { start: 150 }), ease: "out(2)" });
  drawIcons(550);
  followScroll();

  document.querySelectorAll<HTMLAnchorElement>(".link").forEach((link) => {
    const play = gesture(link);
    link.addEventListener("mouseenter", play);
    link.addEventListener("focus", play);
  });
}

// Scroll story: one smoothed progress value grows the garden. Link rows drift at staggered
// rates, measured in the height of a one-line row so taller rows never close the gap above
// them. The cue's seedling grows along, and the cue fades out before the rising card reaches
// it. The value eases toward the page's scroll and stops ticking once it arrives.
function followScroll() {
  const track = document.querySelector<HTMLElement>(".scroll-track")!;
  const header = document.querySelector<HTMLElement>(".card header")!;
  const rows = [...document.querySelectorAll<HTMLElement>(".link-row")];
  const cue = document.querySelector<HTMLElement>(".scroll-cue")!;
  const stem = cue.querySelector<SVGPathElement>(".sprout-stem")!;
  const [left, right] = cue.querySelectorAll<SVGPathElement>(".sprout-leaf");
  stem.setAttribute("pathLength", "1");
  stem.style.strokeDasharray = "1";
  let span = 1;
  let unit = 0;
  let target = 0;
  let frame = 0;
  let last = 0;
  const measure = () => {
    span = Math.max(1, track.offsetHeight - innerHeight);
    unit = rows[0].offsetHeight;
    onScroll();
  };
  const onScroll = () => {
    target = clamp(scrollY / span);
    if (!frame) frame = requestAnimationFrame(step);
  };
  const step = (now: number) => {
    const dt = last ? Math.min(100, Math.max(0, now - last)) : 1000 / 60;
    growth.scroll += (target - growth.scroll) * (1 - Math.exp(-dt / LAG));
    if (Math.abs(target - growth.scroll) < 5e-4) growth.scroll = target;
    const s = growth.scroll;
    header.style.translate = `0 ${-12 * s}%`;
    rows.forEach((row, i) => (row.style.translate = `0 ${-(0.2 + i * 0.12) * unit * s}px`));
    cue.style.opacity = String(clamp((0.6 - s) / 0.2));
    cue.style.visibility = s < 0.6 ? "" : "hidden"; // a hidden cue costs its blur nothing
    stem.style.strokeDashoffset = String(0.22 * (1 - clamp(s / 0.45)));
    left.style.scale = String(0.62 + 0.38 * clamp(s / 0.3));
    right.style.scale = String(0.48 + 0.52 * clamp((s - 0.12) / 0.33));
    requestGarden();
    last = s === target ? 0 : now;
    frame = s === target ? 0 : requestAnimationFrame(step);
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", measure);
  measure();
}

// Touch screens play the rest of the growth on their own by easing the page through the scroll
// track. A touch, wheel, or key hands control back at once.
function autoplay() {
  const span = document.querySelector<HTMLElement>(".scroll-track")!.offsetHeight - innerHeight;
  if (scrollY > 4 || span <= 0) return;
  const start = performance.now();
  let stopped = false;
  const stops = ["touchstart", "wheel", "keydown", "pointerdown"];
  const stop = () => {
    stopped = true;
    stops.forEach((type) => removeEventListener(type, stop));
  };
  stops.forEach((type) => addEventListener(type, stop, { passive: true }));
  const step = (now: number) => {
    if (stopped) return;
    const k = clamp((now - start) / AUTOPLAY);
    scrollTo(0, span * (0.5 - Math.cos(k * Math.PI) / 2));
    if (k < 1) requestAnimationFrame(step);
    else stops.forEach((type) => removeEventListener(type, stop));
  };
  requestAnimationFrame(step);
}

// If the visitor has not scrolled a few seconds after the intro, the cue bobs once toward the card.
function nudge() {
  setTimeout(() => {
    if (scrollY > 4) return;
    animate(".scroll-cue", { y: [0, 5, 0, 3, 0], duration: 1100, ease: "inOut(2)" });
    animate(".sprout-leaf", { rotate: [0, -10, 6, 0], duration: 1100, ease: "inOut(2)" });
  }, 2500);
}

// Fetches the plants this layout shows and has not planted yet. Plants fetched for a garden that
// is growing in start from nothing.
async function plantGarden(growing = false) {
  await Promise.all(
    beds.map(async (bed, i) => {
      if (bed.dataset.planted || getComputedStyle(bed).display === "none") return;
      bed.dataset.planted = "1";
      // Measured now, while layout is clean, so the new plant is styled once with its ink scale.
      const height = bed.offsetHeight;
      const res = await fetch(`/garden/${bed.dataset.plant}.svg`);
      if (!res.ok) return;
      bed.innerHTML = await res.text();
      const plant = collect(bed, (i % 5) * 0.03);
      scaleInk(plant, height);
      plants.push(plant);
      if (growing) growIn(plant);
      renderGarden(true);
    }),
  );
}

function collect(bed: HTMLElement, lag: number): Plant {
  const svg = bed.querySelector("svg")!;
  const limbs = [...bed.querySelectorAll<SVGGElement>(".gl")].map((el, i): Limb => {
    const v = el.dataset.sp!.split(" ").map(Number);
    const x: number[] = [];
    const y: number[] = [];
    const w: number[] = [];
    for (let k = 0; k < v.length; k += 3) x.push(v[k]), y.push(v[k + 1]), w.push(v[k + 2]);
    const n = x.length;
    const nx: number[] = [];
    const ny: number[] = [];
    const s: number[] = [0];
    for (let k = 0; k < n; k++) {
      const a = Math.max(0, k - 1);
      const b = Math.min(n - 1, k + 1);
      const d = Math.hypot(x[b] - x[a], y[b] - y[a]) || 1;
      nx.push(-(y[b] - y[a]) / d);
      ny.push((x[b] - x[a]) / d);
      if (k) s.push(s[k - 1] + Math.hypot(x[k] - x[k - 1], y[k] - y[k - 1]));
    }
    const id = `${bed.dataset.plant}-grow${i}`;
    const clipPath = document.createElementNS(SVG_NS, "clipPath");
    clipPath.id = id;
    const clip = clipPath.appendChild(document.createElementNS(SVG_NS, "path"));
    const tip = document.createElementNS(SVG_NS, "path");
    tip.setAttribute("class", "ink mid");
    el.before(clipPath);
    el.after(tip);
    return { el, id, clip, tip, x, y, w, nx, ny, s, g0: +el.dataset.g0!, g1: +el.dataset.g1!, last: -1, clipped: false };
  });
  const parts = [...bed.querySelectorAll<SVGGElement>(".gp")].map((el, i) => {
    const [x, y] = el.dataset.o!.split(" ");
    return { el, g: +el.dataset.g!, o: `${x} ${y}`, back: `${-x} ${-y}`, turn: i % 2 ? 22 : -22, last: -1 };
  });
  return { bed, garden: bed.dataset.garden!, vb: svg.viewBox.baseVal.height, k: 0, lag, boost: 1, limbs, parts };
}

// Ink keeps one pen width at every plant size. --k is drawing units per CSS pixel.
function scaleInk(plant: Plant, height = plant.bed.offsetHeight) {
  const k = +(plant.vb / height).toFixed(3);
  if (!height || k === plant.k) return;
  plant.k = k;
  plant.bed.style.setProperty("--k", String(k));
  plant.limbs.forEach((limb) => (limb.last = -1));
}

// Every change repaints the plants it touches, so the garden redraws at most FPS times a
// second, and only when growth has moved a visible step.
function requestGarden(force = false) {
  forceNext ||= force;
  if (pending) return;
  pending = true;
  const tick = (now: number) => {
    if (now - lastDraw < 1000 / FPS - 4) return void requestAnimationFrame(tick);
    pending = false;
    lastDraw = now;
    renderGarden(forceNext);
    forceNext = false;
  };
  requestAnimationFrame(tick);
}

// The theme picks the garden. On a switch the incoming garden is spaced out, fetched if this is
// its first showing, and grown in from nothing over GROW_IN.
function gardenChanged() {
  garden = gardenOf();
  arrange(beds);
  for (const plant of plants) {
    if (plant.garden !== garden) continue;
    scaleInk(plant);
    growIn(plant);
  }
  plantGarden(true);
}

function growIn(plant: Plant) {
  if (still) return;
  plant.boost = 0;
  animate(plant, { boost: 1, duration: GROW_IN, ease: "out(2)", onUpdate: () => requestGarden(true) });
}

function renderGarden(force = false) {
  const all = Math.round(Math.min(1, growth.intro + (1 - INTRO) * growth.scroll) * 400) / 400;
  if (all === drawn && !force) return;
  drawn = all;
  for (const plant of plants) {
    if (plant.garden !== garden) continue;
    const p = clamp((all - plant.lag) / (1 - plant.lag)) * plant.boost;
    for (const limb of plant.limbs) {
      const t = clamp((p - limb.g0) / (limb.g1 - limb.g0));
      if (t === limb.last) continue;
      limb.last = t;
      limb.el.style.visibility = t ? "" : "hidden";
      // Only a growing limb is clipped.
      const growing = t > 0 && t < 1;
      if (growing) {
        if (!limb.clipped) limb.el.setAttribute("clip-path", `url(#${limb.id})`);
        shoot(limb, t, plant.k);
      } else if (limb.clipped) {
        limb.el.removeAttribute("clip-path");
        limb.tip.removeAttribute("d");
      }
      limb.clipped = growing;
    }
    for (const part of plant.parts) {
      const t = clamp((p - part.g) / UNFOLD);
      if (t === part.last) continue;
      part.last = t;
      part.el.style.visibility = t ? "" : "hidden";
      part.el.style.opacity = t < 0.3 ? String(t / 0.3) : "";
      if (t === 1) part.el.removeAttribute("transform");
      else part.el.setAttribute("transform", `translate(${part.o}) rotate(${(1 - t) * part.turn}) scale(${unfold(t)}) translate(${part.back})`);
    }
  }
}

// Clips a growing limb to its spine up to the share t of its length, widened by ROOM on both
// sides, and rounds the end into a shoot. The tip's ink arc rides on the end, and the clip
// leaves just enough room past it for that line.
function shoot(limb: Limb, t: number, k: number) {
  const { x, y, w, nx, ny, s } = limb;
  const n = x.length;
  const at = t * s[n - 1];
  let j = 1;
  while (j < n - 1 && s[j] < at) j++;
  const u = (at - s[j - 1]) / (s[j] - s[j - 1] || 1);
  const gx = x[j - 1] + (x[j] - x[j - 1]) * u;
  const gy = y[j - 1] + (y[j] - y[j - 1]) * u;
  const gw = w[j - 1] + (w[j] - w[j - 1]) * u;
  const len = Math.hypot(x[j] - x[j - 1], y[j] - y[j - 1]) || 1;
  const tx = (x[j] - x[j - 1]) / len;
  const ty = (y[j] - y[j - 1]) / len;
  const r = gw + 0.6 * k; // the tip's ink is 1.1px wide
  const pt = (px: number, py: number) => `${px.toFixed(1)} ${py.toFixed(1)}`;
  // Each side runs ROOM past the edge, and starts ROOM behind the base.
  const side = (i: number, e: number, back = 0) =>
    pt(x[i] + nx[i] * e * (w[i] + ROOM) - ny[i] * back, y[i] + ny[i] * e * (w[i] + ROOM) + nx[i] * back);
  let left = side(0, 1, ROOM);
  let right = side(0, -1, ROOM);
  for (let i = 0; i < j; i++) {
    left += `L${side(i, 1)}`;
    right = `${side(i, -1)}L${right}`;
  }
  // Normal at the tip is (-ty, tx), so the arc from that side round the front to the other
  // turns through falling angles: sweep 0.
  const a = (e: number, rr: number) => pt(gx - ty * e * rr, gy + tx * e * rr);
  limb.clip.setAttribute("d", `M${left}L${a(1, gw + ROOM)}L${a(1, r)}A${r.toFixed(1)} ${r.toFixed(1)} 0 0 0 ${a(-1, r)}L${a(-1, gw + ROOM)}L${right}Z`);
  limb.tip.setAttribute("d", `M${a(1, gw)}A${gw.toFixed(1)} ${gw.toFixed(1)} 0 0 0 ${a(-1, gw)}`);
}

// Opens past full size a little, then settles, like a leaf relaxing as it unfurls.
function unfold(t: number) {
  const k = 1.4;
  return 1 + (k + 1) * (t - 1) ** 3 + k * (t - 1) ** 2;
}

function clamp(n: number) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function debounce(fn: () => void, ms: number) {
  let id = 0;
  return () => {
    clearTimeout(id);
    id = setTimeout(fn, ms);
  };
}

// Each icon is drawn with one pen: strokes trace in, filled marks fade in.
function drawIcons(delay: number) {
  document.querySelectorAll<SVGSVGElement>(".link-icon svg").forEach((svg, i) => {
    const start = delay + i * 70;
    const strokes = svg.querySelectorAll<SVGGeometryElement>("path, rect, circle, ellipse:not(.ico-fill)");
    animate(createDrawable(strokes), { draw: ["0 0", "0 1"], duration: 900, delay: stagger(80, { start }), ease: "inOut(2)" });
    const fills = svg.querySelectorAll(".ico-fill");
    if (fills.length) animate(fills, { opacity: [0, 1], duration: 400, delay: start + 600 });
  });
}

function gesture(link: HTMLAnchorElement): () => void {
  // Pivots are in the icon's 24-unit grid.
  const q = (s: string, pivot?: string) => {
    const els = link.querySelectorAll<SVGElement>(s);
    if (pivot) els.forEach((el) => (el.style.transformOrigin = pivot));
    return els;
  };
  const tl = createTimeline({ autoplay: false });
  switch (link.dataset.ico) {
    case "github": {
      const arm = q(".ico-arm", "9.8px 18.6px");
      tl.add(arm, { rotate: -26, duration: 180, ease: "out(2)" })
        .add(arm, { rotate: 10, duration: 200 })
        .add(arm, { rotate: 0, duration: 350, ease: "outBack(3)" })
        .add(q(".ico-eye", "12px 10.1px"), { scaleY: 0.1, duration: 80, alternate: true, loop: 1 }, 100);
      break;
    }
    case "scholar": {
      const cap = q(".ico-cap", "12px 9px");
      tl.add(cap, { y: -2.6, rotate: -8, duration: 220, ease: "out(2)" })
        .add(cap, { y: 0, rotate: 0, duration: 450, ease: "outBounce" })
        .add(q(".ico-tassel", "21px 9.2px"), { rotate: [0, 28], duration: 200, alternate: true, loop: 3, ease: "inOutSine" }, 50);
      break;
    }
    case "linkedin": {
      const dot = q(".ico-dot");
      tl.add(dot, { y: -3.2, duration: 180, ease: "out(2)" }).add(dot, { y: 0, duration: 500, ease: "outBounce" });
      break;
    }
    case "x":
      tl.add(createDrawable(q(".ico-stroke")), { draw: ["0 0", "0 1"], duration: 280, delay: stagger(120), ease: "out(2)" });
      break;
    case "instagram": {
      const lens = q(".ico-lens");
      tl.add(lens, { r: 1.4, duration: 140, ease: "in(2)" })
        .add(lens, { r: 4, duration: 400, ease: "outBack(3)" })
        .add(q(".ico-flash", "16.9px 7.1px"), { scale: 2.6, duration: 120, alternate: true, loop: 1 }, 100);
      break;
    }
    case "discord": {
      const face = q(".ico-face", "12px 12px");
      tl.add(face, { rotate: -9, duration: 160 })
        .add(face, { rotate: 7, duration: 200 })
        .add(face, { rotate: 0, duration: 300, ease: "outBack(3)" })
        .add(q(".ico-eye", "12px 12.3px"), { scaleY: 0.12, duration: 80, alternate: true, loop: 1 }, 150);
      break;
    }
    case "telegram": {
      const plane = q(".ico-plane");
      tl.add(plane, { x: 14, y: -14, opacity: 0, duration: 320, ease: "in(2)" })
        .set(plane, { x: -12, y: 12 })
        .add(plane, { x: 0, y: 0, opacity: 1, duration: 450, ease: "out(3)" });
      break;
    }
    case "appautomaton":
      tl.add(q(".ico-frame", "12px 12px"), { rotate: [0, 90], duration: 650, ease: "outBack(2)" })
        .add(q(".ico-core", "12px 12px"), { scale: 1.6, duration: 160, alternate: true, loop: 1, ease: "out(2)" }, 120);
      break;
    case "mocubix": {
      // A split-flap turnover: the top half folds onto the hinge, then both halves swing out.
      const top = q(".ico-flap-top", "12px 12px");
      const bottom = q(".ico-flap-bottom", "12px 12px");
      tl.add(top, { scaleY: [1, 0], duration: 150, ease: "in(2)" })
        .set(bottom, { scaleY: 0 }, 150)
        .add(bottom, { scaleY: 1, duration: 260, ease: "out(3)" }, 150)
        .add(top, { scaleY: 1, duration: 260, ease: "out(3)" }, 230);
      break;
    }
  }
  // The corner arrow flies in from below and to the left, alongside every icon's gesture. On an
  // <svg>, x and y are attributes, so the flight names its transforms.
  tl.add(q(".link-arrow"), { translateX: [-7, 0], translateY: [7, 0], duration: 450, ease: "out(3)" }, 0);
  return () => {
    if (tl.paused || tl.completed) tl.restart();
  };
}

// The portrait SVG holds a moonlit rendition, addressed by its #night fragment. Both are the
// same file, so switching never fetches it again.
function portrait() {
  const img = document.querySelector<HTMLImageElement>(".avatar")!;
  const src = root.dataset.theme === "dark" ? "/benji.svg#night" : "/benji.svg";
  if (img.getAttribute("src") !== src) img.src = src;
}

function setupTheme() {
  const toggles = document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]");
  const getTheme = () => (root.dataset.theme === "dark" ? "dark" : "light");
  const sync = () => {
    const label = getTheme() === "dark" ? "Switch to light theme" : "Switch to dark theme";
    toggles.forEach((t) => {
      t.setAttribute("aria-label", label);
      t.setAttribute("title", label);
    });
  };
  toggles.forEach((t) =>
    t.addEventListener("click", () => {
      const next = getTheme() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch {}
      sync();
      portrait();
      gardenChanged();
    }),
  );
  sync();
}

function analytics() {
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.append(script);
  const w = window as unknown as { dataLayer: unknown[] };
  w.dataLayer = w.dataLayer || [];
  function gtag(..._args: unknown[]) {
    // gtag.js expects the arguments object itself.
    w.dataLayer.push(arguments);
  }
  gtag("js", new Date());
  gtag("config", GA_ID);
}
