// Herbaceous tokens: plants that rise from the bottom, hang from the top, or trail in from any edge.
// Stalks and stems grow from their base, and leaves and flowers unfold where they attach.

import { TAU, rad, f, P1, add, sub, mul, dot, norm, rot, polar, lerp, rng, wobble, through, line, closed, poly, quad, sample, centroid, inkEdges, glaze, vars, tone, shape, stalk, grow, part } from "./lib.mjs";

// ---------------------------------------------------------------------------
// Ruffled fan palm: round pleated fans on long, toothed stalks.
export function palmLeaf(out, r, tip, dir, R, tilt, spinDeg) {
  const L = { R, tilt, spin: spinDeg };
  // The fan: pleats around a sweep that opens away from the stalk.
  const n = 15;
  const sweep = rad(318);
  const start = dir + Math.PI + (TAU - sweep) / 2 + Math.PI;
  const spin = rad(L.spin);
  const toWorld = (p) => add(tip, rot([p[0], p[1] * L.tilt], spin));
  const rim = [];
  const folds = [];
  for (let k = 0; k <= n; k++) {
    const a = start + (sweep * k) / n;
    folds.push(a);
  }
  const wav = wobble(r, 0.02, [3, 7]);
  for (let k = 0; k < n; k++) {
    const a0 = folds[k];
    const a1 = folds[k + 1];
    const pts = [toWorld([0, 0])];
    const steps = 6;
    for (let j = 0; j <= steps; j++) {
      const a = a0 + ((a1 - a0) * j) / steps;
      const edge = j === 0 || j === steps ? 0.95 : j === 3 ? 0.985 : 1 + 0.012 * (j % 2);
      pts.push(toWorld(polar(L.R * (edge + wav(a / TAU)), rot([1, 0], 0)[0] * a)));
    }
    rim.push(...pts.slice(1));
    const lit = k % 2 === 0;
    shape(out, r, pts, tone(r, { dl: lit ? 0.05 : -0.04, dh: lit ? -4 : 8 }), { deep: 0.45, deepAbout: pts[0], ink: false });
  }
  let foldLines = "";
  for (let k = 0; k <= n; k++) foldLines += `M${P1(toWorld([0, 0]))}L${P1(toWorld(polar(L.R * 0.95, folds[k])))}`;
  out.push(`<path class="ink hair" d="${foldLines}"/>`);
  const e = inkEdges([toWorld([0, 0]), ...rim], { from: tip });
  out.push(`<path class="ink thin" d="${e.thin}"/><path class="ink thick" d="${e.thick}"/>`);
}

export function fanPalm(out, r, base) {
  const LEAVES = [
    { a: -112, len: 300, R: 150, tilt: 0.92, spin: -14 },
    { a: -82, len: 380, R: 165, tilt: 0.7, spin: 8 },
    { a: -58, len: 290, R: 128, tilt: 0.84, spin: 26 },
  ];
  LEAVES.forEach((L, k) => {
    const dir = rad(L.a);
    const tip = add(base, polar(L.len, dir));
    const ctrl = add(base, polar(L.len * 0.55, dir + rad(6)));
    const g0 = 0.04 + k * 0.1;
    grow(out, g0, g0 + 0.4, () => {
      const s = stalk(out, quad(base, ctrl, tip), 9, 5, tone(r, { pc: "--stem-green", spread: 0.04 }));
      let ticks = "";
      for (let i = 3; i < 14; i += 1) {
        const p = s.L[i];
        const q = s.L[i + 1];
        const t = norm(sub(q, p));
        ticks += `M${P1(p)}L${P1(add(p, mul(add([-t[1], t[0]], mul(t, -0.6)), 5)))}`;
      }
      out.push(`<path class="ink hair" d="${ticks}"/>`);
      return s;
    });
    part(out, g0 + 0.4, tip, () => palmLeaf(out, r, tip, dir, L.R, L.tilt, L.spin));
  });
}

