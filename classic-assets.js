const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const rgba=([r,g,b])=>(255<<24|b<<16|g<<8|r)>>>0;
export class ClassicAssets{
  constructor(){this.styles=[];this.masks={};this.ready=this.load();}
  async load(){
    const get=async(name)=>{const r=await fetch('/assets/classic/'+name);if(!r.ok)throw Error('De originele graphics konden niet geladen worden.');return r.json();};
    const [styles,levels,masks]=await Promise.all([get('atlas.json'),get('levels.json'),get('masks.json')]);
    this.levels=levels;
    this.masks=Object.fromEntries(masks.map(m=>[m.name,m]));
    this.specialBackgrounds=await Promise.all([1,2,3,4].map(async id=>{const image=new Image();image.src=`/assets/classic/special-background-${id}.png`;await image.decode();return image;}));
    this.styles=await Promise.all(styles.map(async(meta)=>{
      const image=new Image();image.src='/assets/classic/style-'+meta.id+'.png';
      await image.decode();const sheet=canvas(image.width,image.height),ctx=sheet.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
      const terrain=meta.terrain.map(f=>({...f,pixels:new Uint32Array(ctx.getImageData(f.x,f.y,f.w,f.h).data.buffer)}));
      return {...meta,image,sheet,terrain,brickColor:rgba(meta.palette[7]),background:'rgb('+meta.palette[0].join(',')+')'};
    }));return this;
  }
  object(style,id){return this.styles[style].objects.find(o=>o.id===id);}
  drawFrame(ctx,style,f,x,y,flip=false){
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(flip){ctx.translate(x,y+f.h);ctx.scale(1,-1);x=0;y=0;}
    ctx.drawImage(this.styles[style].image,f.x,f.y,f.w,f.h,Math.round(x),Math.round(y),f.w,f.h);ctx.restore();
  }
}

