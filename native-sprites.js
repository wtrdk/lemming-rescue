import {LemmingSpriteSheet,ATLAS} from './sprites.js';
const stateAnimation={walking:'lopen',climbing:'klimmen',hoisting:'optrekken',falling:'vallen',floating:'parachute',
  building:'bouwen',shrugging:'schouders',blocking:'blokkeren',bashing:'bashen',mining:'mijnen',digging:'graven',
  ohno:'ohno',drowning:'verdrinken',fried:'branden',splat:'pletter',exiting:'uitgang'};
export class NativeSprites extends LemmingSpriteSheet{
  constructor(){
    super();this.extra=new Image();this.extra.src='/assets/classic/extra-sprites.png';
    this.nativeReady=Promise.all([this.ready,this.extra.decode(),fetch('/assets/classic/extra-sprites.json').then(r=>r.json()).then(d=>this.extraFrames=Object.fromEntries(d.map(f=>[f.name,f])))]);
  }
  frame(ctx,name,index,x,y,left=false,scale=1){
    const list=ATLAS[name]?.[left?'left':'right'];if(!list)return;
    const f=list[Math.max(0,Math.min(list.length-1,index))];ctx.imageSmoothingEnabled=false;
    ctx.drawImage(this.imageForFrame(f),f.x,f.y,f.w,f.h,Math.round(x+f.offsetX*scale),Math.round(y+f.offsetY*scale),f.w*scale,f.h*scale);
  }
  draw(ctx,e,tick,assets,selected=false){
    if(e.state==='dead'){
      if(e.deathReason==='explosion'&&e.age<=2)this.extraDraw(ctx,'explosion',e.x,e.y);
      if(e.deathReason==='explosion'&&e.age<28){
        // Visual particles are a deterministic function of id, age and particle index.
        for(let i=0;i<24;i++){const a=(i*137+e.id*23)*Math.PI/180,v=1+(i%4)/2;
          const x=e.x+Math.cos(a)*v*e.age,y=e.y-6+Math.sin(a)*v*e.age+e.age*e.age*.035;
          ctx.fillStyle=['#00bb00','#4444ee','#ffdddd'][i%3];ctx.fillRect(Math.round(x),Math.round(y),1,1);}
      }return;
    }
    if(e.state==='jumping')this.extraDraw(ctx,e.dir>0?'jump-right':'jump-left',e.x,e.y);
    else{
      const name=stateAnimation[e.state];if(!name)return;const count=ATLAS[name][e.dir<0?'left':'right'].length;
      if(['splat','fried','drowning','exiting'].includes(e.state)&&e.frame>=count)return;
      let frame=e.frame%count;
      // Four opening frames, then the four original open-umbrella frames loop.
      if(e.state==='floating')frame=e.frame<4?e.frame:4+(e.frame-4)%4;
      if(['ohno','drowning','fried','splat','exiting','hoisting'].includes(e.state))frame=Math.min(count-1,e.frame);
      this.frame(ctx,name,frame,e.x,e.y,e.dir<0);
    }
    if(e.bomb!==null){
      const digits=assets.masks.countdown,n=Math.max(1,Math.min(5,Math.ceil(e.bomb*3/50))),bits=digits.frames[9-n];
      ctx.fillStyle='#ffffff';for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(bits[y*8+x])ctx.fillRect(e.x-1+x,e.y-19+y,1,1);
    }
    if(selected){ctx.strokeStyle='#ffffff';ctx.lineWidth=1;ctx.strokeRect(e.x-5.5,e.y-11.5,10,12);}
  }
  extraDraw(ctx,name,x,y){
    const m=this.extraFrames[name]||this.extraFrames.frames?.[name];if(!m)return;
    ctx.drawImage(this.extra,m.x,m.y,m.w,m.h,Math.round(x+(m.offsetX??-8)),Math.round(y+(m.offsetY??-10)),m.w,m.h);
  }
}
