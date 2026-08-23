const {JSDOM}=require('jsdom'), fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','..','..','dist','standalone','09-vit.html'),'utf8');
function fakeCtx(){return{clearRect(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},putImageData(){},
 set imageSmoothingQuality(v){},set imageSmoothingEnabled(v){},set strokeStyle(v){},set lineWidth(v){},
 getImageData(x,y,w,h){const d=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++){d[i*4]=(x+i)%255;d[i*4+1]=(y*2+i)%255;d[i*4+2]=(i*3)%255;d[i*4+3]=255;}return{data:d,width:w,height:h};},
 createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4),width:w,height:h};}};}
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
 w.HTMLCanvasElement.prototype.getContext=()=>fakeCtx();
 Object.defineProperty(w.HTMLImageElement.prototype,'src',{set(v){const s=this;
  Object.defineProperty(s,'width',{value:356,configurable:true});Object.defineProperty(s,'height',{value:356,configurable:true});
  setTimeout(()=>s.onload&&s.onload(),0);},get(){return '';}});
}});
const w=dom.window;
setTimeout(()=>{
 const d=w.document, S=[...d.querySelectorAll('.slide')];
 // Jump straight to a slide through the index menu, then press A to reveal every
 // fragment and drive any component to its last step. Stepping there with ArrowRight
 // overshot, and only went unnoticed because the checks used global id selectors.
 const go=i=>{ const li=[...d.querySelectorAll('#menuList li')][i];
               if(!li) throw new Error('no such slide: index '+i+' — check the data-title (it is decoded, so use " not &quot;)');
               li.click();
               w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'a'})); };
 const idx=t=>S.findIndex(s=>s.dataset.title===t);
 go(idx('ViT — user-defined parameters'));
 console.log('--- config calc (ViT-B/16 default) ---');
 ['oN','oHD','oPar','oAtt','oShare'].forEach(k=>console.log(' ',k,'=',d.getElementById(k).textContent));
 // ViT-H preset
 [...d.querySelectorAll('[data-pre]')].find(b=>b.dataset.pre==='H').click();
 console.log('--- ViT-H/14 ---');
 ['oN','oHD','oPar','oAtt','oShare'].forEach(k=>console.log(' ',k,'=',d.getElementById(k).textContent));
 console.log('--- cost bars ---');
 go(idx('Patches as "words"'));
 [...d.querySelectorAll('#costbars .r')].forEach(r=>console.log(' ',r.textContent.replace(/\s+/g,' ').trim()));
 console.log('--- patchify ---');
 go(idx('Vision Transformers'));
 const strip = ()=>d.querySelectorAll('#pstrip .t').length;
 console.log(' 4×4 grid  : strip tiles',strip(),
             '| readout removed:', !d.querySelector('#pread'),
             '| bullets:', d.querySelectorAll('#pstrip ~ ul.b li').length);
 [...d.querySelectorAll('[data-g]')].find(b=>b.dataset.g==='8').click();
 console.log(' 8×8 grid  : strip tiles',strip());
 [...d.querySelectorAll('[data-g]')].find(b=>b.dataset.g==='2').click();
 console.log(' 2×2 grid  : strip tiles',strip());
 console.log('--- weaknesses slide ---');
 go(idx('Weaknesses of bag of features matching'));
 console.log(' bullets   :',d.querySelectorAll('.slide.active ul.b > li').length,
             '| sub-bullets:',d.querySelectorAll('.slide.active ul.b ul li').length,
             '| closing line:',JSON.stringify(
               [...d.querySelectorAll('.slide.active .body > .frag')].map(e=>e.textContent.trim()).join('')));
 go(idx('Bag of features matching'));
 console.log(' preceding claim:', d.querySelector('.slide.active .claim').textContent.trim());
 console.log('--- slide 10 figure ---');
 go(idx('Bag of features (vision)'));
 const bof = d.querySelector('.slide.active .fig img');
 console.log(' mount:', d.querySelector('.slide.active .fig').className,
   '| format:', bof.getAttribute('src').slice(5,14),
   '| alt:', bof.getAttribute('alt').slice(0,28)+'…');
 console.log('--- the equation carries the diagram colours ---');
 go(idx('Attention head — the equation'));
 console.log(' coloured symbols:',[...d.querySelectorAll('.slide.active .eq [class^=role-]')]
   .map(e=>e.className+'='+e.textContent.trim()).join(' '));
 go(idx('Attention head parameters'));
 console.log(' parameter symbols:',[...d.querySelectorAll('.slide.active .eq [class^=role-]')]
   .map(e=>e.className+'='+e.textContent.trim()).join(' '));
 console.log('--- attention pipeline (final step) ---');
 go(idx('Attention head — walk-through'));
 console.log(' step chips lit:',d.querySelectorAll('#ahSteps .s.on').length,'of',d.querySelectorAll('#ahSteps .s').length);
 console.log(' matrix cells  :',d.querySelectorAll('.ah-c').length,'| visible:',[...d.querySelectorAll('.ah-c')].filter(c=>c.style.opacity==='1').length);
 console.log(' patch tiles   :',d.querySelectorAll('.ah-p').length);
 console.log(' Y cells      :',d.querySelectorAll('.ah-c').length-896,
   '| outlines:',d.querySelectorAll('.ah-box.on').length,
   '| symbols:',[...d.querySelectorAll('.ah-sym.on')].map(e=>e.textContent).join(' '));
 console.log('--- passing information: keys, queries and values ---');
 go(idx('Passing information: keys, queries and values'));
 // the embedding row carries no role class, so count it as "everything minus the rest"
 const roleCounts = ['k','q','v','y'].map(k=>d.querySelectorAll('#qfStage .qf-b.'+k).length);
 const allBoxes = d.querySelectorAll('#qfStage .qf-b').length;
 console.log(' boxes/row :',[allBoxes-roleCounts.reduce((a,b)=>a+b,0), ...roleCounts].join('/'),
   '| patches:',d.querySelectorAll('#qfStage .qf-p').length);
 console.log(' query     :',d.getElementById('qfSel').textContent,
   '| bold arcs:',[...d.querySelectorAll('#qfStage path')].filter(p=>+p.getAttribute('stroke-width')>2).length,
   '| legend entries:',d.querySelectorAll('#qfStage .qf-leg.on').length);
 console.log('--- multi-head ---');
 go(idx('Multi-head attention'));
 console.log(' head grids   :',d.querySelectorAll('#mhHeads .mh-grid').length,
             '| config:',d.getElementById('mhCfg').textContent.replace(/\s+/g,' ').slice(0,72)+'…');
 console.log('--- encoder block ---');
 go(idx('The transformer encoder block'));
 console.log(' nodes shown  :',d.querySelectorAll('#ebStage .eb-n.on').length,'of',d.querySelectorAll('#ebStage .eb-n').length);
 console.log('--- receptive field ---');
 go(idx('Inductive biases of CNNs'));
 const sl=d.getElementById('rfl'); sl.value=5; sl.dispatchEvent(new w.Event('input'));
 console.log(' ',d.getElementById('rfcap').textContent.replace(/\s+/g,' '));
 console.log('--- bag of words ---');
 go(idx('Bag of words (NLP)'));
 console.log(' bars:',[...d.querySelectorAll('#bowH .bar')].map(b=>b.style.height).join(' '));
},700);
