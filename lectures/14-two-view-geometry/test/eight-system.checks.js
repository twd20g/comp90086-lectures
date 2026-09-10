/* Four steps, three pictures. The thing that can go wrong here is not the
   mathematics -- the equations are typeset once and never computed -- but the
   swapping: two stages showing at once, or the last step blanking the matrix
   because there is no fourth equation to move to.

   So this checks exactly one stage is on at every step, that step 3 keeps the
   eight-row picture rather than clearing it, and that the text accumulates
   while the picture replaces.

   The stages must also be the same size or the cross-fade jumps. That cannot be
   measured in jsdom, which has no layout, so it is asserted structurally here --
   all three are absolutely positioned in one box with the same declared size --
   and was measured in a real browser: 226 px tall and centred on (345, 150) at
   all three stages, because the nine-tall f column sets the height from the
   first one.

   Run: node test/eight-system.checks.js                                        */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','eight-system.html');
const html = fs.readFileSync(FILE, 'utf8');

const errs = [], fails = [];
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };

const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext = function(){
      return new Proxy({}, { get: () => () => ({ data: new Uint8ClampedArray(4) }) }); };
    w.requestAnimationFrame = fn => w.setTimeout(()=>fn(0), 16);
    w.cancelAnimationFrame = id => w.clearTimeout(id);
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const { window: w } = dom, d = w.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shown = () => [...d.querySelectorAll('.es-eq')]
  .filter(e => e.classList.contains('on')).map(e => e.dataset.e);
const texts = () => d.querySelectorAll('.es-row.on').length;
async function to(n){
  d.getElementById('sbReset').click(); await sleep(30);
  for(let i = 0; i < n; i++){ d.getElementById('sbNext').click(); await sleep(30); }
  await sleep(40);
}

(async () => {
  await sleep(400);
  console.log('--- the shape of it ---');
  ok('four step chips', d.querySelectorAll('.steps .s').length === 4);
  ok('three stages of the system', d.querySelectorAll('.es-eq').length === 3);
  ok('and four lines of text, one per step', d.querySelectorAll('.es-row').length === 4);
  ok('every stage is a typeset equation, not hand-built cells',
     [...d.querySelectorAll('.es-eq')].every(e => e.querySelector('.tex svg')));

  console.log('\n--- one stage at a time ---');
  const want = ['0', '1', '2', '2'];       // step 3 keeps the eight-row picture
  for(let k = 0; k <= 3; k++){
    await to(k);
    const s = shown();
    ok('step ' + k + ': exactly one stage showing, and it is stage ' + want[k],
       s.length === 1 && s[0] === want[k], JSON.stringify(s));
    ok('step ' + k + ': the text has accumulated to ' + (k+1) + ' line(s)',
       texts() === k + 1, texts() + ' showing');
  }

  console.log('\n--- and it goes backwards ---');
  const back = [];
  for(let k = 0; k < 3; k++){
    d.getElementById('sbPrev').click(); await sleep(40);
    back.push(shown()[0] + ':' + texts());
  }
  ok('stepping back walks the stages and the text down together',
     JSON.stringify(back) === JSON.stringify(['2:3', '1:2', '0:1']), back.join(' → '));

  console.log('\n--- the three stack in one box, so the swap cannot jump ---');
  const boxes = [...d.querySelectorAll('.es-eq')].map(e => w.getComputedStyle(e));
  ok('all three are absolutely positioned', boxes.every(s => s.position === 'absolute'));
  ok('at the same place', boxes.every(s => s.left === boxes[0].left && s.top === boxes[0].top),
     boxes.map(s => s.left + '/' + s.top).join(' '));
  ok('and the same size', boxes.every(s => s.width === boxes[0].width &&
                                           s.height === boxes[0].height),
     boxes[0].width + ' x ' + boxes[0].height);
  const holder = w.getComputedStyle(d.querySelector('.es-right'));
  ok('in a box that reserves that height whatever is showing',
     holder.position === 'relative' && holder.height === boxes[0].height,
     holder.height + ' vs ' + boxes[0].height);

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f => console.log('  ✗', f));
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
})();

setTimeout(() => { console.log('\n  FAIL  still running after every check finished');
  process.exit(1); }, 30000).unref();
