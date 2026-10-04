// Woody tokens: long branches that reach into the garden from the left or right edge.
// Each branch is drawn left to right from its base at the edge, and the page mirrors the
// ones that enter from the right.

import { TAU, rad, P1, add, sub, mul, rot, polar, lerp, wobble, line, closed, sample, glaze, vars, tone, shape, inkEdges, grow, part } from "./lib.mjs";

// Smooth spine through control points (Catmull-Rom), sampled evenly per segment.
function spineThrough(ctrl, perSeg = 14) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const m1 = mul(sub(p2, p0), 0.5);
    const m2 = mul(sub(p3, p1), 0.5);
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(add(add(mul(p1, 2 * t3 - 3 * t2 + 1), mul(m1, t3 - 2 * t2 + t)), add(mul(p2, -2 * t3 + 3 * t2), mul(m2, t3 - t2))));
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}
const angleOf = (pts, i) => {
  const a = pts[Math.max(0, i - 1)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
};

// An organic limb with volume: an opaque bark wash, a shaded band along the underside,
// a lit sliver along the top, bark texture in the shadow, and ink that is light above
// and heavy below. `cap` is "blunt" (rounded end) or "taper". Forks are drawn on top of
// their parent with ink starting past the crotch, so the joint reads as one piece.
function limb(out, r, ctrl, { w0, w1, cap = "taper", pc = "--bark", lenticels = false, inkFrom = 0, swell = [] }) {
  const pts = spineThrough(ctrl);
  const n = pts.length - 1;
  const width = (t) => (w0 + (w1 - w0) * t ** 0.85) * (1 + swell.reduce((s, [at, k]) => s + k * Math.exp(-(((t - at) / 0.04) ** 2)), 0));
  const L = [];
  const R = [];
  pts.forEach((p, i) => {
    const a = angleOf(pts, i);
    const w = width(i / n) / 2;
    L.push(add(p, polar(w, a - Math.PI / 2)));
    R.push(add(p, polar(w, a + Math.PI / 2)));
  });
  const endA = angleOf(pts, n);
  const capPts = cap === "blunt" ? sample((t) => add(pts[n], polar(width(1) / 2, endA - Math.PI / 2 + t * Math.PI)), 8).slice(1, -1) : [add(pts[n], polar(width(1) * 0.8, endA))];
  const body = [...L, ...capPts, ...[...R].reverse()];
  const v = tone(r, { pc, spread: 0.025, hue: 6 });
  out.push(`<path class="wash bark"${vars(v)} d="${closed(body)}"/>`);
  // Underside shade and top light, both inside the limb.
  const shade = [...pts.map((p, i) => lerp(p, R[i], 0.15)), ...[...R].reverse().map((p, i) => lerp(p, pts[n - i], 0.06))];
  out.push(`<path class="wash bark-shade"${vars(v)} d="${closed(shade)}"/>`);
  const lit = [...L.map((p, i) => lerp(p, pts[i], 0.12)), ...[...L].reverse().map((p, i) => lerp(p, pts[n - i], 0.42))];
  out.push(`<path class="wash bark-lit"${vars(v)} d="${closed(lit)}"/>`);
  let tex = "";
  for (let k = 0; k < n / 3; k++) {
    const i = 1 + Math.floor(r() * (n - 4));
    const off = 0.15 + r() * 0.35;
    tex += `M${P1(lerp(pts[i], R[i], off))}L${P1(lerp(pts[i + 2], R[i + 2], off + (r() - 0.5) * 0.1))}`;
  }
  if (lenticels) {
    for (let k = 0; k < n / 2; k++) {
      const i = 1 + Math.floor(r() * (n - 2));
      const c = lerp(L[i], R[i], 0.2 + r() * 0.6);
      const a = angleOf(pts, i) + Math.PI / 2;
      tex += `M${P1(add(c, polar(1.8, a)))}L${P1(add(c, polar(-1.8, a)))}`;
    }
  }
  out.push(`<path class="ink hair bark-tex" d="${tex}"/>`);
  const i0 = Math.round(inkFrom * n);
  out.push(`<path class="ink thin" d="${line(L.slice(i0))}"/>`);
  out.push(`<path class="ink thick" d="${line([...R.slice(i0), ...(cap === "blunt" ? [...capPts].reverse() : capPts)])}"/>`);
  if (cap === "blunt") out.push(`<path class="ink thin" d="${line([L[n], ...capPts])}"/>`);
  return { pts, L, R, width, n };
}

// ---------------------------------------------------------------------------
// Frangipani: thick, smooth, upturned limbs ending blunt, spiral rosettes of broad leaves
// at the tips, and a dome of pinwheel flowers, cream petals warming to yellow at the heart.
export function plumeriaLeaf(out, r, O, dir, L) {
  const W = 0.34 * L;
  const prof = (s) => Math.sin(Math.PI * Math.min(1, s) ** 1.25) ** 0.8 * Math.min(1, 0.3 + s * 2.2);
  const bend = (r() - 0.45) * 0.14 * L;
  const mid = (s) => [s * L, bend * s * s];
  const toWorld = (p) => add(O, rot(p, dir));
  const up = sample((s) => add(mid(s), [0, -(W / 2) * prof(s)]), 22);
  const dn = sample((s) => add(mid(s), [0, (W / 2) * prof(s) * 0.94]), 22);
  const outline = [...up, mid(1.04), ...dn.slice(0, -1).reverse()];
  shape(out, r, outline.map(toWorld), tone(r), { deep: 0.58, deepAbout: toWorld(mid(0.38)) });
  let veins = "";
  for (let k = 2; k < 20; k += 2) {
    const s = k / 21;
    for (const sg of [-1, 1]) {
      const h = (W / 2) * prof(s) * (sg < 0 ? 1 : 0.94);
      veins += `M${P1(toWorld(mid(s)))}Q${P1(toWorld(add(mid(s + 0.015), [0, sg * h * 0.55])))} ${P1(toWorld(add(mid(s + 0.03), [0, sg * h * 0.84])))}`;
    }
  }
  for (const sg of [-1, 1]) veins += line(sample((s) => add(mid(s), [0, sg * (W / 2) * prof(s) * 0.86 * (sg < 0 ? 1 : 0.94)]), 16).slice(2, -1).map(toWorld));
  out.push(`<path class="ink hair vein" d="${veins}"/>`);
  out.push(`<path class="wash band"${vars({})} d="${closed([mid(0), add(mid(0.5), [0, -1.6]), mid(0.98), add(mid(0.5), [0, 1.6])].map(toWorld))}"/><path class="ink mid" d="${line(sample(mid, 8).slice(0, -1).map(toWorld))}"/>`);
}
export function plumeriaFlower(out, r, c, size, spin) {
  // Five broad petals, each overlapping the next in a spiral.
  const petal = [[0.02, 0.02], [0.22, -0.12], [0.5, -0.3], [0.82, -0.36], [1.02, -0.18], [1.04, 0.06], [0.9, 0.24], [0.62, 0.3], [0.32, 0.22], [0.1, 0.1]];
  for (let k = 0; k < 5; k++) {
    const a = spin + (k * TAU) / 5;
    const toW = (p) => add(c, rot([p[0] * size, p[1] * size], a));
    const pts = petal.map(toW);
    shape(out, r, pts, tone(r, { pc: "--petal", spread: 0.025, hue: 6 }), { deep: 0, ink: true });
    // Warm heart: a yellow glaze over the inner part of each petal.
    const heart = petal.map(([x, y]) => [x * 0.48, y * 0.5]).map(toW);
    out.push(`<path class="wash heart"${vars(tone(r, { pc: "--flower-heart", spread: 0.04 }))} d="${closed(glaze(heart, r, { shift: [0, 0], amp: 0.05 }))}"/>`);
    out.push(`<path class="ink hair vein" d="${line([[0.08, 0], [0.5, -0.04], [0.9, -0.06]].map(toW))}"/>`);
  }
}
function plumeriaBud(out, r, base, dir, len) {
  const tip = add(base, polar(len, dir));
  const n = polar(1, dir + Math.PI / 2);
  // A furled bud: a slim spindle with a spiral seam.
  const pts = [add(base, mul(n, -len * 0.07)), add(lerp(base, tip, 0.6), mul(n, -len * 0.17)), add(lerp(base, tip, 0.9), mul(n, -len * 0.08)), tip, add(lerp(base, tip, 0.9), mul(n, len * 0.06)), add(lerp(base, tip, 0.6), mul(n, len * 0.15)), add(base, mul(n, len * 0.07))];
  shape(out, r, pts, tone(r, { pc: "--petal", dl: -0.05, spread: 0.03 }), { deep: 0.45 });
  out.push(`<path class="wash heart"${vars({ pc: "--flower-heart", dl: 0.04 })} d="${closed([add(base, mul(n, -len * 0.05)), add(lerp(base, tip, 0.35), mul(n, -len * 0.1)), add(lerp(base, tip, 0.35), mul(n, len * 0.1)), add(base, mul(n, len * 0.05))])}"/>`);
  out.push(`<path class="ink hair" d="M${P1(add(lerp(base, tip, 0.3), mul(n, -len * 0.14)))}Q${P1(add(lerp(base, tip, 0.6), mul(n, len * 0.1)))} ${P1(tip)}"/>`);
}
function plumeriaCrown(out, r, tip, a, flowers, phase, gate) {
  if (phase === "leaves") {
    // Leaves spiral from the blunt tip, and the lower ones droop.
    [-96, -62, -30, 2, 34, 66, 100].forEach((d, i) => {
      const la = a + rad(d + (r() - 0.5) * 14);
      const droop = Math.sin(la) > 0.2 ? rad(16) * Math.sign(Math.cos(la) || 1) : 0;
      const len = (180 + r() * 70) * (i % 2 ? 0.9 : 1);
      part(out, gate + i * 0.012, tip, () => plumeriaLeaf(out, r, tip, la + droop, len));
    });
    return;
  }
  // A branched peduncle lifts a dome of flowers above the rosette. Buds open first, then flowers.
  const stem = add(tip, polar(70, a - rad(38)));
  const spots = [[0, 0], [62, -10], [-50, -24], [16, -62], [70, 48], [-44, 44]].slice(0, flowers);
  part(out, gate, tip, () => {
    out.push(`<path class="ink mid" d="M${P1(tip)}Q${P1(add(tip, polar(40, a - rad(12))))} ${P1(stem)}"/>`);
    spots.forEach(([dx, dy]) => {
      const c = add(stem, rot([dx, dy], a - rad(30)));
      out.push(`<path class="ink thin" d="M${P1(stem)}Q${P1(add(lerp(stem, c, 0.5), [0, 6]))} ${P1(c)}"/>`);
    });
  });
  [[30, -70, -60], [-24, -80, -110], [86, 6, -20], [-70, -2, -150]].forEach(([dx, dy, d], k) => {
    const b = add(stem, rot([dx * 0.5, dy * 0.5], a - rad(30)));
    const len = 38 + r() * 8;
    part(out, gate + 0.03 + k * 0.012, b, () => plumeriaBud(out, r, b, a + rad(d), len));
  });
  spots.forEach(([dx, dy], k) => {
    const c = add(stem, rot([dx, dy], a - rad(30)));
    const size = 50 + r() * 10;
    const spin = r() * TAU;
    part(out, gate + 0.06 + k * 0.022, c, () => plumeriaFlower(out, r, c, size, spin));
  });
}
export function frangipani(out, r, base) {
  const fork = add(base, [330, -40]);
  const scarsOf = (s) => {
    let d = "";
    for (let i = s.n - 14; i < s.n - 2; i += 3) d += `M${P1(lerp(s.L[i], s.R[i], 0.2))}Q${P1(lerp(s.L[i + 1], s.R[i + 1], 0.5))} ${P1(lerp(s.L[i], s.R[i], 0.8))}`;
    out.push(`<path class="ink hair" d="${d}"/>`);
  };
  grow(out, 0, 0.34, () => limb(out, r, [add(base, [-40, 10]), add(base, [120, -6]), add(base, [240, -26]), add(fork, [10, -2])], { w0: 50, w1: 44, cap: "blunt", pc: "--bark-pale", lenticels: true }));
  const upper = grow(out, 0.28, 0.58, () => {
    const s = limb(out, r, [lerp(base, fork, 0.9), add(fork, [50, -30]), add(fork, [110, -120]), add(fork, [150, -230])], { w0: 42, w1: 34, cap: "blunt", pc: "--bark-pale", lenticels: true, inkFrom: 0.16, swell: [[0.55, 0.06]] });
    scarsOf(s);
    return s;
  });
  const lower = grow(out, 0.3, 0.62, () => {
    const s = limb(out, r, [lerp(base, fork, 0.9), add(fork, [90, 10]), add(fork, [240, 20]), add(fork, [400, -10])], { w0: 42, w1: 32, cap: "blunt", pc: "--bark-pale", lenticels: true, inkFrom: 0.16, swell: [[0.6, 0.05]] });
    scarsOf(s);
    return s;
  });
  const crowns = [[upper, 6, 0.56], [lower, 4, 0.6]].map(([s, n, g]) => [s.pts[s.n], angleOf(s.pts, s.n), n, g]);
  crowns.forEach(([tip, a, n, g]) => plumeriaCrown(out, r, tip, a, n, "leaves", g));
  crowns.forEach(([tip, a, n, g]) => plumeriaCrown(out, r, tip, a, n, "flowers", g + 0.16));
}

// ---------------------------------------------------------------------------
// Orchid tree: a slender, gently zigzagging branch, two-lobed butterfly leaves on long
// stalks, and two orchid-like flowers with wavy petals and five fine curving stamens.
export function bauhiniaLeaf(out, r, O, dir, L) {
  const toWorld = (p) => add(O, rot(p, dir));
  const k = 0.95 + r() * 0.1;
  const upper = [[0, 0], [-0.06, -0.14], [0.06, -0.36 * k], [0.32, -0.5 * k], [0.66, -0.46 * k], [0.92, -0.28 * k], [1.0, -0.12], [0.86, -0.03], [0.74, 0]];
  const lower = upper.map(([x, y]) => [x, -y * (0.95 + r() * 0.08)]);
  const outline = [...upper, ...lower.slice(0, -1).reverse()].map(([x, y]) => toWorld([x * L, y * L]));
  shape(out, r, outline, tone(r), { deep: 0.55, deepAbout: toWorld([0.25 * L, 0]) });
  let veins = "";
  for (let i = 0; i < 9; i++) {
    const a = rad(-100 + (200 * i) / 8);
    const reach = i === 4 ? 0.72 : 0.62 + 0.25 * Math.cos(a) ** 2;
    veins += `M${P1(toWorld([0.04 * L, 0]))}Q${P1(toWorld([0.2 * L * Math.cos(a) + 0.12 * L, 0.3 * L * Math.sin(a)]))} ${P1(toWorld([L * reach * Math.cos(a * 0.62) + 0.05 * L, 0.46 * L * Math.sin(a) * 0.95]))}`;
  }
  out.push(`<path class="ink hair vein" d="${veins}"/><path class="ink mid" d="M${P1(toWorld([0, 0]))}L${P1(toWorld([0.72 * L, 0]))}"/>`);
}
export function bauhiniaFlower(out, r, c, size, spin) {
  // Five spoon-shaped petals on slender claws, slightly cupped (foreshortened) and
  // overlapping at the heart. Each fades from white at the tip to lilac at the base,
  // and the upper petal (the standard) carries a purple blotch with feathered veins.
  const order = [1, 4, 2, 3, 0];
  const PET = [
    { d: -88, len: 1.0, w: 0.34, cup: 0.9 },
    { d: -14, len: 1.04, w: 0.42, cup: 0.82 },
    { d: 56, len: 0.98, w: 0.42, cup: 0.88 },
    { d: 124, len: 1.0, w: 0.4, cup: 0.86 },
    { d: 194, len: 1.02, w: 0.42, cup: 0.8 },
  ];
  for (const k of order) {
    const pt = PET[k];
    const a = spin + rad(pt.d + (r() - 0.5) * 8);
    const toW = (p) => add(c, rot([p[0] * size * pt.len, p[1] * size * pt.cup], a));
    const wav = wobble(r, 0.03, [7, 13]);
    const half = (x) => {
      // slender claw, then a broad spoon with a softly rippled rim
      const claw = x < 0.34 ? 0.07 + 0.9 * (x / 0.34) ** 2.2 * 0.5 : 0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, (x - 0.34) / 0.66) ** 0.7);
      return pt.w * claw * (x > 0.9 ? Math.sqrt(Math.max(0, 1 - ((x - 0.9) / 0.1) ** 2)) * 0.85 + 0.15 : 1);
    };
    const up = sample((x) => [x, -half(x) * (1 + wav(x))], 22);
    const dn = sample((x) => [x, half(x) * (1 + wav(x + 0.5))], 22);
    const outline = [...up, [1.02, 0], ...dn.slice(0, -1).reverse()].map(toW);
    const v = tone(r, { pc: "--petal", spread: 0.02, hue: 6 });
    out.push(`<path class="wash petal"${vars(v)} d="${closed(glaze(outline, r, { shift: [0.6, 0.8], amp: 0.01 }))}"/>`);
    // Lilac flush bleeding from the base in two soft, rounded layers, deeper on the standard.
    const flushLayer = (to, cls) => {
      const pts = [...sample((x) => [x * to, -half(x * to) * 0.9], 10), ...sample((t) => [to + 0.08 * Math.sin(Math.PI * t), (t - 0.5) * 2 * half(to) * 0.9], 8).slice(1, -1), ...sample((x) => [x * to, half(x * to) * 0.9], 10).reverse()].map(toW);
      out.push(`<path class="wash ${cls}"${vars(tone(r, { pc: "--petal-lilac", spread: 0.03 }))} d="${closed(glaze(pts, r, { shift: [0, 0], amp: 0.05 }))}"/>`);
    };
    flushLayer(k === 0 ? 0.7 : 0.5, "lilac-flush");
    flushLayer(k === 0 ? 0.42 : 0.26, k === 0 ? "lilac-flush deep" : "lilac-flush");
    let veins = "";
    const nV = k === 0 ? 9 : 7;
    for (let j = 0; j < nV; j++) {
      const f0 = (j / (nV - 1) - 0.5) * 1.6;
      const reach = 0.78 + r() * 0.12;
      veins += `M${P1(toW([0.3, f0 * half(0.3) * 0.5]))}Q${P1(toW([0.55, f0 * half(0.55) * 0.75]))} ${P1(toW([reach, f0 * half(reach) * 0.85]))}`;
      if (j % 2 && j < nV - 1) veins += `M${P1(toW([0.6, f0 * half(0.6) * 0.78]))}L${P1(toW([0.74, (f0 + 0.18) * half(0.74) * 0.82]))}`;
    }
    out.push(`<path class="ink hair petal-vein${k === 0 ? " standard" : ""}" d="${veins}"/>`);
    const e = inkEdges(outline, { from: toW([0.6, 0]) });
    out.push(`<path class="ink hair petal-edge" d="${e.thin}${e.thick}"/>`);
  }
  // The little green tube where the petals meet.
  out.push(`<path class="wash"${vars({ pc: "--stem-green", dl: 0.06 })} d="${closed(sample((t) => add(c, polar(size * 0.07, t * TAU)), 10))}"/>`);
  // Stamens and pistil: slender tapered stalks with a pale wash and hairline edges, all
  // arching up and out together, with oblong anthers set crosswise on the tips. The pistil is a
  // little longer and fuller, ending in a small green stigma.
  const stalkShape = (to, bow, w0, w1) => {
    const ctrl = add(lerp(c, to, 0.5), polar(bow, Math.atan2(to[1] - c[1], to[0] - c[0]) - Math.PI / 2));
    const sp = sample((t) => add(add(mul(c, (1 - t) ** 2), mul(ctrl, 2 * (1 - t) * t)), mul(to, t * t)), 12);
    const L = [];
    const R = [];
    sp.forEach((q, i) => {
      const a = Math.atan2(sp[Math.min(12, i + 1)][1] - sp[Math.max(0, i - 1)][1], sp[Math.min(12, i + 1)][0] - sp[Math.max(0, i - 1)][0]);
      const w = (w0 + (w1 - w0) * (i / 12)) / 2;
      L.push(add(q, polar(w, a - Math.PI / 2)));
      R.push(add(q, polar(w, a + Math.PI / 2)));
    });
    return { pts: [...L, ...[...R].reverse()], end: sp[12], endA: Math.atan2(sp[12][1] - sp[11][1], sp[12][0] - sp[11][0]) };
  };
  const arch = spin + rad(-104);
  const parts = [];
  for (let j = 0; j < 5; j++) {
    const a = arch + rad((j - 2) * 7);
    parts.push({ to: add(c, polar(size * (1.02 + Math.abs(j - 2) * -0.04 + r() * 0.04), a)), bow: size * (0.16 + j * 0.012), w0: size * 0.024, w1: size * 0.012, pistil: false });
  }
  parts.push({ to: add(c, polar(size * 1.14, arch + rad(20))), bow: size * 0.24, w0: size * 0.026, w1: size * 0.016, pistil: true });
  for (const pr of parts) {
    const st = stalkShape(pr.to, pr.bow, pr.w0, pr.w1);
    out.push(`<path class="wash filament"${vars({ pc: pr.pistil ? "--pistil" : "--filament" })} d="${closed(st.pts)}"/>`);
    out.push(`<path class="ink hair filament-edge" d="${closed(st.pts)}"/>`);
    if (pr.pistil) {
      out.push(`<path class="wash anther"${vars({ pc: "--pistil", dl: -0.08 })} d="${closed(sample((t) => add(st.end, polar(size * 0.024, t * TAU)), 10))}"/><path class="ink hair" d="${closed(sample((t) => add(st.end, polar(size * 0.024, t * TAU)), 10))}"/>`);
    } else {
      const ax = st.endA + Math.PI / 2;
      const sac = sample((t) => add(st.end, rot([size * 0.055 * Math.cos(t * TAU), size * 0.022 * Math.sin(t * TAU)], ax)), 12);
      out.push(`<path class="wash anther"${vars({ pc: "--anther" })} d="${closed(sac)}"/><path class="ink hair" d="${closed(sac)}"/>`);
    }
  }
}
export function bauhinia(out, r, base) {
  const s = grow(out, 0, 0.62, () => limb(out, r, [add(base, [-30, 6]), add(base, [150, -26]), add(base, [300, -14]), add(base, [450, -48]), add(base, [600, -40]), add(base, [720, -70])], { w0: 18, w1: 6, cap: "taper", pc: "--bark", lenticels: false }));
  let side = 1;
  const leaves = [];
  for (let i = 8; i < s.n - 8; i += 6 + Math.floor(r() * 2)) {
    const p = s.pts[i];
    const a = angleOf(s.pts, i);
    const pa = a - side * rad(55 + r() * 25);
    const pet = 34 + r() * 22;
    leaves.push({ p, pa, pet, side, t: i / s.n, L: (92 + (1 - i / s.n) * 48) * (0.85 + r() * 0.3) });
    side = -side;
  }
  leaves.forEach(({ p, pa, pet, side: sd, t, L }) => {
    const at = add(p, polar(pet, pa));
    const turn = pa + sd * rad(18) + (r() - 0.5) * rad(20);
    part(out, t * 0.62 + 0.03, p, () => {
      out.push(`<path class="ink mid" d="M${P1(p)}Q${P1(add(p, polar(pet * 0.6, pa + sd * rad(10))))} ${P1(at)}"/>`);
      bauhiniaLeaf(out, r, at, turn, L);
    });
  });
  const tip = s.pts[s.n];
  [[-70, -78, 0.5], [40, 44, 3.6]].forEach(([dx, dy, sp], k) => {
    const c = add(tip, [dx, dy]);
    const from = lerp(tip, s.pts[s.n - 6], 0.5);
    const size = 50 + r() * 8;
    part(out, 0.74 + k * 0.08, from, () => {
      out.push(`<path class="ink mid" d="M${P1(from)}Q${P1(add(lerp(tip, c, 0.5), [-10, 0]))} ${P1(c)}"/>`);
      bauhiniaFlower(out, r, c, size, sp);
    });
  });
}

