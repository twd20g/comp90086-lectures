# COMP90086 lecture decks

Interactive HTML lectures, built from a shared framework so that a fix to the deck
engine reaches every lecture rather than one copy of it.

```
CLAUDE.md           how to work in this repo — read by Claude Code automatically
docs/               lecture-design.md · pitfalls.md
framework/          shell.html · engine.js · chrome.css · tokens.css · primitives.css
                    build.py · sandbox/_harness.html · tools/ · test/ · fonts/
lectures/09-vit/    slides.html · interactives.js · deck.meta.json · assets.json
                    equations.tex.json · equations.json · components/ · lib/ · test/
components/         components used by more than one lecture
dist/               build output — not committed
```

## Build

Building needs only Python 3 (standard library). The tests need `jsdom` and the
PDF renderer needs Playwright's Chromium:

```bash
npm ci                                   # jsdom, mathjax-full
pip install playwright && python -m playwright install chromium
```

```bash
python3 framework/build.py --all              # every lecture
python3 framework/build.py lectures/09-vit    # one
python3 framework/build.py --all --check      # checks only, no write

for t in framework/test/*.js lectures/*/test/*.js; do node "$t"; done

python3 framework/tools/render_pdf.py --deck dist/standalone/09-vit.html
```

### Targets

| output | for |
|---|---|
| `dist/standalone/<slug>.html` | one self-contained file, images inlined — lecturing offline, handing to students |
| `dist/site/<slug>/index.html` | images as separate files — GitHub Pages: ~25% smaller, paints before the images land, caches per image |
| `dist/sandbox/<name>.html` | one host per component, for working on it in isolation |
| `dist/pdf/<slug>-print.pdf` | light-mode A4 landscape, one slide per page |

For 09-vit that is 1210 KB standalone against 154 KB + 983 KB of assets for the
site. Base64 costs 4/3 of raw, so splitting the images out is a free 25%.

## Adding a lecture

1. `mkdir lectures/10-foo` with `deck.meta.json` (`slug`, `title`, `presenter`,
   `assets`), `slides.html`, `interactives.js`, `assets.json`, and `components/`,
   `lib/`, `test/` as needed.
2. `python3 framework/build.py lectures/10-foo`.

The framework is never copied. `slides.html` holds only `<section class="slide">`
elements; the shell, chrome, engine and index menu come from `framework/`.

## Before changing anything

* `CLAUDE.md` — the build/test loop and the five non-negotiables.
* `docs/lecture-design.md` — why these slides look the way they do: the 547 px
  body, the 17 px legibility floor, one colour per role, pacing, honesty.
* `docs/pitfalls.md` — every bug that shipped or nearly shipped, and the check
  that now catches it. Worth reading before adding a component.

## What the checks protect

* **layout** — a component with a fixed-height stage must be `flex:none` and must
  fit the 547 px slide body. The deck's `.body` is a flex column, so an oversized
  stage gets squashed while its absolutely-positioned contents do not, and they
  spill over whatever is below. This is a real bug that shipped once.
* **drift** — every framework file, the lecture's `lib/`, and each component's
  css / markup / js must appear **byte-identical** in every target that uses them.
  A sandbox cannot diverge from the deck, and two lectures cannot diverge from the
  framework.
* **print** — the printable build must be genuinely light: no matrix cell may still
  ramp from near-black, and mean cell luminance must clear 200.
* **equations** — the maths must be typeset rather than text imitating it: a real
  `msqrt` node, `munderover` limits, and the role colours present in the fills.

## Components

Three fenced blocks — `css`, `markup`, `js` — plus a header declaring `init:`.
A component never touches the deck engine; it gets one function:

```js
HOST.registerSteps(root, { max, get, set })
```

The deck wires that to the arrow keys so a component's internal steps interleave
with slide fragments; the sandbox wires it to Prev / Next / Reset. `build.py`
refuses to build if anything calls the engine directly.

## Equations

TeX in `equations.tex.json`, rendered once to SVG with embedded outlines:

```bash
node framework/tools/tex2svg.js lectures/09-vit/equations.tex.json \
                                lectures/09-vit/equations.json
```

SVG rather than a runtime maths library, because the standalone deck must work
with no network: KaTeX or MathJax would mean inlining their web fonts too, and a
font that failed to load would break the maths silently. Colour comes through
`\textcolor` against the role palette, and each equation is built in a light and a
dark cut.

## Publishing

Two routes. Pick one — the difference is whether the built site lives in git.

### Build in CI (default, and what the workflow does)

`.github/workflows/pages.yml` builds every lecture, runs both test suites as a
merge gate, renders the PDFs and publishes `dist/site`. Nothing generated is
committed; `dist/` is gitignored.

**This needs one setting.** In the repository: *Settings → Pages → Build and
deployment → Source* = **GitHub Actions**. If it is left on "Deploy from a
branch", Pages ignores the workflow and serves whatever is committed — which,
with `dist/` ignored, is nothing. That is the usual reason a Pages site comes up
empty here.

### Commit the built site

If you would rather not depend on Actions, drop `dist/site/` from `.gitignore`,
rebuild before each commit, and point *Settings → Pages* at that folder on `main`.

The cost is smaller than it looks, because the site build keeps images as separate
files: an ordinary edit rewrites `index.html` (~154 KB) and nothing else, and the
~1 MB of assets only changes when a figure does. Do **not** commit
`dist/standalone/` — images are inlined there, so every edit rewrites the whole
1.2 MB file and the history grows fast.

### Mixing with hand-written pages

A repository has exactly one Pages source, so once it is set to GitHub Actions the
workflow has to produce **the whole site**, prebuilt pages included. Put those in
`static/` and the build copies them to the site root with their paths unchanged,
so existing URLs keep working:

```bash
python3 framework/build.py --all --static static --prefix lectures
```

    static/index.html          ->  /index.html            (yours, untouched)
    static/notes/index.html    ->  /notes/index.html      (yours, untouched)
                                   /lectures/index.html   (generated index)
                                   /lectures/09-vit/      (generated deck)

`--prefix` keeps the generated lecture index out of the way of your own
`index.html`; drop it to publish the decks at the site root. Every generated link
is relative, so the prefix needs no other change. The build also writes
`.nojekyll`.

### What gets published

    site/index.html                    lecture index
    site/<slug>/index.html             the deck, images as separate files
    site/<slug>/<slug>-offline.html    the same deck as one self-contained file
    site/<slug>/<slug>-print.pdf       light-mode A4, one slide per page

The index links all three, so students can read it in the browser, take the
single file away for offline use, or print the PDF.
