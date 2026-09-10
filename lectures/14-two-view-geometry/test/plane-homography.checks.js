/* The slide claims a plane maps to the image by a single 3x3. The diagram is
   only worth having if the picture IS that map, so this suite recovers the map
   from the picture and checks it against the one the slide names.

   Three things are read off the canvas calls: the book's quad on the ground, its
   quad on the image plane, and the four rays. From the first two, a homography
   is fitted by DLT — a fit, not a copy of the component's own H, so a component
   that drew the right corners by luck and the wrong ones by arithmetic would not
   pass. Then:

     * the fitted map sends each ground corner to its image corner
     * it is genuinely projective — an affine fit does not do the same job, which
       is what makes the slide's point rather than an easier one
     * every ray passes through the camera centre AND through the image corner
       it belongs to, which is the whole pinhole construction

   Run: node test/plane-homography.checks.js                                   */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','plane-homography.html');
const html = fs.readFileSync(FILE, 'utf8');

const drawn = [];
function fakeCtx(){
  let pts = [];
  const c = {
    fillStyle:'#000', strokeStyle:'#000', lineWidth:1, globalAlpha:1, font:'',
    textAlign:'left', textBaseline:'top',
    clearRect(){ drawn.push({kind:'clear'}); }, fillRect(){}, strokeRect(){},
    drawImage(){ drawn.push({kind:'image'}); },
    // save/restore has to be real for anything this stub reports. As no-ops, the
    // dash set for the plumb line survived into the next frame and every ray was
    // recorded as dashed — the suite then found no rays at all.
    _stack: [],
    save(){ c._stack.push(c._dash); },
    restore(){ c._dash = c._stack.pop(); },
    clip(){}, rect(){}, translate(){}, rotate(){}, scale(){},
    setTransform(){}, setLineDash(a){ c._dash = !!(a && a.length); },
    closePath(){ c._closed = true; },
    quadraticCurveTo(){}, ellipse(){}, putImageData(){},
    measureText(t){ return {width:(t||'').length*7}; },
    fillText(t,x,y){ drawn.push({kind:'text', text:String(t), x, y}); },
    beginPath(){ c._arc = false; c._closed = false; pts = []; },
    moveTo(x,y){ pts.push([x,y]); }, lineTo(x,y){ pts.push([x,y]); },
    arc(x,y,r){ pts.push([x,y]); c._arc = r; },
    stroke(){ if(pts.length) drawn.push({kind: c._arc ? 'ring' : 'path',
      pts: pts.slice(), w: c.lineWidth, r: c._arc, closed: c._closed,
      dash: !!c._dash, style: c.strokeStyle}); },
    fill(){ if(pts.length) drawn.push({kind:'dot', pts: pts.slice(), r: c._arc}); },
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; },
    getImageData(x,y,w,h){ return {data:new Uint8ClampedArray(w*h*4).fill(128), width:w, height:h}; }
  };
  return c;
}

// --- a homography from four correspondences, by DLT ------------------------
function solve(A, b){                       // Gaussian elimination, n x n
  const n = b.length, M = A.map((r,i) => r.concat([b[i]]));
  for(let c = 0; c < n; c++){
    let p = c;
    for(let r = c+1; r < n; r++) if(Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for(let r = 0; r < n; r++){
      if(r === c) continue;
      const f = M[r][c]/M[c][c];
      for(let k = c; k <= n; k++) M[r][k] -= f*M[c][k];
    }
  }
  return M.map((r,i) => r[n]/r[i][i] !== undefined ? r[n]/r[i][i] : 0)
          .map((v,i) => M[i][n]/M[i][i]);
}
function fitH(src, dst){
  const A = [], b = [];
  for(let i = 0; i < 4; i++){
    const [x,y] = src[i], [u,v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u*x, -u*y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v*x, -v*y]); b.push(v);
  }
  const h = solve(A, b);
  return [[h[0],h[1],h[2]], [h[3],h[4],h[5]], [h[6],h[7],1]];
}
const applyH = (H, p) => {
  const w = H[2][0]*p[0] + H[2][1]*p[1] + 1;
  return [(H[0][0]*p[0] + H[0][1]*p[1] + H[0][2])/w,
          (H[1][0]*p[0] + H[1][1]*p[1] + H[1][2])/w];
};
function fitAffine(src, dst){               // the same fit with the projective part forced to zero
  const A = [], b = [];
  for(let i = 0; i < 4; i++){
    const [x,y] = src[i], [u,v] = dst[i];
    A.push([x, y, 1, 0, 0, 0]); b.push(u);
    A.push([0, 0, 0, x, y, 1]); b.push(v);
  }
  // least squares on an over-determined 8x6: normal equations
  const N = Array.from({length:6}, () => new Array(6).fill(0)), r = new Array(6).fill(0);
  for(let i = 0; i < A.length; i++)
    for(let j = 0; j < 6; j++){
      r[j] += A[i][j]*b[i];
      for(let k = 0; k < 6; k++) N[j][k] += A[i][j]*A[i][k];
    }
  const a = solve(N, r);
  return p => [a[0]*p[0] + a[1]*p[1] + a[2], a[3]*p[0] + a[4]*p[1] + a[5]];
}
const dist = (p,q) => Math.hypot(p[0]-q[0], p[1]-q[1]);

