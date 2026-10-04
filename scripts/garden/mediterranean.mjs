// The Mediterranean garden: a coastal terrace by moonlight in the dry season. Branches of
// olive, fig, lemon, and stone pine reach in from the sides, grapevine, star jasmine, and
// bougainvillea hang from above, and Italian cypress, lavender, rosemary, agave, and acanthus
// rise from the bed. Drawn with the same kit as the tropical garden.

import { TAU, rad, P1, add, mul, rot, polar, lerp, wobble, line, closed, sample, vars, tone, shape, stalk, quad, grow, part } from "./lib.mjs";
import { limb, angleOf } from "./woody.mjs";

// ---------------------------------------------------------------------------
// Shared shapes

// A blade leaf along a gently curved midrib. W is its width as a share of its length, prof
// its outline from base (0) to tip (1).
function blade(out, r, O, dir, L, { W = 0.3, prof = (s) => Math.sin(Math.PI * Math.min(1, s) ** 0.85) ** 0.8, bend = 0, v = tone(r), veins = 0, shine = false, deep = 0.55, wavy = 0, rib = "ink mid" } = {}) {
  const mid = (s) => [s * L, bend * L * s * s];
  const toW = (p) => add(O, rot(p, dir));
  const wav = wobble(r, wavy * L, [4, 7]);
  const half = (s) => (W * L * prof(s)) / 2;
  const up = sample((s) => add(mid(s), [0, -half(s) - wav(s)]), 18);
  const dn = sample((s) => add(mid(s), [0, half(s) + wav(s + 0.3)]), 18);
  shape(out, r, [...up, mid(1.02), ...dn.slice(0, -1).reverse()].map(toW), v, { deep, deepAbout: toW(mid(0.35)) });
  if (veins) {
    let d = "";
    for (let k = 1; k <= veins; k++) {
      const s = k / (veins + 1);
      for (const sg of [-1, 1]) d += `M${P1(toW(mid(s)))}Q${P1(toW(add(mid(s + 0.05), [0, sg * half(s) * 0.5])))} ${P1(toW(add(mid(s + 0.1), [0, sg * half(s + 0.1) * 0.85])))}`;
    }
    out.push(`<path class="ink hair vein" d="${d}"/>`);
  }
  if (shine) out.push(`<path class="wash shine" d="${closed([mid(0.2), add(mid(0.45), [0, -half(0.45) * 0.55]), add(mid(0.72), [0, -half(0.72) * 0.4]), mid(0.55)].map(toW))}"/>`);
  out.push(`<path class="${rib}" d="${line(sample(mid, 6).slice(0, -1).map(toW))}"/>`);
  return { tip: toW(mid(1)), at: (s) => toW(mid(s)) };
}

// A palmate leaf (fig, grape): lobes as bumps on a polar outline around the petiole, a heart
// notch at the base, and an optional serrated margin. lobes lists [angle, reach].
function palmate(out, r, O, dir, L, { lobes, sigma = 0.34, power = 2, teeth = 0, toothCount = 60, v = tone(r), deep = 0.58, core = 0.22 }) {
  const wav = wobble(r, 0.025, [5, 9]);
  const reachAt = (a) => {
    let m = core;
    for (const [la, reach] of lobes) m = Math.max(m, core + (reach - core) * Math.exp(-(Math.abs((a - la) / sigma) ** power)));
    const saw = teeth ? 1 - teeth * ((((a / TAU) * toothCount) % 1) + 1) % 1 : 1;
    return m * (1 + wav(a / TAU)) * saw;
  };
  const notch = 0.42;
  const pts = sample((t) => {
    const a = -Math.PI + notch + t * (TAU - 2 * notch);
    return add(O, polar(reachAt(a) * L, dir + a));
  }, 96);
  shape(out, r, [...pts, add(O, polar(L * 0.05, dir))], v, { deep, deepAbout: add(O, polar(L * 0.3, dir)) });
  let mainV = "";
  let side = "";
  for (const [la, reach] of lobes) {
    const tip = add(O, polar(reach * L * 0.9, dir + la));
    mainV += `M${P1(O)}Q${P1(add(O, polar(reach * L * 0.45, dir + la * 0.94)))} ${P1(tip)}`;
    for (const s of [0.35, 0.6]) {
      const p = lerp(O, tip, s);
      for (const sg of [-1, 1]) side += `M${P1(p)}L${P1(add(p, polar(reach * L * 0.2, dir + la + sg * 0.7)))}`;
    }
  }
  out.push(`<path class="ink hair vein" d="${side}"/><path class="ink thin" d="${mainV}"/>`);
}

// Many small blades as one wash and one ink path, for dense foliage like lavender and rosemary.
function bladeBunch(out, blades, v, cls = "wash") {
  let fill = "";
  let ink = "";
  for (const { O, dir, L, W } of blades) {
    const toW = (p) => add(O, rot(p, dir));
    const half = (s) => (W * L * Math.sin(Math.PI * Math.min(1, s) ** 0.8) ** 0.8) / 2;
    const up = sample((s) => [s * L, -half(s)], 6);
    const dn = sample((s) => [s * L, half(s)], 6);
    const pts = [...up, [L * 1.02, 0], ...dn.slice(0, -1).reverse()].map(toW);
    fill += closed(pts);
    ink += line([...dn.map(toW)]);
  }
  out.push(`<path class="${cls}"${vars(v)} d="${fill}"/><path class="ink hair" d="${ink}"/>`);
}

// The gate at which a limb growing from g0 to g1 reaches the share t of its length, so whatever
// sits there appears just as the growing tip passes it.
const along = (g0, g1, t) => g0 + (g1 - g0) * t + 0.015;
// The share of a limb's length up to its point i, measured along the curve as its growth is.
function share(res, i) {
  if (!res.cum) {
    let len = 0;
    res.cum = res.pts.map((p, k) => (k ? (len += Math.hypot(p[0] - res.pts[k - 1][0], p[1] - res.pts[k - 1][1])) : 0));
  }
  return res.cum[i] / res.cum[res.cum.length - 1];
}

