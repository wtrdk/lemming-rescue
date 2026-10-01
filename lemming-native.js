// Native pixel coordinates and frame-driven actions. See THIRD-PARTY-NOTICES.md.
export const TICK=3/50;
export const SKILLS=['Climber','Floater','Bomber','Blocker','Builder','Basher','Miner','Digger'];
export const LIVE=new Set(['walking','jumping','falling','floating','climbing','hoisting','blocking','building','shrugging','bashing','mining','digging','ohno']);
export class NativeLemming{
  constructor(id,x,y,team=0){
    Object.assign(this,{id,x,y,team,dir:team===1?-1:1,state:'falling',frame:0,age:0,climber:false,floater:false,fallDistance:0,
      floatTick:0,bomb:null,bricks:0,wasBlocker:false,jumpY:null,counted:false,deathReason:null});
  }
  get alive(){return LIVE.has(this.state);}
  change(state){this.state=state;this.frame=0;this.age=0;}
  fall(){this.change('falling');this.fallDistance=0;this.floatTick=0;}
  canAssign(skill,level){
    if(!this.alive||this.state==='ohno')return false;
    if(skill===0)return !this.climber;if(skill===1)return !this.floater;if(skill===2)return this.bomb===null;
    if(['blocking','falling','floating','jumping','climbing','hoisting'].includes(this.state)||!level.solid(this.x,this.y))return false;
    const state=['','','','blocking','building','bashing','mining','digging'][skill];
    return skill===4||this.state!==state;
  }
  assign(skill,game){
    if(!this.canAssign(skill,game.level))return false;
    if(skill===0)this.climber=true;
    else if(skill===1)this.floater=true;
    else if(skill===2)this.bomb=Math.ceil(5/TICK);
    else {this.change(['','','','blocking','building','bashing','mining','digging'][skill]);if(skill===4)this.bricks=0;}
    return true;
  }
  die(reason,game){
    if(this.counted)return;this.counted=true;this.deathReason=reason;this.bomb=null;
    this.change(reason==='water'?'drowning':reason==='fire'?'fried':reason==='splat'?'splat':'dead');
    game.dead++;game.emit(reason==='splat'?'splat':reason==='fire'?'fire':reason==='trap'?'trap':reason==='explosion'?'explode':'die',this);
  }
  rescue(game){
    if(this.counted)return;this.counted=true;this.bomb=null;this.change('exiting');game.saved++;game.emit('yippee',this);
  }
  step(game){
    this.age++;if(!this.alive){this.frame++;return;}
    const ground=game.level;
    if(this.bomb!==null&&--this.bomb<=0){
      this.bomb=null;
      if(['falling','floating'].includes(this.state)){game.explode(this);return;}
      this.wasBlocker=this.state==='blocking';this.change('ohno');game.emit('ohno',this);return;
    }
    if(this.y>=ground.height||this.x<0||this.x>=ground.width){this.die('void',game);return;}
    if(game.trigger(this))return;
    if(this.state==='ohno'){if(this.age>=16)game.explode(this);else this.frame++;return;}
    if(this.state==='blocking'){this.frame=(this.frame+1)%16;if(!ground.solid(this.x,this.y))this.fall();return;}
    if(this.state==='shrugging'){this.frame++;if(!ground.solid(this.x,this.y))this.fall();else if(this.age>=8)this.change('walking');return;}
    if(this.state==='walking')return this.walk(game);
    if(this.state==='jumping'){
      this.y=Math.max(this.jumpY,this.y-2);if(this.y===this.jumpY)this.change('walking');return;
    }
    if(this.state==='falling'||this.state==='floating')return this.descend(game);
    if(this.state==='climbing'){
      this.frame=(this.frame+1)%8;
      if(this.frame<4){
        if(!ground.solid(this.x,this.y-this.frame-7)){this.y=this.y-this.frame+2;this.change('hoisting');}
      }else{
        this.y--;
        if(ground.solid(this.x-this.dir,this.y-8)){this.dir*=-1;this.x+=this.dir*2;this.fall();}
      }return;
    }
    if(this.state==='hoisting'){
      this.frame++;if(this.frame<=4)this.y-=2;if(this.frame>=8)this.change('walking');return;
    }
    if(this.state==='building')return this.build(game);
    if(this.state==='bashing')return this.bash(game);
    if(this.state==='mining')return this.mine(game);
    if(this.state==='digging')return this.dig(game);
  }
  walk(game){
    const g=game.level;this.frame=(this.frame+1)%8;
    if(!g.solid(this.x,this.y)){this.fall();return;}
    if(game.blockedByLemming(this)){this.dir*=-1;return;}
    this.x+=this.dir;
    if(g.solid(this.x,this.y)){
      let up=0;while(up<7&&g.solid(this.x,this.y-up-1))up++;
      if(up>=7){if(this.climber)this.change('climbing');else this.dir*=-1;return;}
      if(up>2){this.jumpY=this.y-up;this.change('jumping');}
      else this.y-=up;
    }else{
      let down=1;while(down<4&&!g.solid(this.x,this.y+down))down++;
      if(down===4){this.fall();this.y+=3;this.fallDistance=3;}else this.y+=down;
    }
  }
  descend(game){
    const g=game.level;this.frame++;
    if(this.state==='falling'&&this.floater&&this.fallDistance>16){this.change('floating');this.floatTick=0;}
    const speed=this.state==='floating'?[3,3,3,3,-1,1,1,1,2,2,2,2,2,2,2,2][Math.min(this.floatTick++,15)]:3;
    if(speed<0){this.y+=speed;return;}
    for(let i=0;i<speed;i++){
      if(g.solid(this.x,this.y)){
        if(this.state!=='floating'&&this.fallDistance>63)this.die('splat',game);
        else this.change('walking');return;
      }
      this.y++;this.fallDistance++;
      if(game.trigger(this))return;
    }
  }
  build(game){
    const g=game.level;this.frame=(this.frame+1)%16;
    if(this.frame===9){g.brick(this.x,this.y,this.dir);if(this.bricks>=9)game.emit('ting',this);}
    if(this.frame!==0)return;
    this.y--;
    for(let i=0;i<2;i++){this.x+=this.dir;if(g.solid(this.x,this.y-1)){this.dir*=-1;this.change('walking');return;}}
    this.bricks++;if(this.bricks>=12){this.change('shrugging');return;}
    if(g.solid(this.x+this.dir*2,this.y-9)){this.dir*=-1;this.change('walking');}
  }
  bash(game){
    const g=game.level;this.frame=(this.frame+1)%32;const phase=this.frame%16;
    if(phase>=2&&phase<=5){
      const r=g.applyMask(this.dir>0?'bash-right':'bash-left',phase-2,this.x-8,this.y-10,this.dir,'bash');
      if(r.blocked){game.emit('chink',this);this.dir*=-1;this.change('walking');return;}
    }
    if(phase===5){
      let material=false;for(let i=0;i<4;i++)material||=g.solid(this.x+this.dir*(8+i),this.y-6);
      if(!material){this.change('walking');return;}
    }
    if(phase>10){
      this.x+=this.dir;let down=0;while(down<3&&!g.solid(this.x,this.y+down))down++;
      this.y+=down;if(down===3)this.fall();
    }
  }
  mine(game){
    const g=game.level;this.frame=(this.frame+1)%24;
    if(this.frame===1||this.frame===2){
      const r=g.applyMask(this.dir>0?'mine-right':'mine-left',this.frame-1,this.x-8,this.y-12,this.dir,'mine');
      if(r.blocked){game.emit('chink',this);this.dir*=-1;this.change('walking');return;}
    }
    if(this.frame===3||this.frame===15){
      if(this.frame===3)this.y++;
      this.x+=this.dir;if(!g.solid(this.x,this.y))this.fall();
    }
  }
  dig(game){
    const g=game.level;
    if(this.age===1){g.digRow(this.x,this.y-2);g.digRow(this.x,this.y-1);this.frame=0;}
    else this.frame=(this.frame+1)%16;
    if((this.frame&7)!==0)return;
    const r=g.digRow(this.x,this.y);
    if(r.blocked){game.emit('chink',this);this.change('walking');return;}
    this.y++;
    if(!r.removed)this.fall();
  }
}
