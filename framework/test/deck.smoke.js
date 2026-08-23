const {JSDOM} = require('jsdom');
const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','..','dist','standalone','09-vit.html'),'utf8');

// fake 2D context
function fakeCtx(w,h){
  return {
    canvas:{width:w,height:h},
    clearRect(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},
    putImageData(){}, save(){},restore(){},fillRect(){},
    set imageSmoothingQuality(v){}, set imageSmoothingEnabled(v){}, set strokeStyle(v){}, set lineWidth(v){},
    getImageData(x,y,ww,hh){ return {data:new Uint8ClampedArray(ww*hh*4).fill(120), width:ww, height:hh}; },
    createImageData(ww,hh){ return {data:new Uint8ClampedArray(ww*hh*4), width:ww, height:hh}; },
  };
}
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',resources:undefined,pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=function(){ return fakeCtx(this.width||300,this.height||150); };
    Object.defineProperty(w.HTMLImageElement.prototype,'src',{set(v){ this._src=v; const self=this;
      Object.defineProperty(self,'width',{value:356,configurable:true});
      Object.defineProperty(self,'height',{value:356,configurable:true});
      setTimeout(()=>{ if(self.onload) self.onload(); },0);
    }, get(){return this._src;}});
    w.onerror=(m)=>errors.push('window.onerror: '+m);
    w.addEventListener('error',e=>errors.push('err: '+(e.error&&e.error.stack||e.message)));
  }});
const w=dom.window;
setTimeout(()=>{
  const doc=w.document;
  const slides=[...doc.querySelectorAll('.slide')];
  console.log('slides:',slides.length);
  // walk the entire deck forward using keyboard
  let guard=0;
  for(let i=0;i<slides.length;i++){
    for(let k=0;k<12;k++){
      try{
        const ev=new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true});
        w.dispatchEvent(ev);
      }catch(e){ errors.push('key '+i+':'+e.stack); }
    }
  }
  // click every button on every slide
  slides.forEach((s,i)=>{
    s.classList.add('active');
    [...s.querySelectorAll('button.btn')].forEach(b=>{ try{ b.click(); }catch(e){ errors.push('btn slide'+(i+1)+' "'+b.textContent+'": '+e.message); } });
    [...s.querySelectorAll('input[type=range]')].forEach(r=>{ try{ r.dispatchEvent(new w.Event('input',{bubbles:true})); }catch(e){ errors.push('range slide'+(i+1)+': '+e.message); } });
    [...s.querySelectorAll('.tile')].forEach(t=>{ try{ t.click(); }catch(e){ errors.push('tile slide'+(i+1)+': '+e.message); } });
  });
  // walk backward
  for(let i=0;i<slides.length*6;i++){ w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})); }
  console.log('menu items:', doc.querySelectorAll('#menuList li').length);
  console.log('footers:', doc.querySelectorAll('.footer').length);
  console.log('unresolved images:', [...doc.querySelectorAll('img')].filter(im=>!im.getAttribute('src').startsWith('data:')).length);
  console.log('ERRORS:', errors.length);
  errors.slice(0,12).forEach(e=>console.log(' -',e));
},600);
