# Lecture 13 — narrative

Why this deck is ordered the way it is, and what was changed from the 2021
PowerPoint it came from. Written as a handover: the reasoning is not recoverable
from the slides alone.

## The spine

Each of these is the **claim the student should leave with**, not a topic heading.

1. Projection threw away a dimension, so infinitely many scenes explain one
   image. Everything else follows from that.
2. A single view still carries depth cues — but every one of them is a **prior**
   about the world, and a prior can be wrong. The Ames room is the proof.
3. Two views separated by a known baseline give a **measurement** instead. No
   assumption about the scene is required.
4. For an aligned pair the measurement is `z = fB/d`: depth is **inversely**
   proportional to disparity.
5. Therefore depth precision **falls off as z²**, and a wider baseline buys
   precision at the cost of a harder match. That trade never goes away.
6. All the work is in measuring `d`, which is the correspondence problem from
   lecture 12 — but alignment has collapsed the search to **one dimension**.
7. Window matching is ambiguous pixel by pixel: no texture, repeated texture,
   occlusion and specularity are four different shapes of the same failure.
8. The constraints that fix it — uniqueness, ordering, smoothness — are
   statements about the answer **as a whole**, so the answer must be found as a
   whole. Hence a global energy, minimised by graph cuts.
9. Rectification makes any pair an aligned pair, using a **homography** — which
   is next lecture's subject, and lecture 12's unexplained object.
10. Learned monocular depth recovers the priors of point 2 from data. It works,
    it blurs edges, it does not generalise, and its scale is assumed rather
    than measured.

Points 3 and 5 are the load-bearing ones.

## What changed from the source

| change | why |
|---|---|
| **Depth cues: 9 slides → 4** | Nine slides of pictures for a section whose content is one sentence. Compressed to single-view cues, multi-view cues, and the claim that separates them. |
| **The Ames room became the opener, with a claim** | It was an unannotated video link on slide 2. It is the best argument in the deck for why single-view depth is inference rather than measurement, and it now says so. |
| **New: depth precision falls off as z²** | The source computes `z = fB/d` and stops. Differentiating it is one line and explains why stereo rigs look the way they do, why long baselines are used outdoors, and why the last slide of the lecture cannot have a scale. Absent from the source entirely. |
| **New: the baseline trade-off** | Wider baseline, better precision, harder match. The tension that motivates everything in the matching section. |
| **New: "alignment makes matching one-dimensional"** | The source never connects stereo matching to the correspondence problem of the previous lecture, and never says that alignment is what makes dense matching affordable. |
| **SSD and NCC now say why you would choose** | The source gives both formulas and no reason. NCC survives a gain and offset, which is what two cameras with independent exposure actually differ by. |
| **Rectification promoted to the hinge** | One slide near the end of the source, phrased as an aside. It is the bridge to lecture 14 and the second appearance of the homography, so it now closes the section and states the debt. |
| **Learned depth: 11 slides → 4** | Task and losses, coarse-to-fine, self-supervision from stereo, limits. The architecture details were doing no work the figures do not do. |
| **New: "what learned depth gets wrong"** | The source lists two disadvantages in a summary. Where the scale comes from is the one that matters, and it ties back to the geometry. |

## Slide 10 is built, not cropped

`stereoSetup` (p16) is gone. The extractor cut it on the left, but the deeper
problem was that it showed the finished construction: two cameras, a car and the
answer already written. `components/stereo-similar.html` builds it instead.

**The parallel is the derivation.** Through O, draw the line parallel to the ray
O′P. It crosses O's image plane at exactly x′, because parallel rays crossing a
plane at the same distance land at the same offset — so both measurements end up
on one plane, a distance d = x − x′ apart. The two lines carry matched chevrons
near their upper ends, so the claim that they are parallel is on the diagram
rather than only in the note. That construction creates the two
triangles the slide needs: **P O O′** and **O x x′**, similar because O x runs
along OP, O x′ is parallel to O′P by construction, and x x′ is parallel to O O′
because the image plane is parallel to the baseline. Height over base in each
gives z/b = f/d.