// ---------------------------------------------------------------------------
// Monstera deliciosa: heart-shaped leaves split from the margin and pierced along the midrib.
export function monsteraLeaf(out, r, O, dir, L, { tilt = 1, holes2 = true } = {}) {
  const toWorld = (p) => add(O, rot([p[0], p[1] * tilt], dir));
  const cx = 0.45 * L;
  const M = (phi, s) => [cx + 0.58 * L * Math.cos(phi), -s * 0.5 * L * Math.sin(phi) * (1 - 0.06 * Math.sin(phi * 3))];
  const n = 8;
  for (const s of [1, -1]) {
    const veins = [];
    for (let i = 0; i < n; i++) {
      veins.push({ m: [0.02 * L + (i / (n - 1)) * 0.8 * L, 0], phi: 2.72 - (i / (n - 1)) * 2.42 + (r() - 0.5) * 0.08, split: i > 0 && i < n - 1 && r() < 0.85 });
    }
    const bounds = [{ m: [0, 0], phi: Math.PI }, ...veins, { m: [veins[n - 1].m[0], 0], phi: 0 }];
    const delta = 0.032;
    for (let k = 0; k < bounds.length - 1; k++) {
      const A = bounds[k];
      const B = bounds[k + 1];
      const a0 = A.split ? A.phi - delta : A.phi;
      const b0 = B.split ? B.phi + delta : B.phi;
      const edge = (from, phi) => {
        const end = M(phi, s);
        const c = [from[0] + (end[0] - from[0]) * 0.35 + 0.05 * L, from[1] + (end[1] - from[1]) * 0.6];
        return sample(quad(from, c, end), 6);
      };
      const ea = edge(A.m, a0);
      const eb = edge(B.m, b0).reverse();
      const arc = [];
      for (let j = 1; j < 6; j++) arc.push(M(a0 + ((b0 - a0) * j) / 6, s));
      const local = [...ea, ...arc, ...eb.slice(0, -1)];
      const holes = [];
      if (k > 0 && k < bounds.length - 2) {
        const mid = M((a0 + b0) / 2, s);
        const bm = [(A.m[0] + B.m[0]) / 2, 0];
        const ang = Math.atan2(mid[1] - bm[1], mid[0] - bm[0]);
        const ring = (frac, rx, ry) => {
          const c = lerp(bm, mid, frac);
          return Array.from({ length: 12 }, (_, i) => {
            const t = (i / 12) * TAU;
            return add(c, rot([rx * Math.cos(t), ry * Math.sin(t)], ang));
          });
        };
        if (r() < 0.75) holes.push(ring(0.3, (0.04 + r() * 0.02) * L, (0.014 + r() * 0.007) * L).map(toWorld));
        if (holes2 && r() < 0.4) holes.push(ring(0.56, (0.03 + r() * 0.015) * L, (0.011 + r() * 0.005) * L).map(toWorld));
      }
      const world = local.map(toWorld);
      const inside = toWorld(lerp(lerp(A.m, B.m, 0.5), M((a0 + b0) / 2, s), 0.5));
      shape(out, r, world, tone(r, { dl: s < 0 ? -0.04 : 0.02 }), { holes, deep: 0.55, deepAbout: toWorld(lerp(A.m, B.m, 0.5)), ink: false });
      const edges = [arc.length ? [M(a0, s), ...arc, M(b0, s)] : null, A.split || k === 0 ? ea : null, B.split ? edge(B.m, b0) : null].filter(Boolean);
      for (const e0 of edges) {
        const e = inkEdges(e0.map(toWorld), { isClosed: false, from: inside });
        out.push(`<path class="ink thin" d="${e.thin}"/><path class="ink thick" d="${e.thick}"/>`);
      }
      for (const hole of holes) {
        const he = inkEdges(hole);
        out.push(`<path class="ink hair" d="${he.thin}"/><path class="ink thin" d="${he.thick}"/>`);
      }
    }
    let ribs = "";
    for (const v of veins) {
      const end = M(v.phi, s);
      ribs += `M${P1(toWorld(v.m))}Q${P1(toWorld([v.m[0] + (end[0] - v.m[0]) * 0.35 + 0.05 * L, v.m[1] + (end[1] - v.m[1]) * 0.6]))} ${P1(toWorld(lerp(v.m, end, 0.6)))}`;
    }
    out.push(`<path class="ink hair" d="${ribs}"/>`);
  }
  out.push(`<path class="ink mid" d="M${P1(toWorld([0, 0]))}L${P1(toWorld([cx + 0.56 * L, 0]))}"/>`);
}
export function monstera(out, r, base) {
  [
    { a: -126, len: 250, L: 250, rot: -170, tilt: 0.86 },
    { a: -92, len: 330, L: 290, rot: -58, tilt: 0.74 },
    { a: -56, len: 220, L: 230, rot: 8, tilt: 0.9 },
  ].forEach((o, k) => {
    const dir = rad(o.a);
    const top = add(base, polar(o.len, dir));
    const g0 = 0.04 + k * 0.1;
    grow(out, g0, g0 + 0.36, () => stalk(out, quad(base, add(base, polar(o.len * 0.6, dir - rad(8))), top), 11, 7, tone(r, { pc: "--stem-green", spread: 0.04 })));
    part(out, g0 + 0.36, top, () => monsteraLeaf(out, r, top, rad(o.rot), o.L, { tilt: o.tilt }));
  });
}

