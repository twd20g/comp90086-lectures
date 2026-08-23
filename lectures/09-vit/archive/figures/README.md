# Slide 10 — bag of features (vision)

Recropped from page 12 of the source PDF to the figure's true ink bounds
(x 123..1261, y 527..942 at 140dpi) plus a 12px margin, so the axis tops and the
codeword strip are no longer clipped.

Three variants, all built from `bag-of-features-white.png`:

| file | what it is | in the deck |
|---|---|---|
| `bag-of-features-white.png` | as it appears in the PDF | `ASSETS.bofVisionWhite` |
| `bag-of-features-transparent.png` | white background flood-filled to alpha from the border, 4-connected, threshold min(RGB) > 233 | not wired up |
| `bag-of-features-transparent-lifted-lineart.png` | as above, plus dark neutral pixels (max channel < 70, max−min < 28) recoloured to #edebe4 | not wired up |
| `bag-of-features-shipped.png` | the lifted variant with the bicycle rectangle restored from the original | `ASSETS.bofVision` — **currently used** |

## Caveats

**Enclosed white stays white.** 1664 pixels are white but unreachable from the
border — the insides of the bicycle wheel rims, mostly. They read as white discs
on a dark slide. This is the case that may look strange.

**The lifted variant speckles the photographs.** Recolouring dark neutral pixels
catches the axes and arrowheads, which is the point, but it also catches dark
neutral pixels inside the thumbnails — the violin necks, the bicycle tyres, the
shadowed sides of the drums. 15,183 pixels are recoloured in total, roughly 3% of
the image, and the visible cost is white flecks in the codeword strip at the
bottom. Judged worth it: legible axes beat clean thumbnails on a projector.

Two refinements were tried and rejected. Lifting only pixels within a radius of
open space catches the outsides of the strokes and leaves the middles dark, which
reads as a halo. Lifting whole thin connected components would spare the photos
but still whitens the bicycle tyres, which are thin line art by any measure.

**The bicycle is exempted by hand.** It suffered worst — thin black tyres on a
transparent background, so the lift hollowed them out. Its bounding box was found
by 8-connected component labelling of the non-white mask (component 6, x 594..720,
y 67..142), padded by 4px and copied back verbatim from the original, alpha forced
to 255. The result is a small white card behind the bike, which reads as
deliberate rather than damaged. Rerun that step if the figure is ever re-cropped,
since the coordinates are absolute.

## Switching back

In `deck.template.html`, change the slide-10 image to `__BOFVISIONWHITE__` and
drop `plain` from its `<div class="fig plain">`.