The centres are O and O′, not C and C′, which is the notation used everywhere a
centre is named in our own figures — `rectify` on slide 25, and lecture 14's
prose. Note the exception: lecture 14's `coplanar` and `epiNotation` are
Hartley & Zisserman originals and write C and C′, the caption of the first one
spelling it out. Reconcile it in the room, or redraw those two.

An earlier draft skipped the parallel: it put P on the midline, where x happens
to equal b/2, and read the triangles off that. That is true for one position of
P and no other, and it is why the component has a slider for P's offset — slide
it and the disparity does not move, which the special-case construction could
not have shown.

**Baseline, depth and P are sliders, not steps.** They were three animated steps
that each swept a parameter and returned it, which meant the picture never came
to rest anywhere new and there was nothing to stand in front of and talk about.
Driven by hand they stop where they are put. Stepping through the build does not
reset them either: a value set on a slider is a value chosen to discuss.

Every ray, image point and label is computed from f, b, z and P's offset through
the same equation the slide derives, so the picture cannot disagree with the
algebra: halving b halves the gap on screen, halving z doubles it, and moving P
sideways leaves it alone.

The rearrangement is its own step, with the b flying from the denominator on the
left of z/b = f/d to the numerator on the right of z = fb/d, because that is the
move students drop. It needs the equation to be positioned glyphs rather than a
rendered MathJax SVG — a glyph inside a rendered SVG cannot be moved.

**The last step shows the accuracy, and solves it rather than sketching it.**
Each ray becomes a cone of a fixed image-plane error e either side. A ray leaving
O at image offset a meets one leaving O′ at offset g at depth fb/(a − g) — the
slide's own equation — so all four corners of the region where the cones agree
are computed. Two land at exactly z, where the two errors cancel; the others at
fb/(d + 2e) and fb/(d − 2e). The sliver comes out far longer along the line of
sight than across it and lopsided, the far tail longer, because z goes as 1/d.

That is the next slide's z² law as a shape, and it checks out: at b = 170,
z = 230, e = 4 the region spans Δz = 73, against the linearised z²Δd/fb = 71 —
the gap being exactly the asymmetry. Doubling the depth from 230 to 290 with the
baseline held takes Δz from 73 to 118, and (290/230)² × 73 = 116. Driving the
sliders the other way, a near, wide-baseline configuration gives Δz = 22 and a
far, narrow one gives 216, at which point the region runs off the top of the
diagram and says so.

The car comes off for that step: it is scenery there, and the sliver needs the
room.

The car is drawn rather than extracted: a 140 dpi page render gives a ragged
matte at this size, and a plan view is what the figure needs anyway, since the
whole diagram is a view from above. P sits at its near edge so the two rays meet
at a point that is visible rather than under the bodywork.

## Slide 17 is the curve the next three slides describe

`components/scanline-match.html`. Click or drag anywhere in the left image; the
cost of that window is plotted along the whole row of the right image, the
minimum marked, with the window size on a slider. Slides 18, 19 and 20 then name
failures rather than describing them, because each one is a shape this curve has
already taken.

The pair is real and was already in the lecture — the same 320x240 rectified
pair the source deck plots SSD and NCC curves for on pages 19 and 20. Checked
before use rather than assumed: the best vertical offset is 0 at 63% of sampled
points and within one pixel at 84%, so the row is the epipolar line. Disparities
run from 0 on the building to 22 in the near bushes.

**The three stops were chosen by measuring, not by eye.** Every location was
scored at w = 3, 5, 9, 13, 17 and 21 for where the minimum lands and how far the
runner-up sits behind it, and these three keep their shape across the whole
slider:

| stop | | behaviour |
|---|---|---|
| foliage | (135,204) | d\* = 12 at every window size, runner-up 5.2-8.4x behind |
| mullions | (94,102) | runner-up 1.1x at w = 3 rising to 4.4x at w = 21, d\* moving 2 to 3 |
| footpath | (274,192) | runner-up 1.0-1.4x at every w, d\* wandering -33 to -16 |
| depth edge | (198,138) | d\* = 15 out to w = 9, flipping to 3 at w = 11 and 2 by w = 19 |

