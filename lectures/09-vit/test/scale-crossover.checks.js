/* Checks on components/scale-crossover.html.

   This slide replaced a scraped figure with quoted numbers, so most of what
   follows is provenance: every value on screen must match the table it came
   from, and the arithmetic between them must be done rather than asserted.

   Sources, fixed here so a change to the component has to change the test too:
     Kolesnikov et al. (2020) Table 2 — BiT-S 81.30, BiT-M 85.39 (ResNet152x4)
     Kolesnikov et al. (2020) Table 1 — BiT-L 87.54 (ResNet152x4)
     Dosovitskiy et al. (2021) Table 5 — ViT-B/16 77.91, ViT-L/16 85.15,
                                         ViT-H/14 88.04, ViT-L/16@JFT 87.12
     Dosovitskiy et al. (2021) Table 2 — TPUv3-core-days 9.9k / 2.5k / 0.68k

   Run: node test/scale-crossover.checks.js                                    */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','sandbox','scale-crossover.html');

const SOURCE = {
  cnn: { '1.3M': 81.30, '14M': 85.39, '300M': 87.54 },
  vit: { '1.3M': 77.91, '14M': 85.15, '300M': 88.04 },
  model: { '1.3M': 'ViT-B/16', '14M': 'ViT-L/16', '300M': 'ViT-H/14' },
  days: { 'BiT-L (ResNet152x4)': '9.9k', 'ViT-H/14': '2.5k', 'ViT-L/16': '0.68k' },
};

