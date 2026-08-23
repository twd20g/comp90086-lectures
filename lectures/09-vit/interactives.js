/* Slide interactives specific to this lecture, small enough not to warrant a
   component of their own. Anything reused, or worth a sandbox, is a component. */
/* ---- receptive field ---- */
INIT.rf = (root)=>{
  const G = 15, grid = root.querySelector('#rfg'), cap = root.querySelector('#rfcap');
  const cells = [];
  for(let i=0;i<G*G;i++){ const d=document.createElement('i'); grid.appendChild(d); cells.push(d); }
  const sl = root.querySelector('#rfl'), num = root.querySelector('#rfln');
  function draw(){
    const L = +sl.value, r = L, rf = 2*L+1, c = (G-1)/2;
    num.textContent = L;
    cells.forEach((d,i)=>{
      const x = i%G, y = (i/G)|0;
      const inside = Math.abs(x-c)<=r && Math.abs(y-c)<=r;
      d.className = (x===c&&y===c) ? 'ctr' : (inside ? 'in' : '');
    });
    const pct = Math.min(100, Math.round(rf*rf/(G*G)*100));
    cap.innerHTML = `${L} conv layer${L>1?'s':''} · receptive field <span class="val">${rf}×${rf}</span> px · ${pct}% of a ${G}×${G} image`;
  }
  sl.addEventListener('input', draw); draw();
};

/* ---- bag of words ---- */
INIT.bow = (root)=>{
  const A = "the cat sat on the mat".split(' ');
  const B = "the mat sat on the cat".split(' ');
  const ea = root.querySelector('#bowA'), eb = root.querySelector('#bowB');
  const hist = root.querySelector('#bowH'), note = root.querySelector('#bowNote');
  const vocab = ['the','cat','sat','on','mat'];
  const counts = {the:2,cat:1,sat:1,on:1,mat:1};
  function chips(el, words){
    el.innerHTML='';
    words.forEach(w=>{ const s=document.createElement('span'); s.className='chip'; s.textContent=w; el.appendChild(s); });
  }
  chips(ea,A); chips(eb,B);
  hist.innerHTML = vocab.map(w=>`<div class="col"><div class="barw"><div class="bar" data-w="${w}" style="height:0"></div></div><div class="lab">${w}</div></div>`).join('');
  const bars = [...hist.querySelectorAll('.bar')];
  let on = false;
  function render(){
    bars.forEach(b=>b.style.height = on ? (counts[b.dataset.w]/2*110)+'px' : '0px');
    [...root.querySelectorAll('.chip')].forEach(c=>c.classList.toggle('hi', on));
    note.innerHTML = on
      ? 'Two different sentences. <b>One identical histogram.</b> The bag keeps <i>what</i> is present and throws away <i>where</i> — which is exactly the trade a ViT makes if you drop positional encoding.'
      : 'Order is what separates these two sentences. Watch what survives the histogram.';
  }
  root.querySelector('#bowGo').onclick = ()=>{ on = true; render(); };
  root.querySelector('#bowReset').onclick = ()=>{ on = false; render(); };
  render();
  HOST.registerSteps(root, { max:1, get:()=>on?1:0, set:v=>{ on = v>=1; render(); } });
};

/* ---- patchify ---- */
INIT.patch = (root)=>{
  const cv = root.querySelector('#pcv'), ctx = cv.getContext('2d');
  const strip = root.querySelector('#pstrip');
  let g = 4;
  function draw(){
    onLlama(()=>{
      ctx.clearRect(0,0,cv.width,cv.height);
      ctx.imageSmoothingQuality='high';
      ctx.drawImage(llama,0,0,cv.width,cv.height);
      ctx.strokeStyle='rgba(70,214,192,.85)'; ctx.lineWidth = g>4?2:3;
      for(let i=1;i<g;i++){
        const p = i*cv.width/g;
        ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,cv.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,p); ctx.lineTo(cv.width,p); ctx.stroke();
      }
      const n = g*g, px = Math.min(40, Math.max(9, Math.floor((1040 - (n-1)*3)/n)));
      strip.innerHTML='';
      for(let i=0;i<n;i++){
        const t = document.createElement('div'); t.className='t';
        const c = patchCanvas(g,i,px*2); c.style.width=px+'px'; c.style.height=px+'px';
        t.appendChild(c); strip.appendChild(t);
      }
    });
  }
  root.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{
    root.querySelectorAll('[data-g]').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); g = +b.dataset.g; draw();
  });
  draw();
};