// ---------------------------------------------------------------------------
// Monstera adansonii: a trailing vine of holed leaves that hang under their own weight.
export function adansoniiLeaf(out, r, O, dir, L, flip = 1) {
  const W = 0.48 * L;
  const prof = (s) => Math.min(1, 0.38 + s * 2.6) * Math.sin(Math.PI * Math.min(1, s) ** 0.78) ** 0.75 * (1 - 0.6 * Math.max(0, s - 0.86) / 0.14);
  const bend = (0.04 + r() * 0.08) * L * flip;
  const mid = (s) => [s * L, bend * s * s];
  const toWorld = (p) => add(O, rot(p, dir));
  const wob = wobble(r, 0.008 * L, [5, 11]);
  const up = sample((s) => add(mid(s), [0, -(W / 2) * prof(s) - wob(s)]), 22);
  const dn = sample((s) => add(mid(s), [0, (W / 2) * prof(s) + wob(s)]), 22);
  const tip = mid(1.04);
  const outline = [mid(0), ...up.slice(1), tip, ...dn.slice(1).reverse()];
  const holes = [];
  const count = 2 + Math.floor(r() * 3);
  for (let k = 0; k < count * 2; k++) {
    const sign = k % 2 ? 1 : -1;
    const s = 0.2 + (Math.floor(k / 2) / count) * 0.62 + (sign > 0 ? 0.05 : 0) + (r() - 0.5) * 0.04;
    const c = mid(s);
    const hw = (W / 2) * prof(s);
    const cc = [c[0] + 0.02 * L, c[1] + sign * hw * (0.5 + r() * 0.1)];
    const len = (0.06 + r() * 0.05) * L;
    const wid = (0.02 + r() * 0.015) * L;
    const ang = sign * rad(36 + r() * 14);
    holes.push(Array.from({ length: 12 }, (_, i) => {
      const t = (i / 12) * TAU;
      return toWorld(add(cc, rot([len * Math.cos(t), wid * Math.sin(t) * (1 - 0.25 * Math.cos(t))], ang)));
    }));
  }
  shape(out, r, outline.map(toWorld), tone(r), { holes, deep: 0.6, deepAbout: toWorld(mid(0.3)) });
  let veins = "";
  for (let k = 1; k <= 7; k++) {
    const s = k / 8.2;
    for (const sign of [-1, 1]) {
      const c = mid(s);
      const hw = (W / 2) * prof(Math.min(1, s + 0.12));
      veins += `M${P1(toWorld(c))}Q${P1(toWorld([c[0] + 0.03 * L, c[1] + sign * hw * 0.5]))} ${P1(toWorld([c[0] + 0.12 * L, c[1] + sign * hw * 0.92]))}`;
    }
  }
  out.push(`<path class="ink hair" d="${veins}"/><path class="ink mid" d="${line(sample(mid, 6).map(toWorld))}"/>`);
}
export function adansonii(out, r, base, span) {
  const wander = wobble(r, 22, [1.2, 2.6]);
  const at = (t) => add(base, [t * span, wander(t) + 70 * Math.sin(t * Math.PI * 0.8)]);
  grow(out, 0, 0.86, () => stalk(out, at, 7, 3, tone(r, { pc: "--stem-green", spread: 0.03 }), 60));
  for (let t = 0.06; t < 0.96; t += 0.06 + r() * 0.035) {
    const start = out.length;
    const p = at(t);
    const q = at(t + 0.01);
    const g = Math.atan2(q[1] - p[1], q[0] - p[0]);
    // Most leaves hang below the stem. Now and then one reaches up toward the light.
    const up = r() < 0.28;
    const pet = 22 + r() * 30;
    const pa = g + (up ? -rad(70 + r() * 30) : rad(55 + r() * 45));
    const leafAt = add(p, polar(pet, pa));
    out.push(`<path class="ink mid" d="M${P1(p)}Q${P1(add(p, polar(pet * 0.6, pa - rad(15) * (up ? -1 : 1))))} ${P1(leafAt)}"/>`);
    const young = t > 0.82;
    const L = (young ? 60 : 85 + (1 - t) * 70) * (0.85 + r() * 0.3);
    adansoniiLeaf(out, r, leafAt, pa + rad((r() - 0.5) * 30), L, up ? -1 : 1);
    if (r() < 0.4) {
      const root = [p, add(p, [4 + r() * 6, 18 + r() * 12]), add(p, [-3 + r() * 8, 40 + r() * 24]), add(p, [r() * 10, 60 + r() * 30])];
      out.push(`<path class="ink hair root" d="${line(root)}"/>`);
    }
    const inner = out.splice(start).join("");
    part(out, t * 0.86 + 0.03, p, () => out.push(inner));
  }
}

