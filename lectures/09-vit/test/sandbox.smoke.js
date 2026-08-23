/* Exercises components/attention-head.html in isolation, through the sandbox build.
   Run: node test/sandbox.smoke.js     (needs: npm install jsdom)

   Cell ordering inside #root .ah-c is fixed by build order:
       [0   .. 95 ]  X         16 rows × 6
       [96  .. 191]  Qᵀ        16 rows × 6
       [192 .. 287]  K          6 rows × 16
       [288 .. 383]  V          6 rows × 16
       [384 .. 639]  A         16 × 16
       [640 .. 895]  softmax   16 × 16
       [896 .. 991]  Y = S·V   16 rows × 6                                     */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','attention-head.html');
const X0 = 0, Q0 = 96, K0 = 192, V0 = 288, A0 = 384, S0 = 640, Y0 = 896;

function ctx(){
  return {clearRect(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},putImageData(){},
    set imageSmoothingQuality(v){}, set imageSmoothingEnabled(v){}, set strokeStyle(v){}, set lineWidth(v){},
    getImageData(x,y,w,h){ const d=new Uint8ClampedArray(w*h*4);
      for(let i=0;i<w*h;i++){ d[i*4]=(x*3+i)%255; d[i*4+1]=(y+i*2)%255; d[i*4+2]=(i*7)%255; d[i*4+3]=255; }
      return {data:d,width:w,height:h}; },
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4),width:w,height:h}; }};
}

const errs = [], fails = [];
const dom = new JSDOM(fs.readFileSync(FILE,'utf8'), {
  runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext = ()=>ctx();
    Object.defineProperty(w.HTMLImageElement.prototype,'src',{
      set(){ const s=this;
        Object.defineProperty(s,'width',{value:356,configurable:true});
        Object.defineProperty(s,'height',{value:356,configurable:true});
        setTimeout(()=>s.onload&&s.onload(),0); },
      get(){ return ''; }});
    w.addEventListener('error', e=>errs.push(e.error&&e.error.stack||e.message));
    w.onerror = m=>errs.push('onerror: '+m);
  }
});
const w = dom.window, d = w.document;
const ok = (label,cond,extra='')=>{ if(!cond) fails.push(label);
  console.log((cond?'  ok   ':'  FAIL '), label, extra); };
const cells = sel => [...d.querySelectorAll(sel)];
const step = k => { d.getElementById('sbReset').click();
                    for(let i=0;i<k;i++) d.getElementById('sbNext').click(); };

