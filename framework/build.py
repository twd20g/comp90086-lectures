#!/usr/bin/env python3
"""
Build one lecture deck from the framework plus that lecture's own sources.

    python3 framework/build.py lectures/09-vit          # all targets
    python3 framework/build.py lectures/09-vit --check  # checks only, no write
    python3 framework/build.py --all

Targets, all written under dist/:

    standalone/<slug>.html   one self-contained file, images inlined. For lecturing
                             from a laptop with no network, and for handing out.
    site/<slug>/index.html   the same deck with images as separate files. For
                             GitHub Pages: ~25% smaller (no base64 tax), paints
                             before the images arrive, and caches per image.
    sandbox/<name>.html      one standalone host per interactive component.

Layout
------
    framework/       shell.html · engine.js · chrome.css · tokens.css · primitives.css
                     sandbox/_harness.html · tools/ · test/ · fonts/
    lectures/<id>/   slides.html · interactives.js · deck.meta.json · assets.json
                     equations.tex.json · equations.json · components/ · lib/ · test/
    components/      components shared by more than one lecture

Every shared and component block is spliced verbatim into each target and then
checked byte-for-byte in the output, so a sandbox and a deck cannot drift, and
neither can two lectures built against the same framework.
"""
import base64, hashlib, json, pathlib, re, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FW = ROOT / "framework"
DIST = ROOT / "dist"
# where the decks sit inside the published site. Empty means the site root; set it
# with --prefix when the repository also publishes hand-written pages, so the decks
# live under e.g. /lectures/ and cannot collide with an existing index.html.
PREFIX = ""
SLIDE_BODY_H, SLIDE_BODY_W = 547, 1164


# ------------------------------------------------------------------ sources

def load_component(path):
    """A component file is three fenced blocks: css, markup, js."""
    txt = path.read_text()
    parts = re.split(r"<!-- ==== (css|markup|js) ==== -->\n", txt)
    blocks = {parts[i]: parts[i + 1].strip("\n") for i in range(1, len(parts), 2)}
    missing = {"css", "markup", "js"} - set(blocks)
    if missing:
        raise SystemExit(f"{path}: missing block(s) {sorted(missing)}")
    hdr = re.search(r"init:\s*(\w+)", parts[0])
    if not hdr:
        raise SystemExit(f"{path}: header must declare  init: <functionName>")
    title = re.search(r"title:\s*(.+)", parts[0])
    return {"name": path.stem, "init": hdr.group(1), "path": path,
            "title": title.group(1).strip() if title else path.stem, **blocks}


class Lecture:
    def __init__(self, d):
        self.dir = pathlib.Path(d).resolve()
        if not (self.dir / "deck.meta.json").exists():
            raise SystemExit(f"{d}: not a lecture (no deck.meta.json)")
        self.meta = json.loads((self.dir / "deck.meta.json").read_text())
        self.slug = self.meta.get("slug", self.dir.name)
        self.assets = json.loads((self.dir / self.meta["assets"]).read_text())
        eq = self.dir / "equations.json"
        self.equations = json.loads(eq.read_text()) if eq.exists() else {}
        # a lecture's own components, plus any it lists from the shared pool
        self.components = [load_component(p) for p in sorted((self.dir / "components").glob("*.html"))]
        for name in self.meta.get("sharedComponents", []):
            self.components.append(load_component(ROOT / "components" / f"{name}.html"))
        self.lib = "\n\n".join(p.read_text().strip()
                               for p in sorted((self.dir / "lib").glob("*.js")))
        self.slides = (self.dir / "slides.html").read_text()
        self.interactives = (self.dir / "interactives.js").read_text()


FRAMEWORK = {k: (FW / f"{k}.css").read_text() if k != "engine" else (FW / "engine.js").read_text()
             for k in ("tokens", "primitives", "chrome", "engine")}


