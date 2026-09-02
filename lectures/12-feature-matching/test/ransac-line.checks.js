/* The claim this component replaced was "6 inliers against 14", asserted under
   two static figures. Here both numbers are computed, so the suite recomputes
   them independently and checks the PICTURE agrees with the readout: a point is
   drawn in the inlier colour if and only if it is within delta of the line.
   A count printed beside a picture that disagrees with it is the failure worth
   catching, and it is invisible on screen.

   Also checked: the loop is a loop. Steps six and seven re-run lines already on
   screen and reveal nothing new — that is the difference between this and the
   original slide's fourth bullet reading "repeat until max iterations".

   Run: node test/ransac-line.checks.js                                        */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','ransac-line.html');
const html = fs.readFileSync(FILE, 'utf8');

const P = [
  [0.0439,0.1737],[0.1448,0.3857],[0.2455,0.2797],[0.3685,0.4044],
  [0.4279,0.5549],[0.5339,0.6368],[0.5894,0.4698],[0.5970,0.5886],
  [0.6703,0.8298],[0.7106,0.6606],[0.7712,0.9568],[0.7724,0.7441],
  [0.8927,0.8511],[0.9109,0.9594],
  [0.2261,0.8933],[0.3270,0.8089],[0.5694,0.0470],[0.6500,0.1949],
  [0.7712,0.3006],[0.9330,0.2797]
];
const DELTA = 0.16, SAMPLE = [[14,16],[2,3]];
const W = 688, H = 688, PAD = 34;
const unx = X => (X - PAD)/(W - 2*PAD), uny = Y => (H - PAD - Y)/(H - 2*PAD);
const SIG = '#46d6c0', MUT = '#59626e';

function within(pair){
  const a = P[pair[0]], b = P[pair[1]];
  const vx = b[0]-a[0], vy = b[1]-a[1], L = Math.hypot(vx,vy);
  return P.map(p => Math.abs((p[0]-a[0])*(-vy/L) + (p[1]-a[1])*(vx/L)) <= DELTA);
}

const drawn = [];
function fakeCtx(canvas){
  let pts = [];
  const c = {
    canvas, fillStyle:'#000', strokeStyle:'#000', lineWidth:1, globalAlpha:1, font:'',
    clearRect(){}, fillRect(){}, strokeRect(){}, fillText(){}, drawImage(){},
    save(){}, restore(){}, clip(){}, rect(x,y,w,h){ pts.push([x,y],[x+w,y+h]); },
    translate(){}, rotate(){}, scale(){}, measureText(t){ return {width:(t||'').length*7}; },
    beginPath(){ c._arc = false; pts = []; },
    moveTo(x,y){ pts.push([x,y]); }, lineTo(x,y){ pts.push([x,y]); },
    closePath(){}, arc(x,y,r){ pts.push([x,y]); c._r = r; c._arc = true; },
    stroke(){ if(pts.length) drawn.push({kind:c._arc?'ring':'path', pts:pts.slice(),
                                        style:c.strokeStyle, r:c._r}); },
    fill(){ if(pts.length) drawn.push({kind:c._arc?'dot':'area', pts:pts.slice(),
                                      style:c.fillStyle, alpha:c.globalAlpha}); },
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4),width:w,height:h}; },
    putImageData(){}, getImageData(sx,sy,w,h){
      return {data:new Uint8ClampedArray(w*h*4),width:w,height:h}; }
  };
  return c;
}

const errs = [], fails = [];
const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext = function(){ return fakeCtx(this); };
    w.requestAnimationFrame = fn => w.setTimeout(()=>fn(0), 16);
    w.cancelAnimationFrame = id => w.clearTimeout(id);
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };
const d = dom.window.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));
// the component paints only when its step is set, so the recorder is cleared
// just before the LAST click — otherwise there is nothing to read afterwards
const to = async n => {
  d.getElementById('sbReset').click(); await sleep(30);
  for(let i=0;i<n-1;i++){ d.getElementById('sbNext').click(); await sleep(25); }
  drawn.length = 0;
  if(n > 0){ d.getElementById('sbNext').click(); }
  await sleep(60);
};

// which points came out in the inlier colour, read off the plot
function litPoints(){
  const seen = new Map();
  drawn.forEach(x => {
    if(x.kind !== 'dot' || x.r > 11) return;
    const px = unx(x.pts[0][0]), py = uny(x.pts[0][1]);
    let best = -1, bd = 9;
    P.forEach((p, i) => { const e = Math.hypot(p[0]-px, p[1]-py); if(e < bd){ bd = e; best = i; } });
    if(bd < 0.01) seen.set(best, x.style === SIG);
  });
  return seen;
}

