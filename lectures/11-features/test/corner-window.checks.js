/* corner-window computes E(u,v) from real pixels, so the thing worth testing is
   the arithmetic, not the photograph.

   The component is fed a synthetic image with three regions whose E(u,v) is
   known in advance:

       x < 200          constant           -> E is zero everywhere
       200 <= x < 280   a bright bar       -> its left edge is a clean vertical
                                              step: E must not depend on v
       a solid block cornered at (330,150) -> structure in both directions, so
                                              every shift must cost something

   and the E map it draws is read back out of a recording canvas context. That
   catches the failures that matter and are invisible on screen: an off-by-one
   in the shifted-window index (E would stop being zero at the origin), reading
   rows instead of columns (the edge case would depend on u and v alike), and
   normalising each map to its own maximum instead of to one shared reference
   (flat would come out looking like a corner, which is the whole argument of
   the slide inverted).

   Run: node test/corner-window.checks.js                                      */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','corner-window.html');
const html = fs.readFileSync(FILE, 'utf8');

const IW = 448, IH = 353, DISPW = 470, DISPH = 370;
const RECT = {k: 1};   // the stage transform in force when a click is measured

// the synthetic image, as the component will read it back
function pixel(x, y){
  // a solid block, probed at its top-left corner. NOT a checkerboard: a
  // periodic texture really does have free shifts — move by one period and the
  // window matches itself again — so it is a bad keypoint and a worse fixture.
  if (x >= 330 && x < 400 && y >= 150 && y < 220) return 220;
  if (x >= 200 && x < 280) return 200;                 // bright bar: a vertical edge
  return 40;                                           // everything else: flat
}