The first stop is in the bushes rather than on a window frame, which was the
first choice. Every confident match on the building sits at d = 2, where the
interval back to the zero-disparity line is two pixels and the quantity the
slide is about cannot be seen. The bushes are nearer, so d = 12 is legible in
the picture and not only in the readout.

**The last stop is where the window slider earns its place.** A bush standing
in front of the building: out to 9x9 the window sees bush and reports the bush's
own disparity, 15, and at 11x11 it holds more wall than bush and the answer
collapses onto the building's 2. That is the same widening that rescued the
mullions two stops earlier, destroying an edge here, which is exactly the trade
slide 18 then names. It was added because the placeholder asked the slider to
show the curve sharpening and then over-smoothing, and the first three stops
only showed the sharpening - over-smoothing is a property of a depth
discontinuity, so it needed a stop sitting on one.

**The readout is runner-up / best**, not peak-to-trough. Over a whole row every
curve has a huge maximum, because at the far end the window is being compared
against completely different content - a peak-to-trough ratio says more about
the rest of the row than about this match. It read 774x on the blank footpath,
which is where that was caught. The lowest local minimum outside the winner's
own valley is the honest number, and it is the ratio test lecture 12 applied to
SIFT descriptors, now deciding whether a scanline match is worth having.

**The cost axis is logarithmic.** SSD runs over three decades along a row, so on
a linear axis the whole comparison collapses into the bottom few percent of the
panel and a match beating its rival six times over looks flat. On a log axis a
ratio is a height.

**The whole row is plotted, not d in [0, dmax]**, having checked first that this
does not corrupt the two good stops - the whole-row minimum agrees with the
banded one at every window size for both. It is what makes the last stop land:
on a textureless surface the unrestricted best match is at negative disparity,
which would put the point behind the cameras, and the reading turns coral to say
so.

`test/scanline-match.checks.js` hands the component a pair whose answer is known
- one texture, and the same texture shifted +9 left of x = 240 and -6 from there
on. Two shifts, because a sign convention is the easiest thing here to get
backwards and one shift cannot tell d from -d. It reports 9, 9, -6 and 9 at the
four stops that have an answer, at every window size, and marks only the
negative one. The seam sits at 240 so that no window straddles it at any size
the slider offers, match position included.

The disparity-and-depth placeholder that used to sit after the depth equation
has gone: slide 10's component does that job, with sliders for the same
parameters and the geometry alongside.

## The depth-error derivation

Three lines, revealed one at a time: the depth equation restated, its derivative
with respect to disparity, and the substitution of d = fb/z. They are three
separate equations rather than one `aligned` block, because a build needs three
fragments and an `aligned` block renders as one SVG.

Left-aligning them would still leave the equals signs ragged, since `z` is much
narrower than the derivative it sits above. The first line is therefore written
as `\hphantom{\frac{\partial z}{\partial d}}\llap{z}`, which pads the short
left-hand side to exactly the width of the wide one — measured, both come out at
3.452 ex — so with a common left edge and a common font size the three equals
signs land in one column. Change the font size of one of them and that breaks,
because the padding is in ex.

## Two notes on the graph-cuts pair

`\underbrace` was replaced by `\underset` in the energy equation. At the width
those two terms need, MathJax builds the brace from a straight extender rule with
the end hooks and the centre point drawn over it, so the arms do not meet at the
point and it reads as a ruler laid across a brace rather than as a brace.
`\underset` puts the label centred under its term with nothing drawn at all,
which is what the labels were for.

The material was also split in three. The energy slide defines the objective —
the two terms, what λ trades between them, why ρ must grow slowly — and ends on
what makes it hard: no pixel has a decision of its own any more. Then
`components/graph-cut.html` gives the intuition. Then the result, so the payoff
arrives after the explanation rather than before it.

The component draws a 6×6 lattice in an oblique projection with a terminal above
and below, which is the standard picture of an s-t graph and makes "one node per
disparity" literal. It builds: the pixels and their neighbour edges, the two
terminals joined to every pixel, an assignment as a colouring, then the cut.