// ---------------------------------------------------------------------------
// Bird of paradise: long paddles in a fan, torn into ribbons, one crane flower.
export function paddle(out, r, O, dir, L) {
  const W = 0.34 * L;
  const prof = (s) => Math.sin(Math.PI * Math.min(1, s) ** 0.8) ** 0.55 * (1 - 0.35 * s ** 4);
  const toWorld = (p) => add(O, rot(p, dir));
  const slant = 0.32;
  for (const side of [-1, 1]) {
    const cuts = [0];
    let x = 0.18 + r() * 0.15;
    while (x < 0.88) {
      cuts.push(x);
      x += 0.16 + r() * 0.24;
    }
    cuts.push(1);
    for (let k = 0; k < cuts.length - 1; k++) {
      const a = cuts[k] + (k ? 0.006 : 0);
      const b = cuts[k + 1] - (k < cuts.length - 2 ? 0.006 : 0);
      const outer = sample((t) => {
        const s = a + (b - a) * t;
        const h = (W / 2) * prof(s);
        return [s * L + slant * h, side * h];
      }, 5);
      const pts = [[a * L, 0], ...outer, [b * L, 0]];
      shape(out, r, pts.map(toWorld), tone(r, { dl: side > 0 ? -0.05 : 0.02 }), { deep: 0.5, deepAbout: toWorld([((a + b) / 2) * L, 0]) });
    }
    let veins = "";
    for (let j = 1; j < 26; j++) {
      const s = j / 26;
      const h = (W / 2) * prof(s) * 0.94;
      veins += `M${P1(toWorld([s * L, side * 2]))}L${P1(toWorld([s * L + slant * h, side * h]))}`;
    }
    out.push(`<path class="ink hair vein" d="${veins}"/>`);
  }
  out.push(`<path class="wash band"${vars({})} d="${poly([[0, -2.2], [L, -0.6], [L, 0.6], [0, 2.2]].map(toWorld))}"/><path class="ink mid" d="M${P1(toWorld([0, 0]))}L${P1(toWorld([L, 0]))}"/>`);
}
export function strelitzia(out, r, base) {
  [
    { a: -132, len: 220, L: 300 },
    { a: -108, len: 290, L: 330 },
    { a: -86, len: 330, L: 300 },
    { a: -64, len: 270, L: 280 },
  ].forEach((o, k) => {
    const dir = rad(o.a);
    const top = add(base, polar(o.len, dir));
    const g0 = 0.04 + k * 0.08;
    grow(out, g0, g0 + 0.34, () => stalk(out, quad(base, add(base, polar(o.len * 0.5, dir)), top), 10, 6, tone(r, { pc: "--stem-green", spread: 0.04 })));
    part(out, g0 + 0.34, top, () => paddle(out, r, top, dir + rad((r() - 0.5) * 10), o.L));
  });
  craneFlower(out, r, add(base, [10, -2]), add(base, [64, -212]), rad(-10));
}

// The crane flower: a stalk rising between the leaf stalks bends level into a boat-shaped
// spathe (the beak). Orange sepals fan up and back from its top like a crest, and a blue
// arrow-shaped petal points up and forward between them.
export function petalShape(b, dir, len, w, curve, tipK = 1) {
  const spine = sample(quad(b, add(b, polar(len * 0.5, dir + curve)), add(b, polar(len, dir))), 10);
  const L = [];
  const R = [];
  spine.forEach((q, i) => {
    const a = norm(sub(spine[Math.min(10, i + 1)], spine[Math.max(0, i - 1)]));
    const t = i / 10;
    const ww = w * 0.5 * Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.04) ** 0.8) ** (tipK);
    L.push(add(q, mul([-a[1], a[0]], ww)));
    R.push(add(q, mul([a[1], -a[0]], ww)));
  });
  return { pts: [...L, spine[10], ...[...R].reverse()], spine };
}
export function craneFlower(out, r, from, head, tiltA) {
  const H = (x, y) => add(head, rot([x, y], tiltA));
  // Stalk: rises, then curves level into the back of the spathe.
  const stalkEnd = H(-26, 16);
  grow(out, 0.52, 0.8, () => stalk(out, (t) => {
    const u = 1 - t;
    const p1 = add(from, [8, -120]);
    const p2 = add(stalkEnd, [-6, 46]);
    return add(add(mul(from, u * u * u), mul(p1, 3 * u * u * t)), add(mul(p2, 3 * u * t * t), mul(stalkEnd, t * t * t)));
  }, 8, 7, tone(r, { pc: "--stem-green", spread: 0.04 }), 30));
  const flowerStart = out.length;
  // A sepal held back behind the spathe, for depth.
  const back = petalShape(H(18, -8), tiltA - rad(118), 88, 12, rad(-10));
  shape(out, r, back.pts, tone(r, { pc: "--sepal", dl: -0.08, spread: 0.04 }), { deep: 0.4, deepAbout: back.spine[2] });
  // Spathe: straight upper lip, deep keel, a long upturned beak.
  const upper = [H(-44, -2), H(-10, -9), H(40, -12), H(100, -10), H(150, -6), H(176, -4)];
  const lower = [H(170, 2), H(132, 8), H(76, 18), H(22, 25), H(-24, 20), H(-46, 8)];
  shape(out, r, [...upper, ...lower], tone(r, { pc: "--spathe", spread: 0.04 }), { deep: 0.55, deepAbout: H(10, 16) });
  out.push(`<path class="wash keel"${vars({ pc: "--spathe" })} d="${closed([H(-30, 14), H(30, 22), H(110, 10), H(168, 2), H(110, 14), H(30, 26), H(-30, 18)])}"/>`);
  out.push(`<path class="ink hair vein" d="${line([H(-36, 6), H(40, 6), H(120, 2), H(168, -1)])}"/>`);
  // Crest: three orange sepals fanning up and back from the slit.
  [
    [24, -100, 132, 15, 6],
    [44, -86, 120, 16, -4],
    [62, -72, 104, 14, -10],
  ].forEach(([x, deg, len, w, bendDeg]) => {
    const sp = petalShape(H(x, -10), tiltA + rad(deg - 12), len, w, rad(bendDeg));
    shape(out, r, sp.pts, tone(r, { pc: "--sepal", spread: 0.06, hue: 8 }), { deep: 0.45, deepAbout: sp.spine[3] });
    out.push(`<path class="ink hair vein" d="${line(sp.spine.slice(1, 9))}"/>`);
  });
  // Blue arrow petal pointing up and forward.
  const tongue = petalShape(H(70, -12), tiltA + rad(-62), 96, 13, rad(6), 0.6);
  shape(out, r, tongue.pts, tone(r, { pc: "--tongue", spread: 0.05 }), { deep: 0.5, deepAbout: tongue.spine[3] });
  out.push(`<path class="ink hair vein" d="${line(tongue.spine.slice(1, 9))}"/>`);
  const flower = out.splice(flowerStart).join("");
  part(out, 0.82, stalkEnd, () => out.push(flower));
}

