/* The slide claims the two centres, the world point and both of its images lie
   in one plane, "because the rays meet at X". That reason is the proof, and it
   is what this suite checks: the image point of each camera lies ON the segment
   from that camera's centre to X. Two lines that meet span a plane, and every
   one of the five points is on one of those two lines.

   Coplanarity itself cannot be read off a single projection — any four points
   look coplanar from somewhere. Collinearity can: a projection preserves it. So
   the collinear test is not a weaker substitute for the coplanar one, it is the
   argument the slide actually makes.

   Run: node test/epipolar-frames.checks.js                                     */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','epipolar-frames.html');
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

const dist = (p,q) => Math.hypot(p[0]-q[0], p[1]-q[1]);
// how far c sits off the line ab, in pixels
const off = (a,b,c) => {
  const vx = b[0]-a[0], vy = b[1]-a[1];
  return Math.abs((c[0]-a[0])*vy - (c[1]-a[1])*vx)/Math.hypot(vx, vy);
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
async function to(n){
  d.getElementById('sbReset').click(); await sleep(30);
  for(let i = 0; i < n; i++){ d.getElementById('sbNext').click(); await sleep(30); }
  await sleep(50);
  const last = drawn.map((o,i)=>[o.kind,i]).filter(([k])=>k==='clear').pop();
  return drawn.slice(last ? last[1] + 1 : 0);
}
const discs = (f, r) => f.filter(o => o.kind === 'disc' && Math.abs(o.r - r) < .01)
                         .map(o => o.pts[0]);

(async () => {
  await sleep(400);
  console.log('--- the figure ---');
  ok('four step chips', d.querySelectorAll('.steps .s').length === 4);

  let f = await to(0);
  const centres = discs(f, 4.5), X = discs(f, 5)[0], images = discs(f, 3.6);
  ok('two camera centres', centres.length === 2, centres.length + ' found');
  ok('one world point', !!X);
  ok('and one image point per camera', images.length === 2, images.length + ' found');

  const frames = f.filter(o => o.kind === 'path' && o.closed && o.pts.length === 4);
  ok('two image planes are drawn', frames.length === 2, frames.length + ' found');
  const onFrame = images.map(p => frames.some(q => inPoly(p, q.pts)));
  ok('each image point lands on an image plane', onFrame.every(Boolean),
     JSON.stringify(onFrame));

  // The epipole is where the baseline pierces the plane, so it lies on the
  // segment between the two centres AND in the plane. Projection restricted to a
  // plane is a homography, so a point of that segment falling inside the drawn
  // quad proves the epipole is inside the real one. The planes are sized for
  // this: the slides after this one draw epipoles and epipolar lines on them.
  const onBaseline = t => [centres[0][0] + (centres[1][0]-centres[0][0])*t,
                           centres[0][1] + (centres[1][1]-centres[0][1])*t];
  const holds = frames.map(q => {
    for(let i = 1; i < 400; i++) if(inPoly(onBaseline(i/400), q.pts)) return true;
    return false;
  });
  ok('each image plane is big enough to contain its epipole', holds.every(Boolean),
     JSON.stringify(holds));

  console.log('\n--- and that is why they are coplanar ---');
  // pair each centre with the image point on the segment from it to X
  const pairs = centres.map(c => {
    const im = images.reduce((m, p) => off(c, X, p) < off(c, X, m) ? p : m, images[0]);
    return { c, im, err: off(c, X, im),
             between: dist(c, im) < dist(c, X) && dist(im, X) < dist(c, X) };
  });
  ok('each image point lies on the line from its centre to X',
     Math.max(...pairs.map(p => p.err)) < 1e-9,
     'worst ' + Math.max(...pairs.map(p => p.err)).toExponential(1) + ' px');
  ok('and lies between them, not beyond either', pairs.every(p => p.between));
  ok('the two cameras take different image points', pairs[0].im !== pairs[1].im);

  console.log('\n--- what each step adds ---');
  // 3-point fills, but not every 3-point fill: the six axis arrowheads are
  // triangles, and so are the two O-x-e patches repainted in front of the cards.
  // The epipolar plane is identified by its corners, which is what it is.
  const has = (o, p) => o.pts.some(q => dist(p, q) < 1e-9);
  const tri = fr => fr.filter(o => o.kind === 'shade' && o.pts.length === 3 &&
    has(o, centres[0]) && has(o, centres[1]) && has(o, X));
  ok('no epipolar plane at step 0', tri(f).length === 0);
  f = await to(1);
  const t1 = tri(f);
  ok('one is shaded at step 1', t1.length === 1, t1.length + ' found');
  if(t1.length){
    const v = t1[0].pts;
    const near = p => Math.min(...v.map(q => dist(p, q)));
    ok('with its corners at O, O′ and X',
       Math.max(near(centres[0]), near(centres[1]), near(X)) < 1e-9);
  }

  // the stretch of the plane in front of each card: the triangle from a centre
  // to its image point to its epipole, repainted so the card does not dim it
  const fronts = f.filter(o => o.kind === 'shade' && o.pts.length === 3 &&
    centres.some(c => has(o, c)) && images.some(p => has(o, p)));
  ok('two patches of the plane are repainted in front of the cards',
     fronts.length === 4, fronts.length/2 + ' (each drawn twice: erase, then tint)');
  const corners = centres.map(c => fronts.filter(o => has(o, c)).length);
  ok('one patch per camera, each anchored on that camera and its image point',
     corners.every(n => n === 2), JSON.stringify(corners));

  f = await to(2);
  // the arrowheads: small filled triangles gathered at X. Asking only that ONE
  // vertex be at X catches the epipolar plane too — its corner is X as well.
  const heads = f.filter(o => o.kind === 'shade' && o.pts.length === 3 &&
                              Math.max(...o.pts.map(p => dist(p, X))) < 20);
  ok('at step 2 each ray gains an arrowhead at X', heads.length === 2,
     heads.length + ' found');
  const names = f.filter(o => o.kind === 'text').map(o => o.text);
  ok('and both vectors are named', names.filter(t => t === 'X').length >= 3,
     JSON.stringify(names.filter(t => /^[XO]/.test(t))));

  f = await to(3);
  // t: the baseline, arrowheaded at O'. Its point has to be O' exactly — t is
  // where O' is, so an arrow stopping short of it is drawing a different vector
  // small, and tipped at a centre. Size matters here: the epipolar plane and
  // both front wedges are three-point fills that also START at a centre.
  const tHead = f.filter(o => o.kind === 'shade' && o.pts.length === 3 &&
                              Math.max(...o.pts.map(p => dist(p, o.pts[0]))) < 20 &&
                              centres.some(c => dist(o.pts[0], c) < 1e-9));
  ok('the baseline gains an arrowhead whose point is a camera centre',
     tHead.length === 1, tHead.length + ' found');
  if(tHead.length){
    ok('and that centre is O′, the end t points to',
       dist(tHead[0].pts[0], centres[1]) < 1e-9,
       'tip ' + tHead[0].pts[0].map(Math.round).join(',') +
       ' vs O′ ' + centres[1].map(Math.round).join(','));
  }
  const mid = [(centres[0][0]+centres[1][0])/2, (centres[0][1]+centres[1][1])/2];
  ok('and it is labelled t, near the middle of the baseline',
     f.some(o => o.kind === 'text' && o.text === 't' && dist([o.x, o.y], mid) < 40));

  ok('the equation arrives with the last step',
     d.querySelectorAll('.ef-row.on').length === 4,
     d.querySelectorAll('.ef-row.on').length + ' rows shown');

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f2 => console.log('  ✗', f2));
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
})();

setTimeout(() => { console.log('\n  FAIL  still running after every check finished');
  process.exit(1); }, 30000).unref();
