#!/usr/bin/env python3
"""
The inner loop for working on one component: build, test, measure, screenshot.

    python3 framework/tools/check_component.py multi-head
    python3 framework/tools/check_component.py multi-head --shot        # + a PNG
    python3 framework/tools/check_component.py multi-head --light       # light cut
    python3 framework/tools/check_component.py multi-head --no-build    # skip the build

Three things happen, in one browser launch:

  build     the lecture that owns the component (~0.1s — nothing worth caching)
  test      the component's own jsdom suite, if it has one
  measure   dist/sandbox/<name>.html at every step, in a real browser

Why the sandbox rather than the deck: `#root` there is 1164 x 547 with the same
flex column as a slide body, so an overflow shows up identically — but the file
is ~100 KB instead of 1.2 MB and needs no navigation to reach the slide.

**What this catches that nothing else does.** build.py checks that a fixed-size
stage declares flex:none and fits; the jsdom suites cannot see layout at all. Flow
content that simply grows too tall — a table gaining a row, a bullet gaining a
line — is invisible to both. That shipped once: a parameter table on slide 20 ran
16 px past the body bottom and every check stayed green. This measures the
lowest content edge against the 547 px box at every step, which is that bug.

Needs: pip install playwright && python3 -m playwright install chromium
"""
import argparse, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
BODY_H = 547                  # the slide body box the sandbox reproduces
SLACK = 20                    # keep this much clear: font fallback moves text


def locate(name):
    """Find the component and the lecture that owns it.

    A shared component (components/<name>.html) has no lecture of its own, so the
    first lecture that lists it in sharedComponents is built instead."""
    import json
    own = sorted(ROOT.glob("lectures/*/components/%s.html" % name))
    if own:
        return own[0], own[0].parent.parent
    shared = ROOT / "components" / ("%s.html" % name)
    if shared.exists():
        for meta in sorted(ROOT.glob("lectures/*/deck.meta.json")):
            if name in json.loads(meta.read_text()).get("sharedComponents", []):
                return shared, meta.parent
        sys.exit("  %s is in components/ but no lecture lists it in sharedComponents" % name)
    sys.exit("  no component called %s in lectures/*/components/ or components/" % name)


def run(label, cmd):
    print("\n== %s" % label)
    r = subprocess.run(cmd, cwd=ROOT)
    return r.returncode == 0


def measure(name, light=False, shot=None, settle=450):
    """Drive the sandbox through every step and measure the slide body box."""
    from playwright.sync_api import sync_playwright

    page_file = ROOT / "dist" / "sandbox" / ("%s.html" % name)
    if not page_file.exists():
        sys.exit("  %s has not been built — drop --no-build" % page_file)

    fails, rows = [], []

    def ok(label, cond, extra=""):
        if not cond:
            fails.append(label)
        print(("  ok   " if cond else "  FAIL "), label, extra)

    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1400, "height": 1000})
        pg.goto(page_file.as_uri(), wait_until="load")
        pg.wait_for_timeout(1200)
        if light:
            pg.evaluate("() => document.body.classList.add('light')")
            pg.wait_for_timeout(250)

        steps = pg.evaluate("() => STEPS.max")
        print("  %s · %d step(s)%s" % (name, steps + 1, " · light" if light else ""))

        for s in range(steps + 1):
            pg.evaluate("s => { STEPS.set(s); }", s)
            pg.wait_for_timeout(settle)
            m = pg.evaluate("""() => {
                const r = document.getElementById('root');
                // every descendant that spills its own box sideways
                const wide = [...r.querySelectorAll('*')]
                    .filter(e => e.scrollWidth - e.clientWidth > 1 && e.clientWidth > 0)
                    .map(e => (e.id || e.className || e.tagName) + ' +' +
                              (e.scrollWidth - e.clientWidth) + 'px');
                // the tallest thing sitting directly in the flex column, and how
                // far past the body bottom it reaches
                const top = r.getBoundingClientRect().top;
                const kids = [...r.children].map(e => {
                    const b = e.getBoundingClientRect();
                    return { what: e.id || e.className || e.tagName,
                             bottom: Math.round(b.bottom - top) };
                }).sort((a, b) => b.bottom - a.bottom);
                // scrollHeight is clamped to the box: it reports a spill but
                // never the room left over, so on its own it can only ever say
                // "0px clear". The lowest child edge gives both. scrollHeight
                // still has a job — it catches a spill from something that is
                // not a direct child, e.g. absolutely positioned.
                const edge = kids.length ? kids[0].bottom : 0;
                const spill = r.scrollHeight - r.clientHeight;
                return { used: spill > 0 ? Math.max(r.scrollHeight, edge) : edge,
                         box: r.clientHeight,
                         tallest: kids[0] || null, wide: wide.slice(0, 6) };
            }""")
            rows.append((s, m))
            over = m["used"] - m["box"]
            flag = "OVER by %dpx" % over if over > 0 else \
                   "%dpx clear" % (m["box"] - m["used"])
            print("     step %d  %4d / %d px  %-16s %s"
                  % (s, m["used"], m["box"], flag,
                     (m["tallest"] or {}).get("what", "")))
            for w in m["wide"]:
                print("             overflows sideways: %s" % w)

        if shot:
            out = pathlib.Path(shot)
            if not out.is_absolute():
                out = ROOT / out
            out.parent.mkdir(parents=True, exist_ok=True)
            pg.locator("#root").screenshot(path=str(out))
            print("\n  %s  (final step%s)" % (out, ", light" if light else ""))
        b.close()

    print()
    worst = max(rows, key=lambda r: r[1]["used"])
    used, box = worst[1]["used"], worst[1]["box"]
    ok("the body box is the %dpx a slide gives it" % BODY_H, box == BODY_H, "%dpx" % box)
    ok("no step overflows it", used <= box,
       "worst is step %d at %dpx%s" % (worst[0], used,
                                       "" if used <= box else " (+%d)" % (used - box)))
    ok("and keeps %dpx of slack for font fallback" % SLACK, used <= box - SLACK,
       "%dpx clear at step %d" % (box - used, worst[0]))
    ok("nothing overflows sideways", not any(r[1]["wide"] for r in rows))
    return fails


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name", help="component name, e.g. multi-head")
    ap.add_argument("--no-build", action="store_true", help="skip the rebuild")
    ap.add_argument("--no-test", action="store_true", help="skip the jsdom suite")
    ap.add_argument("--light", action="store_true", help="measure the light cut")
    ap.add_argument("--shot", nargs="?", const="", default=None,
                    help="write a PNG of the final step (default dist/shots/<name>.png)")
    a = ap.parse_args()

    src, lecture = locate(a.name)
    print("  %s  (%s)" % (src.relative_to(ROOT), lecture.relative_to(ROOT)))

    if not a.no_build:
        if not run("build", [sys.executable, "framework/build.py", str(lecture.relative_to(ROOT))]):
            sys.exit(1)

    suite = lecture / "test" / ("%s.checks.js" % a.name)
    if not a.no_test:
        if suite.exists():
            if not run(str(suite.relative_to(ROOT)), ["node", str(suite.relative_to(ROOT))]):
                sys.exit(1)
        else:
            print("\n== no suite at %s" % suite.relative_to(ROOT))

    shot = a.shot
    if shot == "":
        shot = "dist/shots/%s%s.png" % (a.name, "-light" if a.light else "")
    print("\n== layout, in a real browser")
    fails = measure(a.name, light=a.light, shot=shot)
    if fails:
        print("  FAILURES:", len(fails))
        sys.exit(1)


if __name__ == "__main__":
    main()
