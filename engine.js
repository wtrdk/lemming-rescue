import {Terrain} from './classic-assets.js';
import {NativeLemming,TICK} from './lemming-native.js';
export const ENGINE_VERSION='native-1';
export class Engine{
  constructor(data,assets){
    this.data=data;this.assets=assets;this.level=new Terrain(data,assets);
    this.tick=0;this.saved=0;this.dead=0;this.spawned=0;this.entities=[];
    this.skills=data.skills.slice();this.rate=data.releaseRate;this.nextSpawn=45;
    this.nuking=false;this.nukeIndex=0;this.finished=false;this.endGrace=null;this.commands=[];
    this.replay=null;this.replayCursor=0;this.events=[];this.silent=false;
  }
  get remaining(){return Math.max(0,this.data.timeSeconds-this.tick*TICK);}
  get live(){return this.entities.filter(e=>e.alive);}
  get success(){return this.saved>=this.data.required;}
  emit(type,entity){if(!this.silent)this.events.push({type,id:entity?.id,x:entity?.x});}
  drainEvents(){return this.events.splice(0);}
  command(c,record=true){
    if(this.finished)return false;
    let valid=false;
    if(c.type==='skill'){
      const e=this.entities.find(l=>l.id===c.lemming);
      if(e&&this.skills[c.skill]>0&&e.assign(c.skill,this)){this.skills[c.skill]--;valid=true;}
    }else if(c.type==='rate'){
      if(Number.isInteger(c.rate)&&c.rate>=this.data.releaseRate&&c.rate<=99&&c.rate!==this.rate){this.rate=c.rate;valid=true;}
    }else if(c.type==='nuke'&&!this.nuking){this.nuking=true;this.armNext();valid=true;}
    if(valid&&record)this.commands.push({...c,tick:this.tick});return valid;
  }
  armNext(){
    while(this.nukeIndex<this.entities.length){
      const e=this.entities[this.nukeIndex++];if(e.alive&&e.state!=='ohno'&&e.bomb===null){e.bomb=Math.ceil(5/TICK);break;}
    }
  }
  blockedByLemming(e){
    return this.entities.some(b=>b!==e&&(b.state==='blocking'||(b.state==='ohno'&&b.wasBlocker))&&this.level.solid(b.x,b.y)
      &&Math.abs(e.y-b.y)<=4&&((e.dir>0&&b.x>e.x&&b.x-e.x<=6)||(e.dir<0&&b.x<e.x&&e.x-b.x<=6)));
  }
  trigger(e){
    if(!e.alive||e.state==='ohno')return false;
    for(const p of this.level.objects){
      if(!p.meta||!this.level.atObject(e.x,e.y,p))continue;
      const kind=p.meta.kind;
      if(kind==='water'){e.die('water',this);return true;}
      if(kind==='fire'){e.die('fire',this);return true;}
      if(kind==='trap'&&p.busy===0){p.busy=p.meta.frames.length;e.die('trap',this);this.emit('trap-'+p.meta.soundId,e);return true;}
      if(kind==='exit'&&(e.state==='walking'||(e.state==='floating'&&e.floatTick>=4))){e.rescue(this);return true;}
    }return false;
  }
  explode(e){
    this.level.applyMask('explode',0,e.x-8,e.y-14,0,'bomb');e.die('explosion',this);
  }
  spawn(){
    const doors=this.level.objects.filter(p=>p.meta?.kind==='entrance');if(!doors.length)return;
    const door=doors[this.spawned%doors.length];this.entities.push(new NativeLemming(this.spawned+1,door.x+24,door.y+14));
    this.spawned++;this.nextSpawn=this.tick+4+Math.floor((99-this.rate)/2);
  }
  step(){
    if(this.finished)return;
    if(this.replay)while(this.replayCursor<this.replay.commands.length&&this.replay.commands[this.replayCursor].tick<=this.tick){
      this.command(this.replay.commands[this.replayCursor++],false);
    }
    if(this.tick===35)this.emit('door');
    if(!this.nuking&&this.spawned<this.data.total&&this.tick>=this.nextSpawn)this.spawn();
    for(const p of this.level.objects)if(p.busy>0)p.busy--;
    for(const e of this.entities)e.step(this);
    if(this.nuking)this.armNext();
    this.tick++;
    if(this.remaining<=0){this.finished=true;this.endReason='time';}
    else if((this.spawned>=this.data.total||this.nuking)&&!this.entities.some(e=>e.alive)){
      if(this.endGrace===null)this.endGrace=18;
      if(--this.endGrace<=0){this.finished=true;this.endReason='done';}
    }
  }
  exportReplay(){return {version:ENGINE_VERSION,levelId:this.data.id,ticks:this.tick,commands:structuredClone(this.commands),saved:this.saved,dead:this.dead,checksum:this.digest()};}
  digest(){
    let h=2166136261;const mix=n=>{h=Math.imul(h^(n>>>0),16777619)>>>0;};
    for(const n of [this.tick,this.saved,this.dead,this.spawned,this.rate,this.nextSpawn,+this.nuking,this.nukeIndex,this.endGrace??-1,+this.finished,...this.skills])mix(n);
    for(const c of this.endReason||'')mix(c.charCodeAt(0));
    for(const e of this.entities){
      for(const n of [e.id,e.x,e.y,e.dir,e.frame,e.age,e.fallDistance,e.floatTick,e.bomb??-1,e.bricks,+e.climber,+e.floater,+e.wasBlocker,+e.counted,e.jumpY??-1])mix(n);
      for(const c of [e.state,e.deathReason||''])for(const q of c)mix(q.charCodeAt(0));
    }
    for(let i=0;i<this.level.mask.length;i++){mix(this.level.mask[i]|(this.level.steel[i]<<1)|((this.level.oneWay[i]+1)<<2));if(this.level.colors[i])mix(this.level.colors[i]);}
    for(const p of this.level.objects)mix(p.busy);
    return h.toString(16);
  }
  snapshot(){return {terrain:this.level.snapshot(),entities:this.entities.map(e=>({...e})),state:structuredClone({
    tick:this.tick,saved:this.saved,dead:this.dead,spawned:this.spawned,skills:this.skills,rate:this.rate,nextSpawn:this.nextSpawn,
    nuking:this.nuking,nukeIndex:this.nukeIndex,finished:this.finished,endGrace:this.endGrace,endReason:this.endReason})};}
  restore(s){
    this.level.restore(s.terrain);Object.assign(this,structuredClone(s.state));
    this.entities=s.entities.map(data=>Object.assign(new NativeLemming(data.id,data.x,data.y),structuredClone(data)));
    this.events=[];this.replayCursor=0;
    if(this.replay)while(this.replayCursor<this.replay.commands.length&&this.replay.commands[this.replayCursor].tick<this.tick)this.replayCursor++;
  }
}
