/* hough-vote draws its whole argument with strokes, so this suite records the
   strokes and does the arithmetic on them. Nothing here reads a pixel: it
   inverts the panel transforms and checks the geometry the component claims.

   The claims, in the order the slide makes them:

     1. one image point traces a STRAIGHT LINE in (m, b), namely b = y - mx.
     2. while the line turns, the dot in the right panel is the line in the
        left panel. That linkage is the slide; if the panels ever drift apart
        the animation is decoration. Checked mid-sweep.
     3. three collinear points give three CONCURRENT traces, crossing at
        (0.6, 0.05), and the line drawn back passes through all three.
     4. moved onto a near-vertical line, the same three points give traces
        that cross NOWHERE ON THE CHART. This is the one the deck used to
        assert and now demonstrates, so it is the one worth pinning down:
        every pairwise crossing must fall outside the m window.
     5. in (theta, rho) the same points vote along rho = x cos t + y sin t,
        and the crossing is back inside the window.

   The panel transforms are hard-coded here on purpose. A suite that imported
   them from the component could only prove it agrees with itself.

   Run: node test/hough-vote.checks.js                                         */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','hough-vote.html');
const html = fs.readFileSync(FILE, 'utf8');

const W = 1000, H = 552, PAD = 34, SC = W - 2*PAD, YMAX = (H - 2*PAD)/SC;
const M0 = -1.4, M1 = 2.6, B0 = -1.5, B1 = 1.6;
const T0 = -Math.PI/2, T1 = Math.PI/2, R0 = -1.2, R1 = 1.2;
const CFG_A = [[0.14,0.134],[0.42,0.302],[0.72,0.482]];
const CFG_B = [[0.41875,0.10],[0.44,0.27],[0.46125,0.44]];
const AM = 0.6, AB = 0.05, RT = Math.sqrt(65);
const TT = Math.atan2(-1/RT, 8/RT), TR = 3.25/RT;
const COL = ['#e7a44c','#6ea8ff','#46d6c0'], CORAL = '#e56a5a';

const unx = X => (X - PAD)/SC,  uny = Y => (H - PAD - Y)/SC;
const unm = X => M0 + (X - PAD)/SC*(M1 - M0);
const unb = Y => B0 + (H - PAD - Y)/(H - 2*PAD)*(B1 - B0);
const unt = X => T0 + (X - PAD)/SC*(T1 - T0);
const unr = Y => R0 + (H - PAD - Y)/(H - 2*PAD)*(R1 - R0);

const drawn = [];
function fakeCtx(canvas){
  let pts = [];
  const c = {
    canvas, fillStyle:'#000', strokeStyle:'#000', lineWidth:1, font:'',
    lineJoin:'', lineCap:'',
    clearRect(){}, fillRect(){}, strokeRect(){}, fillText(){},
    measureText(t){ return { width: (t || '').length * 12 }; },
    save(){}, restore(){}, translate(){}, rotate(){}, scale(){},
    beginPath(){ c._arc = false; pts = []; },
    moveTo(x,y){ pts.push([x,y]); },
    lineTo(x,y){ pts.push([x,y]); },
    arc(x,y,r){ pts.push([x,y]); c._r = r; c._arc = true; },
    stroke(){ if(pts.length) drawn.push({on:canvas.className, kind:c._arc?'ring':'path',
                                        pts:pts.slice(), style:c.strokeStyle}); },
    fill(){ if(pts.length) drawn.push({on:canvas.className, kind:c._arc?'dot':'fill',
                                      pts:pts.slice(), style:c.fillStyle}); },
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; },
    putImageData(){}, drawImage(){},
    getImageData(sx,sy,w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; }
  };
  return c;
}

