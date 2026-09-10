/* The slide asserts four things about lines in homogeneous coordinates. This
   suite recomputes all four and then checks the PICTURE agrees, because a
   diagram that illustrates the wrong arithmetic is the failure worth catching.

   Nothing is read out of the component's closure, and the pixel-to-grid mapping
   is not hard-coded either: the component draws its own axes, so the suite
   solves for the mapping from those two strokes and reads every other mark in
   grid units. If the layout is retuned, this keeps working.

   Colours cannot be used to tell marks apart — jsdom does not resolve CSS custom
   properties, so every token comes back as the same fallback — so marks are told
   apart by line width and point count, which is what the component actually
   varies.

   Run: node test/line-algebra.checks.js                                       */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','line-algebra.html');
const html = fs.readFileSync(FILE, 'utf8');

// the same worked example, computed here independently of the component
const L1 = [1, 2, -2], L2 = [1, -1, 1], X1 = [-2, 2, 1], X2 = [2, 0, 1];
const cross = (u, v) => [u[1]*v[2] - u[2]*v[1],
                         u[2]*v[0] - u[0]*v[2],
                         u[0]*v[1] - u[1]*v[0]];
const dot = (l, x, y) => l[0]*x + l[1]*y + l[2];
const para = (u, v) => {                       // equal up to a non-zero scale
  const c = cross(u, v);
  return Math.hypot(c[0], c[1], c[2]) < 1e-9;
};

const drawn = [];
function fakeCtx(){
  let pts = [];
  const c = {
    fillStyle:'#000', strokeStyle:'#000', lineWidth:1, globalAlpha:1, font:'',
    textAlign:'left', textBaseline:'top',
    clearRect(){ drawn.push({kind:'clear'}); }, fillRect(){}, strokeRect(){}, drawImage(){}, save(){}, restore(){},
    clip(){}, rect(){}, translate(){}, rotate(){}, scale(){}, setTransform(){},
    setLineDash(){}, closePath(){}, putImageData(){},
    measureText(t){ return {width:(t||'').length*7}; },
    fillText(t,x,y){ drawn.push({kind:'text', text:String(t), x, y}); },
    beginPath(){ c._arc = false; pts = []; },
    moveTo(x,y){ pts.push([x,y]); }, lineTo(x,y){ pts.push([x,y]); },
    arc(x,y,r){ pts.push([x,y]); c._arc = r; },
    stroke(){ if(pts.length) drawn.push({kind: c._arc ? 'ring' : 'path',
                                         pts: pts.slice(), w: c.lineWidth, r: c._arc}); },
    fill(){ if(pts.length) drawn.push({kind:'dot', pts: pts.slice(), r: c._arc}); },
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; },
    getImageData(x,y,w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; }
  };
  return c;
}

const errs = [], fails = [];
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };
const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext = function(){ return fakeCtx(); };
    w.requestAnimationFrame = fn => w.setTimeout(()=>fn(0), 16);
    w.cancelAnimationFrame = id => w.clearTimeout(id);
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const d = dom.window.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Every draw() begins by clearing, so the marks of the current frame are the
// ones after the last clear. Reading the whole log instead would mix in the
// frames drawn on the way here — which is exactly what it did first time, and
// the suite reported three lines on a slide that draws two.
async function to(n){
  d.getElementById('sbReset').click(); await sleep(25);
  for(let i = 0; i < n; i++){ d.getElementById('sbNext').click(); await sleep(25); }
  await sleep(40);
  const last = drawn.map((o,i)=>[o.kind,i]).filter(([k])=>k==='clear').pop();
  drawn.splice(0, last ? last[1] + 1 : 0);
}

// The axes are the only two strokes at width 1.3; they give the affine map from
// canvas pixels to grid units without the suite knowing the layout constants.
function mapping(){
  const ax = drawn.filter(o => o.kind === 'path' && Math.abs(o.w - 1.3) < 1e-9);
  const horiz = ax.find(o => Math.abs(o.pts[0][1] - o.pts[1][1]) < 1e-6);
  const vert  = ax.find(o => Math.abs(o.pts[0][0] - o.pts[1][0]) < 1e-6);
  const x0 = Math.min(horiz.pts[0][0], horiz.pts[1][0]);   // that is grid x = -4
  const x1 = Math.max(horiz.pts[0][0], horiz.pts[1][0]);   // and grid x = +4
  const yTop = Math.min(vert.pts[0][1], vert.pts[1][1]);   // grid y = +4
  const yBot = Math.max(vert.pts[0][1], vert.pts[1][1]);   // grid y = -4
  const sx = 8/(x1 - x0), sy = 8/(yBot - yTop);
  return p => [ (p[0] - x0)*sx - 4, 4 - (p[1] - yTop)*sy ];
}
const wide = w => drawn.filter(o => o.kind === 'path' && Math.abs(o.w - w) < 1e-9
                                   && o.pts.length === 2);