// A round fruit or berry outline.
const roundPts = (c, rx, ry, lean = 0, n = 16) => sample((t) => add(c, rot([rx * Math.cos(t * TAU), ry * Math.sin(t * TAU)], lean)), n).slice(0, -1);
const glint = (c, rx, ry) => `<path class="wash shine" d="${closed(roundPts(c, rx, ry, 0, 8))}"/>`;

// ---------------------------------------------------------------------------
// Olive: a gnarled silver-barked branch, narrow leaves dark above and silver beneath, and
// olives ripening from green to violet-black.
export function oliveLeaf(out, r, O, dir, L) {
  const under = r() < 0.32;
  blade(out, r, O, dir, L, {
    W: 0.17,
    prof: (s) => Math.sin(Math.PI * Math.min(1, s) ** 0.8) ** 0.9,
    bend: (r() - 0.5) * 0.14,
    v: tone(r, under ? { pc: "--olive-silver", spread: 0.05, hue: 10 } : { spread: 0.07, hue: 14 }),
    deep: 0.5,
    rib: "ink thin",
  });
}
export function oliveFruit(out, r, c, R, ripe) {
  const lean = (r() - 0.5) * 0.8;
  shape(out, r, roundPts(c, R * 0.74, R, lean), tone(r, { pc: ripe ? "--fruit-olive" : "--fruit-olive-green", spread: 0.06, hue: 14 }), { deep: 0.55, deepAbout: add(c, rot([R * 0.2, R * 0.3], lean)), cls: "wash fruit" });
  out.push(glint(add(c, rot([-R * 0.24, -R * 0.36], lean)), R * 0.14, R * 0.22));
}
function oliveTwig(out, r, from, dir, len, g, olives = 0) {
  const end = add(from, polar(len, dir));
  const curve = quad(from, add(from, polar(len * 0.55, dir + (r() - 0.5) * 0.5)), end);
  const s = grow(out, g, g + 0.18, () => stalk(out, curve, 6, 2.4, tone(r, { pc: "--bark-olive", spread: 0.03 })));
  let sg = r() < 0.5 ? -1 : 1;
  for (let k = 1; k <= 11; k++) {
    const t = Math.min(0.97, k / 11.5 + (r() - 0.5) * 0.03);
    const i = Math.round(t * 24);
    const p = s.pts[i];
    const a = angleOf(s.pts, i);
    sg = r() < 0.8 ? -sg : sg;
    part(out, g + 0.08 + t * 0.14, p, () => oliveLeaf(out, r, p, a + sg * rad(24 + r() * 40), (96 - k * 3) * (0.7 + r() * 0.45)));
  }
  part(out, g + 0.24, end, () => oliveLeaf(out, r, end, dir + (r() - 0.5) * 0.3, 70));
  for (let k = 0; k < olives; k++) {
    const i = Math.round((0.3 + k * 0.22) * 24);
    const p = s.pts[i];
    const c = add(p, [6 + r() * 8, 22 + r() * 8]);
    part(out, 0.8 + k * 0.03, p, () => {
      out.push(`<path class="ink thin" d="M${P1(p)}Q${P1(add(p, [8, 6]))} ${P1(add(c, [0, -12]))}"/>`);
      oliveFruit(out, r, c, 13 + r() * 3, r() < 0.65);
    });
  }
}
export function olive(out, r, base) {
  const main = grow(out, 0, 0.6, () =>
    limb(out, r, [add(base, [-30, 6]), add(base, [160, -34]), add(base, [320, -10]), add(base, [470, -62]), add(base, [630, -48])], { w0: 34, w1: 11, cap: "taper", pc: "--bark-olive", swell: [[0.28, 0.1], [0.6, 0.07]] }),
  );
  let side = -1;
  [0.3, 0.44, 0.56, 0.68, 0.8, 0.92].forEach((t) => {
    const i = Math.round(t * main.n);
    const p = main.pts[i];
    const a = angleOf(main.pts, i) + side * rad(38 + r() * 26);
    oliveTwig(out, r, p, a, 140 + r() * 70, along(0, 0.6, share(main, i)), side > 0 ? 2 : 1);
    side = -side;
  });
  const tip = main.pts[main.n];
  part(out, 0.6, tip, () => {
    for (const d of [-30, 0, 28]) oliveLeaf(out, r, tip, angleOf(main.pts, main.n) + rad(d), 84);
  });
}

