# Bugs that bit, and what now catches them

Every entry here actually happened while building lecture 09. Most were invisible
on screen, which is why they became tests rather than notes.

## Layout

**A flex column silently squashes a fixed-size stage.** The slide body is
`display:flex; flex-direction:column`, so children shrink. A component 30 px
taller than the 547 px body had its stage compressed — but its contents are
absolutely positioned and did *not* shrink, so they spilled over the note below.
It looked like a copy error between the sandbox and the deck; it was neither.
→ `flex:none` on every fixed stage, and `build.py` fails the build without it.
→ The sandbox now reproduces the slide body box exactly (1164 × 547, same flex
column), so an overflow shows up there first.

**Height budgets need slack.** A component at 528 px of 547 px passed on screen and
would break under font fallback. Anything over ~520 px gets tightened.
→ `multi-head.checks.js` computes both column heights from rendered character
counts and fails within 27 px of the body.

**Text placed above a full-width caption row will collide with it.** The "what the
model can reconstruct" label sat above the reconstruction; the per-tile captions
span the whole strip and ran straight through it.
→ Three clearance assertions in `position-encoding.checks.js`.

**Flow content that simply grows is invisible to every gate.** `build.py` checks
that a *fixed-size* stage declares `flex:none` and fits; the jsdom suites cannot
see layout at all. A table that gains a row, or a bullet that gains a line, is
checked by neither. A parameter table added to slide 20 ran 16 px past the body
bottom with all ten suites green.
→ `framework/tools/check_component.py <name>` measures the lowest content edge
against the 547 px box at every step, in a real browser. Run it on a component
whose content can reflow. Note `scrollHeight` alone cannot do this job: it is
clamped to the box, so it reports a spill but never the room remaining, and a
check written on it can only ever say "0 px clear".

**Not every overrun is a fault, and a check that says so is ignored.** The body
is not the edge of the slide: 11 px of empty space sit below it before the
footer, 52 px before the stage clips, and 58 px of margin either side. The
positional-encoding stage runs 8 px past the body and looks entirely correct.
→ The tool warns for overruns that stay in that visible space and fails only when
something collides or is clipped. Two sideways checks, likewise, because they ask
different questions: an element spilling its own box (layout units, skipped for
transformed elements — a 72 px canvas scaled into a 60 px tile is not an
overflow, and flagging it cost an afternoon) and anything rendering past the
stage edge (rendered boxes, which is what an audience sees).

**A component styled a class every other component was using.** `.steps`, the
step-chip row, was declared in `attention-head`'s css block. Four components
render that markup, and in the deck they got away with it because every
component's css is concatenated. In their own sandboxes the rule was absent, the
chips stacked instead of flowing, and the header measured 93 px instead of 31 —
a 62 px error in a 547 px box, in the one place that is supposed to be exact.
→ Moved to `framework/primitives.css`, which every target injects. Shared chrome
belongs in the framework; if two components render the same class, neither owns
it. The drift check does not catch this: it compares blocks that *are* shared,
not rules that should have been.

**A figure's bounding box is its images — the lecturer's callouts are page text.**
Cropping a slide to the union of its image rectangles is the right instinct: it
gets the figure without the title or the bullets. But an annotation the lecturer
added in PowerPoint is a text box, not an image, so it falls outside that union.
The CAM figure's "GAP = channel average" callout overlapped the figure's right
edge, so the crop cut it mid-sentence and shipped a figure reading "GAP =".
→ Take the union of the image rects *and* any text block that overlaps them, then
decide deliberately whether the annotation belongs. Cropping it out cleanly is a
fine answer; cropping it in half is not.
→ Worth a sweep after extracting a lecture: for each figure page, list the text
blocks that intersect the crop but are not contained by it. On this deck that
found one real loss among eleven hits — the rest were bullets already re-typeset
on the slide.

**A control must not move when you operate it.** The receptive-field slider sat
in the right-hand pane; the caption under the grid sat in the left. Dragging the
slider from 1 to 2 turned "1 conv layer" into "2 conv layers", which widened the
left pane, which pushed the slider right — out from under the cursor dragging it.
The pointer was then over a lower value, the caption shrank, the slider came
back, and the setting oscillated. It drifted 36 px across the range, because the
percentage gains digits as well. Found while presenting, not while building.
→ The caption now spans both panes instead of sitting inside one of them, so its
width cannot reach the control. Anything whose width depends on the state of a
control must not share a row with it.
→ `framework/test/controls.checks.py` sets every range input in every deck to its
minimum, middle and maximum and requires its own bounding box to be identical at
all three. It ran red on this slide before the fix.

## Colour and rendering

**Colour that encodes nothing.** Four attention grids coloured by `h % 2`. Read as
meaningful, wasn't.
→ `multi-head.checks.js` asserts every inked cell is the same colour family.

**Auto-scaling hides the phenomenon.** See `docs/lecture-design.md`. Y now shares
V's scale, and a test measures mean luminance falling from 124 to 57 as τ rises.

**Dark-mode greys hardcoded in components** (`#c9d0d8`, `#cdd3da`) are invisible on
white and don't follow the light theme.
→ All retinted to tokens; `print.checks.js` asserts no cell is still dark and mean
cell luminance clears 200.