/* Components are spliced in by the shell; the lecture just names which slide
   key each one drives. See lectures/09-vit/components/. */
INIT.attn = initAttentionHead;
INIT.pos  = initPositionEncoding;
INIT.qkv  = initQkvFlow;
INIT.mha  = initMultiHead;
INIT.enc  = initEncoderBlock;
INIT.scale = initScaleCrossover;


/* ---- ViT config calculator ---- */
INIT.cfg = (root)=>{
  const Ps=[32,16,14,8,4], Ds=[384,768,1024,1280,1536], Hs=[6,12,16,24];
  const cP=root.querySelector('#cP'), cL=root.querySelector('#cL'), cD=root.querySelector('#cD'), cH=root.querySelector('#cH');
  const out = id=>root.querySelector('#'+id);
  const PRE = { B:{P:1,L:12,D:1,H:1}, L:{P:1,L:24,D:2,H:2}, H:{P:2,L:32,D:3,H:2} };
  function fmt(x){ return x>=1e9 ? (x/1e9).toFixed(1)+' G' : x>=1e6 ? (x/1e6).toFixed(1)+' M' : x>=1e3 ? (x/1e3).toFixed(1)+' K' : x.toFixed(0); }
  function render(){
    const P=Ps[+cP.value], L=+cL.value, D=Ds[+cD.value], h=Hs[+cH.value];
    root.querySelector('#cPv').textContent = P+' px';
    root.querySelector('#cLv').textContent = L;
    root.querySelector('#cDv').textContent = D;
    root.querySelector('#cHv').textContent = h;
    const g = Math.floor(224/P), Ntok = g*g+1;
    const par = L*12*D*D;
    const attn = L*2*Ntok*Ntok*D;         // QK^T and AV
    const proj = L*(4*Ntok*D*D + 8*Ntok*D*D); // qkv+out projections and MLP
    out('oN').textContent = `${Ntok} (${g}×${g}+1)`;
    out('oHD').textContent = (D/h).toFixed(D%h?1:0);
    out('oPar').textContent = fmt(par);
    out('oAtt').textContent = fmt(attn);
    out('oShare').textContent = (attn/(attn+proj)*100).toFixed(1)+'%';
    root.querySelector('#cnote').innerHTML =
      `At P = ${P} the pairwise term is <b>${(attn/(attn+proj)*100).toFixed(0)}%</b> of encoder compute. `+
      `The quadratic term only dominates once patches get small — which is why ViT-B/16 gets away with treating attention as cheap, and why dense-prediction models cannot.`;
  }
  [cP,cL,cD,cH].forEach(s=>s.addEventListener('input',()=>{
    root.querySelectorAll('[data-pre]').forEach(x=>x.classList.remove('on')); render();
  }));
  root.querySelectorAll('[data-pre]').forEach(b=>b.onclick=()=>{
    root.querySelectorAll('[data-pre]').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    apply(PRE[b.dataset.pre]);
  });
  function apply(p){ cP.value=p.P; cL.value=p.L; cD.value=p.D; cH.value=p.H; render(); }
  apply(PRE.B);   // start on the preset the UI shows as selected
};

/* ---- O(N^2) cost ---- */
INIT.cost = (root)=>{
  const box = root.querySelector('#costbars');
  const rows = [32,16,8,4].map(P=>{ const g=Math.floor(224/P); return {P,N:g*g}; });
  const base = rows.find(r=>r.P===16).N**2;
  box.innerHTML = rows.map(r=>{
    const rel = r.N*r.N/base;
    const w = Math.max(3, Math.min(1, Math.log10(1+rel*9)/Math.log10(1+ rows[rows.length-1].N**2/base*9))*430);
    return `<div class="r"><span class="lab">${r.P}×${r.P} px</span>`+
           `<span class="n">N = ${r.N}</span>`+
           `<span class="t" style="width:${w.toFixed(0)}px"></span>`+
           `<span class="x">${rel<1?rel.toFixed(2):rel.toFixed(0)}×</span></div>`;
  }).join('');
};
