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
   meeting, with no special cases.
4. A point with last coordinate zero is a **direction**, so parallel lines meet,
   and the meeting point is the vanishing point. Lecture 13's first depth cue.
5. Rotation is `SO(3)`; adding translation needs the fourth coordinate, and the
   result is **`SE(3)`, a group** — which is what lets camera motions compose and
   invert as matrices.
6. A camera is `K[R|t]`: five numbers belonging to the camera, six to the moment.
7. **Put the plane at Z = 0 and a column drops out.** A plane images through a
   3×3, two views of a plane are related by a 3×3, and that is 8 degrees of
   freedom — which is why `N = 4` in lecture 12's RANSAC loop.
8. Rectification is a homography too, so lecture 13's loose end is the same knot.
9. The two centres, the world point and its two images are **coplanar**. That one
   fact is the whole of epipolar geometry.
10. **Sideways motion sends the epipoles to infinity and the epipolar lines
    become image rows.** That is lecture 13's aligned stereo, and the debt is
    paid.
11. Coplanarity written algebraically is `E = [t]×R`, and `E x̂` is a *line* —
    the definition from point 3 doing real work. Uncalibrated, the same object is
    `F`.
12. Eight correspondences determine `F` linearly, but only after **normalisation**
    and only up to the rank constraint, and in practice inside RANSAC.
13. Both **degenerate cases hand you a homography instead**, which is why the book
    cover of lecture 12 was a perfect subject there and would be the worst
    possible input here.
14. And then: `E`, four solutions, cheirality, **triangulation** — and a scale
    that no pair of images can ever supply.

Points 3, 7 and 10 are the ones that tie the three lectures together.

## What changed from the source

| change | why |
|---|---|
| **New opening: the three debts** | The source opens with "the multi-view problem" in the abstract. Naming the three unanswered questions from the previous two lectures gives every piece of algebra a reason to be on the slide before it appears. |
| **Homogeneous coordinates promoted from an aside to a section** | One slide inside "camera calibration" in the source. It is the foundation of everything else in the lecture. |
| **New: lines as vectors, and projective duality** | Absent from the source, which needs `l' = Ex` later and never defines what a line is. Introduced here as one idea with points, since they are the same kind of object, and placed so that the cross product is fresh when `[t]×` arrives. |
| **New: points at infinity and vanishing points** | Free once the coordinates exist, and it retro-explains the perspective cue from lecture 13. |
| **New: SE(3) as a group** | The source writes `[R\|T]` without comment. The group structure is the reason the representation is worth having. |
| **New section: the homography derived** | The source shows the `Z = 0` trick only as a step inside Zhang's calibration method, and never connects it to the homography that lecture 12 fitted. This is the payoff of the first half of the lecture. |
| **New: rectification is a homography** | Closes lecture 13's explicit loose end. |
| **Horizontal motion reframed as "this is last lecture's stereo pair"** | The source shows it as one of three examples of epipolar line patterns. It is the answer to lecture 13's central assumption and is now labelled as such. |
| **New: normalisation for the eight-point algorithm** | The source mentions "additional steps (SVD)", which is the rank-2 fix. Hartley normalisation is the step without which the algorithm does not work, and the source's own before/after figure is a picture of exactly that. |
| **Degeneracies sharpened** | The source lists coplanar points and pure rotation under "Limitations". Both give a homography instead, which connects them to lecture 12 rather than leaving them as caveats. |
| **New: from F to an actual depth** | The source is titled *Multi-view depth* and never computes a depth — it stops at `F`. Decomposition, the four-fold ambiguity, cheirality, triangulation and the scale ambiguity are the payoff the whole lecture is for. |

## Still to build

Two interactives, marked with `.todo` panels:

**Slide 11 — `components/projective-plane.html`.** Drag two points to make a line
and two lines to make a point, with `l·x` shown as a number going to zero, and
parallel lines sending the intersection's last coordinate to zero.

**Slide 25 — `components/epipolar-live.html`.** Click a point in one image of a
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
