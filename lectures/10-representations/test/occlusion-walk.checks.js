/* Checks on components/occlusion-walk.html.

   The table is the slide's argument, so most of this is the table: the columns
   it promises, the rows it builds, and — the one that matters — that the deltas
   are the arithmetic of the scores beside them rather than three numbers typed
   independently.

   The scores are illustrative, not quoted: Zeiler & Fergus publish the heat map,
   not a table of probabilities. The slide's citation says so, and a check below
   holds it there.

   Run: node test/occlusion-walk.checks.js                                      */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','occlusion-walk.html');

const errs = [], fails = [];
const dom = new JSDOM(fs.readFileSync(FILE,'utf8'), {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    w.requestAnimationFrame = f => setTimeout(f, 0);
    Object.defineProperty(w.HTMLImageElement.prototype, 'src', {set(){ const s = this;
      Object.defineProperty(s,'naturalWidth',{value:273,configurable:true});
      Object.defineProperty(s,'naturalHeight',{value:263,configurable:true});
      setTimeout(()=>s.onload && s.onload(), 0); }, get(){ return ''; }});
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const d = dom.window.document;
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };

setTimeout(() => {
  const css = fs.readFileSync(FILE,'utf8');
  const to = k => { for(let i=0;i<6;i++) d.getElementById('sbPrev').click();
                    for(let i=0;i<k;i++) d.getElementById('sbNext').click(); };

  console.log('--- one image, one network, one table ---');
  ok('a single photograph', d.querySelectorAll('.ow-photo').length === 1);
  ok('a single box, and it is named rather than drawn as an architecture',
     d.querySelectorAll('.ow-net').length === 1 &&
     /Network/.test(d.querySelector('.ow-net').textContent),
     d.querySelector('.ow-net').textContent);
  ok('two arrows: into the network and out of it',
     d.querySelectorAll('#owStage line').length === 2);
  ok('the mask sits inside the photograph, so it moves with it',
     d.querySelector('#owMask').parentNode.classList.contains('ow-photo'));

  console.log('--- the table promises four columns and fills them ---');
  const th = [...d.querySelectorAll('#owTab th')].map(e => e.textContent.trim());
  ok('Condition, Class, Score, Delta',
     th.join('|') === 'Condition|Class|Score|Delta', th.join('|'));
  to(2);
  const rows = [...d.querySelectorAll('#owTab tr[data-i]')]
                 .map(r => [...r.children].map(c => c.textContent.trim()));
  rows.forEach(r => console.log('         ', r.join('  |  ')));
  ok('three rows', rows.length === 3, rows.length);
  ok('the first is the unoccluded input, with no delta',
     rows[0][0] === 'Input' && rows[0][3] === '', JSON.stringify(rows[0]));
  ok('then Occlusion 1 and Occlusion 2',
     rows[1][0] === 'Occlusion 1' && rows[2][0] === 'Occlusion 2');
  ok('the class is named on every row, and is the same one throughout',
     rows.every(r => r[1] === 'African elephant'));

  console.log('--- the deltas are the arithmetic, not three typed numbers ---');
  const num = s => parseFloat(String(s).replace('−','-'));
  const base = num(rows[0][2]);
  ok('the input scores 0.98', base === 0.98, base);
  [1,2].forEach(i => {
    const want = +(base - num(rows[i][2])).toFixed(2);
    ok('row ' + i + ': ' + base + ' − ' + num(rows[i][2]) + ' = ' + want.toFixed(2),
       Math.abs(Math.abs(num(rows[i][3])) - want) < 1e-9, rows[i][3]);
  });
  ok('and the delta is shown as a fall, not a bare magnitude',
     rows[1][3].startsWith('−') && rows[2][3].startsWith('−'), rows[1][3]);
  ok('covering the head costs an order of magnitude more than the background',
     Math.abs(num(rows[2][3])) / Math.abs(num(rows[1][3])) >= 10,
     (Math.abs(num(rows[2][3])) / Math.abs(num(rows[1][3]))).toFixed(0) + '×');

  console.log('--- the mask moves, and lands where the paper put it ---');
  const mask = d.querySelector('#owMask');
  const pct = p => Math.round(parseFloat(mask.style[p]) / 268 * 100);
  to(1);
  ok('step 2 puts it low and right — the ground beside the elephant',
     pct('left') === 63 && pct('top') === 65, pct('left') + '%, ' + pct('top') + '%');
  ok('and numbers it 1', mask.textContent.trim() === '1', mask.textContent.trim());
  to(2);
  ok('step 3 moves the same mask up and left, onto the head',
     pct('left') === 22 && pct('top') === 17, pct('left') + '%, ' + pct('top') + '%');
  ok('and renumbers it 2', mask.textContent.trim() === '2', mask.textContent.trim());
  ok('it is one element that moves, not two that appear',
     d.querySelectorAll('#owStage .ow-mask').length === 1);
  ok('the move is animated, so the audience can follow it',
     /\.ow-mask\{[^}]*transition:[^}]*left/.test(css.replace(/\s+/g,' ')));
  const maskCss = (css.replace(/\s+/g,'').match(/\.ow-mask\{[^}]*\}/) || [''])[0];
  ok('the number is centred in the mask, not tucked in a corner',
     /align-items:center/.test(maskCss) && /justify-content:center/.test(maskCss));
  ok('and it is large enough to read across a room',
     parseFloat((maskCss.match(/font-size:([\d.]+)px/) || [0,0])[1]) >= 26,
     (maskCss.match(/font-size:[\d.]+px/) || [''])[0]);

  console.log('--- the build ---');
  to(0);
  const lit = () => d.querySelectorAll('#owTab tr[data-i].on').length;
  ok('step 1: the input row only', lit() === 1, lit());
  ok('no mask yet', !d.querySelector('#owMask').classList.contains('on'));
  ok('the header is not part of the build', !!d.querySelector('#owTab th'));
  to(1); ok('step 2: two rows', lit() === 2, lit());
  ok('and the mask has arrived', d.querySelector('#owMask').classList.contains('on'));
  to(2); ok('step 3: all three', lit() === 3, lit());
  ok('the closing line arrives with the last row',
     d.querySelector('#owNote').classList.contains('on'));

  console.log('--- legibility, and the borders that would not hide ---');
  const size = re => { const m = css.match(re); return m ? parseFloat(m[1]) : 0; };
  ok('table values are 19px', size(/\.ow-tab td\{[^}]*font-size:([\d.]+)px/) >= 19);
  ok('the note is 19px',      size(/\.ow-note\{[^}]*font-size:([\d.]+)px/) >= 19);
  ok('the network label is 19px', size(/\.ow-net\{[^}]*font-size:([\d.]+)px/) >= 19);
  // collapsed borders belong to the table, so opacity:0 on a row left its rule drawn
  ok('borders are separate, so an unbuilt row leaves no line behind',
     /\.ow-tab\{[^}]*border-collapse:separate/.test(css.replace(/\s+/g,'')));

  console.log('\nERRORS:', errs.length, '  FAILURES:', fails.length);
  errs.slice(0,4).forEach(e => console.log('  -', e));
  fails.forEach(f => console.log('  ✗', f));
  if(errs.length || fails.length) process.exitCode = 1;
}, 700);
