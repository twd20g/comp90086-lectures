/* The slide makes one claim, in both directions: the line drawn in one image is
   where the match in the other has to be. So the suite checks it against the
   matches themselves.

   F IS NOT COPIED INTO THIS FILE, deliberately. Re-deriving l' = F x here would
   only prove the test can multiply. What matters is that the line lands on the
   true correspondence, and those were checked by eye, patch against patch,
   before they went in — so the six drawn rings are ground truth and the test
   asks how far each drawn line misses its own ring. That covers F, the clipping
   to the panel and the coordinate mapping in one measurement, and it fails if
   any of the three is wrong.

   The default point is itself one of the six correspondences, so the same
   question can be asked of step 0 before anything is dragged. And because F and
   F-transpose must give DIFFERENT families, that is asserted too — a component
   that used F both ways would satisfy every other check in here.

   Run: node test/epipolar-live.checks.js                                       */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','epipolar-live.html');
const html = fs.readFileSync(FILE, 'utf8');

const drawn = [];
function fakeCtx(){
  let pts = [];
  const c = {
    fillStyle:'#000', strokeStyle:'#000', lineWidth:1, globalAlpha:1, font:'',
    textAlign:'left', textBaseline:'top', _stack:[],
    clearRect(){ drawn.push({kind:'clear'}); }, fillRect(){}, drawImage(){},
    strokeRect(x,y,w,h){ drawn.push({kind:'panel', x, y, w, h}); },
    save(){ c._stack.push(1); }, restore(){ c._stack.pop(); },
    clip(){}, rect(){}, translate(){}, rotate(){}, scale(){}, setTransform(){},
    setLineDash(){}, closePath(){}, quadraticCurveTo(){}, ellipse(){}, putImageData(){},
    measureText(t){ return {width:(t||'').length*7}; }, fillText(){},
    beginPath(){ c._arc = undefined; pts = []; },
    moveTo(x,y){ pts.push([x,y]); }, lineTo(x,y){ pts.push([x,y]); },
    arc(x,y,r){ pts.push([x,y]); c._arc = r; },
    stroke(){ if(pts.length) drawn.push({kind: c._arc !== undefined ? 'ring' : 'path',
      pts: pts.slice(), w: c.lineWidth, r: c._arc, a: c.globalAlpha, col: c.strokeStyle}); },
    fill(){ if(pts.length) drawn.push({kind: c._arc !== undefined ? 'disc' : 'shade',
      pts: pts.slice(), r: c._arc, col: c.fillStyle}); },
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; },
    getImageData(x,y,w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; }
  };
  return c;
}

const dist = (p,q) => Math.hypot(p[0]-q[0], p[1]-q[1]);
const off = (a,b,c) => {
  const vx = b[0]-a[0], vy = b[1]-a[1];
  return Math.abs((c[0]-a[0])*vy - (c[1]-a[1])*vx)/Math.hypot(vx, vy);
};
const inRect = (p, r) => p[0] >= r.x-1 && p[0] <= r.x+r.w+1 &&
                         p[1] >= r.y-1 && p[1] <= r.y+r.h+1;

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
const since = () => {
  const last = drawn.map((o,i)=>[o.kind,i]).filter(([k])=>k==='clear').pop();
  return drawn.slice(last ? last[1] + 1 : 0);
};
async function to(n){
  d.getElementById('sbReset').click(); await sleep(30);
  for(let i = 0; i < n; i++){ d.getElementById('sbNext').click(); await sleep(30); }
  await sleep(50);
  return since();
}
const lines = (f, w) => f.filter(o => o.kind === 'path' && o.pts.length === 2 &&
                                      Math.abs(o.w - w) < .01).map(o => o.pts);

