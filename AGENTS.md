# benji

Benji Peng's professional contact card at `benji.appcubic.com`, published from
`benjipeng/benji` through GitHub Pages. The experimental counterpart is
`benji.renocrypt.com` (`renocrypt/contact`).

## Stack

- Vite and TypeScript with no UI framework. anime.js for motion.
- `npm run build` type-checks and writes `dist/`. `.github/workflows/deploy.yml`
  builds pull requests and deploys `main`.
- Google Analytics (`G-6L7V5YG0QJ`) loads from `src/main.ts` in production builds only.

## Design

- The card is fixed and stays distinct from benji.renocrypt.com: centered,
  system font stacks (serif name, mono eyebrow, sans body), avatar with an
  offset disc, sun and moon toggle.
- Links sit in rounded rows split by hairline dividers: GitHub and Google
  Scholar, LinkedIn and Instagram, then X, Discord, and Telegram. App
  Automaton and Mocubix follow on rows of their own, each with its tagline,
  their icons and names lined up on shared subgrid columns. Each link takes
  its name's width plus an equal share of the row, and a row too narrow for
  its names wraps. On hover a link fills with a capsule tinted in its brand
  color and a corner arrow flies in. Touch screens leave the arrow out.
- Link icons are hand-drawn inline SVG on a 24 grid with a 1.5 stroke. They
  draw in on load and play a gesture on hover or focus.
- Background: a tropical garden drawn as a botanical plate, with ink contours
  (thin on the lit side, heavy on the shadow side) over watercolor glazes.
  Woody plants reach in from the sides. Herbs rise from the bottom or hang from
  the top. The card always sits above the garden, and paper clearings behind
  the name and footer keep the text legible.
- Night mode shows the same garden by moonlight (`--garden-ink`, `--garden-dim`).

## Tokens

- `src/tokens.css` holds every color, in a day set and a night set, in three
  layers: paper and ink, materials (bark, stems, flowers, fruit), and species
  (`--pl-<plant>`, one base tone per plant). Nothing else defines a color.
- `src/garden/paint.css` turns tokens into fills and strokes. Shapes carry
  classes (`.wash`, `.ink` and their kinds), shift their species tone with
  `--dl`, `--dh`, `--dc`, and swap it for a material with `--pc`.
- The token gallery (`gallery/`, development only) shows every token group,
  the pen, and each plant with a close study, read from the same files. Run
  `npm run dev` and open `/gallery/`. Production builds leave it out.

## Garden

- `src/garden/plants.json` is the plant registry: each plant's key, garden,
  rank, names, and notes, in paint order from back to front. Adding a plant
  means a registry entry, a drawing in `scripts/garden/draw.mjs`, a
  `--pl-<plant>` token, and its places in a layout file.
- `node scripts/garden/draw.mjs` draws every registered plant from its own
  seed (so output is stable) into `public/garden/<name>.svg`, with anchors and
  species tones in `src/garden/anchors.css`, occupancy fields in
  `src/garden/fields.ts`, and close studies in `gallery/details/`. Edit the
  scripts and rerun. Never edit the generated files. `lib.mjs` is the shared
  drawing kit, and `woody.mjs` and `herbs.mjs` hold the plants.
- `index.html` gets one empty bed per registered plant from the `<!-- garden -->`
  placeholder at build time (`vite.config.ts`).
- Growth markup: limbs are `g.gl[data-g0][data-g1][data-sp]`. `data-sp` lists
  the spine and half widths, and a growing limb is clipped to a rounded shoot
  of its own taper with an inked tip. Leaves, flowers, and fruit are
  `g.gp[data-g][data-o]` and unfold from where they attach. Gates run from 0 to
  1 within each plant's growth.
- Ink widths are CSS pixels at any plant size: `main.ts` sets `--k`, drawing
  units per pixel, on each plant, and the ink classes multiply by it. Path data
  is written as compact relative commands.
- Placement: each plant is anchored at its base (`--bx`, `--by`) at `--x`,
  `--y` on a side, the top, or the bottom, with height `--h` in `--u` units.
  Media queries in `src/garden/tropical.css` choose the plants each layout
  shows, more on wider screens. Plants a layout leaves out are never fetched.
- `src/garden/arrange.ts` slides each shown plant along its edge to reduce
  overlap while staying near its composed place, and leaves out plants that
  stay mostly covered, lowest rank first.
- Motion: the stage is fixed and a 250vh track drives one smoothed scroll
  value. A short intro grows the garden halfway and the scroll grows the rest.
  Nothing slides in or floats. Every visit starts at the top.
- Scroll cue: a seedling and "Scroll to grow the garden", pinned at the top
  center on a frosted patch tinted with the paper. The seedling grows with the
  scroll and the cue fades out before the rising card reaches it. It bobs once
  if the visitor has not scrolled a few seconds after the intro.
- Touch screens (`pointer: coarse`) play the scroll part of the growth on
  their own after the intro by easing the page through the track, and the cue
  grows and fades with it as on desktop. A touch, wheel, or key stops it.

## Performance

- Rendering stays on the GPU, and the work per frame stays small. The garden
  redraws at most 30 times a second, only when growth moves a visible step.
  Limbs grow inside clip paths (no masks), and only while growing. Ink uses
  plain stroke widths and `stroke-opacity`, never `vector-effect` or element
  opacity. The card drifts on its own layers, the scroll follower stops once
  it arrives, and the cue hides once faded, so nothing runs at rest.
- New effects keep to that budget: no masks or blend modes over the scene, no
  endless animations, and backdrop blur only on small elements that hide when
  done.

## Rules

- All content is static HTML in `index.html`. JavaScript adds only motion, the
  garden, and the theme toggle.
- The card fits the fixed stage with no horizontal scroll or layout shift at
  360x640, 390x844, 768x1024, 844x390, 1024x768, 1440x900, 1920x1080, and
  2560x1440.
- Honor `prefers-reduced-motion`: the garden shows fully grown and still, with
  no cue and no autoplay.
- When links or copy change, update the JSON-LD in `index.html`,
  `public/llms.txt`, and `public/sitemap.xml` together.
- Keep `public/CNAME` as `benji.appcubic.com`.
- The README plates in `.github/assets/` are the fully grown garden alone
  (no card), exported from the page at 1920x1080 as standalone SVG with every
  color resolved, one per theme. Export them again when the look changes.