const errs = [], fails = [];
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };
const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext = function(){ return fakeCtx(); };
    w.requestAnimationFrame = fn => w.setTimeout(()=>fn(0), 16);
    w.cancelAnimationFrame = id => w.clearTimeout(id);
    Object.defineProperty(w.HTMLImageElement.prototype, 'src', {set(){ const s = this;
      Object.defineProperty(s,'width',{value:260,configurable:true});
      Object.defineProperty(s,'height',{value:359,configurable:true});
      setTimeout(()=>s.onload && s.onload(), 0); }, get(){ return ''; }});
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const d = dom.window.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await sleep(500);
  const last = drawn.map((o,i)=>[o.kind,i]).filter(([k])=>k==='clear').pop();
  const frame = drawn.slice(last ? last[1] : 0);

  console.log('--- what the diagram drew ---');
  // the two book outlines are the closed 4-point paths at width 1.6 and 1.3
  const quads = frame.filter(o => o.kind === 'path' && o.closed && o.pts.length === 4);
  ok('the sensor frame and the two book outlines are drawn', quads.length === 3,
     quads.length + ' closed quads');
  const area = q => Math.abs((q.pts[2][0]-q.pts[0][0])*(q.pts[3][1]-q.pts[1][1])
                           - (q.pts[3][0]-q.pts[1][0])*(q.pts[2][1]-q.pts[0][1]))/2;
  // colours are useless here — jsdom resolves every token to one fallback — so
  // the quads are told apart by stroke width. When the ground was still drawn,
  // its boundary shared a width with the image outline and was far bigger; an
  // early draft took it for the book and then "verified" a homography between
  // the ground and the book, which four points always have.
  const onGround = quads.filter(q => Math.abs(q.w - 1.6) < .01);
  ok('exactly one quad is drawn at the book-on-the-ground width', onGround.length === 1);
  const rest = quads.filter(q => q !== onGround[0]).sort((a,b) => area(a) - area(b));
  const ground = onGround[0].pts, image = rest[0].pts, sensor = rest[1].pts;
  ok('and the smallest of the others is its image, well inside the sensor frame',
     area(rest[0]) < area(rest[1])/3,
     Math.round(area(rest[0])) + ' px² inside ' + Math.round(area(rest[1])) + ' px²');
  ok('the image of the book is smaller than the book', area(rest[0]) < area(onGround[0]),
     Math.round(area(rest[0])) + ' vs ' + Math.round(area(onGround[0])) + ' px²');

  console.log('\n--- the map between them, fitted from the picture ---');
  const H = fitH(ground, image);
  const res = ground.map((p,i) => dist(applyH(H, p), image[i]));
  ok('a homography fitted to the two quads reproduces all four corners',
     Math.max(...res) < 1e-6, 'worst ' + Math.max(...res).toExponential(1) + ' px');
  const aff = fitAffine(ground, image);
  const affRes = ground.map((p,i) => dist(aff(p), image[i]));
  ok('and an affine map cannot — the warp really is projective',
     Math.max(...affRes) > 1.0, 'worst affine residual ' + Math.max(...affRes).toFixed(2) + ' px');

  console.log('\n--- the rays are the same construction seen twice ---');
  const dots = frame.filter(o => o.kind === 'dot' && Math.abs(o.r - 4.5) < .01);
  ok('the camera centre is drawn', dots.length === 1);
  const C = dots[0].pts[0];
  // Each ray is drawn in three parts: bright from O to where it pierces the
  // image plane, faint while the card hides it, bright again out to the book.
  const bright = frame.filter(o => o.kind === 'path' && o.pts.length === 2 && !o.dash &&
                                   Math.abs(o.w - 1.15) < .01);
  const faint  = frame.filter(o => o.kind === 'path' && o.pts.length === 2 && !o.dash &&
                                   Math.abs(o.w - 1) < .01);
  ok('eight bright segments and four faint ones', bright.length === 8 && faint.length === 4,
     bright.length + ' bright, ' + faint.length + ' faint');

  const at = (seg, p) => dist(seg.pts[0], p) < 1e-9 || dist(seg.pts[1], p) < 1e-9;
  const other = (seg, p) => dist(seg.pts[0], p) < 1e-9 ? seg.pts[1] : seg.pts[0];
  const colin = (a, b, c) => {
    const vx = b[0]-a[0], vy = b[1]-a[1], L = Math.hypot(vx, vy);
    return Math.abs((c[0]-a[0])*vy - (c[1]-a[1])*vx)/L;
  };

  const bad = [];
  for(let i = 0; i < 4; i++){
    const lead = bright.find(s2 => at(s2, C) && at(s2, image[i]));
    const hid  = faint.find(s2 => at(s2, image[i]));
    if(!lead || !hid){ bad.push('ray ' + i + ': missing a segment'); continue; }
    const X = other(hid, image[i]);
    const tail = bright.find(s2 => at(s2, X) && at(s2, ground[i]));
    if(!tail){ bad.push('ray ' + i + ': no segment from the card edge to the book'); continue; }
    // the three parts have to be one straight line, or they are not one ray
    bad.push(...[image[i], X, ground[i]].map(p => colin(C, ground[i], p))
                                        .filter(v => v > 1e-6).map(v => 'off by ' + v));
  }
  ok('each ray runs O → image corner → card edge → book corner, in one line',
     bad.length === 0, bad.slice(0,2).join('; ') || 'all four exact');

  // and the faint stretch is the bit the card covers, not an arbitrary gap
  const inside = faint.every(s2 => {
    const mid = [(s2.pts[0][0]+s2.pts[1][0])/2, (s2.pts[0][1]+s2.pts[1][1])/2];
    let hits = 0;                                  // ray casting against the frame
    for(let i = 0; i < 4; i++){
      const a = sensor[i], b = sensor[(i+1)%4];
      if((a[1] > mid[1]) !== (b[1] > mid[1]) &&
         mid[0] < (b[0]-a[0])*(mid[1]-a[1])/(b[1]-a[1]) + a[0]) hits++;
    }
    return hits % 2 === 1;
  });
  ok('and every faint stretch lies inside the image plane it is hidden by', inside);

  console.log('\n--- H arcs over the scene from one book to the other ---');
  const arcs = frame.filter(o => o.kind === 'path' && Math.abs(o.w - 1.8) < .01
                                 && o.pts.length > 10);
  ok('a curve is drawn for H', arcs.length === 1, arcs.length + ' found');
  if(arcs.length === 1){
    const a = arcs[0].pts;
    const mid = (p, q) => [(p[0]+q[0])/2, (p[1]+q[1])/2];
    const from = mid(ground[0], ground[1]), to = mid(image[0], image[1]);
    ok('it leaves the middle of the book\'s top edge', dist(a[0], from) < 22,
       dist(a[0], from).toFixed(1) + ' px away');
    ok('and arrives at the same point on the image', dist(a[a.length-1], to) < 12,
       dist(a[a.length-1], to).toFixed(1) + ' px away');
    // "clears the book" is not a height above the endpoints — it is that no part
    // of the curve crosses the book it is leaving. Measure that instead.
    const inPoly = (pt, ply) => {
      let hits = 0;
      for(let i = 0; i < ply.length; i++){
        const p1 = ply[i], p2 = ply[(i+1)%ply.length];
        if((p1[1] > pt[1]) !== (p2[1] > pt[1]) &&
           pt[0] < (p2[0]-p1[0])*(pt[1]-p1[1])/(p2[1]-p1[1]) + p1[0]) hits++;
      }
      return hits % 2 === 1;
    };
    const over = a.filter(p => inPoly(p, ground)).length;
    ok('and no part of it crosses the book it is leaving', over === 0,
       over + ' of ' + a.length + ' samples over the cover');
    // and it is a curve, not a straight line drawn between two points
    const chord = a.map(p => {
      const vx = a[a.length-1][0]-a[0][0], vy = a[a.length-1][1]-a[0][1];
      return Math.abs((p[0]-a[0][0])*vy - (p[1]-a[0][1])*vx)/Math.hypot(vx, vy);
    });
    ok('and it bows rather than running straight', Math.max(...chord) > 20,
       Math.max(...chord).toFixed(0) + ' px from the chord at its furthest');
  }

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f => console.log('  ✗', f));
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
})();

setTimeout(() => { console.log('\n  FAIL  still running after every check finished');
  process.exit(1); }, 30000).unref();
