# Lecture 14 — narrative

Why this deck is ordered the way it is, and what was changed from the 2021
PowerPoint it came from.

## The spine

1. This lecture exists to pay **three debts**: why the stereo match lay on a row,
   what two views give you when `f` and `B` are unknown, and where lecture 12's
   homography came from. Saying so up front is what makes the algebra bearable.
2. Homogeneous coordinates make projection and translation **linear** by
   deferring the perspective division to the moment you read the answer back.
3. A **line is the same kind of object as a point** — a triple up to scale — and
   incidence is a dot product. The cross product then does both joining and
   meeting, on one grid and one worked example.
4. Adding a translation to a rotation needs the fourth coordinate, and the
   result is **`SE(3)`, a group** — which is what lets camera motions compose and
   invert as matrices.
5. A camera is `K[R|t]`: five numbers belonging to the camera, six to the moment.
6. **Put the plane at Z = 0 and a column drops out.** A plane images through a
   3×3, two views of a plane are related by a 3×3, and that is 8 degrees of
   freedom — which is why `N = 4` in lecture 12's RANSAC loop.
7. Rectification is a homography too, so lecture 13's loose end is the same knot.
8. The two centres, the world point and its two images are **coplanar**. That one
   fact is the whole of epipolar geometry.
9. **Sideways motion sends the epipoles to infinity and the epipolar lines
    become image rows.** That is lecture 13's aligned stereo, and the debt is
    paid.
10. Coplanarity written algebraically is `E = [t]×R`, and `E x̂` is a *line* —
    the definition from point 3 doing real work. Uncalibrated, the same object is
    `F`.
11. Eight correspondences determine `F` linearly, but only after **normalisation**
    and only up to the rank constraint, and in practice inside RANSAC.
12. Both **degenerate cases hand you a homography instead**, which is why the book
    cover of lecture 12 was a perfect subject there and would be the worst
    possible input here.
13. And then: `E`, four solutions, cheirality, **triangulation** — and a scale
    that no pair of images can ever supply.

Points 3, 7 and 10 are the ones that tie the three lectures together.

## What changed from the source

| change | why |
|---|---|
| **New opening: the three debts** | The source opens with "the multi-view problem" in the abstract. Naming the three unanswered questions from the previous two lectures gives every piece of algebra a reason to be on the slide before it appears. |
| **Homogeneous coordinates promoted from an aside to a section** | One slide inside "camera calibration" in the source. It is the foundation of everything else in the lecture. |
| **New: lines as vectors, and projective duality** | Absent from the source, which needs `l' = Ex` later and never defines what a line is. Introduced here as one idea with points, since they are the same kind of object, and placed so that the cross product is fresh when `[t]×` arrives. It is now `components/line-algebra.html`, which absorbed the separate cross-product slide as well. |
| **Lines moved ahead of projection** | The two were the other way round. Lines are the second half of "a triple up to scale", so they belong beside points; projection is what the coordinates are *for*, and reads better once both objects exist. |
| **`SO(3)` dropped** | A slide on `RᵀR = I`, `det R = +1` and the three degrees of freedom left in nine numbers. Cut for time. The consequence to know about: the SE(3) slide still writes the inverse with `Rᵀ` in it, and the orthogonality that makes `R⁻¹ = Rᵀ` true is no longer stated anywhere in the deck. |
| **The SE(3) matrices written out** | They were `(R t; 0ᵀ 1)` in block form, which is compact and says nothing to a student meeting it. `t` is now `t_x, t_y, t_z` down the column and the bottom row is three separate zeros and a one, so the 4×4 shape is visible rather than asserted. `R` keeps its block form but inside a square bracket sized by a `\vphantom` to span the three rows — square, not round, because the outer delimiter is already a parenthesis and nesting two would read as one. |
| **"Two views of a plane" folded into slide 15** | Its 8 degrees of freedom and its `N = 4` are now a bullet on the slide that derives `H`, which is where they belong: scale H and every image point is unchanged, so nine numbers carry eight, and two equations per correspondence means four points. Cut for time. The consequence to know about: that slide also derived the image-to-image homography by composing one view with the inverse of the other, and the degeneracy slide later says "if the scene is planar, the correspondences satisfy a homography" without it. The step is short — image ← plane → image — but it is now the room's to make. |
| **Points at infinity dropped** | A slide, and a spine entry, on parallel lines meeting on `l∞`. Cut for time. Note that "sideways motion sends the epipoles to infinity", later in the deck, now arrives without that groundwork — it is still true and still shown, but the phrase is no longer built up to. |
| **New: SE(3) as a group** | The source writes `[R\|T]` without comment. The group structure is the reason the representation is worth having. |
| **New section: the homography derived** | The source shows the `Z = 0` trick only as a step inside Zhang's calibration method, and never connects it to the homography that lecture 12 fitted. This is the payoff of the first half of the lecture. |
| **New: rectification is a homography** | Closes lecture 13's explicit loose end. |
| **Horizontal motion reframed as "this is last lecture's stereo pair"** | The source shows it as one of three examples of epipolar line patterns. It is the answer to lecture 13's central assumption and is now labelled as such. |
| **New: normalisation for the eight-point algorithm** | The source mentions "additional steps (SVD)", which is the rank-2 fix. Hartley normalisation is the step without which the algorithm does not work, and the source's own before/after figure is a picture of exactly that. |
| **Degeneracies sharpened** | The source lists coplanar points and pure rotation under "Limitations". Both give a homography instead, which connects them to lecture 12 rather than leaving them as caveats. |
| **New: from F to an actual depth** | The source is titled *Multi-view depth* and never computes a depth — it stops at `F`. Decomposition, the four-fold ambiguity, cheirality, triangulation and the scale ambiguity are the payoff the whole lecture is for. |