def font_block():
    """Self-hosted woff2 if present, otherwise the Google Fonts stylesheet.

    Self-hosting matters more than it looks: a captive-portal network in a lecture
    theatre silently costs you the typography, and the PDF renderer has no network
    at all. Drop the woff2 files into framework/fonts/ and this switches over."""
    files = sorted(FW.glob("fonts/*.woff2"))
    if not files:
        return ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
                '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
                '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700'
                '&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;450;500;600&display=swap"'
                ' rel="stylesheet">')
    faces = []
    for f in files:
        fam, weight = f.stem.rsplit("-", 1)
        uri = "data:font/woff2;base64," + base64.b64encode(f.read_bytes()).decode()
        faces.append("@font-face{font-family:'%s';font-style:normal;font-weight:%s;"
                     "font-display:swap;src:url(%s) format('woff2')}"
                     % (fam.replace("_", " "), weight, uri))
    return "<style>\n" + "\n".join(faces) + "\n</style>"


# ------------------------------------------------------------------ splicing

def assets_needed(js, available, where):
    """Which assets this JS actually reads.

    Three forms, because all three are in use: ASSETS.key, ASSETS['key'], and
    ASSETS['prefix' + i] for a numbered set. The last one used to be invisible
    here, so a component that loaded ASSETS['ex' + i] got no images in the deck
    and silently never drew — the sandbox was fine, which made it worse."""
    keys = set(re.findall(r"ASSETS\.(\w+)", js))
    keys |= set(re.findall(r"ASSETS\[['\"](\w+)['\"]\]", js))
    for prefix in re.findall(r"ASSETS\[['\"](\w+)['\"]\s*\+", js):
        family = {k for k in available if k.startswith(prefix) and k != prefix}
        if not family:
            raise SystemExit("%s: js reads ASSETS['%s' + …] and assets.json has "
                             "nothing starting with %s" % (where, prefix, prefix))
        keys |= family
    missing = sorted(k for k in keys if k not in available)
    if missing:
        raise SystemExit("%s: js reads ASSETS.%s, which is not in assets.json"
                         % (where, missing[0]))
    return sorted(keys)


def inject(text, marker, block, where):
    n = text.count(marker)
    if n != 1:
        raise SystemExit(f"{where}: expected 1 '{marker}', found {n}")
    return text.replace(marker, block)


def assemble(lec, inline_images=True):
    t = FW.joinpath("shell.html").read_text()
    for key in ("tokens", "primitives", "chrome"):
        t = inject(t, "/* @inject framework:%s */" % key, FRAMEWORK[key], "deck")
    t = inject(t, "// @inject framework:engine", FRAMEWORK["engine"], "deck")
    t = inject(t, "<!-- @inject framework:fonts -->", font_block(), "deck")
    t = inject(t, "/* @inject components:css */",
               "\n\n".join("/* ---- component: %s ---- */\n%s" % (c["name"], c["css"])
                           for c in lec.components), "deck")
    t = inject(t, "// @inject components:js", "\n\n".join(c["js"] for c in lec.components), "deck")
    t = inject(t, "// @inject lecture:lib", lec.lib, "deck")
    t = inject(t, "// @inject lecture:interactives", lec.interactives, "deck")
    t = inject(t, "<!-- @inject lecture:slides -->", lec.slides, "deck")
    for c in lec.components:
        t = inject(t, "<!-- @inject component:%s/markup -->" % c["name"], c["markup"], "deck")

    files = {}
    assets = dict(lec.assets)
    if not inline_images:
        for key, uri in list(assets.items()):
            m = re.match(r"data:image/(\w+);base64,(.*)$", uri)
            if not m:
                continue
            ext, b64 = m.groups()
            name = f"assets/{key}.{'jpg' if ext == 'jpeg' else ext}"
            files[name] = base64.b64decode(b64)
            assets[key] = name

    t = t.replace("__PRESENTER__", lec.meta["presenter"])
    t = t.replace("__TITLE__", lec.meta.get("title", lec.slug))
    t = t.replace("__COURSE__", lec.meta.get("course", ""))
    t = t.replace("__SUBTITLE__", lec.meta.get("subtitle", ""))
    # Only the assets the JS actually reads go into the ASSETS object — the rest are
    # already inlined at their __KEY__ placeholders, and duplicating them here would
    # double the size of the standalone build.
    js = lec.lib + lec.interactives + "".join(c["js"] for c in lec.components)
    needed = assets_needed(js, assets, "deck")
    t = t.replace("__ASSETS__", json.dumps({k: assets[k] for k in needed}))
    for key, uri in assets.items():
        t = t.replace("__%s__" % key.upper(), uri)
    for key, svg in lec.equations.items():
        t = t.replace("__EQ_%s__" % key.upper(), svg)

    left = set(re.findall(r"__[A-Z_]+__", t)) | set(re.findall(r"@inject [\w:/-]+", t))
    if left:
        raise SystemExit("deck: unresolved placeholders %s" % sorted(left))
    return t, files


