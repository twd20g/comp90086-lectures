#!/usr/bin/env python3
"""
The inner loop for working on one component: build, test, measure, screenshot.

    python3 framework/tools/check_component.py multi-head
    python3 framework/tools/check_component.py multi-head --shot        # + a PNG
    python3 framework/tools/check_component.py multi-head --light       # light cut
    python3 framework/tools/check_component.py multi-head --no-build    # skip the build

If the lecture has test/<name>.browser.js, its assertions are evaluated in the
page too — for claims that depend on pixels, which jsdom cannot see.

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

**Overruns come in two sizes.** The body is not the edge of the slide. Below it
are 11 px of empty space before the footer and 52 px before the stage clips;
either side are 58 px of slide margin. A component a few pixels over is drawn
exactly as intended, so that is a warning; past the clear space it collides or is
clipped, and that is a failure. Only failures set the exit code.

Two sideways checks, because they ask different questions: whether an element
spills its own box (measured in layout units, and skipped for transformed
elements — a 72 px canvas scaled into a 60 px tile is not an overflow), and
whether anything renders past the stage edge (measured on rendered boxes, which
is what the audience would actually see).

Needs: pip install playwright && python3 -m playwright install chromium
"""
import argparse, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
BODY_H = 547                  # the slide body box the sandbox reproduces

# Below the body there is real, empty, visible space before anything goes wrong.
# Measured on a built deck at 1280x720: body bottom 668, footer top 679, stage
# bottom 720. So a component may run 11px past the body and still sit in clear
# air; past that it is over the footer, and past 52px the stage clips it.
FOOTER_GAP = 11               # visible slack below the body, before the footer
SIDE_PAD = 58                 # the slide's side padding: visible slack either side
SLACK = 20                    # advisory headroom: font fallback moves text


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


def browser_suite(lecture, name):
    """A component's optional in-page assertions.

    jsdom cannot see pixels, so a component whose numbers are computed from an
    image — the contrastive matrix, say — cannot have its central claim checked
    in a jsdom suite. test/browser/<name>.js is a JS expression evaluated in the
    real page; it returns [{label, ok, detail}] and is run here, at the last
    step, alongside the layout measurements.

    It lives under test/browser/ rather than beside the jsdom suites because
    `npm test` globs test/*.js and runs them under node, where `document` does
    not exist."""
    f = lecture / "test" / "browser" / ("%s.js" % name)
    return f.read_text() if f.exists() else None