// ---------------------------------------------------------------------------
// Alocasia: dark arrowheads with scalloped margins and bold silver veins.
export function alocasiaLeaf(out, r, O, dir, L, tilt = 1) {
  const toWorld = (p) => add(O, rot([p[0], p[1] * tilt], dir));
  const outline = [];
  for (const s of [-1, 1]) {
    const pts = [[0.02 * L, 0], [-0.26 * L, s * 0.2 * L], [-0.34 * L, s * 0.31 * L], [-0.2 * L, s * 0.36 * L]];
    for (let j = 0; j <= 14; j++) {
      const t = j / 14;
      const x = -0.05 * L + t * 1.05 * L;
      const y = 0.4 * L * Math.sin(Math.PI * (0.45 + 0.55 * t)) * (1 - 0.06 * Math.abs(Math.sin(t * 5 * Math.PI)));
      pts.push([x, s * y]);
    }
    outline.push(s < 0 ? pts : pts.reverse());
  }
  const pts = [...outline[0], ...outline[1].slice(1)];
  shape(out, r, pts.map(toWorld), tone(r, { spread: 0.05 }), { deep: 0.58, deepAbout: toWorld([0.2 * L, 0]) });
  const veins = [];
  veins.push([[0.04 * L, 0], [0.98 * L, 0]]);
  for (const s of [-1, 1]) {
    veins.push([[0.04 * L, 0], [-0.15 * L, s * 0.12 * L], [-0.32 * L, s * 0.29 * L]]);
    for (let k = 0; k < 5; k++) {
      const x = 0.08 * L + k * 0.17 * L;
      const t = (x + 0.05 * L) / (1.05 * L);
      const y = 0.4 * L * Math.sin(Math.PI * (0.45 + 0.55 * t)) * 0.9;
      veins.push([[x, 0], [x + 0.08 * L, s * y * 0.6], [x + 0.16 * L, s * y]]);
    }
  }
  for (const v of veins) {
    const w = v.map(toWorld);
    out.push(`<path class="vein-band"${vars({})} d="${line(w)}"/>`);
    out.push(`<path class="ink hair" d="${line(w)}"/>`);
  }
}
export function alocasia(out, r, base) {
  [
    { a: -112, len: 230, L: 230, rot: -150, tilt: 0.92 },
    { a: -80, len: 300, L: 260, rot: -70, tilt: 0.85 },
    { a: -58, len: 200, L: 190, rot: -20, tilt: 0.95 },
  ].forEach((o, k) => {
    const dir = rad(o.a);
    const top = add(base, polar(o.len, dir));
    const g0 = 0.04 + k * 0.1;
    grow(out, g0, g0 + 0.34, () => stalk(out, quad(base, add(base, polar(o.len * 0.5, dir + rad(5))), top), 9, 6, tone(r, { pc: "--stem-dark", spread: 0.04 })));
    part(out, g0 + 0.34, top, () => alocasiaLeaf(out, r, top, rad(o.rot), o.L, o.tilt));
  });
}

// ---------------------------------------------------------------------------
// Calathea orbifolia: a rosette of round leaves banded with silver.
export function calatheaLeaf(out, r, O, dir, L, tilt = 1) {
  const toWorld = (p) => add(O, rot([p[0], p[1] * tilt], dir));
  const half = (x) => 0.43 * L * Math.sin(Math.PI * Math.min(1, x) ** 0.85) ** 0.62;
  const wav = wobble(r, 0.012 * L, [6, 13]);
  const up = sample((x) => [x * L, -half(x) - wav(x)], 20);
  const dn = sample((x) => [x * L, half(x) + wav(x + 0.5)], 20);
  const outline = [...up, ...dn.slice(1, -1).reverse()];
  shape(out, r, outline.map(toWorld), tone(r), { deep: 0.55, deepAbout: toWorld([0.25 * L, 0]) });
  for (const s of [-1, 1]) {
    for (let k = 1; k < 10; k++) {
      if (k % 2) continue;
      const x0 = k / 10.5;
      const x1 = Math.min(0.97, x0 + 0.18);
      const h = half(x1) * 0.9;
      const band = [[x0 * L, 0], [(x0 + 0.06) * L, s * h * 0.55], [x1 * L, s * h], [(x1 - 0.04) * L, s * h * 0.96], [(x0 + 0.03) * L, s * h * 0.4], [(x0 + 0.03) * L, 0]];
      out.push(`<path class="wash band"${vars({})} d="${closed(band.map(toWorld))}"/>`);
    }
    let veins = "";
    for (let k = 1; k < 10; k++) {
      const x0 = k / 10.5;
      const x1 = Math.min(0.97, x0 + 0.18);
      veins += line([[x0 * L, 0], [(x0 + 0.06) * L, s * half(x1) * 0.5], [x1 * L, s * half(x1) * 0.92]].map(toWorld));
    }
    out.push(`<path class="ink hair vein" d="${veins}"/>`);
  }
  out.push(`<path class="ink mid" d="M${P1(toWorld([0, 0]))}L${P1(toWorld([0.97 * L, 0]))}"/>`);
}
export function calathea(out, r, base) {
  [
    { a: -150, len: 120, L: 200, rot: -168, tilt: 0.8 },
    { a: -118, len: 170, L: 220, rot: -122, tilt: 0.92 },
    { a: -90, len: 200, L: 230, rot: -86, tilt: 0.7 },
    { a: -64, len: 165, L: 215, rot: -46, tilt: 0.9 },
    { a: -34, len: 120, L: 190, rot: -8, tilt: 0.78 },
  ].forEach((o, k) => {
    const dir = rad(o.a);
    const top = add(base, polar(o.len, dir));
    const g0 = 0.04 + k * 0.08;
    grow(out, g0, g0 + 0.34, () => stalk(out, quad(base, add(base, polar(o.len * 0.5, dir)), top), 6, 4, tone(r, { pc: "--stem-green", spread: 0.04 })));
    part(out, g0 + 0.34, top, () => calatheaLeaf(out, r, top, rad(o.rot), o.L, o.tilt));
  });
}