const errs = [], fails = [];
const dom = new JSDOM(fs.readFileSync(FILE,'utf8'), {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext = () => ({clearRect(){},drawImage(){},
      getImageData:(x,y,wd,h)=>({data:new Uint8ClampedArray(wd*h*4),width:wd,height:h}),
      createImageData:(wd,h)=>({data:new Uint8ClampedArray(wd*h*4),width:wd,height:h})});
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const w = dom.window, d = w.document;
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };
const num = s => parseFloat(String(s).replace('−','-'));

setTimeout(() => {
  const css = fs.readFileSync(FILE,'utf8');
  const last = () => { for(let i=0;i<8;i++) d.getElementById('sbNext').click(); };
  last();

  console.log('--- the table quotes its sources exactly ---');
  const rows = [...d.querySelectorAll('#scTab tr')].slice(1)
                 .map(r => [...r.children].map(c => c.textContent.trim()));
  rows.forEach(r => console.log('         ', r.join(' | ')));
  ok('one row per pre-training scale', rows.length === 3, rows.length);
  Object.keys(SOURCE.cnn).forEach((k, i) => {
    ok('CNN at ' + k + ' is BiT\'s ' + SOURCE.cnn[k].toFixed(2),
       num(rows[i][1]) === SOURCE.cnn[k], rows[i][1]);
    ok('ViT at ' + k + ' is ' + SOURCE.model[k] + '\'s ' + SOURCE.vit[k].toFixed(2),
       num(rows[i][2]) === SOURCE.vit[k] && rows[i][2].includes(SOURCE.model[k]), rows[i][2]);
  });
  ok('the CNN column names the one architecture used at all three scales',
     /ResNet152x4/.test(d.querySelector('#scTab th.cnn').textContent));

  console.log('--- the bars are that arithmetic, not a second set of numbers ---');
  const bars = [...d.querySelectorAll('#scPlot .sc-val')].map(e => e.textContent.trim());
  console.log('         ', bars.join('  '));
  ok('one labelled bar per scale', bars.length === 3, bars.length);
  Object.keys(SOURCE.cnn).forEach((k, i) => {
    const want = +(SOURCE.cnn[k] - SOURCE.vit[k]).toFixed(2);
    ok('bar ' + i + ' is BiT − ViT at ' + k + ' = ' + want.toFixed(2),
       Math.abs(num(bars[i]) - want) < 1e-9, bars[i]);
  });
  ok('the sign convention is explicit both ways',
     /CNN ahead/.test(d.querySelector('#scPlot').textContent) &&
     /ViT ahead/.test(d.querySelector('#scPlot').textContent));

  console.log('--- the crossover is real, and only just ---');
  const gaps = Object.keys(SOURCE.cnn).map(k => +(SOURCE.cnn[k] - SOURCE.vit[k]).toFixed(2));
  ok('the CNN leads at 1.3M', gaps[0] > 0, gaps[0]);
  ok('the lead has all but gone by 14M', gaps[1] > 0 && gaps[1] < 0.5, gaps[1]);
  ok('and it has crossed by 300M', gaps[2] < 0, gaps[2]);
  ok('the gaps shrink monotonically', gaps[0] > gaps[1] && gaps[1] > gaps[2], gaps.join(' > '));
  ok('the 3.39 in the prose is the computed gap, not a typed one',
     /3\.39 points ahead/.test(d.getElementById('scPoints').textContent) && gaps[0] === 3.39);

  console.log('--- the honest caveat is on the slide, not just in the comment ---');
  const prose = d.getElementById('scPoints').textContent;
  ok('the crossover needs a bigger model too, and says so',
     /ViT-L\/16 alone is still 0\.42 behind/.test(prose));
  ok('and 87.54 − 87.12 really is 0.42', +(87.54 - 87.12).toFixed(2) === 0.42);
  ok('the three ViT variants are named, so nobody thinks it is one model',
     ['ViT-B/16','ViT-L/16','ViT-H/14'].every(m => d.getElementById('scTab').textContent.includes(m)));

  console.log('--- the compute payoff ---');
  const comp = [...d.querySelectorAll('#scComp .r')]
                 .map(r => [r.firstChild.textContent.trim(), r.querySelector('.n').textContent.trim()]);
  comp.forEach(c => console.log('         ', c.join(' = ')));
  ok('three compute figures', comp.length === 3, comp.length);
  comp.forEach(([what, days]) => ok(what + ' is ' + SOURCE.days[what] + ' core-days',
                                    SOURCE.days[what] === days, days));
  ok('9.9k / 2.5k really is about a quarter',
     Math.abs(2.5 / 9.9 - 0.25) < 0.03 && /a quarter of the pre-training compute/.test(prose));
  ok('the units are named', /TPUv3-core-days/.test(d.getElementById('scComp').textContent));

  console.log('--- provenance is visible to the audience ---');
  const src = d.getElementById('scSrc').textContent;
  ok('the CNN source is cited', /Kolesnikov et al\. \(2020\)/.test(src), src.slice(0,40));
  ok('the ViT source is cited', /Dosovitskiy et al\. \(2021\)/.test(src));
  ok('and it says which table, since Figure 4 has none', /Table 5/.test(src));
  // rendered text only: d.body.textContent includes the inline <script>, so a
  // code comment saying "never digitised" used to fail this
  const shown = d.getElementById('root').textContent;
  ok('nothing on screen hedges about where a number came from',
     !/read from the (figure|plot|graph)|digitis|approximate/i.test(shown));
  ok('both tables are named, so a student can check any number',
     /Tables 1–2/.test(src) && /Table 5/.test(src) && /Table 2/.test(src));

  console.log('--- legibility: nothing carrying meaning is below the floor ---');
  const size = re => { const m = css.match(re); return m ? parseFloat(m[1]) : 0; };
  ok('bar values are 19px',        size(/\.sc-val\{[^}]*font-size:([\d.]+)px/) >= 19);
  ok('scale names are 19px',       size(/\.sc-x b\{[^}]*font-size:([\d.]+)px/) >= 19);
  ok('dataset names clear 17px',   size(/\.sc-x span\{[^}]*font-size:([\d.]+)px/) >= 17);
  ok('the sign key clears 17px',   size(/\.sc-side\{[^}]*font-size:([\d.]+)px/) >= 17);
  ok('the commentary is 19px',     size(/\.sc-point\{[^}]*font-size:([\d.]+)px/) >= 19);
  ok('the table numbers are 15px', size(/\.sc-tab td\{[^}]*font-size:([\d.]+)px/) >= 15);

  console.log('--- the build reveals one scale at a time ---');
  for(let i=0;i<9;i++) d.getElementById('sbPrev').click();
  const lit = () => [...d.querySelectorAll('#scPlot .sc-bar')].filter(e=>e.classList.contains('on')).length;
  ok('step 0 shows one bar', lit() === 1, lit());
  d.getElementById('sbNext').click();
  ok('step 1 shows two',    lit() === 2, lit());
  d.getElementById('sbNext').click();
  ok('step 2 shows three',  lit() === 3, lit());
  ok('the compute panel waits for its own step',
     !d.getElementById('scComp').classList.contains('on'));
  d.getElementById('sbNext').click();
  ok('and arrives on step 3', d.getElementById('scComp').classList.contains('on'));
  ok('the table row count tracks the bars',
     [...d.querySelectorAll('#scTab tr[data-i]')].filter(e=>e.classList.contains('on')).length === 3);

  console.log('--- layout: chart and commentary left, numbers right ---');
  const col = e => { let n=e; while(n && !(n.parentElement && n.parentElement.classList.contains('sc-wrap'))) n=n.parentElement; return n; };
  ok('the commentary shares a column with the chart',
     col(d.querySelector('#scPoints')) === col(d.querySelector('#scPlot')));
  ok('the numbers are in the other column',
     col(d.querySelector('#scTab')) !== col(d.querySelector('#scPlot')));
  ok('the chart stage is flex:none, as a fixed-size stage must be',
     /\.sc-plot\{[^}]*flex:none/.test(css));
  ok('only one commentary line is lit at a time',
     [...d.querySelectorAll('#scPoints .sc-point')].filter(e=>e.classList.contains('on')).length === 1);

  console.log('\nERRORS:', errs.length, '  FAILURES:', fails.length);
  errs.slice(0,4).forEach(e => console.log('  -', e));
  fails.forEach(f => console.log('  ✗', f));
  if(errs.length || fails.length) process.exitCode = 1;
}, 700);
