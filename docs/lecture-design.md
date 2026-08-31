# Designing a lecture deck

These are lectures, not explainers. The difference drives most of what follows: an
explainer is read alone, close up, at the reader's pace, and can afford density and
small print. A lecture is projected in a large room, paced by a speaker, and read
from the back row while someone is talking over it. Anything that needs a second
look has already failed.

## The room

**The stage is 1280 × 720; the slide body is 1164 × 547 px.** Everything is
designed against those numbers, then scaled to whatever the projector is. A
component that fits 547 px on your monitor fits the theatre.

**Nothing below 17 px carries meaning.** Sizes actually in use:

| size | role |
|---|---|
| 38 px | slide title |
| 23–30 px | equations, block symbols (X, Qᵀ, K, A) |
| 19–21 px | body text, bullets, running commentary — **the floor for prose** |
| 17 px | row labels, legends, anything the audience must read |
| 10.5–13 px | chrome only: step chips, footer, axis captions |

The 10.5–13 px band is for things that orient without being read — a progress
indicator, a slide number. If a number or phrase matters, it goes at 17 px or
above. Several rounds of this deck went into deleting small text that was carrying
real content: sub-labels under diagram blocks, a hover readout in a corner, a
per-figure caption. Each time the slide got better, not worse, because the
content either moved somewhere legible or turned out to be redundant.

**Assume the fonts might not load.** A captive portal, a proxy, an offline laptop.
Leave 25–30 px of vertical headroom so fallback metrics don't overflow, and
self-host the woff2 files (`framework/fonts/`).

**Assume it will be printed.** `L` previews the light theme, `P` lays the deck out
for print. Any colour computed in JS must ramp from `inkBase()`, not a hardcoded
dark value, or the handout comes out solid black.

## Pacing

**One idea per build step.** Fragments and component steps both advance on `→`,
so a slide is a sequence you talk through, not a wall you reveal. The attention
slide is nine steps; the encoder block is six.

**Let the commentary accumulate.** Replacing the note at each step means the final
state carries only the last sentence. Building it up leaves the whole argument on
screen at the end, which is what a student photographs.

**Animate the transformation, don't just show the result.** K is drawn *on top of*
the X block and then rolls up transposed; the patches fly out of the image and
shrink into a column. Watching the transpose happen does work that an arrow
labelled "transpose" does not.

**Hover beats click for exploration.** A persistent selection has to be explained,
undone, and reset. Hover has no state to manage and no instructions.

## Making the picture carry the argument

**Alignment is an argument.** Row *i* of Qᵀ, row *i* of A and patch *i* share a
`top`; column *j* of K and column *j* of A share a `left`. That is why the dot
product lands where it does, and it is asserted in the tests so a later nudge
cannot quietly break it.

**Placement is an argument.** The ⊕ that adds position codes sits visibly outside
the ×L dashed loop. That single fact — position is added once, not per layer — is
otherwise a sentence people forget.

**One colour per role, and never encode anything by accident.** Embeddings white,
keys red, queries green, values blue, output white, attention teal, softmax amber
(`--role-*` in `framework/tokens.css`). One version of the multi-head slide
coloured its four grids by head index parity — it looked like it meant something
and meant nothing. If colour varies, it must vary *because of* the data.

**Don't let auto-scaling hide the effect you are demonstrating.** Y is a convex
combination of V, so raising τ washes it out — but rescaling Y against its own
maximum stretched it back to full contrast and showed exactly the opposite. A
derived quantity shares the scale of what it derives from.

## Voice

**A title states the idea the slide is about.** Not the slide's importance, not a
tease, not a rhythm. The test: can a reader who sees only the title say what the
slide contains? A title that works only once you are in the room and talking is
not doing its job.

Five ways titles fail, each with the rewrite that fixes it:

| fault | before | after |
|---|---|---|
| commentary on the slide | The matrix is the whole idea | Representation learning as a classification problem |
| a question that withholds | How little is enough? | Classifying from small patches alone |
| rhythm standing in for content | Four questions, four methods | Three ways of inspecting networks |
| a metaphor in place of the term being taught | A keypoint is a window with nowhere to hide | A keypoint is a window that is locally unique |
| a paraphrase in place of the term being taught | What Harris survives, and what it does not | Harris corner invariances |

**This is not a rule against being plain-spoken.** "Scrambling the shape barely
hurts" stays exactly as it is. It is informal, and it states the finding — and
the finding is the idea. What disqualifies a title is emptiness, not informality.

**But a metaphor is not a term.** That is the line between "Scrambling the shape
barely hurts" and "a window with nowhere to hide": the first is informal and
states the finding, the second is informal and states an atmosphere. The second
costs twice over. It says nothing that *locally unique* does not say better, and
the deck had defined *uniqueness* on the slide immediately before — so the
flourish was paid for with the callback. When the lecture has just given the
audience a word, the title is where it gets used.

**And the same rule catches plain words, not only vivid ones.** "What Harris
survives, and what it does not" is unobjectionable prose that manages never to
say *invariance* — the word the learning outcomes promise and the previous
lecture spent a section on. A title is the cheapest place in a deck to put a
term into circulation, and the most wasteful place to paraphrase one. The test
is not whether the title reads well; it is whether a student scanning the index
a week later would find the slide by the name they were taught.

**Prefer a framing the audience already holds.** "Representation learning as a
classification problem" earns its length because it connects the new thing to a
thing they know. Length is not the cost; vagueness is.

**Claim lines under figures follow the same rule**, and carry the number if there
is one: "VGG-16 on texturised images: 90% → 79%" rather than "performance drops a
lot". A claim line is a title for the figure.

Two habits to avoid there, both from the occlusion-map slide:

| fault | before | after |
|---|---|---|
| an aphorism where a description belongs | cover that, and the class goes with it | where occlusion hurts classification the most |
| asserting what the figure shows, rather than crediting it | The model is looking at the object | The heatmaps show the model is looking at the object |

The second is not pedantry. The slide's evidence is the picture; saying so tells
the audience where to look, and keeps the deck from stating as fact what it is in
the middle of demonstrating.

**Register: academic, not arid.** Declarative sentences. No exclamation, and none
of *surprisingly*, *remarkably*, *striking*, *stunning* — if a result is
surprising, the number says so and the audience can be trusted to notice. Avoid
the second person and avoid selling. The deck should read as though it were
written by someone who finds the material interesting and assumes you will too.

## Pedagogical honesty

Say what is a stand-in. The patch embeddings are six hand-picked statistics, not a
learned projection; the multi-head grids come from fixed random matrices, so their
spread is narrower than a trained model's; W_v = I in an earlier version made the
output a literal pixel blend. Each of those is stated on the slide or in its note.
Students who later read the paper should find the deck was straight with them.

Correct the source when it is wrong, and say so. The original lecture read
16×16 patches → 14×14×3 = 588 values, which inverts the paper's convention; the
deck uses 16×16-pixel patches → 196 tokens of 768 values. The equation divided by
D where the paper uses √D.

Quote real numbers with their source. The multi-head slide carries Vaswani et al.
Table 3(A) — h = 1 scores 24.9 BLEU against 25.8 for the best setting — rather than
asserting that more heads help.