// ---------------------------------------------------------------------------
// Staghorn fern: a small woven basket on three cords, soft shield fronds curling over the rim,
// and long silvery antler fronds falling in a gentle fountain, each forking into rounded lobes.
// Antler frond: one blade that widens from a narrow stipe and forks two or three times into
// rounded lobes. The outline walks around the whole forked tree, so each frond is a single
// silhouette with soft notches where it divides, and its veins fork with it.
function antlerSeg(r, p, dir, len, w, droop, depth) {
  const p1 = add(p, polar(len * 0.42, dir));
  const endP = add(add(p, polar(len, dir)), [0, len * droop]);
  const p2 = lerp(p1, endP, 0.45);
  const spine = sample((t) => {
    const u = 1 - t;
    return add(add(mul(p, u * u * u), mul(p1, 3 * u * u * t)), add(mul(p2, 3 * u * t * t), mul(endP, t * t * t)));
  }, 12);
  const seg = { spine, w, kids: [] };
  if (depth > 0) {
    const a = norm(sub(spine[12], spine[11]));
    const nL = [-a[1], a[0]];
    const endDir = Math.atan2(a[1], a[0]);
    const spread = rad(15 + r() * 9);
    const wEnd = w(1);
    const longFirst = r() < 0.5;
    [1, -1].forEach((side, k) => {
      const long = (k === 0) === longFirst;
      const d = long || r() < 0.6 ? depth - 1 : 0;
      const kw = wEnd * 0.6;
      // Each lobe starts against its own side of the fork, so its outer edge carries on
      // from the parent's and only the inner edges meet in the notch.
      const start = add(seg.spine[12], mul(nL, side * (wEnd - kw) * 0.5));
      const width = d > 0 ? (t) => kw * (1 + 0.3 * t) : (t) => kw * (1 - 0.06 * t);
      seg.kids.push(antlerSeg(r, start, endDir + side * spread * (long ? 0.85 : 1.15), len * (long ? 0.62 : 0.5) * (0.92 + r() * 0.16), width, droop * 1.1, d));
    });
  }
  return seg;
}
function edges(seg) {
  const { spine, w } = seg;
  const n = spine.length - 1;
  const L = [];
  const R = [];
  spine.forEach((q, i) => {
    const a = norm(sub(spine[Math.min(n, i + 1)], spine[Math.max(0, i - 1)]));
    const ww = w(i / n) / 2;
    L.push(add(q, mul([-a[1], a[0]], ww)));
    R.push(add(q, mul([a[1], -a[0]], ww)));
  });
  return { L, R };
}
function cross(a, b, c, d) {
  const r = sub(b, a);
  const s = sub(d, c);
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? add(a, mul(r, t)) : null;
}
// Outline of a frond subtree, from the base on its left side round to the base on its right.
function walkFrond(seg) {
  const { L, R } = edges(seg);
  const n = seg.spine.length - 1;
  if (!seg.kids.length) {
    const a = norm(sub(seg.spine[n], seg.spine[n - 1]));
    const nL = [-a[1], a[0]];
    const rr = seg.w(1) / 2;
    const tip = sample((t) => add(seg.spine[n], add(mul(nL, Math.cos(t * Math.PI) * rr), mul(a, Math.sin(t * Math.PI) * rr * 1.25))), 6).slice(1, -1);
    return [...L, ...tip, ...R.reverse()];
  }
  const A = walkFrond(seg.kids[0]);
  const B = walkFrond(seg.kids[1]);
  // The two lobes overlap at their bases: cut both inner edges where they cross.
  let joint = null;
  for (let i = A.length - 1; i > A.length - 14 && !joint; i--)
    for (let j = 0; j < 13 && !joint; j++) {
      const x = cross(A[i - 1], A[i], B[j], B[j + 1]);
      if (x) joint = { i, j, x };
    }
  const inner = joint ? [...A.slice(0, joint.i), joint.x, ...B.slice(joint.j + 1)] : [...A, ...B];
  return [...L.slice(0, -1), ...inner, ...R.reverse().slice(1)];
}
function frondSpines(seg, acc = []) {
  acc.push(seg);
  seg.kids.forEach((k) => frondSpines(k, acc));
  return acc;
}
export function antlerFrond(out, r, base, dir, len, width, droop = 0.3) {
  const v = tone(r, { spread: 0.05 });
  const root = antlerSeg(r, base, dir, len * 0.5, (t) => width * (0.26 + 1.04 * t ** 0.8), droop, 2);
  const pts = walkFrond(root);
  const segs = frondSpines(root);
  out.push(`<path class="wash felt"${vars(v)} d="${closed(glaze(pts, r, { shift: [0.8, 1.1], amp: 0.008 }))}"/>`);
  // Denser tissue toward the base: a narrower glaze along the stipe that fades out before the forks.
  const core = { spine: root.spine.slice(0, 10), w: (t) => root.w(t * 0.75) * 0.55 * (1 - 0.5 * t), kids: [] };
  out.push(`<path class="wash deep"${vars(v)} d="${closed(glaze(walkFrond(core), r, { shift: [0.6, 1.6], amp: 0.01 }))}"/>`);
  const e = inkEdges(pts, { from: centroid(segs.flatMap((s) => s.spine)) });
  out.push(`<path class="ink thin" d="${e.thin}"/><path class="ink thick" d="${e.thick}"/>`);
  out.push(`<path class="ink hair vein" d="${segs.map((s) => line(s.kids.length ? s.spine : s.spine.slice(0, -2))).join("")}"/>`);
}
export function staghorn(out, r, top) {
  const start = out.length;
  const rim = add(top, [0, 150]);
  const rx = 70;
  const ry = 16;
  // Cords to a ring.
  out.push(`<path class="ink hair" d="M${P1(add(rim, [-rx + 4, 0]))}L${P1(top)}L${P1(add(rim, [rx - 4, 0]))}M${P1(top)}L${P1(add(rim, [0, -ry + 2]))}"/>`);
  out.push(`<path class="ink thin" d="M${P1(add(top, [-5, -5]))}a5 5 0 1 0 10 0a5 5 0 1 0 -10 0"/>`);
  // Antler fronds go behind the basket so they appear to spill over its rim.
  const fronStart = out.length;
  [
    [-6, 300, 64, 0.5, [52, -4]],
    [44, 330, 70, 0.3, [24, 6]],
    [108, 320, 66, 0.25, [-14, 8]],
    [186, 290, 62, 0.5, [-50, -4]],
  ].forEach(([deg, len, w, droop, off], k) => part(out, 0.12 + k * 0.12, add(rim, off), () => antlerFrond(out, r, add(rim, off), rad(deg), len, w, droop)));
  const fronds = out.splice(fronStart).join("");
  // The basket: a woven bowl.
  const bowl = [...sample((t) => add(rim, [rx * Math.cos(Math.PI * t), ry * Math.sin(Math.PI * t)]), 12), ...sample((t) => add(rim, [-rx * 0.86 * Math.cos(Math.PI * t), 70 * Math.sin(Math.PI * t) + ry * 0.5]), 14).slice(1)];
  shape(out, r, [add(rim, [rx, 0]), ...sample((t) => add(rim, [rx * Math.cos(Math.PI * t) * (1 - 0.14 * Math.sin(Math.PI * t) ** 0), 62 * Math.sin(Math.PI * t)]), 16)], tone(r, { pc: "--cork", spread: 0.03 }), { deep: 0.5 });
  let weave = "";
  for (let k = 1; k < 4; k++) weave += line(sample((t) => add(rim, [rx * Math.cos(Math.PI * t) * (1 - k * 0.05), (62 * k) / 4 * 1.0 + 6 * Math.sin(Math.PI * t) * k]), 10));
  for (let k = 1; k < 9; k++) {
    const t = k / 9;
    weave += `M${P1(add(rim, [rx * Math.cos(Math.PI * t), 4]))}L${P1(add(rim, [rx * 0.8 * Math.cos(Math.PI * t), 52 * Math.sin(Math.PI * t) + 4]))}`;
  }
  out.push(`<path class="ink hair" d="${weave}"/>`);
  out.push(`<path class="wash" style="--pc:var(--cork);--dl:-0.06" d="M${P1(add(rim, [-rx, 0]))}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0"/><path class="ink thin" d="M${P1(add(rim, [-rx, 0]))}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0"/>`);
  // Shield fronds: soft rounded plates curling over the rim like a collar.
  [
    [-38, -6, 46, 30, -0.3],
    [40, -8, 44, 28, 0.25],
    [0, -14, 52, 34, 0],
  ].forEach(([dx, dy, a, b, tiltA]) => {
    const c = add(rim, [dx, dy]);
    const wav = wobble(r, 0.04, [4, 7]);
    const pts = sample((t) => add(c, rot([a * Math.cos(t * TAU) * (1 + wav(t)), b * Math.sin(t * TAU) * (1 + wav(t + 0.4))], tiltA)), 28).slice(0, -1);
    shape(out, r, pts, tone(r, { pc: "--shield", spread: 0.05, hue: 10 }), { deep: 0.5, deepAbout: add(c, [0, b * 0.4]) });
    let veins = "";
    for (let k = 0; k < 9; k++) {
      const ang = Math.PI + (k / 8) * Math.PI;
      veins += line([add(c, [0, b * 0.5]), add(c, rot([a * 0.85 * Math.cos(ang), b * 0.85 * Math.sin(ang)], tiltA))]);
    }
    out.push(`<path class="ink hair vein" d="${veins}"/>`);
  });
  // Fronds sit behind the basket and unfold from under it. Basket and shields hang in place first.
  const mount = out.splice(start).join("");
  out.push(fronds);
  part(out, 0, top, () => out.push(mount));
}

