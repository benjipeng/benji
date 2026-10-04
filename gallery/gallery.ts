import "../src/tokens.css";
import "../src/garden/paint.css";
import "../src/garden/anchors.css";
import "./gallery.css";
import tokens from "../src/tokens.css?raw";
import PLANTS from "../src/garden/plants.json";

// The token gallery, for development only. Token groups come from the comments and
// declarations in src/tokens.css, plants from src/garden/plants.json, and drawings from
// public/garden and gallery/details, so the gallery always shows what ships.

type Token = { name: string; day: string; night?: string };

const root = document.documentElement;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = "") => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};

// Token groups, in the order tokens.css lists them, with night values where the night set
// overrides the day.
function readTokens() {
  const block = (selector: string) => tokens.slice(tokens.indexOf(selector)).split("\n}")[0];
  const night = new Map([...block(':root[data-theme="dark"]').matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]));
  const groups: { title: string; items: Token[] }[] = [];
  for (const line of block(":root {").split("\n")) {
    const title = line.match(/^\s*\/\* (.+) \*\/$/);
    if (title) groups.push({ title: title[1], items: [] });
    const decl = line.match(/^\s*(--[\w-]+):\s*([^;]+);/);
    if (decl && groups.length) groups.at(-1)!.items.push({ name: decl[1], day: decl[2], night: night.get(decl[1]) });
  }
  return groups;
}

function renderTokens() {
  const host = document.querySelector("[data-tokens]")!;
  for (const group of readTokens()) {
    const section = el("section", /Mediterranean/.test(group.title) ? "night" : "");
    section.append(el("h2", "", group.title));
    const grid = el("div", "swatches");
    for (const token of group.items) {
      const swatch = el("div", "swatch");
      const isColor = /^(#|oklch)/.test(token.day);
      const chip = el("span", isColor ? "chip" : "chip value");
      if (isColor) chip.style.background = `var(${token.name})`;
      else chip.textContent = token.day;
      swatch.append(chip, el("code", "name", token.name), el("span", "day", token.day));
      if (token.night) swatch.append(el("span", "night", `night ${token.night}`));
      grid.append(swatch);
    }
    section.append(grid);
    host.append(section);
  }
}

function renderPen() {
  const host = document.querySelector<HTMLElement>("[data-pen]")!;
  host.style.setProperty("--k", "1");
  const rows = [
    ["hair", "0.45 px, veins and texture"],
    ["thin", "0.8 px, the lit edge"],
    ["mid", "1.1 px, stems and growing tips"],
    ["thick", "1.6 px, the shadow edge"],
  ];
  host.innerHTML = rows
    .map(
      ([cls, note]) =>
        `<div class="stroke"><svg viewBox="0 0 220 24" aria-hidden="true"><path class="ink ${cls}" d="M6 14c30-10 52 6 80-2s50-8 74 0 36 4 54-4"/></svg><code>.ink.${cls}</code><span>${note}</span></div>`,
    )
    .join("");
}

// Seven sample shifts of a species tone, the way individual leaves vary around it.
const SHIFTS = [
  [-0.06, -8, 0.9],
  [-0.03, 6, 1.1],
  [0, 0, 1],
  [0.03, -6, 0.95],
  [0.05, 9, 1.05],
  [-0.02, 12, 1.15],
  [0.04, -12, 0.85],
];

// One section per garden. The Mediterranean garden only ever shows at night, so its section
// always uses the night set.
const GARDENS = [
  { key: "tropical", title: "Tropical garden", note: "Shown by day. Plants in order of rank, the order in which a crowded screen keeps them.", night: false },
  { key: "mediterranean", title: "Mediterranean garden", note: "Shown at night. Plants in order of rank.", night: true },
];

async function renderPlants() {
  for (const garden of GARDENS) {
    const plants = PLANTS.filter((plant) => plant.garden === garden.key);
    if (!plants.length) continue;
    const section = el("section", garden.night ? "garden-set night" : "garden-set");
    section.append(el("h2", "", garden.title), el("p", "lede", garden.note));
    const host = el("div", "plants garden");
    section.append(host);
    document.querySelector("[data-gardens]")!.append(section);
    await renderCards(host, plants);
  }
  scaleInk();
}

async function renderCards(host: Element, plants: typeof PLANTS) {
  for (const plant of [...plants].sort((a, b) => a.rank - b.rank)) {
    const card = el("article", `plant-card g-${plant.name}`);
    const [drawing, detail] = await Promise.all([
      fetch(`/garden/${plant.name}.svg`).then((r) => r.text()),
      fetch(`/gallery/details/${plant.name}.svg`).then((r) => r.text()),
    ]);
    const figures = el("div", "figures");
    const whole = el("figure", "whole");
    whole.innerHTML = drawing;
    const close = el("figure", "detail");
    close.innerHTML = detail;
    figures.append(whole, close);

    const text = el("div", "text");
    const heading = el("h3", "", plant.common);
    text.append(heading, el("p", "latin", plant.latin), el("p", "note", plant.note));
    const facts = el("dl");
    const materials = [...new Set([...drawing.matchAll(/--pc:var\((--[\w-]+)\)/g)].map((m) => m[1]))];
    for (const [term, value] of [
      ["Enters", plant.enters],
      ["Grows", plant.grows],
      ["Rank", String(plant.rank)],
      ["Tone", `--pl-${plant.name}`],
      ["Materials", materials.join(", ") || "none"],
    ]) {
      facts.append(el("dt", "", term), el("dd", "", value));
    }
    const strip = el("div", "shifts");
    for (const [dl, dh, dc] of SHIFTS) {
      const chip = el("span");
      chip.style.cssText = `--dl:${dl};--dh:${dh};--dc:${dc}`;
      strip.append(chip);
    }
    text.append(facts, strip);
    card.append(figures, text);
    host.append(card);
  }
}

// Ink keeps one pen width at every size: --k is drawing units per CSS pixel. Each drawing is
// fitted inside its frame, so the tighter of the two directions sets the scale.
function scaleInk() {
  document.querySelectorAll<HTMLElement>(".plant-card figure").forEach((figure) => {
    const svg = figure.querySelector("svg");
    if (!svg || !svg.clientHeight) return;
    const { width, height } = svg.viewBox.baseVal;
    figure.style.setProperty("--k", Math.max(width / svg.clientWidth, height / svg.clientHeight).toFixed(3));
  });
}

function setupTheme() {
  const button = document.querySelector<HTMLButtonElement>("[data-theme-toggle]")!;
  const sync = () => (button.textContent = root.dataset.theme === "dark" ? "Show the day set" : "Show the night set");
  button.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("theme", root.dataset.theme);
    } catch {}
    sync();
  });
  sync();
}

setupTheme();
renderTokens();
renderPen();
renderPlants();
addEventListener("resize", scaleInk);