## Slide 15 draws the homography rather than asserting it

`components/plane-homography.html`. A camera looking down at the Hartley &
Zisserman book lying in the plane Z = 0, the four rays from its corners through
the centre, and the image those rays form.

Nothing in it is posed. There is one camera — centre, orientation, focal length —
and everything else follows: the book's image is `H(X, Y, 1)` with
`H = K[r1 r2 t]`, the slide's own equation, and the image plane is the set of
camera-frame points at depth D. D is not f, because at f the sensor would be 320
world units across; the rays are unaffected by drawing it nearer, and the sensor
comes out about the size of the book, which is what makes it read as a picture
of it.

The cover is the one from lecture 12. Students fitted a homography to two
photographs of this book there; here the same matrix is derived instead.

**The scene, in world units.** The book is 2 by 3 on the origin, the camera is at
(−2, −3, 2), and we look from (0, −5, 4). At f = 480 on a 320×240 sensor the
cover fills 72% of the frame by 58%.

Two earlier viewpoints were wrong in instructive ways. An oblique tilt with a
weak-perspective divide read as a view from *below* — the far squares of the
ground came out larger than the near ones — which is why the viewer is now an
ordinary pinhole and cannot do that. And with the camera at (−3, −2, 2) its
right axis pointed back towards the viewer, so the image plane projected to a
sliver: a screen aspect of 0.40 for a sensor that is wider than it is tall.
Moving the camera to (−2, −3, 2) takes that to 0.78. The ground plane was drawn
as a grid at first and is now gone; the book is the plane's stand-in, and the
label says so.

**The rays are drawn in three parts.** Bright from O to where the ray pierces the
image plane, faint for the stretch the card hides, bright again from the card's
edge out to the book. Only occlusion should dim a ray, and an earlier version
had the translucent frame washing out the very stretch that does the work. The
exit point is the intersection of the ray with the frame outline, not a guess.
The centre is `O`, as in lecture 13.

**H arcs from the middle of the book's top edge to the same point on its image.**
The curve is a Bézier in *world* space that is then projected, so it genuinely
lifts over the scene and comes back down; bending it on the screen would make
"over" mean nothing.

`test/plane-homography.checks.js` reads the two book quads off the canvas calls
and **fits** a homography between them rather than trusting the component's own,
then checks it reproduces all four corners (6×10⁻¹⁴ px) and that an affine fit
cannot (4.83 px out) — the warp is projective, which is the slide's point rather
than an easier one. It checks each ray runs O → image corner → card edge → book
corner in one straight line, that every faint stretch lies inside the image plane
quad, and that the H curve leaves and arrives at the right points, crosses none
of the 49 samples over the cover it is leaving, and bows 52 px off its chord.