(async () => {
  await sleep(400);
  console.log('--- the two panels ---');
  ok('two step chips', d.querySelectorAll('.steps .s').length === 2);

  let f = await to(0);
  const pan = f.filter(o => o.kind === 'panel').sort((a,b) => a.x - b.x);
  ok('two image panels are drawn', pan.length === 2, pan.length + ' found');
  const [A, B] = pan;
  ok('side by side, the same size and not overlapping',
     A.w === B.w && A.h === B.h && A.x + A.w < B.x,
     'A at ' + A.x + ', B at ' + B.x + ', each ' + A.w + 'x' + A.h);

  console.log('\n--- step 0: the point you drag, and its line ---');
  ok('the first line of text is showing', d.querySelectorAll('.ev-row.on').length === 1 &&
     d.querySelector('.ev-row[data-r="0"]').classList.contains('on'));
  const mark = f.filter(o => o.kind === 'ring' && Math.abs(o.r - 7) < .01).map(o => o.pts[0]);
  ok('one marker, and it is in the LEFT panel', mark.length === 1 && inRect(mark[0], A),
     mark.length ? mark[0].map(Math.round).join(',') : 'none');
  const l0 = lines(f, 2);
  ok('one epipolar line, and it is in the RIGHT panel',
     l0.length === 1 && l0[0].every(p => inRect(p, B)));
  // the default point is a checked correspondence, so its match is known and the
  // line has to pass through it. 0.4819, 0.3854 of the panel, from PAIRS[2].
  const truth = [B.x + 0.4819*B.w, B.y + 0.3854*B.h];
  const miss = off(l0[0][0], l0[0][1], truth);
  ok('and it passes through the true match of the point it starts on',
     miss < 1.5, miss.toFixed(2) + ' px away, in a ' + B.w + ' px panel');
  ok('the line is clipped to the panel, not drawn across the slide',
     l0[0].every(p => inRect(p, B)) &&
     Math.hypot(l0[0][0][0]-l0[0][1][0], l0[0][0][1]-l0[0][1][1]) > 100);

  console.log('\n--- step 1: six of them, run both ways ---');
  f = await to(1);
  ok('the text changes rather than accumulating',
     d.querySelectorAll('.ev-row.on').length === 1 &&
     d.querySelector('.ev-row[data-r="1"]').classList.contains('on'));

  const mid = l => [(l[0][0]+l[1][0])/2, (l[0][1]+l[1][1])/2];
  const all = lines(f, 1.6);
  const inPanel = (arr, R) => arr.filter(l => inRect(mid(l), R));
  const lA = inPanel(all, A), lB = inPanel(all, B);
  ok('twelve lines — six each way', all.length === 12, all.length + ' found');
  ok('six drawn in the left panel and six in the right',
     lA.length === 6 && lB.length === 6, lA.length + ' left, ' + lB.length + ' right');

  const dots = R => f.filter(o => o.kind === 'disc' && Math.abs(o.r - 4.5) < .01)
                     .map(o => o.pts[0]).filter(p => inRect(p, R));
  const pA = dots(A), pB = dots(B);
  ok('six points in each image', pA.length === 6 && pB.length === 6,
     pA.length + ' and ' + pB.length);

  // the claim, in both directions: a point of one image lies on a line the OTHER
  // image sent across. F one way, F-transpose the other, and the same six pairs.
  function land(pts, ls, label){
    const near = pts.map(p => {
      let best = Infinity, at = -1;
      ls.forEach((l, i) => { const e = off(l[0], l[1], p); if(e < best){ best = e; at = i; } });
      return { e: best, at };
    });
    const worst = Math.max(...near.map(n => n.e));
    ok('every point in the ' + label + ' image sits on one of the lines sent to it',
       worst < 1.5, 'worst ' + worst.toFixed(2) + ' px of ' + A.w);
    ok('  and on a different line each, six for six', new Set(near.map(n => n.at)).size === 6,
       JSON.stringify(near.map(n => n.at)));
    return near;
  }
  const nB = land(pB, lB, 'right');
  land(pA, lA, 'left');
  ok('every line stays inside the panel it belongs to',
     lA.every(l => l.every(p => inRect(p, A))) && lB.every(l => l.every(p => inRect(p, B))));

  console.log('\n--- and it is F that is doing it ---');
  const spread = lB.map(l => mid(l)[1]);
  ok('the six lines are genuinely different, not one line drawn six times',
     Math.max(...spread) - Math.min(...spread) > 40,
     'their midpoints span ' + (Math.max(...spread) - Math.min(...spread)).toFixed(0) + ' px');
  // the two directions must disagree about where the lines go: if the component
  // drew F both ways the left panel's lines would be the right panel's, shifted
  const shifted = lA.map(l => mid(l)[1]).sort((x,y) => x-y);
  const other   = spread.slice().sort((x,y) => x-y);
  ok('the two directions give different families, so F-transpose is really being used',
     shifted.some((v, i) => Math.abs(v - other[i]) > 6),
     'left ' + shifted.map(v => v.toFixed(0)).join(',') +
     '  right ' + other.map(v => v.toFixed(0)).join(','));
  const order = pA.map((p, i) => [p[1], nB[i] ? spread[nB[i].at] : 0])
                  .sort((x, y) => x[0] - y[0]).map(r => r[1]);
  ok('a point lower in one image gives a lower line in the other',
     order.every((v, i) => i === 0 || v >= order[i-1] - 8),
     order.map(v => v.toFixed(0)).join(' → '));

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f2 => console.log('  ✗', f2));
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
})();

setTimeout(() => { console.log('\n  FAIL  still running after every check finished');
  process.exit(1); }, 30000).unref();