def assemble_sandbox(lec, c):
    t = FW.joinpath("sandbox/_harness.html").read_text()
    for key, marker in (("tokens", "/* @inject shared:tokens */"),
                        ("primitives", "/* @inject shared:primitives */")):
        t = inject(t, marker, FRAMEWORK[key], "sandbox/" + c["name"])
    t = inject(t, "// @inject shared:patch-source", lec.lib, "sandbox/" + c["name"])
    t = inject(t, "/* @inject components:css */", c["css"], "sandbox/" + c["name"])
    t = inject(t, "// @inject components:js", c["js"], "sandbox/" + c["name"])
    t = inject(t, "<!-- @inject component:__NAME__/markup -->", c["markup"], "sandbox/" + c["name"])
    # The sandbox gets exactly the assets this component's js reads — the same
    # rule the deck uses. It used to get one hardcoded key, which meant the
    # harness only worked for the lecture that happened to define it.
    needed = assets_needed(lec.lib + c["js"], lec.assets, "sandbox " + c["name"])
    t = (t.replace("__NAME__", c["name"]).replace("__TITLE__", c["title"])
          .replace("__INIT__", c["init"])
          .replace("__ASSETS__", json.dumps({k: lec.assets[k] for k in needed})))
    # a component may carry an equation of its own; the deck resolved these and
    # the sandbox did not, so the same component built in one target and failed
    # the placeholder guard in the other
    for key, svg in lec.equations.items():
        t = t.replace("__EQ_%s__" % key.upper(), svg)
    left = set(re.findall(r"__[A-Z_]+__", t)) | set(re.findall(r"@inject [\w:/-]+", t))
    if left:
        raise SystemExit("sandbox %s: unresolved placeholders %s" % (c["name"], sorted(left)))
    return t


# ------------------------------------------------------------------ checks

def layout_check(lec):
    """A component's fixed-size stage must not be shrinkable: the slide body is a
    flex column, and a squashed stage lets its absolutely-positioned contents spill
    over whatever follows. flex:none turns that silent corruption into overflow,
    and the ceiling stops it happening at all."""
    problems = []
    for c in lec.components:
        for rule in re.finditer(r"\.([\w-]*stage|[\w-]*wrap)\s*\{([^}]*)\}", c["css"]):
            name, body = rule.group(1), rule.group(2)
            if "height:" in body and "flex:none" not in body:
                problems.append("%s: .%s has a fixed height but no flex:none" % (c["name"], name))
            h = re.search(r"height:(\d+)px", body)
            if h:
                reserve, extras = 50, []
                if re.search(r'class="[^"]*(foot|note)', c["markup"]):
                    reserve += 55; extras.append("a note")
                if re.search(r'<ul class="b"', c["markup"]):
                    reserve += 40; extras.append("bullets")
                if int(h.group(1)) > SLIDE_BODY_H - reserve:
                    problems.append("%s: .%s is %spx, leaving under %dpx for the step chips%s"
                                    % (c["name"], name, h.group(1), reserve,
                                       " and " + " and ".join(extras) if extras else ""))
            w = re.search(r"width:(\d+)px", body)
            if w and int(w.group(1)) > SLIDE_BODY_W:
                problems.append("%s: .%s is %spx wide, slide body is %dpx"
                                % (c["name"], name, w.group(1), SLIDE_BODY_W))
    return problems


