# Lecture 12 — narrative

Why this deck is ordered the way it is, and what was changed from the 2025
PowerPoint it came from. Written as a handover: the reasoning is not recoverable
from the slides alone, and the next person to edit them should not have to
re-derive it.

## The spine

Each of these is the **claim the student should leave with**, not a topic heading.
The deck is built to deliver them in this order.

1. Recognising an object across two views means matching features — but
   **appearance alone will not do it**. The same physical point looks different
   under pose and lighting, some points are missing from one view, and the
   background offers convincing impostors.
2. What identifies an object is the **spatial arrangement** of its features, not
   the features themselves. So: is there a single transformation that explains
   where all these matched points went?
3. That reframes matching as **model fitting under unusually hostile
   conditions** — most correspondences are outright wrong, and the correct ones
   are imprecise. Least squares dies here.
4. The general remedy is **voting**: let each datum vote for the models
   consistent with it, and take the model with most support. Outliers vote
   incoherently and cancel; inliers agree and pile up.
5. **Hough transform is voting done by enumerating parameter space.** Each edge
   point votes for every line through it; a line in the image is a peak.
6. Two engineering fixes make it work on real data: **bin** the parameter space
   so noisy points still land together, and use the **polar parameterisation** so
   the space is bounded.
7. **Hough's cost is exponential in the number of parameters**, because it is
   exhaustive grid search. Two is fine, three is tolerable, eight is hopeless.
8. **RANSAC keeps the voting and abandons the enumeration.** Sample the minimum
   number of points needed to *generate* a model, then count inliers. Cost now
   depends on the outlier fraction, not the dimensionality.
9. Both RANSAC parameters **come from quantities you can estimate**: iterations
   from the outlier rate and the confidence wanted; the threshold from the noise
   on a good point.
10. Descriptor matching gives candidates, the **ratio test** thins them, **RANSAC
    decides**. The false-match rate is high even after the ratio test — that is
    precisely why the geometric stage exists.
11. The model for a planar surface across two views is a **homography**, and its
    8 degrees of freedom set the sample size at **four point pairs**.

Points 4 and 7 are the load-bearing ones. Everything else is either setup for
them or consequence of them.

## What was wrong with the original ordering

**The Hough section was an orphan.** Original slides 9–25 detect lines in a single
image, which is not what the lecture is about. It arrived after feature matching
had been set up and before it was resolved, leaving the motivating problem
abandoned for seventeen slides. Hough earns its place only as the thing that
*fails to scale*.

**The hinge was a question, not a conclusion.** "What happens as N parameters
increases?" was followed by a summary and then a new section. The sentence that
has to land is *this is why we need a different way of searching*, and the student
was left to construct that link unaided.

**The transformation zoo interrupted the payoff.** Five slides on affine and
projective transforms paused a running argument. Almost all of it exists to
answer one question — how many degrees of freedom, hence how many points — which
the following slides then asked.

## What changed

| change | why |
|---|---|
| **New slide 9, "The idea: voting"** | Names the shared idea *before* either method appears, so Hough and RANSAC arrive as two ways of searching rather than two unrelated tricks. The original never states it. |
| **Slide 19 rewritten as a conclusion** | Ends on *keep the voting, abandon the enumeration*, and names the homography's 8 DOF, so RANSAC answers a question already posed. |
| **Hough summary slide dropped** | Its content moved into the parameters slide and the limit slide, where it does work. |
| **Transformation zoo: 5 slides → 2** | Affine and projective matrices dropped; the Szeliski DOF table and the point-count sequence survive, reframed as *deriving RANSAC's sample size*. |
| **RANSAC parameters gained the arithmetic** | Half outliers, 2 points → k ≈ 16; 4 points → k ≈ 72. The original posed the question and left it. |
| **Slides 26–28 explicitly numbered as steps** | The original interleaved the three-step recipe with the Hough material; the steps now run consecutively. |
| **Four RANSAC line-fitting figures → two slides, then into `components/ransac-line.html`** | The five-stage build was mostly redundant, and the two slides that survived it asserted "6 inliers against 14" under pictures you could not count. The component builds the pseudocode and the scatter together, draws the δ band and colours the inliers, and computes both numbers. Its twenty coordinates are the source figure's own, recovered by colour-segmenting its dots; with δ = 0.16 the pair the figure ringed selects exactly the fourteen it called inliers. |
| **Slide 12's figure became `components/hough-vote.html`** | The slide claims a mapping between two spaces, and the static figure showed only its result — three curves already crossing. The component casts the votes: a line turns about a point while the (m, b) it stands for is painted opposite. |
| **The polar slide was folded into it, and dropped** | Once the sweep exists, the case for (θ, ρ) is an experiment rather than an assertion: move the same three points near-vertical, sweep again, watch the crossing leave the chart. The slide that stated the same thing in bullets had nothing left to add. |
| **Slides 22 and 23's Grauman photographs became `components/match-pair.html`** | A building is not remotely planar, and the section it opens is about the one transformation that relates two views of a *plane* — the figure argued against the slide. Two photographs of the Hartley & Zisserman cover instead, with SIFT keypoints and real nearest-descriptor matches: 1722 candidates, 33% of them wrong before any thinning. Uncoloured, because at that point in the lecture nobody knows which is which. The second Grauman figure said nothing the component's third step does not. |
| **The same component drives a second slide after the ratio test** | `data-mp-mode="ratio"` replays the same lines and fades the ones the test rejects: 1156 of 1722 survive, and the 33% wrong becomes 8%. Showing the *same* matches in the *same* places is the argument — the ratio test is not a different matcher, it is a filter over answers you already had. |
| **"the proportion of false matches is still high" was withdrawn** | It is 8% on this pair, and the slide immediately after now says so. The claim that survives measurement is that very few false matches are needed to destroy a least-squares fit, which is the deck's actual reason for a geometric stage. |
| **"Feature matching with RANSAC" was dropped with it** | Its figure showed red candidate matches and green inliers over a clock tower — which is the live component's last step, one slide earlier, on the room's own book. |
| **Slide 27's placeholder became `components/homography-live.html`** | Detect, describe, match, then vote over 4-point samples — the whole lecture, on two frames the room supplies. Ends with the first frame warped onto the second, because a bad fit shows as ghosting and no number on a slide can be read the way a doubled edge can. |
| **Grauman's "what model relates the views?" was dropped** | It asked its question over a building facade. The book pair had already made the same point without the distraction of a scene that is not a plane. |
| **Slide 14's placeholder became `components/hough-live.html`** | Camera to edges to accumulator to peaks to the segments they stand for, with all five of the next slide's parameters live. A slide that says each parameter is a decision the method cannot make for you should let the room make it wrongly. |
| **The two accumulator-result slides went with it** | "Accumulator examples" and "On a real image" were screenshots of somebody else's run of the thing now running in the room, one slide earlier and on the room's own walls. The parameters slide stays, because the component's controls are what it is about. |

