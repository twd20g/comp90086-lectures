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

## Still to build

One interactive, marked with a `.todo` panel. The projective-plane placeholder
has gone: `components/line-algebra.html` on slide 7 does that job — join and meet
on one grid, with a draggable point whose `l·x` crosses zero — so the slide that
was standing in for it went too.

**`components/epipolar-live.html`.** Click a point in one image of a
real pair, see its epipolar line in the other. The Trevi fountain pair from
lecture 11 has a genuine baseline and is not planar. A second mode runs the
eight-point algorithm on the **Hartley & Zisserman book pair** from lecture 12 —
1722 matches on a plane, which is the worst possible input for `F`. Watching it
fail is the degeneracy slide run rather than asserted.

## Figure provenance

Same method as lecture 13 — title bar found by colour, trim to ink, with an
explicit range where a diagram shares the slide with bullets.

| asset | page | asset | page |
|---|---|---|---|
| `calibTarget` | 14 | `coplanar` | 24 |
| `epiNotation` | 26 | `horizontal` | 28 |
| `forward` | 31 | `eightPt` | 43 |
| `gps` | 50 | `rome` | 53 |