// ---------------------------------------------------------------------------
// Mango: loose, drooping clusters of smooth leathery leaves at the shoot tips, and two
// mangoes on a long stalk, green at the shoulder ripening to gold with a soft blush.
export function mangoLeaf(out, r, O, dir, L) {
  const W = 0.23 * L;
  const prof = (s) => Math.sin(Math.PI * Math.min(1, s) ** 0.8) ** 0.75;
  const bend = (0.05 + r() * 0.1) * L;
  const wav = wobble(r, 0.004 * L, [3, 5]);
  const mid = (s) => [s * L, bend * s * s];
  const toWorld = (p) => add(O, rot(p, dir));
  const up = sample((s) => add(mid(s), [0, -(W / 2) * prof(s) - wav(s)]), 22);
  const dn = sample((s) => add(mid(s), [0, (W / 2) * prof(s) + wav(s + 0.3)]), 22);
  const outline = [...up, mid(1.03), ...dn.slice(0, -1).reverse()];
  shape(out, r, outline.map(toWorld), tone(r, { spread: 0.08 }), { deep: 0.6, deepAbout: toWorld(mid(0.35)) });
  let veins = "";
  for (let k = 2; k < 18; k += 2) {
    const s = k / 19;
    for (const sg of [-1, 1]) veins += `M${P1(toWorld(mid(s)))}Q${P1(toWorld(add(mid(s + 0.03), [0, sg * (W / 2) * prof(s) * 0.5])))} ${P1(toWorld(add(mid(s + 0.06), [0, sg * (W / 2) * prof(s + 0.06) * 0.86])))}`;
  }
  out.push(`<path class="ink hair vein" d="${veins}"/><path class="wash band"${vars({})} d="${closed([mid(0), add(mid(0.5), [0, -1.8]), mid(0.98), add(mid(0.5), [0, 1.8])].map(toWorld))}"/><path class="ink mid" d="${line(sample(mid, 8).slice(0, -1).map(toWorld))}"/>`);
}
export function mangoFruit(out, r, top, size, lean) {
  const toW = (p) => add(top, rot([p[0] * size, p[1] * size], lean));
  // Kidney-oval with a fuller back, a flatter belly, and a faint beak low on the belly.
  const pts = [[0, 0.02], [0.22, 0.08], [0.36, 0.3], [0.4, 0.66], [0.32, 1.0], [0.16, 1.22], [-0.04, 1.3], [-0.14, 1.22], [-0.16, 1.12], [-0.22, 1.04], [-0.28, 0.8], [-0.3, 0.46], [-0.22, 0.14]];
  shape(out, r, pts.map(toW), tone(r, { pc: "--fruit-mango", spread: 0.03, hue: 8 }), { deep: 0.58, deepAbout: toW([0.08, 1.0]) });
  out.push(`<path class="wash green-cap"${vars({ pc: "--fruit-unripe" })} d="${closed(glaze([[0, 0.02], [0.24, 0.08], [0.34, 0.24], [0.1, 0.36], [-0.18, 0.3], [-0.22, 0.14]].map(toW), r, { shift: [0, 0], amp: 0.06 }))}"/>`);
  out.push(`<path class="wash blush"${vars({ pc: "--blush" })} d="${closed(glaze([[0.1, 0.24], [0.34, 0.34], [0.38, 0.7], [0.24, 0.86], [0.06, 0.56]].map(toW), r, { shift: [0, 0], amp: 0.08 }))}"/>`);
  out.push(`<path class="wash shine"${vars({})} d="${closed([[0.18, 0.2], [0.3, 0.3], [0.3, 0.46], [0.2, 0.36]].map(toW))}"/>`);
}
export function mango(out, r, base) {
  const fork = add(base, [360, -40]);
  const side = grow(out, 0.26, 0.56, () => limb(out, r, [lerp(base, fork, 0.9), add(fork, [70, -50]), add(fork, [140, -110]), add(fork, [200, -140])], { w0: 16, w1: 9, cap: "taper", inkFrom: 0.15 }));
  const main = grow(out, 0, 0.6, () => limb(out, r, [add(base, [-30, 6]), add(base, [200, -40]), fork, add(base, [520, -30]), add(base, [660, -70])], { w0: 28, w1: 11, cap: "taper", lenticels: true }));
  // Drooping leaf clusters fall from each tip in a loose spiral.
  [[side, 0.54], [main, 0.58]].forEach(([s, g]) => {
    const tip = s.pts[s.n];
    const a = angleOf(s.pts, s.n);
    [-70, -40, -12, 14, 40, 70, 100, 132].forEach((d, i) => {
      const la = a + rad(d + (r() - 0.5) * 14);
      const toDown = ((rad(90) - la + Math.PI * 3) % TAU) - Math.PI;
      const len = 190 + r() * 70;
      part(out, g + i * 0.012, tip, () => mangoLeaf(out, r, tip, la + toDown * 0.35, len));
    });
  });
  // A long stalk hangs from the main limb carrying two mangoes. They swell last.
  const hang = main.pts[Math.round(main.n * 0.5)];
  const knot = add(hang, [10, 150]);
  part(out, 0.76, hang, () => {
    out.push(`<path class="ink mid" d="M${P1(hang)}C${P1(add(hang, [24, 40]))} ${P1(add(knot, [-6, -60]))} ${P1(knot)}"/>`);
    [[-34, 0], [30, 10]].forEach(([dx, dy]) => out.push(`<path class="ink thin" d="M${P1(knot)}Q${P1(add(knot, [dx * 0.5, 14]))} ${P1(add(knot, [dx, 34 + dy]))}"/>`));
  });
  [[-34, 0, rad(12)], [30, 10, rad(-10)]].forEach(([dx, dy, lean], k) => {
    const t = add(knot, [dx, 34 + dy]);
    const size = 104 + r() * 12;
    part(out, 0.84 + k * 0.04, t, () => mangoFruit(out, r, t, size, lean));
  });
}