// ---------------------------------------------------------------------------
// Fig: a smooth grey branch, broad lobed leaves, and pear-shaped figs, violet with a green neck.
export function figLeaf(out, r, O, dir, L) {
  palmate(out, r, O, dir, L, {
    lobes: [[0, 1], [rad(-58), 0.9], [rad(58), 0.9], [rad(-120), 0.64], [rad(120), 0.64]],
    sigma: 0.44,
    power: 3,
    core: 0.46,
    v: tone(r, { spread: 0.08, hue: 12 }),
  });
}
export function figFruit(out, r, stem, dir, size) {
  const toW = ([x, y]) => add(stem, rot([x * size, y * size], dir));
  const pts = [[0.02, 0.07], [0.2, 0.11], [0.4, 0.28], [0.62, 0.4], [0.84, 0.37], [0.98, 0.2], [1.02, 0], [0.98, -0.2], [0.84, -0.37], [0.62, -0.4], [0.4, -0.28], [0.2, -0.11], [0.02, -0.07]];
  shape(out, r, pts.map(toW), tone(r, { pc: "--fruit-fig", spread: 0.05, hue: 12 }), { deep: 0.6, deepAbout: toW([0.72, 0.16]), cls: "wash fruit" });
  out.push(`<path class="wash green-cap"${vars({ pc: "--fruit-olive-green" })} d="${closed([[0.02, 0.07], [0.2, 0.12], [0.36, 0.24], [0.4, 0], [0.36, -0.24], [0.2, -0.12], [0.02, -0.07]].map(toW))}"/>`);
  let flecks = "";
  for (let k = 0; k < 14; k++) {
    const p = toW([0.45 + r() * 0.45, (r() - 0.5) * 0.5]);
    flecks += `M${P1(p)}l${(r() * 2).toFixed(1)} 1`;
  }
  out.push(`<path class="ink hair bumps" d="${flecks}"/><path class="ink thin" d="M${P1(toW([1.0, 0]))}l0 .1"/>`);
  out.push(glint(toW([0.6, -0.2]), size * 0.06, size * 0.1));
}
export function fig(out, r, base) {
  const fork = add(base, [300, -50]);
  const upper = grow(out, 0.24, 0.56, () => limb(out, r, [lerp(base, fork, 0.88), add(fork, [60, -70]), add(fork, [110, -170]), add(fork, [170, -230])], { w0: 20, w1: 10, cap: "taper", pc: "--bark-olive", inkFrom: 0.15 }));
  const main = grow(out, 0, 0.6, () => limb(out, r, [add(base, [-30, 6]), add(base, [150, -36]), fork, add(base, [470, -30]), add(base, [610, -70])], { w0: 32, w1: 12, cap: "taper", pc: "--bark-olive" }));
  [[upper, 0.56], [main, 0.6]].forEach(([s, g]) => {
    const tip = s.pts[s.n];
    const a = angleOf(s.pts, s.n);
    [-80, -38, 4, 44, 88].forEach((d, k) => {
      const la = a + rad(d + (r() - 0.5) * 16);
      const pet = 34 + r() * 20;
      const at = add(tip, polar(pet, la));
      part(out, g + k * 0.016, tip, () => {
        out.push(`<path class="ink mid" d="M${P1(tip)}L${P1(at)}"/>`);
        figLeaf(out, r, at, la, 190 + r() * 40);
      });
    });
    // Figs sit just behind the tip, leaning out from the branch.
    [0.82, 0.9].forEach((t, k) => {
      const p = s.pts[Math.round(t * s.n)];
      const fa = angleOf(s.pts, Math.round(t * s.n)) + (k ? -1 : 1) * rad(70);
      part(out, 0.78 + k * 0.05, p, () => figFruit(out, r, p, fa, 64 + r() * 10));
    });
  });
}

// ---------------------------------------------------------------------------
// Lemon: a slender thorny branch, glossy leaves, lemons that glow in the dark, and waxy white
// blossoms flushed purple.
export function lemonLeaf(out, r, O, dir, L) {
  blade(out, r, O, dir, L, { W: 0.44, prof: (s) => Math.sin(Math.PI * Math.min(1, s) ** 0.95) ** 0.7, bend: (r() - 0.5) * 0.12, v: tone(r, { spread: 0.07, hue: 10 }), veins: 5, shine: true, wavy: 0.006 });
}
export function lemonFruit(out, r, top, size, lean, ripe = true) {
  const axis = rad(90) + lean;
  const c = add(top, polar(size * 0.62, axis));
  const pts = sample((t) => {
    const a = t * TAU;
    const tipK = Math.exp(-((Math.atan2(Math.sin(a), Math.cos(a)) / 0.22) ** 2));
    const stemK = Math.exp(-((Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI)) / 0.3) ** 2));
    const rr = 1 + 0.16 * tipK + 0.05 * stemK;
    return add(c, rot([size * 0.62 * Math.cos(a) * rr, size * 0.44 * Math.sin(a)], axis));
  }, 30).slice(0, -1);
  shape(out, r, pts, tone(r, { pc: "--fruit-lemon", spread: 0.04, hue: 8 }), { deep: 0.45, deepAbout: add(c, polar(size * 0.24, axis + 0.7)), cls: "wash fruit" });
  if (!ripe) out.push(`<path class="wash green-cap"${vars({ pc: "--fruit-olive-green" })} d="${closed(roundPts(add(c, polar(-size * 0.25, axis)), size * 0.42, size * 0.36, axis, 12))}"/>`);
  let pores = "";
  for (let k = 0; k < 26; k++) {
    const p = add(c, rot([(r() - 0.5) * size * 0.9, (r() - 0.5) * size * 0.6], axis));
    pores += `M${P1(p)}l.8 .6`;
  }
  out.push(`<path class="ink hair bumps" d="${pores}"/>`);
  out.push(glint(add(c, rot([-size * 0.1, -size * 0.2], axis)), size * 0.16, size * 0.07));
}
export function lemonBlossom(out, r, c, size, spin) {
  for (let k = 0; k < 5; k++) {
    const a = spin + (k * TAU) / 5;
    const pts = [[0.1, 0], [0.3, -0.16], [0.7, -0.2], [0.98, -0.08], [1.02, 0.04], [0.8, 0.18], [0.4, 0.16]].map(([x, y]) => add(c, rot([x * size, y * size], a)));
    shape(out, r, pts, tone(r, { pc: "--petal", spread: 0.02, hue: 4 }), { deep: 0, cls: "wash fruit" });
    out.push(`<path class="wash lilac-flush"${vars({ pc: "--petal-lilac" })} d="${closed([[0.1, 0], [0.3, -0.1], [0.45, 0], [0.3, 0.1]].map(([x, y]) => add(c, rot([x * size, y * size], a))))}"/>`);
  }
  let stamens = "";
  for (let k = 0; k < 9; k++) stamens += `M${P1(c)}L${P1(add(c, polar(size * (0.26 + r() * 0.1), spin + (k * TAU) / 9)))}`;
  out.push(`<path class="ink hair" d="${stamens}"/>`);
  shape(out, r, roundPts(c, size * 0.12, size * 0.12), tone(r, { pc: "--anther", spread: 0.02 }), { deep: 0, ink: false });
}
export function lemon(out, r, base) {
  const fork = add(base, [330, -30]);
  const lower = grow(out, 0.24, 0.56, () => limb(out, r, [lerp(base, fork, 0.9), add(fork, [80, 50]), add(fork, [170, 70]), add(fork, [250, 60])], { w0: 13, w1: 7, cap: "taper", inkFrom: 0.15 }));
  const main = grow(out, 0, 0.6, () => limb(out, r, [add(base, [-30, 6]), add(base, [170, -40]), fork, add(base, [480, -70]), add(base, [640, -96])], { w0: 22, w1: 8, cap: "taper", lenticels: true }));
  // Thorns at the nodes, each appearing as the growing tip passes it.
  for (let i = 8; i < main.n - 4; i += 7) {
    const p = main.pts[i];
    const a = angleOf(main.pts, i) - rad(60);
    part(out, along(0, 0.6, share(main, i)), p, () => out.push(`<path class="ink thin" d="M${P1(add(p, polar(5, a)))}L${P1(add(p, polar(14, a + 0.3)))}L${P1(add(p, polar(5, a + 0.6)))}"/>`));
  }
  [[main, 0, 0.6], [lower, 0.24, 0.56]].forEach(([s, g0, g1]) => {
    let side = 1;
    for (let i = 6; i <= s.n; i += 6) {
      const p = s.pts[i];
      const a = angleOf(s.pts, i) - side * rad(42 + r() * 20);
      part(out, along(g0, g1, share(s, i)), p, () => lemonLeaf(out, r, p, a, 92 + r() * 26));
      side = -side;
    }
  });
  // Lemons hang from the main branch, and blossom opens at the tips.
  [[0.42, 104, -0.1, true], [0.6, 96, 0.14, true], [0.74, 84, -0.06, false]].forEach(([t, size, lean, ripe], k) => {
    const p = main.pts[Math.round(t * main.n)];
    const top = add(p, [6, 26]);
    part(out, 0.8 + k * 0.04, p, () => {
      out.push(`<path class="ink mid" d="M${P1(p)}Q${P1(add(p, [10, 10]))} ${P1(top)}"/>`);
      lemonFruit(out, r, top, size, lean, ripe);
    });
  });
  [[main, 1], [lower, 1]].forEach(([s, t], k) => {
    const tip = s.pts[Math.round(t * s.n)];
    part(out, 0.86 + k * 0.04, tip, () => {
      lemonBlossom(out, r, add(tip, [10, -24]), 26, r() * TAU);
      lemonBlossom(out, r, add(tip, [36, -2]), 22, r() * TAU);
      shape(out, r, roundPts(add(tip, [-8, -40]), 6, 10, 0.4), tone(r, { pc: "--petal-lilac", spread: 0.03 }), { deep: 0.4 });
    });
  });
}

