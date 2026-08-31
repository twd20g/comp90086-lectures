/* Deck-level checks for 11-features.

   Two things are specific to this lecture and worth asserting.

   First, the source deck opened with two slides lifted from the previous
   lecture — BagNet's informative patches, and the texturised-image result.
   Repeating them here would be a duplicate, so this deck recalls them in prose
   and ships neither figure. That is easy to undo by accident later, so it is a
   test rather than a comment.

   Second, the maths. The source slide closed the eigenvalue argument with
   "look for points where L1L2 is high, and L1 + L2 is low", which cannot be
   satisfied: a large product means both eigenvalues are large, so the sum is
   large too. What Harris actually does is subtract a penalty on the trace, so
   that an edge — big trace, small determinant — scores negative. The slides
   say that, and these checks pin the wording down.

   Run: node test/deck.checks.js                                               */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','standalone','11-features.html');
const html = fs.readFileSync(FILE, 'utf8');

const errs = [], fails = [];
const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    Object.defineProperty(w.HTMLImageElement.prototype, 'src', {set(){ const s = this;
      Object.defineProperty(s,'naturalWidth',{value:94,configurable:true});
      Object.defineProperty(s,'naturalHeight',{value:95,configurable:true});
      Object.defineProperty(s,'complete',{value:true,configurable:true});
      setTimeout(()=>s.onload && s.onload(), 0); }, get(){ return ''; }});
    w.addEventListener('error', e => errs.push(e.error && e.error.stack || e.message));
  }});
