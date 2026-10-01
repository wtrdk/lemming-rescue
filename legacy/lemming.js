// Simulation coordinates use three screen pixels per original game pixel.
// y is the foot/surface coordinate; terrain at (x,y) supports the lemming.
export const TICK = 1 / 17;
export const SCALE = 3;
export class Lemming {
  constructor(game,id,x,y) {
    Object.assign(this,{game,id,x,y,richting:1,status:'vallen',vy:0,valStartY:y,
      kanKlimmen:false,heeftParachute:false,bomTimer:null,werkTimer:0,
      bouwStappen:0,animatieTijd:0,verwijderNa:0,doodReden:null,
      parachuteOpen:false,staatTijd:0,muurX:null,hoist:null,sprongY:null,wasBlokkeerder:false});
  }
  get actief() { return !['dood','gered'].includes(this.status); }
  get opGrond() {return this.game.level.isSolid(this.x,this.y);}
  verander(status) {this.status=status;this.animatieTijd=0;this.staatTijd=0;this.werkTimer=0;}
  val() {this.verander('vallen');this.vy=0;this.valStartY=this.y;this.parachuteOpen=false;}
  wijsActieToe(key) {
    if(!this.actief || ['verdrinken','ohno'].includes(this.status)) return false;
    if(key==='klimmer') {if(this.kanKlimmen)return false;this.kanKlimmen=true;return true;}
    if(key==='parachutist') {if(this.heeftParachute)return false;this.heeftParachute=true;return true;}
    if(key==='bombardier') {if(this.bomTimer!==null)return false;this.bomTimer=5;return true;}
    if(['blokkeren','vallen','springen','klimmen','optrekken'].includes(this.status)||!this.opGrond)return false;
    const states={blokkeerder:'blokkeren',bouwer:'bouwen',basher:'bashen',mijnwerker:'mijnen',graver:'graven'};
    if(!states[key])return false;
    if(this.status===states[key] && key!=='bouwer')return false;
    // A new Builder assignment refreshes his twelve bricks.
    this.verander(states[key]);this.bouwStappen=0;return true;
  }
  update(dt) {
    if(!this.actief){this.verwijderNa+=dt;this.staatTijd+=dt;return;}
    this.animatieTijd+=dt;this.staatTijd+=dt;
    if(this.bomTimer!==null){
      this.bomTimer-=dt;
      if(this.bomTimer<=0){
        if(this.status==='vallen')this.game.explodeer(this);
        else {this.bomTimer=null;this.wasBlokkeerder=this.status==='blokkeren';this.verander('ohno');}
        return;
      }
    }
    const level=this.game.level;
    if(level.lavaOp(this.x,this.y)){this.sterf('lava');return;}
    if(level.waterOp(this.x,this.y)&&this.status!=='verdrinken'){
      this.verander('verdrinken');this.bomTimer=null;return;
    }
    if((this.status==='lopen'||(this.status==='vallen'&&this.parachuteOpen))&&level.bijUitgang(this.x,this.y)){
      this.verander('gered');this.game.lemmingGered(this);return;
    }
    if(this.y>=650||this.x<-10||this.x>1210){this.sterf('val');return;}
    const actions={lopen:'updateLopen',springen:'updateSpringen',vallen:'updateVallen',klimmen:'updateKlimmen',
      optrekken:'updateOptrekken',verdrinken:'updateVerdrinken',graven:'updateGraven',
      bashen:'updateBashen',mijnen:'updateMijnen',bouwen:'updateBouwen',blokkeren:'updateBlokkeren',
      ophalen:'updateOphalen',ohno:'updateOhno'};
    if(actions[this.status])this[actions[this.status]](dt);
  }
  updateLopen(dt) {
    const level=this.game.level;
    if(!this.opGrond){this.val();return;}
    if(this.game.nabijeBlokkeerder(this)){this.richting*=-1;return;}
    let remaining=51*dt;
    while(remaining>0){
      const step=Math.min(1,remaining), nx=this.x+this.richting*step;
      if(nx<2||nx>=1198){this.richting*=-1;return;}
      // Classic walkers test their effective foot coordinate. They fit through
      // low tunnels and ascend 3–6 game-pixel steps instead of turning at 3.
      const ny=level.vindLoopY(nx,this.y,6*SCALE,3*SCALE,false);
      if(ny!==null){
        this.x=nx;
        if(this.y-ny>2*SCALE){this.sprongY=ny;this.verander('springen');return;}
        this.y=ny;remaining-=step;continue;
      }
      if(level.isSolid(nx,this.y-9)||level.isSolid(nx,this.y-24)){
        if(this.kanKlimmen){this.muurX=Math.floor(nx);this.x=nx-this.richting*3;this.verander('klimmen');}
        else {this.x=nx;this.richting*=-1;}
        return;
      }
      this.x=nx;this.val();return;
    }
  }
  updateSpringen() {
    this.y=Math.max(this.sprongY,this.y-2*SCALE);
    if(this.y===this.sprongY){if(this.opGrond)this.verander('lopen');else this.val();}
  }
  updateVallen(dt) {
    const level=this.game.level;
    if(this.heeftParachute&&this.y-this.valStartY>=36)this.parachuteOpen=true;
    this.vy=this.parachuteOpen?51:Math.min(153,this.vy+1020*dt);
    const end=this.y+this.vy*dt;
    // Sweep every pixel: thin stairs and surfaces cannot be skipped.
    for(let y=Math.floor(this.y);y<=Math.ceil(end);y++){
      if(level.lavaOp(this.x,y)){this.y=y;this.sterf('lava');return;}
      if(level.waterOp(this.x,y)){
        this.y=y;this.bomTimer=null;this.verander('verdrinken');return;
      }
      if(level.isSolid(this.x,y)){
        this.y=y;
        if(!this.parachuteOpen&&y-this.valStartY>189)this.sterf('val');
        else {this.vy=0;this.parachuteOpen=false;this.verander('lopen');}
        return;
      }
    }
    this.y=end;
  }
  updateKlimmen(dt) {
    const level=this.game.level, wall=this.muurX;
    if(level.isSolid(this.x,this.y-30)){
      this.richting*=-1;this.x+=this.richting*3;this.val();return;
    }
    this.y-=34*dt;
    if(!level.isSolid(wall,this.y-24)){
      // Locate the actual top, then animate onto it; never fall into the wall.
      for(let top=Math.floor(this.y-24);top<=Math.ceil(this.y+3);top++){
        if(level.isSolid(wall,top)&&!level.isSolid(wall,top-1)){
          const nx=wall+this.richting*3;
          if(level.isSolid(nx,top-24)){this.richting*=-1;this.val();return;}
          this.hoist={x0:this.x,y0:this.y,x1:nx,y1:top};this.verander('optrekken');return;
        }
      }
      this.richting*=-1;this.val();
    }
  }
  updateOptrekken() {
    const t=Math.min(1,this.staatTijd/(8*TICK)),h=this.hoist;
    this.x=h.x0+(h.x1-h.x0)*t;this.y=h.y0+(h.y1-h.y0)*t;
    if(t>=1){this.x=h.x1;this.y=h.y1;this.verander('lopen');}
  }
  updateVerdrinken() {if(this.staatTijd>=16*TICK)this.sterf('water');}
  updateOhno() {if(this.staatTijd>=16*TICK)this.game.explodeer(this);}
  updateBlokkeren() {if(!this.opGrond)this.val();}
  updateOphalen() {if(!this.opGrond)this.val();else if(this.staatTijd>=8*TICK)this.verander('lopen');}
  updateBouwen(dt) {
    const level=this.game.level;
    this.werkTimer+=dt;
    if(this.werkTimer+1e-8<16*TICK)return;
    this.werkTimer-=16*TICK;
    const nx=this.x+this.richting*6, ny=this.y-3;
    if(level.isSolid(nx,ny-24)||level.isSolid(nx+this.richting*6,ny-24)||level.isSolid(nx,ny-12)||level.isSolid(nx,ny-1)){
      this.richting*=-1;this.verander('lopen');if(!this.opGrond)this.val();return;
    }
    level.bouwStap(this.x,this.y,this.richting);
    this.x=nx;this.y=ny;this.bouwStappen++;
    if(this.bouwStappen>=9)this.game.geluid.toon('bouwer');
    if(this.bouwStappen===12)this.verander('ophalen');
  }
  updateBashen(dt) {
    const level=this.game.level;this.werkTimer+=dt;
    if(!this.opGrond){this.val();return;}
    if(this.werkTimer+1e-8<8*TICK)return;
    this.werkTimer-=8*TICK;
    const x0=this.richting>0?this.x:this.x-21;
    if(level.heeftStaal(x0,this.y-24,21,24)){this.richting*=-1;this.verander('lopen');return;}
    if(!level.heeftMateriaalInRechthoek(x0,this.y-21,21,18)){this.verander('lopen');return;}
    // Rounded leading mask, flat tunnel floor. No supporting ground is erased.
    level.verwijderMasker(x0,this.y-27,21,27,(x,y)=> y>=3 || (x>=3&&x<18));
    const nx=this.x+this.richting*6;
    if(level.isSolid(nx,this.y-12)){this.verander('lopen');return;}
    this.x=nx;
  }
  updateMijnen(dt) {
    const level=this.game.level;this.werkTimer+=dt;
    if(this.werkTimer+1e-8<12*TICK)return;
    this.werkTimer-=12*TICK;
    const x0=this.richting>0?this.x-3:this.x-24;
    if(level.heeftStaal(x0,this.y-18,27,25)){this.richting*=-1;this.verander('lopen');return;}
    if(!level.heeftMateriaalInRechthoek(x0,this.y-3,27,10)){this.val();return;}
    level.verwijderMasker(x0,this.y-24,27,39,(x,y)=>y<27+(this.richting>0?x-9:17-x)/2);
    this.x+=this.richting*6;
    const floor=level.vindLoopY(this.x,this.y+3,0,12);
    if(floor===null)this.val();else this.y=floor;
  }
  updateGraven(dt) {
    const level=this.game.level;this.werkTimer+=dt;
    if(this.werkTimer+1e-8<8*TICK)return;
    this.werkTimer-=8*TICK;
    if(level.heeftStaal(this.x-12,this.y,24,3)){this.verander('lopen');return;}
    if(!level.heeftMateriaalInRechthoek(this.x-12,this.y,24,3)){this.val();return;}
    level.verwijderRechthoek(this.x-12,this.y,24,3);this.y+=3;
    if(!this.opGrond)this.val();
  }
  sterf(reason) {
    if(!this.actief)return;
    this.verander('dood');this.doodReden=reason;this.bomTimer=null;this.game.lemmingDood(this,reason);
  }
  teken(ctx,selected=false) {
    if(this.status==='gered'){
      if(this.staatTijd<8*TICK)this.game.lemmingSprites.teken(ctx,'uitgang',this.staatTijd,this.x,this.y,SCALE,this.richting<0);
      return;
    }
    if(this.status==='dood'){
      if(this.doodReden==='val'&&this.verwijderNa<16*TICK)this.game.lemmingSprites.teken(ctx,'pletter',this.verwijderNa,this.x,this.y,SCALE,this.richting<0);
      if(this.doodReden==='lava'&&this.verwijderNa<14*TICK)this.game.lemmingSprites.teken(ctx,'branden',this.verwijderNa,this.x,this.y,SCALE,false);
      return;
    }
    const animations={lopen:'lopen',springen:'vallen',klimmen:'klimmen',optrekken:'optrekken',vallen:this.parachuteOpen?'parachute':'vallen',
      bouwen:'bouwen',ophalen:'schouders',bashen:'bashen',mijnen:'mijnen',graven:'graven',blokkeren:'blokkeren',verdrinken:'verdrinken',ohno:'ohno'};
    this.game.lemmingSprites.teken(ctx,animations[this.status]||'lopen',this.status==='springen'?0:this.animatieTijd,this.x,this.y,SCALE,this.richting<0);
    if(this.bomTimer!==null){
      ctx.save();ctx.font='bold 16px monospace';ctx.textAlign='center';ctx.fillStyle='#fff2a0';ctx.strokeStyle='#101722';ctx.lineWidth=3;
      const n=String(Math.max(1,Math.ceil(this.bomTimer)));ctx.strokeText(n,this.x,this.y-39);ctx.fillText(n,this.x,this.y-39);ctx.restore();
    }
    if(selected){ctx.save();ctx.strokeStyle='#8cf7ff';ctx.lineWidth=2;ctx.strokeRect(this.x-13,this.y-33,26,36);ctx.restore();}
  }
}