const errs = [], fails = [];
const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext = function(){ return fakeCtx(this); };
    // w.setTimeout, NOT the bare global: a plain setTimeout here schedules on
    // node's clock, which window.close() cannot reach, so a component that is
    // mid-animation would outlive the document and hang the process
    w.requestAnimationFrame = fn => w.setTimeout(()=>fn(0), 16);
    w.cancelAnimationFrame = id => w.clearTimeout(id);
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };
const near = (a,b,t) => Math.abs(a-b) <= t;
const last = (on, style, kind) => {
  for(let i = drawn.length-1; i >= 0; i--){
    const d = drawn[i];
    if(d.on.includes(on) && d.style === style && (!kind || d.kind === kind)) return d;
  }
  return null;
};

const d = dom.window.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const next = async ms => { d.getElementById('sbNext').click(); await sleep(ms); };

(async () => {
  await sleep(400);
  console.log('--- the panel came up ---');
  ok('seven step chips, one per stage', d.querySelectorAll('.steps .s').length === 7,
     d.querySelectorAll('.steps .s').length + ' chips');
  ok('the slope-intercept equation is the one showing',
     d.querySelector('.hv-mb').classList.contains('on') &&
     !d.querySelector('.hv-tr').classList.contains('on'));

  drawn.length = 0;
  await next(800);                                  // step 1, caught mid-sweep
  console.log('\n--- mid-sweep, the dot IS the line ---');
  {
    const line = last('hv-img', COL[0], 'path'), dot = last('hv-par', COL[0], 'dot');
    ok('a line is being drawn through the first point', !!line);
    ok('and a vote is being cast for it in (m, b)', !!dot);
    if(line && dot){
      const [x1,y1] = line.pts[0], [x2,y2] = line.pts[1];
      const mLine = (uny(y2) - uny(y1)) / (unx(x2) - unx(x1));
      const mDot = unm(dot.pts[0][0]), bDot = unb(dot.pts[0][1]);
      ok('the slope on the left is the m on the right', near(mLine, mDot, 0.02),
         'line ' + mLine.toFixed(4) + ' vs dot ' + mDot.toFixed(4));
      ok('and the vote satisfies b = y - mx for that point',
         near(bDot, CFG_A[0][1] - mDot*CFG_A[0][0], 0.01));
      ok('caught genuinely mid-sweep', mDot > M0 && mDot < M1 - 0.05,
         'm = ' + mDot.toFixed(3));
    }
  }

  await next(2100); await next(1600);               // steps 2 and 3
  console.log('\n--- one point, one straight line in (m, b) ---');
  {
    const tr = CFG_A.map((_, i) => last('hv-par', COL[i], 'path'));
    ok('all three traces are drawn', tr.every(Boolean));
    tr.forEach((t, i) => {
      if(!t) return;
      const [x0, y0] = CFG_A[i];
      const err = Math.max(...[t.pts[0], t.pts[t.pts.length-1]]
        .map(q => Math.abs(unb(q[1]) - (y0 - unm(q[0])*x0))));
      ok('point ' + (i+1) + ': both ends satisfy b = y - mx', err < 0.005,
         'worst ' + err.toFixed(5));
    });
    const ring = last('hv-par', CORAL, 'ring');
    ok('the crossing is marked at (0.60, 0.05)', !!ring && near(unm(ring.pts[0][0]), AM, 0.01)
       && near(unb(ring.pts[0][1]), AB, 0.01));
    const back = last('hv-img', CORAL, 'path');
    ok('a line is drawn back into image space', !!back);
    if(back){
      const err = Math.max(...[back.pts[0], back.pts[back.pts.length-1]]
        .map(q => Math.abs(uny(q[1]) - (AM*unx(q[0]) + AB))));
      ok('it is exactly the line the crossing names', err < 0.004, 'worst ' + err.toFixed(5));
      ok('and all three points lie on it',
         Math.max(...CFG_A.map(([x,y]) => Math.abs(y - (AM*x + AB)))) < 1e-6);
    }
  }

  await next(1600);                                 // step 4: the points move
  console.log('\n--- the same three points, moved near-vertical ---');
  {
    const at = CFG_B.map((_, i) => last('hv-img', COL[i], 'dot'));
    ok('all three points are drawn in their new places', at.every(Boolean));
    const err = Math.max(...at.map((p, i) => p ? Math.hypot(unx(p.pts[0][0]) - CFG_B[i][0],
                                                            uny(p.pts[0][1]) - CFG_B[i][1]) : 9));
    ok('they arrive exactly on y = 8x - 3.25', err < 0.004, 'worst ' + err.toFixed(5));
    ok('which is near-vertical: 4.3% of the frame wide, 34% tall',
       Math.max(...CFG_B.map(p=>p[0])) - Math.min(...CFG_B.map(p=>p[0])) < 0.05);
  }

  drawn.length = 0;
  await next(2200);                                 // step 5: the sweep that fails
  console.log('\n--- and now no crossing is on the chart ---');
  {
    const tr = CFG_B.map((_, i) => last('hv-par', COL[i], 'path'));
    ok('all three traces are drawn again', tr.every(Boolean));
    // each trace is b = y - mx; solve every pair and require the crossing out
    for(let i = 0; i < 3; i++) for(let j = i+1; j < 3; j++){
      const mx = (CFG_B[j][1] - CFG_B[i][1]) / (CFG_B[j][0] - CFG_B[i][0]);
      ok('traces ' + (i+1) + ' and ' + (j+1) + ' cross outside the m window',
         mx < M0 || mx > M1, 'at m = ' + mx.toFixed(2));
    }
    ok('no peak is marked, because there is none to mark',
       !last('hv-par', CORAL, 'ring'));
  }

  drawn.length = 0;
  await next(3000);                                 // step 6: angle and distance
  console.log('\n--- angle and perpendicular distance put it back ---');
  {
    ok('the equation swapped to the polar form',
       d.querySelector('.hv-tr').classList.contains('on') &&
       !d.querySelector('.hv-mb').classList.contains('on'));
    ok('and the panel is relabelled',
       d.querySelector('.hv-name').textContent.indexOf('θ') > 0,
       d.querySelector('.hv-name').textContent);
    const tr = CFG_B.map((_, i) => last('hv-par', COL[i], 'path'));
    ok('all three traces are drawn', tr.every(Boolean));
    tr.forEach((t, i) => {
      if(!t) return;
      const [x0, y0] = CFG_B[i];
      const err = Math.max(...t.pts.map(q => {
        const th = unt(q[0]);
        return Math.abs(unr(q[1]) - (x0*Math.cos(th) + y0*Math.sin(th)));
      }));
      ok('point ' + (i+1) + ': every sample satisfies ρ = x cos θ + y sin θ', err < 0.005,
         t.pts.length + ' samples, worst ' + err.toFixed(5));
      ok('point ' + (i+1) + ': and its trace passes through the crossing',
         near(x0*Math.cos(TT) + y0*Math.sin(TT), TR, 1e-9));
    });
    const ring = last('hv-par', CORAL, 'ring');
    ok('the crossing is marked', !!ring);
    if(ring) ok('and it is inside the window this time',
      near(unt(ring.pts[0][0]), TT, 0.01) && near(unr(ring.pts[0][1]), TR, 0.01)
      && TT > T0 && TT < T1 && TR > R0 && TR < R1,
      'θ ' + (TT*180/Math.PI).toFixed(1) + '°, ρ ' + TR.toFixed(3));
  }

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f => console.log('  ✗', f));
  // close the window before exiting: jsdom keeps driving timers while it is
  // open, and a component mid-animation would hold this process open
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
})();

// unref'd, so a clean run exits long before it fires; if anything is still
// holding the loop open this fails in half a minute instead of at CI's
// six-hour ceiling, which reports nothing at all
setTimeout(() => {
  console.log('\n  FAIL  still running after every check finished — something is '
            + 'holding the event loop open');
  process.exit(1);
}, 30000).unref();
