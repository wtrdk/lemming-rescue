import {Lemming, TICK} from './lemming.js';
import {LemmingSpriteSheet} from './sprites.js';
import {TerrainArt} from './terrain-art.js';
'use strict';

/*
 * Lemming Rescue
 * ------------------------------------------------------------
 * Zelfstandige Canvas-game die de klassieke Lemmings-mechaniek nabootst.
 *
 * De lemming-graphics komen uit de door de gebruiker aangeleverde Amiga
 * spritesheet. De omgeving en levelgraphics worden lokaal met Canvas getekend.
 */

const BREEDTE = 1200;
const HOOGTE = 650;

// Pas uitsluitend dit blok aan wanneer je eigen spritesheet andere frameposities heeft.
// De acht vaardigheden uit het oorspronkelijke Lemmings.
const ACTIES = Object.freeze({
  klimmer:      { naam: 'Climber', toets: '1', startAantal: 4, icoon: '↥' },
  parachutist:  { naam: 'Floater', toets: '2', startAantal: 6, icoon: '☂' },
  bombardier:   { naam: 'Bomber',  toets: '3', startAantal: 4, icoon: '💥' },
  blokkeerder:  { naam: 'Blocker', toets: '4', startAantal: 3, icoon: '✋' },
  bouwer:       { naam: 'Builder', toets: '5', startAantal: 8, icoon: '▰' },
  basher:       { naam: 'Basher',  toets: '6', startAantal: 5, icoon: '↔' },
  mijnwerker:   { naam: 'Miner',   toets: '7', startAantal: 4, icoon: '⛏' },
  graver:       { naam: 'Digger',  toets: '8', startAantal: 4, icoon: '↓' }
});

class Action {
  constructor(sleutel, definitie) {
    this.sleutel = sleutel;
    this.naam = definitie.naam;
    this.toets = definitie.toets;
    this.icoon = definitie.icoon;
    this.aantal = definitie.startAantal;
  }
}

class SpriteSheet {
  constructor(config) {
    this.config = config;
    this.afbeelding = new Image();
    this.geladen = false;
    this.buffer = document.createElement('canvas');
    this.buffer.width = config.frameBreedte;
    this.buffer.height = config.frameHoogte;
    this.bufferCtx = this.buffer.getContext('2d');
    this.bufferCtx.imageSmoothingEnabled = false;
    this.afbeelding.onload = () => { this.geladen = true; };
    this.afbeelding.onerror = () => { this.geladen = false; };
    if (config.url) this.afbeelding.src = config.url;
  }

  teken(ctx, frameNaam, x, y, schaal = 1, spiegel = false, tint = null) {
    if (!this.geladen) return false;
    const index = this.config.frames[frameNaam];
    if (index === undefined) return false;

    const fw = this.config.frameBreedte;
    const fh = this.config.frameHoogte;
    const sx = index * fw;
    const doelW = fw * schaal;
    const doelH = fh * schaal;

    ctx.save();
    ctx.translate(x, y);
    if (spiegel) ctx.scale(-1, 1);

    if (tint) {
      // Tint eerst op een klein offscreen canvas, zodat de wereld erachter niet wordt meegetint.
      const bctx = this.bufferCtx;
      bctx.clearRect(0, 0, fw, fh);
      bctx.globalCompositeOperation = 'source-over';
      bctx.globalAlpha = 1;
      bctx.drawImage(this.afbeelding, sx, 0, fw, fh, 0, 0, fw, fh);
      bctx.globalCompositeOperation = 'source-atop';
      bctx.globalAlpha = .38;
      bctx.fillStyle = tint;
      bctx.fillRect(0, 0, fw, fh);
      bctx.globalCompositeOperation = 'source-over';
      bctx.globalAlpha = 1;
      ctx.drawImage(this.buffer, -doelW / 2, -doelH, doelW, doelH);
    } else {
      ctx.drawImage(this.afbeelding, sx, 0, fw, fh, -doelW / 2, -doelH, doelW, doelH);
    }
    ctx.restore();
    return true;
  }
}

class Geluid {
  constructor() {
    this.ctx = null;
    this.actief = true;
  }

