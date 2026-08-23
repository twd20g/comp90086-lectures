/* Structural checks on components/encoder-block.html.
   Run: node test/encoder-block.checks.js        (needs: npm install jsdom)         */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','encoder-block.html');
const errs=[], fails=[];
const dom=new JSDOM(fs.readFileSync(FILE,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){ w.addEventListener('error',e=>errs.push(e.error&&e.error.stack||e.message)); }});
const w=dom.window, d=w.document;
const ok=(l,c,x='')=>{ if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '),l,x); };
const step=k=>{ d.getElementById('sbReset').click(); for(let i=0;i<k;i++) d.getElementById('sbNext').click(); };
const nodes=()=>[...d.querySelectorAll('#ebStage .eb-n')];
const on   =()=>nodes().filter(n=>n.classList.contains('on'));
const px=(e,p)=>parseFloat(e.style[p]);
// width/height fall back for labels, which are sized by their content
const box=e=>({l:px(e,'left'), r:px(e,'left')+(px(e,'width')||150),
              t:px(e,'top'),  b:px(e,'top')+(px(e,'height')||24)});

setTimeout(()=>{
  console.log('--- the input carries a position code ---');
  step(0);
  const N = nodes();
  ok('6 steps', d.querySelectorAll('#ebStage').length===1 &&
                d.querySelectorAll('#ebSteps .s').length===6, d.querySelectorAll('#ebSteps .s').length);
  ok('step 1 shows patch embeddings, position codes and the ⊕', on().length===3, on().length);
  const pos = N.find(n=>n.textContent.includes('position codes'));
  const emb = N.find(n=>n.textContent.includes('patch embeddings'));
  const add = on().find(n=>n.querySelector('.t').textContent.trim()==='+');
  ok('the position node exists and is styled apart', !!pos && pos.classList.contains('pos'));
  ok('embeddings sit above the position codes', box(emb).b <= box(pos).t);
  ok('both feed the same ⊕', box(add).l > box(emb).r && box(add).l > box(pos).r);
  ok('⊕ is vertically between them',
     box(add).t > box(emb).t && box(add).b < box(pos).b);
  ok('two arrows into the ⊕ are drawn',
     [...d.querySelectorAll('#ebStage line')].filter(l=>+l.getAttribute('opacity')>0).length===2);

  console.log('--- position is added once, outside the loop ---');
  step(5);
  const loop = d.querySelector('#ebStage .eb-loop');
  const L = {l:px(loop,'left'), r:px(loop,'left')+px(loop,'width')};
  ok('the loop is shown at the last step', loop.classList.contains('on'));
  ok('patch embeddings sit outside the loop', box(emb).r < L.l, box(emb).r+' < '+L.l);
  ok('position codes sit outside the loop',   box(pos).r < L.l);
  ok('the ⊕ sits outside the loop',           box(add).r < L.l, box(add).r+' < '+L.l);
  const msa = N.find(n=>n.textContent.includes('Multi-head'));
  const mlp = N.find(n=>n.querySelector('.t').textContent.trim()==='MLP');
  ok('attention is inside the loop', box(msa).l > L.l && box(msa).r < L.r);
  ok('the MLP is inside the loop',   box(mlp).l > L.l && box(mlp).r < L.r);
  const once = [...d.querySelectorAll('#ebStage .eb-lab')].find(e=>/added once/.test(e.textContent));
  ok('the "added once" caption appears with the loop', once && once.classList.contains('on'));

  console.log('--- reveal order ---');
  const count=[];
  for(let k=0;k<6;k++){ step(k); count.push(on().length); }
  ok('nodes only ever accumulate', count.every((v,i)=>i===0||v>=count[i-1]), count.join(' → '));
  ok('all 10 nodes are up by the last step', count[5]===10, count[5]);
  ok('MSA is the only amber node', nodes().filter(n=>n.classList.contains('mix')).length===1);

  console.log('--- legibility fixes ---');
  const css = d.querySelector('style').textContent.replace(/\s/g,'');
  ok('both inputs are solid, not dashed',
     css.includes('.eb-n.emb{border-color:var(--role-x)') && css.includes('.eb-n.pos{border-color:'));
  ok('patch embeddings no longer uses the near-invisible io style',
     !emb.classList.contains('io'), emb.className);
  ok('no sub-labels left under the block names',
     d.querySelectorAll('#ebStage .eb-n .s').length===0);
  const strokes = [...d.querySelectorAll('#ebStage line')].map(l=>l.getAttribute('stroke'));
  ok('connector arrows are light', strokes.every(c=>c==='#8b96a3'), strokes[0]);
  ok('arrowheads match', /fill="#8b96a3"/.test(d.querySelector('#ebStage svg').innerHTML));

  console.log('--- residual labels and output alignment ---');
  const labs = [...d.querySelectorAll('#ebStage .eb-lab')];
  const res  = labs.filter(e=>e.textContent.trim()==='residual');
  ok('two residual labels', res.length===2);
  ok('they take the teal accent', res.every(e=>e.classList.contains('sig')));
  ok('and a larger size', /\.eb-lab\.sig\{color:var\(--signal\);font-size:16px/.test(css));
  const out  = N.find(n=>n.textContent.includes('next block'));
  const plus = N.filter(n=>n.querySelector('.t').textContent.trim()==='+').pop();
  const mid  = e => px(e,'top') + px(e,'height')/2;
  ok('"to the next block" is centred on the last +', Math.abs(mid(out)-mid(plus)) < 1,
     mid(out)+' vs '+mid(plus));

  console.log('--- nothing collides with the dashed loop ---');
  step(5);
  const L2 = box(loop);
  const amber = labs.find(e=>/added once/.test(e.textContent));
  ok('the amber caption wraps to two lines', /<br>/i.test(amber.innerHTML), amber.innerHTML);
  ok('and clears the loop edge horizontally', box(amber).r < L2.l,
     box(amber).r+' vs loop left '+L2.l);
  res.forEach((e,i)=>ok('residual label '+(i+1)+' sits below the loop top',
     px(e,'top') > L2.t + 8, px(e,'top')+' vs loop top '+L2.t));
  ok('residual labels stay above the arc apex (~50)', res.every(e=>px(e,'top')+24 < 52));
  ok('the dashed loop is lighter than before',
     css.includes('.eb-loop{position:absolute;border:1pxdashedrgba(110,226,208,.75)'), 'rgba(110,226,208,.75)');

  console.log('--- the last line names which ⊕ ---');
  const last = [...d.querySelectorAll('#ebNotes .eb-line')].pop();
  ok('it says "first"', /first/.test(last.textContent), last.textContent);
  ok('it no longer implies every ⊕ is outside', !/The ⊕ sits/.test(last.textContent));

  console.log('--- the commentary builds ---');
  const lines = ()=>[...d.querySelectorAll('#ebNotes .eb-line')];
  ok('six commentary lines', lines().length===6);
  ok('lines are 19px', /\.eb-line\{font-size:19px/.test(css));
  const shown = [];
  for(let k=0;k<6;k++){ step(k); shown.push(lines().filter(e=>e.classList.contains('on')).length); }
  ok('one more line per step, none removed', shown.join()==='1,2,3,4,5,6', shown.join(' → '));
  ok('every line is short enough for one row',
     lines().every(e=>e.textContent.length < 115),
     'longest ' + Math.max(...lines().map(e=>e.textContent.length)) + ' chars');

  console.log('\nERRORS:', errs.length, '  FAILURES:', fails.length);
  errs.slice(0,4).forEach(e=>console.log('  -',e));
  fails.forEach(f=>console.log('  ✗',f));
  if(errs.length||fails.length) process.exitCode = 1;
}, 500);