Five bullets said this before and none could show the thing that makes it work,
which is that **a cut of the graph and an assignment of disparities are the same
object seen twice**. At the cut step the condemned edges turn coral for a beat
before they are removed, because a cut you cannot watch happen is just a picture
with fewer lines in it. What is left is two components with no path between the
terminals: 36 terminal edges kept and 36 cut, 10 of the 60 lattice edges gone.

The terminal edges are `--muted`, not `--muted-2` like the lattice. They are
thin, and no amount of alpha on a colour that dark reaches the luminance of the
teal and amber they later turn into — the lattice gets away with the darker
token only because its strokes are twice as wide. Measured on screen: lattice
135, the neutral fan 118, the coloured fans 102, so all three read at comparable
weight with the lattice still dominant.

The SVG is built once in init and the steps only reclass it. Redrawing per step
would make the removal instantaneous, and the removal is the argument. The
assignment is a hand-chosen contiguous region rather than a random one, because
a real solution to this energy is contiguous and a scatter would teach the wrong
thing about what these energies produce.

## Where scale comes from, and how far to chase it

Slide 30 used to say learned monocular depth has "no metric scale". It does
output metres; what it cannot do is get them from the image, since scaling the
scene and the focal length together gives an identical picture. The scale is
borrowed — from an assumed focal length, and from how big things tend to be in
the training set. That is the version now on the slide, and it fits the spine
better than the old one: another prior, not an absence.

Slide 29 deliberately does **not** distinguish the stereo-trained case (known
baseline, true scale) from the monocular-video case (scale ambiguous up to a
constant). The distinction looks clean and is not: monocular training depth
usually comes from a structured-light sensor — the Kinect in the figure — which
carries its own rig-dependent baseline, so the scale traces back to a rig either
way. Elided on purpose. Do not re-open it.

## Slide 25 is built too

`rectify` (p31) is gone. It was cropped at the bottom — both camera centres
sliced off — but the real problem was that it drew the two **rectified** epipolar
lines at different heights. Those lines landing on one row is the entire content
of the word *rectified*, so the figure contradicted the slide it sat on.

`components/rectify.html` builds it: two converged cameras, the epipolar line in
each image, then H₁ and H₂ rotating both onto a common plane, then the shared row.

It is drawn in world coordinates and projected, not laid out in 2D. There are two
camera centres a baseline apart, a world point P, and each image plane at focal
distance F along its own optical axis; the step parameter t swings each axis from
*pointing at P* (t = 0) to *parallel* (t = 1), and a weak-perspective projection
at 21° turns the result into a picture. That projection is what gives the
conventional look at t = 0 — because the axes converge, each plane's outer edge is
further away, so it renders higher up and slightly shorter without either being
specified.

The construction was 2D at first, each plane a quad with its contents placed by
bilinear interpolation from fixed (u, v). That could not survive adding the camera
centres: a ray from a fixed centre through a fixed world point has to meet the
plane where the geometry puts it, not where an interpolation puts it. So every
mark is now solved for. The image point p is the intersection of segment O→P with
the plane. The epipolar line is the plane through O, O′ and P cut by the image
plane, clipped to the frame with Liang–Barsky. H is a rotation of the plane about
its own centre, which is why the centres do not move — that is what a homography
is, and the slide says so out loud.

Nothing is tuned by hand: an init-time `fit()` projects every key point at both
t = 0 and t = 1 and picks the scale and offset that hold the whole sweep on screen.

Both epipolar lines arrive on one row because after rectification both axes are
+z, so s = F/P₅ for each camera and the epipolar direction falls out as (1, 0, 0).
`test/rectify.checks.js` reads the rendered SVG and asserts it: the centres are at
(235.4, 287.2) and (704.6, 287.2) at step 0 and unchanged at step 3; before
rectification the two lines fall 47.8 px and 39.8 px in opposite directions;
after, both are horizontal to 0.000 px and both sit at y = 195.15, as do the two
image points. It also checks at both ends that each image point is within 0.6 px
of the ray from its own centre to P — measured, it is 0.000.

