/* Deck engine: navigation, fragments, the HOST step contract, the slide index,
   light theme and the printable layout. Lecture-independent — every deck in this
   repository is built against this one file. */
/* ================= deck engine ================= */
const stage = document.getElementById('stage');
const slides = [...stage.querySelectorAll('.slide')];
const N = slides.length;
let cur = 0;
const ctl = new Map();          // slide index -> {max, set, get}
// the contract components use to drive their own steps from the deck's arrow keys
const HOST = { registerSteps(root, api){ ctl.set(slides.indexOf(root), api); } };

function fit(){
  const s = Math.min(innerWidth/1280, innerHeight/720);
  stage.style.transform = `scale(${s})`;
}
addEventListener('resize', fit); fit();

slides.forEach((s,i)=>{
  if(s.classList.contains('cover')) return;
  const f = document.createElement('div');
  f.className='footer';
  f.innerHTML = `<span>${DECK.subtitle}</span><span class="mid">${DECK.course}</span><span class="no">${i+1}</span>`;
  s.appendChild(f);
});

function frags(i){ return [...slides[i].querySelectorAll('.frag')]; }
/* Fragments arrive in document order, which is almost always what a slide wants.
   `data-frag="N"` overrides it: N is the step the fragment belongs to, and two
   fragments carrying the same N arrive together. That is the only way a figure
   can appear alongside the bullet that discusses it when the layout has to put
   the figure further up the page — the SE(3) slide reveals its inverse with the
   bullet about inverses, and the two cannot be siblings.
   A slide that numbers nothing is unaffected: every fragment is its own step, in
   the order it is written. */
function steps(i){
  const keyed = frags(i).map((el, k) => ({ el, k,
    key: el.dataset.frag === undefined ? k : +el.dataset.frag }));
  keyed.sort((a, b) => a.key - b.key || a.k - b.k);
  const out = [];
  for(const it of keyed){
    const last = out[out.length-1];
    if(last && last.key === it.key) last.els.push(it.el);
    else out.push({ key: it.key, els: [it.el] });
  }
  return out;
}
function shown(i){
  const st = steps(i);
  let n = 0;
  for(const g of st){ if(g.els.every(e => e.classList.contains('on'))) n++; else break; }
  return n;
}

function show(i, atEnd){
  cur = Math.max(0, Math.min(N-1, i));
  slides.forEach((s,k)=>s.classList.toggle('active', k===cur));
  const fs = frags(cur);
  fs.forEach(f=>f.classList.toggle('on', !!atEnd));
  const init = slides[cur].dataset.init;
  if(init && !slides[cur].dataset.ready){ slides[cur].dataset.ready='1'; (INIT[init]||(()=>{}))(slides[cur]); }
  const c = ctl.get(cur);
  if(c) c.set(atEnd ? c.max : 0);
  document.getElementById('bar').style.width = ((cur)/(N-1)*100)+'%';
  [...document.querySelectorAll('#menuList li')].forEach((li,k)=>li.classList.toggle('cur',k===cur));
  try{history.replaceState(null,'','#'+(cur+1));}catch(e){}
}
function next(){
  const st = steps(cur), n = shown(cur);
  if(n < st.length){ st[n].els.forEach(e => e.classList.add('on')); return; }
  const c = ctl.get(cur);
  if(c && c.get() < c.max){ c.set(c.get()+1); return; }
  if(cur < N-1) show(cur+1,false);
}
function prev(){
  const c = ctl.get(cur);
  if(c && c.get() > 0){ c.set(c.get()-1); return; }
  const st = steps(cur), n = shown(cur);
  if(n > 0){ st[n-1].els.forEach(e => e.classList.remove('on')); return; }
  if(cur > 0) show(cur-1,true);
}
function revealAll(){
  frags(cur).forEach(f=>f.classList.add('on'));
  const c = ctl.get(cur); if(c) c.set(c.max);
}

const menu = document.getElementById('menu'), help = document.getElementById('help');
const ml = document.getElementById('menuList');
slides.forEach((s,i)=>{
  const li = document.createElement('li');
  const h = s.querySelector('h1');
  li.textContent = s.dataset.title || (h ? h.textContent.replace(/\s+/g,' ').trim() : 'Slide');
  li.onclick = ()=>{ menu.classList.remove('on'); show(i,false); };
  ml.appendChild(li);
});

function setLight(on){ document.body.classList.toggle('light', on); repaintAll(); }
// components colour their cells in JS, so a theme flip has to ask them to repaint
function repaintAll(){
  slides.forEach((s,i)=>{
    const c = ctl.get(i);
    if(c) c.set(c.get());
  });
}
// Reveal the whole deck at once: force every slide to initialise and run to its
// last step, then lay them all out down the page. Used for the printable PDF.
function printAll(light){
  const back = cur;
  // theme first: components mix their cell colours against the page background at
  // build time, so flipping afterwards would leave dark matrices on white paper
  document.body.classList.toggle('light', light !== false);
  for(let i=0;i<N;i++) show(i, true);
  show(back, true);
  repaintAll();
  document.body.classList.add('printall');
  slides.forEach(s=>s.classList.add('active'));
}
if(/(^|[?&#])print/.test(location.search + location.hash)) addEventListener('load', ()=>printAll(true));

addEventListener('keydown', e=>{
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  const k = e.key;
  if(k==='Escape'){ menu.classList.remove('on'); help.classList.remove('on'); return; }
  if(k==='?'){ help.classList.toggle('on'); menu.classList.remove('on'); return; }
  if(k==='o'||k==='O'){ menu.classList.toggle('on'); help.classList.remove('on'); return; }
  if(menu.classList.contains('on')||help.classList.contains('on')) return;
  if(k==='ArrowRight'||k===' '||k==='ArrowDown'||k==='PageDown'){ e.preventDefault(); next(); }
  else if(k==='ArrowLeft'||k==='ArrowUp'||k==='PageUp'){ e.preventDefault(); prev(); }
  else if(k==='Home'){ show(0,false); }
  else if(k==='End'){ show(N-1,true); }
  else if(k==='b'||k==='B'){ document.body.classList.toggle('blank'); }
  else if(k==='l'||k==='L'){ setLight(!document.body.classList.contains('light')); }
  else if(k==='p'||k==='P'){ printAll(true); setTimeout(()=>print(), 400); }
  else if(k==='a'||k==='A'){ revealAll(); }
  else if(k==='f'||k==='F'){ document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }
});
stage.addEventListener('click', e=>{
  if(slides[cur].dataset.init) return;
  if(e.target.closest('button,input,canvas,#menu,#help')) return;
  next();
});

const INIT = {};   // slide key -> init(root), filled in by the lecture

function bootDeck(){
  const start = Math.max(0, Math.min(N-1, (parseInt(location.hash.slice(1),10)||1)-1));
  show(start,false);
}