// ---------------------------------------------------------------------------
// Stone pine: plated red-brown bark, long needles in bursting tufts at the shoot tips, and
// broad, scaled cones.
function needleTuft(out, r, tip, dir, R) {
  const mass = sample((t) => add(add(tip, polar(R * 0.42, dir)), polar(R * (0.48 + 0.08 * Math.sin(t * TAU * 5)), t * TAU)), 24).slice(0, -1);
  shape(out, r, mass, tone(r, { spread: 0.05, dl: -0.06 }), { deep: 0.6, ink: false });
  let green = "";
  let ink = "";
  for (let k = 0; k < 34; k++) {
    const a = dir + (k / 33 - 0.5) * rad(230) + (r() - 0.5) * 0.12;
    const len = R * (0.72 + r() * 0.4);
    const end = add(tip, polar(len, a));
    const d = `M${P1(tip)}Q${P1(add(tip, polar(len * 0.55, a + 0.08)))} ${P1(end)}`;
    if (k % 3 === 0) ink += d;
    else green += d;
  }
  out.push(`<path class="wash needles"${vars(tone(r, { spread: 0.06 }))} d="${green}"/><path class="ink hair" d="${ink}"/>`);
}
export function pineCone(out, r, c, size, lean) {
  shape(out, r, roundPts(c, size * 0.42, size * 0.5, lean, 20), tone(r, { pc: "--pine-cone", spread: 0.04 }), { deep: 0.62, deepAbout: add(c, rot([size * 0.12, size * 0.2], lean)), cls: "wash fruit" });
  let scales = "";
  let edges = "";
  for (let j = -4; j <= 4; j++) {
    const y = j * size * 0.1;
    const halfW = size * 0.4 * Math.sqrt(Math.max(0, 1 - (y / (size * 0.5)) ** 2));
    for (let x = -halfW + size * 0.06 + (j % 2 ? size * 0.06 : 0); x < halfW - size * 0.04; x += size * 0.12) {
      const p = add(c, rot([x, y], lean));
      const q = (dx, dy) => P1(add(p, rot([dx * size, dy * size], lean)));
      scales += `M${q(-0.06, 0)}L${q(0, -0.045)}L${q(0.06, 0)}L${q(0, 0.05)}Z`;
      edges += `M${q(-0.06, 0)}Q${q(0, 0.07)} ${q(0.06, 0)}`;
    }
  }
  out.push(`<path class="wash"${vars(tone(r, { pc: "--pine-cone", dl: 0.06 }))} d="${scales}"/><path class="ink hair" d="${edges}"/>`);
}
export function pine(out, r, base) {
  const main = grow(out, 0, 0.58, () => limb(out, r, [add(base, [-30, 6]), add(base, [200, -60]), add(base, [400, -110]), add(base, [600, -150])], { w0: 30, w1: 10, cap: "taper", pc: "--bark-pine", lenticels: true }));
  const shoots = [0.36, 0.58, 0.8].map((t, k) => {
    const i = Math.round(t * main.n);
    const p = main.pts[i];
    const a = angleOf(main.pts, i) + (k % 2 ? 1 : -1) * rad(50 + r() * 15);
    const end = add(p, polar(150 + r() * 50, a));
    const g0 = along(0, 0.58, share(main, i));
    return { g0, g1: g0 + 0.2, s: grow(out, g0, g0 + 0.2, () => limb(out, r, [p, lerp(p, end, 0.5), end], { w0: 10, w1: 5, cap: "taper", pc: "--bark-pine", inkFrom: 0.1 })) };
  });
  [...shoots, { g0: 0, g1: 0.58, s: main }].forEach(({ g0, g1, s }) => {
    const tip = s.pts[s.n];
    const a = angleOf(s.pts, s.n);
    part(out, g1 + 0.01, tip, () => needleTuft(out, r, tip, a, 88 + r() * 16));
    const mid = s.pts[Math.round(s.n * 0.6)];
    part(out, along(g0, g1, share(s, Math.round(s.n * 0.6))) + 0.04, mid, () => needleTuft(out, r, mid, a - rad(70), 64 + r() * 12));
  });
  const at = main.pts[Math.round(main.n * 0.5)];
  [[-6, 54, -0.2], [52, 46, 0.25]].forEach(([dx, dy, lean], k) => part(out, 0.8 + k * 0.05, at, () => pineCone(out, r, add(at, [dx, dy]), 92, lean)));
}

