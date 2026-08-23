/* Numeric checks on the sinusoidal position codes rendered by
   components/position-encoding.html.   Run: node test/position-encoding.checks.js */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','position-encoding.html');
function ctx(){ return {clearRect(){},drawImage(){},
  getImageData(x,y,w,h){return{data:new Uint8ClampedArray(w*h*4),width:w,height:h};},
  createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4),width:w,height:h};}}; }
const errs=[], fails=[];
const dom=new JSDOM(fs.readFileSync(FILE,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=()=>ctx();
    Object.defineProperty(w.HTMLImageElement.prototype,'src',{set(){const s=this;
      Object.defineProperty(s,'width',{value:356,configurable:true});
      Object.defineProperty(s,'height',{value:356,configurable:true});
      setTimeout(()=>s.onload&&s.onload(),0);},get(){return '';}});
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
  }});
const w=dom.window, d=w.document;
const ok=(l,c,x='')=>{ if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '),l,x); };
const step=k=>{ d.getElementById('sbReset').click(); for(let i=0;i<k;i++) d.getElementById('sbNext').click(); };
const dots=()=>[...d.querySelectorAll('#peStage circle.pe-dot')];
const shown=()=>dots().filter(c=>+c.getAttribute('opacity')>0);
const yOf=c=>parseFloat((c.style.transform.match(/translate\(([-\d.]+)px, *([-\d.]+)px\)/)||[])[2]);
const xOf=c=>parseFloat((c.style.transform.match(/translate\(([-\d.]+)px/)||[])[1]);

setTimeout(()=>{
  console.log('--- channel counts ---');
  step(0); ok('no encoding: no dots',        shown().length===0, shown().length);
  step(1); ok('1D: 2 values per patch (32)', shown().length===32, shown().length);
  step(2); ok('2D: 4 values per patch (64)', shown().length===64, shown().length);
  ok('4 band labels, 4 shown in 2D', d.querySelectorAll('#peStage .pe-bl.on').length===4);
  step(1);
  ok('only 2 bands shown in 1D',      d.querySelectorAll('#peStage .pe-bl.on').length===2);
  ok('2 zero lines shown in 1D',
     [...d.querySelectorAll('#peStage line.pe-zero')].filter(l=>+l.getAttribute('opacity')>0).length===2);
  ok('the joining polylines are gone', d.querySelectorAll('#peStage polyline').length===0);

  console.log('--- the 1D code really is sinusoidal ---');
  step(1);
  const all = dots();
  const ch = c => Array.from({length:16},(_,slot)=>yOf(all[slot*4+c]));   // slot-major, 4 per slot
  // each channel now sits in its own horizontal band, so centre each separately
  const v = a => { const mid = (Math.max(...a)+Math.min(...a))/2; return a.map(y=>-(y-mid)); };
  const vs = v(ch(0)), vc = v(ch(1));
  const amp = Math.max(...vs.map(Math.abs));
  const near = (a,b,tol=0.06)=>Math.abs(a-b) < tol*amp;
  ok('sin channel starts at zero',        near(vs[0],0),  vs[0].toFixed(2));
  ok('sin peaks a quarter cycle in (p=4)',near(vs[4],amp),vs[4].toFixed(2));
  ok('sin returns to zero at p=8',        near(vs[8],0),  vs[8].toFixed(2));
  ok('sin troughs at p=12',               near(vs[12],-amp));
  ok('cos leads sin by a quarter cycle',  near(vc[0],amp) && near(vc[4],0));
  const err = vs.reduce((m,y,p)=>Math.max(m,Math.abs(y - amp*Math.sin(2*Math.PI*p/16))),0);
  ok('every sin sample matches sin(2πp/16)', err < 0.02*amp, 'max error '+(err/amp*100).toFixed(2)+'%');

  console.log('--- one patch, one vertical line ---');
  step(2);
  const a2 = dots();
  const colX = s => [0,1,2,3].map(c=>xOf(a2[s*4+c]));
  ok('all 4 channels of a patch share one x', [0,7,15].every(s=>new Set(colX(s)).size===1),
     'patch 0 at x='+colX(0)[0]);
  ok('adjacent patches are one pitch apart', Math.round(colX(1)[0]-colX(0)[0])===66,
     Math.round(colX(1)[0]-colX(0)[0])+'px');
  const bandY = c => a2[0*4+c] && yOf(a2[0*4+c]);
  ok('the 4 bands are stacked, not interleaved',
     [1,2,3].every(c=>bandY(c) > bandY(c-1) - 40) && new Set([0,1,2,3].map(bandY)).size>1);

  console.log('--- 2D codes are distinct per position ---');
  const codes = Array.from({length:16},(_,slot)=>
    [0,1,2,3].map(c=>yOf(a2[slot*4+c]).toFixed(1)).join('/'));
  ok('all 16 positions get a distinct code', new Set(codes).size===16, new Set(codes).size);
  ok('patches in the same column share their x pair',
     codes[0].split('/').slice(0,2).join() === codes[4].split('/').slice(0,2).join());
  ok('patches in the same row share their y pair',
     codes[0].split('/').slice(2).join() === codes[1].split('/').slice(2).join());

  console.log('--- the code travels with its patch ---');
  const before = Array.from({length:16},(_,s)=>[xOf(a2[s*4]), yOf(a2[s*4])]);
  step(3);
  const after = Array.from({length:16},(_,s)=>[xOf(dots()[s*4]), yOf(dots()[s*4])]);
  const xs = before.map(b=>b[0]).sort((p,q)=>p-q).join();
  ok('the 16 track positions are unchanged', xs === after.map(a=>a[0]).sort((p,q)=>p-q).join());
  const values = a => a.map(v=>v[1].toFixed(1)).sort().join();
  ok('the same 16 code values are still present', values(before) === values(after));
  ok('but they now sit in a different order',   before.map(b=>b[1].toFixed(1)).join() !==
                                                after.map(a=>a[1].toFixed(1)).join());

  console.log('--- the note is at slide-body size and still clears the image ---');
  const px = (e,p)=>parseFloat(e.style[p]);
  const note = d.querySelector('#peStage .pe-note');
  const canv = d.querySelector('#peStage canvas.pe-recon');
  const cap0 = d.querySelector('#peStage .pe-cap');
  const css  = d.querySelector('style').textContent.replace(/\s/g,'');
  ok('the lead-in label is gone', !d.querySelector('#peStage .pe-lead'));
  ok('note is 19px', css.includes('.pe-note{position:absolute;font-size:19px'), css.includes('font-size:19px'));
  ok('note starts below the tile captions', px(note,'top') > px(cap0,'top') + 13,
     px(note,'top')+' vs '+(px(cap0,'top')+13));
  ok('note column stops short of the image', px(note,'left') + px(note,'width') < px(canv,'left'),
     (px(note,'left')+px(note,'width'))+' vs '+px(canv,'left'));

  // longest wording × measured chars-per-line must still clear the stage
  const stageH = parseFloat(d.querySelector('#peStage').style.height) ||
                 parseFloat((css.match(/\.pe-stage\{[^}]*height:(\d+)px/)||[])[1]);
  const CPL = px(note,'width') / 9.2, LH = 19*1.55;
  let worst = 0, worstMode = '';
  ['none','1d','2d'].forEach(m=>{
    [...d.querySelectorAll('#peStage ~ *, #root [data-pe]')];
    d.querySelector('[data-pe="'+m+'"]').dispatchEvent(new w.MouseEvent('click'));
    d.getElementById('peShuf').dispatchEvent(new w.MouseEvent('click'));
    const chars = note.textContent.length;
    const bottom = px(note,'top') + Math.ceil(chars/CPL)*LH;
    if(bottom > worst){ worst = bottom; worstMode = m+' shuffled ('+chars+' chars)'; }
  });
  ok('the longest note still fits the stage', worst < stageH,
     'worst '+worst.toFixed(0)+' of '+stageH+'  ['+worstMode+']');
  ok('the longest note clears the image base', worst < 250+166+20,
     worst.toFixed(0)+' vs image base 416');

  console.log('\nERRORS:', errs.length, '  FAILURES:', fails.length);
  errs.slice(0,4).forEach(e=>console.log('  -',e));
  fails.forEach(f=>console.log('  ✗',f));
  if(errs.length||fails.length) process.exitCode = 1;
}, 900);
