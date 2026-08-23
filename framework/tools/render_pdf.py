#!/usr/bin/env python3
"""
Render the built deck to a printable, light-mode PDF.

    python3 tools/render_pdf.py [--out dist/vision-transformers-print.pdf]

Loads dist/vision-transformers.html with ?print, which makes the deck initialise
every slide, run every interactive component to its final step, switch to the
light token set and lay all slides out down the page at 1280x720. Chromium then
prints it one slide per sheet.

Defaults to true A4 landscape: the 16:9 slide is scaled to the sheet width and
centred, leaving white bands top and bottom. Nothing reflows, so every layout
budget the components are checked against still holds. --paper native keeps the
deck's own 13.33 x 7.5 in page instead.

Needs: pip install playwright && python3 -m playwright install chromium
"""
import argparse, pathlib, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
DECK = ROOT / "dist" / "standalone" / "09-vit.html"   # overridden by --deck
W, H = 1280, 720                      # the deck's own stage, in CSS px
PT = 0.75                             # 1 CSS px at 96 dpi
SAFE = 0.995                          # keep a hair inside the page so nothing spills a blank sheet

# paper sizes in points, landscape
PAPER = {
    "native": None,
    "a4":     (841.89, 595.28),
    "letter": (792.0,  612.0),
}


def fit(paper):
    """Scale the 1280x720 stage onto a sheet and centre it.

    Returns (css, pdf_kwargs). The page box and its margins are set in CSS rather
    than through pdf(margin=...), because the deck ships its own `@page{margin:0}`
    and that wins over the parameters — which silently pushed the whole band to
    the bottom of the sheet the first time round.

    Nothing reflows: the slide renders at its own geometry and is shrunk, so every
    layout budget the components are checked against still holds."""
    if paper is None:
        return None, dict(width=f"{W}px", height=f"{H}px", prefer_css_page_size=True, scale=1)
    pw, ph = paper
    scale = min(pw / (W * PT), ph / (H * PT)) * SAFE
    used_w, used_h = W * PT * scale, H * PT * scale
    mx, my = (pw - used_w) / 2, (ph - used_h) / 2
    print("  paper %.2f x %.2f pt · scale %.1f%% · slide %.0f x %.0f pt · bands %.1f mm top/bottom, %.1f mm sides"
          % (pw, ph, scale * 100, used_w, used_h, my / 72 * 25.4, mx / 72 * 25.4))
    css = "@page{size:%.2fpt %.2fpt;margin:%.2fpt %.2fpt}" % (pw, ph, my, mx)
    return css, dict(prefer_css_page_size=True, scale=round(scale, 4))


def render(out: pathlib.Path, paper_name: str = "a4", settle: float = 3.0,
           deck: pathlib.Path = None):
    deck = deck or DECK
    from playwright.sync_api import sync_playwright

    if not deck.exists():
        sys.exit("build it first: python3 framework/build.py lectures/<id>")

    problems = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": W, "height": H})
        page.on("pageerror", lambda e: problems.append(str(e)))
        page.on("console", lambda m: problems.append(m.text) if m.type == "error" else None)

        page.goto(deck.as_uri() + "?print", wait_until="load")
        page.wait_for_timeout(int(settle * 1000))     # let transitions and canvases settle

        paper = PAPER[paper_name]
        css, pdf_args = fit(paper)
        if css:
            page.add_style_tag(content=css)   # last @page rule wins over the deck's

        state = page.evaluate("""() => ({
            slides:  document.querySelectorAll('.slide').length,
            active:  document.querySelectorAll('.slide.active').length,
            light:   document.body.classList.contains('light'),
            printall:document.body.classList.contains('printall'),
            frags:   document.querySelectorAll('.frag').length,
            fragsOn: document.querySelectorAll('.frag.on').length,
            steps:   [...document.querySelectorAll('.steps')]
                       .map(s => s.querySelectorAll('.s').length +
                                 '/' + s.querySelectorAll('.s.on').length),
            height:  document.getElementById('stage').getBoundingClientRect().height,
        })""")

        for label, ok in [
            ("light theme applied",      state["light"]),
            ("print layout applied",     state["printall"]),
            ("every slide laid out",     state["active"] == state["slides"]),
            ("every fragment revealed",  state["fragsOn"] == state["frags"]),
            ("every component finished", all(a == b for a, b in
                                             (s.split("/") for s in state["steps"]))),
            ("stage is the full stack",  abs(state["height"] - state["slides"] * H) < state["slides"] * 4),
        ]:
            print(("  ok   " if ok else "  FAIL ") + label)
            if not ok:
                problems.append(label)

        out.parent.mkdir(parents=True, exist_ok=True)
        page.pdf(path=str(out), print_background=True, **pdf_args)
        browser.close()

    if problems:
        print("\nissues:")
        for p_ in dict.fromkeys(problems):
            print("   ✗", p_)
    # drop a copy beside the published deck so the site can link it
    site = ROOT / "dist" / "site" / deck.stem
    if site.is_dir():
        shutil.copy(out, site / f"{deck.stem}-print.pdf")
    print("\n%s  %.1f MB" % (out.name, out.stat().st_size / 1024 / 1024))
    return not problems


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--deck", default=str(DECK))
    ap.add_argument("--out", default=None)
    ap.add_argument("--paper", choices=sorted(PAPER), default="a4",
                    help="a4 (default) and letter centre the 16:9 slide with white bands; "
                         "native keeps the deck's own 13.33 x 7.5 in sheet")
    ap.add_argument("--settle", type=float, default=3.0)
    a = ap.parse_args()
    deck = pathlib.Path(a.deck)
    out = pathlib.Path(a.out) if a.out else ROOT / "dist" / "pdf" / (deck.stem + "-print.pdf")
    sys.exit(0 if render(out, a.paper, a.settle, deck) else 1)