Three traps that suite fell into first, all worth knowing. When the ground was
still drawn, its boundary was a closed quad at the same stroke width as the image
outline and far larger — an early draft took it for the book and "verified" a
homography between the ground and the book, which four points always have. A
canvas stub whose `save`/`restore` do nothing leaks state: the dash set for a
dashed line survived into the next frame and every ray was recorded as dashed. And
"the arrow clears the book" is not a height above its endpoints — measured that
way it scored 26 px and failed a threshold it had no business being judged by;
the check is that no sample of the curve falls inside the cover's quad.

## The epipolar figure is drawn, not imported

`components/epipolar-frames.html` replaces the Hartley & Zisserman scan on the
coplanarity slide. Two reasons. The scan labels the centres `C` and `C'`, and
lecture 13 calls a camera centre `O` — a figure that disagrees with the slide
beside it is worse than no figure. And a scan cannot be extended, which the last
two steps need.

        0  two centres, a world point, and the ray from each centre to it
           crossing that camera's image plane
        1  all five points lie in one plane
        2  the same point measured in each camera's own frame, X_O and X_O'
        3  and the rigid motion carrying one frame to the other. The baseline
           stops being scenery here and becomes t: brightened, arrowheaded at O',
           labelled, and drawn in O's own colour, because O's frame is where its
           coordinates are given

Steps 2 and 3 are the reason this slide now runs to four: `X_O = [R t; 0 1]X_O'`
is what the essential matrix is built out of four slides later, and it wants the
picture that shows two frames looking at one point.

Nothing is posed. Two centres on a baseline, one world point, each camera aimed
at a common scene point; the image points are the actual intersections of the
rays with the planes.

**The planes are sized by the epipole**, which is a constraint rather than a
preference: the epipole is where the baseline pierces the plane, at
`D·tan(angle between the optical axis and the baseline)`, so containing it fixes
the field of view. The slides after this one draw epipoles and epipolar lines
there, and they have to fit. Two ways of containing it make the figure worse, and
both were tried: converging the cameras harder turns the planes away from the
viewer until they are slivers (0.45 face-on against 0.72), and a longer baseline
flattens the epipolar triangle until the planes shrink inside the fit. Shortening
`D` costs nothing — a wide plane close to its own centre, which is what a
schematic of this has always looked like. The epipole lands 69% and 79% of the
way out, the image point near the principal point.

**Each centre carries its own axes**, red-green-blue for x-y-z. Two sets of them
is the picture that steps 2 and 3 are talking about: one point, two frames.

**Everything behind an image plane dims, and everything in front of one does
not.** That needs a depth test, not screen overlap: the stretch from a centre out
to its own image point overlaps its card and is *in front* of it. `occlude()`
cuts a segment at both the plane crossing and the outline crossing, then asks of
each piece whether it is on the far side from the eye AND projects inside the
card. It does all of that in screen space — an earlier version found the outline
crossings in 2D and then fed those parameters to a 3D interpolation, and because
perspective is not linear along a line the cut landed about 24px past the edge
you can see, so each ray stayed dim well after leaving its card.

The plane itself has a part in front of each card too: its intersection with a
card is the line through `x` and the epipole, so the region on the camera's side
of that line is the triangle `O-x-e`. Those two wedges are clipped to their cards
and repainted. Not with `--bg` — the canvas is transparent over a page carrying a
gradient, so painting the token flat came out darker than the real background;
the repaint erases to transparent with `destination-out` and then lays the
plane's own tint on. Measured on the canvas rather than the screenshot for that
reason: the front wedge is teal at α = 0.102 and the open plane at α = 0.122,
against α = 0.592 of grey for the stretch a card hides. Compositing extra teal
over the dimmed version cannot work — solving for one alpha wanted 0.35 on red
and 0.18 on green and blue.

The viewpoint was checked rather than chosen: the epipolar plane's normal is 0.61
against the view direction, so it shows as a triangle instead of collapsing to a
line, which is the one thing this figure cannot afford.