def drift_check(lec, targets):
    fails = []
    def want(hay, needle, label):
        if needle.strip() and needle not in hay:
            fails.append(label)
    deck = targets["deck"]
    for key, body in FRAMEWORK.items():
        want(deck, body, "deck ⇄ framework/%s" % key)
    for name, sb in targets["sandboxes"].items():
        for key in ("tokens", "primitives"):
            want(sb, FRAMEWORK[key], "sandbox:%s ⇄ framework/%s" % (name, key))
        want(sb, lec.lib, "sandbox:%s ⇄ lecture lib" % name)
    want(deck, lec.lib, "deck ⇄ lecture lib")
    # A component block may carry an equation placeholder. Every target resolves
    # those the same way, so the honest comparison is against what was injected,
    # not against the raw source — otherwise the substitution itself reads as
    # drift and the check fires on a component that is in fact identical
    # everywhere.
    def resolved(block):
        for key, svg in lec.equations.items():
            block = block.replace("__EQ_%s__" % key.upper(), svg)
        return block
    for c in lec.components:
        for blk in ("css", "markup", "js"):
            want(deck, resolved(c[blk]), "deck ⇄ %s/%s" % (c["name"], blk))
            want(targets["sandboxes"][c["name"]], resolved(c[blk]),
                 "sandbox:%s ⇄ %s/%s" % (c["name"], c["name"], blk))
    return fails


# ------------------------------------------------------------------ main

def build(lecture_dir, check_only=False):
    lec = Lecture(lecture_dir)
    print("\n%s  (%s)" % (lec.slug, lec.dir.relative_to(ROOT)))

    problems = layout_check(lec)
    if problems:
        print("LAYOUT PROBLEMS:")
        for p in problems:
            print("   ✗", p)
        raise SystemExit(1)
    print("  layout check: every fixed stage is flex:none and fits the %dpx slide body" % SLIDE_BODY_H)

    standalone, _ = assemble(lec, inline_images=True)
    site, files = assemble(lec, inline_images=False)
    sandboxes = {c["name"]: assemble_sandbox(lec, c) for c in lec.components}

    fails = drift_check(lec, {"deck": standalone, "sandboxes": sandboxes})
    if fails:
        print("DRIFT DETECTED:")
        for f in fails:
            print("   ✗", f)
        raise SystemExit(1)
    print("  drift check: %d framework + 1 lib + %d component(s) byte-identical across %d target(s)"
          % (len(FRAMEWORK), len(lec.components), 2 + len(sandboxes)))

    if check_only:
        return
    out = []
    site_root().mkdir(parents=True, exist_ok=True)
    (DIST / "standalone").mkdir(parents=True, exist_ok=True)
    p = DIST / "standalone" / f"{lec.slug}.html"; p.write_text(standalone); out.append((p, standalone))
    sd = site_root() / lec.slug
    (sd / "assets").mkdir(parents=True, exist_ok=True)
    p = sd / "index.html"; p.write_text(site); out.append((p, site))
    for name, blob in files.items():
        (sd / name).write_bytes(blob)
    # the published page is the split build; the single file goes alongside it so
    # students can take the deck offline, and render_pdf.py drops the PDF here too
    (sd / f"{lec.slug}-offline.html").write_text(standalone)
    (DIST / "sandbox").mkdir(parents=True, exist_ok=True)
    for name, body in sandboxes.items():
        p = DIST / "sandbox" / f"{name}.html"; p.write_text(body); out.append((p, body))

    for path, body in out:
        print("  %-46s %7.1f KB  %s" % (path.relative_to(DIST), len(body) / 1024,
                                        hashlib.sha1(body.encode()).hexdigest()[:10]))
    print("  %-46s %7.1f KB  in %d file(s)"
          % (str((sd / "assets").relative_to(DIST)) + "/",
             sum(len(b) for b in files.values()) / 1024, len(files)))


