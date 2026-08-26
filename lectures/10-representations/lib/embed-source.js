/* Embeddings for the contrastive-learning slide, computed from the four example
   images rather than drawn, so the matrix a student sees is a real one: an
   augmented view really is nearer its own source than anyone else's.

   The "encoder" is twelve simple statistics — mean R/G/B, contrast, gradient
   energy and greenness, over the whole image and over its centre — standardised
   across the eight vectors. It stands in for a learned encoder, and the slide
   says so. What it has to get right is only the ordering, and it does. */

const EX = [];                       // the four source images
let exReady = false;
const exWaiters = [];
for(let i = 0; i < 4; i++){
  const im = new Image();
  im.onload = () => {
    if(EX.every(e => e.complete && e.naturalWidth)){
      exReady = true; exWaiters.forEach(f => f());
    }
  };
  im.src = ASSETS['ex' + i];
  EX.push(im);
}
function onExamples(f){ exReady ? f() : exWaiters.push(f); }

/* A second view of the same image: a centre-weighted crop, mirrored. No colour
   jitter — the point is that the pair survives a geometric change, and jitter
   would only be moving the statistics this encoder is built from. */
function viewCanvas(i, px, augmented){
  const im = EX[i], c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  const s = Math.min(im.naturalWidth, im.naturalHeight);
  if(!augmented){
    g.drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, 0, 0, px, px);
    return c;
  }
  const k = s * 0.72, off = (s - k) / 2;
  g.save(); g.translate(px, 0); g.scale(-1, 1);            // mirrored
  g.drawImage(im, (im.naturalWidth - s) / 2 + off * 0.6,
                  (im.naturalHeight - s) / 2 + off * 1.2, k, k, 0, 0, px, px);
  g.restore();
  return c;
}

function statsOf(canvas){
  const px = canvas.width, g = canvas.getContext('2d');
  const band = (x, y, w, h) => {
    const d = g.getImageData(x, y, w, h).data, m = w * h;
    let r=0, gr=0, b=0, lum=0, lum2=0, grad=0, green=0;
    const L = new Float64Array(m);
    for(let i = 0; i < m; i++){
      const R = d[i*4], G = d[i*4+1], B = d[i*4+2];
      r += R; gr += G; b += B;
      const l = .299*R + .587*G + .114*B; L[i] = l; lum += l; lum2 += l*l;
      if(G > R + 6 && G > B + 6) green++;
    }
    for(let y2 = 1; y2 < h; y2++) for(let x2 = 1; x2 < w; x2++)
      grad += Math.abs(L[y2*w+x2] - L[y2*w+x2-1]) + Math.abs(L[y2*w+x2] - L[(y2-1)*w+x2]);
    const mu = lum / m;
    return [r/m/255, gr/m/255, b/m/255,
            Math.sqrt(Math.max(0, lum2/m - mu*mu)) / 128, grad/m/64, green/m];
  };
  const q = Math.round(px / 4);
  return band(0, 0, px, px).concat(band(q, q, px - 2*q, px - 2*q));   // whole, centre
}

/* Eight vectors — four images, each in two views — standardised per dimension so
   no single statistic dominates the cosine. */
function twoViewEmbeddings(px){
  const raw = [];
  for(let i = 0; i < 4; i++) raw.push(statsOf(viewCanvas(i, px, false)));
  for(let i = 0; i < 4; i++) raw.push(statsOf(viewCanvas(i, px, true)));
  const D = raw[0].length, n = raw.length;
  for(let k = 0; k < D; k++){
    let mu = 0; raw.forEach(v => mu += v[k]); mu /= n;
    let sd = 0; raw.forEach(v => sd += (v[k] - mu) ** 2); sd = Math.sqrt(sd / n) || 1;
    raw.forEach(v => v[k] = (v[k] - mu) / sd);
  }
  return { z: raw.slice(0, 4), zAug: raw.slice(4) };
}

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = a => Math.sqrt(dot(a, a)) || 1;
const cosine = (a, b) => dot(a, b) / (norm(a) * norm(b));

/* softmax of one row at temperature t — the denominator of the NT-Xent loss */
function softmaxRow(row, t){
  const mx = Math.max(...row);
  const ex = row.map(v => Math.exp((v - mx) / t));
  const Z = ex.reduce((a, b) => a + b, 0);
  return ex.map(v => v / Z);
}

/* Components mix cell colours against the page, which flips for the printable
   build; same contract as lecture 09's inkBase(). */
function inkBase(){
  const bg = getComputedStyle(document.body).backgroundColor;
  const m = bg.match(/\d+/g);
  return m ? [+m[0], +m[1], +m[2]] : [16, 20, 26];
}