const W = () => d.querySelector('.ln-work').textContent
                 .replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
// The dot products are drawn as column vectors, so their text runs together;
// read the entries structurally instead and check the arithmetic they show.
const num = t => Number(String(t).replace(/\u2212/g, '-'));
const eqRows = () => [...d.querySelectorAll('.ln-eqs .row')].map(r => ({
  vecs: [...r.querySelectorAll('.vec')].map(v =>
          [...v.querySelectorAll('.col span')].map(e => num(e.textContent))),
  res:  num((r.querySelector('.res') || {}).textContent)
}));

// Read the printed products back out of the vector they are set in, one entry
// at a time, and evaluate them. Matching the flat text would only prove the
// component printed something — and once the entries became separate spans the
// flat text ran them together, so it proved rather less than that.
const NUM = '(?:\\(\\u2212\\d+\\)|\\u2212?\\d+)';
const val = t => +t.replace(/[()]/g, '').replace(/\u2212/g, '-');
const vecsOf = r => [...r.querySelectorAll('.vec')].map(v =>
  [...v.querySelectorAll('.col span')].map(e => e.textContent.trim()));
const nums = v => v.map(val);
function evalTerms(entries){
  const re = new RegExp('^(' + NUM + ')·(' + NUM + ') \\u2212 (' + NUM + ')·(' + NUM + ')$');
  return entries.map(t => {
    const m = t.match(re);
    return m ? val(m[1])*val(m[2]) - val(m[3])*val(m[4]) : NaN;
  });
}

