/* hough-live runs a real detector, so this suite gives it a frame whose answer
   is known and checks that the answer comes back.

   The fixture is a single horizontal step at y = 100. That is one line and one
   line only, so the accumulator has one thing to say, and saying it correctly
   requires every stage to be right: the Sobel, the suppression, the vote, the
   peak search, and the mapping from a cell back to a line.

   The check is done on the LINE, not on the cell. A horizontal line sits at
   the wrap of the theta axis, where (-90, rho) and (+90, -rho) are the same
   line and either may win the vote by a count of one. Asserting a cell index
   would make the suite fail on a tie; asserting the line it stands for is the
   claim the slide actually makes.

   Also checked: the five controls the following slide discusses are present
   and span the ranges that make them worth discussing.

   Run: node test/hough-live.checks.js                                         */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','hough-live.html');
const html = fs.readFileSync(FILE, 'utf8');

const W = 320, H = 240, CX = W/2, CY = H/2;
const STEP = 1.5, RSTEP = 3;                    // the slider's default bin size
const NT = Math.round(180/STEP), DIAG = Math.ceil(Math.hypot(CX, CY));
const NR = 2*Math.ceil(DIAG/RSTEP) + 1, HALF = (NR-1)/2;
const EDGE_Y = 100;

const pixel = (x,y) => y < EDGE_Y ? 235 : 25;

const drawn = [];
function fakeCtx(canvas){
  let pts = [];
  const c = {
    canvas, fillStyle:'#000', strokeStyle:'#000', lineWidth:1, lineCap:'', font:'',
    imageSmoothingEnabled:true,
    clearRect(){}, fillRect(){}, strokeRect(){}, fillText(){}, drawImage(){},
    save(){}, restore(){}, translate(){}, rotate(){}, scale(){},
    measureText(t){ return { width:(t||'').length*7 }; },
    beginPath(){ c._arc = false; pts = []; },
    moveTo(x,y){ pts.push([x,y]); },
    lineTo(x,y){ pts.push([x,y]); },
    arc(x,y,r){ pts.push([x,y]); c._arc = true; },
    stroke(){ if(pts.length) drawn.push({on:canvas.className, kind:c._arc?'ring':'path',
                                        pts:pts.slice(), style:c.strokeStyle}); },
    fill(){},
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; },
    putImageData(){},
    getImageData(sx,sy,w,h){
      const d = new Uint8ClampedArray(w*h*4);
      for(let j=0;j<h;j++) for(let i=0;i<w;i++){
        const v = pixel(sx+i, sy+j), k=(j*w+i)*4;
        d[k]=d[k+1]=d[k+2]=v; d[k+3]=255;
      }
      return {data:d, width:w, height:h};
    }
  };
  return c;
}

const errs = [], fails = [];
const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext = function(){ return fakeCtx(this); };
    // w.setTimeout, NOT the bare global: a plain setTimeout here schedules on
    // node's clock, which window.close() cannot reach, and this component runs
    // a permanent animation loop — the process would never exit
    w.requestAnimationFrame = fn => w.setTimeout(()=>fn(0), 16);
    w.cancelAnimationFrame = id => w.clearTimeout(id);
    Object.defineProperty(w.HTMLImageElement.prototype, 'src', {set(){ const s = this;
      Object.defineProperty(s,'width',{value:640,configurable:true});
      Object.defineProperty(s,'height',{value:480,configurable:true});
      setTimeout(()=>s.onload && s.onload(), 0); }, get(){ return ''; }});
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };

const d = dom.window.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await sleep(400);
  console.log('--- the panel came up ---');
  ok('four step chips, one per stage', d.querySelectorAll('.steps .s').length === 4,
     d.querySelectorAll('.steps .s').length + ' chips');
  ok('three panels: frame, edges, accumulator',
     ['hg-src','hg-edge','hg-acc'].every(k => !!d.querySelector('.' + k)));

  console.log('\n--- the five parameters of the next slide are all live ---');
  const want = { 'hg-bin':[1,6], 'hg-thr':[10,90], 'hg-num':[1,20],
                 'hg-len':[5,120], 'hg-gap':[1,30] };
  Object.keys(want).forEach(k => {
    const el = d.querySelector('.' + k);
    ok(k + ' is a live control', !!el && el.type === 'range');
    if(el) ok(k + ' spans ' + want[k][0] + ' to ' + want[k][1],
       +el.min === want[k][0] && +el.max === want[k][1], el.min + '-' + el.max);
  });

  for(let i=0;i<3;i++){ d.getElementById('sbNext').click(); await sleep(120); }
  await sleep(700);
  drawn.length = 0;
  await sleep(300);

  console.log('\n--- one step edge in, one line out ---');
  const rings = drawn.filter(x => x.on.includes('hg-acc') && x.kind === 'ring');
  const segs  = drawn.filter(x => x.on.includes('hg-src') && x.kind === 'path');
  ok('at least one peak was ringed in the accumulator', rings.length > 0,
     rings.length + ' rings');
  ok('and at least one segment was drawn back on the frame', segs.length > 0,
     segs.length + ' segments');

  if(rings.length){
    // the ring is drawn at ((t+0.5)/NT*W, (r+0.5)/NR*H); undo that, then turn
    // the cell into the line it stands for and ask where that line is
    const p = rings[0];
    const t = p.pts[0][0]/W*NT - 0.5, r = p.pts[0][1]/H*NR - 0.5;
    const th = (t*STEP - 90) * Math.PI/180, rho = (r - HALF)*RSTEP;
    const x0 = CX + rho*Math.cos(th), y0 = CY + rho*Math.sin(th);
    const tilt = Math.abs(Math.atan2(Math.cos(th), -Math.sin(th)) * 180/Math.PI);
    console.log('          strongest cell: θ ' + (t*STEP - 90).toFixed(1) +
                '°  ρ ' + rho.toFixed(1) + '  -> point (' + x0.toFixed(1) + ', ' +
                y0.toFixed(1) + ')');
    ok('the strongest peak is a horizontal line', Math.min(tilt, 180-tilt) < 3,
       'tilt ' + Math.min(tilt, 180-tilt).toFixed(2) + '°');
    ok('and it sits on the edge that is actually there, y = ' + EDGE_Y,
       Math.abs(y0 - EDGE_Y) <= RSTEP, 'y = ' + y0.toFixed(1));
  }
  if(segs.length){
    const ys = segs.flatMap(s => s.pts.map(q => q[1]));
    ok('every segment drawn lies along that edge',
       Math.max(...ys.map(y => Math.abs(y - EDGE_Y))) <= 2,
       'worst ' + Math.max(...ys.map(y => Math.abs(y - EDGE_Y))).toFixed(1) + 'px off');
    const xs = segs.flatMap(s => s.pts.map(q => q[0]));
    ok('and spans most of the frame it crosses',
       Math.max(...xs) - Math.min(...xs) > W*0.6,
       Math.round(Math.max(...xs) - Math.min(...xs)) + ' of ' + W + 'px');
  }

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f => console.log('  ✗', f));
  // close the window before exiting: this component animates for ever, and
  // jsdom keeps driving its timers until the document is closed
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
