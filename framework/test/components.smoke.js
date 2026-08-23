/* Loads every generated component sandbox, walks its full step range forwards and
   backwards, exercises its controls, and fails on any runtime error.
   Run: node test/components.smoke.js        (needs: npm install jsdom)          */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname,'..','..','dist','sandbox');

function ctx(){
  return {clearRect(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},putImageData(){},
    set imageSmoothingQuality(v){}, set imageSmoothingEnabled(v){}, set strokeStyle(v){}, set lineWidth(v){},
    getImageData(x,y,w,h){ const d=new Uint8ClampedArray(w*h*4);
      for(let i=0;i<w*h;i++){ d[i*4]=(x*3+i)%255; d[i*4+1]=(y+i*2)%255; d[i*4+2]=(i*7)%255; d[i*4+3]=255; }
      return {data:d,width:w,height:h}; },
    createImageData(w,h){ return {data:new Uint8ClampedArray(w*h*4),width:w,height:h}; }};
}

const files = fs.readdirSync(DIST).filter(f=>f.endsWith('.html')).sort();
let bad = 0, done = 0;

files.forEach(file=>{
  const errs = [];
  const dom = new JSDOM(fs.readFileSync(path.join(DIST,file),'utf8'), {
    runScripts:'dangerously', pretendToBeVisual:true,
    beforeParse(w){
      w.HTMLCanvasElement.prototype.getContext = ()=>ctx();
      Object.defineProperty(w.HTMLImageElement.prototype,'src',{
        set(){ const s=this;
          Object.defineProperty(s,'width',{value:356,configurable:true});
          Object.defineProperty(s,'height',{value:356,configurable:true});
          setTimeout(()=>s.onload&&s.onload(),0); },
        get(){ return ''; }});
      w.addEventListener('error', e=>errs.push(e.error&&e.error.stack||e.message));
      w.onerror = m=>errs.push('onerror: '+m);
    }
  });
  const w = dom.window, d = w.document;
  setTimeout(()=>{
    const steps = d.getElementById('sbStep').textContent;
    const max = parseInt(steps.split('/')[1],10) || 0;
    for(let i=0;i<max+3;i++) d.getElementById('sbNext').click();     // walk to the end
    const atEnd = d.getElementById('sbStep').textContent;
    for(let i=0;i<max+3;i++) d.getElementById('sbPrev').click();     // and back
    const atStart = d.getElementById('sbStep').textContent;
    [...d.querySelectorAll('#root button.btn')].forEach(b=>{ try{ b.click(); }catch(e){ errs.push(e.message); } });
    [...d.querySelectorAll('#root input[type=range]')].forEach(r=>{
      [r.min, r.max].forEach(v=>{ r.value=v; r.dispatchEvent(new w.Event('input',{bubbles:true})); }); });
    [...d.querySelectorAll('#root .steps .s')].forEach(s=>{ try{ s.click(); }catch(e){ errs.push(e.message); } });

    const nodes = d.querySelectorAll('#root *').length;
    const okRange = /\/ *[1-9]/.test(steps) && atEnd.startsWith('step '+max) && atStart.startsWith('step 0');
    if(errs.length || !okRange || nodes < 10){ bad++; }
    console.log(
      (errs.length||!okRange ? '  FAIL ' : '  ok   ') +
      file.replace('.html','').padEnd(16) +
      ' steps 0..'+max+'  nodes '+nodes + (errs.length ? '  '+errs[0].split('\n')[0] : ''));
    if(++done === files.length){
      console.log('\n'+files.length+' component(s), '+bad+' failing');
      if(bad) process.exitCode = 1;
    }
  }, 900);
});
