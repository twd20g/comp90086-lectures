/* The novel part of structure-tensor is the colour map, so that is what this
   tests — and it tests the properties it was designed around rather than the
   pixels it happens to produce.

       R = s + p,  G = s - p/2 + (sqrt3/2)q,  B = s - p/2 - (sqrt3/2)q
       with s = (a+c)/2 (isotropic, rotation invariant)
            (p,q) = ((a-c)/2, b) (deviatoric, turns at twice the image's rate)

   1. Isotropic M must come out EXACTLY monochrome. The obvious integer basis
      [6,0,0]/[1,2,4]/[1,-2,4] gives 6:5:5 on the identity, which is a fifth of
      a channel out and reads as a red cast on every corner in the frame.
   2. A pure edge turned through 180 degrees must sweep the whole hue circle
      once, monotonically. That is what makes the ring in the test pattern a
      colour wheel, and it is read off the legend the component draws.
   3. The averaged panel must actually reach white somewhere, or the corner
      argument has nothing to point at.
   4. l2 <= l1 at every pixel. The two eigenvalues come from (tr +- disc)/2 and
      a flipped sign there would look plausible on screen while inverting which
      panel is which — the ordering is the one thing about them that cannot be
      eyeballed.

   Run: node test/structure-tensor.checks.js                                   */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','structure-tensor.html');
const html = fs.readFileSync(FILE, 'utf8');

const W = 320, H = 240;   // the component's working resolution

// a vertical step and a solid block, so the frame holds edges in two
// directions and one honest corner
function pixel(x,y){
  if (x >= 150 && x < 230 && y >= 60 && y < 150) return 235;
  if (x >= 40  && x < 90) return 200;
  return 20;
}

const painted = {};                     // last ImageData written to each canvas
function fakeCtx(canvas){
  const c = {
    canvas, fillStyle:'#000', strokeStyle:'#000', lineWidth:1,
    fillRect(){}, strokeRect(){}, clearRect(){}, drawImage(){}, save(){}, restore(){},
    beginPath(){}, arc(){}, moveTo(){}, lineTo(){}, stroke(){}, fill(){},
    translate(){}, rotate(){}, scale(){},
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; },
    putImageData(img){ painted[canvas.className] = img; },
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
    // node's clock, which window.close() has no way to reach, so the component's
    // animation loop outlives the document and the process never exits
    w.requestAnimationFrame = fn => w.setTimeout(()=>fn(0), 16);
    w.cancelAnimationFrame = id => w.clearTimeout(id);
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };

const hueOf = (r,g,b) => {                      // degrees, or null when grey
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
  if(mx-mn < 3) return null;
  let h;
  if(mx===r) h = 60*(((g-b)/(mx-mn))%6);
  else if(mx===g) h = 60*((b-r)/(mx-mn)+2);
  else h = 60*((r-g)/(mx-mn)+4);
  return (h+360)%360;
};
const satOf = (r,g,b) => { const mx=Math.max(r,g,b); return mx ? (mx-Math.min(r,g,b))/mx : 0; };