  activeer() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  toon(type) {
    if(this.muted)return;
    if (!this.actief) return;
    this.activeer();
    if (!this.ctx) return;

    const nu = this.ctx.currentTime;
    const oscillator = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    oscillator.connect(gain);
    gain.connect(this.ctx.destination);

    const instellingen = {
      graver: [150, 0.07, 'square'],
      bouwer: [330, 0.08, 'triangle'],
      blokkeerder: [210, 0.10, 'sine'],
      parachutist: [520, 0.12, 'sine'],
      gered: [740, 0.16, 'sine'],
      dood: [95, 0.20, 'sawtooth']
    };
    const [freq, duur, golf] = instellingen[type] || [260, 0.08, 'sine'];
    oscillator.type = golf;
    oscillator.frequency.setValueAtTime(freq, nu);
    gain.gain.setValueAtTime(0.055, nu);
    gain.gain.exponentialRampToValueAtTime(0.001, nu + duur);
    oscillator.start(nu);
    oscillator.stop(nu + duur);
  }

  explosie() {
    if(this.muted)return;
    this.activeer();
    if (!this.ctx) return;
    const duur = 0.35;
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.floor(sampleRate * duur), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const afname = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * afname * afname;
    }
    const bron = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    bron.buffer = buffer;
    bron.connect(gain);
    gain.connect(this.ctx.destination);
    gain.gain.value = 0.12;
    bron.start();
  }
}

class Level {
  constructor(game) {
    this.game = game;
    this.artPieces=[];
    this.masker = new Uint8Array(BREEDTE * HOOGTE);
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCanvas.width = BREEDTE;
    this.terrainCanvas.height = HOOGTE;
    this.terrainCtx = this.terrainCanvas.getContext('2d');

    this.start = { x: 108, y: 390, w: 56, h: 58 };
    this.uitgang = { x: 1080, y: 476, w: 58, h: 64 };
    this.water = [{ x: 360, y: 548, w: 88, h: 102 }];
    this.lava = [{ x: 800, y: 548, w: 88, h: 102 }];

    this.maakLevel();
  }

  index(x, y) { return (y | 0) * BREEDTE + (x | 0); }

  isSolid(x, y) {
    x |= 0; y |= 0;
    if (x < 0 || x >= BREEDTE || y < 0) return true;
    if (y >= HOOGTE) return false;
    return this.masker[this.index(x, y)] > 0;
  }

  vulRechthoek(x, y, w, h, kleur = '#65554d', materiaal = 1) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(BREEDTE, Math.ceil(x + w));
    const y1 = Math.min(HOOGTE, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      this.masker.fill(materiaal, yy * BREEDTE + x0, yy * BREEDTE + x1);
    }
    this.terrainCtx.fillStyle = kleur;
    this.terrainCtx.fillRect(x0, y0, x1 - x0, y1 - y0);
    this.game.art.paintRect(this.terrainCtx,x0,y0,x1-x0,y1-y0,materiaal);

