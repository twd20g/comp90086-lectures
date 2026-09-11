/* The slide constructs one thing: a line from O' parallel to OX, carrying a copy
   of x. Everything after that follows from it, so the suite's job is to prove
   the construction is derived rather than drawn by hand.

   PARALLELISM CANNOT BE READ OFF THE CANVAS. A projection turns a parallelogram
   into a general quadrilateral -- one view of two parallel lines looks exactly
   like one view of two lines meeting at a point off-screen. So the direct test
   does not exist, and asserting screen directions match would be asserting
   something false.

   What survives projection is incidence, and that is enough. If Y = O' + (X - O)
   and Rx = O' + (x - O), then O'->O, Y->X and Rx->x are the same translation
   in 3D, so all three screen lines pass through that direction's vanishing point:
   they are CONCURRENT. Concurrency is projective, computable from four drawn dots
   and two constructed ones, and it pins both claims at once. It is also sharp --
   as drawn the 3x3 determinant of the three normalised lines is 1e-14; moving Y
   just 1% along its own direction takes it to 0.23, and 10% to 2.4.

   Run: node test/epipolar-rotate.checks.js                                     */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','epipolar-rotate.html');
const html = fs.readFileSync(FILE, 'utf8');

const drawn = [];
function fakeCtx(){
  let pts = [];
  const c = {
    fillStyle:'#000', strokeStyle:'#000', lineWidth:1, globalAlpha:1, font:'',
    textAlign:'left', textBaseline:'top', lineCap:'butt', _stack:[],
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
      pts: pts.slice(), r: c._arc, a: c.globalAlpha, op: c.globalCompositeOperation}); },
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; },
    getImageData(x,y,w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; }
  };
  return c;
}

const W = 690, H = 400;
const dist = (p,q) => Math.hypot(p[0]-q[0], p[1]-q[1]);
const off = (a,b,c) => {
  const vx = b[0]-a[0], vy = b[1]-a[1];
  return Math.abs((c[0]-a[0])*vy - (c[1]-a[1])*vx)/Math.hypot(vx, vy);
};
const between = (a,b,c) => dist(a,c) <= dist(a,b) + 1e-6 && dist(b,c) <= dist(a,b) + 1e-6;
const inPoly = (pt, ply) => {
  let hits = 0;
  for(let i = 0; i < ply.length; i++){
    const p1 = ply[i], p2 = ply[(i+1)%ply.length];
    if((p1[1] > pt[1]) !== (p2[1] > pt[1]) &&
       pt[0] < (p2[0]-p1[0])*(pt[1]-p1[1])/(p2[1]-p1[1]) + p1[0]) hits++;
  }
  return hits % 2 === 1;
};
// the line through two points, scaled so (a,b) is a unit vector — which makes
// the determinant below a pure, scale-free measure of how far from concurrent
const lineOf = (p,q) => {
  const l = [p[1]-q[1], q[0]-p[0], p[0]*q[1] - q[0]*p[1]];
  const k = Math.hypot(l[0], l[1]);
  return [l[0]/k, l[1]/k, l[2]/k];
};
const det3 = (a,b,c) =>
  a[0]*(b[1]*c[2] - b[2]*c[1]) - a[1]*(b[0]*c[2] - b[2]*c[0]) + a[2]*(b[0]*c[1] - b[1]*c[0]);

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
const discs = (f,r) => f.filter(o => o.kind==='disc' && Math.abs(o.r-r) < .01).map(o => o.pts[0]);
const cards = f => f.filter(o => o.kind==='path' && o.closed && o.pts.length===4).map(o => o.pts);
const eLines = f => f.filter(o => o.kind==='path' && !o.closed && o.pts.length===2 &&
                                  Math.abs(o.w-1.8) < .01).map(o => o.pts);
const chevs = f => f.filter(o => o.kind==='path' && o.pts.length===3 && Math.abs(o.w-1.7) < .01);
const texts = f => f.filter(o => o.kind==='text').map(o => o.text);
// small filled triangle whose first point is the tip
const heads = (f, at) => f.filter(o => o.kind==='shade' && o.pts.length===3 &&
  dist(o.pts[0], at) < 1e-9 && Math.max(...o.pts.map(p => dist(p, o.pts[0]))) < 20);