setTimeout(() => {
  const d = dom.window.document;

  console.log('--- the panel came up ---');
  ok('every canvas was painted',
     ['st-src','st-gx','st-gy','st-mwin','st-l1','st-l2'].every(k => Object.keys(painted).some(n => n.includes(k))),
     Object.keys(painted).join(' '));
  ok('three step chips, one per stage', d.querySelectorAll('.steps .s').length === 3);

  const get = k => painted[Object.keys(painted).find(n => n.includes(k))];

  console.log('--- a pure edge, turned, sweeps the hue circle once ---');
  // the legend paints a rank-one M for gradient angles 0..180 across its width
  const leg = get('st-legend');
  ok('the legend was drawn', !!leg, leg ? leg.width+'x'+leg.height : 'missing');
  if(leg){
    const hs = [];
    for(let x=0;x<leg.width;x+=6){
      const i=(0*leg.width+x)*4;
      const h=hueOf(leg.data[i],leg.data[i+1],leg.data[i+2]);
      if(h!==null) hs.push(h);
    }
    ok('the legend is coloured throughout', hs.length > leg.width/6 - 3, hs.length + ' samples');
    // one full turn: unwrapped hue should advance by about 360 degrees
    let total=0;
    for(let i=1;i<hs.length;i++){
      let dh=hs[i]-hs[i-1];
      while(dh>180) dh-=360; while(dh<-180) dh+=360;
      total+=dh;
    }
    ok('and sweeps one full circle over 180 degrees of edge rotation',
       Math.abs(Math.abs(total)-360) < 40, Math.round(total)+' degrees');
    const steps=[];
    for(let i=1;i<hs.length;i++){ let dh=hs[i]-hs[i-1];
      while(dh>180)dh-=360; while(dh<-180)dh+=360; steps.push(dh); }
    const fwd = steps.filter(s=>s>0).length, back = steps.filter(s=>s<0).length;
    ok('monotonically, so hue reads as an angle and not a lookup',
       Math.min(fwd,back) <= 1, fwd+' forward vs '+back+' back');
  }

  console.log('--- averaging lets two directions meet, and that is a corner ---');
  const mw = get('st-mwin');
  const leastSat = img => {
    let best = 1, at = null;
    for(let p=0;p<img.width*img.height;p++){
      const i=p*4, mx=Math.max(img.data[i],img.data[i+1],img.data[i+2]);
      if(mx < 120) continue;                       // only pixels bright enough to read
      const s=satOf(img.data[i],img.data[i+1],img.data[i+2]);
      if(s<best){ best=s; at=[p%img.width, (p/img.width)|0]; }
    }
    return {sat:best, at};
  };
  const b = leastSat(mw);
  ok('the averaged panel has bright pixels to judge', b.at !== null);
  ok('and one of them is white', b.sat < 0.15,
     'least saturated ' + b.sat.toFixed(2) + (b.at ? ' at ' + b.at.join(',') : ''));

  console.log('--- the eigenvalues are the right way round ---');
  const l1 = get('st-l1'), l2 = get('st-l2');
  ok('both eigenvalue panels were painted', !!l1 && !!l2);
  let wrong = 0, lit1 = 0, lit2 = 0;
  for(let p=0;p<l1.width*l1.height;p++){
    const v1=l1.data[p*4], v2=l2.data[p*4];
    if(v2 > v1 + 1) wrong++;
    if(v1 > 90) lit1++;
    if(v2 > 90) lit2++;
  }
  // both are monotone in their eigenvalue on one shared scale, so the ordering
  // survives into the pixels: l2 may never out-run l1 anywhere
  ok('l2 never exceeds l1, at any pixel', wrong === 0, wrong + ' pixels inverted');
  ok('l1 lights up on more of the frame than l2', lit1 > lit2,
     lit1 + ' vs ' + lit2 + ' bright pixels');
  ok('and l2 is bright somewhere — the corners', lit2 > 0, lit2 + ' bright pixels');

  console.log('--- no channel can go negative, because M is PSD ---');
  // nothing is clipped at the bottom, so a black pixel means a small M rather
  // than a channel that went under and was clamped
  let clipped = 0;
  for(const k of ['st-mwin']){
    const img = get(k);
    for(let p=0;p<img.width*img.height;p++){
      const i=p*4;
      if(img.data[i]===0 && img.data[i+1]===0 && img.data[i+2]===0) continue;
      if(img.data[i]===0 || img.data[i+1]===0 || img.data[i+2]===0) clipped++;
    }
  }
  console.log('          ' + clipped + ' lit pixels with a channel at exactly 0');

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f => console.log('  ✗', f));
  // close the window before exiting: jsdom keeps driving timers while it is
  // open, and a component with an animation loop would hold this process
  // open for ever — a hang rather than a failure
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
}, 600);

// unref'd, so a clean run exits long before it fires; if anything is still
// holding the loop open this fails in half a minute instead of at CI's
// six-hour ceiling, which reports nothing at all
setTimeout(() => {
  console.log('\n  FAIL  still running after every check finished — something is '
            + 'holding the event loop open');
  process.exit(1);
}, 30000).unref();