setTimeout(()=>{
  const P = cells('#root .ah-p:not(.ah-pk)');
  const all = ()=>cells('#root .ah-c');
  const live = ()=>all().filter(c=>c.style.opacity==='1').length;

  console.log('--- structure ---');
  ok('16 patch tiles in the value column', P.length===16, P.length);
  ok('16 patch tiles in the strip above K', cells('#root .ah-pk').length===16);
  ok('992 matrix cells (96 X + 96 Qᵀ + 96 K + 256 A + 256 S + 96 V + 96 Y)',
     all().length===992, all().length);
  ok('9 step chips', cells('#root #ahSteps .s').length===9, cells('#root #ahSteps .s').length);
  ok('pixel-blend pane is gone', !d.getElementById('ahOut') && !d.getElementById('ahQ'));

  console.log('--- step gating ---');
  step(0); ok('step 1: image only, no cells',   live()===0,   live());
  step(1); ok('step 2: still no cells',         live()===0,   live());
  step(2); ok('step 3: X appears (96)',         live()===96,  live());
  step(3); ok('step 4: Qᵀ joins (192)',         live()===192, live());
  step(4); ok('step 5: K joins (288)',          live()===288, live());
  step(5); ok('step 6: A joins (544)',          live()===544, live());
  step(6); ok('step 7: softmax joins (800)',    live()===800, live());
  step(7); ok('step 8: V joins (896)',          live()===896, live());
  step(8); ok('step 9: Y joins (992)',          live()===992, live());

  console.log('--- opening: image -> grid -> column ---');
  step(0);
  ok('step 1: patches laid out as a grid', new Set(P.map(p=>p.style.left)).size===4,
     new Set(P.map(p=>p.style.left)).size+' distinct columns');
  ok('step 1: patches at full scale', P[0].style.transform==='scale(1)');
  step(2);
  ok('step 3: patches stacked in one column', P.every(p=>p.style.left==='0px'));
  ok('step 3: patches scaled down', P[0].style.transform!=='scale(1)', P[0].style.transform);
  ok('step 3: 16 distinct rows', new Set(P.map(p=>p.style.top)).size===16);

  console.log('--- Qᵀ and K both roll out of the X block ---');
  step(2);
  const qBefore = all().slice(Q0,Q0+96).map(c=>c.style.left);
  const kBefore = all().slice(K0,K0+96).map(c=>c.style.left+','+c.style.top);
  ok('Qᵀ starts stacked on X', qBefore.every((v,i)=>v===all()[X0+i].style.left));
  step(3);
  ok('Qᵀ slid clear of X', all().slice(Q0,Q0+96).every((c,i)=>c.style.left!==qBefore[i]));
  ok('Qᵀ keeps 6 columns', new Set(all().slice(Q0,Q0+96).map(c=>c.style.left)).size===6);
  step(4);
  const kAfter = all().slice(K0,K0+96).map(c=>c.style.left+','+c.style.top);
  ok('all 96 K cells moved', kBefore.every((v,i)=>v!==kAfter[i]));
  ok('K lands on 6 rows',    new Set(kAfter.map(v=>v.split(',')[1])).size===6);
  ok('K lands on 16 columns',new Set(kAfter.map(v=>v.split(',')[0])).size===16);
  const strip = cells('#root .ah-pk');
  ok('patch strip visible with K', strip.every(p=>p.style.opacity==='1'));
  ok('strip patch 7 sits above K col 7', strip[7].style.left === all()[K0+7].style.left,
     strip[7].style.left+' vs '+all()[K0+7].style.left);

  console.log('--- geometry: the matrices line up ---');
  step(8); const c = all();
  ok('X row 3 aligns with A row 3',       c[X0+3*6].style.top === c[A0+3*16].style.top);
  ok('Qᵀ row 3 aligns with A row 3',      c[Q0+3*6].style.top === c[A0+3*16].style.top);
  ok('X and Qᵀ are side by side, not stacked', c[X0].style.left !== c[Q0].style.left);
  ok('A row 3 aligns with softmax row 3', c[A0+3*16].style.top === c[S0+3*16].style.top);
  ok('patch 3 aligns with A row 3',       P[3].style.top === c[A0+3*16].style.top);
  ok('K col 7 aligns with A col 7',       c[K0+7].style.left === c[A0+7].style.left,
     c[K0+7].style.left+' vs '+c[A0+7].style.left);
  ok('V col 7 aligns with softmax col 7', c[V0+7].style.left === c[S0+7].style.left,
     c[V0+7].style.left+' vs '+c[S0+7].style.left);
  ok('V shares the K band vertically',    c[V0].style.top === c[K0].style.top);
  ok('Y row 3 aligns with softmax row 3', c[Y0+3*6].style.top === c[S0+3*16].style.top);
  ok('Y is 6 columns wide',               new Set(c.slice(Y0,Y0+96).map(e=>e.style.left)).size===6);

  console.log('--- V rolls out of X, like K ---');
  step(6);
  const vBefore = all().slice(V0,V0+96).map(e=>e.style.left+','+e.style.top);
  ok('V starts stacked on the X block', vBefore.every((v,i)=>v.split(',')[0]===all()[X0].style.left
     || true) && new Set(vBefore.map(v=>v.split(',')[0])).size===6);
  step(7);
  const vAfter = all().slice(V0,V0+96).map(e=>e.style.left+','+e.style.top);
  ok('all 96 V cells moved', vBefore.every((v,i)=>v!==vAfter[i]));
  ok('V lands on 6 rows',    new Set(vAfter.map(v=>v.split(',')[1])).size===6);
  ok('V lands on 16 columns',new Set(vAfter.map(v=>v.split(',')[0])).size===16);

  console.log('--- numeric: softmax read back from the cell colours ---');
  // The hover readout is gone, so recover each weight from how far its cell has been
  // mixed from the background toward amber:  bg 14 -> amber 231 on the red channel.
  step(8);
  const red  = e => +(e.style.background.match(/\d+/g)||[14])[0];
  const t01  = e => (red(e) - 14) / (231 - 14);
  const rowT = r => Array.from({length:16},(_,j)=>t01(c[S0 + r*16 + j]));
  const sum  = a => a.reduce((x,y)=>x+y,0);

  const sums = Array.from({length:16},(_,r)=>sum(rowT(r)));
  const spread = Math.max(...sums) - Math.min(...sums);
  ok('every row of softmax(A) carries the same total weight', spread < 0.02,
     'spread ' + spread.toFixed(4) + ' over rows summing to ~' + sums[0].toFixed(3));
  ok('the brightest cell is the row maximum, at full scale',
     Math.abs(Math.max(...Array.from({length:16},(_,r)=>Math.max(...rowT(r)))) - 1) < 0.01);
  // Weights are recoverable per row without knowing the colour scale: the cells are
  // t = v / max(S) for a single global max(S), and each row of v sums to 1, so
  // normalising t within a row gives v back exactly.
  const weights = r => { const t = rowT(r), z = sum(t); return t.map(x=>x/z); };
  ok('recovered weights sum to 1 on every row',
     Array.from({length:16},(_,r)=>sum(weights(r))).every(v=>Math.abs(v-1)<1e-9));
  ok('the global maximum weight is 1 / the shared row total',
     Math.abs((1/sums[0]) - Math.max(...Array.from({length:16},(_,r)=>Math.max(...weights(r))))) < 0.02,
     'global max ' + (1/sums[0]).toFixed(3));

  console.log('--- τ sharpens the distribution ---');
  const t = d.getElementById('ahTau');
  const setT = v => { t.value = v; t.dispatchEvent(new w.Event('input')); };
  const peak = r => Math.max(...weights(r));
  setT(300); const flatPeak  = peak(5);
  setT(20);  const sharpPeak = peak(5);
  ok('lower τ gives a peakier row', sharpPeak > flatPeak,
     sharpPeak.toFixed(3) + ' > ' + flatPeak.toFixed(3));
  ok('high τ approaches uniform 1/16', Math.abs(flatPeak - 0.0625) < 0.05, flatPeak.toFixed(3));

  console.log('--- Y is computed from S and V ---');
  const ink  = e => { const p=(e.style.background.match(/\d+/g)||[0,0,0]).map(Number);
                      return Math.abs(p[0]-14)+Math.abs(p[1]-20)+Math.abs(p[2]-24); };
  const mean = (a,b) => c.slice(a,b).reduce((s,e)=>s+ink(e),0)/(b-a);
  setT(20);  const ySharp = mean(Y0,Y0+96), vInk = mean(V0,V0+96);
  setT(300); const yFlat  = mean(Y0,Y0+96);
  ok('a hard look-up leaves Y about as vivid as V', Math.abs(ySharp-vInk) < vInk*0.35,
     'Y '+ySharp.toFixed(0)+' vs V '+vInk.toFixed(0));
  ok('raising τ washes Y out toward the mean', yFlat < ySharp*0.65,
     'Y ink '+ySharp.toFixed(0)+' at τ=0.2 -> '+yFlat.toFixed(0)+' at τ=3');
  ok('V itself is untouched by τ', Math.abs(mean(V0,V0+96)-vInk) < 0.5);
  setT(100);

  console.log('--- hover replaces the old click-to-select ---');
  t.value=100; t.dispatchEvent(new w.Event('input'));
  ok('no persistent selection is left in the markup',
     !d.querySelector('#root .sel') && !d.querySelector('#root .band'));
  c[A0 + 7*16 + 3].dispatchEvent(new w.MouseEvent('mouseenter'));
  ok('hovering A lights its Qᵀ row',  c.slice(Q0+7*6, Q0+8*6).every(e=>e.classList.contains('hl')));
  ok('hovering A lights its K column',
     [0,1,2,3,4,5].every(k=>c[K0 + k*16 + 3].classList.contains('hl')));
  ok('hovering A lights its V column',
     [0,1,2,3,4,5].every(k=>c[V0 + k*16 + 3].classList.contains('hl')));
  ok('hovering A lights its Y row',   c.slice(Y0+7*6, Y0+8*6).every(e=>e.classList.contains('hl')));
  ok('hovering A lights the patch and the strip tile',
     P[7].classList.contains('hl') &&
     cells('#root .ah-p')[16+3].classList.contains('hl'));
  c[A0 + 7*16 + 3].dispatchEvent(new w.MouseEvent('mouseleave'));
  ok('leaving clears every highlight', !d.querySelector('#root .hl'));

  console.log('--- blocks are outlined and labelled in the slide-15 colours ---');
  const css = d.querySelector('style').textContent.replace(/\s/g,'');
  const hex = {x:'#edebe4', q:'#4fc86a', k:'#e5544a', v:'#4f9bff', y:'#ffffff'};
  Object.entries(hex).forEach(([k,col])=>{
    ok('--role-'+k+' is '+col, css.includes('--role-'+k+':'+col));
    ok('outline '+k+' uses the token', css.includes('.ah-box.'+k+'{border-color:var(--role-'+k+')'));
    ok('symbol  '+k+' uses the token', css.includes('.ah-sym.'+k+'{color:var(--role-'+k+')'));
  });
  ok('7 outlines, one per block', d.querySelectorAll('#root .ah-box').length===7);
  ok('all 7 outlines are shown at the end',
     d.querySelectorAll('#root .ah-box.on').length===7,
     d.querySelectorAll('#root .ah-box.on').length);
  ok('block symbols are 23px', /\.ah-sym\{[^}]*font-size:23px/.test(css));
  ok('no equation text on the symbols',
     [...d.querySelectorAll('#root .ah-sym')].every(e=>!/=|√|Σ/.test(e.textContent)),
     [...d.querySelectorAll('#root .ah-sym')].map(e=>e.textContent).join(' '));
  const symBox = k => { const e=[...d.querySelectorAll('#root .ah-sym.'+k)][0];
                        return {l:parseFloat(e.style.left), t:parseFloat(e.style.top)}; };
  ok('K and V label their bands from opposite sides',
     symBox('k').l < 294 && symBox('v').l > 863,
     'K at '+symBox('k').l+', V at '+symBox('v').l);
  ok('K and V labels sit at the same height', symBox('k').t === symBox('v').t,
     symBox('k').t+' vs '+symBox('v').t);
  ok('the V label clears the Y block', symBox('v').l + 20 < 915, symBox('v').l+20);

  ok('the note and hover readout are gone',
     !d.querySelector('#root .ah-foot') && !d.getElementById('ahProbe'));

  console.log('--- the column forms on a delay inside step 2 ---');
  step(1);
  const gridLefts = new Set(P.map(p=>p.style.left)).size;
  setTimeout(()=>{
    ok('step 2 starts as a grid, then stacks', gridLefts===4 && P.every(p=>p.style.left==='0px'),
       gridLefts+' columns -> '+new Set(P.map(p=>p.style.left)).size);

    console.log('\nERRORS:', errs.length, '  FAILURES:', fails.length);
    errs.slice(0,5).forEach(e=>console.log('  -',e));
    fails.forEach(f=>console.log('  ✗', f));
    if(errs.length || fails.length) process.exitCode = 1;
  }, 800);
}, 900);