    // Lichte textuur voor leesbaarheid.
    this.terrainCtx.fillStyle = 'rgba(255,255,255,.055)';
  }

  verwijderMasker(x,y,w,h,mask=()=>true) {
    const x0=Math.floor(x),y0=Math.floor(y);
    for(let dy=0;dy<h;dy++) {
      let run=-1;
      for(let dx=0;dx<=w;dx++) {
        const xx=x0+dx,yy=y0+dy,ok=dx<w&&xx>=0&&xx<BREEDTE&&yy>=0&&yy<HOOGTE&&mask(dx,dy)&&this.masker[this.index(xx,yy)]!==2;
        if(ok){this.masker[this.index(xx,yy)]=0;if(run<0)run=xx;}
        else if(run>=0){this.terrainCtx.clearRect(run,yy,xx-run,1);run=-1;}
      }
    }
  }
  verwijderRechthoek(x,y,w,h){this.verwijderMasker(x,y,w,h);}
  verwijderCirkel(cx,cy,r){this.verwijderMasker(cx-r,cy-r,r*2+1,r*2+1,(x,y)=>(x-r)**2+(y-r)**2<=r*r);}
  heeftStaal(x,y,w,h) {
    for(let yy=Math.max(0,Math.floor(y));yy<Math.min(HOOGTE,y+h);yy++)
      for(let xx=Math.max(0,Math.floor(x));xx<Math.min(BREEDTE,x+w);xx++)
        if(this.masker[this.index(xx,yy)]===2)return true;
    return false;
  }
  bouwStap(x,y,dir) {
    const bx=dir>0?Math.floor(x)-3:Math.floor(x)-15;
    this.vulRechthoek(bx,Math.round(y)-3,18,3,'#b4874e',3);
    this.terrainCtx.fillStyle='#e6c789';this.terrainCtx.fillRect(bx,Math.round(y)-3,18,1);
  }

  heeftMateriaalInRechthoek(x, y, w, h) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(BREEDTE, Math.ceil(x + w));
    const y1 = Math.min(HOOGTE, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        if (this.masker[this.index(xx, yy)] > 0) return true;
      }
    }
    return false;
  }

  vindLoopY(x,reference,maxUp=6,maxDown=9,headClearance=true) {
    if(!headClearance){
      let y=Math.round(reference),up=0;
      if(this.isSolid(x,y)){
        while(up<=maxUp&&this.isSolid(x,y-1)){y--;up++;}
        return up<=maxUp?y:null;
      }
      for(let down=1;down<=maxDown;down++)if(this.isSolid(x,y+down))return y+down;
      return null;
    }
    for(let y=Math.round(reference)-maxUp;y<=Math.round(reference)+maxDown;y++)
      if(this.isSolid(x,y)&&!this.isSolid(x,y-1)&&(!headClearance||(!this.isSolid(x,y-12)&&!this.isSolid(x,y-24))))return y;
    return null;
  }

  inGebied(p, x, y) {
    return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
  }

  waterOp(x, y) { return this.water.find(p => this.inGebied(p, x, y)) || null; }
  lavaOp(x, y) { return this.lava.find(p => this.inGebied(p, x, y)) || null; }

  bijUitgang(x, y) {
    return x >= this.uitgang.x - 8 && x <= this.uitgang.x + this.uitgang.w + 8 &&
           y >= this.uitgang.y && y <= this.uitgang.y + this.uitgang.h + 10;
  }

  maakLevel() {
    this.terrainCtx.clearRect(0, 0, BREEDTE, HOOGTE);
    this.masker.fill(0);
    this.artPieces=[];

    // Hoofdgrond.
    this.vulRechthoek(0, 540, BREEDTE, 110, '#66564d');

    // Water- en lavakloof uitsnijden.
    for (const p of [...this.water, ...this.lava]) {
      this.verwijderRechthoek(p.x, 500, p.w, 150);
    }

    // Stenen muur die met Graver of Bombardier kan worden doorbroken.
    this.vulRechthoek(610, 422, 72, 118, '#514b58');

    // Een klein zwevend plateau als visueel obstakel / parachute-test.
    this.vulRechthoek(250, 355, 105, 18, '#5f5048');
    this.vulRechthoek(0,625,BREEDTE,25,'#52677a',2);
    for(const p of [...this.water,...this.lava]){for(let y=625;y<650;y++)this.masker.fill(0,y*BREEDTE+p.x,y*BREEDTE+p.x+p.w);this.terrainCtx.clearRect(p.x,625,p.w,25);}
    this.terrainCtx.fillStyle='#91a2b5';
    for(let x=0;x<BREEDTE;x+=24)if(this.masker[this.index(x,625)]===2)this.terrainCtx.fillRect(x,625,1,25);
    this.game.art.piece(this,10,385,180,1.3);
    this.game.art.piece(this,4,24,125,.8);
    this.game.art.piece(this,5,948,180,.8);
    if(this.game.art.loaded)this.game.art.repaint(this);
  }

  tekenAchtergrond(ctx,tijd) {ctx.fillStyle='#000';ctx.fillRect(0,0,BREEDTE,HOOGTE);}

  teken(ctx, tijd) {
    this.tekenAchtergrond(ctx, tijd);

    for(const p of this.water)this.game.art.liquid(ctx,p,tijd,false);
    for(const p of this.lava)this.game.art.liquid(ctx,p,tijd,true);

    ctx.drawImage(this.terrainCanvas, 0, 0);

    this.tekenStartEnUitgang(ctx);

  }

  tekenStartEnUitgang(ctx) {
    this.game.art.objects(ctx,this,this.game.simulatieTijd,this.game.spelGestart);
  }
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.lemmingSprites = new LemmingSpriteSheet();
    this.art = new TerrainArt();
    this.omgevingSprites = new SpriteSheet({url:null,frameBreedte:64,frameHoogte:64,frames:{}});
    this.geluid = new Geluid();

    this.totaal = 12;
    this.doel = 8;
    this.startTijd = 180;
    this.initieleReleaseRate = 20;
    this.minReleaseRate = 20;
    this.acties = {};
    this.geselecteerdeActie = 'bouwer';
    this.geselecteerdeLemmingIndex = -1;
    this.laatst = performance.now();
    this.spelGestart = false;
    this.afgelopen = false;
    this.gepauzeerd = true;
    this.partikels = [];
    this.simulatieTijd = 0;
    this.nukeKlikTijd = null;

    this.accumulator=0;this.speed=1;this.uiTimer=0;
    this.cacheDOM();
    this.bouwActieknoppen();
    this.dom.start.disabled=true;
    Promise.all([this.lemmingSprites.ready,this.art.ready]).then(()=>{this.reset(false);this.dom.start.disabled=false;this.tekenSkillIcons();}).catch(e=>this.dom.melding.textContent=e.message);
    this.koppelEvents();
    this.reset(false);
    requestAnimationFrame(t => this.loop(t));
  }

  cacheDOM() {
    this.dom = {
      skills: document.getElementById('skills'),
      pauze: document.getElementById('pauzeKnop'),
      herstart: document.getElementById('herstartKnop'),
      tempoMin: document.getElementById('tempoMinKnop'),
      tempoPlus: document.getElementById('tempoPlusKnop'),
      nuke: document.getElementById('nukeKnop'),
      start: document.getElementById('startKnop'),
      nogmaals: document.getElementById('nogmaalsKnop'),
      intro: document.getElementById('introOverlay'),
      eind: document.getElementById('eindOverlay'),
      eindTitel: document.getElementById('eindTitel'),
      eindTekst: document.getElementById('eindTekst'),
      melding: document.getElementById('melding'),
      levend: document.getElementById('statLevend'),
      gered: document.getElementById('statGered'),
      dood: document.getElementById('statDood'),
      doel: document.getElementById('statDoel'),
      tijd: document.getElementById('statTijd'),
      highscore: document.getElementById('statHighscore'),
      snel:document.getElementById('snelKnop'),geluid:document.getElementById('geluidKnop'),thema:document.getElementById('thema')
    };
  }

  bouwActieknoppen() {
    this.dom.skills.innerHTML = '';
    for (const [sleutel, definitie] of Object.entries(ACTIES)) {
      const knop = document.createElement('button');
      knop.type = 'button';
      knop.dataset.actie = sleutel;
      knop.innerHTML = `<canvas class="skill-icon" width="48" height="36" aria-hidden="true"></canvas><span class="toets">${definitie.toets}</span>${definitie.naam}<span class="aantal" data-aantal="${sleutel}"></span>`;
      knop.title=definitie.naam+' ('+definitie.toets+')';
      knop.addEventListener('click', () => this.selecteerActie(sleutel));
      this.dom.skills.appendChild(knop);
    }
  }

  koppelEvents() {
    this.dom.thema.addEventListener('change',()=>{this.art.theme=this.dom.thema.value;if(this.art.loaded)this.art.repaint(this.level);this.dom.melding.textContent=`Graphics: ${this.dom.thema.selectedOptions[0].textContent}.`;});
    this.canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.geluid.activeer();
      const rect = this.canvas.getBoundingClientRect();
      const scale=Math.min(rect.width/BREEDTE,rect.height/HOOGTE);
      const x=(e.clientX-rect.left-(rect.width-BREEDTE*scale)/2)/scale;
      const y=(e.clientY-rect.top-(rect.height-HOOGTE*scale)/2)/scale;
      this.klikLemming(x, y);
    });

    this.dom.snel.addEventListener('click',()=>{this.speed=this.speed===1?2:1;this.dom.snel.textContent='⏩ '+this.speed+'×';this.dom.snel.setAttribute('aria-pressed',String(this.speed===2));});
    this.dom.geluid.addEventListener('click',()=>{this.geluid.activeer();this.geluid.muted=!this.geluid.muted;this.dom.geluid.textContent=this.geluid.muted?'Geluid uit':'Geluid aan';this.dom.geluid.setAttribute('aria-pressed',String(!this.geluid.muted));});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.spelGestart&&!this.afgelopen&&!this.gepauzeerd)this.togglePauze();this.accumulator=0;this.laatst=performance.now();});
    this.dom.pauze.addEventListener('click', () => this.togglePauze());
    this.dom.herstart.addEventListener('click', () => this.reset(true));
    this.dom.tempoMin.addEventListener('click', () => this.wijzigReleaseRate(-5));
    this.dom.tempoPlus.addEventListener('click', () => this.wijzigReleaseRate(5));
    this.dom.nuke.addEventListener('click', () => this.vraagNuke());
    this.dom.start.addEventListener('click', () => this.start());
    this.dom.nogmaals.addEventListener('click', () => this.reset(true));

    window.addEventListener('keydown', e => {
      if (['INPUT', 'TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||e.repeat) return;
      if (e.key >= '1' && e.key <= '8') {
        const sleutel = Object.keys(ACTIES).find(k => ACTIES[k].toets === e.key);
        if (sleutel) this.selecteerActie(sleutel);
      } else if (e.key === ' ' || e.key.toLowerCase() === 'p') {
        e.preventDefault(); this.togglePauze();
      } else if (e.key.toLowerCase() === 'r') {
        this.reset(true);
      } else if (e.key === '+' || e.key === '=') {
        this.wijzigReleaseRate(5);
      } else if (e.key === '-' || e.key === '_') {
        this.wijzigReleaseRate(-5);
      } else if (e.key.toLowerCase() === 'n') {
        this.vraagNuke();
      } else if (e.key === 'Tab') {
        e.preventDefault(); this.selecteerVolgendeLemming();
      } else if (e.key === 'Enter' && document.activeElement?.tagName!=='BUTTON') {
        e.preventDefault();
        this.pasActieToeOpGeselecteerdeLemming();
      }
    });
  }

  reset(startDirect = false) {
    this.accumulator=0;this.nuking=false;this.nukeWachtrij=[];
    this.level = new Level(this);
    this.lemmingen = [];
    this.partikels = [];
    this.acties = Object.fromEntries(Object.entries(ACTIES).map(([k, v]) => [k, new Action(k, v)]));
    this.geselecteerdeActie = 'bouwer';
    this.geselecteerdeLemmingIndex = -1;
    this.volgendeId = 1;
    this.gespawned = 0;
    this.releaseRate = this.initieleReleaseRate;
    this.spawnTimer = .25;
    this.gered = 0;
    this.dood = 0;
    this.resterendeTijd = this.startTijd;
    this.afgelopen = false;
    this.spelGestart = startDirect;
    this.gepauzeerd = !startDirect;
    this.simulatieTijd = 0;
    this.tijdVerstreken = false;
    this.nukeKlikTijd = null;
    this.dom.eind.hidden = true;
    this.dom.intro.hidden = startDirect;
    this.dom.melding.textContent = startDirect ? 'Level gestart.' : 'Kies een skill en klik op een lemming.';
    this.dom.pauze.textContent = '⏸ Pauze';
    this.updateUI();
  }

  start() {
    if(!this.lemmingSprites.geladen||!this.art.loaded)return;
    this.geluid.activeer();
    this.spelGestart = true;
    this.gepauzeerd = false;
    this.dom.intro.hidden = true;
    this.canvas.focus({preventScroll:true});
    this.dom.melding.textContent = 'Breng minimaal 8 lemmingen naar de uitgang.';
  }

  togglePauze() {
    if (!this.spelGestart || this.afgelopen) return;
    this.gepauzeerd = !this.gepauzeerd;
    this.dom.pauze.textContent = this.gepauzeerd ? '▶ Verder' : '⏸ Pauze';
    this.dom.melding.textContent = this.gepauzeerd ? 'Spel gepauzeerd.' : 'Spel hervat.';
  }

  wijzigReleaseRate(delta) {
    if (!this.spelGestart || this.afgelopen) return;
    this.releaseRate = Math.max(this.minReleaseRate, Math.min(99, this.releaseRate + delta));
    this.dom.melding.textContent = `Release rate: ${this.releaseRate}.`;
    this.updateUI();
  }

  spawnInterval() {
    // Benadert de klassieke schaal 1–99; hoge release rate = korte wachttijd.
    return (4+Math.floor((99-this.releaseRate)/2))*TICK;
  }

  vraagNuke() {
    if (!this.spelGestart || this.afgelopen || this.gepauzeerd) return;
    const nu = performance.now();
    if (this.nukeKlikTijd!==null && nu - this.nukeKlikTijd < 850) {
      this.nukeKlikTijd = null;
      this.startNuke();
    } else {
      this.nukeKlikTijd = nu;
      this.dom.melding.textContent = 'Nuke bevestigen: klik nogmaals binnen 0,85 seconde.';
    }
  }

  startNuke() {
    if(this.nuking)return;
    this.nuking=true;
    this.nukeWachtrij=this.lemmingen.filter(l=>l.actief&&l.status!=='ohno'&&l.status!=='verdrinken');
    this.nukeVolgende();
    this.dom.melding.textContent = 'Nuke geactiveerd.';
  }

  nukeVolgende() {
    while(this.nukeWachtrij.length){
      const l=this.nukeWachtrij.shift();
      if(!l.actief||l.status==='ohno'||l.status==='verdrinken')continue;
      l.bomTimer=l.bomTimer===null?5:Math.min(l.bomTimer,5);
      break;
    }
  }

  selecteerActie(sleutel) {
    if (!this.acties[sleutel]) return;
    this.geselecteerdeActie = sleutel;
    this.updateUI();
    this.dom.melding.textContent = `${this.acties[sleutel].naam} geselecteerd. Klik op een lemming.`;
  }

  klikLemming(x, y) {
    if (!this.spelGestart || this.afgelopen) return;
    let beste = null;
    let afstand = 30;
    for (let i = 0; i < this.lemmingen.length; i++) {
      const l = this.lemmingen[i];
      if (!l.actief) continue;
      const d = Math.hypot(l.x - x, (l.y - 14) - y);
      if (d < afstand) { beste = { l, i }; afstand = d; }
    }
    if (!beste) {
      this.dom.melding.textContent = 'Geen lemming geraakt — klik iets dichter op een figuurtje.';
      return;
    }
    this.geselecteerdeLemmingIndex = beste.i;
    this.pasActieToe(beste.l);
  }

  selecteerVolgendeLemming() {
    this.canvas.focus({preventScroll:true});
    const actief = this.lemmingen.map((l, i) => ({ l, i })).filter(o => o.l.actief);
    if (!actief.length) return;
    const huidigePos = actief.findIndex(o => o.i === this.geselecteerdeLemmingIndex);
    const volgende = actief[(huidigePos + 1 + actief.length) % actief.length];
    this.geselecteerdeLemmingIndex = volgende.i;
    this.dom.melding.textContent = `Lemming #${volgende.l.id} geselecteerd. Druk Enter voor ${this.acties[this.geselecteerdeActie].naam}.`;
  }

  pasActieToeOpGeselecteerdeLemming() {
    const l = this.lemmingen[this.geselecteerdeLemmingIndex];
    if (l?.actief) this.pasActieToe(l);
  }

  pasActieToe(lemming) {
    const actie = this.acties[this.geselecteerdeActie];
    if (!actie || actie.aantal <= 0) {
      this.dom.melding.textContent = `Geen ${actie?.naam || 'skill'} meer beschikbaar.`;
      return;
    }

    if (lemming.wijsActieToe(this.geselecteerdeActie)) {
      actie.aantal--;
      this.dom.melding.textContent = `${actie.naam} toegewezen aan lemming #${lemming.id}.`;
      this.updateUI();
    } else {
      this.dom.melding.textContent = `${actie.naam} kan op dit moment niet op deze lemming worden gebruikt.`;
    }
  }

  spawnLemming() {
    if (this.gespawned >= this.totaal || this.tijdVerstreken || this.nuking) return;
    const spreiding = 0;
    const l = new Lemming(this, this.volgendeId++, this.level.start.x + 28 + spreiding, this.level.start.y + 20);
    this.lemmingen.push(l);
    this.gespawned++;
  }

  nabijeBlokkeerder(lemming) {
    return this.lemmingen.some(andere => {
      if (andere === lemming || !(andere.status==='blokkeren'||(andere.status==='ohno'&&andere.wasBlokkeerder&&andere.opGrond))) return false;
      const dx = andere.x - lemming.x;
      const zelfdeHoogte = Math.abs(andere.y - lemming.y) < 18;
      const ervoor = Math.sign(dx) === lemming.richting;
      return zelfdeHoogte && ervoor && Math.abs(dx) < 25;
    });
  }

  explodeer(lemming) {
    if (!lemming.actief) return;
    const straal = 36;
    this.level.verwijderCirkel(lemming.x, lemming.y - 10, straal);
    this.geluid.explosie();

    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 70 + Math.random() * 190;
      this.partikels.push({
        x: lemming.x, y: lemming.y - 10,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        leven: .55 + Math.random() * .35
      });
    }
    // Bomber vernietigt zichzelf, maar beschadigt andere lemmingen niet.
    lemming.sterf('explosie');
  }

  lemmingGered() {
    this.gered++;
    this.geluid.toon('gered');
    this.dom.melding.textContent = `Gered! ${this.gered}/${this.doel} nodig.`;
  }

  lemmingDood(_lemming, reden) {
    this.dood++;
    this.geluid.toon('dood');
    const teksten = {
      lava: 'Een lemming viel in de lava.',
      water: 'Een lemming is verdronken.',
      val: 'Een lemming viel te pletter.',
      explosie: 'Bomber ontploft.'
    };
    this.dom.melding.textContent = teksten[reden] || 'Een lemming is verloren.';
  }

  update(dt) {
    if (!this.spelGestart || this.gepauzeerd || this.afgelopen) return;

    this.simulatieTijd += dt;

    this.resterendeTijd = Math.max(0, this.resterendeTijd - dt);
    if (this.resterendeTijd <= 0) {
      this.tijdVerstreken=true;
      this.eindig(this.gered>=this.doel,'De tijd is verstreken.');
      this.updateUI();return;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.gespawned < this.totaal) {
      this.spawnLemming();
      this.spawnTimer = this.spawnInterval();
    }

    for (const l of this.lemmingen) l.update(dt);
    if(this.nuking)this.nukeVolgende();

    for (const p of this.partikels) {
      p.leven -= dt;
      p.vy += 360 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.partikels = this.partikels.filter(p => p.leven > 0);

    this.controleerEinde();
    this.uiTimer+=dt;if(this.uiTimer>=.12){this.uiTimer=0;this.updateUI();}
  }

  controleerEinde() {
    const verwerkt = this.gered + this.dood;
    const iedereenKlaar = (this.gespawned >= this.totaal || this.nuking) && verwerkt >= this.gespawned;
    if (iedereenKlaar) this.eindig(this.gered >= this.doel, 'Alle lemmingen zijn verwerkt.');
    // Bewust géén vroegtijdig game-over wanneer het doel onhaalbaar wordt: in het
    // origineel kan het level doorlopen en kan de speler desgewenst Nuke gebruiken.
  }

  berekenScore() {
    const ongebruikteActies = Object.values(this.acties).reduce((som, a) => som + a.aantal, 0);
    return Math.max(0, Math.round(this.gered * 1000 + this.resterendeTijd * 10 + ongebruikteActies * 35));
  }

  leesHighscore() {
    try { return Number(localStorage.getItem('lemmingRescueHighscore') || 0); }
    catch (_) { return 0; }
  }

  schrijfHighscore(score) {
    try { localStorage.setItem('lemmingRescueHighscore', String(score)); }
    catch (_) { /* Browser blokkeert opslag; gameplay blijft gewoon werken. */ }
  }

  eindig(gewonnen, reden) {
    if (this.afgelopen) return;
    this.afgelopen = true;
    this.gepauzeerd = true;
    const score = this.berekenScore();

    if (gewonnen) {
      const beste = this.leesHighscore();
      if (score > beste) this.schrijfHighscore(score);
      this.dom.eindTitel.textContent = 'Level voltooid!';
      this.dom.eindTekst.textContent = `${reden} Je redde ${this.gered} van de ${this.totaal} lemmingen. Score: ${score}.`;
    } else {
      this.dom.eindTitel.textContent = 'Level mislukt';
      this.dom.eindTekst.textContent = `${reden} Je redde ${this.gered} van de ${this.totaal} lemmingen; het doel was ${this.doel}.`;
    }
    this.dom.eind.hidden = false;
    this.updateUI();
  }

  updateUI() {
    const actiefOpVeld = this.lemmingen.filter(l => l.actief).length;
    const nogTeSpawnen = Math.max(0, this.totaal - this.gespawned);
    this.dom.levend.textContent = String(actiefOpVeld + nogTeSpawnen);
    this.dom.gered.textContent = String(this.gered);
    this.dom.dood.textContent = String(this.dood);
    this.dom.doel.textContent = `${this.doel}/${this.totaal}`;

    const sec = Math.max(0, Math.ceil(this.resterendeTijd));
    const min = Math.floor(sec / 60).toString().padStart(2, '0');
    const rest = (sec % 60).toString().padStart(2, '0');
    this.dom.tijd.textContent = `${min}:${rest}`;
    this.dom.highscore.textContent = String(this.leesHighscore());
    this.dom.tempoMin.textContent = `− RR ${this.releaseRate}`;
    this.dom.tempoPlus.textContent = `+ RR ${this.releaseRate}`;
    this.dom.tempoMin.setAttribute('aria-label',`Verlaag instroom, release rate ${this.releaseRate}`);
    this.dom.tempoPlus.setAttribute('aria-label',`Verhoog instroom, release rate ${this.releaseRate}`);
    this.dom.tempoMin.disabled = this.releaseRate <= this.minReleaseRate || this.afgelopen;
    this.dom.tempoPlus.disabled = this.releaseRate >= 99 || this.afgelopen;

    for (const [sleutel, actie] of Object.entries(this.acties)) {
      const knop = this.dom.skills.querySelector(`[data-actie="${sleutel}"]`);
      const aantal = this.dom.skills.querySelector(`[data-aantal="${sleutel}"]`);
      if (knop) {
        knop.classList.toggle('actief', sleutel === this.geselecteerdeActie);
        knop.setAttribute('aria-pressed',String(sleutel===this.geselecteerdeActie));
        knop.disabled = actie.aantal <= 0;
      }
      if (aantal) aantal.textContent = `×${actie.aantal}`;
    }
  }

  teken() {
    this.level.teken(this.ctx, this.simulatieTijd);

    for (let i = 0; i < this.lemmingen.length; i++) {
      const l = this.lemmingen[i];
      l.teken(this.ctx, i === this.geselecteerdeLemmingIndex && l.actief);
    }

    for (const p of this.partikels) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.leven / .8);
      this.ctx.fillStyle = '#ffd36a';
      this.ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      this.ctx.restore();
    }

    if (this.gepauzeerd && this.spelGestart && !this.afgelopen) {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(4,7,12,.38)';
      this.ctx.fillRect(0, 0, BREEDTE, HOOGTE);
      this.ctx.fillStyle = '#fff';
      this.ctx.textAlign = 'center';
      this.ctx.font = '900 42px system-ui';
      this.ctx.fillText('GEPAUZEERD', BREEDTE / 2, HOOGTE / 2);
      this.ctx.restore();
    }
  }

  tekenSkillIcons() {
    const names=['klimmen','parachute','ohno','blokkeren','bouwen','bashen','mijnen','graven'];
    this.dom.skills.querySelectorAll('canvas').forEach((c,i)=>{const ctx=c.getContext('2d');ctx.clearRect(0,0,48,36);this.lemmingSprites.teken(ctx,names[i],.3,24,34,2);});
  }
  advance(dt) {
    if(this.spelGestart&&!this.gepauzeerd&&!this.afgelopen){
      this.accumulator+=dt*this.speed;
      while(this.accumulator+1e-9>=TICK){this.update(TICK);this.accumulator-=TICK;}
    }else this.accumulator=0;
  }
  loop(nu) {
    const dt=Math.max(0,Math.min((nu-this.laatst)/1000,.25));this.laatst=nu;
    this.advance(dt);this.teken();requestAnimationFrame(t=>this.loop(t));
  }
}