## Figure provenance

Cropped from `COMP90086-13-DepthStereo-2.pdf` at 140 dpi by finding the blue
title bar by colour, starting below it, and trimming to ink. A handful needed an
explicit row or column range to separate a diagram from the bullets beside it;
the script is `figs.py` and records them.

| asset | page | asset | page | asset | page |
|---|---|---|---|---|---|
| `perspective` | 6 | `texture` | 8 | `occlusion` | 9 |
| `familiar` | 10 | `binocular` | 11 | `stereoSetup` | 16 |
| `lincoln` | 18 | | | | |
| `windowSize` | 23 | `failures` | 25 | `rawResult` | 26 |
| `graphCuts` | 30 | `nyu` | 35 | `eigenNet` | 36 |
| `eigenNet` | 36 | `eigenRes` | 38 | `godardNet` | 41 |
| `godardRes` | 42 | | | | |

**Two figures were replaced by video**, both from
`COMP90086-13-DepthStereo-black.pptx`, and in both cases the still was a frame
of the clip it now plays.

`ames` (p2) is gone. The extracted still turned out to be frame 0 of
`ppt/media/media1.mp4` on slide 2 of the PowerPoint, letterboxed in black by the
page render — so the deck was showing a paused video with bars around it, while
the source deck sat a bare YouTube link beside it. The clip itself is 82 s at
480×360 and silent: two people trade corners of the room and appear to change
size, then at about 34 s it cuts to the room seen from outside, with its floor a
trapezium and its far wall twice as far away as it looks. That middle section is
the answer to the slide's own claim — infinitely many scenes produce this image,
and here is the other one — so the whole clip is kept rather than trimmed to the
illusion. Re-encoded at CRF 28, which is 1117 KB against 2556 KB for a stream
copy, at **SSIM 0.989** against the original; CRF 24 would have cost 700 KB more
for 0.003 of that. `amesPoster` is frame 0, so the slide looks exactly as it did
until it moves.

No YouTube link was needed. The fallback offered was a link starting at 35 s,
presumably to skip a lead-in; this copy has none, opening on the illusion at
frame 0, so nothing is trimmed and no start offset is set.

`parallax` (p12) was replaced by **video**, because motion parallax is motion and
a still can only assert it. `parallaxClip` is six seconds of the drone footage
embedded in `COMP90086-13-DepthStereo-black.pptx` (slide 12, `ppt/media/media2.mp4`),
and `parallaxPoster` is its first frame — a `<video>` renders as its poster in
the printable build, so without one that page would be a black rectangle.

**It does not autoplay.** The cue is the motion, and the demonstration only
lands if the still comes first: a frozen aerial photograph looks flat, and the
same photograph in motion resolves into depth at once. Autoplay spends that
moment while the room is still reading the previous slide. So the clip waits on
its poster and starts on a *step*, which means a clicker drives it and not only a
mouse; clicking the video toggles it too, and pausing rewinds to the first frame
so the flatness can be shown back. The slide carries `data-init`, which is also
what stops a click on it advancing the slide.

Both clips share one function in `interactives.js`, differing in one flag. The
parallax clip rewinds on pause because the flat photograph is half its argument
and has to be showable again; the Ames clip pauses where it is, because it runs
for 82 seconds and explains itself halfway through, so stopping on a frame to
talk about it is the normal way to use it.

The segment was chosen by measurement rather than by eye. Parallax is near-fast
and far-slow, so phase-correlating the top and bottom thirds of the frame
separately gives a ratio: **t = 14 s scores 5.0** (near 5 px, far 1 px) against
about 1.1 at t = 38 s, which has three times the motion but moves as one — a pan,
not parallax. Encoded as 3 s forward plus the same 3 s reversed, so the loop does
not jump, at 720 px wide and CRF 26: 434 KB, or 578 KB once base64'd into the
standalone deck.

`familiar` (p10) is in `assets.json` but not currently placed on a slide — the
single-view cues slide uses three figures and a fourth crowded it.
