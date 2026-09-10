/* Fragments reveal one at a time in document order — unless a slide numbers them
   with data-frag, in which case the number is the step and two fragments sharing
   a number arrive together.

   That exists for one reason: a figure sometimes has to sit above the bullets
   for the layout to work, while belonging to a bullet halfway down. The SE(3)
   slide in lecture 14 is the case — its two 4x4 matrices are side by side at the
   top, and the inverse belongs with the bullet about inverses.

   Both paths are checked here: the numbered slide reveals in the order it asks
   for and reverses symmetrically, and an ordinary slide still goes one at a time
   in document order, which is what every other deck depends on.

   Run: node framework/test/fragments.checks.js                                */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, '..', '..', 'dist', 'standalone', '14-two-view-geometry.html');
const html = fs.readFileSync(FILE, 'utf8');

const errs = [], fails = [];
const ok = (l, c, x = '') => { if (!c) fails.push(l); console.log((c ? '  ok   ' : '  FAIL '), l, x); };

const dom = new JSDOM(html, {runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    w.HTMLCanvasElement.prototype.getContext = function(){
      return new Proxy({}, { get: () => () => ({ data: new Uint8ClampedArray(4) }) });
    };
    w.requestAnimationFrame = fn => w.setTimeout(() => fn(0), 16);
    w.cancelAnimationFrame = id => w.clearTimeout(id);
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const { window: w } = dom, d = w.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = k => d.dispatchEvent(new w.KeyboardEvent('keydown', {key: k, bubbles: true}));

const slideByTitle = t => [...d.querySelectorAll('.slide')]
  .findIndex(s => (s.dataset.title || '').includes(t));
// the slide index is the only handle the engine offers for jumping straight to
// a slide: its items call show(i) directly. Setting location.hash does nothing
// after boot, which is what made the first draft of this suite test slide 1.
const goto = async i => { d.querySelectorAll('#menuList li')[i].click(); await sleep(120); };
const state = s => [...s.querySelectorAll('.frag')]
  .map(e => e.classList.contains('on') ? 1 : 0).join('');

(async () => {
  await sleep(400);

  console.log('--- a numbered slide reveals in the order it asks for ---');
  const i = slideByTitle('SE(3)');
  ok('the SE(3) slide is in the deck', i >= 0, 'index ' + i);
  await goto(i);
  const s = d.querySelectorAll('.slide')[i];
  const frags = [...s.querySelectorAll('.frag')];
  ok('it has six fragments across five steps', frags.length === 6,
     frags.length + ' fragments');
  ok('two of them share a number', frags.filter(e => e.dataset.frag === '4').length === 2);

  // document order is: bullet1, eq, eqInv, bullet2, bullet3, bullet4
  const want = ['000000', '100000', '110000', '110100', '111110', '111111'];
  const seen = [state(s)];
  for (let k = 0; k < 5; k++) { key('ArrowRight'); await sleep(60); seen.push(state(s)); }
  ok('five presses reveal five steps, the inverse arriving with its bullet',
     JSON.stringify(seen) === JSON.stringify(want), seen.join(' → '));

  const back = [];
  for (let k = 0; k < 5; k++) { key('ArrowLeft'); await sleep(60); back.push(state(s)); }
  ok('and it reverses through exactly the same states',
     JSON.stringify(back) === JSON.stringify(want.slice(0, 5).reverse()), back.join(' → '));

  console.log('\n--- an unnumbered slide is untouched by any of that ---');
  const j = slideByTitle('Outline');
  await goto(j);
  const o = d.querySelectorAll('.slide')[j];
  const n = o.querySelectorAll('.frag').length;
  ok('the outline numbers nothing',
     [...o.querySelectorAll('.frag')].every(e => e.dataset.frag === undefined));
  const walk = [state(o)];
  for (let k = 0; k < n; k++) { key('ArrowRight'); await sleep(60); walk.push(state(o)); }
  const oneByOne = Array.from({length: n + 1}, (_, k) => '1'.repeat(k) + '0'.repeat(n - k));
  ok('and reveals one at a time, in document order',
     JSON.stringify(walk) === JSON.stringify(oneByOne), walk.join(' → '));

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f => console.log('  ✗', f));
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
})();

setTimeout(() => { console.log('\n  FAIL  still running after every check finished');
  process.exit(1); }, 30000).unref();
