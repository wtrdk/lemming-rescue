export class GameAudio{
  constructor(report){
    this.report=report;this.effects=true;this.musicEnabled=false;this.volume=.45;this.buffers=new Map();this.sources=new Set();
    this.music=new Audio();this.music.loop=true;this.music.preload='metadata';
    this.music.addEventListener('error',()=>{if(this.musicEnabled)this.report('De muziek kon niet geladen worden.');});
    this.tracks=['orig_01_cancan_amiga.ogg','orig_02_lemming1_amiga.ogg','orig_03_tim2_amiga.ogg','orig_04_lemming2_amiga.ogg','orig_05_tim8_amiga.ogg'];
  }
  async unlock(){
    try{
      this.ctx??=new AudioContext();if(this.ctx.state==='suspended')await this.ctx.resume();
      if(!this.gain){this.gain=this.ctx.createGain();this.gain.connect(this.ctx.destination);}this.gain.gain.value=this.volume;
    }catch{this.report('Geluid wordt door deze browser niet ondersteund.');}
  }
  async fx(type){
    if(!this.effects||!this.ctx||this.ctx.state!=='running'||this.sources.size>=10)return;
    const map={trap:'thud',water:'splash',die:'die',fire:'fire'};
    const name=map[type]||type;if(name.startsWith('trap-'))return;
    try{
      if(!this.buffers.has(name))this.buffers.set(name,fetch('/assets/audio/sfx/'+name+'.wav').then(r=>{if(!r.ok)throw Error('fx');return r.arrayBuffer();}).then(a=>this.ctx.decodeAudioData(a)));
      const buffer=await this.buffers.get(name);const source=this.ctx.createBufferSource();source.buffer=buffer;source.connect(this.gain);this.sources.add(source);
      source.onended=()=>this.sources.delete(source);source.start();
    }catch{this.buffers.delete(name);}
  }
  setLevel(index){
    const src='/assets/audio/music/'+this.tracks[index];if(this.music.getAttribute('src')!==src){this.music.pause();this.music.src=src;this.music.currentTime=0;}
  }
  playMusic(){if(this.musicEnabled)this.music.play().catch(()=>this.report('Klik op Muziek om het afspelen te starten.'));}
  pause(){this.music.pause();}
  setVolume(value){this.volume=value;this.music.volume=value*.6;if(this.gain)this.gain.gain.value=value;}
}
