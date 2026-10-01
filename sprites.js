import {ATLAS} from './sprite-atlas.js';
export {ATLAS} from './sprite-atlas.js';
export class LemmingSpriteSheet {
  constructor(){
    this.geladen=false;this.bronCanvas=document.createElement('canvas');
    this.afbeelding=new Image();
    const sheetReady=new Promise((resolve,reject)=>{
      this.afbeelding.onload=()=>{
        const im=this.afbeelding;
        this.bronCanvas.width=im.naturalWidth;this.bronCanvas.height=im.naturalHeight;
        const c=this.bronCanvas.getContext('2d',{willReadFrequently:true});c.drawImage(im,0,0);
        const p=c.getImageData(0,0,im.naturalWidth,im.naturalHeight);
        for(let i=0;i<p.data.length;i+=4)if(p.data[i]===0&&p.data[i+1]===0&&p.data[i+2]===0)p.data[i+3]=0;
        c.putImageData(p,0,0);resolve(this);
      };
      this.afbeelding.onerror=()=>reject(new Error('De sprites konden niet geladen worden. Herlaad de pagina.'));
    });
    this.afbeelding.src='/assets/sprites/lemmings-amiga.png';
    this.correcties=new Image();this.correcties.src='/assets/sprites/sprite-corrections.png';
    this.ready=Promise.all([sheetReady,this.correcties.decode()]).then(()=>{this.geladen=true;return this;});
  }
  imageForFrame(frame){return frame.source==='correction'?this.correcties:this.bronCanvas;}
  teken(ctx,name,time,x,y,scale=3,left=false){
    if(!this.geladen||!ATLAS[name])return false;
    const frames=ATLAS[name][left?'left':'right'];
    let i=Math.floor((time+1e-8)*17);
    if(['ohno','verdrinken','uitgang','pletter','branden','optrekken'].includes(name))i=Math.min(i,frames.length-1);
    else if(name==='parachute')i=i<4?i:4+(i-4)%4;
    else i%=frames.length;
    const f=frames[i];ctx.imageSmoothingEnabled=false;
    ctx.drawImage(this.imageForFrame(f),f.x,f.y,f.w,f.h,Math.round(x+f.offsetX*scale),Math.round(y+f.offsetY*scale),f.w*scale,f.h*scale);
    return true;
  }
}
