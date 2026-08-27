#!/usr/bin/env python3
"""
A control must not move when you operate it.

    python3 framework/test/controls.checks.py [--deck dist/standalone/09-vit.html]

This is a presentation bug, not a rendering one, so nothing else here catches it.
Slide 6 of lecture 09 had a slider in the right-hand pane and a caption in the
left. Moving the slider from 1 to 2 changed "1 conv layer" to "2 conv layers",
which widened the left pane, which pushed the slider to the right — out from
under the cursor that was dragging it. The pointer then sat over a lower value,
the caption shrank, the slider came back, and the setting oscillated. Live, in
front of a room.

The check: for every range input in a deck, set it to its minimum, middle and
maximum, and require its own bounding box to be identical at all three. Any
control whose position depends on the state it controls fails.

Needs: pip install playwright && python3 -m playwright install chromium
"""
import argparse, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent


def check(deck: pathlib.Path):
    from playwright.sync_api import sync_playwright
    fails = []

    def ok(label, cond, extra=""):
        if not cond:
            fails.append(label)
        print(("  ok   " if cond else "  FAIL "), label, extra)

    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1280, "height": 720})
        pg.goto(deck.as_uri(), wait_until="load")
        pg.wait_for_timeout(1200)

        # the markup is built in, so the sliders can be found without visiting
        # every slide; only the ones that have them are worth navigating to
        slides = pg.evaluate("""() => [...document.querySelectorAll('.slide')]
            .map((s, i) => ({ i, title: s.dataset.title,
                              n: s.querySelectorAll('input[type=range]').length }))
            .filter(s => s.n > 0)""")
        print("  %s · %d slide(s) with a control" % (deck.name, len(slides)))
        if not slides:
            return fails

        for s in slides:
            pg.evaluate("i => [...document.querySelectorAll('#menuList li')][i].click()", s["i"])
            pg.wait_for_timeout(500)
            pg.keyboard.press("a")          # reveal fragments, so the control is laid out
            pg.wait_for_timeout(400)

            found = pg.evaluate("""() => {
                const out = [];
                document.querySelectorAll('.slide.active input[type=range]').forEach(el => {
                    const min = +el.min || 0, max = +el.max || 100, was = el.value;
                    const seen = [];
                    for(const v of [min, Math.round((min + max) / 2), max]){
                        el.value = String(v);
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        const r = el.getBoundingClientRect();
                        seen.push({ v, x: Math.round(r.left), y: Math.round(r.top),
                                    w: Math.round(r.width) });
                    }
                    el.value = was; el.dispatchEvent(new Event('input', { bubbles: true }));
                    out.push({ id: el.id || '(unnamed)', seen });
                });
                return out;
            }""")

            for c in found:
                at = c["seen"]
                same = all(a["x"] == at[0]["x"] and a["y"] == at[0]["y"]
                           and a["w"] == at[0]["w"] for a in at)
                ok("%s · #%s holds still while it is used" % (s["title"][:34], c["id"]),
                   same,
                   "" if same else " → ".join("%s@x%d,y%d" % (a["v"], a["x"], a["y"]) for a in at))
        b.close()
    return fails


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--deck", help="a built standalone deck; default is all of them")
    a = ap.parse_args()

    decks = ([pathlib.Path(a.deck)] if a.deck
             else sorted((ROOT / "dist" / "standalone").glob("*.html")))
    if not decks:
        sys.exit("  no built decks — run framework/build.py first")

    fails = []
    for d in decks:
        fails += check(d if d.is_absolute() else (ROOT / d))
    print("\nFAILURES:", len(fails))
    for f in fails:
        print("  ✗", f)
    if fails:
        sys.exit(1)


if __name__ == "__main__":
    main()
