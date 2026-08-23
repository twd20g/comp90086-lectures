const llama = new Image();
let llamaReady = false;
const llamaWaiters = [];
llama.onload = ()=>{ llamaReady = true; llamaWaiters.forEach(f=>f()); };
llama.src = ASSETS.llama;
function onLlama(f){ llamaReady ? f() : llamaWaiters.push(f); }

function patchCanvas(g, idx, px){
  const c = document.createElement('canvas');
  const src = llama.width / g;
  c.width = px; c.height = px;
  const x = (idx % g) * src, y = Math.floor(idx / g) * src;
  c.getContext('2d').drawImage(llama, x, y, src, src, 0, 0, px, px);
  return c;
}

/* Six simple statistics per patch — mean R, G, B, contrast, gradient energy,
   greenness — standardised across patches. Stands in for a learned patch
   embedding: real enough that similar patches really do end up nearby. */
function patchEmbeddings(g, D){
  const off = document.createElement('canvas'); off.width = off.height = llama.width;
  const c = off.getContext('2d'); c.drawImage(llama, 0, 0);
  const s = llama.width / g, n = g*g, F = [];
  for(let p=0;p<n;p++){
    const d = c.getImageData((p%g)*s, ((p/g)|0)*s, s, s).data;
    let r=0, gr=0, b=0, lum=0, lum2=0, grad=0, green=0;
    const m = s*s, L = new Float64Array(m);
    for(let i=0;i<m;i++){
      const R=d[i*4], Gc=d[i*4+1], B=d[i*4+2];
      r+=R; gr+=Gc; b+=B;
      const l = .299*R + .587*Gc + .114*B; L[i]=l; lum+=l; lum2+=l*l;
      if(Gc>R+6 && Gc>B+6) green++;
    }
    for(let y=1;y<s;y++) for(let x=1;x<s;x++)
      grad += Math.abs(L[y*s+x]-L[y*s+x-1]) + Math.abs(L[y*s+x]-L[(y-1)*s+x]);
    const mu = lum/m;
    F.push([r/m/255, gr/m/255, b/m/255, Math.sqrt(Math.max(0,lum2/m-mu*mu))/128, grad/m/64, green/m]
           .slice(0, D));
  }
  for(let k=0;k<D;k++){
    let mu=0; F.forEach(f=>mu+=f[k]); mu/=n;
    let sd=0; F.forEach(f=>sd+=(f[k]-mu)**2); sd = Math.sqrt(sd/n)||1;
    F.forEach(f=>f[k]=(f[k]-mu)/sd);
  }
  return F;
}

/* Deterministic D×D matrix — a stand-in for a learned projection. */
function randProj(D, seed){
  let s = seed>>>0;
  const rnd = ()=>{ s = (s*1664525+1013904223)>>>0; return (s/4294967296)*2-1; };
  return Array.from({length:D},()=>Array.from({length:D},rnd));
}
const matVec = (M,v)=>M.map(r=>r.reduce((a,x,i)=>a+x*v[i],0));
const vecDot = (a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);

/* Row-wise softmax with temperature. */
function softmaxRows(A, t){
  return A.map(row=>{
    const mx = Math.max(...row);
    const ex = row.map(v=>Math.exp((v-mx)/t));
    const Z = ex.reduce((a,b)=>a+b,0);
    return ex.map(v=>v/Z);
  });
}

/* The colour a matrix cell ramps away from: the page background. Components mix
   from this toward their accent, so in light mode a small weight is nearly white
   rather than nearly black — which is the whole point of the printable build. */
function inkBase(){
  return document.body.classList.contains('light') ? [255,255,255] : [14,20,24];
}
