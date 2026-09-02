/* The matches this component draws were computed offline, which means the
   component could be shipping anything. So this suite re-derives the geometry
   from the embedded numbers alone.

   The claim is that the cover is a plane, so one homography relates the two
   views, and that the matches flagged consistent really are. The suite fits a
   homography to the flagged inliers by least-squares DLT — normal equations on
   the eight unknowns, solved by Gaussian elimination — and then asks two
   questions the picture cannot answer:

     · do the inliers reproject onto their partners?  (they must, tightly)
     · do the outliers?                                (they must not)

   If the flags were shuffled, or the coordinates rescaled, or the pair swapped,
   every one of those checks fails. Eyeballing the slide would catch none of it.

   Also checked: the drawn subset is not more flattering than the real match
   set. The note quotes totals from the full run, so a subset with a visibly
   different contamination rate would make the picture lie about the number.

   Run: node test/match-pair.checks.js                                         */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','match-pair.html');
const html = fs.readFileSync(FILE, 'utf8');

const errs = [], fails = [];
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };

// the arrays live in the component's closure, so read them from the source
const grab = name => {
  const m = html.match(new RegExp('const ' + name + '\\s*=\\s*(\\[[\\s\\S]*?\\]);'));
  return m ? eval(m[1]) : null;                       // our own build output
};
const MATCH = grab('MATCH');
const TOTAL = eval('(' + html.match(/const TOTAL\s*=\s*(\{[^}]*\});/)[1] + ')');

// ---- least-squares DLT, h33 = 1 -------------------------------------------
function solve(A, b){                                  // Gaussian elimination
  const n = b.length;
  for(let i=0;i<n;i++){
    let p = i;
    for(let r=i+1;r<n;r++) if(Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i],A[p]] = [A[p],A[i]]; [b[i],b[p]] = [b[p],b[i]];
    for(let r=i+1;r<n;r++){
      const f = A[r][i]/A[i][i];
      for(let c=i;c<n;c++) A[r][c] -= f*A[i][c];
      b[r] -= f*b[i];
    }
  }
  const x = new Array(n).fill(0);
  for(let i=n-1;i>=0;i--){
    let s = b[i];
    for(let c=i+1;c<n;c++) s -= A[i][c]*x[c];
    x[i] = s/A[i][i];
  }
  return x;
}
function fit(pairs){
  const N = Array.from({length:8}, () => new Array(8).fill(0)), r = new Array(8).fill(0);
  const add = row => {                                 // accumulate A^T A, A^T b
    for(let i=0;i<8;i++){ for(let j=0;j<8;j++) N[i][j] += row[i]*row[j]; r[i] += row[i]*row[8]; }
  };
  pairs.forEach(([x,y,u,v]) => {
    add([x, y, 1, 0, 0, 0, -u*x, -u*y, u]);
    add([0, 0, 0, x, y, 1, -v*x, -v*y, v]);
  });
  return solve(N, r);
}
const apply = (h, x, y) => {
  const w = h[6]*x + h[7]*y + 1;
  return [(h[0]*x + h[1]*y + h[2])/w, (h[3]*x + h[4]*y + h[5])/w];
};
const pct = (a, p) => a.slice().sort((x,y)=>x-y)[Math.floor((a.length-1)*p)];