export {Game, Level, ACTIES};
export const game=document.getElementById('gameCanvas')?new Game(document.getElementById('gameCanvas')):null;
if(game){
  game.geluid.muted=true;
  const model=document.modelContext;
  if(model?.registerTool){
    const lifetime=new AbortController();
    const register=(tool)=>{try{Promise.resolve(model.registerTool(tool,{signal:lifetime.signal})).catch(()=>{});}catch{}};
    register({name:'read_game_state',title:'Spelstatus lezen',description:'Read the visible Lemming Rescue status and skill inventory.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({saved:game.gered,lost:game.dood,time:Math.ceil(game.resterendeTijd),paused:game.gepauzeerd,skill:game.geselecteerdeActie,inventory:Object.fromEntries(Object.entries(game.acties).map(([key,a])=>[key,a.aantal]))})});
    register({name:'select_game_skill',title:'Skill selecteren',description:'Select one skill, like its visible toolbar button. Does not assign it to a lemming.',inputSchema:{type:'object',properties:{skill:{type:'string',enum:Object.keys(ACTIES)}},required:['skill'],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input)=>{if(!input||!ACTIES[input.skill]||Object.keys(input).length!==1)throw new Error('Onbekende skill');game.selecteerActie(input.skill);return{skill:game.geselecteerdeActie};}});
    window.addEventListener('pagehide',()=>lifetime.abort(),{once:true});
  }
}
