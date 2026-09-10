/* The slide makes three claims and this suite holds it to all three.

   The epipole is where the baseline pierces the image plane. So each drawn
   epipole has to sit ON the screen segment between the two centres and INSIDE
   its own card — and both of those survive projection, so they can be read
   straight off the canvas.

   The epipolar line is the line through x and e. Checked the same way: the line
   drawn on a card passes through that camera's own image point and its own
   epipole, and stops on the card's boundary rather than running past it.

   The constraint is the last one and the reason the slide exists: as X slides
   along the ray from O, x does not move and x' runs along l'. That is asserted
   frame by frame — the moving image point is tested against the line that was
   drawn one step earlier, not against a fresh computation of its own.

   EVEN MOTION IS CHECKED BY THE TREND OF THE SCREEN GAPS, and it has to be.
   The obvious test — cross-ratio, which a projection cannot change — is vacuous
   here: both this schedule and the inverse-depth one it replaced are Mobius
   functions of the frame parameter, so every projective invariant agrees between
   them and both score exactly 4/3. Even spacing is an affine property, and
   recovering it from a projection needs the vanishing point of the ray, which is
   nowhere on the canvas.

   What does separate them is the direction of the trend. A point moving evenly
   away from the eye covers less screen each frame, so the gaps fall. Ticking in
   inverse depth holds the gaps roughly level and, over the range this component
   used to sweep, made them grow by a factor of about 28 — the point crawled near
   O and then raced away, which is the complaint that prompted the change.

   Run: node test/epipolar-lines.checks.js                                      */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','epipolar-lines.html');
const html = fs.readFileSync(FILE, 'utf8');

const drawn = [];
function fakeCtx(){
  let pts = [];
  const c = {
    fillStyle:'#000', strokeStyle:'#000', lineWidth:1, globalAlpha:1, font:'',
    textAlign:'left', textBaseline:'top', _stack:[],
    clearRect(){ drawn.push({kind:'clear'}); }, fillRect(){}, strokeRect(){}, drawImage(){},
    save(){ c._stack.push(c._dash); }, restore(){ c._dash = c._stack.pop(); },
    clip(){}, rect(){}, translate(){}, rotate(){}, scale(){}, setTransform(){},
    setLineDash(a){ c._dash = !!(a && a.length); }, closePath(){ c._closed = true; },
    quadraticCurveTo(){}, ellipse(){}, putImageData(){},
    measureText(t){ return {width:(t||'').length*7}; },
    fillText(t,x,y){ drawn.push({kind:'text', text:String(t), x, y}); },
    beginPath(){ c._arc = undefined; c._closed = false; pts = []; },
    moveTo(x,y){ pts.push([x,y]); }, lineTo(x,y){ pts.push([x,y]); },
    arc(x,y,r){ pts.push([x,y]); c._arc = r; },
    stroke(){ if(pts.length) drawn.push({kind: c._arc !== undefined ? 'ring' : 'path',
      pts: pts.slice(), w: c.lineWidth, r: c._arc, closed: c._closed}); },
    fill(){ if(pts.length) drawn.push({kind: c._arc !== undefined ? 'disc' : 'shade',
      pts: pts.slice(), r: c._arc}); },
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; },
    getImageData(x,y,w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; }
  };
  return c;
}

