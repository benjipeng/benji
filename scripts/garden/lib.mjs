// Shared drawing kit for the garden tokens: geometry helpers, watercolor glazes, and ink edges
// that are light on the lit side and heavy on the shadow side.


export const TAU = Math.PI * 2;
export const rad = (d) => (d * Math.PI) / 180;
// Half-unit precision: finer than the eye can see at garden scale, and much lighter.
export const f = (n) => Math.round(n * 2) / 2;
export const P1 = (p) => `${f(p[0])} ${f(p[1])}`;
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, k) => [a[0] * k, a[1] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const norm = (a) => mul(a, 1 / (Math.hypot(a[0], a[1]) || 1));
export const rot = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
export const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function wobble(r, amp, freqs = [3, 7, 13]) {
  const ph = freqs.map(() => r() * TAU);
  return (t) => freqs.reduce((s, k, i) => s + (amp / (i + 1)) * Math.sin(t * k * TAU + ph[i]), 0);
}
export function through(pts) {
  let d = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${P1(add(p1, mul(sub(p2, p0), 1 / 6)))} ${P1(sub(p2, mul(sub(p3, p1), 1 / 6)))} ${P1(p2)}`;
  }
  return d;
}
export const line = (pts) => `M${P1(pts[0])}` + through(pts);
export const closed = (pts) => `M${P1(pts[0])}` + through([...pts, pts[0]]) + "Z";
export const poly = (pts) => `M${pts.map(P1).join("L")}Z`;
export const quad = (a, c, b) => (t) => add(add(mul(a, (1 - t) ** 2), mul(c, 2 * (1 - t) * t)), mul(b, t * t));
export const sample = (fn, n) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
export const centroid = (pts) => mul(pts.reduce(add, [0, 0]), 1 / pts.length);

// Light comes from the upper left: edges facing away from it get the heavy line.
export const LIGHT = norm([-0.55, -0.83]);
export function inkEdges(pts, { isClosed = true, from } = {}) {
  const c = from ?? centroid(pts);
  const n = isClosed ? pts.length : pts.length - 1;
  const runs = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    let nm = norm([-(b[1] - a[1]), b[0] - a[0]]);
    if (dot(nm, sub(lerp(a, b, 0.5), c)) < 0) nm = mul(nm, -1);
    const heavy = dot(nm, LIGHT) < -0.1;
    const last = runs[runs.length - 1];
    if (last && last.heavy === heavy) last.pts.push(b);
    else runs.push({ heavy, pts: [a, b] });
  }
  let thin = "";
  let thick = "";
  for (const run of runs) {
    const d = run.pts.length > 2 ? line(run.pts) : `M${P1(run.pts[0])}L${P1(run.pts[1])}`;
    if (run.heavy) thick += d;
    else thin += d;
  }
  return { thin, thick };
}
// A watercolor glaze: the outline scaled about a point, wobbled, and shifted off the ink line.
export function glaze(pts, r, { k = 1, about, shift = [1.4, 1.8], amp = 0.03 } = {}) {
  const c = about ?? centroid(pts);
  const w = wobble(r, amp, [2, 5, 9]);
  return pts.map((p, i) => add(add(c, mul(sub(p, c), k + w(i / pts.length))), shift));
}
// A shape's color shifts as custom properties. Shifts at their defaults are left out.
export const vars = (v = {}) => {
  const out = [];
  const add = (name, n, digits, base) => {
    const s = n.toFixed(digits).replace(/\.?0+$/, "").replace(/^(-?)0\./, "$1.");
    if (+s !== base) out.push(`${name}:${s}`);
  };
  add("--dl", v.dl ?? 0, 3, 0);
  add("--dh", v.dh ?? 0, 1, 0);
  add("--dc", v.dc ?? 1, 2, 1);
  if (v.pc) out.push(`--pc:var(${v.pc})`);
  return out.length ? ` style="${out.join(";")}"` : "";
};
export const tone = (r, base = {}) => ({
  dl: (base.dl ?? 0) + (r() - 0.5) * (base.spread ?? 0.09),
  dh: (base.dh ?? 0) + (r() - 0.5) * (base.hue ?? 22),
  dc: (base.dc ?? 1) * (0.86 + r() * 0.28),
  pc: base.pc,
});

// One drawn shape: wash glaze (optional deep glaze), then the ink edges.
export function shape(out, r, pts, v, { holes = [], deep = 0.62, deepAbout, ink = true, cls = "wash" } = {}) {
  const h = holes.map(closed).join("");
  out.push(`<path class="${cls}" fill-rule="evenodd"${vars(v)} d="${closed(glaze(pts, r))}${h}"/>`);
  if (deep) out.push(`<path class="${cls} deep" fill-rule="evenodd"${vars(v)} d="${closed(glaze(pts, r, { k: deep, about: deepAbout, amp: 0.06, shift: [0.5, 1.5] }))}${h}"/>`);
  if (ink) {
    const e = inkEdges(pts);
    out.push(`<path class="ink thin" d="${e.thin}"/><path class="ink thick" d="${e.thick}"/>`);
    for (const hole of holes) {
      const he = inkEdges(hole);
      out.push(`<path class="ink hair" d="${he.thin}"/><path class="ink thin" d="${he.thick}"/>`);
    }
  }
}
// A stalk or stem: a tapered wash with an ink line on each side.
export function stalk(out, curve, w0, w1, v, n = 24) {
  const pts = sample(curve, n);
  const L = [];
  const R = [];
  pts.forEach((p, i) => {
    const q = pts[Math.min(n, i + 1)];
    const o = pts[Math.max(0, i - 1)];
    const t = norm(sub(q, o));
    const w = (w0 + (w1 - w0) * (i / n)) / 2;
    L.push(add(p, mul([-t[1], t[0]], w)));
    R.push(add(p, mul([t[1], -t[0]], w)));
  });
  out.push(`<path class="wash stem"${vars(v)} d="M${P1(L[0])}${through(L)}L${P1(R[n])}${through([...R].reverse())}Z"/>`);
  out.push(`<path class="ink thin" d="${line(L)}"/><path class="ink mid" d="${line(R)}"/>`);
  return { L, R, pts };
}


// Growth markup. Every plant file is drawn once, and the page then grows it with scroll.
// grow(): a limb or stem. data-sp lists its spine as x, y, and half width at every other
// point, and the page clips the limb to a rounded shoot that ends where growth has reached.
// part(): a leaf, flower, or fruit that unfolds from where it attaches.
export function grow(out, g0, g1, fn) {
  const start = out.length;
  const res = fn();
  const inner = out.splice(start).join("");
  const sp = res.L.flatMap((l, i) => {
    if (i % 2 && i !== res.L.length - 1) return [];
    const r = res.R[i];
    return [P1(lerp(l, r, 0.5)), f(Math.hypot(l[0] - r[0], l[1] - r[1]) / 2)];
  });
  out.push(`<g class="gl" data-g0="${num(+g0.toFixed(3))}" data-g1="${num(+g1.toFixed(3))}" data-sp="${sp.join(" ")}">${inner}</g>`);
  return res;
}
export function part(out, g, origin, fn) {
  const start = out.length;
  const res = fn();
  const inner = out.splice(start).join("");
  out.push(`<g class="gp" data-g="${num(+Math.max(0, g).toFixed(3))}" data-o="${P1(origin)}">${inner}</g>`);
  return res;
}

// Path data, rewritten as relative commands with the shortest numbers: half-unit steps need
// few digits and compress well. A curve that leaves a smooth join (its first control point
// within half a unit of the mirror of the last one) becomes the shorter S command.
const num = (n) => String(n).replace(/^(-?)0\./, "$1.");
function numbers(vals) {
  let s = "";
  for (const v of vals) {
    const n = num(v);
    if (s && !n.startsWith("-") && !(n.startsWith(".") && /\.\d+$/.test(s))) s += " ";
    s += n;
  }
  return s;
}
const ARGS = { M: 2, L: 2, C: 6, S: 4, Q: 4, a: 7 };
export function compact(d) {
  const tok = d.match(/[a-zA-Z]|-?\d*\.?\d+/g);
  let out = "";
  let x = 0;
  let y = 0;
  let x0 = 0;
  let y0 = 0;
  let cmd = "";
  let c2 = null;
  for (let i = 0; i < tok.length; ) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    if (cmd === "Z" || cmd === "z") {
      out += "z";
      [x, y, c2] = [x0, y0, null];
      continue;
    }
    const v = tok.slice(i, (i += ARGS[cmd])).map(Number);
    if (cmd === "a") {
      out += `a${v.join(" ")}`;
      x += v[5];
      y += v[6];
      c2 = null;
      continue;
    }
    const rel = v.map((n, k) => n - (k % 2 ? y : x));
    const smooth = cmd === "C" && c2 && Math.abs(2 * x - c2[0] - v[0]) <= 0.5 && Math.abs(2 * y - c2[1] - v[1]) <= 0.5;
    c2 = cmd === "C" ? v.slice(2, 4) : null;
    [x, y] = v.slice(-2);
    if (cmd === "M") {
      [x0, y0] = [x, y];
      out += out ? `m${numbers(rel)}` : `M${numbers(v)}`;
      cmd = "L";
    } else if (smooth) out += `s${numbers(rel.slice(2))}`;
    else out += cmd.toLowerCase() + numbers(rel);
  }
  return out;
}
