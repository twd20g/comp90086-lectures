/* Checks on components/cls-decomposition.html.

   The slide's whole claim is a shape claim: the tensor is a grid, and the
   paper's two contractions are the grid's two directions. So the checks are
   about counts and axes — 80 boxes become 16 when the columns fold and 5 when
   the rows fold — and about which axis is named as surviving each time.

   That asymmetry is what students get wrong: summing over patches keeps TWO
   indices (layer and head), summing the other way sums over TWO (heads and
   layers) and keeps one. The panel wording is asserted for that reason.

   Run: node test/cls-decomposition.checks.js                                  */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','cls-decomposition.html');

const L = 4, H = 4, P = 5, LAST = 5;
const errs = [], fails = [];
const dom = new JSDOM(fs.readFileSync(FILE,'utf8'), {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){ w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message)); }});
const d = dom.window.document;
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };

setTimeout(() => {
  const css = fs.readFileSync(FILE,'utf8');
  const to = k => { for(let i=0;i<8;i++) d.getElementById('sbPrev').click();
                    for(let i=0;i<k;i++) d.getElementById('sbNext').click(); };
  const lit = () => [...d.querySelectorAll('.cd-y')].filter(e => e.style.opacity === '1');
  const shape = () => { const v = lit();
    return { n: v.length,
             cols: new Set(v.map(e => e.style.left)).size,
             rows: new Set(v.map(e => e.style.top)).size }; };

  console.log('--- the grid is heads and layers across, patches down ---');
  ok('one box per (patch, head, layer)',
     d.querySelectorAll('.cd-y').length === L*H*P, d.querySelectorAll('.cd-y').length);
  ok('one addition per head, and one per layer for its MLP',
     d.querySelectorAll('.cd-add').length === L*H + L &&
     d.querySelectorAll('.cd-add.mlp').length === L,
     d.querySelectorAll('.cd-add').length + ' total, ' +
     d.querySelectorAll('.cd-add.mlp').length + ' of them MLP');
  ok('the MLPs are drawn as blocks above the stream, one per layer',
     [...d.querySelectorAll('.cd-mlp')].map(e => e.textContent.trim()).join('|') ===
       'MLP1|MLP2|MLP3|MLP4',
     [...d.querySelectorAll('.cd-mlp')].map(e => e.textContent.trim()).join('|'));
  ok('each MLP block sits above the line its ⊕ is on',
     [...d.querySelectorAll('.cd-mlp')].every(m =>
       parseFloat(m.style.top) + 22 <= 64));

  console.log('--- every box names itself, in the equation\'s notation ---');
  const boxAt = (p, h, l) => d.querySelector(
    `.cd-y[data-p="${p}"][data-h="${h}"][data-l="${l}"]`).textContent.trim();
  ok('the first box is y 1,1,1',        boxAt(0,0,0) === 'y1,1,1', boxAt(0,0,0));
  ok('the one below it is y 2,1,1 — the patch index moves down',
     boxAt(1,0,0) === 'y2,1,1', boxAt(1,0,0));
  ok('the one beside it is y 1,2,1 — the head index moves across',
     boxAt(0,1,0) === 'y1,2,1', boxAt(0,1,0));
  ok('and the next layer along is y 1,1,2',
     boxAt(0,0,1) === 'y1,1,2', boxAt(0,0,1));
  ok('the layers are numbered from 1, matching the equation\'s l = 1 … L',
     [...d.querySelectorAll('.cd-lab.layer')].map(e => e.textContent.trim()).join('|') ===
       'layer 1|layer 2|layer 3|layer 4',
     [...d.querySelectorAll('.cd-lab.layer')].map(e => e.textContent.trim()).join('|'));
  ok('every label fits its box', [...d.querySelectorAll('.cd-y')]
     .every(b => b.innerHTML.startsWith('y<sub>')));
  ok('every ⊕ really is a plus', [...d.querySelectorAll('.cd-add')]
     .every(e => e.textContent.trim() === '⊕'));
  ok('four heads under each layer',
     d.querySelectorAll('.cd-lab.head').length === L*H);
  ok('a row per patch, plus the class token\'s own row',
     d.querySelectorAll('.cd-lab.row').length === P + 1);
  ok('the stream is named at both ends: x⁰ in, x out',
     d.querySelector('.cd-lab.cls').textContent.replace(/\s/g,'') === 'x0CLS' &&
     d.querySelector('.cd-lab.out').textContent.replace(/\s/g,'') === 'xCLS',
     d.querySelector('.cd-lab.cls').textContent.trim() + ' … ' +
     d.querySelector('.cd-lab.out').textContent.trim());
  ok('and both are actually shown — a label built but never lit is invisible',
     d.querySelector('.cd-lab.cls').classList.contains('on') &&
     d.querySelector('.cd-lab.out').classList.contains('on'));
  ok('the input label matches the base term of the equation',
     /<sup>0<\/sup>/.test(d.querySelector('.cd-lab.cls').innerHTML));

  console.log('--- the tensor, and then its two contractions ---');
  to(2);  const full = shape();
  console.log('          full   ', JSON.stringify(full));
  ok('all ' + L*H*P + ' contributions are shown', full.n === L*H*P, full.n);
  ok('in ' + L*H + ' columns — one per head, per layer', full.cols === L*H, full.cols);
  ok('and ' + P + ' rows — one per patch', full.rows === P, full.rows);

  to(3);  const byHead = shape();
  console.log('          columns fold', JSON.stringify(byHead));
  ok('summing over patches leaves one per (layer, head)', byHead.n === L*H, byHead.n);
  ok('laid out along the horizontal axis, in a single row',
     byHead.cols === L*H && byHead.rows === 1, byHead.cols + ' cols, ' + byHead.rows + ' row');

  to(4);  const byToken = shape();
  console.log('          rows fold   ', JSON.stringify(byToken));
  ok('summing over heads and layers leaves one per patch', byToken.n === P, byToken.n);
  ok('laid out down the vertical axis, in a single column',
     byToken.cols === 1 && byToken.rows === P, byToken.cols + ' col, ' + byToken.rows + ' rows');
  ok('the two contractions really do differ — 16 against 5',
     byHead.n !== byToken.n && byHead.n === L*H && byToken.n === P);

  console.log('--- a summed box says so, with a colon per summed index ---');
  to(2);
  ok('before any sum, the full index', boxAt(0,0,0) === 'y1,1,1', boxAt(0,0,0));
  to(3);
  const litAt = () => [...d.querySelectorAll('.cd-y')].filter(e => e.style.opacity === '1');
  ok('summing over patches puts the colon first: y:,h,l',
     litAt().every(e => /^y:,\d,\d$/.test(e.textContent)), litAt()[0].textContent);
  to(4);
  ok('summing over heads and layers puts two colons last: y i,:,:',
     litAt().every(e => /^y\d,:,:$/.test(e.textContent)), litAt()[0].textContent);
  ok('the two shorthands differ, so the label says which sum produced it',
     /^y:,/.test('y:,1,1') && /,:,:$/.test(litAt()[0].textContent));
  ok('and every label still fits its box',
     litAt().every(e => e.innerHTML.startsWith('y<sub>')));

  console.log('--- each contraction names the axis it keeps ---');
  to(3);
  let panel = d.querySelector('.cd-panel.on');
  ok('the patch sum is written Σ over i', /Σ.*<sub>i<\/sub>/.test(panel.innerHTML));
  ok('and says it keeps layer and head',
     /keeps layer and head/.test(panel.textContent), panel.textContent.trim());
  const rowsHot = () => [...d.querySelectorAll('.cd-lab.row:not(.cls):not(.out)')]
                          .every(e => e.classList.contains('hot'));
  ok('the surviving axis is highlighted, the folded one is not',
     d.querySelector('.cd-lab.across').classList.contains('hot') && !rowsHot());
  to(4);
  panel = d.querySelector('.cd-panel.on');
  ok('the other sums over BOTH l and h',
     /Σ.*<sub>l<\/sub>/.test(panel.innerHTML) && /Σ.*<sub>h<\/sub>/.test(panel.innerHTML),
     panel.querySelector('.sym').textContent.trim());
  ok('and says it keeps the patch',
     /keeps the patch/.test(panel.textContent), panel.textContent.trim());
  ok('now the vertical axis is the highlighted one — the patch labels',
     rowsHot() && !d.querySelector('.cd-lab.across').classList.contains('hot'));
  ok('only one panel is ever shown', d.querySelectorAll('.cd-panel.on').length === 1);

  console.log('--- contributions reach the ⊕ rather than stopping short ---');
  const plus0 = [...d.querySelectorAll('.cd-add:not(.mlp)')][0];
  const plusMid = parseFloat(plus0.style.top) + 24/2;
  const trunks = [...d.querySelectorAll('#cdStage line[data-trunk]')];
  ok('every column trunk ends on the centre of its ⊕',
     trunks.every(t => Math.abs(+t.getAttribute('y2') - plusMid) < 0.5),
     'trunk y2 ' + trunks[0].getAttribute('y2') + ', ⊕ centre ' + plusMid);
  const drops = [...d.querySelectorAll('#cdStage line[data-mlpdrop]')];
  ok('and every MLP drop does too',
     drops.every(t => Math.abs(+t.getAttribute('y2') - plusMid) < 0.5),
     'drop y2 ' + drops[0].getAttribute('y2'));

  console.log('--- the additions sit in the gutter, not over the column ---');
  const box0 = d.querySelector('.cd-y[data-p="0"][data-h="0"][data-l="0"]');
  const add0 = [...d.querySelectorAll('.cd-add:not(.mlp)')][0];
  const bx = parseFloat(box0.style.left), bw = parseFloat(box0.style.width || 42);
  // the ⊕'s box is 24px wide and the glyph is centred in it, so compare centres:
  // the left edge legitimately overlaps the column by a few pixels
  const ac = parseFloat(add0.style.left) + parseFloat(add0.style.width) / 2;
  ok('the first ⊕ sits in the gutter, past the end of its column',
     ac > bx + bw, '⊕ centre ' + ac + ', column ends at ' + (bx + bw));
  ok('and its feeds leave the box sideways, not upward',
     [...d.querySelectorAll('#cdStage path[data-k="feed"]')].length === L*H*P,
     d.querySelectorAll('#cdStage path[data-k="feed"]').length + ' feeds');
  ok('each column has a trunk for them to join',
     d.querySelectorAll('#cdStage line[data-trunk]').length === L*H);

  console.log('--- and the paper\'s name for each is given ---');
  to(3);
  ok('the patch sum is c_head in the paper',
     /the paper calls this c/.test(d.querySelector('.cd-panel.on').textContent) &&
     /head/.test(d.querySelector('.cd-panel.on .paper').textContent),
     d.querySelector('.cd-panel.on .paper').textContent.trim());
  to(4);
  ok('and the other is c_token',
     /token/.test(d.querySelector('.cd-panel.on .paper').textContent),
     d.querySelector('.cd-panel.on .paper').textContent.trim());

  console.log('--- the segue: contributions become text ---');
  to(LAST);
  const pills = [...d.querySelectorAll('.cd-text')];
  ok('two captions', pills.length === 2, pills.length);
  ok('and they read as CLIP prompts',
     pills.map(e => e.textContent).join(' | ')
       .replace(/[“”]/g, '"') === '"A photo of a pyramid" | "A photo of a camel"',
     pills.map(e => e.textContent).join(' | '));
  ok('both are shown at this step', pills.every(e => e.classList.contains('on')));
  ok('they do not wrap — a two-line caption would burst its pill',
     /\.cd-text\{[^}]*white-space:nowrap/.test(css.replace(/\s+/g,'')));
  const arrows = [...d.querySelectorAll('#cdStage path[data-k="link"]')];
  ok('one arrow per patch, ' + P + ' in all', arrows.length === P, arrows.length);
  ok('every one carries an arrowhead',
     arrows.every(a => /url\(#cdA\)/.test(a.getAttribute('marker-end') || '')));
  ok('three go to the first caption and two to the second — the grouping is the point',
     arrows.filter(a => +a.getAttribute('opacity') > 0).length === P);
  ok('the commentary names the joint space that makes it possible',
     /vision \+ language/.test(d.querySelector('#cdPoints .cd-point.on').textContent) &&
     /CLIP ViT/.test(d.querySelector('#cdPoints .cd-point.on').textContent));
  ok('the per-patch boxes survive into it — the text is about them',
     litAt().length === P, litAt().length);
  ok('and the formula panel has gone, so the captions are the only claim',
     d.querySelectorAll('.cd-panel.on').length === 0);
  to(4);
  ok('none of that shows a step earlier',
     [...d.querySelectorAll('.cd-text')].every(e => !e.classList.contains('on')) &&
     arrows.every(a => +a.getAttribute('opacity') === 0));

  console.log('--- the build ---');
  to(0);
  ok('step 1: the residual stream, and nothing added yet',
     d.querySelectorAll('.cd-add.on').length === L*H + L && lit().length === 0);
  to(1);
  ok('step 2: the contributions arrive', lit().length === L*H*P);
  ok('and the feeds with them',
     [...d.querySelectorAll('#cdStage path[data-k="feed"]')].some(l => +l.getAttribute('opacity') > 0));
  to(3);
  ok('the feeds go once the columns fold, having done their job',
     [...d.querySelectorAll('#cdStage path[data-k="feed"]')].every(l => +l.getAttribute('opacity') === 0));
  ok('but the MLPs stay — they are part of the stream, not of the tensor',
     [...d.querySelectorAll('.cd-mlp')].every(m => m.classList.contains('on')));

  console.log('--- the commentary fits its fixed box ---');
  // it does not grow, it laps the slide below it, and the height check sees
  // nothing wrong — the same trap as contrastive-matrix
  const boxH = parseFloat((css.match(/\.cd-points\{[^}]*height:([\d.]+)px/) || [0,0])[1]);
  const lines = parseFloat((css.match(/\.cd-point\{[^}]*line-height:([\d.]+)/) || [0,1.45])[1]);
  const fsz   = parseFloat((css.match(/\.cd-point\{[^}]*font-size:([\d.]+)px/) || [0,19])[1]);
  ok('the box holds two lines of commentary', boxH >= 2 * fsz * lines,
     boxH + 'px box, two lines need ' + Math.ceil(2 * fsz * lines) + 'px');

  console.log('--- legibility ---');
  const size = re => { const m = css.match(re); return m ? parseFloat(m[1]) : 0; };
  ok('the commentary is 19px', size(/\.cd-point\{[^}]*font-size:([\d.]+)px/) >= 19);
  ok('the formula is 21px',    size(/\.cd-panel \.sym\{[^}]*font-size:([\d.]+)px/) >= 21);
  ok('what it keeps is 17px',  size(/\.cd-panel \.keeps\{[^}]*font-size:([\d.]+)px/) >= 17);
  ok('the stage is flex:none', /\.cd-stage\{[^}]*flex:none/.test(css));

  console.log('\nERRORS:', errs.length, '  FAILURES:', fails.length);
  errs.slice(0,4).forEach(e => console.log('  -', e));
  fails.forEach(f => console.log('  ✗', f));
  if(errs.length || fails.length) process.exitCode = 1;
}, 700);
