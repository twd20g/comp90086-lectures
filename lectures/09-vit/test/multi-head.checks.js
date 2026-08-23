/* Checks on components/multi-head.html — chiefly that nothing on screen encodes
   information it does not have.  Run: node test/multi-head.checks.js            */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','multi-head.html');
function ctx(){ return {clearRect(){},drawImage(){},
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
    w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message));
  }});
const w=dom.window, d=w.document;
const ok=(l,c,x='')=>{ if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '),l,x); };

setTimeout(()=>{
  for(let i=0;i<3;i++) d.getElementById('sbNext').click();

  console.log('--- colour must not pretend to encode anything ---');
  const swatches = [...d.querySelectorAll('#mhHeads i')];
  ok('4 grids of 256 cells', swatches.length === 4*256, swatches.length);
  // near-background cells are almost neutral, so only judge the ones with ink in them
  const inked = swatches.map(e=>(e.style.background.match(/\d+/g)||[0,0,0]).map(Number))
                        .filter(([r,g,b])=>Math.max(r,g,b) - Math.min(r,g,b) > 25);
  ok('the coloured cells are all the same family (green leads, never red)',
     inked.length > 200 && inked.every(([r,g,b])=>g > r),
     inked.length + ' inked cells, ' + inked.filter(([r,g])=>r>=g).length + ' red-leaning');

  console.log('--- the distance readout is gone ---');
  ok('no per-head footer text', d.querySelectorAll('#mhHeads .foot').length===0);
  ok('no "patches away" label survives', !/patches away/.test(d.body.textContent));

  console.log('--- four heads, no control ---');
  ok('no head-count slider', !d.getElementById('mhH'));
  for(let i=0;i<4;i++) d.getElementById('sbNext').click();
  ok('all four grids shown at the end',
     [...d.querySelectorAll('.mh-h')].filter(e=>e.classList.contains('on')).length===4);

  console.log('--- the parameter table: h = 1 and h = 4 cost the same ---');
  const cfgEl = d.getElementById('mhCfg');
  const trs = [...cfgEl.querySelectorAll('tr')].map(r=>[...r.children].map(c=>c.textContent.trim()));
  trs.forEach(r=>console.log('         ', r.join(' | ')));
  ok('five rows: heading, width, W_qkv, W_o, total', trs.length===5, trs.length);
  ok('three columns throughout', trs.every(r=>r.length===3), trs.map(r=>r.length).join('/'));
  ok('the two settings are h = 1 and h = 4', trs[0][1]==='h = 1' && trs[0][2]==='h = 4', trs[0].join('/'));
  ok('D is stated once, in the heading', /^D = 768$/.test(trs[0][0]), trs[0][0]);
  ok('width per head is D, then D/4', trs[1][1]==='768' && trs[1][2]==='192', trs[1].join('/'));
  ok('one head is 768×768; four are 4 × 768×192',
     trs[2][1]==='768×768' && trs[2][2]==='4 × 768×192', trs[2].join('/'));
  ok('W_o does not move', trs[3][1]==='768×768' && trs[3][2]===trs[3][1], trs[3].join('/'));
  ok('THE POINT: the two totals are the same string', trs[4][1]===trs[4][2], trs[4].join('/'));
  ok('and that total really is 4D²', trs[4][1]===(4*768*768/1e6).toFixed(2)+' M', trs[4][1]);
  ok('the arithmetic behind it: 4 × 768×192 = 768×768', 4*768*192 === 768*768);
  ok('the total row is the one picked out', d.querySelectorAll('#mhCfg tr.tot').length===1);
  ok('ViT-B/16 is still named, with its real h and width',
     /ViT-B\/16 uses h = 12/.test(cfgEl.textContent) && /D\/h = 64/.test(cfgEl.textContent));
  ok('12 × 64 really is 768', 12*64===768);
  ok('the reference config carries the same total',
     new RegExp('the same ' + (4*768*768/1e6).toFixed(2) + ' M').test(cfgEl.textContent));

  console.log('--- the table is read from the back row, not squinted at ---');
  const css = fs.readFileSync(FILE,'utf8');
  ok('the numbers clear the 13px reference-table size',
     /\.mh-cfg td\{[^}]*font-size:15px/.test(css));
  ok('the totals are larger still',  /\.mh-cfg tr\.tot td\{font-size:16px/.test(css));
  ok('no cell wraps mid-number',     /\.mh-cfg td\{[^}]*white-space:nowrap/.test(css));
  const thLab = (css.match(/\.mh-cfg th\.lab\{([^}]*)\}/)||['',''])[1];
  ok('the D = 768 heading inherits the column-heading font',
     !/font-family|font-size|text-transform/.test(thLab), thLab);

  console.log('--- the ablation is quoted with a source ---');
  for(let i=0;i<4;i++) d.getElementById('sbNext').click();
  const rows = [...d.querySelectorAll('#mhAbl tr')].slice(1)
                 .map(r=>[...r.children].map(c=>c.textContent.trim()).join('/'));
  console.log('        ', rows.join('  '));
  ok('five ablation rows', rows.length===5, rows.length);
  ok('single head is the worst', rows[0]==='1/512/24.9', rows[0]);
  ok('too many heads falls off again', rows[4]==='32/16/25.4', rows[4]);
  ok('every row satisfies h × d = 512', rows.every(r=>{
       const [h,dk] = r.split('/').map(Number); return h*dk===512; }));
  ok('the last step answers the question it asks',
     /This helps\./.test(d.getElementById('mhPoints').textContent));
  ok('the 0.9 BLEU claim matches the table',
     Math.abs((25.8 - 24.9) - 0.9) < 1e-9 &&
     /0\.9 BLEU below/.test(d.getElementById('mhPoints').textContent));
  ok('the source is cited', /Vaswani/.test(d.getElementById('mhAbl').textContent));

  console.log('--- layout: bullets under the grids, tables beside them ---');
  const col = e => { let n=e; while(n && !(n.parentElement && n.parentElement.classList.contains('mh-wrap'))) n=n.parentElement; return n; };
  const gridsCol = col(d.querySelector('#mhHeads'));
  ok('the bullets share a column with the grids', col(d.querySelector('#mhPoints'))===gridsCol);
  ok('the ablation table is in the other column',  col(d.querySelector('#mhAbl'))!==gridsCol);
  ok('so is the parameter table',                  col(d.querySelector('#mhCfg'))!==gridsCol);
  ok('no text is left under the grids', d.querySelectorAll('#mhHeads .foot').length===0);
  ok('the axes note above the table is gone', d.querySelectorAll('.mh-axes').length===0);
  ok('and nothing else reintroduces it', !/brighter = more weight/.test(d.body.textContent));

  console.log('--- both columns fit the slide body ---');
  const CPL = 684/9.2, LH = 19*1.5;
  const pts = [...d.querySelectorAll('#mhPoints .mh-point')];
  const lines = pts.map(e=>Math.ceil(e.textContent.length/CPL));
  ok('every bullet is two lines or fewer', lines.every(v=>v<=2), lines.join('/'));
  const left  = 20 + 160 + 22 + lines.reduce((a,v)=>a + v*LH + 16, 0);
  // the parameter table (rows at 15px/1.4 plus 7px padding) + its source line,
  // then the 42px gap, then the ablation table, which is the same as ever
  const right = trs.length*36 + 22 + 42 + 6*26 + 22;
  const total = 50 + Math.max(left, right);
  ok('the taller column clears the 547px slide body', total < 520,
     'left ' + Math.round(left) + ', right ' + Math.round(right) + ' -> ' + Math.round(total));
  ok('the ablation table is the last thing in its column',
     d.getElementById('mhAbl') === d.getElementById('mhCfg').parentNode.lastElementChild);

  console.log('\nERRORS:', errs.length, '  FAILURES:', fails.length);
  errs.slice(0,4).forEach(e=>console.log('  -',e));
  fails.forEach(f=>console.log('  ✗',f));
  if(errs.length||fails.length) process.exitCode = 1;
}, 700);