(async () => {
  await sleep(400);
  console.log('--- the figure it opens on ---');
  ok('four step chips', d.querySelectorAll('.steps .s').length === 4);

  let f = await to(0);
  const C = discs(f, 4.5).sort((a,b) => a[0]-b[0]), O = C[0], Op = C[1];
  const X = discs(f, 5)[0];
  ok('two centres and the world point', C.length === 2 && !!X);
  // the vocabulary is inherited, not rebuilt: it is on screen before any press
  ok('the epipoles are already there at step 0', discs(f, 4).length === 2);
  ok('and both epipolar lines too', eLines(f).length === 2,
     eLines(f).length + ' found');
  ok('X_O and X_O′ are already there as well',
     texts(f).filter(t => t === 'X').length === 3);
  ok('but nothing of the construction yet',
     !texts(f).includes('RX') && !texts(f).includes('Rx′') && chevs(f).length === 0);
  ok('and the text is still hidden', d.querySelectorAll('.er-row.on').length === 0);

  console.log('\n--- step 1: the line parallel to O′X ---');
  f = await to(1);
  ok('one paragraph of text is showing', d.querySelectorAll('.er-row.on').length === 1);

  // the wedge names Y: it is the corner that is neither O nor X, and the plane
  // is filled to it without an edge being drawn across the top
  const wedge = f.find(o => o.kind === 'shade' && o.pts.length === 3 &&
    Math.abs(o.a - .10) < 1e-9 &&
    o.pts.some(p => dist(p,O) < 1e-9) && o.pts.some(p => dist(p,X) < 1e-9) &&
    !o.pts.some(p => dist(p,Op) < 1e-9));
  ok('the plane is shaded on past O→X to the new line', !!wedge);
  const Y = wedge && wedge.pts.find(p => dist(p,O) > 1e-9 && dist(p,X) > 1e-9);
  ok('with its third corner at the end of that line', !!Y,
     Y ? Y.map(Math.round).join(',') : '');
  ok('and no edge drawn across the top — it is one plane, not a shape',
     !f.some(o => o.kind === 'path' && o.pts.length === 2 &&
       ((dist(o.pts[0],X) < 1e-9 && dist(o.pts[1],Y) < 1e-9) ||
        (dist(o.pts[0],Y) < 1e-9 && dist(o.pts[1],X) < 1e-9))));
  ok('the line is a vector: it carries an arrowhead at that end',
     heads(f, Y).length === 1);
  const startsAtO = f.some(o => o.kind === 'path' && o.pts.length === 2 &&
    dist(o.pts[0], O) < 1e-9 && off(O, Y, o.pts[1]) < 1e-9);
  ok('and it starts at O, running towards Y', startsAtO);

  // three r=3.6 dots now: each camera's image point, and the copy
  const dots = discs(f, 3.6);
  ok('a third small dot has appeared', dots.length === 3, dots.length + ' found');
  const x  = dots.find(p => off(O,  X, p) < 1e-9 && between(O,  X, p));
  const xp = dots.find(p => off(Op, X, p) < 1e-9 && between(Op, X, p));
  const Rx = dots.find(p => p !== x && p !== xp);
  ok('x is on O→X and x′ is on O′→X, as before', !!x && !!xp);
  ok('and the new one, Rx′, is on the new line', Rx && off(O, Y, Rx) < 1e-9,
     Rx ? off(O, Y, Rx).toExponential(1) + ' px off' : 'not found');
  ok('between O and the end of it', Rx && between(O, Y, Rx));

  // THE construction check: three screen lines, one vanishing point
  const D3 = Math.abs(det3(lineOf(O,Op), lineOf(Y,X), lineOf(Rx,xp)));
  ok('O→O′, Y→X and Rx′→x′ meet at one point, so both were laid off by the ' +
     'same translation — the line is parallel and Rx′ is the copy of x′',
     D3 < 1e-9, '|det| = ' + D3.toExponential(1) + '  (1% error would give 2e-1)');

  const cv = chevs(f);
  ok('chevrons mark both lines as parallel', cv.length === 4,
     cv.length + ' drawn, expected two per line');
  const onOwn = cv.filter(o => off(O,Y,o.pts[1]) < 1e-9).length;
  ok('two on each, each sitting on its own line', onOwn === 2,
     onOwn + ' on O→Y, ' + cv.filter(o => off(Op,X,o.pts[1]) < 1e-9).length + ' on O′→X');
  ok('and the new vector is labelled R X_O, its copy Rx',
     texts(f).includes('RX') && texts(f).includes('Rx'));

  ok('Y is comfortably on the canvas, so the figure did not have to move',
     Y[0] > 20 && Y[0] < W-20 && Y[1] > 20 && Y[1] < H-20,
     Y.map(Math.round).join(','));

  console.log('\n--- step 2: three vectors, one plane ---');
  f = await to(2);
  ok('the second paragraph arrives', d.querySelectorAll('.er-row.on').length === 2);
  ok('x gains an arrowhead of its own', heads(f, x).length === 1);
  ok('and so does Rx′', heads(f, Rx).length === 1);
  ok('t already had one at O′, so three arrows leave O', heads(f, Op).length === 1);
  ok('the triple product is on the slide',
     !!d.querySelector('.er-row[data-r="2"] .tex svg'));

  console.log('\n--- step 3: and that is the epipolar line ---');
  f = await to(3);
  ok('the last line of text arrives', d.querySelectorAll('.er-row.on').length === 3);
  ok('l = (t x Rx′) is on the slide',
     !!d.querySelector('.er-row[data-r="3"] .tex svg'));

  // l is what the equation produces, so l is the one that lights up. It is still
  // the same line: same two endpoints, clipped to the same card.
  const cardA = cards(f).find(q2 => inPoly(x, q2));
  const lit = f.filter(o => o.kind === 'path' && o.pts.length === 2 && o.w > 2 &&
    inPoly([(o.pts[0][0]+o.pts[1][0])/2, (o.pts[0][1]+o.pts[1][1])/2], cardA));
  ok('l is drawn heavier and haloed at the last step', lit.length === 2,
     lit.map(o => 'w=' + o.w).join(', '));
  ok('and it is the same line as before — through x and its own epipole',
     lit.every(o => off(o.pts[0], o.pts[1], x) < 1e-9));
  const e = discs(f, 4).find(p => inPoly(p, cardA));
  ok('still clipped to O\u2019s card, not redrawn free-hand',
     lit.every(o => off(o.pts[0], o.pts[1], e) < 1e-9));
  const lPrime = eLines(f).filter(o =>
    !inPoly([(o[0][0]+o[1][0])/2, (o[0][1]+o[1][1])/2], cardA));
  ok('l′ is left alone — the equation is about O\u2019s image, not O\u2032s',
     lPrime.length === 1, lPrime.length + ' thin line(s) off O\u2019s card');

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f2 => console.log('  ✗', f2));
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
})();

setTimeout(() => { console.log('\n  FAIL  still running after every check finished');
  process.exit(1); }, 30000).unref();
