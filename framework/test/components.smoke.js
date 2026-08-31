/* Loads every generated component sandbox, walks its full step range forwards and
   backwards, exercises its controls, and fails on any runtime error.
   Run: node test/components.smoke.js        (needs: npm install jsdom)          */
const {JSDOM} = require('jsdom'), fs = require('fs'), path = require('path');
const DIST = path.join(__dirname,'..','..','dist','sandbox');

function ctx(){
  // whatever a component draws with has to exist here, or the smoke test fails
  // with a TypeError that looks like the component's fault and is not
  return {clearRect(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},putImageData(){},
    fillRect(){},strokeRect(){},closePath(){},fill(){},arc(){},rect(){},save(){},restore(){},
    translate(){},scale(){},rotate(){},fillText(){},measureText(){ return {width:0}; },
    set fillStyle(v){}, set font(v){}, set textAlign(v){}, set textBaseline(v){},
    set globalAlpha(v){}, set lineJoin(v){}, set lineCap(v){},
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
    // jsdom drives requestAnimationFrame for as long as a window is open, so a
    // component whose loop reschedules itself holds this process open for ever.
    // Nothing fails; the run simply never ends. It cost a six-hour CI timeout
    // before this line existed.
    dom.window.close();

    if(++done === files.length){
      console.log('\n'+files.length+' component(s), '+bad+' failing');
      if(bad) process.exitCode = 1;
    }
  }, 900);
});

// and if some future component finds another way to hold the loop open, fail in
// half a minute with a name for it rather than in six hours with a timeout.
// unref'd, so a clean run exits before it ever fires.
setTimeout(()=>{
  console.log('\n  FAIL  still running after every check finished — something is '
            + 'holding the event loop\n        open (an animation loop in a component?)');
  process.exit(1);
}, 30000).unref();
