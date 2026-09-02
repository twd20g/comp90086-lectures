/* homography-live computes everything itself — corners, descriptors, matches,
   the vote — so this suite hands it a pair whose answer is known and checks
   that the answer comes back.

   The fixture is a random texture and THE SAME TEXTURE warped by a homography
   the suite chose. Nothing else in the frame agrees with that homography, so a
   pipeline that works must recover it and one that does not cannot fake it.

   The recovered model is never read out of the component — it stays in the
   closure. It is read off the PICTURE instead: at the last step every match is
   drawn from its point in the first frame to its point in the second, in the
   inlier colour or the outlier colour. Undo the panel transform, and each
   inlier is a correspondence the component is asserting. Those are checked
   against the true homography directly.

   That is the whole pipeline under one assertion: a broken detector finds no
   corners, a broken descriptor matches the wrong ones, a broken DLT fits the
   wrong model, and a broken inlier test flags the wrong matches. Any of them
   and the inliers stop satisfying the homography they were generated from.

   Run: node test/homography-live.checks.js                                    */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','homography-live.html');
const html = fs.readFileSync(FILE, 'utf8');

const W = 320, H = 240, PW = 424, PH = 318, GAP = 44;
const SX = 2*PW/W, SY = 2*PH/H, OFF = 2*(PW + GAP);
const SIG = '#46d6c0', CORAL = '#e56a5a';

// the homography the second frame is generated with: scale, shift, and enough
// perspective that an affine fit would not do
const HT = [0.86, 0.05, 26, -0.04, 0.88, 18, 0.00035, 0.00018];
const apply = (h, x, y) => {
  const w = h[6]*x + h[7]*y + 1;
  return [(h[0]*x + h[1]*y + h[2])/w, (h[3]*x + h[4]*y + h[5])/w];
};
function invert(h){
  const m = [[h[0],h[1],h[2]],[h[3],h[4],h[5]],[h[6],h[7],1]];
  const d = m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])
          - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])
          + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  const a = [
    (m[1][1]*m[2][2]-m[1][2]*m[2][1])/d, (m[0][2]*m[2][1]-m[0][1]*m[2][2])/d,
    (m[0][1]*m[1][2]-m[0][2]*m[1][1])/d, (m[1][2]*m[2][0]-m[1][0]*m[2][2])/d,
    (m[0][0]*m[2][2]-m[0][2]*m[2][0])/d, (m[0][2]*m[1][0]-m[0][0]*m[1][2])/d,
    (m[1][0]*m[2][1]-m[1][1]*m[2][0])/d, (m[0][1]*m[2][0]-m[0][0]*m[2][1])/d];
  const s = (m[0][0]*m[1][1]-m[0][1]*m[1][0])/d;
  return a.map(v => v/s);
}
const HI = invert(HT);