const ok = (l,c,x='') => { if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '), l, x); };

setTimeout(() => {
  const d = dom.window.document, S = [...d.querySelectorAll('.slide')];
  const text = s => s.textContent.replace(/\s+/g,' ').trim();
  const byTitle = t => S.find(s => s.dataset.title === t);

  console.log('--- shape of the deck ---');
  ok('every slide has a title for the index', S.every(s => s.dataset.title), S.length + ' slides');
  ok('three sections, one per outline item',
     d.querySelectorAll('.slide.section').length === 3,
     d.querySelectorAll('.slide.section').length);
  ok('one cover', d.querySelectorAll('.slide.cover').length === 1);
  ok('the presenter is filled in from deck.meta.json',
     d.getElementById('presenter').textContent.trim() === 'Tom Drummond',
     d.getElementById('presenter').textContent.trim());
  ok('and the deck it was derived from is credited on the cover',
     /Based on slides from Kris Ehinger/.test(d.querySelector('.slide.cover .ack').textContent));
  ok('no build placeholder survived', !/__[A-Z_]+__/.test(d.body.innerHTML));
  const feet = [...d.querySelectorAll('.footer span:first-child')].map(e => e.textContent);
  ok('the footer names this lecture', feet.length > 10 && feet.every(t => t === 'Week 6, Lecture 1'),
     [...new Set(feet)].join(' | '));

  console.log('--- the outline matches the sections that follow ---');
  const outline = [...byTitle('Outline').querySelectorAll('ul.b > li')]
                    .map(li => li.textContent.trim().toLowerCase());
  const sections = [...d.querySelectorAll('.slide.section h1')]
                    .map(h => h.innerHTML.replace(/<br\s*\/?>/g,' ')
                                .replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().toLowerCase());
  console.log('          outline :', outline.join(' · '));
  console.log('          sections:', sections.join(' · '));
  ok('same number of each', outline.length === sections.length, outline.length + ' vs ' + sections.length);
  ok('and they line up in order', sections.every((s,i) => s.startsWith(outline[i].split(' ')[0])),
     sections.filter((s,i)=> !s.startsWith(outline[i].split(' ')[0])).join(','));

  console.log('--- nothing is repeated from the representation-learning lecture ---');
  const recap = byTitle('Local evidence, recalled');
  ok('the recap slide exists', !!recap);
  ok('and it shows no figure — the point is to name the result, not re-show it',
     recap.querySelectorAll('.fig').length === 0, recap.querySelectorAll('.fig').length + ' figures');
  ok('it still names both findings it is standing in for',
     /BagNet/.test(text(recap)) && /90% . 79%/.test(text(recap)), text(recap).slice(0,60));
  // the two figures live in lectures/10-representations/assets.json; if either
  // key turns up here, the slide was pasted back in rather than recalled
  const ownAssets = Object.keys(JSON.parse(
    fs.readFileSync(path.join(__dirname,'..','assets.json'),'utf8')));
  ok('neither borrowed figure was copied into this deck\'s assets',
     !ownAssets.includes('bagnet') && !ownAssets.includes('texturised'),
     ownAssets.length + ' assets');

  console.log('--- the corner-response argument is stated correctly ---');
  const eig = text(byTitle('Reading the two eigenvalues'));
  ok('a corner is described as both eigenvalues large', /both/i.test(eig) && /large/i.test(eig));
  // the fault being guarded against: claiming a corner wants a small trace
  ok('and the slide never claims the sum is small for a corner',
     !/(sum|trace|.1 \+ .2)[^.]{0,40}(is |be )?(low|small)/i.test(eig), eig.slice(-150));
  const harris = text(byTitle('Harris corner response'));
  ok('an edge is described as scoring negative', /edge[^.]*negative/i.test(harris));
  ok('a corner is described as scoring positive', /corner[^.]*positive/i.test(harris));
  ok('and k is given its empirical range', /0\.04\s*.\s*0\.06/.test(harris), harris.slice(-80));

  console.log('--- the maths slides carry the equations they talk about ---');
  const tex = JSON.parse(fs.readFileSync(path.join(__dirname,'..','equations.tex.json'),'utf8'));
  ok('E(u,v) is a sum of squared differences under a window',
     /w\(x,y\)/.test(tex.energyDark) && /\^\{2\}/.test(tex.energyDark));
  ok('the Taylor slide shows the expansion and the result it leads to',
     /I_x/.test(tex.taylorDark) && /approx/.test(tex.taylorDark));
  ok('M is built from first derivatives only — no second derivative anywhere',
     /I_x\^\{2\}/.test(tex.structureDark) && !/I_\{xx\}|partial\^2/.test(tex.structureDark));
  ok('the Harris response is det minus k times trace squared',
     /\\det/.test(tex.harrisDark) && /operatorname\{tr\}/.test(tex.harrisDark)
       && /\{ds\}\{k\}/.test(tex.harrisDark));
  ok('every equation has a light-theme twin',
     Object.keys(tex).filter(k=>k.endsWith('Dark'))
       .every(k => tex[k.replace(/Dark$/,'Light')]),
     Object.keys(tex).length + ' entries');
  // a theme colour may also appear as a literal hex — \bbox takes CSS, not a
  // \definecolor name — so both forms are normalised before comparing
  const norm = (t, p) => t.replace(new RegExp('\\{'+p+'([xkqvyas])\\}','g'), '{$1}')
                          .replace(/#[0-9A-Fa-f]{6}/g, '#ROLE');
  const twinDiff = Object.keys(tex).filter(k=>k.endsWith('Dark'))
    .filter(k => norm(tex[k],'d') !== norm(tex[k.replace(/Dark$/,'Light')],'r'));
  ok('and the two differ only in the colour role', twinDiff.length === 0, twinDiff.join(' '));

  console.log('--- attribution: every borrowed figure says whose it is ---');
  const figSlides = S.filter(s => s.querySelector('.fig img'));
  const uncited = figSlides.filter(s => !s.querySelector('.cite')).map(s => s.dataset.title);
  ok('every figure slide carries a citation', uncited.length === 0,
     uncited.join(' | ') || figSlides.length + ' figure slides');
  ok('every figure has alt text',
     [...d.querySelectorAll('.fig img')].every(i => (i.getAttribute('alt')||'').length > 12),
     [...d.querySelectorAll('.fig img')].filter(i => (i.getAttribute('alt')||'').length <= 12).length + ' short');

  console.log('--- every name cited on a slide is in the reference list ---');
  const refSlide = byTitle('References'), refs = refSlide.textContent;
  const orphan = [...d.querySelectorAll('.cite')].filter(c => {
    const names = (c.textContent.match(/[A-Z][A-Za-zÀ-ÿ'’]{2,}/g) || []);
    return !names.some(n => refs.includes(n));
  }).map(c => c.textContent.trim());
  console.log('          ' + d.querySelectorAll('.cite').length + ' citations on slides');
  ok('every citation names somebody in the reference list', orphan.length === 0, orphan.join(' | '));

  const listed = [...refSlide.querySelectorAll('.note')].map(n => n.innerHTML).join('')
                   .split('<br>').map(l => l.trim()).filter(Boolean);
  console.log('         ', listed.length, 'entries listed');
  const key = l => {
    const surname = (l.match(/^([A-Z][A-Za-zÀ-ÿ'’]+)/) || ['',''])[1].toLowerCase();
    const year = (l.match(/\((\d{4})\)/) || ['','0'])[1];
    return surname + ' ' + year;
  };
  const keys = listed.map(key);
  ok('the list is ordered by author, then year, so an entry can be found while presenting',
     keys.every((k,i) => i === 0 || k >= keys[i-1]),
     keys.map((k,i) => i && k < keys[i-1] ? k : '').filter(Boolean).join(' | '));
  // the other direction. Unlike the previous lecture, some works here are named
  // in the body of a slide rather than in a .cite — the descriptor family is a
  // list, not a figure — so a reference counts as used if its surname appears
  // anywhere outside the reference slide itself.
  const spoken = S.filter(s => s !== refSlide).map(s => s.textContent).join(' | ');
  const unused = listed.filter(l => {
    const surname = (l.match(/^([A-Z][A-Za-zÀ-ÿ'’]+)/) || ['',''])[1];
    return surname && !spoken.includes(surname);
  }).map(l => l.slice(0, 26));
  ok('no reference is left behind by a cut slide', unused.length === 0,
     unused.join(' | ') || listed.length + ' entries, all mentioned');
  ok('every entry names a year', listed.every(l => /\(\d{4}\)/.test(l)),
     listed.filter(l => !/\(\d{4}\)/.test(l)).map(l=>l.slice(0,25)).join(' | '));

  console.log('\nERRORS: ' + errs.length + '   FAILURES: ' + fails.length);
  errs.forEach(e => console.log('  !', e));
  fails.forEach(f => console.log('  ✗', f));
  // close the window before exiting: jsdom keeps driving timers while it is
  // open, and a component with an animation loop would hold this process
  // open for ever — a hang rather than a failure
  dom.window.close();
  if (errs.length || fails.length) process.exit(1);
}, 300);

// unref'd, so a clean run exits long before it fires; if anything is still
// holding the loop open this fails in half a minute instead of at CI's
// six-hour ceiling, which reports nothing at all
setTimeout(() => {
  console.log('\n  FAIL  still running after every check finished — something is '
            + 'holding the event loop open');
  process.exit(1);
}, 30000).unref();
