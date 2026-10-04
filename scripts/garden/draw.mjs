// Draws the plants listed in src/garden/plants.json:
// - public/garden/<name>.svg, each plant fully grown, with its growth markup
// - src/garden/anchors.css, each plant's aspect ratio, anchor (where its base sits inside its
//   box), and species tone
// - src/garden/fields.ts, a coarse map of where each plant paints, for the layout solver
// - gallery/details/<name>.svg, a close study of each plant for the token gallery
// It stops with an error if any leaf, flower, fruit, or thorn would appear before the limb it
// sits on has grown to it.
// Run: node scripts/garden/draw.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { rng, rad, compact } from "./lib.mjs";
import * as W from "./woody.mjs";
import * as H from "./herbs.mjs";
import * as M from "./mediterranean.mjs";

const REGISTRY = JSON.parse(readFileSync(new URL("../../src/garden/plants.json", import.meta.url), "utf8"));

// Each plant is drawn with its base (or hanging point) at the origin, from its own seed so its
// drawing never depends on the order of the list. A detail is a close study of one leaf,
// flower, or fruit.
const PLANTS = {
  frangipani: { seed: 112, draw: (o, r) => W.frangipani(o, r, [0, 0]), detail: (o, r) => W.plumeriaFlower(o, r, [150, 150], 120, 0.3) },
  bauhinia: { seed: 213, draw: (o, r) => W.bauhinia(o, r, [0, 0]), detail: (o, r) => W.bauhiniaFlower(o, r, [130, 160], 110, -0.2) },
  mango: { seed: 314, draw: (o, r) => W.mango(o, r, [0, 0]), detail: (o, r) => W.mangoFruit(o, r, [150, 30], 180, rad(8)) },
  lychee: { seed: 415, draw: (o, r) => W.lychee(o, r, [0, 0]), detail: (o, r) => W.lycheeFruit(o, r, [150, 150], 96) },
  palm: { seed: 516, draw: (o, r) => H.fanPalm(o, r, [0, 0]), detail: (o, r) => H.palmLeaf(o, r, [150, 160], rad(-90), 120, 0.9, -8) },
  monstera: { seed: 617, draw: (o, r) => H.monstera(o, r, [0, 0]), detail: (o, r) => H.monsteraLeaf(o, r, [40, 160], 0, 230, { tilt: 0.92 }) },
  adansonii: { seed: 718, draw: (o, r) => H.adansonii(o, r, [0, 0], 620), detail: (o, r) => H.adansoniiLeaf(o, r, [30, 150], 0, 240) },
  strelitzia: { seed: 819, draw: (o, r) => H.strelitzia(o, r, [0, 0]), detail: (o, r) => H.craneFlower(o, r, [70, 300], [70, 170], rad(-6)) },
  alocasia: { seed: 920, draw: (o, r) => H.alocasia(o, r, [0, 0]), detail: (o, r) => H.alocasiaLeaf(o, r, [110, 150], 0, 180) },
  calathea: { seed: 1021, draw: (o, r) => H.calathea(o, r, [0, 0]), detail: (o, r) => H.calatheaLeaf(o, r, [40, 150], 0, 230) },
  staghorn: { seed: 1122, draw: (o, r) => H.staghorn(o, r, [0, 0]), detail: (o, r) => H.antlerFrond(o, r, [24, 90], rad(-4), 360, 90, 0.35) },
  philodendron: { seed: 1223, draw: (o, r) => H.philodendron(o, r, [0, 0]), detail: (o, r) => H.heartLeaf(o, r, [40, 150], 0, 220) },
  olive: {
    seed: 1324,
    draw: (o, r) => M.olive(o, r, [0, 0]),
    detail: (o, r) => {
      [-130, -106, -82, -58].forEach((d, i) => M.oliveLeaf(o, r, [0, 0], rad(d), 110 - i * 5));
      M.oliveFruit(o, r, [22, 34], 17, true);
      M.oliveFruit(o, r, [-16, 40], 16, false);
    },
  },
  fig: {
    seed: 1425,
    draw: (o, r) => M.fig(o, r, [0, 0]),
    detail: (o, r) => {
      M.figLeaf(o, r, [0, 0], rad(-90), 220);
      M.figFruit(o, r, [170, -60], rad(70), 96);
    },
  },
  lemon: {
    seed: 1526,
    draw: (o, r) => M.lemon(o, r, [0, 0]),
    detail: (o, r) => {
      M.lemonFruit(o, r, [0, 0], 160, 0.12);
      M.lemonBlossom(o, r, [170, 40], 54, 0.3);
    },
  },
  pine: { seed: 1627, draw: (o, r) => M.pine(o, r, [0, 0]), detail: (o, r) => M.pineCone(o, r, [0, 0], 200, -0.15) },
  grapevine: { seed: 1728, draw: (o, r) => M.grapevine(o, r, [0, 0]), detail: (o, r) => M.grapeCluster(o, r, [0, 0], 260) },
  jasmine: {
    seed: 1829,
    draw: (o, r) => M.jasmine(o, r, [0, 0]),
    detail: (o, r) => {
      M.jasmineFlower(o, r, [0, 0], 80, 0.2);
      M.jasmineFlower(o, r, [110, 50], 60, 1.1);
    },
  },
  bougainvillea: { seed: 1930, draw: (o, r) => M.bougainvillea(o, r, [0, 0]), detail: (o, r) => M.bougainvilleaCluster(o, r, [0, 0], 120, 0.4) },
  cypress: { seed: 2031, draw: (o, r) => M.cypress(o, r, [0, 0]), detail: (o, r) => M.cypressColumn(o, r, [0, 0], 420, 92) },
  lavender: { seed: 2132, draw: (o, r) => M.lavender(o, r, [0, 0]), detail: (o, r) => M.lavenderSpike(o, r, [0, 0], rad(-90), 72) },
  rosemary: { seed: 2233, draw: (o, r) => M.rosemary(o, r, [0, 0]), detail: (o, r) => M.rosemaryStem(o, r, [0, 0], rad(-90), 300) },
  agave: { seed: 2334, draw: (o, r) => M.agave(o, r, [0, 0]), detail: (o, r) => M.agaveLeaf(o, r, [0, 0], rad(-80), 320, 0.04) },
  acanthus: { seed: 2435, draw: (o, r) => M.acanthus(o, r, [0, 0]), detail: (o, r) => M.acanthusLeaf(o, r, [0, 0], rad(-30), 320) },
};