Nothing was cut for length alone. Anything dropped was either duplicated
elsewhere or was answering a question the restructured order no longer raises.

## Still to build

Nothing. Every placeholder is now a component: `hough-vote` (slide 12),
`hough-live` (slide 14), `ransac-line` (slide 19), `match-pair` (slides 22 and
24) and `homography-live` (slide 27).

`homography-live` deserves a note. It cannot use SIFT — real-time SIFT in a
browser is not on — so it uses Harris corners with upright normalised-patch
descriptors, matched by SSD with the ratio test. The cost is rotation: hold the
camera roughly upright between the two captures. On the book pair it gives
around 190 matches of which some 70% are consistent with one homography, which
is a better demonstration than a cleaner matcher would be.

It computes everything itself even on the still fallback, where it could have
shipped precomputed matches like `match-pair` does. The point is that the code
path the camera uses is then also the path exercised in print and under test.

## The Hartley & Zisserman pair

`hzA` and `hzB` are two photographs of the book, taken by the presenter. Both
were rotated upright and cropped to the cover using the bounding box of the
RANSAC inliers — rotation is rigid and cropping a translation, so the homography
between them survives both, and what it buys is that inliers run as a bundle
instead of fanning out like the outliers.

`SIFT` from `scikit-image` on each frame. The matching is done by hand rather
than with `match_descriptors`, because every match has to carry its own Lowe
ratio — the distance to the nearest descriptor over the distance to the second
nearest — and the library does not return it. That is what lets the ratio slide
thin the very same lines rather than showing a second, differently computed set.

No cross-checking: the lecture describes plain nearest neighbour, and symmetric
matching silently removes most of the wrong answers these slides exist to show.
The cross-checked variant gives 875 inliers against 17 outliers — 2%
contaminated, which looks better and teaches nothing.

`ransac` with `ProjectiveTransform` at a 3 px threshold supplies the split. The
numbers to expect, at 700 px wide:

| | kept | inliers | outliers | wrong |
|---|---|---|---|---|
| every candidate | 1722 | 1159 | 563 | 33% |
| ratio ≤ 0.9 | 1315 | 1110 | 205 | 16% |
| **ratio ≤ 0.8** | **1156** | **1058** | **98** | **8%** |
| ratio ≤ 0.7 | 1032 | 979 | 53 | 5% |

Inlier reprojection error is 0.76 px mean, which is how we know the cover really
is a plane. At 0.8 the test discards 465 of the 563 wrong matches — 83% of them
— and only 101 of the 1159 right ones.

## Figure provenance

Cropped from `COMP90086-12-FeatureMatching.pdf` at 140 dpi by finding the tallest
contiguous ink band between the title bar and the footer, then trimming to ink
with a 12 px pad. Re-run that if the source deck changes.

| asset | source page | asset | source page |
|---|---|---|---|
| `loweMatch` | 5 | `rs1` `rs3` `rs5` | 27, 29, 31 |
| `room` `roomEdgesQ` | 9, 10 | `twoViews` | 34 |
| `houghVote` | 11 | `candidates` | 35 |
| `houghBins` | 13 | `ratioPdf` | 37 |
| `houghPolar` | 14 | `whatModel` | 39 |
| `ex1` `ex3` `ex4` | 15, 17, 18 | `szeliski` | 43 |
| `houghPeaks` | 21 | `pts1` `pts3` `pts4` | 45, 47, 48 |
| `houghLines` | 22 | `ransacMatch` | 49 |

`roomEdges` (p20), `affineEq` (p41) and `pts2` (p46) are in `assets.json` but
not referenced by any slide, and neither are the seven the two live components
displaced: `houghVote` (p11) and `houghPolar` (p14), now built as `hough-vote`;
`ex1` `ex3` `ex4` (pp15, 17, 18), `houghPeaks` (p21) and `houghLines` (p22),
now run live by `hough-live` on the room in front of you; and `rs1` `rs3` `rs5`
(pp27, 29, 31), whose dots became the coordinates `ransac-line` runs on;
`twoViews` (p34), `candidates` (p35) and `whatModel` (p39), displaced by the
book pair; and `ransacMatch` (p49), which `homography-live` now does live. Kept as spares — they cost nothing in the standalone
build, which only inlines assets a slide actually uses, but they do each get
written as a file in the site build. Delete them if that bothers you.