const W = 690, H = 400;
const dist = (p,q) => Math.hypot(p[0]-q[0], p[1]-q[1]);
const off = (a,b,c) => {                       // distance of c from the line ab
  const vx = b[0]-a[0], vy = b[1]-a[1];
  return Math.abs((c[0]-a[0])*vy - (c[1]-a[1])*vx)/Math.hypot(vx, vy);
};
const between = (a,b,c) => {                   // c within the span of ab
  const L = dist(a,b);
  return dist(a,c) <= L + 1e-6 && dist(b,c) <= L + 1e-6;
};
const inPoly = (pt, ply) => {
  let hits = 0;
  for(let i = 0; i < ply.length; i++){
    const p1 = ply[i], p2 = ply[(i+1)%ply.length];
    if((p1[1] > pt[1]) !== (p2[1] > pt[1]) &&
       pt[0] < (p2[0]-p1[0])*(pt[1]-p1[1])/(p2[1]-p1[1]) + p1[0]) hits++;
  }
  return hits % 2 === 1;
};
// how far a point is from a polygon's outline, walking every edge
const toOutline = (pt, ply) => {
  let best = Infinity;
  for(let i = 0; i < ply.length; i++){
    const a = ply[i], b = ply[(i+1)%ply.length];
    const vx = b[0]-a[0], vy = b[1]-a[1], L2 = vx*vx + vy*vy;
    const t = Math.max(0, Math.min(1, ((pt[0]-a[0])*vx + (pt[1]-a[1])*vy)/L2));
    best = Math.min(best, dist(pt, [a[0]+vx*t, a[1]+vy*t]));
  }
  return best;
};
const errs = [], fails = [];
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };

// the animation is driven by hand: callbacks are queued here and released with
// timestamps the test chooses, so every frame lands on a slide fraction it knows
const q = [];
const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext = function(){ return fakeCtx(); };
    w.requestAnimationFrame = fn => q.push(fn);
    w.cancelAnimationFrame = () => { q.length = 0; };
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const d = dom.window.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const since = () => {
  const last = drawn.map((o,i)=>[o.kind,i]).filter(([k])=>k==='clear').pop();
  return drawn.slice(last ? last[1] + 1 : 0);
};
async function to(n){
  q.length = 0;
  d.getElementById('sbReset').click(); await sleep(30);
  for(let i = 0; i < n; i++){ d.getElementById('sbNext').click(); await sleep(30); }
  await sleep(50);
  return since();
}
// release every queued callback at ts, and hand back what that frame drew
function flush(ts){
  const c = q.splice(0);
  c.forEach(fn => fn(ts));
  return since();
}
const discs = (f, r) => f.filter(o => o.kind === 'disc' && Math.abs(o.r - r) < .01)
                         .map(o => o.pts[0]);
const ring = (f, r) => (f.find(o => o.kind === 'ring' && Math.abs(o.r - r) < .01) || {}).pts;
const cards = f => f.filter(o => o.kind === 'path' && o.closed && o.pts.length === 4)
                    .map(o => o.pts);
const lines = f => f.filter(o => o.kind === 'path' && !o.closed && o.pts.length === 2 &&
                                 Math.abs(o.w - 1.8) < .01).map(o => o.pts);
const texts = f => f.filter(o => o.kind === 'text').map(o => o.text);

