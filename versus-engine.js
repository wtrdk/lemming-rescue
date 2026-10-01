import {Engine} from './engine.js';
import {NativeLemming} from './lemming-native.js';

// Two-controller layer for the original Amiga head-to-head layouts. The normal
// campaign engine remains unchanged; here each player gets a separate skill pool.
export class VersusEngine extends Engine {
  constructor(data,assets){
    super(data,assets);
    this.teamSkills=[data.skills.slice(),data.skills.slice()];
    this.exitScores=[0,0];this.exitPoints=data.objects.filter(o=>assets.object(data.style,o.id)?.kind==='exit').map(o=>o.x).sort((a,b)=>a-b);
    this.entrances=data.objects.filter(o=>assets.object(data.style,o.id)?.kind==='entrance').sort((a,b)=>a.x-b.x);
    this.spawnedByTeam=[0,0];
  }
  command(c,record=true){
    if(c.type!=='skill')return super.command(c,record);
    if(this.finished)return false;
    const team=c.team===1?1:0,e=this.entities.find(l=>l.id===c.lemming);
    if(!e||this.teamSkills[team][c.skill]<=0||!e.assign(c.skill,this))return false;
    this.teamSkills[team][c.skill]--;if(record)this.commands.push({...c,team,tick:this.tick});return true;
  }
  spawn(){
    if(!this.entrances.length)return;
    const doorIndex=this.spawned%this.entrances.length,door=this.entrances[doorIndex];
    const team=doorIndex===1?1:(this.entrances.length===1?this.spawned%2:0);
    const lemming=new NativeLemming(this.spawned+1,door.x+24,door.y+14,team);
    this.entities.push(lemming);this.spawned++;this.spawnedByTeam[team]++;
    this.nextSpawn=this.tick+4+Math.floor((99-this.rate)/2);
  }
  trigger(e){
    if(!e.alive||e.state==='ohno')return false;
    for(const p of this.level.objects){
      if(!p.meta||!this.level.atObject(e.x,e.y,p))continue;
      const kind=p.meta.kind;
      if(kind==='water'){e.die('water',this);return true;}
      if(kind==='fire'){e.die('fire',this);return true;}
      if(kind==='trap'&&p.busy===0){p.busy=p.meta.frames.length;e.die('trap',this);this.emit('trap-'+p.meta.soundId,e);return true;}
      if(kind==='exit'&&(e.state==='walking'||(e.state==='floating'&&e.floatTick>=4))){
        const sorted=this.exitPoints,owner=sorted.length<2?e.team:(e.x<=(sorted[0]+sorted.at(-1))/2?0:1);
        this.exitScores[owner]++;e.rescue(this);return true;
      }
    }return false;
  }
}