const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    w.requestAnimationFrame = fn => w.setTimeout(()=>fn(0), 16);
    w.cancelAnimationFrame = id => w.clearTimeout(id);
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const d = dom.window.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await sleep(350);
  console.log('--- the panel came up ---');
  ok('three step chips, one per stage', d.querySelectorAll('.steps .s').length === 3);
  const imgs = [...d.querySelectorAll('.mp-pane img')];
  ok('both photographs are attached', imgs.length === 2);
  ok('and both carry real image data',
     imgs.every(i => (i.getAttribute('src')||'').startsWith('data:image/')));
  ok('every drawn match has a line', d.querySelectorAll('.mp-ov .ln').length === MATCH.length,
     d.querySelectorAll('.mp-ov .ln').length + ' of ' + MATCH.length);

  console.log('\n--- the build order ---');
  ok('nothing is overlaid on the photographs at first',
     d.querySelectorAll('.kp.on').length === 0 && d.querySelectorAll('.ln.on').length === 0);
  d.getElementById('sbNext').click(); await sleep(40);
  ok('keypoints appear before the matches do',
     d.querySelectorAll('.kp.on').length > 0 && d.querySelectorAll('.ln.on').length === 0,
     d.querySelectorAll('.kp.on').length + ' keypoints');
  d.getElementById('sbNext').click(); await sleep(40);
  ok('then every match is drawn', d.querySelectorAll('.ln.on').length === MATCH.length);

  console.log('\n--- the cover is a plane, and the flags are honest ---');
  const inl = MATCH.filter(m => m[4]), out = MATCH.filter(m => !m[4]);
  ok('the sample holds both kinds', inl.length > 40 && out.length > 20,
     inl.length + ' inliers, ' + out.length + ' outliers');
  const h = fit(inl.map(m => [m[0], m[1], m[2], m[3]]));
  const resid = set => set.map(m => {
    const [u,v] = apply(h, m[0], m[1]);
    return Math.hypot(u - m[2], v - m[3]);
  });
  const ri = resid(inl), ro = resid(out);
  console.log('          inlier residual  median %s  95th %s',
              pct(ri,0.5).toFixed(5), pct(ri,0.95).toFixed(5));
  console.log('          outlier residual median %s  5th  %s',
              pct(ro,0.5).toFixed(5), pct(ro,0.05).toFixed(5));
  // a residual is a fraction of the frame: 0.01 is one pixel in a hundred
  ok('the inliers reproject onto their partners', pct(ri,0.5) < 0.006,
     'median ' + pct(ri,0.5).toFixed(5));
  ok('and almost all of them, not just the median', pct(ri,0.95) < 0.02,
     '95th ' + pct(ri,0.95).toFixed(5));
  ok('the outliers do not', pct(ro,0.5) > 0.05, 'median ' + pct(ro,0.5).toFixed(5));
  ok('and the two populations are far apart',
     pct(ro,0.5) > 8*pct(ri,0.95), (pct(ro,0.5)/pct(ri,0.95)).toFixed(1) + 'x');

  console.log('\n--- the ratio test is a filter over these same matches ---');
  {
    const R = eval(html.match(/const RATIO\s*=\s*([0-9.]+);/)[1]);
    ok('every match carries a ratio, and it is one',
       MATCH.every(m => m.length === 6 && m[5] > 0 && m[5] <= 1));
    const keep = MATCH.filter(m => m[5] <= R), drop = MATCH.filter(m => m[5] > R);
    ok('it keeps some and drops some', keep.length > 20 && drop.length > 10,
       keep.length + ' kept, ' + drop.length + ' dropped');
    // the claim the slide makes: what it drops is mostly wrong, what it keeps
    // mostly right. Computed here from the ratios, not read off the note.
    const wrongIn = a => a.filter(m => !m[4]).length / a.length;
    console.log('          wrong: %s%% of all, %s%% of the kept, %s%% of the dropped',
      (100*wrongIn(MATCH)).toFixed(0), (100*wrongIn(keep)).toFixed(0),
      (100*wrongIn(drop)).toFixed(0));
    ok('what it drops is mostly wrong', wrongIn(drop) > 0.6,
       (100*wrongIn(drop)).toFixed(0) + '%');
    ok('and what it keeps is cleaner than what it started with',
       wrongIn(keep) < wrongIn(MATCH) / 2,
       (100*wrongIn(keep)).toFixed(0) + '% vs ' + (100*wrongIn(MATCH)).toFixed(0) + '%');
    // and the totals in the note have to tell the same story
    ok('the totals agree: it discards far more wrong than right',
       TOTAL.cutOut / (TOTAL.match - TOTAL.inlier) > 3 * (TOTAL.cutIn / TOTAL.inlier),
       (100*TOTAL.cutOut/(TOTAL.match-TOTAL.inlier)).toFixed(0) + '% of wrong vs '
       + (100*TOTAL.cutIn/TOTAL.inlier).toFixed(0) + '% of right');
    ok('and the arithmetic closes',
       TOTAL.keptIn + TOTAL.cutIn === TOTAL.inlier &&
       TOTAL.keptOut + TOTAL.cutOut === TOTAL.match - TOTAL.inlier &&
       TOTAL.keptIn + TOTAL.keptOut === TOTAL.kept);
  }

  console.log('\n--- the ratio mode is the same picture, thinned ---');
  {
    const d2 = await new Promise(res => {
      const j = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true,
        beforeParse(w){
          // On the DOCUMENT, not the window: the harness listens on the
          // document, and a document listener fires before a window one no
          // matter which was registered first. Same target, registered in
          // beforeParse, means this runs before the component initialises.
          w.document.addEventListener('DOMContentLoaded', () => {
            w.document.getElementById('root').dataset.mpMode = 'ratio';
          });
          w.requestAnimationFrame = fn => w.setTimeout(()=>fn(0), 16);
          w.cancelAnimationFrame = id => w.clearTimeout(id);
        }});
      setTimeout(() => res(j), 300);
    });
    const q = d2.window.document;
    ok('the matches are up from the first step', q.querySelectorAll('.ln.on').length === MATCH.length);
    ok('with nothing rejected yet', q.querySelectorAll('.ln.on.cut').length === 0);
    ok('and no keypoints, which belong to the other slide',
       q.querySelectorAll('.kp.on').length === 0);
    q.getElementById('sbNext').click(); await sleep(40);
    const R = eval(html.match(/const RATIO\s*=\s*([0-9.]+);/)[1]);
    const want = MATCH.filter(m => m[5] > R).length;
    ok('one step later, exactly the over-ratio matches are faded',
       q.querySelectorAll('.ln.on.cut').length === want,
       q.querySelectorAll('.ln.on.cut').length + ' of ' + want);
    ok('the chips are relabelled for this mode',
       [...q.querySelectorAll('.steps .s')][0].textContent === 'every candidate');
    d2.window.close();
  }

  console.log('\n--- the picture does not flatter the numbers ---');
  const drawnRate = out.length / MATCH.length;
  const trueRate = (TOTAL.match - TOTAL.inlier) / TOTAL.match;
  ok('the drawn contamination matches the full set within 8 points',
     Math.abs(drawnRate - trueRate) < 0.08,
     (100*drawnRate).toFixed(0) + '% drawn vs ' + (100*trueRate).toFixed(0) + '% actual');
  ok('and the note quotes the full total, not the drawn one',
     d.querySelector('.mp-note').textContent.indexOf(String(TOTAL.match)) >= 0,
     d.querySelector('.mp-note').textContent.slice(0, 40) + '…');

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f => console.log('  ✗', f));
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
})();

setTimeout(() => { console.log('\n  FAIL  still running after every check finished');
  process.exit(1); }, 30000).unref();