// ---------------------------------------------------------------------------
// Heart-leaf philodendron: a stem trailing down with glossy hearts, some streaked with lime.
export function heartLeaf(out, r, O, dir, L, tilt = 1) {
  const toWorld = (p) => add(O, rot([p[0], p[1] * tilt], dir));
  const k = 0.9 + r() * 0.2;
  const upper = [[0, 0], [-0.08, -0.1], [-0.08, -0.25 * k], [0.05, -0.38 * k], [0.27, -0.43 * k], [0.52, -0.34 * k], [0.77, -0.16 * k], [1, 0]].map(([x, y]) => [x * L, y * L]);
  const lower = upper.map(([x, y]) => [x, -y * (0.94 + r() * 0.1)]);
  const outline = [...upper, ...lower.slice(1, -1).reverse()];
  shape(out, r, outline.map(toWorld), tone(r, { dl: tilt < 0.8 ? -0.04 : 0 }), { deep: 0.58, deepAbout: toWorld([0.18 * L, 0]) });
  // A soft glossy highlight along the upper half.
  const shine = [[0.12 * L, -0.06 * L], [0.4 * L, -0.24 * L], [0.62 * L, -0.2 * L], [0.5 * L, -0.12 * L], [0.24 * L, -0.07 * L]];
  out.push(`<path class="wash shine"${vars({})} d="${closed(shine.map(toWorld))}"/>`);
  if (r() < 0.35) {
    const streak = [[0.06 * L, 0.01 * L], [0.34 * L, -0.05 * L], [0.72 * L, -0.015 * L], [0.78 * L, 0.02 * L], [0.36 * L, 0.05 * L]];
    out.push(`<path class="wash lime"${vars(tone(r, { pc: "--lime", spread: 0.05 }))} d="${closed(glaze(streak.map(toWorld), r, { shift: [0, 0] }))}"/>`);
  }
  let veins = "";
  for (let i = 1; i < 5; i++) {
    const x = i / 5.4;
    for (const sg of [-1, 1]) veins += line([[x * L, 0], [(x + 0.1) * L, sg * 0.16 * L], [(x + 0.24) * L, sg * 0.26 * L * (1 - x * 0.6)]].map(toWorld));
  }
  out.push(`<path class="ink hair vein" d="${veins}"/><path class="ink mid" d="M${P1(toWorld([0, 0]))}L${P1(toWorld([0.94 * L, 0]))}"/>`);
}
export function trailingStem(out, r, top, length, sway) {
  const wander = wobble(r, 16, [1.1, 2.3]);
  const at = (t) => add(top, [wander(t) + sway * Math.sin(t * 2.4), t * length]);
  grow(out, 0, 0.86, () => stalk(out, at, 6, 3, tone(r, { pc: "--stem-green", spread: 0.03 }), 50));
  let side = r() < 0.5 ? -1 : 1;
  for (let t = 0.03; t < 0.97; t += 0.045 + r() * 0.03) {
    const start = out.length;
    const p = at(t);
    side = r() < 0.7 ? -side : side;
    const pa = Math.PI / 2 + side * rad(30 + r() * 45);
    const pet = 14 + r() * 22;
    const leafAt = add(p, polar(pet, pa));
    out.push(`<path class="ink mid" d="M${P1(p)}Q${P1(add(p, polar(pet * 0.6, pa - side * rad(12))))} ${P1(leafAt)}"/>`);
    const size = (48 + (1 - t) * 46) * (0.8 + r() * 0.4);
    heartLeaf(out, r, leafAt, pa + side * rad(5 + r() * 30), size, r() < 0.25 ? 0.62 + r() * 0.2 : 1);
    const inner = out.splice(start).join("");
    part(out, t * 0.86 + 0.03, p, () => out.push(inner));
  }
}
export function philodendron(out, r, top) {
  // A hanging pot's worth: two stems cascading, the longer one swinging out.
  trailingStem(out, r, add(top, [-30, 0]), 470, 40);
  trailingStem(out, r, add(top, [30, 0]), 560, -55);
}