// ---------------------------------------------------------------------------
// Lychee: drooping pinnate leaves of glossy leaflets, and a hanging cluster of egg-shaped
// fruit with a pebbled, softly scalloped skin, mostly rose-red, one or two still blushing.
export function lycheeLeaflet(out, r, O, dir, L) {
  const W = 0.3 * L;
  const prof = (s) => Math.sin(Math.PI * Math.min(1, s) ** 0.9) ** 0.75;
  const bend = (r() - 0.2) * 0.12 * L;
  const mid = (s) => [s * L, bend * s * s];
  const toWorld = (p) => add(O, rot(p, dir));
  const up = sample((s) => add(mid(s), [0, -(W / 2) * prof(s)]), 14);
  const dn = sample((s) => add(mid(s), [0, (W / 2) * prof(s)]), 14);
  shape(out, r, [...up, mid(1.04), ...dn.slice(0, -1).reverse()].map(toWorld), tone(r), { deep: 0.55, deepAbout: toWorld(mid(0.35)) });
  out.push(`<path class="wash shine"${vars({})} d="${closed([mid(0.15), add(mid(0.45), [0, -W * 0.3]), add(mid(0.7), [0, -W * 0.22]), mid(0.5)].map(toWorld))}"/><path class="ink mid" d="${line(sample(mid, 6).map(toWorld))}"/>`);
}
export function lycheeLeaf(out, r, O, dir, len) {
  // The rachis arches out and droops, and leaflets sit in near-opposite pairs.
  const end = add(add(O, polar(len, dir)), [0, len * 0.22]);
  const c = add(O, polar(len * 0.5, dir - rad(8)));
  const rachis = sample((t) => add(add(mul(O, (1 - t) ** 2), mul(c, 2 * (1 - t) * t)), mul(end, t * t)), 10);
  out.push(`<path class="ink mid" d="${line(rachis)}"/>`);
  [0.32, 0.56, 0.8, 1].forEach((t, i) => {
    const p = rachis[Math.round(t * 10)];
    const a = angleOf(rachis, Math.round(t * 10));
    for (const sg of [-1, 1]) lycheeLeaflet(out, r, p, a + sg * rad(i === 3 ? 20 : 46 + r() * 12) + rad(10), (82 + i * 14) * (0.85 + r() * 0.3));
  });
}
export function lycheeFruit(out, r, c, R, ripe = 1) {
  const bump = wobble(r, 0.025, [9, 17]);
  const pts = sample((t) => {
    const a = t * TAU;
    const k = (1 + 0.08 * Math.sin(a) + bump(t)) * (1 - 0.06 * Math.cos(2 * a));
    return add(c, [R * Math.cos(a) * k * 0.92, R * Math.sin(a) * k * 1.06]);
  }, 30).slice(0, -1);
  const pc = ripe ? "--fruit-lychee" : "--fruit-blushing";
  shape(out, r, pts, tone(r, { pc, spread: 0.06, hue: 10 }), { deep: 0.6, deepAbout: add(c, [R * 0.22, R * 0.32]) });
  // Pebbled skin: small irregular cells, sparser toward the lit shoulder.
  let cells = "";
  for (let k = 0; k < 34; k++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 0.82;
    const p = add(c, [Math.cos(a) * d * R * 0.9, Math.sin(a) * d * R]);
    if (p[0] - c[0] < -R * 0.2 && p[1] - c[1] < -R * 0.2 && r() < 0.6) continue;
    const s = R * (0.06 + r() * 0.03);
    cells += `M${P1(add(p, [-s, s * 0.4]))}Q${P1(add(p, [0, -s * 1.1]))} ${P1(add(p, [s, s * 0.4]))}`;
  }
  out.push(`<path class="ink hair bumps" d="${cells}"/>`);
  out.push(`<path class="wash shine"${vars({})} d="${closed(sample((t) => add(add(c, [-R * 0.34, -R * 0.4]), [R * 0.18 * Math.cos(t * TAU), R * 0.12 * Math.sin(t * TAU)]), 8))}"/>`);
}
export function lychee(out, r, base) {
  const main = grow(out, 0, 0.62, () => limb(out, r, [add(base, [-30, 6]), add(base, [220, -50]), add(base, [420, -40]), add(base, [660, -90])], { w0: 24, w1: 9, cap: "taper", lenticels: true }));
  let side = 1;
  for (let i = 6; i < main.n - 2; i += 9) {
    const p = main.pts[i];
    const a = angleOf(main.pts, i) - side * rad(40 + r() * 20);
    const len = 220 + r() * 50;
    part(out, (i / main.n) * 0.62 + 0.03, p, () => lycheeLeaf(out, r, p, a, len));
    side = -side;
  }
  // The panicle droops from the limb and branches to each fruit. Fruit swells last.
  const hang = main.pts[Math.round(main.n * 0.55)];
  const knot = add(hang, [22, 120]);
  const fruits = [[-66, 46, 1], [-22, 64, 1], [24, 54, 1], [66, 36, 0], [-44, 104, 1], [6, 112, 1], [50, 94, 1], [-10, 160, 1]];
  part(out, 0.74, hang, () => {
    out.push(`<path class="ink mid" d="M${P1(hang)}C${P1(add(hang, [30, 40]))} ${P1(add(knot, [-10, -50]))} ${P1(knot)}"/>`);
    fruits.forEach(([dx, dy]) => out.push(`<path class="ink thin" d="M${P1(knot)}Q${P1(add(knot, [dx * 0.5, dy * 0.15]))} ${P1(add(knot, [dx, dy - 26]))}"/>`));
  });
  [...fruits].sort((a, b) => a[1] - b[1]).forEach(([dx, dy, ripe], k) => {
    const c = add(knot, [dx, dy]);
    const R = 27 + r() * 5;
    part(out, 0.8 + k * 0.02, add(c, [0, -R]), () => lycheeFruit(out, r, c, R, ripe));
  });
}