// Bounding box from the absolute coordinates in path data, read before it is compacted.
function bbox(markup) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [, d] of markup.matchAll(/ d="([^"]+)"/g)) {
    const nums = d.replace(/h[-\d.]+/g, "").match(/-?\d*\.?\d+/g) ?? [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = +nums[i];
      const y = +nums[i + 1];
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    }
  }
  return box;
}

// Which cells of a grid over the plant's box are painted: every wash shape filled even-odd,
// its outline taken from the path's points. FIELD cells span the longer side.
const FIELD = 40;
function field(markup, vb) {
  const s = Math.max(vb[2], vb[3]) / FIELD;
  const cols = Math.round(vb[2] / s);
  const rows = Math.round(vb[3] / s);
  const cw = vb[2] / cols;
  const ch = vb[3] / rows;
  const on = new Uint8Array(cols * rows);
  for (const [, d] of markup.matchAll(/class="wash[^"]*"[^>]* d="([^"]+)"/g)) {
    if (/[aAhHvV]/.test(d)) continue;
    const rings = d.split("M").filter(Boolean).map((sub) => {
      const nums = sub.match(/-?\d*\.?\d+/g).map(Number);
      const ring = [];
      for (let i = 0; i + 1 < nums.length; i += 2) ring.push([nums[i], nums[i + 1]]);
      return ring;
    });
    const fill = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      const y = vb[1] + (j + 0.5) * ch;
      for (const ring of rings)
        for (let k = 0; k < ring.length; k++) {
          const [x0, y0] = ring[k];
          const [x1, y1] = ring[(k + 1) % ring.length];
          if (y0 > y === y1 > y) continue;
          const x = x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
          const start = Math.max(0, Math.ceil((x - vb[0]) / cw - 0.5));
          for (let i = start; i < cols; i++) fill[j * cols + i] ^= 1;
        }
    }
    fill.forEach((v, i) => (on[i] |= v));
  }
  let hex = "";
  for (let i = 0; i < on.length; i += 4) hex += ((on[i] << 3) | (on[i + 1] << 2) | (on[i + 2] << 1) | on[i + 3]).toString(16);
  return [cols, rows, hex];
}