**Theme must be set before components initialise.** Components bake their cell
colours at build time against `inkBase()`. Flipping to light afterwards left the
matrices black on white paper. `printAll()` sets the class first.

**Flood fill cannot reach enclosed white.** 1,664 pixels inside the bicycle wheel
rims stayed white when the figure background was made transparent. Fixed by
copying that rectangle back from the original with a 4 px pad — coordinates are
absolute, so a re-crop needs the step rerun.

## Maths

**MathJax renders an error box rather than throwing.** `\definecolor{...}{HTML}`
is not a model it knows; the output was four grey rectangles that looked plausible
in a file listing.
→ `tex2svg.js` exits non-zero on `data-mjx-error` or output with no glyph paths.

**Don't force a height on MathJax SVG.** It sizes in `ex`, which already tracks
font-size; `height:1em` flattened the fraction and radical to a sliver.

**CSS specificity can defeat a visibility toggle, and jsdom will not notice.**
`.fig img` sets `display:block` at (0,1,1), which outranks `.only-light` at
(0,1,0) — so both cuts of the slide-10 figure rendered at once, stacked, in dark
mode. Every jsdom suite passed, because they cannot evaluate the cascade.
→ Element-qualified rules (`img.only-light`), and `framework/test/theme.checks.py`
runs a real browser over every light/dark pair in both themes.

## Tests that lie

**A selector that looks specific but catches machinery.** `#peStage canvas`
matched the first patch thumbnail, not the reconstruction — two assertions were
comparing `NaN` and passing. `#qfStage path` matched the arrowhead `<path>`s
inside `<defs>` and counted 37 arcs instead of 32.
→ Distinguishing classes (`.pe-recon`), and filter on `parentNode.tagName`.

**Navigation that overshoots, masked by global selectors.** The deck checks
advanced ten arrow presses per slide, which sailed past the target — unnoticed for
weeks because every assertion used a global `#id` selector and read the right
element regardless of which slide was showing. The first `.slide.active`-scoped
check returned nothing.
→ Navigation goes through the slide index menu, which is exact.

**`dataset.title` returns the *decoded* attribute.** `'Image as &quot;words&quot;'`
never matched and silently returned index −1. The helper now throws by name.

**A green suite only proves the artefact is self-consistent.** After an edit
script rolled back (below), `build.py` and all ten suites passed against the
previous build. Grep the source after editing.

## Build and CI

**`assert ... ; write at the end` rolls back everything.** A Python edit script
that asserts up front but writes once at the end discards *all* changes when a late
replacement misses — and says so only through a traceback that is easy to skim
past. Two edits were lost this way.

**A stale `@inject` marker carried into an extracted file** injected every
component's JS twice. Caught as an unresolved placeholder.

**Duplicating assets.** `__ASSETS__` serialised all twelve images into the script
*as well as* inlining them at their placeholders, doubling the standalone build to
2441 KB. Only keys actually read as `ASSETS.<key>` are included now.

**`Path.as_uri()` rejects relative paths.** CI passed `--deck dist/standalone/…`;
every local run had used the absolute default. Both entry points now `.resolve()`.

**`npm ci` needs a lock file.** The repo had neither `package.json` nor
`package-lock.json` when CI first ran.

**CSS `@page{margin:0}` beats `pdf(margin=...)`.** Passing margins as parameters
put the entire white band at the bottom of the A4 sheet. Set the page box and its
margins by injecting a complete `@page` rule instead.

**A console message is not a build failure.** `render_pdf.py` treated any console
error — including a blocked webfont — as fatal. Console and network noise are notes;
only the six state checks decide the exit code.

**GitHub Pages serves from one source.** Switching to "GitHub Actions" stops branch
serving entirely; an empty Pages site is usually that setting, not a build failure.

**The build's scanners read comments.** `build.py` finds unresolved placeholders
and asset references by regular expression over the whole component file, so a
comment that spells one out fails the build as if it were code. Both happened
inside ten minutes in `correspondence`: a `__KEY__` in prose tripped the
placeholder guard, and the sentence explaining that tripped the asset scanner by
naming `ASSETS` and a key together. Describe the pattern; do not write it.

**A computed asset key ships no asset.** `assets_needed` matches `ASSETS.name`,
`ASSETS['name']` and `ASSETS['prefix' + i]` — and nothing else. `ASSETS[expr]`
is invisible to it, so the deck and the sandbox both build cleanly and the
component renders broken images. Name every key literally, even if that means a
lookup table beside the loop.

**An `<img>` with no `src` is already broken.** A component that fills the src in
JS should build the element there too. Left in the markup it is a broken image
from parse until init, which is a real failure state for anything checking that
images loaded — and it crashed `theme.checks.py`, whose reporting called
`.slice` on a null `getAttribute('src')`. A check that throws hides every check
after it, which is worse than one that fails.

## The habit underneath all of these

Run the thing the way it will actually run — same directory, same arguments, same
shell loop — and read a number back out of the artefact rather than trusting that
the code that wrote it was correct.
