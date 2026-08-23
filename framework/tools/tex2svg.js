/* Convert the deck's equations to standalone SVG with embedded glyph outlines.
 *
 *   node tools/tex2svg.js equations.tex.json equations.json
 *
 * SVG rather than KaTeX/MathJax at runtime, because the deck ships as one
 * self-contained HTML file: web fonts would have to be inlined too (~200 KB of
 * woff2), and any font that failed to load would silently break the maths. With
 * outlines there is nothing to load, it scales cleanly for the projector, and it
 * survives into the printed PDF.
 *
 * Colour is carried through \textcolor, so the role palette on the slides and the
 * symbols in the equations stay in step.
 */
const fs = require('fs');
const { mathjax } = require('mathjax-full/js/mathjax.js');
const { TeX } = require('mathjax-full/js/input/tex.js');
const { SVG } = require('mathjax-full/js/output/svg.js');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

const doc = mathjax.document('', {
  InputJax:  new TeX({ packages: AllPackages }),
  OutputJax: new SVG({ fontCache: 'local' })   // outlines inline, no external font
});

const [, , inPath, outPath] = process.argv;
const src = JSON.parse(fs.readFileSync(inPath, 'utf8'));

// role palette, kept in step with shared/tokens.css
const COLOURS = { rx:'3F4650', rk:'C0392B', rq:'237A3D', rv:'1F5FBF', ry:'16191D',
                  ra:'0E7C70', rs:'9A6510',
                  // dark-theme variants, used on screen
                  dx:'EDEBE4', dk:'E5544A', dq:'4FC86A', dv:'4F9BFF', dy:'FFFFFF',
                  da:'46D6C0', ds:'E7A44C' };
// MathJax's color package knows rgb / RGB / gray and named colours — not HTML,
// which it reports by rendering an error box rather than throwing. Hence RGB
// triples, and the guard below.
const rgb = hex => [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
const DEFS = Object.entries(COLOURS)
  .map(([k, v]) => `\\definecolor{${k}}{RGB}{${rgb(v)}}`).join('');

const out = {};
for (const [id, entry] of Object.entries(src)) {
  // an entry is either a TeX string (display style) or {tex, display:false}
  const tex = typeof entry === 'string' ? entry : entry.tex;
  const display = typeof entry === 'string' ? true : entry.display !== false;
  const node = doc.convert(DEFS + tex, { display });
  let svg = adaptor.innerHTML(node);
  const bad = svg.match(/data-mjx-error="([^"]*)"/);
  if (bad) { console.error(`\n${id}: MathJax error — ${bad[1]}`); process.exit(1); }
  if (!/<path /.test(svg)) { console.error(`\n${id}: no glyph outlines emitted`); process.exit(1); }
  // strip the wrapper's inline colour so the container can set it, keep the rest
  svg = svg.replace(/<svg /, '<svg role="img" aria-label="equation" ');
  out[id] = svg;
  process.stdout.write(`  ${id.padEnd(22)} ${(svg.length / 1024).toFixed(1)} KB\n`);
}
fs.writeFileSync(outPath, JSON.stringify(out));
process.stdout.write(`\n${Object.keys(out).length} equation(s) -> ${outPath}\n`);