// Parts (leaves, flowers, fruit, thorns) that would appear before the limb they sit on has
// grown to them. A part counts as sitting on a limb when it attaches within that limb's half
// width of its spine, past its base.
function earlyParts(markup) {
  const limbs = [...markup.matchAll(/class="gl" data-g0="([-\d.]+)" data-g1="([-\d.]+)" data-sp="([^"]+)"/g)].map(([, g0, g1, sp]) => {
    const v = sp.split(" ").map(Number);
    const pts = [];
    for (let i = 0; i < v.length; i += 3) pts.push([v[i], v[i + 1], v[i + 2]]);
    let len = 0;
    const along = pts.map((p, i) => (i ? (len += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])) : 0));
    return { g0: +g0, g1: +g1, pts, along, len };
  });
  const early = [];
  for (const [, g, o] of markup.matchAll(/class="gp" data-g="([-\d.]+)" data-o="([^"]+)"/g)) {
    const [x, y] = o.split(" ").map(Number);
    let best = null;
    for (const limb of limbs)
      limb.pts.forEach((p, i) => {
        const d = Math.hypot(p[0] - x, p[1] - y);
        if (i > 0 && d <= p[2] + 6 && (!best || d < best.d)) best = { d, arrives: limb.g0 + (limb.g1 - limb.g0) * (limb.along[i] / limb.len) };
      });
    if (best && +g < best.arrives - 0.01) early.push(`${o} opens at ${g}, its limb arrives at ${best.arrives.toFixed(3)}`);
  }
  return early;
}

// One drawing as a file: viewBox from the bounding box, path data compacted.
function render(fn, seed) {
  const parts = [];
  fn(parts, rng(seed));
  const markup = parts.join("");
  const [x0, y0, x1, y1] = bbox(markup);
  const pad = 8;
  const vb = [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2].map((n) => Math.round(n));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(" ")}" aria-hidden="true" focusable="false">${markup.replace(/ d="([^"]+)"/g, (_, d) => ` d="${compact(d)}"`)}</svg>\n`;
  return { markup, vb, svg };
}

const out = new URL("../../public/garden/", import.meta.url);
const details = new URL("../../gallery/details/", import.meta.url);
mkdirSync(out, { recursive: true });
mkdirSync(details, { recursive: true });
const css = ["/* Generated by scripts/garden/draw.mjs: each plant's aspect ratio, anchor, and species tone. */"];
const fields = {};
for (const { name } of REGISTRY) {
  const plant = PLANTS[name];
  if (!plant) throw new Error(`plants.json lists ${name}, but draw.mjs has no drawing for it`);
  const { markup, vb, svg } = render(plant.draw, plant.seed);
  const early = earlyParts(markup);
  if (early.length) throw new Error(`${name}: ${early.length} parts appear before their limb reaches them, for example ${early[0]}`);
  writeFileSync(new URL(`${name}.svg`, out), svg);
  writeFileSync(new URL(`${name}.svg`, details), render(plant.detail, plant.seed + 1).svg);
  const bx = (-vb[0] / vb[2]).toFixed(4);
  const by = (-vb[1] / vb[3]).toFixed(4);
  css.push(`.g-${name} { --ar: ${(vb[2] / vb[3]).toFixed(4)}; --bx: ${bx}; --by: ${by}; --leaf: var(--pl-${name}); }`);
  fields[name] = field(markup, vb);
  console.log(`${name.padEnd(13)} ${String(markup.length).padStart(7)} bytes  ${vb.join(" ")}`);
}
writeFileSync(new URL("../../src/garden/anchors.css", import.meta.url), css.join("\n") + "\n");
writeFileSync(
  new URL("../../src/garden/fields.ts", import.meta.url),
  "// Generated by scripts/garden/draw.mjs: where each plant paints, as [cols, rows, hex bits] over its box.\n" +
    "export const FIELDS: Record<string, [number, number, string]> = {\n" +
    Object.entries(fields).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join("\n") +
    "\n};\n",
);