(async () => {
  await sleep(400);
  console.log('--- the figure it inherits ---');
  ok('four step chips', d.querySelectorAll('.steps .s').length === 4);

  let f = await to(0);
  const centres = discs(f, 4.5).sort((a,b) => a[0]-b[0]);   // O left, O' right
  const XS = discs(f, 5)[0];
  ok('two camera centres and the world point', centres.length === 2 && !!XS);
  ok('two image planes', cards(f).length === 2, cards(f).length + ' found');
  ok('no epipoles yet', discs(f, 4).length === 0 && !texts(f).includes('e'));
  ok('and no epipolar lines yet', lines(f).length === 0);

  // pair each card with the centre it belongs to: a camera's own image point is
  // the one on the segment from that centre to X, and it lies on its own card
  const images = discs(f, 3.6);
  const own = centres.map(c => images.reduce((m,p) =>
    off(c, XS, p) < off(c, XS, m) ? p : m, images[0]));
  const cardOf = own.map(p => cards(f).find(q2 => inPoly(p, q2)));
  ok('each camera has its own card and its own image point',
     cardOf.every(Boolean) && own[0] !== own[1]);

  // The two vectors are the reason this slide can hand the next one something to
  // reason with, so they are on screen from the start and stay there. A label
  // that goes away and comes back reads as a new object, not the one just named.
  console.log('\n--- X_O and X_O′ are there the whole way through ---');
  for(let n = 0; n <= 3; n++){
    const fr = await to(n);
    const XN = discs(fr, 5).find(p2 => {
      const c = ring(fr, 9.5);                       // at step 3 the copy is a disc too
      return !c || dist(p2, c[0]) > 1;
    });
    const arrows = fr.filter(o => o.kind === 'shade' && o.pts.length === 3 &&
      dist(o.pts[0], XN) < 1e-9 &&
      Math.max(...o.pts.map(p2 => dist(p2, o.pts[0]))) < 20);
    const Xs = texts(fr).filter(t => t === 'X').length;
    ok('step ' + n + ': both vectors are drawn, arrowheads on X',
       arrows.length === 2, arrows.length + ' arrowhead(s) at X');
    ok('step ' + n + ': and both are labelled, subscripted O and O′',
       Xs === 3 && texts(fr).includes('O') && texts(fr).includes('O′'),
       Xs + ' X label(s): the point itself and one per vector');
  }

  console.log('\n--- step 1: where the baseline pierces each plane ---');
  f = await to(1);
  const epi = discs(f, 4);
  ok('two epipoles are drawn', epi.length === 2, epi.length + ' found');
  const onBase = epi.map(e => off(centres[0], centres[1], e));
  ok('each lies on the baseline, the line joining the two centres',
     Math.max(...onBase) < 1e-9, 'worst ' + Math.max(...onBase).toExponential(1) + ' px');
  ok('and between the centres, not out beyond one of them',
     epi.every(e => between(centres[0], centres[1], e)));
  // e belongs to O's card and e' to O''s: the epipole is where THIS camera sees
  // the other, so it has to fall inside the card it is drawn on
  const epiCard = epi.map(e => cards(f).findIndex(q2 => inPoly(e, q2)));
  ok('each falls inside an image plane', epiCard.every(i => i >= 0),
     JSON.stringify(epiCard));
  ok('one on each, not both on the same one', epiCard[0] !== epiCard[1]);
  ok('and they are labelled e and e′',
     texts(f).includes('e') && texts(f).includes('e′'));

  console.log('\n--- step 2: the line through x and e ---');
  f = await to(2);
  const ln = lines(f);
  ok('two epipolar lines are drawn', ln.length === 2, ln.length + ' found');
  ok('labelled l and l′', texts(f).includes('l') && texts(f).includes('l′'));

  // match each line to the card it lies on, then check it against that camera's
  // own x and own e — the whole content of "the epipolar line goes through both"
  const ep2 = discs(f, 4), im2 = discs(f, 3.6), cd2 = cards(f);
  const per = cd2.map(card => {
    const line = ln.find(s => inPoly([(s[0][0]+s[1][0])/2, (s[0][1]+s[1][1])/2], card));
    return { card, line,
             e: ep2.find(p => inPoly(p, card)),
             x: im2.find(p => inPoly(p, card)) };
  });
  ok('each card carries one line, one epipole and one image point',
     per.every(p => p.line && p.e && p.x));
  const thruX = per.map(p => off(p.line[0], p.line[1], p.x));
  const thruE = per.map(p => off(p.line[0], p.line[1], p.e));
  ok('every line passes through that camera\'s image point',
     Math.max(...thruX) < 1e-9, 'worst ' + Math.max(...thruX).toExponential(1) + ' px');
  ok('and through that camera\'s own epipole',
     Math.max(...thruE) < 1e-9, 'worst ' + Math.max(...thruE).toExponential(1) + ' px');
  // "stretching from one side of the image plane to the other": both ends sit on
  // the card's outline, so the line is clipped to the plane and fills it
  const ends = per.flatMap(p => [toOutline(p.line[0], p.card), toOutline(p.line[1], p.card)]);
  ok('and stops on the boundary of its plane at both ends',
     Math.max(...ends) < 1e-6, 'worst end ' + Math.max(...ends).toExponential(1) + ' px out');

  console.log('\n--- step 3: x is fixed, x′ runs along l′ ---');
  f = await to(3);
  ok('the animation is running', q.length === 1, q.length + ' frame(s) queued');

  const DT = 420;                       // the sweep is 4200 ms, so 0.1 per frame
  flush(1000);                          // the first frame only starts the clock
  const track = [];
  for(let k = 1; k <= 8; k++){
    const fr = flush(1000 + DT*k);
    const copy = ring(fr, 9.5);
    const lp = lines(fr).find(s => inPoly([(s[0][0]+s[1][0])/2, (s[0][1]+s[1][1])/2],
                                          per[1].card));
    track.push({ p: copy && copy[0], moving: discs(fr, 4.2)[0], l2: lp,
                 x: discs(fr, 3.6), X: discs(fr, 5).find(p => !copy || dist(p, copy[0]) > 1) });
  }
  ok('a copy of X is drawn on every frame', track.every(t => t.p));
  const moved = dist(track[0].p, track[track.length-1].p);
  ok('and it slides along the ray', moved > 100, moved.toFixed(0) + ' px travelled');
  ok('while X itself stays put',
     track.every(t => t.X && dist(t.X, track[0].X) < 1e-9));
  ok('and x stays put too — knowing x is the premise, not the variable',
     track.every(t => t.x.every((p,i) => dist(p, track[0].x[i]) < 1e-9)));

  const onRay = track.map(t => off(centres[0], XS, t.p));
  ok('every position is on the ray from O through X',
     Math.max(...onRay) < 1e-9, 'worst ' + Math.max(...onRay).toExponential(1) + ' px');

  // the claim the slide is making
  const onL = track.map(t => t.l2 ? off(t.l2[0], t.l2[1], t.moving) : Infinity);
  ok('and its image in camera O′ is on l′ the whole way',
     Math.max(...onL) < 1e-9, 'worst ' + Math.max(...onL).toExponential(1) + ' px');
  ok('x′ actually moves along that line', dist(track[0].moving,
     track[track.length-1].moving) > 20,
     dist(track[0].moving, track[track.length-1].moving).toFixed(0) + ' px');

  // even motion along the ray, read off the only thing on the canvas that shows
  // it: a point receding at a steady speed covers less screen every frame
  const gaps = track.slice(1).map((t,i) => dist(t.p, track[i].p));
  ok('the copy slows on screen as it recedes, frame by frame',
     gaps.every((g,i) => i === 0 || g < gaps[i-1]),
     gaps.map(g => g.toFixed(1)).join(' → '));
  ok('and it is a real slowdown, not a level pace with rounding on it',
     gaps[0] > gaps[gaps.length-1]*1.25,
     'first gap ' + gaps[0].toFixed(1) + ' px, last ' +
     gaps[gaps.length-1].toFixed(1) + ' px');

  const inside = track.every(t => t.p[0] > 10 && t.p[0] < W-10 &&
                                  t.p[1] > 10 && t.p[1] < H-10);
  ok('the whole sweep stays on the canvas', inside,
     'x ' + Math.min(...track.map(t=>t.p[0])).toFixed(0) + '..' +
     Math.max(...track.map(t=>t.p[0])).toFixed(0) + ', y ' +
     Math.min(...track.map(t=>t.p[1])).toFixed(0) + '..' +
     Math.max(...track.map(t=>t.p[1])).toFixed(0));

  // a component that keeps rescheduling holds a test process open for ever
  d.getElementById('sbPrev').click(); await sleep(30);
  const before = q.length;
  flush(9000);
  ok('stepping back off the last step stops the animation', q.length === 0,
     before + ' queued before the frame, ' + q.length + ' after');

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f2 => console.log('  ✗', f2));
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
})();

setTimeout(() => { console.log('\n  FAIL  still running after every check finished');
  process.exit(1); }, 30000).unref();
