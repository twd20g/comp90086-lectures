/* Checks on components/contrastive-matrix.html — structure, the step build, and
   legibility. The numbers are checked elsewhere: they are computed from the
   image pixels, which jsdom stubs, so asserting them here would only be checking
   synthetic data. contrastive-matrix.browser.js does that in a real browser, via
   framework/tools/check_component.py.

   The encoder is a stand-in — twelve colour and gradient statistics, not a
   trained network. That used to be disclosed in small print on the slide; it was
   cut deliberately because it interrupted the argument, and it is now the
   presenter's line to deliver. The header comment on the component records it.

   Run: node test/contrastive-matrix.checks.js                                  */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','contrastive-matrix.html');

function ctx(){
  return {clearRect(){}, drawImage(){}, save(){}, restore(){}, translate(){}, scale(){},
    getImageData(x,y,w,h){ const d = new Uint8ClampedArray(w*h*4);
      for(let i=0;i<w*h;i++){ d[i*4]=(x+i)%255; d[i*4+1]=(y+i*2)%255; d[i*4+2]=(i*5)%255; d[i*4+3]=255; }
      return {data:d,width:w,height:h}; },
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4),width:w,height:h}; }};
}
const errs = [], fails = [];
const dom = new JSDOM(fs.readFileSync(FILE,'utf8'), {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext = () => ctx();
    Object.defineProperty(w.HTMLImageElement.prototype, 'src', {set(){ const s = this;
      Object.defineProperty(s,'naturalWidth',{value:94,configurable:true});
      Object.defineProperty(s,'naturalHeight',{value:95,configurable:true});
      Object.defineProperty(s,'complete',{value:true,configurable:true});
      setTimeout(()=>s.onload && s.onload(), 0); }, get(){ return ''; }});
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const d = dom.window.document;
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };

setTimeout(() => {
  const css = fs.readFileSync(FILE,'utf8');
  const last = () => { for(let i=0;i<10;i++) d.getElementById('sbNext').click(); };

  console.log('--- the matrix has a row and a column for each image ---');
  last();
  ok('16 cells', d.querySelectorAll('#cmStage .cm-cell').length === 16,
     d.querySelectorAll('#cmStage .cm-cell').length);
  ok('4 originals down the side',
     d.querySelectorAll('#cmStage .cm-thumb.row').length === 4);
  ok('4 second views across the top',
     d.querySelectorAll('#cmStage .cm-thumb.col').length === 4);
  ok('every cell is addressed by row and column',
     [...d.querySelectorAll('#cmStage .cm-cell')]
       .every(e => e.dataset.r !== undefined && e.dataset.c !== undefined));
  ok('the two axes are labelled, and distinguished',
     /z\s+image/.test(d.querySelector('#cmStage').textContent) &&
     /second view/.test(d.querySelector('#cmStage').textContent));

  console.log('--- exactly four cells are positives, and they are the diagonal ---');
  const pos = [...d.querySelectorAll('#cmStage .cm-cell.pos')];
  ok('four positives', pos.length === 4, pos.length);
  ok('and they are r === c', pos.every(e => e.dataset.r === e.dataset.c),
     pos.map(e => e.dataset.r + ',' + e.dataset.c).join(' '));
  ok('the other twelve are negatives',
     d.querySelectorAll('#cmStage .cm-cell.neg').length === 12);
  ok('no cell is both', d.querySelectorAll('#cmStage .cm-cell.pos.neg').length === 0);

  console.log('--- the encoder output is drawn beside the tile it came from ---');
  ok('one strip per view, both axes',
     d.querySelectorAll('#cmStage .cm-vec.row').length === 4 &&
     d.querySelectorAll('#cmStage .cm-vec.col').length === 4,
     d.querySelectorAll('#cmStage .cm-vec').length + ' strips');
  ok('twelve squares in each, matching the embedding width',
     [...d.querySelectorAll('#cmStage .cm-vec')].every(v => v.children.length === 12),
     [...new Set([...d.querySelectorAll('#cmStage .cm-vec')].map(v => v.children.length))].join(','));
  ok('every square is painted',
     [...d.querySelectorAll('#cmStage .cm-vec i')].every(i => /rgb/.test(i.style.background)),
     d.querySelectorAll('#cmStage .cm-vec i').length + ' squares');
  ok('a row strip runs down beside its row, a column strip across under its column',
     /grid-template-rows/.test(css.match(/\.cm-vec\.row\{[^}]*\}/)[0]) &&
     /grid-template-columns/.test(css.match(/\.cm-vec\.col\{[^}]*\}/)[0]));

  console.log('--- the build order matches the argument ---');
  for(let i=0;i<10;i++) d.getElementById('sbPrev').click();
  const lit = sel => d.querySelectorAll(sel + '.on').length;
  ok('step 0: the four images, no second views',
     lit('#cmStage .cm-thumb.row') === 4 && lit('#cmStage .cm-thumb.col') === 0);
  ok('and no strips, no numbers', lit('#cmStage .cm-vec') === 0 && lit('#cmStage .cm-cell') === 0);
  d.getElementById('sbNext').click();
  ok('step 1: the second views arrive', lit('#cmStage .cm-thumb.col') === 4);
  ok('still nothing computed', lit('#cmStage .cm-vec') === 0 && lit('#cmStage .cm-cell') === 0);
  d.getElementById('sbNext').click();
  ok('step 2: the encoder runs — all eight strips', lit('#cmStage .cm-vec') === 8);
  ok('but no similarities yet', lit('#cmStage .cm-cell') === 0);
  d.getElementById('sbNext').click();
  ok('step 3: all 16 similarities', lit('#cmStage .cm-cell') === 16);
  ok('but nothing is marked positive yet', d.querySelectorAll('#cmStage .cm-cell.pos').length === 0);
  ok('the legend waits too', !d.getElementById('cmKey').classList.contains('on'));
  d.getElementById('sbNext').click();
  ok('step 4: the diagonal is named', d.querySelectorAll('#cmStage .cm-cell.pos').length === 4);
  ok('and the legend arrives', d.getElementById('cmKey').classList.contains('on'));
  ok('the cells are still similarities, not yet a distribution',
     !/%/.test(d.querySelector('#cmStage .cm-cell').textContent),
     d.querySelector('#cmStage .cm-cell').textContent);
  ok('and no row sums are shown', lit('#cmStage .cm-sum') === 0);
  ok('temperature is still held back', !d.getElementById('cmTau').classList.contains('on'));
  d.getElementById('sbNext').click();
  ok('step 5: the rows become distributions',
     [...d.querySelectorAll('#cmStage .cm-cell')].every(e => /%$/.test(e.textContent.trim())),
     d.querySelector('#cmStage .cm-cell').textContent);
  ok('a row sum appears beside each row', lit('#cmStage .cm-sum') === 4);
  ok('the knob is held back one more step, so the conversion lands on its own',
     !d.getElementById('cmTau').classList.contains('on'));
  d.getElementById('sbNext').click();
  ok('step 6: temperature', d.getElementById('cmTau').classList.contains('on'));

  console.log('--- legibility ---');
  const size = re => { const m = css.match(re); return m ? parseFloat(m[1]) : 0; };
  ok('cell numbers are 15px',   size(/\.cm-cell\{[^}]*font-size:([\d.]+)px/) >= 15);
  ok('the legend clears 17px',  size(/\.cm-key \.r\{[^}]*font-size:([\d.]+)px/) >= 17);
  ok('the readout clears 17px', size(/\.cm-out\{[^}]*font-size:([\d.]+)px/) >= 17);
  ok('the commentary is 19px',  size(/\.cm-point\{[^}]*font-size:([\d.]+)px/) >= 19);
  ok('the stage is flex:none',  /\.cm-stage\{[^}]*flex:none/.test(css));

  console.log('\nERRORS:', errs.length, '  FAILURES:', fails.length);
  errs.slice(0,4).forEach(e => console.log('  -', e));
  fails.forEach(f => console.log('  ✗', f));
  if(errs.length || fails.length) process.exitCode = 1;
}, 700);