(async () => {
  await sleep(350);
  console.log('--- the panel came up ---');
  ok('ten step chips, one per stage', d.querySelectorAll('.steps .s').length === 10,
     d.querySelectorAll('.steps .s').length + ' chips');
  ok('nine lines of pseudocode', d.querySelectorAll('.rl-code .ln').length === 9);

  for(const [step, it, want] of [[4,0,6],[7,1,14]]){
    await to(step);
    const truth = within(SAMPLE[it]), n = truth.filter(Boolean).length;
    console.log('\n--- step ' + step + ': iteration ' + (it+1) + ' ---');
    ok('the count is ' + want + ', recomputed from the coordinates', n === want, 'got ' + n);
    ok('and that is what the readout says',
       d.querySelector('.rl-n').textContent === String(want),
       d.querySelector('.rl-n').textContent);
    const lit = litPoints();
    ok('all twenty points are drawn', lit.size === 20, lit.size + ' found');
    const wrong = [...lit.entries()].filter(([i, on]) => on !== truth[i]).map(([i]) => i);
    ok('every point is coloured by the predicate the pseudocode names',
       wrong.length === 0, wrong.length ? 'disagree at ' + wrong.join(',') : '');
    const band = drawn.filter(x => x.kind === 'area' && x.alpha < 0.5);
    ok('the δ band is drawn', band.length > 0);
  }

  console.log('\n--- the fourteen are the figure’s own fourteen ---');
  ok('the good sample selects exactly the first fourteen points',
     within(SAMPLE[1]).every((v, i) => v === (i < 14)));

  console.log('\n--- δ is named where it is used, and stays named ---');
  {
    await to(3);
    const before = d.querySelector('.rl-foot').classList.contains('on');
    await to(4);
    const at = d.querySelector('.rl-foot').classList.contains('on');
    await to(9);
    const after = d.querySelector('.rl-foot').classList.contains('on');
    ok('the note is absent until the line that uses δ appears', !before);
    ok('it appears with that line', at);
    ok('and is still there at the end', after);
    ok('the asterisk is on the δ in the pseudocode',
       !!d.querySelector('.rl-code .ln[data-i="4"] .ast'));
  }

  console.log('\n--- and the loop is a loop ---');
  await to(5);
  const shown5 = [...d.querySelectorAll('.rl-code .ln')].filter(e => e.classList.contains('on')).length;
  await to(6);
  const l = [...d.querySelectorAll('.rl-code .ln')];
  const shown6 = l.filter(e => e.classList.contains('on')).length;
  const now6 = l.map((e,i) => e.classList.contains('now') ? i : -1).filter(i => i >= 0);
  ok('the second iteration reveals no new pseudocode', shown6 === shown5,
     shown5 + ' lines before, ' + shown6 + ' after');
  ok('it re-executes the sample and fit lines instead',
     now6.join(',') === '2,3', 'running ' + now6.join(','));
  await to(8);
  ok('the refit line appears before the return, pushing it down',
     l[7].classList.contains('on') && l[7].classList.contains('now')
     && !l[8].classList.contains('on'));
  await to(9);
  ok('and only the last step reaches "return best"',
     l[8].classList.contains('on') && l[8].classList.contains('now'));

  console.log('\n--- the refit is a fit, and it moves ---');
  {
    const truth = within(SAMPLE[1]);
    let n=0, mx=0, my=0;
    P.forEach((p,i)=>{ if(truth[i]){ n++; mx+=p[0]; my+=p[1]; } }); mx/=n; my/=n;
    let sxx=0,syy=0,sxy=0;
    P.forEach((p,i)=>{ if(!truth[i]) return; const dx=p[0]-mx, dy=p[1]-my;
      sxx+=dx*dx; syy+=dy*dy; sxy+=dx*dy; });
    const th = 0.5*Math.atan2(2*sxy, sxx-syy);
    const a = P[SAMPLE[1][0]], b = P[SAMPLE[1][1]];
    const sampleTh = Math.atan2(b[1]-a[1], b[0]-a[0]);
    const moved = Math.abs(th - sampleTh) * 180/Math.PI;
    ok('the refit direction differs from the two-point line', moved > 2,
       'by ' + moved.toFixed(1) + '°');
    // the refit must minimise perpendicular residual over the two-point line
    const rss = (c, u) => P.reduce((s,p,i) => truth[i]
      ? s + Math.pow((p[0]-c[0])*(-u[1]) + (p[1]-c[1])*u[0], 2) : s, 0);
    const rFit = rss([mx,my], [Math.cos(th), Math.sin(th)]);
    const rSam = rss(a, [Math.cos(sampleTh), Math.sin(sampleTh)]);
    ok('and it fits the fourteen better than the two did', rFit < rSam,
       rFit.toFixed(4) + ' vs ' + rSam.toFixed(4));
  }

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f => console.log('  ✗', f));
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
})();

setTimeout(() => {
  console.log('\n  FAIL  still running after every check finished');
  process.exit(1);
}, 30000).unref();
