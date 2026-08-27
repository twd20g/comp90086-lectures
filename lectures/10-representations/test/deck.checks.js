/* Deck-level checks for 10-representations.

   The lecture is figure-heavy — most slides are somebody else's picture — so
   what matters most here is attribution: every figure carries a citation, and
   every name cited on a slide has an entry on the references slide. That audit
   is easy to do once by hand and easy to forget after an edit.

   Run: node test/deck.checks.js                                               */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const FILE = path.join(__dirname,'..','..','..','dist','standalone','10-representations.html');
const html = fs.readFileSync(FILE, 'utf8');

function fakeCtx(){
  return {clearRect(){}, drawImage(){}, save(){}, restore(){}, translate(){}, scale(){},
    getImageData(x,y,w,h){ const d = new Uint8ClampedArray(w*h*4);
      for(let i=0;i<w*h;i++){ d[i*4]=(x+i)%255; d[i*4+1]=(y+i*2)%255; d[i*4+2]=(i*5)%255; d[i*4+3]=255; }
      return {data:d,width:w,height:h}; },
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4),width:w,height:h}; }};
}
const errs = [], fails = [];
const dom = new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext = () => fakeCtx();
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

  console.log('--- shape of the deck ---');
  ok('every slide has a title for the index', S.every(s => s.dataset.title), S.length + ' slides');
  ok('the visualisation section offers three methods, and says three',
     /Three ways of inspecting networks/.test(
       S.find(s => s.dataset.title === 'Visualisation — summary').textContent),
     S.find(s => s.dataset.title === 'Visualisation — summary').querySelector('h2').textContent);
  ok('four sections, one per outline item',
     d.querySelectorAll('.slide.section').length === 4,
     d.querySelectorAll('.slide.section').length);
  ok('one cover', d.querySelectorAll('.slide.cover').length === 1);
  ok('the presenter is filled in from deck.meta.json',
     d.getElementById('presenter').textContent.trim() === 'Tom Drummond',
     d.getElementById('presenter').textContent.trim());
  ok('and the deck it was derived from is credited on the cover',
     /Based on slides from Kris Ehinger/.test(
       d.querySelector('.slide.cover .ack').textContent));
  ok('no build placeholder survived', !/__[A-Z_]+__/.test(d.body.innerHTML));
  // the footer was hardcoded in engine.js, so every deck said Week 5 Lecture 1
  const feet = [...d.querySelectorAll('.footer span:first-child')].map(e => e.textContent);
  ok('the footer names this lecture, not the framework author\'s',
     feet.length > 10 && feet.every(t => t === 'Week 5, Lecture 2'),
     [...new Set(feet)].join(' | '));

  console.log('--- the outline matches the sections that follow ---');
  const outline = [...S.find(s => s.dataset.title === 'Outline').querySelectorAll('ul.b > li')]
                    .map(li => li.textContent.trim().toLowerCase());
  // a title broken with <br> has no whitespace in textContent — "Invariance
  // and<br>generalisation" came out as one word and failed a good check
  const sections = [...d.querySelectorAll('.slide.section h1')]
                    .map(h => h.innerHTML.replace(/<br\s*\/?>/g,' ')
                                .replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().toLowerCase());
  console.log('          outline :', outline.join(' · '));
  console.log('          sections:', sections.join(' · '));
  ok('same number of each', outline.length === sections.length,
     outline.length + ' vs ' + sections.length);
  ok('and they line up in order',
     sections.every((s,i) => s.startsWith(outline[i].split(' ')[0])),
     sections.map((s,i)=> s.split(' ')[0]===outline[i].split(' ')[0] ? '' : s).filter(Boolean).join(','));

  console.log('--- attribution: every borrowed figure says whose it is ---');
  const figSlides = S.filter(s => s.querySelector('.fig img'));
  const uncited = figSlides.filter(s => !s.querySelector('.cite'))
                           .map(s => s.dataset.title);
  ok('every figure slide carries a citation', uncited.length === 0,
     uncited.join(' | ') || figSlides.length + ' figure slides');
  ok('every figure has alt text',
     [...d.querySelectorAll('.fig img')].every(i => (i.getAttribute('alt')||'').length > 12),
     [...d.querySelectorAll('.fig img')].filter(i => (i.getAttribute('alt')||'').length <= 12).length + ' short');

  console.log('--- every name cited on a slide is in the reference list ---');
  const refSlide = S.find(s => s.dataset.title === 'References');
  const refs = refSlide.textContent;
  // Pulling "the" surname out of a citation is guesswork — "NT-Xent, as in Chen
  // et al. (2020)" made NT-Xent look like an author. What actually matters is
  // weaker and checkable: every citation names somebody the references list.
  const orphan = [...d.querySelectorAll('.cite')].filter(c => {
    const names = (c.textContent.match(/[A-Z][A-Za-zÀ-ÿ'’]{2,}/g) || []);
    return !names.some(n => refs.includes(n));
  }).map(c => c.textContent.trim());
  console.log('          ' + d.querySelectorAll('.cite').length + ' citations on slides');
  ok('every citation names somebody in the reference list',
     orphan.length === 0, orphan.join(' | '));

  const listed = [...refSlide.querySelectorAll('.note')].map(n => n.innerHTML).join('')
                   .split('<br>').map(l => l.trim()).filter(Boolean);
  console.log('         ', listed.length, 'entries listed');
  // by first author then year, which is the convention — not by the whole
  // string, which would put Geirhos 2019 before Geirhos 2018
  const key = l => {
    const surname = (l.match(/^([A-Z][A-Za-zÀ-ÿ'’]+)/) || ['',''])[1].toLowerCase();
    const year = (l.match(/\((\d{4})\)/) || ['','0'])[1];
    return surname + ' ' + year;
  };
  const keys = listed.map(key);
  ok('the list is ordered by author, then year, so an entry can be found while presenting',
     keys.every((k,i) => i === 0 || k >= keys[i-1]),
     keys.map((k,i) => i && k < keys[i-1] ? k : '').filter(Boolean).join(' | '));
  // and the other direction: cutting a slide can leave its reference behind,
  // which the check above cannot see. Dropping the class-visualisation thread
  // orphaned three entries at once.
  const cites = [...d.querySelectorAll('.cite')].map(c => c.textContent).join(' | ');
  const unused = listed.filter(l => {
    const surname = (l.match(/^([A-Z][A-Za-zÀ-ÿ'’]+)/) || ['',''])[1];
    return surname && !cites.includes(surname);
  }).map(l => l.slice(0, 26));
  ok('no reference is left behind by a cut slide', unused.length === 0,
     unused.join(' | ') || listed.length + ' entries, all cited');
  ok('every entry names a year', listed.every(l => /\(\d{4}\)/.test(l)),
     listed.filter(l => !/\(\d{4}\)/.test(l)).map(l=>l.slice(0,25)).join(' | '));

  console.log('--- the loss slide shows both forms, in order ---');
  const loss = S.find(s => s.dataset.title === 'Contrastive loss');
  const eqs = [...loss.querySelectorAll('.eq')];
  ok('two equations on the slide', eqs.length === 2, eqs.length);
  ok('the N-way form is there from the start', !eqs[0].classList.contains('frag'));
  ok('SimCLR\'s 2N form is built after the explanation', eqs[1].classList.contains('frag'));
  // The equations are SVG with the glyphs as outlines, so there are no letters
  // to grep for in the rendered deck. Identify each by the SVG it was built from,
  // and check the limits in the TeX those SVGs came from.
  const eqDir = path.join(__dirname, '..');
  const svg = JSON.parse(fs.readFileSync(path.join(eqDir, 'equations.json'), 'utf8'));
  const tex = JSON.parse(fs.readFileSync(path.join(eqDir, 'equations.tex.json'), 'utf8'));
  // jsdom re-serialises attributes, so the stored string will not match byte for
  // byte. viewBox plus glyph count identifies an equation well enough, and both
  // survive parsing untouched.
  const shape = html => [ (html.match(/viewBox="([^"]+)"/) || [,''])[1],
                          (html.match(/<path/g) || []).length ].join(' · ');
  const isEq = (el, key) => shape(el.querySelector('.only-dark').innerHTML) === shape(svg[key]);
  ok('the first equation is the pair form the interactive computes', isEq(eqs[0], 'pairDark'),
     shape(eqs[0].querySelector('.only-dark').innerHTML));
  ok('and the second is SimCLR eq. 1', isEq(eqs[1], 'ntxentDark'),
     shape(eqs[1].querySelector('.only-dark').innerHTML));
  ok('and they are not the same equation twice',
     shape(svg.pairDark) !== shape(svg.ntxentDark));
  ok('the pair form sums to N, over the second views',
     /\\sum_\{j=1\}\^\{N\}/.test(tex.pairDark) && !/2N/.test(tex.pairDark));
  ok('SimCLR eq. 1 sums to 2N, over all views',
     /\\sum_\{k=1\}\^\{2N\}/.test(tex.ntxentDark));
  ok('and only the pair form primes the second view, matching z′ on the slide before',
     /z\}'/.test(tex.pairDark) && !/z\}'/.test(tex.ntxentDark));
  ok('the slide says N counts images and 2N counts views',
     /N<\/em> counts <b>images<\/b>/.test(loss.innerHTML) &&
     /2N views/.test(loss.textContent) && /runs over <b>views<\/b>/.test(loss.innerHTML));
  ok('and does the arithmetic: 2N − 1 candidates',
     /2N − 1/.test(loss.textContent) && /2\(N − 1\)/.test(loss.textContent));
  ok('SimCLR is named, with the equation number',
     /Chen et al\. \(2020\) eq\. 1/.test(loss.querySelector('.cite').textContent));

  console.log('--- the occlusion maps are labelled, and the rows line up ---');
  const maps = S.find(s => s.dataset.title === 'Occlusion maps');
  const labs = [...maps.querySelectorAll('.fig.plain > div')].map(e => e.textContent.trim());
  ok('one class label per row', labs.length === 2, labs.join(' | '));
  ok('and they name the two classes', labs.join('|') === 'African elephant|Go-kart', labs.join('|'));
  ok('the labels are 21px, not a caption', labs.length &&
     /font-size:21px/.test(maps.querySelector('.fig.plain > div').getAttribute('style')));
  // the two rows differ in natural width, so each would centre on its own and the
  // labels would sit 3px apart; a fixed row width makes them start together
  const rowW = [...maps.querySelectorAll('.fig.plain')].map(e =>
    (e.getAttribute('style').match(/width:(\d+)px/) || [,''])[1]);
  ok('both rows are pinned to one width so the labels align',
     rowW.length === 2 && rowW[0] === rowW[1] && rowW[0], rowW.join(' / '));

  // the previous slide is a table of deltas, so the maps have to say what they
  // are: the score at each occluder position, not the drop
  const head = [...maps.querySelectorAll('.figrow > div')][0];
  ok('the map column is headed', /Confidence scores/.test(head.textContent), head.textContent.trim());
  // it is a label of the same kind as the class labels, so it is set the same way
  const labelStyle = maps.querySelector('.fig.plain > div').getAttribute('style');
  const headStyle  = head.lastElementChild.getAttribute('style');
  ok('the heading is set like the class labels beside it',
     /font-size:21px/.test(headStyle) && /color:var\(--ink\)/.test(headStyle) &&
     /font-size:21px/.test(labelStyle) && /color:var\(--ink\)/.test(labelStyle),
     headStyle);
  ok('the claim reads the map as a level, not a difference',
     /lowest/.test(maps.textContent) && !/fell furthest/.test(maps.textContent));

  console.log('--- the decomposition slide leads with the residual identity ---');
  const cd = S.find(s => s.dataset.title === 'Decomposing the class token');
  ok('the slide exists and drives the component', !!cd && cd.dataset.init === 'cd');
  ok('an equation sits above the diagram',
     !!cd.querySelector('.eq') &&
     cd.querySelector('.eq').compareDocumentPosition(cd.querySelector('#cdStage')) &
       dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
  const texAll = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'equations.tex.json'), 'utf8'));
  ok('it sums over all three indices — l, h and i',
     /\\sum_\{l=1\}\^\{L\}/.test(texAll.clsResidualDark) &&
     /\\sum_\{h=1\}\^\{H\}/.test(texAll.clsResidualDark) &&
     /\\sum_\{i=0\}\^\{N\}/.test(texAll.clsResidualDark));
  ok('the summand is y, the symbol the boxes carry', /y\}_\{i,h,l\}/.test(texAll.clsResidualDark));
  ok('and the MLP term is there rather than quietly dropped',
     /\\mathrm\{MLP\}/.test(texAll.clsResidualDark));
  ok('the definition of y rides on the same line, after a "where"',
     /\\text\{where\}/.test(texAll.clsResidualDark) &&
     cd.querySelectorAll('.eq').length === 1,
     cd.querySelectorAll('.eq').length + ' equation block');
  ok('it is slide 17\'s attention equation, with the class token as the query',
     /\\operatorname\{softmax\}/.test(texAll.clsResidualDark) &&
     /Q\}\^\{\\mathrm\{CLS\}\}/.test(texAll.clsResidualDark) &&
     /\\sqrt\{D\}/.test(texAll.clsResidualDark));
  ok('and it keeps V — the contribution is not the weight alone',
     /\\mathbf\{V\}_\{i,h,l\}/.test(texAll.clsResidualDark));
  // what reaches the residual stream is the head's output reprojected; the paper
  // folds this into W_VO, and lecture 09's slide 17 stops before it
  ok('and W_O — what reaches the stream is the reprojected output',
     /\\mathbf\{W\}\^\{h,l\}_\{O\}/.test(texAll.clsResidualDark));
  ok('the colour code follows lecture 09: softmax amber, Q green, K red, V blue',
     /textcolor\{ds\}\{\\operatorname\{softmax/.test(texAll.clsResidualDark) &&
     /textcolor\{dq\}\{\\mathbf\{Q/.test(texAll.clsResidualDark) &&
     /textcolor\{dk\}\{\\mathbf\{K/.test(texAll.clsResidualDark) &&
     /textcolor\{dv\}\{\\mathbf\{V/.test(texAll.clsResidualDark));

  console.log('--- the interactive is wired up ---');
  const cm = S.find(s => s.dataset.init === 'cm');
  ok('one slide drives the contrastive matrix', !!cm, cm && cm.dataset.title);
  ok('and it holds the component markup', !!cm.querySelector('#cmStage'));
  // It once held the markup and drew nothing: the deck build did not recognise
  // ASSETS['ex' + i], so the four images never arrived and build() never ran.
  // The sandbox was fine, which is exactly why this belongs at deck level.
  // a component initialises when its slide is entered, so go there through the
  // index menu (the same route lecture 09's suite uses), then reveal everything
  const li = [...d.querySelectorAll('#menuList li')][S.indexOf(cm)];
  ok('the slide is reachable from the index', !!li);
  li.click();
  dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key:'a'}));
  const cells = [...cm.querySelectorAll('.cm-cell')];
  ok('and the matrix actually draws in the deck, not just in the sandbox',
     cells.length === 16 && cells.every(c => c.textContent.trim()),
     cells.length + ' cells, ' + cells.filter(c => c.textContent.trim()).length + ' filled');

  console.log('\nERRORS:', errs.length, '  FAILURES:', fails.length);
  errs.slice(0,4).forEach(e => console.log('  -', e));
  fails.forEach(f => console.log('  ✗', f));
  if(errs.length || fails.length) process.exitCode = 1;
}, 900);