// ---------------------------------------------------------------------------
// Grapevine: a woody cane hanging from the pergola, serrated five-lobed leaves, curling
// tendrils, and dusky bunches with a pale bloom.
export function grapeLeaf(out, r, O, dir, L) {
  palmate(out, r, O, dir, L, {
    lobes: [[0, 1], [rad(-55), 0.9], [rad(55), 0.9], [rad(-114), 0.66], [rad(114), 0.66]],
    sigma: 0.42,
    teeth: 0.05,
    v: tone(r, { spread: 0.08, hue: 16 }),
  });
}
// A bunch hangs from its stalk: berries in rows that narrow toward the tip, the stems drawn
// first so the berries cover them.
export function grapeCluster(out, r, top, size) {
  const rows = [5, 6, 5, 5, 4, 3, 2, 1];
  const R = size * 0.068;
  const lean = (r() - 0.5) * 0.2;
  const berries = [];
  let stems = `M${P1(top)}L${P1(add(top, [2, size * 0.12]))}`;
  rows.forEach((n, j) => {
    const y = size * (0.14 + j * 0.105);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * R * 1.75 + (r() - 0.5) * R * 0.4 + y * lean;
      const c = add(top, [x, y + (r() - 0.5) * R * 0.4]);
      stems += `M${P1(add(top, [y * lean * 0.6, y * 0.8]))}L${P1(c)}`;
      berries.push([c, R * (0.9 + r() * 0.2)]);
    }
  });
  out.push(`<path class="ink thin" d="${stems}"/>`);
  for (const [c, rr] of berries) {
    shape(out, r, roundPts(c, rr, rr * 1.06), tone(r, { pc: "--fruit-grape", spread: 0.08, hue: 12 }), { deep: 0.5, deepAbout: add(c, [rr * 0.3, rr * 0.35]), cls: "wash fruit" });
    out.push(glint(add(c, [-rr * 0.3, -rr * 0.35]), rr * 0.32, rr * 0.22));
  }
}
function tendril(c, a, size) {
  const pts = sample((t) => add(c, polar(size * t, a + t * 0.6)), 6);
  const end = pts[6];
  const curl = sample((t) => add(end, polar(size * 0.28 * (1 - t * 0.7), a + 2.2 + t * TAU * 1.4)), 14);
  return line([...pts, ...curl]);
}
export function grapevine(out, r, top) {
  const wander = wobble(r, 24, [1.1, 2.1]);
  const at = (t) => add(top, [wander(t) + 70 * Math.sin(t * 2.2), t * 560]);
  const cane = grow(out, 0, 0.8, () => stalk(out, at, 11, 4, tone(r, { pc: "--bark", spread: 0.03 }), 50));
  let side = 1;
  for (let t = 0.1; t < 0.95; t += 0.13 + r() * 0.04) {
    const p = at(t);
    const pa = rad(90) + side * rad(50 + r() * 30);
    const leafAt = add(p, polar(44 + r() * 20, pa));
    part(out, along(0, 0.8, share(cane, Math.round(t * 50))), p, () => {
      out.push(`<path class="ink mid" d="M${P1(p)}Q${P1(add(p, polar(26, pa - side * 0.3)))} ${P1(leafAt)}"/>`);
      grapeLeaf(out, r, leafAt, pa - side * rad(20), (150 - t * 50) * (0.85 + r() * 0.3));
      out.push(`<path class="ink thin" d="${tendril(p, rad(90) - side * rad(70), 48 + r() * 20)}"/>`);
    });
    side = -side;
  }
  [[0.34, 160], [0.64, 128]].forEach(([t, size], k) => {
    const p = at(t);
    const hang = add(p, [k ? -20 : 18, 14]);
    part(out, 0.8 + k * 0.06, p, () => {
      out.push(`<path class="ink thin" d="M${P1(p)}L${P1(hang)}"/>`);
      grapeCluster(out, r, hang, size);
    });
  });
}

// ---------------------------------------------------------------------------
// Star jasmine: twining stems trailing down, small glossy leaves in pairs, and clusters of
// white pinwheel flowers that open at night.
export function jasmineFlower(out, r, c, size, spin) {
  for (let k = 0; k < 5; k++) {
    const a = spin + (k * TAU) / 5;
    const pts = [[0.12, 0], [0.24, -0.15], [0.52, -0.3], [0.86, -0.34], [1.02, -0.22], [0.96, -0.06], [0.62, 0.05], [0.3, 0.06]].map(([x, y]) => add(c, rot([x * size, y * size], a)));
    shape(out, r, pts, tone(r, { pc: "--petal", spread: 0.02, hue: 4 }), { deep: 0, cls: "wash fruit" });
  }
  shape(out, r, roundPts(c, size * 0.13, size * 0.13), tone(r, { pc: "--flower-heart", spread: 0.02, dl: 0.04 }), { deep: 0, ink: false });
  out.push(`<path class="ink thin" d="M${P1(add(c, [-1, -1]))}l2 2"/>`);
}
function jasmineStem(out, r, top, length, sway, g0) {
  const wander = wobble(r, 14, [1.3, 2.9]);
  const at = (t) => add(top, [wander(t) + sway * Math.sin(t * 2.6), t * length]);
  const stem = grow(out, g0, g0 + 0.7, () => stalk(out, at, 4, 2, tone(r, { pc: "--stem-dark", spread: 0.03 }), 44));
  for (let t = 0.06; t < 0.97; t += 0.07 + r() * 0.03) {
    const p = at(t);
    const a = angleOf(sample(at, 60), Math.round(t * 60));
    part(out, along(g0, g0 + 0.7, share(stem, Math.round(t * 44))), p, () => {
      for (const sg of [-1, 1]) blade(out, r, p, a + sg * rad(58 + r() * 20), (40 + r() * 12) * (1 - t * 0.3), { W: 0.4, v: tone(r, { spread: 0.07, hue: 10 }), shine: true, deep: 0.5, rib: "ink thin" });
    });
  }
  [0.2, 0.42, 0.62, 0.84].forEach((t, k) => {
    const p = at(t);
    const side = k % 2 ? 1 : -1;
    const head = add(p, [side * (30 + r() * 14), 18 + r() * 12]);
    part(out, 0.82 + k * 0.03, p, () => {
      let peds = `M${P1(p)}Q${P1(add(p, [side * 10, 4]))} ${P1(head)}`;
      const flowers = 3 + Math.floor(r() * 3);
      for (let i = 0; i < flowers; i++) {
        const c = add(head, polar(20 + r() * 12, rad(-160 + i * (140 / flowers)) + side * 0.4));
        peds += `M${P1(head)}L${P1(c)}`;
        jasmineFlower(out, r, c, 18 + r() * 6, r() * TAU);
      }
      out.push(`<path class="ink hair" d="${peds}"/>`);
    });
  });
}
export function jasmine(out, r, top) {
  jasmineStem(out, r, add(top, [-26, 0]), 430, 36, 0);
  jasmineStem(out, r, add(top, [24, 0]), 540, -48, 0.08);
}

