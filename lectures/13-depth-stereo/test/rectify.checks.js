/* This component replaced a figure that drew the two RECTIFIED epipolar lines
   at different heights — the one thing "rectified" means. So that is what this
   suite asserts, along with the two other claims the slide makes out loud:
   the camera centres do not move, and each image point really is where the ray
   from its centre to P crosses the plane.

   It reads the SVG the component wrote rather than any internal state, so it is
   checking the picture the room sees.

   Run: node test/rectify.checks.js                                            */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','rectify.html');
const html = fs.readFileSync(FILE, 'utf8');

const errs = [], fails = [];
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };
const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    w.requestAnimationFrame = fn => w.setTimeout(()=>fn(0), 16);
    w.cancelAnimationFrame = id => w.clearTimeout(id);
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const d = dom.window.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = (e, a) => +e.getAttribute(a);
const circles = fill => [...d.querySelectorAll('circle')]
  .filter(e => (e.getAttribute('fill')||'').includes(fill))
  .map(e => [num(e,'cx'), num(e,'cy')]);
const epi = () => [...d.querySelectorAll('line')]
  .filter(e => (e.getAttribute('stroke')||'').includes('coral'))
  .map(e => ({ y1:num(e,'y1'), y2:num(e,'y2'), x1:num(e,'x1'), x2:num(e,'x2') }));
const to = async n => { d.getElementById('sbReset').click(); await sleep(20);
  for(let i=0;i<n;i++){ d.getElementById('sbNext').click(); await sleep(20); }
  await sleep(60); };

(async () => {
  await sleep(300);
  console.log('--- the panel came up ---');
  ok('four step chips, one per stage', d.querySelectorAll('.steps .s').length === 4);

  console.log('\n--- the centres do not move, which is what H means ---');
  await to(0); const c0 = circles('signal');
  await to(3); const c3 = circles('signal');
  ok('two camera centres are drawn', c0.length === 2, c0.length + ' found');
  ok('and they are in the same place after rectification as before',
     JSON.stringify(c0) === JSON.stringify(c3), JSON.stringify(c0) + ' vs ' + JSON.stringify(c3));

  console.log('\n--- before: two lines that agree about nothing ---');
  await to(1);
  const before = epi();
  ok('an epipolar line in each image', before.length === 2);
  if(before.length === 2){
    const slope = l => Math.abs(l.y2 - l.y1);
    ok('neither is horizontal', slope(before[0]) > 8 && slope(before[1]) > 8,
       slope(before[0]).toFixed(1) + ' and ' + slope(before[1]).toFixed(1) + ' px of fall');
    ok('and they slope opposite ways, as converged cameras give',
       (before[0].y2 - before[0].y1) * (before[1].y2 - before[1].y1) < 0);
    const mid = l => (l.y1 + l.y2)/2;
    ok('their mid-heights differ', Math.abs(mid(before[0]) - mid(before[1])) > 1,
       Math.abs(mid(before[0]) - mid(before[1])).toFixed(1) + ' px apart');
  }

  console.log('\n--- after: one row, which is the whole word "rectified" ---');
  await to(3);
  const after = epi();
  ok('still an epipolar line in each', after.length === 2);
  if(after.length === 2){
    ok('each is horizontal', Math.abs(after[0].y2 - after[0].y1) < 0.01 &&
                             Math.abs(after[1].y2 - after[1].y1) < 0.01,
       after.map(l => (l.y2-l.y1).toFixed(3)).join(' and '));
    ok('and both are the SAME row', Math.abs(after[0].y1 - after[1].y1) < 0.01,
       'y = ' + after[0].y1.toFixed(2) + ' and ' + after[1].y1.toFixed(2));
    const pts = circles('amber');
    ok('the two image points sit on it too',
       pts.every(p => Math.abs(p[1] - after[0].y1) < 0.01),
       pts.map(p => p[1].toFixed(2)).join(' and '));
  }

  console.log('\n--- and p really is on the ray from its centre to P ---');
  for(const step of [0, 3]){
    await to(step);
    const P = circles('--ink')[0], C = circles('signal'), A = circles('amber');
    const off = C.map((o, i) => {
      const [ax, ay] = A[i];                       // |cross| / |PO| = distance
      const vx = o[0] - P[0], vy = o[1] - P[1];
      return Math.abs((ax - P[0])*vy - (ay - P[1])*vx) / Math.hypot(vx, vy);
    });
    ok('step ' + step + ': both image points lie on their ray',
       off.every(v => v < 0.6), off.map(v => v.toFixed(3) + ' px').join(', '));
  }

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f => console.log('  ✗', f));
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
})();

setTimeout(() => { console.log('\n  FAIL  still running after every check finished');
  process.exit(1); }, 30000).unref();
