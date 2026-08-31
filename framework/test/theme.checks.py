#!/usr/bin/env python3
"""
Theme checks that need a real browser.

    python3 framework/test/theme.checks.py [--deck dist/standalone/09-vit.html]

The jsdom suites cannot see the CSS cascade, so a rule defeated by specificity
passes every one of them. That is exactly how both cuts of the slide-10 figure
came to render at once: `.fig img` sets display:block at (0,1,1) and outranked
`.only-light` at (0,1,0), so the hidden one was never hidden.

Anything that depends on the cascade — the light/dark cuts of an image or an
equation — belongs here rather than in a jsdom suite.
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

        # every element that exists in a light and a dark cut, across the whole deck
        pairs = pg.evaluate("""() => {
            const out = [];
            document.querySelectorAll('.only-dark').forEach(d => {
                const l = d.parentElement.querySelector('.only-light');
                if (l) out.push([d, l]);
            });
            return out.length;
        }""")
        ok("the deck has light/dark pairs to check", pairs > 0, "%d pair(s)" % pairs)

        for theme in ("dark", "light"):
            if theme == "light":
                pg.keyboard.press("l")
                pg.wait_for_timeout(400)
            shown = pg.evaluate("""() => {
                const vis = e => getComputedStyle(e).display !== 'none' &&
                                 getComputedStyle(e).visibility !== 'hidden';
                const res = [];
                document.querySelectorAll('.only-dark').forEach(d => {
                    const l = d.parentElement.querySelector('.only-light');
                    if (l) res.push({ tag: d.tagName.toLowerCase(),
                                      dark: vis(d), light: vis(l) });
                });
                return res;
            }""")
            want_dark = theme == "dark"
            bad = [s for s in shown if s["dark"] != want_dark or s["light"] == want_dark]
            ok("%s theme: exactly one cut visible in every pair" % theme,
               not bad, "%d pair(s), %d wrong: %s" % (len(shown), len(bad), bad[:2]))

        # and nothing loaded a broken image
        broken = pg.evaluate("""() => [...document.querySelectorAll('img')]
            .filter(i => !i.complete || i.naturalWidth === 0)
            .map(i => (i.getAttribute('src') || '(no src attribute)').slice(0, 40))""")
        ok("every image loaded", not broken, broken[:2])
        b.close()

    print("\nFAILURES:", len(fails))
    for f in fails:
        print("  ✗", f)
    return not fails


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--deck", default=str(ROOT / "dist" / "standalone" / "09-vit.html"))
    a = ap.parse_args()
    d = pathlib.Path(a.deck).resolve()
    if not d.exists():
        sys.exit("no such deck: %s" % a.deck)
    sys.exit(0 if check(d) else 1)