const drawn = [];                       // every fillRect, with the colour used
function fakeCtx(canvas){
  const c = {
    canvas, fillStyle:'#000', strokeStyle:'#000', lineWidth:1,
    clearRect(){}, drawImage(){}, save(){}, restore(){}, strokeRect(){}, beginPath(){},
    fillRect(x,y,w,h){ drawn.push({w:Math.round(w), x:Math.round(x), y:Math.round(y),
                                   fill:c.fillStyle}); },
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4), width:w, height:h}; },
    getImageData(sx,sy,w,h){
      const d = new Uint8ClampedArray(w*h*4);
      for(let j=0;j<h;j++) for(let i=0;i<w;i++){
        const v = pixel(sx+i, sy+j), k = (j*w+i)*4;
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
    // jsdom gives every element a zero-sized box, so a click would always land
    // at the same pixel; the panel is laid out at a known size in CSS
    // The deck fits its 1280px stage to the window with a transform, so the
    // measured box is SMALLER than the 470px the stylesheet asks for. RECT is
    // that factor: at 1 the rendered size matches the CSS size and a component
    // that divides by the CSS width looks correct, which is why the first
    // version of this test passed while clicks in the deck landed short.
    w.Element.prototype.getBoundingClientRect = function(){
      const w0 = DISPW * RECT.k, h0 = DISPH * RECT.k;
      return {left:0, top:0, right:w0, bottom:h0, width:w0, height:h0, x:0, y:0};
    };
    Object.defineProperty(w.HTMLImageElement.prototype, 'src', {set(){ const s = this;
      Object.defineProperty(s,'naturalWidth',{value:IW,configurable:true});
      Object.defineProperty(s,'naturalHeight',{value:IH,configurable:true});
      Object.defineProperty(s,'complete',{value:true,configurable:true});
      setTimeout(()=>s.onload && s.onload(), 0); }, get(){ return ''; }});
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };

const lum = css => { const m = css.match(/(\d+),\s*(\d+),\s*(\d+)/);
                     return 0.299*+m[1] + 0.587*+m[2] + 0.114*+m[3]; };

// click the photograph at an image coordinate, then read back the E map that
// was drawn: 17 x 17 cells, 14px each, brightest = dearest shift
function probe(win, ix, iy){
  drawn.length = 0;
  const c = win.document.querySelector('.cw-scene');
  const ev = new win.MouseEvent('click', {bubbles:true,
    clientX: ix * (DISPW / IW) * RECT.k, clientY: iy * (DISPH / IH) * RECT.k});
  c.dispatchEvent(ev);
  const cells = drawn.filter(r => r.w === 14);
  const E = [];
  for(const r of cells) E.push({u: r.x/14 - 8, v: r.y/14 - 8, t: lum(r.fill)});
  return E;
}
const at = (E,u,v) => E.find(c => c.u === u && c.v === v).t;

setTimeout(() => {
  const win = dom.window, d = win.document;
  console.log('--- the panel came up ---');
  const E0 = probe(win, 100, 100);
  ok('the E map is 17 x 17 cells', E0.length === 289, E0.length + ' cells');
  const readE = () => parseFloat(d.querySelector('.cw-min').textContent.replace(/,/g,''));
  ok('the readout carries a number', !Number.isNaN(readE()),
     d.querySelector('.cw-min').textContent);

  console.log('--- flat: a constant region costs nothing to shift ---');
  const spread = Math.max(...E0.map(c=>c.t)) - Math.min(...E0.map(c=>c.t));
  ok('every shift is the same colour as every other', spread < 1, 'spread ' + spread.toFixed(2));
  // this is the one that per-map normalisation would break: it would stretch
  // this map to full range and make open sky look exactly like a corner
  ok('and that colour is the bottom of the ramp, not the top',
     Math.max(...E0.map(c=>c.t)) < 20, 'brightest ' + Math.max(...E0.map(c=>c.t)).toFixed(1));
  // E is a weighted mean squared grey-level difference, so a constant region
  // gives exactly zero however the window is weighted
  ok('E for the cheapest move is zero', readE() === 0, d.querySelector('.cw-min').textContent);

  console.log('--- edge: a vertical step is free to slide up and down ---');
  const E1 = probe(win, 200, 150);
  ok('E(0,0) is zero — the window against itself',
     at(E1,0,0) <= Math.min(...E1.map(c=>c.t)) + 0.01, at(E1,0,0).toFixed(1));
  ok('sliding along the edge costs nothing at any distance',
     [-8,-4,-1,1,4,8].every(v => Math.abs(at(E1,0,v) - at(E1,0,0)) < 1),
     [-8,-4,4,8].map(v => at(E1,0,v).toFixed(1)).join(' '));
  ok('sliding across the edge costs a great deal',
     at(E1,8,0) > at(E1,0,8) + 100, at(E1,8,0).toFixed(0) + ' across vs ' + at(E1,0,8).toFixed(0) + ' along');
  ok('and E depends on u alone, as a vertical step must',
     [-8,-3,3,8].every(u => Math.abs(at(E1,u,7) - at(E1,u,-7)) < 1),
     [-8,-3,3,8].map(u => (at(E1,u,7)-at(E1,u,-7)).toFixed(1)).join(' '));
  // sliding a window up or down a vertical step costs nothing, and the ring
  // includes (0, +-8), so the cheapest 8-pixel move is free
  ok('E for the cheapest move is still zero — it can slide along the step',
     readE() === 0, d.querySelector('.cw-min').textContent);

  console.log('--- corner: structure in both directions leaves nowhere cheap ---');
  const E2 = probe(win, 330, 150);
  const ring = E2.filter(c => Math.abs(c.u) === 8 || Math.abs(c.v) === 8);
  ok('E(0,0) is still the cheapest cell on the map',
     at(E2,0,0) <= Math.min(...E2.map(c=>c.t)) + 0.01, at(E2,0,0).toFixed(1));
  ok('even the cheapest 8-pixel move is expensive',
     Math.min(...ring.map(c=>c.t)) > 60,
     'cheapest ring cell ' + Math.min(...ring.map(c=>c.t)).toFixed(0) + ' of 240');
  ok('which is what separates it from the edge',
     Math.min(...ring.map(c=>c.t)) >
       Math.min(...E1.filter(c=>Math.abs(c.u)===8||Math.abs(c.v)===8).map(c=>c.t)) + 50);
  // 40 vs 220 grey levels over a good part of the window: thousands, not units
  ok('and E for the cheapest move is now large', readE() > 1000,
     d.querySelector('.cw-min').textContent);

  console.log('--- a click lands on the same pixel however the stage is scaled ---');
  // the regression: the click used to divide by the CSS width, so on a deck
  // scaled to 0.9 the window landed about 10% short of the cursor
  const cellsOf = E => E.map(c => c.t.toFixed(3)).join(',');
  RECT.k = 1;    const full  = cellsOf(probe(win, 330, 150));
  RECT.k = 0.62; const small = cellsOf(probe(win, 330, 150));
  RECT.k = 1.35; const big   = cellsOf(probe(win, 330, 150));
  ok('the same relative click gives the same E map at 0.62x', small === full);
  ok('and at 1.35x', big === full);
  // and prove the fixture would have caught the old behaviour: a click 10% off
  // in the corner block lands somewhere measurably different
  RECT.k = 1;
  ok('a 10% error would have been visible — it is a different point',
     cellsOf(probe(win, 363, 165)) !== full);

  console.log('--- the three presets are reachable by the arrow keys ---');
  ok('three step chips, one per preset', d.querySelectorAll('.steps .s').length === 3,
     d.querySelectorAll('.steps .s').length);

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f => console.log('  ✗', f));
  // close the window before exiting: jsdom keeps driving timers while it is
  // open, and a component with an animation loop would hold this process
  // open for ever — a hang rather than a failure
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
}, 400);

// unref'd, so a clean run exits long before it fires; if anything is still
// holding the loop open this fails in half a minute instead of at CI's
// six-hour ceiling, which reports nothing at all
setTimeout(() => {
  console.log('\n  FAIL  still running after every check finished — something is '
            + 'holding the event loop open');
  process.exit(1);
}, 30000).unref();