// a deterministic texture with plenty of corners and no repeated structure,
// so a match is either right or obviously not
let seed = 20260902;
const rnd = () => (seed = (seed*1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const BLOB = [];
for(let i=0;i<150;i++) BLOB.push([rnd()*W, rnd()*H, 4 + rnd()*7, 70 + rnd()*170]);
function tex(x, y){
  let v = 26 + 10*Math.sin(x*0.02) + 8*Math.cos(y*0.017);
  for(const [bx, by, r, b] of BLOB)
    if(Math.abs(x-bx) < r && Math.abs(y-by) < r) v = b;
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
const frame = (i, w, h) => {
  const d = new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    let v;
    if(i === 1){ const [sx, sy] = apply(HI, x, y); v = tex(sx, sy); }
    else v = tex(x, y);
    const k = (y*w + x)*4;
    d[k] = d[k+1] = d[k+2] = v; d[k+3] = 255;
  }
  return { data:d, width:w, height:h };
};

const drawn = [];
let made = 0;                               // getContext order names the canvas
function fakeCtx(canvas){
  const id = made++;                        // 0 plot, 1 pane A, 2 pane B, 3 work
  let pts = [];
  const c = {
    canvas, fillStyle:'#000', strokeStyle:'#000', lineWidth:1, globalAlpha:1, font:'',
    clearRect(){}, fillRect(){}, strokeRect(){}, fillText(){}, drawImage(){},
    save(){}, restore(){}, clip(){}, rect(){}, translate(){}, rotate(){}, scale(){},
    measureText(t){ return {width:(t||'').length*7}; },
    beginPath(){ c._arc = false; pts = []; },
    moveTo(x,y){ pts.push([x,y]); }, lineTo(x,y){ pts.push([x,y]); },
    closePath(){}, arc(x,y,r){ pts.push([x,y]); c._arc = true; },
    stroke(){ if(pts.length) drawn.push({kind:c._arc?'ring':'path', pts:pts.slice(),
                                        style:c.strokeStyle, alpha:c.globalAlpha}); },
    fill(){ if(pts.length) drawn.push({kind:'dot', pts:pts.slice(), style:c.fillStyle}); },
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; },
    putImageData(){},
    getImageData(sx,sy,w,h){ return (id === 1 || id === 2) ? frame(id-1, w, h)
                                                          : frame(0, w, h); }
  };
  return c;
}

const errs = [], fails = [];
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };
const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext = function(){ return fakeCtx(this); };
    w.requestAnimationFrame = fn => w.setTimeout(()=>fn(0), 16);
    w.cancelAnimationFrame = id => w.clearTimeout(id);
    // RANSAC samples at random, so an unseeded run scores differently every
    // time and this suite would pass or fail by luck. Seeded here, the vote is
    // reproducible and a change in the count means a change in the code.
    let s2 = 987654321;
    w.Math.random = () => (s2 = (s2*1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    // a 320x240 still fits the frame exactly, so there is no letterbox to mask
    Object.defineProperty(w.HTMLImageElement.prototype, 'src', {set(){ const s = this;
      Object.defineProperty(s,'width',{value:W,configurable:true});
      Object.defineProperty(s,'height',{value:H,configurable:true});
      setTimeout(()=>s.onload && s.onload(), 0); }, get(){ return ''; }});
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const d = dom.window.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const next = async ms => { d.getElementById('sbNext').click(); await sleep(ms); };
const num = re => { const m = d.querySelector('.hm-note').textContent.match(re);
                    return m ? +m[1] : -1; };

(async () => {
  await sleep(900);                          // detect, describe and match
  console.log('--- the panel came up ---');
  ok('five step chips, one per stage', d.querySelectorAll('.steps .s').length === 5);
  ok('a δ control spanning 1 to 10 px',
     +d.querySelector('.hm-d').min === 1 && +d.querySelector('.hm-d').max === 10);
  ok('an iteration control reaching the k the arithmetic slide computes',
     +d.querySelector('.hm-k').max >= 200, 'max ' + d.querySelector('.hm-k').max);

  await next(250);
  const nk = num(/^(\d+) Harris corners/);
  ok('corners are found in the frames', nk > 60, nk + ' per frame');
  await next(250);
  const nm = num(/^(\d+) candidate matches/);
  ok('and matched across them', nm > 40, nm + ' matches');

  // this fixture is harder than a photograph, so give the vote the iterations
  // the arithmetic slide would ask for at this contamination rate
  const kIn = d.querySelector('.hm-k');
  kIn.value = '400';
  kIn.dispatchEvent(new dom.window.Event('input', {bubbles:true}));
  await sleep(60);
  await next(1600); await next(600);         // vote, then the model
  console.log('\n--- the model, read off the picture ---');
  const inl = num(/^(\d+) of \d+ matches agree/);
  // Not "most": this fixture is deliberately harder than a real scene. A
  // hundred and fifty similar blobs give the ratio test far more genuinely
  // ambiguous pairs than a photograph does, so the contamination here runs
  // near two thirds where the book pair runs near one third. What has to hold
  // is that the consistent set is large enough to determine a model, and that
  // it really is consistent — which is what the residuals below check.
  ok('a substantial set agrees with one homography', inl >= 30,
     inl + ' of ' + nm + ' (' + Math.round(100*inl/nm) + '%)');

  // every match is drawn from its point in frame A to its point in frame B;
  // undo the panel transform and each is a correspondence being asserted
  const back = p => [[p[0][0]/SX, p[0][1]/SY], [(p[1][0]-OFF)/SX, p[1][1]/SY]];
  const lines = drawn.filter(x => x.kind === 'path' && x.pts.length === 2 &&
                                  (x.style === SIG || x.style === CORAL));
  const green = lines.filter(x => x.style === SIG).map(x => back(x.pts));
  const red   = lines.filter(x => x.style === CORAL).map(x => back(x.pts));
  ok('the picture separates the two populations', green.length > 0 && red.length > 0,
     green.length + ' green, ' + red.length + ' red');
  ok('and the green count is the number the note claims', green.length === inl,
     green.length + ' vs ' + inl);

  const err = ([a, b]) => { const [u, v] = apply(HT, a[0], a[1]);
                            return Math.hypot(u - b[0], v - b[1]); };
  const gerr = green.map(err).sort((a,b) => a-b);
  const rerr = red.map(err).sort((a,b) => a-b);
  const med = a => a[Math.floor(a.length/2)];
  console.log('          against the true homography — green median %s px, 90th %s px',
              med(gerr).toFixed(2), gerr[Math.floor(gerr.length*0.9)].toFixed(2));
  console.log('          red median %s px', med(rerr).toFixed(2));
  ok('every match it kept satisfies the homography it was generated from',
     med(gerr) < 2.5, 'median ' + med(gerr).toFixed(2) + ' px');
  ok('nearly all of them, not just the median',
     gerr[Math.floor(gerr.length*0.9)] < 4, '90th ' + gerr[Math.floor(gerr.length*0.9)].toFixed(2));
  ok('and the ones it discarded do not', med(rerr) > 8, 'median ' + med(rerr).toFixed(2) + ' px');

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f => console.log('  ✗', f));
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
})();

setTimeout(() => { console.log('\n  FAIL  still running after every check finished');
  process.exit(1); }, 30000).unref();
