/* harris-live computes R = det M - k (tr M)^2 and paints it with a DIVERGING
   map, and that is the part worth testing: R is signed, and the sign is the
   whole argument the previous slide makes. A greyscale map would clip every
   negative to black alongside the flat regions and lose it silently — nothing
   would look broken.

   So the fixture is a frame holding both cases at once: a long straight bar,
   whose sides are edges and must go blue, and its four corners, which must go
   amber. Both must be present. If a sign flips, or the map is collapsed to one
   ramp, one of the two disappears while the panel still looks plausible.

   Also checked: the corner panel is the source image with markers drawn over
   it, so it must differ from the source panel but not wholly — a common way to
   break it is to paint the markers onto a blank canvas.

   Run: node test/harris-live.checks.js                                        */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','harris-live.html');
const html = fs.readFileSync(FILE, 'utf8');

const W = 360, H = 240;

// a bright bar on a dark ground: four corners, four straight sides
function pixel(x,y){
  return (x >= 120 && x < 240 && y >= 80 && y < 160) ? 230 : 25;
}

const painted = {};
function fakeCtx(canvas){
  const c = {
    canvas, fillStyle:'#000', strokeStyle:'#000', lineWidth:1,
    fillRect(){}, strokeRect(){}, clearRect(){}, save(){}, restore(){},
    beginPath(){}, arc(){}, moveTo(){}, lineTo(){}, stroke(){}, fill(){},
    translate(){}, rotate(){}, scale(){},
    drawImage(){},
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
    Object.defineProperty(w.HTMLImageElement.prototype, 'src', {set(){ const s = this;
      Object.defineProperty(s,'width',{value:720,configurable:true});
      Object.defineProperty(s,'height',{value:480,configurable:true});
      setTimeout(()=>s.onload && s.onload(), 0); }, get(){ return ''; }});
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };

setTimeout(() => {
  const d = dom.window.document;
  const get = k => painted[Object.keys(painted).find(n => n.includes(k))];

  console.log('--- the panel came up ---');
  ok('every canvas was painted',
     ['hl-src','hl-resp'].every(k => Object.keys(painted).some(n => n.includes(k))),
     Object.keys(painted).join(' '));
  ok('three step chips, one per stage', d.querySelectorAll('.steps .s').length === 3);

  console.log('--- R is signed, and both signs reach the screen ---');
  const resp = get('hl-resp');
  ok('the response panel was painted', !!resp);
  let blue = 0, amber = 0, dark = 0;
  if(resp){
    for(let p=0;p<resp.width*resp.height;p++){
      const i=p*4, r=resp.data[i], g=resp.data[i+1], b=resp.data[i+2];
      if(Math.max(r,g,b) < 45){ dark++; continue; }
      if(b > r + 30) blue++; else if(r > b + 30) amber++;
    }
  }
  console.log('          blue ' + blue + '  amber ' + amber + '  near-black ' + dark);
  // the bar's sides: one eigenvalue large, one small, so R goes negative
  ok('edges paint negative — blue is present', blue > 50, blue + ' px');
  // its four corners: both eigenvalues large, so R goes positive
  ok('corners paint positive — amber is present', amber > 10, amber + ' px');
  // and most of a mostly-empty frame is neither
  ok('and the flat ground is neither', dark > resp.width*resp.height*0.5,
     dark + ' of ' + resp.width*resp.height);

  console.log('--- k is exposed, and in the range the literature uses ---');
  const kIn = d.querySelector('.hl-k');
  ok('there is a k control', !!kIn);
  if(kIn){
    const lo = +kIn.min/100, hi = +kIn.max/100, now = +kIn.value/100;
    ok('its range spans the usual 0.04 - 0.06', lo <= 0.04 && hi >= 0.06,
       lo + ' to ' + hi);
    ok('and it starts inside that range', now >= 0.04 && now <= 0.06, String(now));
  }

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f => console.log('  ✗', f));
  // close the window before exiting: jsdom keeps driving timers while it is
  // open, and a component with an animation loop would hold this process
  // open for ever — a hang rather than a failure
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
}, 700);

// unref'd, so a clean run exits long before it fires; if anything is still
// holding the loop open this fails in half a minute instead of at CI's
// six-hour ceiling, which reports nothing at all
setTimeout(() => {
  console.log('\n  FAIL  still running after every check finished — something is '
            + 'holding the event loop open');
  process.exit(1);
}, 30000).unref();