`test/epipolar-frames.checks.js` checks the argument rather than the picture.
Coplanarity cannot be read off a single projection — any four points look
coplanar from somewhere. Collinearity can, because a projection preserves it, so
the suite checks each image point lies on the segment from its own centre to X
(5×10⁻¹⁴ px) and between the two rather than beyond either. That is exactly the
slide's stated reason: two lines that meet span a plane, and all five points are
on one of those two lines.

One trap it fell into: the arrowheads at step 2 are filled triangles with a
vertex at X, and so is the epipolar plane — asking for one vertex at X found
three arrowheads. They are told apart by size.

`coplanar` has gone from `assets.json` with the scan. Note that `epiNotation`, on
the vocabulary slide that follows, is still a Hartley & Zisserman figure and
still writes `C` and `C'`.

## The same figure carries three slides

`epipolar-lines.html` (slide 19) and `epipolar-rotate.html` (slide 20) are the
same scene, the same viewpoint and the same drawing code as `epipolar-frames`,
copied twice. **The figure does not move between the three**, and that constraint
decided several things below. Three copies is the moment to lift the shared
geometry into `lib/`; it has not been done yet because the three are still
settling and the ways they differ are not all known.

`X_O` and `X_O'` are drawn at **every** step of both later slides rather than
revealed by one. A label that vanishes and comes back reads as a new object, and
slide 20 reasons with vectors slide 19 named.

**The sliding copy on slide 19 moves evenly along the ray**, not in inverse
depth. Inverse depth carries `x'` along `l'` at a constant pace, which sounds
better and looks wrong: X crawls near O and then bolts, and the eye reads that as
an artefact of the drawing rather than a fact about the scene. So the even motion
goes to X and `x'` inherits what follows — about three times quicker at the near
end. The sweep stops at 1.1 of the way out to X because the fit sizes the view to
the centres, X and the two cards, which leaves X 37 px below the top edge; 1.1
puts the copy at y = 20 and anything past about 1.15 is off the canvas.

That evenness cannot be tested by cross-ratio, which was the first attempt.
Both schedules are Möbius functions of the frame parameter, so every projective
invariant agrees between them and both score exactly 4/3. Even spacing is affine
and recovering it from a projection needs the ray's vanishing point, which is not
on the canvas. What separates them is the direction of the trend: a point
receding evenly covers less screen each frame, so the gaps fall — 30.8 → 22.9 px
as built, against roughly 28× growth the other way.

### Slide 20 builds the R in E = [t]×R

`Y = O + (X - O')` closes the parallelogram `O, O', X, Y`, because `O→Y` is
`X - O'` by construction and `Y→X` is then `O - O'`. So `X_O` is the diagonal of
a parallelogram whose sides are `t` and `R X_O'` — the next slide's equation,
already drawn, before it is named. `Rx'` sits at the same fraction along its line
that `x'` sits along `O'X`.

The construction was measured before it was drawn, because the projection is not
affine: translating `O'X` back to O swings it **in**, not out. `Y` lands at
(48, 36) on the canvas, so the figure kept its position and the text kept its
full column — the space this looked like it would need was not needed.

`Rx'` lands **in front of** O's card (0.23 along O's axis against the card's
0.42) and projects inside its outline. That overlap is geometry, not a bug: `R x'`
is a direction in O's frame and nothing says it must land on O's image plane.

**`t × Rx'` is not drawn.** From this viewpoint it projects within 3.6° of the
`Rx'` line, so an arrow for it would lie along the very line it is meant to be
perpendicular to and would argue against the sentence it illustrates. The three
vectors get arrowheads at O instead. The viewpoint is shared with two earlier
slides and is not worth breaking for it.

`test/epipolar-rotate.checks.js` cannot test the parallelism directly — a
projection turns a parallelogram into a general quadrilateral, so one view of two
parallel lines looks exactly like one view of two lines meeting off-screen. What
survives is incidence: `O→O'`, `Y→X` and `Rx'→x'` are the same translation, so
their three screen lines are **concurrent**. That pins both claims at once and is
sharp — 1.3×10⁻¹⁵ as drawn, 2×10⁻¹ if Y moves 1% along its own direction.

