# Working in this repository

Interactive lecture decks for COMP90086 Computer Vision, built from a shared
framework. Read `README.md` for the layout and `docs/` for the two things that
matter most: how these slides are designed, and the bugs that have already bitten.

## The loop

```bash
python3 framework/build.py --all        # stdlib only, no install needed
npm test                                # ten suites; needs npm ci once
python3 framework/tools/render_pdf.py --deck dist/standalone/<slug>.html
```

Build before testing — every suite reads `dist/`, not the sources. A green suite
on a stale build proves nothing.

## Non-negotiables

**Build a component in its sandbox first.** `dist/sandbox/<name>.html` is 100 KB
and reloads instantly, reproduces the slide body box exactly, and needs no
navigation. Integrating first and iterating in the deck wastes minutes per cycle.

**Verify numerically, not by eye.** Every claim a slide makes should be asserted
in a test: that softmax rows sum to 1, that column *j* of K shares a `left` with
column *j* of A, that the printable build has no dark cells left. Screenshots
lie; `getBoundingClientRect` and colour arithmetic do not.

**Never hand-edit `dist/`.** It is generated and gitignored. Edit
`framework/`, `lectures/<id>/`, or `components/`, then rebuild.

**Run a workflow's commands verbatim before trusting them.** Twice, CI failed on
a path that local runs happened to avoid — a relative `--deck` argument, and a
missing `package.json`. Same directory, same arguments, same shell loop.

**When a Python edit script asserts, check what it wrote.** The pattern
`assert old in s; ... open(p,"w").write(s)` rolls back *everything* if a late
replacement misses, while the build and tests keep passing against the previous
output. Grep the source after editing, not just the artefact.

## Adding a lecture

1. `lectures/<NN>-<slug>/` with `deck.meta.json` (`slug`, `title`, `presenter`,
   `assets`), `slides.html`, `interactives.js`, `assets.json`.
2. Extract figures from the source PDF with PyMuPDF; base64 into `assets.json`.
3. Equations as TeX in `equations.tex.json`, then
   `node framework/tools/tex2svg.js <lecture>/equations.tex.json <lecture>/equations.json`.
4. `python3 framework/build.py lectures/<NN>-<slug>`.

Never copy the framework into a lecture. `slides.html` holds only
`<section class="slide">` elements.

## Components

Three fenced blocks — `css`, `markup`, `js` — and a header declaring `init:`.
A component talks to the deck through exactly one function:

```js
HOST.registerSteps(root, { max, get, set })
```

The deck wires it to the arrow keys; the sandbox wires it to Prev/Next. Nothing
in a component may touch the deck engine directly — `build.py` fails the build if
it does.

## The gates

`build.py` refuses to write if a fixed-size stage lacks `flex:none` or overflows
the 547 px slide body, or if any framework/lib/component block is not
byte-identical across every target that uses it. Those two checks exist because
both failures shipped once and neither was visible on screen.
