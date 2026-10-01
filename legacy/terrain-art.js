const defs={
  dirt:{set:1,tile:0,steel:23,color:'#660011',detail:10},
  fire:{set:2,tile:2,steel:12,color:'#332222',detail:16},
  marble:{set:3,tile:4,steel:5,color:'#aa5555',detail:25},
  pillar:{set:4,tile:20,steel:27,color:'#775511',detail:33},
  crystal:{set:5,tile:25,steel:31,color:'#113344',detail:26}
};
const key=(prefix,n)=>prefix+String(n).padStart(3,'0');
export class TerrainArt{
  constructor(){
    this.theme='dirt';this.loaded=false;this.images={};this.patterns={};this.contextPatterns=new WeakMap();
    this.ready=Promise.all([
      fetch('/assets/terrain/frames.json').then(r=>{if(!r.ok)throw new Error('Terreintegels ontbreken');return r.json();}).then(map=>this.frames=map),
      ...[1,2,3,4,5].map(n=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{this.images[n]=im;resolve();};im.onerror=()=>reject(new Error('Terreingraphics konden niet geladen worden'));im.src=`/assets/terrain/set-${n}.png`;}))
    ]).then(()=>{this.loaded=true;this.makePatterns();return this;});
  }
  frame(n,id){const f=this.frames[String(n)][id];if(!f)throw new Error(`Ontbrekend object: set ${n}, ${id}`);return f;}
  draw(ctx,n,id,x,y,scale=1.5,w=null,h=null){
    if(!this.loaded)return;
    const f=this.frame(n,id);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(this.images[n],f.x,f.y,f.w,f.h,Math.round(x),Math.round(y),w??Math.round(f.w*scale),h??Math.round(f.h*scale));
  }
  makePatterns(){
    for(const [name,d]of Object.entries(defs)){
      this.patterns[name]={};
      for(const [material,id]of [[1,d.tile],[2,d.steel]]){
        const tile=material===1?'t000':key('g',id),f=this.frame(d.set,tile);
        const c=document.createElement('canvas');c.width=Math.round(f.w*1.5);c.height=Math.round(f.h*1.5);
        const ctx=c.getContext('2d');ctx.fillStyle=material===2?'#444455':d.color;ctx.fillRect(0,0,c.width,c.height);
        this.draw(ctx,d.set,tile,0,0);
        this.patterns[name][material]=c;
      }
    }
  }
  paintRect(ctx,x,y,w,h,material){
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(this.loaded&&material!==3){
      let cache=this.contextPatterns.get(ctx);if(!cache){cache={};this.contextPatterns.set(ctx,cache);}
      const id=this.theme+material;cache[id]??=ctx.createPattern(this.patterns[this.theme][material===2?2:1],'repeat');ctx.fillStyle=cache[id];
    }
    else ctx.fillStyle=material===3?'#bb8844':defs[this.theme].color;
    ctx.fillRect(x,y,w,h);ctx.restore();
  }
  repaint(level){
    const c=level.terrainCtx;c.clearRect(0,0,1200,650);
    for(let y=0;y<650;y++){
      let start=0,mat=level.masker[y*1200];
      for(let x=1;x<=1200;x++){
        const next=x===1200?0:level.masker[y*1200+x];
        if(next!==mat){if(mat)this.paintRect(c,start,y,x-start,1,mat);start=x;mat=next;}
      }
    }
    // Overlay the supplied boulder art inside the same collision silhouette.
    if(this.theme==='dirt'){
      const details=document.createElement('canvas');details.width=1200;details.height=650;
      const d=details.getContext('2d');
      for(const p of level.artPieces||[])this.draw(d,1,key('g',p.id),p.x,p.y,p.scale);
      d.globalCompositeOperation='destination-in';d.drawImage(level.terrainCanvas,0,0);c.drawImage(details,0,0);
    }
    // Moss and edge art remain clipped to actual terrain, including existing holes.
    if(this.theme==='dirt'){
      const layer=document.createElement('canvas');layer.width=1200;layer.height=650;const t=layer.getContext('2d');
      for(let x=0;x<1200;x+=72)this.draw(t,1,'g009',x,540,1.5);
      for(let x=610;x<682;x+=28)this.draw(t,1,'g006',x,423,.8);
      t.globalCompositeOperation='destination-in';t.drawImage(level.terrainCanvas,0,0);c.drawImage(layer,0,0);
    }
  }
  liquid(ctx,p,time,lava=false){
    if(!this.loaded)return;
    const n=lava?2:(this.theme==='fire'?1:defs[this.theme].set);
    const surfStart=lava?15:n===1?29:n===3?7:17,bodyStart=lava?23:n===1?37:n===3?15:25;
    const f=Math.floor(time*9)%8;
    const surface=this.frame(n,key('o',surfStart+f)),body=this.frame(n,key('o',bodyStart+f));
    const surfaceHeight=15,bodyY=p.y+surfaceHeight-1;
    ctx.save();ctx.beginPath();ctx.rect(p.x,p.y,p.w,p.h);ctx.clip();
    ctx.imageSmoothingEnabled=false;
    // Body frames reserve transparent space for the surface. Crop that padding,
    // then overlap the last wave row so the liquid has no transparent seam.
    ctx.drawImage(this.images[n],body.x,body.y+surface.h,body.w,body.h-surface.h,
      p.x,bodyY,p.w,p.y+p.h-bodyY);
    this.draw(ctx,n,key('o',surfStart+f),p.x,p.y,1.5,p.w,surfaceHeight);
    ctx.restore();
  }
  objects(ctx,level,time,started){
    if(!this.loaded)return;
    const d=defs[this.theme],n=d.set;
    const common=n===2||n===3?1:n;
    const entrance=this.frame(common,started?'o009':'o000');
    const cx=level.start.x+28;
    this.draw(ctx,common,started?'o009':'o000',cx-entrance.w*.75,level.start.y+20-entrance.h*1.5);
    const base=n===2||n===3?6:16,head=n===2||n===3?0:10;
    const b=this.frame(n,key('o',base)),h=this.frame(n,key('o',head));
    const exitX=level.uitgang.x+level.uitgang.w/2;
    this.draw(ctx,n,key('o',base),exitX-b.w*.75,540-b.h*1.5);
    this.draw(ctx,n,key('o',head+Math.floor(time*9)%6),exitX-h.w*.75,540-(b.h+h.h)*1.5);
  }
  piece(level,id,x,y,scale=1.5){
    if(!this.loaded)return;
    const f=this.frame(1,key('g',id)),c=document.createElement('canvas');c.width=Math.round(f.w*scale);c.height=Math.round(f.h*scale);
    const ctx=c.getContext('2d');this.draw(ctx,1,key('g',id),0,0,scale);
    const pixels=ctx.getImageData(0,0,c.width,c.height).data;
    for(let yy=0;yy<c.height;yy++)for(let xx=0;xx<c.width;xx++){
      const px=x+xx,py=y+yy;
      if(px>=0&&px<1200&&py>=0&&py<650&&pixels[(yy*c.width+xx)*4+3])level.masker[py*1200+px]=1;
    }
    level.artPieces.push({id,x,y,scale});
  }
}