export class Terrain{
  constructor(data,assets){
    this.data=data;this.assets=assets;this.width=data.width;this.height=data.height;
    const n=this.width*this.height;
    this.mask=new Uint8Array(n);this.steel=new Uint8Array(n);this.oneWay=new Int8Array(n);
    this.colors=new Uint32Array(n);this.canvas=canvas(this.width,this.height);this.ctx=this.canvas.getContext('2d');
    this.style=assets.styles[data.style];this.specialBackground=data.specialStyle?assets.specialBackgrounds[data.specialStyle-1]||null:null;this.revision=0;this.dirty=true;
    for(const p of data.terrain)this.place(p);
    for(const r of data.steel||[])this.region(r,(i)=>this.steel[i]=1);
    this.objects=data.objects.map((p,index)=>({...p,index,meta:assets.object(data.style,p.id),busy:0}));
    for(const p of this.objects)if(p.meta?.kind.startsWith('one-way')){
      this.region(this.triggerRect(p),(i)=>this.oneWay[i]=p.meta.kind==='one-way-left'?-1:1);
    }
    this.flush();
  }
  index(x,y){return Math.floor(y)*this.width+Math.floor(x);}
  inside(x,y){return x>=0&&y>=0&&x<this.width&&y<this.height;}
  solid(x,y){return this.inside(x,y)&&this.mask[this.index(x,y)]!==0;}
  isSteel(x,y){return this.solid(x,y)&&this.steel[this.index(x,y)]!==0;}
  region(r,fn){
    for(let y=Math.max(0,r.y);y<Math.min(this.height,r.y+r.h);y++)for(let x=Math.max(0,r.x);x<Math.min(this.width,r.x+r.w);x++)fn(this.index(x,y),x,y);
  }
  place(p){
    const f=this.style.terrain.find(t=>t.id===p.id);if(!f)throw Error('Een origineel terreinonderdeel ontbreekt: '+p.id);
    for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++){
      const col=f.pixels[(p.flip?f.h-1-y:y)*f.w+x];if(!(col>>>24))continue;
      const px=p.x+x,py=p.y+y;if(!this.inside(px,py))continue;const i=this.index(px,py);
      if(p.erase){this.colors[i]=0;this.mask[i]=0;}
      else if(!p.behind||!this.mask[i]){this.colors[i]=col;this.mask[i]=1;}
    }
  }
  flush(){if(!this.dirty)return;this.ctx.putImageData(new ImageData(new Uint8ClampedArray(this.colors.buffer),this.width,this.height),0,0);this.dirty=false;}
  blocked(x,y,dir,kind){
    if(!this.solid(x,y))return false;const i=this.index(x,y);
    return !!this.steel[i]||(kind!=='bomb'&&this.oneWay[i]!==0&&(kind==='dig'||this.oneWay[i]!==dir));
  }
  clearPixel(x,y,dir=0,kind='bomb'){
    if(!this.solid(x,y))return 0;if(this.blocked(x,y,dir,kind))return -1;
    const i=this.index(x,y);this.mask[i]=0;this.colors[i]=0;this.dirty=true;return 1;
  }
  applyMask(name,frame,x,y,dir=0,kind='bomb'){
    const m=this.assets.masks[name],bits=m.frames[frame];let removed=0,blocked=0;
    for(let yy=0;yy<m.height;yy++)for(let xx=0;xx<m.width;xx++)if(bits[yy*m.width+xx]){
      const result=this.clearPixel(x+xx,y+yy,dir,kind);if(result>0)removed++;if(result<0)blocked++;
    }
    if(removed)this.revision++;return {removed,blocked};
  }
  digRow(x,y){let removed=0,blocked=0;for(let xx=x-4;xx<=x+4;xx++){
    const r=this.clearPixel(xx,y,0,'dig');if(r>0)removed++;if(r<0)blocked++;
  }if(removed)this.revision++;return {removed,blocked};}
  brick(x,y,dir){
    const start=dir>0?x:x-4;
    for(let xx=start;xx<start+6;xx++)if(this.inside(xx,y-1)){
      const i=this.index(xx,y-1);if(!this.mask[i]){this.mask[i]=1;this.colors[i]=this.style.brickColor;}
    }this.dirty=true;this.revision++;
  }
  triggerRect(p){
    const t=p.meta.trigger,h=p.meta.frames[0].h;
    return {x:p.x+t.x,y:p.y+(p.flip?h-t.y-t.h:t.y),w:t.w,h:t.h};
  }
  atObject(x,y,p){const r=this.triggerRect(p);return x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;}
  snapshot(){return {mask:this.mask.slice(),colors:this.colors.slice(),revision:this.revision,busy:this.objects.map(p=>p.busy)};}
  restore(s){this.mask.set(s.mask);this.colors.set(s.colors);this.revision=s.revision;this.objects.forEach((p,i)=>p.busy=s.busy[i]);this.dirty=true;this.flush();}
  drawObjects(ctx,tick,foreground){
    for(const p of this.objects){
      if(!p.meta||p.meta.kind==='unknown-special'||Boolean(!p.noOverwrite)!==foreground)continue;
      const meta=p.meta,n=meta.frames.length;let frame=tick%n;
      if(meta.kind==='entrance')frame=Math.max(0,Math.min(n-1,tick-35));
      if(meta.kind==='trap')frame=p.busy?Math.min(n-1,n-p.busy):0;
      if(p.onTerrain){
        const f=meta.frames[frame],layer=canvas(f.w,f.h),c=layer.getContext('2d');
        this.assets.drawFrame(c,this.data.style,f,0,0,p.flip);
        c.globalCompositeOperation='destination-in';c.drawImage(this.canvas,p.x,p.y,f.w,f.h,0,0,f.w,f.h);ctx.drawImage(layer,p.x,p.y);
      }else this.assets.drawFrame(ctx,this.data.style,meta.frames[frame],p.x,p.y,p.flip);
    }
  }
}
