<div align="center">

<a href="https://benji.appcubic.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/garden-night.svg">
    <img src=".github/assets/garden-day.svg" width="800" alt="A hand-drawn garden around an open clearing. By day it is tropical, with frangipani, mango, and lychee branches, hanging ferns and vines, and monstera and bird of paradise below. By night it is Mediterranean, with olive, fig, and lemon branches, grapevine and bougainvillea from above, and cypress, lavender, and agave below.">
  </picture>
</a>

# Benji Peng, Ph.D.

Scientist and entrepreneur.<br>
A contact card in a garden that grows as you scroll,<br>
tropical by day and Mediterranean by night.

[![Website](https://img.shields.io/website?url=https%3A%2F%2Fbenji.appcubic.com&label=benji.appcubic.com&up_message=online&up_color=3d6b4f&labelColor=262b24&style=flat-square)](https://benji.appcubic.com)
[![Deploy](https://img.shields.io/github/actions/workflow/status/benjipeng/benji/deploy.yml?branch=main&label=deploy&color=3d6b4f&labelColor=262b24&style=flat-square)](https://github.com/benjipeng/benji/actions/workflows/deploy.yml)
[![Vite](https://img.shields.io/badge/Vite-8-3d6b4f?logo=vite&logoColor=white&labelColor=262b24&style=flat-square)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3d6b4f?logo=typescript&logoColor=white&labelColor=262b24&style=flat-square)](https://www.typescriptlang.org)
[![anime.js](https://img.shields.io/badge/anime.js-4-3d6b4f?labelColor=262b24&style=flat-square)](https://animejs.com)

</div>

## Two gardens

Every plant is drawn by code in the manner of a botanical plate: ink contours,
fine on the lit side and heavier in shadow, over layered watercolor glazes.

**By day, a tropical garden.** Frangipani, mango, lychee, and orchid tree
branches reach in from the edges. A staghorn fern and a heart-leaf philodendron
hang from above. Monstera, bird of paradise, alocasia, calathea, a fan palm,
and a Swiss cheese vine fill out the bed.

**By night, a Mediterranean terrace in the dry season.** Olive, fig, lemon, and
stone pine branches reach in. Grapevine, star jasmine, and bougainvillea fall
from the pergola. Italian cypress, lavender, rosemary, agave, and acanthus
rise from the bed, under a moon-silver ink, with fruit and night flowers that
glow against the dark.

Scrolling makes the garden grow. Branches lengthen, and leaves, flowers, and
fruit unfold where they attach. On phones and tablets the garden grows on its
own. Switching the theme grows the other garden in.

## Craft

- **Drawn, not downloaded.** A seeded script draws all twenty-four plants as
  SVG, so each leaf and petal can be redrawn exactly. Color lives in one token
  file, a day set and a night set, with one base tone per species shifted
  shape by shape.
- **Composed for every screen.** Each garden has a layout for every screen
  size, and wider screens show more plants. A small solver spaces them so they
  overlap less. Only the garden on show is downloaded, and only the plants
  its layout uses.
- **Light to run.** The GPU draws the garden only while it grows, at most 30
  times a second. At rest, nothing runs.
- **Considerate.** All content is static HTML. With reduced motion, the garden
  appears fully grown and still.

## Develop

```bash
npm install
npm run dev                    # serve locally, with the token gallery at /gallery/
npm run build                  # type-check and build into dist/
node scripts/garden/draw.mjs   # redraw the garden
```

Content and links live in `index.html`. Colors live in `src/tokens.css`, the
plant registry in `src/garden/plants.json`, and the drawings in
`scripts/garden/`. Design and maintenance notes are in [`AGENTS.md`](AGENTS.md).
Every push to `main` deploys to GitHub Pages.

<div align="center">
<sub>Built with <a href="https://appautomaton.com">App Automaton</a> by <a href="https://www.appcubic.com">AppCubic</a></sub>
</div>