// ---------------------------------------------------------------------------
// Bougainvillea: thorny canes arching out and down, small dark leaves, and masses of papery
// magenta bracts in threes, each cradling a tiny cream flower.
export function bougainvilleaCluster(out, r, c, size, spin) {
  for (let k = 0; k < 3; k++) {
    const a = spin + (k * TAU) / 3;
    const b = blade(out, r, c, a, size, {
      W: 0.8,
      prof: (s) => Math.sin(Math.PI * Math.min(1, s) ** 0.62) ** 0.75,
      bend: (r() - 0.5) * 0.12,
      v: tone(r, { pc: "--bract", spread: 0.08, hue: 12 }),
      veins: 3,
      deep: 0.5,
      rib: "ink hair",
    });
    out.push(`<path class="ink hair" d="M${P1(c)}L${P1(b.at(0.55))}"/>`);
    shape(out, r, roundPts(b.at(0.56), size * 0.05, size * 0.05), tone(r, { pc: "--petal", spread: 0.02 }), { deep: 0, ink: false });
  }
}
export function bougainvillea(out, r, top) {
  const canes = [
    { from: add(top, [0, 0]), c1: [220, -20], c2: [380, 120], end: [420, 400], g: 0 },
    { from: add(top, [30, 0]), c1: [120, 60], c2: [140, 260], end: [80, 520], g: 0.1 },
  ];
  canes.forEach(({ from, c1, c2, end, g }, ci) => {
    const curve = (t) => {
      const u = 1 - t;
      return add(add(mul(from, u * u * u), mul(add(from, c1), 3 * u * u * t)), add(mul(add(from, c2), 3 * u * t * t), mul(add(from, end), t * t * t)));
    };
    const cane = grow(out, g, g + 0.6, () => stalk(out, curve, 9, 3, tone(r, { pc: "--bark", spread: 0.03 }), 40));
    for (let i = 4; i < 38; i += 5) {
      const p = cane.pts[i];
      const a = angleOf(cane.pts, i) + rad(70);
      part(out, along(g, g + 0.6, share(cane, i)), p, () => out.push(`<path class="ink thin" d="M${P1(add(p, polar(3, a)))}Q${P1(add(p, polar(9, a + 0.3)))} ${P1(add(p, polar(12, a + 0.9)))}"/>`));
    }
    let side = 1;
    for (let i = 3; i < 40; i += 4) {
      const p = cane.pts[i];
      const a = angleOf(cane.pts, i) + side * rad(55 + r() * 20);
      part(out, along(g, g + 0.6, share(cane, i)), p, () => blade(out, r, p, a, 46 + r() * 14, { W: 0.55, v: tone(r, { spread: 0.07 }), deep: 0.5, rib: "ink thin" }));
      side = -side;
    }
    for (let k = 0; k < 6; k++) {
      const i = 16 + k * 4 + Math.floor(r() * 2);
      const p = cane.pts[Math.min(40, i)];
      const c = add(p, polar(24 + r() * 16, angleOf(cane.pts, Math.min(40, i)) + (k % 2 ? 1 : -1) * rad(70)));
      part(out, 0.72 + k * 0.03 + ci * 0.02, p, () => {
        out.push(`<path class="ink thin" d="M${P1(p)}L${P1(c)}"/>`);
        bougainvilleaCluster(out, r, c, 34 + r() * 10, r() * TAU);
        bougainvilleaCluster(out, r, add(c, polar(30, r() * TAU)), 28 + r() * 8, r() * TAU);
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Italian cypress: two dark flames, widest a third of the way up, built from upward sprays.
export function cypressColumn(out, r, base, H, W) {
  const sway = wobble(r, W * 0.05, [0.8, 1.7]);
  const width = (t) => Math.max(W * 0.1, W * Math.sin(Math.PI * Math.min(1, t) ** 0.55) ** 0.95);
  const scallop = wobble(r, 0.05, [9, 15, 31]);
  const n = 64;
  const spine = sample((t) => add(base, [sway(t), -t * H]), n);
  const edge = (i, sg) => add(spine[i], [((sg * width(i / n)) / 2) * (1 + scallop(i / n + (sg > 0 ? 0.5 : 0))), 0]);
  const L = spine.map((_, i) => edge(i, -1));
  const R = spine.map((_, i) => edge(i, 1));
  shape(out, r, [...L, add(base, [sway(1), -H * 1.02]), ...[...R].reverse()], tone(r, { spread: 0.03, hue: 6 }), { deep: 0.6, deepAbout: add(base, [W * 0.16, -H * 0.42]) });
  // Sprays: upward teardrops, moonlit on the left and in shadow on the right.
  const tuft = (c, w, h, lean) => closed([[0, 0], [-w * 0.5, -h * 0.35], [-w * 0.2, -h * 0.85], [0, -h], [w * 0.25, -h * 0.8], [w * 0.5, -h * 0.3]].map(([x, y]) => add(c, rot([x, y], lean))));
  let lit = "";
  let shade = "";
  let flicks = "";
  for (let k = 0; k < 70; k++) {
    const t = 0.05 + r() * 0.88;
    const w = width(t) / 2;
    const x = (r() * 2 - 1) * w * 0.8;
    const c = add(spine[Math.round(t * n)], [x, 0]);
    const size = W * (0.16 + r() * 0.1) * (0.55 + 0.45 * (w / (W / 2)));
    const d = tuft(c, size, size * 1.9, (x / w) * 0.25);
    if (x < -w * 0.15) lit += d;
    else if (x > w * 0.25) shade += d;
    flicks += `M${P1(c)}q${((x / w) * 3).toFixed(1)} ${(-size).toFixed(1)} ${((x / w) * 5).toFixed(1)} ${(-size * 1.7).toFixed(1)}`;
  }
  out.push(`<path class="wash"${vars(tone(r, { dl: -0.06, spread: 0.02 }))} d="${shade}"/><path class="wash"${vars(tone(r, { dl: 0.13, dc: 0.85, spread: 0.02 }))} d="${lit}"/><path class="ink hair" d="${flicks}"/>`);
  out.push(`<path class="ink thin" d="M${P1(add(base, [-W * 0.05, 0]))}l1 -${(H * 0.03).toFixed(0)}M${P1(add(base, [W * 0.05, 0]))}l-1 -${(H * 0.03).toFixed(0)}"/>`);
  return { L, R, pts: spine };
}
export function cypress(out, r, base) {
  grow(out, 0.02, 0.5, () => cypressColumn(out, r, add(base, [50, 0]), 660, 128));
  grow(out, 0.16, 0.56, () => cypressColumn(out, r, add(base, [-62, 0]), 450, 100));
}

// ---------------------------------------------------------------------------
// Lavender: a grey-green mound of narrow leaves, and slender stems fanning up, each tipped
// with a spike of violet whorls.
export function lavenderSpike(out, r, c, dir, len) {
  let florets = "";
  let edges = "";
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    const p = add(c, polar(len * t, dir));
    const s = 1 - t * 0.45;
    for (const [dx, dy] of [[-5.5, 0], [5.5, 0], [0, -2]]) {
      const q = add(p, rot([dy * s, dx * s], dir));
      const f = roundPts(q, 5 * s, 7 * s, dir, 8);
      florets += closed(f);
      edges += line(f.slice(3, 7));
    }
  }
  out.push(`<path class="wash"${vars(tone(r, { pc: "--flower-lavender", spread: 0.08, hue: 14 }))} d="${florets}"/><path class="ink hair" d="${edges}"/>`);
}
export function lavender(out, r, base) {
  part(out, 0.02, base, () => {
    for (let g = 0; g < 3; g++) {
      const blades = [];
      for (let k = 0; k < 18; k++) {
        const a = rad(-170 + r() * 160);
        blades.push({ O: add(base, [(r() - 0.5) * 40, -r() * 10]), dir: a, L: 60 + r() * 50, W: 0.1 });
      }
      bladeBunch(out, blades, tone(r, { spread: 0.08, hue: 10, dl: (g - 1) * 0.05 }));
    }
  });
  for (let k = 0; k < 20; k++) {
    const a = rad(-150 + (k / 19) * 120 + (r() - 0.5) * 6);
    const len = 220 + r() * 90 - Math.abs(k - 9.5) * 6;
    const end = add(base, polar(len, a));
    const ctrl = add(base, polar(len * 0.55, a + (r() - 0.5) * 0.14));
    part(out, 0.06 + (k % 7) * 0.05 + r() * 0.04, base, () => {
      out.push(`<path class="ink thin" d="M${P1(base)}Q${P1(ctrl)} ${P1(end)}"/>`);
      lavenderSpike(out, r, add(end, polar(-len * 0.05, a)), a, 52 + r() * 18);
    });
  }
}

// ---------------------------------------------------------------------------
// Rosemary: upright woody stems dense with needle leaves, dark above and silver below, with
// pale blue flowers along the upper stems.
export function rosemaryStem(out, r, from, dir, len) {
  const end = add(from, polar(len, dir));
  const curve = quad(from, add(from, polar(len * 0.5, dir + (r() - 0.5) * 0.25)), end);
  const s = stalk(out, curve, 6, 2, tone(r, { pc: "--bark-olive", spread: 0.03 }), 30);
  const dark = [];
  const silver = [];
  for (let i = 2; i <= 30; i++) {
    const p = s.pts[i];
    const a = angleOf(s.pts, i);
    const L = (24 - i * 0.3) * (0.8 + r() * 0.3);
    for (const sg of [-1, 1]) (r() < 0.25 ? silver : dark).push({ O: p, dir: a + sg * rad(30 + r() * 25), L, W: 0.18 });
  }
  bladeBunch(out, dark, tone(r, { spread: 0.06 }));
  bladeBunch(out, silver, tone(r, { pc: "--olive-silver", spread: 0.04 }));
  let flowers = "";
  for (let i = 14; i < 28; i += 3) {
    const p = add(s.pts[i], polar(10, angleOf(s.pts, i) + rad(r() < 0.5 ? 80 : -80)));
    flowers += closed(roundPts(p, 4.5, 3.5, r() * TAU, 6));
  }
  out.push(`<path class="wash"${vars(tone(r, { pc: "--flower-rosemary", spread: 0.04 }))} d="${flowers}"/>`);
}
export function rosemary(out, r, base) {
  [-112, -98, -86, -74, -62, -124].forEach((d, k) => {
    const a = rad(d + (r() - 0.5) * 8);
    const from = add(base, [(k - 2.5) * 10, 0]);
    part(out, 0.04 + k * 0.07, from, () => rosemaryStem(out, r, from, a, 240 + r() * 110));
  });
}

// ---------------------------------------------------------------------------
// Agave: a rosette of thick blue-grey leaves with toothed margins, a dark terminal spine, and
// the pale prints of the leaves that once pressed against them.
export function agaveLeaf(out, r, O, dir, L, curl = 0) {
  const W = 0.2;
  const mid = (s) => [s * L, curl * L * s * s * s];
  const toW = (p) => add(O, rot(p, dir));
  const half = (s) => (W * L * (1 - s) ** 0.4 * Math.min(1, s * 5) ** 0.5) / 2;
  const up = sample((s) => add(mid(s), [0, -half(s)]), 20);
  const dn = sample((s) => add(mid(s), [0, half(s)]), 20);
  shape(out, r, [...up, mid(1.01), ...dn.slice(0, -1).reverse()].map(toW), tone(r, { spread: 0.05, hue: 8 }), { deep: 0.6, deepAbout: toW(mid(0.3)) });
  const print = [...sample((s) => add(mid(s), [0, -half(s) * 0.62]), 12).slice(1, -2), ...sample((s) => add(mid(s), [0, half(s) * 0.62]), 12).slice(1, -2).reverse()].map(toW);
  out.push(`<path class="ink hair vein" d="${line(print)}"/>`);
  let teeth = "";
  for (let k = 2; k < 15; k++) {
    const s = k / 16;
    for (const sg of [-1, 1]) {
      const p = add(mid(s), [0, sg * half(s)]);
      teeth += `M${P1(toW(add(p, [-4, 0])))}L${P1(toW(add(p, [1, sg * 6])))}L${P1(toW(add(p, [3, 0])))}`;
    }
  }
  out.push(`<path class="ink thin" d="${teeth}"/>`);
  shape(out, r, [add(mid(0.96), [0, -3]), mid(1.08), add(mid(0.96), [0, 3])].map(toW), tone(r, { pc: "--bark", dl: -0.15 }), { deep: 0 });
}
export function agave(out, r, base) {
  [
    [-104, 330, 0.02],
    [-80, 340, -0.03],
    [-124, 290, 0.06],
    [-58, 300, -0.05],
    [-146, 250, 0.12],
    [-36, 260, -0.1],
    [-92, 250, 0],
    [-166, 210, 0.2],
    [-14, 220, -0.18],
    [-116, 200, 0.04],
    [-66, 210, -0.04],
  ].forEach(([d, L, curl], k) => {
    part(out, 0.04 + k * 0.045, base, () => agaveLeaf(out, r, add(base, [(r() - 0.5) * 16, 0]), rad(d), L, curl));
  });
}

// ---------------------------------------------------------------------------
// Acanthus: the leaf of the Corinthian capital, glossy and deeply lobed, and a tall spike of
// pale hooded flowers under purple bracts.
export function acanthusLeaf(out, r, O, dir, L) {
  const W = 0.62;
  const lobes = 4.5;
  const bend = 0.12;
  const mid = (s) => [s * L, bend * L * s * s];
  const toW = (p) => add(O, rot(p, dir));
  const env = (s) => Math.sin(Math.PI * Math.min(1, s) ** 0.8) ** 0.7;
  const lobe = (s) => 0.32 + 0.68 * Math.abs(Math.sin(Math.PI * lobes * (s + 0.03))) ** 0.55;
  const half = (s) => (W * L * env(s) * lobe(s)) / 2;
  const up = sample((s) => add(mid(s), [0, -half(s)]), 64);
  const dn = sample((s) => add(mid(s), [0, half(s + 0.06)]), 64);
  shape(out, r, [...up, mid(1.01), ...dn.slice(0, -1).reverse()].map(toW), tone(r, { spread: 0.07, hue: 10 }), { deep: 0.58, deepAbout: toW(mid(0.4)) });
  let veins = "";
  for (let k = 0; k < Math.floor(lobes); k++) {
    const s = (k + 0.5) / lobes - 0.03;
    for (const sg of [-1, 1]) veins += `M${P1(toW(mid(s - 0.08)))}Q${P1(toW(add(mid(s), [0, sg * half(s) * 0.5])))} ${P1(toW(add(mid(s + 0.02), [0, sg * half(s) * 0.92])))}`;
  }
  out.push(`<path class="ink hair vein" d="${veins}"/><path class="wash shine" d="${closed([mid(0.15), add(mid(0.4), [0, -half(0.4) * 0.35]), add(mid(0.7), [0, -half(0.7) * 0.25]), mid(0.5)].map(toW))}"/><path class="ink mid" d="${line(sample(mid, 8).slice(0, -1).map(toW))}"/>`);
}
function acanthusFlower(out, r, p, side, size) {
  const a = rad(-90) + side * rad(58);
  const lip = [[0, 0], [0.5, -0.2], [0.9, -0.14], [1, 0.08], [0.6, 0.2], [0.2, 0.12]].map(([x, y]) => add(p, rot([x * size, y * size * side], a)));
  shape(out, r, lip, tone(r, { pc: "--flower-acanthus", spread: 0.03 }), { deep: 0.3 });
  const hood = [[0.05, -0.05], [0.4, -0.42], [0.86, -0.5], [1.12, -0.36], [0.84, -0.18], [0.4, -0.06]].map(([x, y]) => add(p, rot([x * size, y * size * side], a)));
  shape(out, r, hood, tone(r, { pc: "--hood-acanthus", spread: 0.05, hue: 10 }), { deep: 0.5 });
}
export function acanthus(out, r, base) {
  const top = add(base, [12, -460]);
  const spike = grow(out, 0.3, 0.66, () => stalk(out, quad(base, add(base, [-6, -240]), top), 10, 5, tone(r, { pc: "--stem-dark", spread: 0.03 }), 30));
  for (let i = 12, side = 1; i <= 29; i++, side = -side) {
    const p = spike.pts[i];
    const t = (i - 12) / 17;
    part(out, 0.62 + t * 0.2, p, () => acanthusFlower(out, r, p, side, 46 - t * 22));
  }
  [
    [-172, 250],
    [-140, 270],
    [-40, 260],
    [-8, 240],
    [-112, 220],
    [-70, 230],
  ].forEach(([d, L], k) => part(out, 0.04 + k * 0.05, base, () => acanthusLeaf(out, r, base, rad(d), L)));
}