Two notation debts. The step-0 line on slide 19 ("The same two views of the same
point…") is written here, not by the presenter. And `rotTriple` /`epiFromT` on
slide 20 write `x · (t × R x')` with the unprimed camera as the one being solved
for, while the older `coplanar` and `essential` entries on slide 22 prime the
other camera. The two halves of the section disagree about which camera is
primed.

## Slide 21 carries the essential matrix

The two cross-product equations were combined into one chain — cross product,
then the same product as a matrix, then the expanded column — because the middle
term IS the claim, and putting it between the two familiar ends says so in one
line instead of asking the reader to compare two right-hand sides. It also paid
for the last two builds.

Space came from `ul.b>li`, which carries a 15px bottom margin on every li, the
last one included, so a bullet block already ends with a gap before any figrow
margin is added. A `-12px` bottom margin on the block above the `E` equation
cancels most of the double count.

`.figrow` defaults to `flex:1`. That is right for a row that should take the
slack and wrong everywhere else, and it caused both layout faults on this slide:
first the equation pair floated marooned mid-slide, then, once the null-space
build was added, a growing row pushed the last equation off the bottom of the
body. Every row here is now `flex:none`, including the last — with `flex:1` it
centred itself in the leftover space and floated 139px below the bullet it
belongs to.

## Epipolar lines, live

`components/epipolar-live.html` is built, and the deck has no `.todo` panels
left. Drag a point in either photograph of the Trevi pair and its epipolar line
appears in the other: `l' = F x` one way, `l = F^T x'` back. It sits after the
eight-point algorithm and its refinements, immediately before the degeneracy
slide.

`F` came from the pictures: SIFT, mutual nearest neighbours at ratio 0.70, then
RANSAC at a 1 px threshold — 63 matches, 47 inliers, mean symmetric epipolar
error 0.56 px. It is stored for `[0,1]` coordinates (`S^T F S`) so the drawing
scales with the panel.

The scene has to be non-planar or `F` is not determined, so that was measured:
one RANSAC homography over the F-inliers explains 43% of them.

**The matches were checked by eye, patch against patch, and that caught one.** A
first pass at ratio 0.75 paired a window on the LEFT of the facade with a window
on the RIGHT, 0.69 image widths away. It survived RANSAC because the epipolar
lines here run nearly horizontal and that whole row of windows lies along one of
them — a false match on the right line is still on the right line. The stricter
ratio removed it. It is a good story for the lecture if there is ever time.

The epipoles are off-frame, 2.8 image widths right of A and 1.2 left of B, so
the families fan rather than visibly pivoting. That is this pair: the cameras
moved mostly sideways.

The suite does not copy `F` — that would only prove it can multiply. It asks how
far each drawn line misses the correspondence it was aimed at (worst 1.15 px in a
554 px panel) and, because a component using `F` both ways would otherwise pass,
that the two directions give different families.

The planned second mode — the eight-point algorithm failing on the planar
**book pair** — was dropped for time. The degeneracy slide still asserts it.

## What was cut

Three slides went in one pass: the Hartley & Zisserman vocabulary figure, `The
essential matrix`, and `E turns a point into a line`. Slides 19 to 21 now build
all of that from the drawn figure, so the three were repeating it with different
notation. Deleting the vocabulary figure also removed the last thing in the deck
writing `C` and `C'`, which closes the notation clash noted above; `epiNotation`
went from `assets.json` with it.

Four equations are now unused — `crossmat`, `coplanar`, `essential`, `epiline` —
and are kept against the F and eight-point slides being reworked. Note that
`coplanar` and `essential` prime the opposite camera from slides 20 and 21.

## Figure provenance

Same method as lecture 13 — title bar found by colour, trim to ink, with an
explicit range where a diagram shares the slide with bullets.

| asset | page | asset | page |
|---|---|---|---|
| `calibTarget` | 14 | `coplanar` | 24 |
| `epiNotation` | 26 | `horizontal` | 28 |
| `forward` | 31 | `eightPt` | 43 |
| `gps` | 50 | `rome` | 53 |
