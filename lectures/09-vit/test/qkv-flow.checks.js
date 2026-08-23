/* Structural checks on components/qkv-flow.html.
   Run: node test/qkv-flow.checks.js            (needs: npm install jsdom)          */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','qkv-flow.html');
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
const rows=k=>[...d.querySelectorAll('#qfStage .qf-b.'+k)];
const xrow=()=>[...d.querySelectorAll('#qfStage .qf-b')].filter(b=>b.className==='qf-b on'||b.className==='qf-b');

setTimeout(()=>{
  console.log('--- one colour per role ---');
  const css = d.querySelector('style').textContent;
  const flat = css.replace(/\s/g,'');
  const wants = {k:'#e5544a', q:'#4fc86a', v:'#4f9bff', y:'#ffffff'};
  Object.entries(wants).forEach(([k,c])=>{
    ok('--role-'+k+' is '+c, flat.includes('--role-'+k+':'+c));
    ok(k+' row uses the token', flat.includes('.qf-b.'+k+'{border-color:var(--role-'+k+')'));
  });
  ok('each legend entry is tinted to match its row',
     ['x','k','q','v','y'].every(k=>css.includes('.qf-leg.'+k+' b')));

  console.log('--- rows and legend line up ---');
  step(4);
  const px=(e,p)=>parseFloat(e.style[p]);
  ['x','k','q','v','y'].forEach(k=>{
    const box = rows(k)[0] || [...d.querySelectorAll('#qfStage .qf-b')][0];
    const leg = d.querySelector('#qfStage .qf-leg.'+k);
    ok(k+' legend sits level with its row', Math.abs(px(leg,'top') - (px(box,'top')-8)) < 1,
       'legend '+px(leg,'top')+' vs row '+px(box,'top'));
  });
  ok('legend clears the grid', px(d.querySelector('#qfStage .qf-leg.k'),'left') >= 776+20);
  ok('legend text is 17px', /\.qf-leg\{[^}]*font-size:17px/.test(css));

  console.log('--- the query is fixed, the emphasis is deterministic ---');
  ok('query defaults to q6', d.getElementById('qfSel').textContent==='q6',
     d.getElementById('qfSel').textContent);
  const strong = sel => [...d.querySelectorAll('#qfStage path')]
      .map((p,i)=>({i, w:+p.getAttribute('stroke-width'), o:+p.getAttribute('opacity')}))
      .filter(p=>p.w > 2);
  ok('exactly 4 bold arcs (2 query→key, 2 value→output)', strong().length===4, strong().length);
  const boldKeys = rows('k').map((b,i)=>b.classList.contains('sel')?i:-1).filter(i=>i>=0);
  ok('the bold keys are k4 and k10', boldKeys.map(i=>i+1).join()==='4,10', boldKeys.map(i=>i+1).join());
  const boldVals = rows('v').map((b,i)=>b.classList.contains('sel')?i:-1).filter(i=>i>=0);
  ok('the same two values are emphasised', boldVals.join()===boldKeys.join());
  ok('only y6 is fully drawn', rows('y').filter(b=>b.style.opacity==='1').length===1);

  console.log('--- arrowheads only where the arrow is vertical ---');
  // the marker definitions in <defs> are <path>s too — only count direct children
  const arcs  = [...d.querySelectorAll('#qfStage path')].filter(p=>p.parentNode.tagName==='svg');
  const lines = [...d.querySelectorAll('#qfStage line')];
  ok('32 lateral arcs, none with an arrowhead', arcs.length===32 &&
     arcs.every(p=>!p.getAttribute('marker-end')), arcs.length+' arcs');
  ok('the vertical arrows keep theirs', lines.length===64 &&
     lines.every(l=>/^url\(#qfA-/.test(l.getAttribute('marker-end')||'')), lines.length+' lines');

  console.log('--- row labels are large and colour-matched ---');
  const lab = k => d.querySelector('#qfStage .qf-rl.'+k);
  ok('a label per row', ['p','x','k','q','v','y'].every(k=>!!lab(k)));
  ok('labels are 17px', /\.qf-rl\{[^}]*font-size:17px/.test(css));
  ['x','k','q','v','y'].forEach(k=>
    ok('label '+k+' takes its colour from the token',
       css.replace(/\s/g,'').includes('.qf-rl.'+k+'{color:var(--role-'+k+')')));
  ['x','k','q','v','y'].forEach(k=>{
    const box = rows(k)[0] || [...d.querySelectorAll('#qfStage .qf-b')][0];
    ok('label '+k+' sits on its row',
       Math.abs(parseFloat(lab(k).style.top) - (parseFloat(box.style.top)+3)) < 1);
  });

  console.log('--- reloading gives the same picture ---');
  step(2); step(4);
  ok('query is still q6 after stepping away and back', d.getElementById('qfSel').textContent==='q6');
  rows('q')[9].dispatchEvent(new w.MouseEvent('click'));
  ok('clicking q10 moves the query', d.getElementById('qfSel').textContent==='q10');
  const k2 = rows('k').map((b,i)=>b.classList.contains('sel')?i+1:0).filter(Boolean);
  ok('emphasis follows the selection', k2.join()==='8,14', k2.join());
  step(4);
  ok('restart returns to q6', d.getElementById('qfSel').textContent==='q6');

  console.log('\nERRORS:', errs.length, '  FAILURES:', fails.length);
  errs.slice(0,4).forEach(e=>console.log('  -',e));
  fails.forEach(f=>console.log('  ✗',f));
  if(errs.length||fails.length) process.exitCode = 1;
}, 800);