def measure(name, light=False, shot=None, settle=450, suite=None):
    """Drive the sandbox through every step and measure the slide body box."""
    from playwright.sync_api import sync_playwright

    page_file = ROOT / "dist" / "sandbox" / ("%s.html" % name)
    if not page_file.exists():
        sys.exit("  %s has not been built — drop --no-build" % page_file)

    fails, warns, rows = [], [], []

    def ok(label, cond, extra=""):
        if not cond:
            fails.append(label)
        print(("  ok   " if cond else "  FAIL "), label, extra)

    def warn(label, extra=""):
        """Worth knowing, not worth blocking on — see FOOTER_GAP."""
        warns.append(label)
        print("  warn ", label, extra)

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
                // an SVG element's className is an SVGAnimatedString, not a string
                const name = e => {
                    const c = typeof e.className === 'string' ? e.className : '';
                    return (e.id || c || e.tagName).toString().slice(0, 26);
                };
                // Spilling its own box sideways — but scrollWidth is measured in
                // layout units, and a transform is not a layout. A 72px canvas
                // scaled into a 60px tile reports +12px and renders perfectly, so
                // transformed elements are judged on their rendered box instead.
                const wide = [...r.querySelectorAll('*')]
                    .filter(e => e.clientWidth > 0 &&
                                 e.scrollWidth - e.clientWidth > 1 &&
                                 getComputedStyle(e).transform === 'none')
                    .map(e => name(e) + ' +' + (e.scrollWidth - e.clientWidth) + 'px');
                // and anything actually rendering outside the stage, transforms
                // and all — this is the one the audience would see
                const rb = r.getBoundingClientRect();
                const seen = {};
                [...r.querySelectorAll('*')]
                    .map(e => [e, e.getBoundingClientRect()])
                    .filter(([e, b]) => b.width > 0 &&
                                        (b.right > rb.right + 1 || b.left < rb.left - 1))
                    .forEach(([e, b]) => {
                        const side = b.right > rb.right ? 'right' : 'left';
                        const by = Math.round(side === 'right' ? b.right - rb.right
                                                              : rb.left - b.left);
                        const k = name(e) + ' ' + side;
                        seen[k] = Math.max(seen[k] || 0, by);   // 64 identical dots is not 64 findings
                    });
                const past = Object.entries(seen)
                    .map(([k, by]) => ({ what: k, by }))
                    .sort((a, b) => b.by - a.by);
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
                         tallest: kids[0] || null,
                         wide: wide.slice(0, 6), past: past.slice(0, 6) };
            }""")
            rows.append((s, m))
            over = m["used"] - m["box"]
            flag = "OVER by %dpx" % over if over > 0 else \
                   "%dpx clear" % (m["box"] - m["used"])
            print("     step %d  %4d / %d px  %-16s %s"
                  % (s, m["used"], m["box"], flag,
                     (m["tallest"] or {}).get("what", "")))
            for w in m["wide"]:
                print("             spills its own box: %s" % w)
            for w in m["past"]:
                print("             past the stage edge: %s +%dpx" % (w["what"], w["by"]))

        if suite:
            print("\n  -- test/browser/%s.js, at the last step --" % name)
            try:
                for r in pg.evaluate(suite):
                    ok(r["label"], r["ok"], r.get("detail", ""))
            except Exception as e:
                ok("the browser suite runs", False, str(e).splitlines()[0][:120])

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
    over = used - box
    ok("the body box is the %dpx a slide gives it" % BODY_H, box == BODY_H, "%dpx" % box)
    if over <= 0:
        ok("no step overflows the body", True,
           "worst is step %d at %dpx" % (worst[0], used))
    elif over <= FOOTER_GAP:
        # it is past the body but still in the clear space above the footer, so
        # the audience sees it laid out exactly as intended
        ok("no step reaches the footer", True,
           "worst is step %d, +%dpx into the %dpx below the body" % (worst[0], over, FOOTER_GAP))
        warn("a step runs past the body, into the space below it",
             "+%dpx at step %d — visible, and %dpx clear of the footer"
             % (over, worst[0], FOOTER_GAP - over))
    else:
        ok("no step reaches the footer", False,
           "step %d is +%dpx, past the %dpx of clear space" % (worst[0], over, FOOTER_GAP))

    if used <= box - SLACK:
        ok("and keeps %dpx of slack for font fallback" % SLACK,
           True, "%dpx clear at step %d" % (box - used, worst[0]))
    else:
        warn("under %dpx of slack for font fallback" % SLACK,
             "%dpx at step %d" % (box - used, worst[0]))
    # Same rule as the vertical case: still on screen and colliding with nothing
    # is a warning, not a failure. A marker centred on the stage edge spills its
    # own radius, and the slide has SIDE_PAD of margin for it to spill into.
    # one finding per element, not one per element per step
    merged = {}
    for r in rows:
        for w in r[1]["past"]:
            merged[w["what"]] = max(merged.get(w["what"], 0), w["by"])
    spills = [{"what": k, "by": v} for k, v in
              sorted(merged.items(), key=lambda kv: -kv[1])]
    worst_side = max([w["by"] for w in spills], default=0)
    if not spills:
        ok("nothing renders outside the stage", True)
    elif worst_side <= SIDE_PAD:
        ok("nothing is clipped at the stage edge", True,
           "worst +%dpx into %dpx of slide margin" % (worst_side, SIDE_PAD))
        warn("something renders past the stage edge",
             "; ".join("%s +%dpx" % (w["what"], w["by"]) for w in spills[:3]))
    else:
        ok("nothing is clipped at the stage edge", False,
           "; ".join("%s +%dpx" % (w["what"], w["by"]) for w in spills[:3]))
    ok("nothing spills its own box sideways", not any(r[1]["wide"] for r in rows),
       "; ".join(sorted({w for r in rows for w in r[1]["wide"]})))
    return fails, warns


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
    fails, warns = measure(a.name, light=a.light, shot=shot,
                           suite=None if a.no_test else browser_suite(lecture, a.name))
    if warns:
        print("  WARNINGS:", len(warns))
        for w in warns:
            print("    ·", w)
    if fails:
        print("  FAILURES:", len(fails))
        sys.exit(1)


if __name__ == "__main__":
    main()