def site_root():
    return DIST / "site" / PREFIX if PREFIX else DIST / "site"


def copy_static(src):
    """Copy hand-written pages into the site before the decks are added.

    A repository usually has only one Pages source, so a site that mixes prebuilt
    pages with generated ones has to assemble both in the workflow. Everything in
    `src` lands at the site root with its paths unchanged, so existing URLs survive."""
    src = pathlib.Path(src)
    if not src.is_dir():
        raise SystemExit("--static %s: not a directory" % src)
    (DIST / "site").mkdir(parents=True, exist_ok=True)
    n = 0
    for f in src.rglob("*"):
        if f.is_file():
            dst = DIST / "site" / f.relative_to(src)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, dst); n += 1
    print("static: %d file(s) from %s" % (n, src))


def main():
    global PREFIX
    argv = sys.argv[1:]
    def opt(name):
        if name in argv:
            i = argv.index(name)
            return argv[i + 1]
        return None
    PREFIX = (opt("--prefix") or "").strip("/")
    static = opt("--static")
    args = [a for a in argv if not a.startswith("--")]
    for v in (PREFIX, static):
        if v in args:
            args.remove(v)
    check = "--check" in argv
    dirs = ([p.parent for p in sorted(ROOT.glob("lectures/*/deck.meta.json"))]
            if ("--all" in sys.argv or not args) else args)
    if static and not check:
        copy_static(static)
    for d in dirs:
        build(d, check)
    if not check:
        write_index(dirs)
        # the artifact is served as-is, but this is free insurance against any
        # Jekyll processing swallowing files that begin with an underscore
        (DIST / "site" / ".nojekyll").write_text("")


def write_index(dirs):
    rows = []
    for d in dirs:
        m = json.loads((pathlib.Path(d) / "deck.meta.json").read_text())
        slug = m.get("slug", pathlib.Path(d).name)
        links = ['<a href="%s/">%s</a>' % (slug, m.get("title", slug))]
        extras = ['<a class="dl" href="%s/%s-print.pdf">pdf</a>' % (slug, slug)] \
                 if (site_root() / slug / f"{slug}-print.pdf").exists() else []
        extras.append('<a class="dl" href="%s/%s-offline.html">offline</a>' % (slug, slug))
        rows.append('<li>%s<span>%s</span>%s</li>'
                    % (links[0], m.get("subtitle", ""), " ".join(extras)))
    site_root().mkdir(parents=True, exist_ok=True)
    (site_root() / "index.html").write_text(
        "<!doctype html><meta charset=utf-8><title>COMP90086 lectures</title>"
        "<style>body{background:#10141a;color:#edebe4;font:16px/1.6 system-ui;"
        "max-width:44rem;margin:12vh auto;padding:0 6vw}h1{font-weight:600;letter-spacing:-.02em}"
        "ul{list-style:none;padding:0}li{padding:.7rem 0;border-bottom:1px solid #2a3340;"
        "display:flex;gap:1rem;align-items:baseline}a{color:#46d6c0;text-decoration:none}"
        "a:hover{text-decoration:underline}span{color:#7e8996;font-size:.85em;margin-left:auto}"
        "a.dl{color:#7e8996;font-size:.8em;border:1px solid #2a3340;border-radius:5px;"
        "padding:.15rem .5rem;margin-left:.6rem}a.dl:hover{color:#46d6c0;border-color:#46d6c0;"
        "text-decoration:none}</style>"
        "<h1>COMP90086 Computer Vision</h1><ul>" + "".join(rows) + "</ul>")
    print("\n%s  %d lecture(s)" % ((site_root() / "index.html").relative_to(DIST), len(rows)))


if __name__ == "__main__":
    main()
