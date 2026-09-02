/* Verifies the printable build: light theme reaches every component, nothing is
   left in dark-mode colours, and the whole deck is flattened one slide per page.
   Run: node test/print.checks.js                 (needs: npm install jsdom)     */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','dist','standalone','09-vit.html');
function ctx(){ return {clearRect(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},
  putImageData(){}, set imageSmoothingQuality(v){}, set imageSmoothingEnabled(v){},
  set strokeStyle(v){}, set lineWidth(v){},
  getImageData(x,y,w,h){ const d=new Uint8ClampedArray(w*h*4);
    for(let i=0;i<w*h;i++){ d[i*4]=(x*3+i)%255; d[i*4+1]=(y+i*2)%255; d[i*4+2]=(i*7)%255; d[i*4+3]=255; }
    return {data:d,width:w,height:h}; },
  createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4),width:w,height:h}; }}; }
const errs=[], fails=[];
const dom=new JSDOM(fs.readFileSync(FILE,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=()=>ctx();
    Object.defineProperty(w.HTMLImageElement.prototype,'src',{set(){const s=this;
      Object.defineProperty(s,'width',{value:356,configurable:true});
      Object.defineProperty(s,'height',{value:356,configurable:true});
      setTimeout(()=>s.onload&&s.onload(),0);},get(){return '';}});
    // the print path ends by asking the browser to print, and jsdom answers
    // that with a stack trace on the virtual console AFTER the checks have
    // reported — a clean run that reads as a crash. There is nothing to
    // print here, so absorb it.
    w.print=()=>{};
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
  }});
const w=dom.window, d=w.document;
const ok=(l,c,x='')=>{ if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '),l,x); };

setTimeout(()=>{
  w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'p'}));      // lay the deck out light

  console.log('--- the whole deck is flattened ---');
  const slides = d.querySelectorAll('.slide').length;
  ok('light theme on',   d.body.classList.contains('light'));
  ok('print layout on',  d.body.classList.contains('printall'));
  ok('every slide active', d.querySelectorAll('.slide.active').length===slides, slides);
  ok('every fragment revealed',
     d.querySelectorAll('.frag.on').length===d.querySelectorAll('.frag').length);
  const chips = [...d.querySelectorAll('.steps')];
  ok('every component ran to its last step',
     chips.every(s=>s.querySelectorAll('.s').length===s.querySelectorAll('.s.on').length),
     chips.map(s=>s.querySelectorAll('.s.on').length+'/'+s.querySelectorAll('.s').length).join(' '));

  console.log('--- no dark-mode colour survives ---');
  const lum = c => { const [r,g,b]=(c.match(/\d+/g)||[255,255,255]).map(Number);
                     return 0.299*r+0.587*g+0.114*b; };
  const cells = [...d.querySelectorAll('.ah-c, .mh-grid i')].filter(e=>e.style.background);
  const dark  = cells.filter(e=>lum(e.style.background) < 90);
  ok('matrix cells ramp from white, not from near-black',
     dark.length===0, dark.length+' of '+cells.length+' cells still dark');
  const mean = cells.reduce((a,e)=>a+lum(e.style.background),0)/cells.length;
  ok('and are light on average (toner)', mean > 200, 'mean luminance '+mean.toFixed(0));

  console.log('--- the printable figure is swapped in ---');
  const light = d.querySelector('.only-light'), darkImg = d.querySelector('.only-dark');
  ok('both variants of the bag-of-features figure are present', !!light && !!darkImg);
  ok('the light one is a JPEG (white background original)',
     light.getAttribute('src').startsWith('data:image/jpeg'));

  console.log('--- live controls are suppressed ---');
  ['ahReset','mhReset','qfReset','peShuf','peOrder'].forEach(id=>{
    const e = d.getElementById(id);
    if(e) ok(id+' hidden in print', /display:\s*none/.test(
      w.getComputedStyle(e).display==='none' ? 'display:none' : 'shown'), w.getComputedStyle(e).display);
  });

  console.log('\nERRORS:', errs.length, '  FAILURES:', fails.length);
  errs.slice(0,4).forEach(e=>console.log('  -',e));
  fails.forEach(f=>console.log('  ✗',f));
  if(errs.length||fails.length) process.exitCode = 1;
}, 1200);