(async () => {
  await sleep(350);
  console.log('--- the arithmetic the slide prints, recomputed here ---');
  ok('x₁ and x₂ both lie on l₁', dot(L1, -2, 2) === 0 && dot(L1, 2, 0) === 0);
  const join = cross(X1, X2);
  ok('x₁ × x₂ = (2, 4, −4)', JSON.stringify(join) === JSON.stringify([2,4,-4]), join.join(', '));
  ok('and that is l₁ up to scale — which is why step 1 comes first',
     para(join, L1), join.join(', ') + ' vs ' + L1.join(', '));
  const meet = cross(L1, L2);
  ok('l₁ × l₂ = (0, −3, −3)', JSON.stringify(meet) === JSON.stringify([0,-3,-3]), meet.join(', '));
  ok('which reads back as (0, 1)',
     Math.abs(meet[0]/meet[2]) < 1e-12 && Math.abs(meet[1]/meet[2] - 1) < 1e-12);
  ok('and (0, 1) lies on both lines', dot(L1,0,1) === 0 && dot(L2,0,1) === 0);

  console.log('\n--- step 0: the line drawn is the line claimed ---');
  await to(0);
  ok('four step chips', d.querySelectorAll('.steps .s').length === 4);
  const M = mapping();
  let seg = wide(2);
  ok('one line is drawn', seg.length === 1, seg.length + ' found');
  if(seg.length){
    const e = seg[0].pts.map(M);
    ok('both its endpoints satisfy ax + by + c = 0',
       e.every(p => Math.abs(dot(L1, p[0], p[1])) < 1e-6),
       e.map(p => dot(L1,p[0],p[1]).toFixed(6)).join(', '));
  }
  let eq = eqRows();
  ok('one dot product is shown, as two column vectors', eq.length === 1 && eq[0].vecs.length === 2,
     JSON.stringify(eq));
  ok('the left vector is the test point in homogeneous form',
     JSON.stringify(eq[0].vecs[0]) === JSON.stringify([1, 2, 1]), JSON.stringify(eq[0].vecs[0]));
  ok('the right vector is l', JSON.stringify(eq[0].vecs[1]) === JSON.stringify(L1));
  ok('and the printed result is their dot product',
     eq[0].res === dot(L1, 1, 2), eq[0].res + ' vs ' + dot(L1, 1, 2));

  console.log('\n--- step 1: 2l draws over l, exactly ---');
  await to(1);
  const M1 = mapping(), thin = wide(2), thick = wide(7);
  ok('a second, wider stroke appears for 2l', thick.length === 1);
  if(thin.length && thick.length){
    const a = thin[0].pts.map(M1).flat(), b = thick[0].pts.map(M1).flat();
    ok('and it has the same endpoints, to a thousandth of a grid unit',
       a.every((v, i) => Math.abs(v - b[i]) < 1e-3),
       'l ' + a.map(v=>v.toFixed(3)) + '  vs 2l ' + b.map(v=>v.toFixed(3)));
  }
  eq = eqRows();
  ok('two dot products are shown', eq.length === 2, JSON.stringify(eq.map(r=>r.res)));
  ok('the second uses 2l', JSON.stringify(eq[1].vecs[1]) === JSON.stringify(L1.map(v=>2*v)),
     JSON.stringify(eq[1].vecs[1]));
  ok('against the same point', JSON.stringify(eq[1].vecs[0]) === JSON.stringify(eq[0].vecs[0]));
  ok('and its value is exactly twice the first', eq[1].res === 2*eq[0].res,
     eq[0].res + ' -> ' + eq[1].res);

  console.log('\n--- step 2: the two points are where the algebra puts them ---');
  await to(2);
  const M2 = mapping();
  const dots = drawn.filter(o => o.kind === 'dot' && Math.abs(o.r - 5) < 1e-9)
                    .map(o => M2(o.pts[0]));
  const near = (p, q) => Math.abs(p[0]-q[0]) < 1e-6 && Math.abs(p[1]-q[1]) < 1e-6;
  ok('x₁ is drawn at (−2, 2)', dots.some(p => near(p, [-2, 2])), JSON.stringify(dots));
  ok('x₂ is drawn at (2, 0)',  dots.some(p => near(p, [ 2, 0])));
  ok('and both sit on the drawn line',
     dots.every(p => Math.abs(dot(L1, p[0], p[1])) < 1e-6));
  ok('the test point is gone, so nothing is left to confuse them with',
     dots.length === 2, dots.length + ' point(s)');
  let v = vecsOf(d.querySelector('.ln-eqs .row'));
  ok('the row is x₁ × x₂ = expansion = result, all as column vectors', v.length === 4,
     v.length + ' vector(s)');
  ok('the two operands are x₁ and x₂',
     JSON.stringify(nums(v[0])) === JSON.stringify(X1) &&
     JSON.stringify(nums(v[1])) === JSON.stringify(X2), JSON.stringify([nums(v[0]), nums(v[1])]));
  ok('the expansion evaluates to x₁ × x₂',
     JSON.stringify(evalTerms(v[2])) === JSON.stringify(join),
     evalTerms(v[2]).join(', ') + '  vs  ' + join.join(', '));
  ok('and the result vector is what it evaluates to',
     JSON.stringify(nums(v[3])) === JSON.stringify(join), JSON.stringify(nums(v[3])));

  console.log('\n--- step 3: the meet is drawn where the cross product says ---');
  await to(3);
  const M3 = mapping(), lines = wide(2);
  ok('two lines are drawn', lines.length === 2, lines.length + ' found');
  if(lines.length === 2){
    const onL2 = lines.find(s => s.pts.map(M3)
                    .every(p => Math.abs(dot(L2, p[0], p[1])) < 1e-6));
    ok('the second satisfies x − y + 1 = 0', !!onL2);
  }
  const marks = drawn.filter(o => o.kind === 'dot' && Math.abs(o.r - 5) < 1e-9)
                     .map(o => M3(o.pts[0]));
  ok('a third point is drawn at (0, 1)', marks.some(p => near(p, [0, 1])),
     JSON.stringify(marks));
  ok('and it is ringed, the way the constructed answer should be',
     drawn.some(o => o.kind === 'ring' && Math.abs(o.r - 10) < 1e-9));
  v = vecsOf(d.querySelector('.ln-eqs .row'));
  ok('the row carries five vectors, ending in the read-back', v.length === 5,
     v.length + ' vector(s)');
  ok('the operands are l₁ and l₂',
     JSON.stringify(nums(v[0])) === JSON.stringify(L1) &&
     JSON.stringify(nums(v[1])) === JSON.stringify(L2));
  ok('the expansion evaluates to l₁ × l₂',
     JSON.stringify(evalTerms(v[2])) === JSON.stringify(meet),
     evalTerms(v[2]).join(', ') + '  vs  ' + meet.join(', '));
  ok('the result vector agrees', JSON.stringify(nums(v[3])) === JSON.stringify(meet));
  ok('and the last one is it read back to (0, 1)',
     JSON.stringify(nums(v[4])) === JSON.stringify([0, 1]), JSON.stringify(nums(v[4])));

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f => console.log('  ✗', f));
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
})();

setTimeout(() => { console.log('\n  FAIL  still running after every check finished');
  process.exit(1); }, 30000).unref();
