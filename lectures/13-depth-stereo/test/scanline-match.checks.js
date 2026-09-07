/* scanline-match computes its own cost curve, so this suite hands it a pair
   whose disparity it already knows and checks that the number coming back is
   that one.

   The fixture is a random non-repeating texture and THE SAME TEXTURE shifted:
   columns left of 200 by +9, columns from 200 on by -6. Two shifts, because a
   sign convention is the easiest thing in here to get backwards and a single
   shift cannot tell d from -d. The right-hand region is shifted the wrong way
   on purpose: it is how the claim on step 3 gets tested, that a best match at
   negative disparity is reported as one.

   The stops the component navigates to sit at x = 135, 94, 274 and 198. The
   seam is at 240, so three of them land in the +9 region and the footpath one
   in the -6 region, each far enough from the seam that no window straddles it
   at any size the slider offers — including the match position, which is up to
   nine pixels away.

   Nothing is read out of the component's closure. The disparity is read from
   the panel it prints, and whether the curve was drawn at all is read from the
   canvas calls themselves.

   Run: node test/scanline-match.checks.js                                     */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','scanline-match.html');
const html = fs.readFileSync(FILE, 'utf8');

const W = 320, H = 240, SEAM = 240, DL = 9, DR = -6;

// deterministic, non-repeating, and textured everywhere, so the true match is
// the only good one anywhere on the row
let seed = 20260907;
const rnd = () => (seed = (seed*1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const NOISE = new Float64Array((W + 64)*H);
for(let i = 0; i < NOISE.length; i++) NOISE[i] = rnd()*255;
const tex = (x, y) => NOISE[y*(W + 64) + (x + 32)];

// R[x] = L[x + shift]: the window at x0 in L is found at x0 - shift in R, so the
// disparity the component should report is exactly `shift`
const src = (i, x, y) => i === 0 ? tex(x, y)
                                 : tex(x + (x < SEAM ? DL : DR), y);
const frame = (i, w, h) => {
  const d = new Uint8ClampedArray(w*h*4);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const v = src(i, x, y), k = (y*w + x)*4;
    d[k] = d[k+1] = d[k+2] = v; d[k+3] = 255;
  }
  return { data:d, width:w, height:h };
};

// getContext order names the canvas: 0 left panel, 1 right panel, 2 curve,
// then 3 and 4 are the offscreen ones the component reads its pixels from
let made = 0;
const drawn = [];
function fakeCtx(canvas){
  const id = made++;
  let pts = [];
  const c = {
    canvas, fillStyle:'#000', strokeStyle:'#000', lineWidth:1, globalAlpha:1, font:'',
    textAlign:'left',
    clearRect(){}, fillRect(){}, strokeRect(){}, fillText(t,x,y){
      drawn.push({id, kind:'text', text:t, x, y}); },
    drawImage(){}, save(){}, restore(){}, clip(){}, rect(){}, translate(){},
    rotate(){}, scale(){}, setTransform(){}, setLineDash(){},
    measureText(t){ return {width:(t||'').length*7}; },
    beginPath(){ c._arc = false; pts = []; },
    moveTo(x,y){ pts.push([x,y]); }, lineTo(x,y){ pts.push([x,y]); },
    closePath(){}, arc(x,y){ pts.push([x,y]); c._arc = true; },
    stroke(){ if(pts.length) drawn.push({id, kind:c._arc?'ring':'path',
                                         pts:pts.slice(), style:c.strokeStyle}); },
    fill(){ if(pts.length) drawn.push({id, kind:'dot', pts:pts.slice(),
                                       style:c.fillStyle}); },
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; },
    putImageData(){},
    getImageData(sx,sy,w,h){ return frame(id === 4 ? 1 : 0, w, h); }
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
    Object.defineProperty(w.HTMLImageElement.prototype, 'src', {set(){ const s = this;
      Object.defineProperty(s,'width',{value:W,configurable:true});
      Object.defineProperty(s,'height',{value:H,configurable:true});
      setTimeout(()=>s.onload && s.onload(), 0); }, get(){ return ''; }});
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const d = dom.window.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const txt = s => (d.querySelector(s).textContent || '').trim();
const disp = () => parseInt(txt('.sm-rd'), 10);
async function to(n){
  d.getElementById('sbReset').click(); await sleep(30);
  for(let i = 0; i < n; i++){ d.getElementById('sbNext').click(); await sleep(30); }
  drawn.length = 0;                       // record only this step's drawing
  d.querySelector('.sm-cw').dispatchEvent(new dom.window.Event('input'));
  await sleep(40);
}
async function window_(w){
  const s = d.querySelector('.sm-cw');
  s.value = String(w); s.dispatchEvent(new dom.window.Event('input'));
  await sleep(40);
}

(async () => {
  await sleep(400);
  console.log('--- the panel came up ---');
  ok('five step chips, one per stage', d.querySelectorAll('.steps .s').length === 5);
  ok('a window control over odd sizes from 3 to 21',
     +d.querySelector('.sm-cw').min === 3 && +d.querySelector('.sm-cw').max === 21 &&
     +d.querySelector('.sm-cw').step === 2);

  console.log('\n--- step 0 states the problem and gives away no answer ---');
  await to(0);
  ok('no disparity is reported yet', txt('.sm-rd') === '—', txt('.sm-rd'));
  ok('and no curve is drawn', !drawn.some(o => o.id === 2 && o.kind === 'path'));

  console.log('\n--- the disparity it reports is the one built into the pair ---');
  await to(1);
  ok('the curve is drawn once the cost is the subject',
     drawn.some(o => o.id === 2 && o.kind === 'path' && o.pts.length > 200));
  ok('step 1 (x=135, shifted +9) reports d = 9', disp() === DL, 'got ' + txt('.sm-rd'));
  ok('an exact match costs nothing', parseFloat(txt('.sm-rc')) < 1e-6, txt('.sm-rc'));
  ok('and the runner-up is nowhere near it', txt('.sm-rk') === '>999×', txt('.sm-rk'));

  console.log('\n--- and it does not depend on the window size ---');
  for(const w of [3, 5, 13, 21]){
    await window_(w);
    ok('w = ' + w + ' still reports d = 9', disp() === DL, 'got ' + txt('.sm-rd'));
  }
  await window_(9);

  await to(2);
  ok('step 2 (x=94, same region) reports d = 9', disp() === DL, 'got ' + txt('.sm-rd'));

  console.log('\n--- a best match on the wrong side is reported as one ---');
  await to(3);
  ok('step 3 (x=274, shifted -6) reports d = -6', disp() === DR, 'got ' + txt('.sm-rd'));
  ok('and the reading is marked as the impossibility it is',
     d.querySelector('.sm-read .d').classList.contains('bad'));
  await to(1);
  ok('a physical disparity is not marked', disp() === DL &&
     !d.querySelector('.sm-read .d').classList.contains('bad'));

  console.log('\n--- and the depth-edge stop is back in the +9 region ---');
  await to(4);
  ok('step 4 (x=198) reports d = 9', disp() === DL, 'got ' + txt('.sm-rd'));
  for(const w of [3, 21]){
    await window_(w);
    ok('  and still does at w = ' + w, disp() === DL, 'got ' + txt('.sm-rd'));
  }
  await window_(9);

  console.log('\n--- d is drawn on the row, not only printed ---');
  await to(1);
  // one path: the bar, then a tick at each end, so the bar is its first segment
  const bar = drawn.filter(o => o.id === 1 && o.kind === 'path' &&
                                o.pts.length >= 2 && o.pts[0][1] === o.pts[1][1]);
  const SC = 1.1, span = bar.map(o => Math.abs(o.pts[1][0] - o.pts[0][0])/SC)
                            .filter(v => Math.abs(v - DL) < 0.51);
  ok('a bracket spanning exactly d pixels of the image sits on the row',
     span.length >= 1, span.map(v => v.toFixed(1)).join(', ') + ' px');
  ok('labelled d', drawn.some(o => o.id === 1 && o.kind === 'text' && o.text === 'd'));
  await to(0);
  ok('and neither appears before the cost does',
     !drawn.some(o => o.id === 1 && o.kind === 'text' && o.text === 'd'));

  console.log('\n--- the chips track the build ---');
  for(const s of [0, 1, 2, 3, 4]){
    await to(s);
    const on = [...d.querySelectorAll('.steps .s')].filter(c => c.classList.contains('on'));
    ok('step ' + s + ' lights ' + (s+1) + ' chip(s)', on.length === s + 1, on.length + '');
  }

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f => console.log('  ✗', f));
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
})();

setTimeout(() => { console.log('\n  FAIL  still running after every check finished');
  process.exit(1); }, 30000).unref();
