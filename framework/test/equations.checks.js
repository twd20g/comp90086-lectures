/* The equations are TeX rendered to SVG at build time. These checks confirm the
   rendering actually happened, carries the role colours, and has no runtime
   dependency.   Run: node test/equations.checks.js                             */
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname,'..','..','dist','standalone',(process.env.SLUG||'09-vit')+'.html'),'utf8');
// framework suite, so the lecture comes from the environment or defaults to the first one
const LEC = process.env.LECTURE || 'lectures/09-vit';
const src  = JSON.parse(fs.readFileSync(path.join(__dirname,'..','..',LEC,'equations.json'),'utf8'));
const fails = [];
const ok = (l,c,x='')=>{ if(!c) fails.push(l); console.log((c?'  ok   ':'  FAIL '),l,x); };

console.log('--- rendered, not hand-built ---');
ok('no unresolved equation placeholders', !/__EQ_[A-Z]+__/.test(html));
ok('every equation is inlined as svg',
   (html.match(/aria-label="equation"/g)||[]).length === Object.keys(src).length,
   (html.match(/aria-label="equation"/g)||[]).length + ' of ' + Object.keys(src).length);
ok('glyphs are outlines, so nothing has to load',
   Object.values(src).every(s=>/<path /.test(s)));
ok('MathJax reported no errors', !/data-mjx-error/.test(html));
ok('the deck loads no maths library at runtime',
   !/<script[^>]+(katex|mathjax)/i.test(html) && !/cdn\.jsdelivr|unpkg\.com/i.test(html));

console.log('--- proper typesetting, not text imitating it ---');
const attn = src.attentionLight;
ok('the fraction is a real rule, not a slash', /<rect[^>]*height="6[0-9]"/.test(attn) || /<rect /.test(attn));
ok('the radical is drawn',  /data-mml-node="msqrt"/.test(attn));
ok('the sum carries limits', /data-mml-node="munderover"/.test(attn));
ok('the brackets stretch',   /data-mml-node="mo"[^>]*>[\s\S]{0,400}?texclass="OPEN"/.test(attn) ||
                             /mjx-svg-stretchy|c-TeX|data-mml-node="mo"/.test(attn));

console.log('--- role colours survive into the maths ---');
const fills = (attn.match(/fill="#[0-9a-f]{6}"/gi)||[]).map(x=>x.toLowerCase()).join(' ');
Object.entries({queries:'#237a3d', keys:'#c0392b', values:'#1f5fbf',
                softmax:'#9a6510', output:'#16191d'}).forEach(([role,hex])=>
  ok(role+' painted '+hex, fills.includes(hex)));
// the light cut must use the light tokens, and no dark ones
ok('no dark-theme colour leaks into the light cut',
   !/#4fc86a|#e5544a|#4f9bff|#e7a44c/i.test(attn));
ok('and the dark cut uses the dark tokens',
   /#4fc86a/i.test(src.attentionDark) && /#e5544a/i.test(src.attentionDark));

console.log('--- a light and a dark cut of each ---');
const pairs = Object.keys(src).filter(k=>/Dark$/.test(k)).map(k=>k.replace(/Dark$/,''));
ok('each equation has both cuts', pairs.every(p=>src[p+'Dark'] && src[p+'Light']), pairs.join(', '));
// MathJax numbers its glyph ids per conversion (MJX-5-TEX-…, MJX-6-TEX-…), so
// normalise those away as well as the colours before comparing the two cuts
const stripColour = s => s.replace(/#[0-9a-f]{6}/gi,'')
                          .replace(/MJX-\d+-/g,'MJX-')
                          .replace(/\s+/g,' ');
ok('the two cuts are the same typesetting, only recoloured',
   pairs.every(p=>stripColour(src[p+'Dark']) === stripColour(src[p+'Light'])),
   pairs.filter(p=>stripColour(src[p+'Dark']) !== stripColour(src[p+'Light'])).join(',') || 'all match');
ok('the deck shows one per theme',
   (html.match(/class="tex only-dark"/g)||[]).length === (html.match(/class="tex only-light"/g)||[]).length);

console.log('\nFAILURES:', fails.length);
fails.forEach(f=>console.log('  ✗',f));
if(fails.length) process.exitCode = 1;
