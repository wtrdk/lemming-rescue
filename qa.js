import {ClassicAssets, Terrain} from './classic-assets.js';
import {Engine} from './engine.js';
import {NativeLemming,TICK,SKILLS} from './lemming-native.js';
import {NativeSprites} from './native-sprites.js';
import {ATLAS} from './sprites.js';
import {validReplay} from './server/progress.js';
const out=document.querySelector('#results'),status=document.querySelector('#status'),run=document.querySelector('#run');
const assets=new ClassicAssets(),sprites=new NativeSprites();
function assert(x,message){if(!x)throw Error(message);}
function solidCount(t){let n=0;for(const p of t.mask)n+=p;return n;}
function flat(){const base=assets.levels[0],d={...base,id:'fixture',name:'fixture',total:1,required:1,releaseRate:50,timeSeconds:300,skills:[1,1,1,1,1,1,1,1],width:400,height:160,terrain:[],steel:[],objects:[]};const e=new Engine(d,assets);for(let x=0;x<400;x++){const i=100*400+x;e.level.mask[i]=1;e.level.colors[i]=e.level.style.brickColor;}e.level.dirty=true;e.level.flush();return e;}
function walker(e,x=100,y=100){const l=new NativeLemming(1,x,y);l.change('walking');e.entities=[l];e.spawned=1;e.data.total=1;return l;}
let spriteReference;
async function originalSprites(){return spriteReference??=await fetch('/qa-fixtures/sprite-reference.json').then(r=>r.json());}
function spriteCanvas(){const c=document.createElement('canvas');c.width=c.height=96;return c.getContext('2d',{willReadFrequently:true});}
function matchesOriginal(ctx,ref,frame,label){
  const rgba=ctx.getImageData(0,0,96,96).data,bits=ref.frames[frame];
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){
    const xx=x-32-ref.offsetX,yy=y-48-ref.offsetY;
    const expected=xx>=0&&xx<ref.width&&yy>=0&&yy<ref.height&&bits[yy*ref.width+xx]==='1';
    assert((rgba[(y*96+x)*4+3]>0)===Boolean(expected),`${label}: afwijkende originele spritepixel op ${x},${y}.`);
  }
}
async function execute(){out.textContent='';status.textContent='Tests draaien…';status.className='';let pass=0,fail=0;
async function test(name,fn){try{await fn();out.textContent+=`PASS  ${name}\n`;pass++;}catch(e){out.textContent+=`FAIL  ${name}\n      ${e.message}\n      ${String(e.stack).split('\n').slice(1,3).join('\n')}\n`;fail++;}}
await Promise.all([assets.ready,sprites.nativeReady]);
await test('Alle 120 originele Amiga-levels staan in volgorde met juiste Fun-intro',()=>{assert(assets.levels.length===120,'Verwacht 120 levels.');for(const [i,rating] of ['Fun','Tricky','Taxing','Mayhem'].entries()){const group=assets.levels.slice(i*30,(i+1)*30);assert(group.length===30&&group.every((x,n)=>x.rating===rating&&x.number===n+1),`${rating} heeft geen complete levelvolgorde.`);}assert(assets.levels.slice(0,5).map(x=>x.id).join(',')==='fun-1,fun-2,fun-3,fun-4,fun-5','Amiga Fun-volgorde wijkt af.');assert(assets.levels[0].name==='Just dig!'&&assets.levels[29].rating==='Fun'&&assets.levels.at(-1).id==='mayhem-30','Campagnetitels of eindlevel ontbreken.');assert(assets.levels[3].releaseRate===1&&assets.levels[2].total===50&&assets.levels[4].skills[5]===50,'Amiga-budget of instroomsnelheid ontbreekt.');});
await test('Amiga-titels, 80 gedeelde plattegronden en 42 alternatieve levelprofielen kloppen',()=>{assert(assets.levels[7].name==='Not as complicated as it looks','Fun 8 mist de Amiga-varianttitel.');assert(assets.levels[11].name==='Patience','Fun 12 mist de Amiga-varianttitel.');assert(assets.levels[60].name==="If at first you don't succeed.."&&assets.levels[119].name==='Rendezvous at the Mountain','Taxing- of Mayhem-titels wijken af.');assert(new Set(assets.levels.map(x=>x.sourceFile)).size===80,'Verwacht 80 unieke Amiga-singleplayerplattegronden.');assert(assets.levels.filter(x=>x.source?.includes('alternate profile')).length===42,'Niet alle Amiga-profielen uit de odd table zijn toegepast.');});
await test('Alle 120 levelrecords kunnen door de Amiga-renderer worden opgebouwd',()=>{for(const d of assets.levels){const e=new Engine(d,assets);assert(e.level.width===d.width&&e.level.objects.length===d.objects.length,`${d.id} kon niet geladen worden.`);e.step();}});
await test('Alle vijf Amiga-paletstijlen, stukken en objecten geladen',()=>{assert(assets.styles.length===5,'Niet alle stijlen laden.');for(const s of assets.styles)assert(s.terrain.length>20&&s.objects.length>4,'Stijl '+s.id+' mist pieces of objects.');});
await test('Amiga-vernietigingsmaskers voor Bash, Mine en Bomber',()=>{for(const n of ['bash-right','bash-left','mine-right','mine-left','explode'])assert(assets.masks[n]?.frames?.length,'Ontbrekend masker '+n);assert(assets.masks['bash-right'].width===16&&assets.masks.explode.height===22,'Maskerafmetingen wijken af.');});
await test('Aangeleverde spritesheet en extra Amiga-sprites decoderen',()=>{assert(sprites.bronCanvas.width===320&&sprites.bronCanvas.height===374,'De aangeleverde spritesheet heeft onverwachte afmetingen.');assert(sprites.extraFrames['jump-right']&&sprites.extraFrames.explosion,'Spring- of explosiesprites ontbreken.');});
await test('Alle uitgesneden animatieframes vallen binnen hun bronafbeelding',()=>{for(const [name,dirs]of Object.entries(ATLAS))for(const fs of Object.values(dirs))for(const f of fs){const image=sprites.imageForFrame(f),w=image.width,h=image.height;assert(f.x>=0&&f.y>=0&&f.x+f.w<=w&&f.y+f.h<=h,`${name} loopt buiten de bronafbeelding.`);}});
await test('Alle 337 originele Amiga-framevormen en voetankers kloppen in de game-renderers',async()=>{
  const fixture=await originalSprites(),ctx=spriteCanvas();let checked=0;
  for(const ref of fixture.animations){
    if(ref.atlas)assert(ATLAS[ref.atlas][ref.direction==='left'?'left':'right'].length===ref.frames.length,`${ref.name}: verkeerd aantal frames.`);
    for(let frame=0;frame<ref.frames.length;frame++){
      ctx.clearRect(0,0,96,96);
      if(ref.atlas)sprites.frame(ctx,ref.atlas,frame,32,48,ref.direction==='left');else sprites.extraDraw(ctx,ref.name,32,48);
      matchesOriginal(ctx,ref,frame,`${ref.name} frame ${frame}`);checked++;
      if(ref.atlas){ctx.clearRect(0,0,96,96);sprites.teken(ctx,ref.atlas,frame/17,32,48,1,ref.direction==='left');matchesOriginal(ctx,ref,frame,`Puzzelrenderer ${ref.name} frame ${frame}`);}
    }
  }assert(checked===337,`Er werden slechts ${checked} originele frames gecontroleerd.`);
});
await test('Iedere spelactie toont de bijbehorende originele animatie in beide richtingen',async()=>{
  const fixture=await originalSprites(),ctx=spriteCanvas();
  const actions={walking:'walk',falling:'fall',climbing:'climb',hoisting:'hoist',floating:'float',building:'build',shrugging:'shrug',bashing:'bash',mining:'mine',digging:'dig',blocking:'block',ohno:'ohno',drowning:'drown',fried:'fire',splat:'splat',exiting:'exit',jumping:'jump'};
  for(const [state,name]of Object.entries(actions))for(const dir of [1,-1]){
    const ref=fixture.animations.find(a=>a.name===name+(state==='jumping'?(dir===1?'-right':'-left'):(['walk','fall','climb','hoist','float','build','shrug','bash','mine'].includes(name)?dir===1?'-r':'-l':'')));
    assert(ref,`Originele referentie voor ${state} ontbreekt.`);const l=new NativeLemming(1,32,48);l.change(state);l.dir=dir;
    ctx.clearRect(0,0,96,96);sprites.draw(ctx,l,0,assets);matchesOriginal(ctx,ref,0,`${state} richting ${dir}`);
  }
});
await test('Entree en lange val tonen de vier originele valframes en gaan daarna lopen',async()=>{
  const fixture=await originalSprites(),ctx=spriteCanvas(),ref=fixture.animations.find(a=>a.name==='fall-r');
  const e=flat(),l=new NativeLemming(1,100,30);e.entities=[l];e.spawned=1;let checked=0;
  while(l.state==='falling'&&checked<30){
    ctx.clearRect(0,0,96,96);sprites.draw(ctx,{...l,x:32,y:48},e.tick,assets);matchesOriginal(ctx,ref,l.frame%4,`Lange val tick ${checked}`);checked++;l.step(e);
  }assert(checked>16&&l.state==='splat','De lange val doorliep de valanimatie niet tot de landing.');
  const short=flat(),safe=new NativeLemming(2,100,70);let steps=0;
  while(safe.state==='falling'&&steps++<30)safe.step(short);
  assert(safe.state==='walking','Een korte veilige val ging niet over in lopen.');
  ctx.clearRect(0,0,96,96);sprites.draw(ctx,{...safe,x:32,y:48},0,assets);matchesOriginal(ctx,fixture.animations.find(a=>a.name==='walk-r'),0,'Lopen na veilige landing');
  const entrance=new Engine(assets.levels[0],assets);while(!entrance.entities.length&&entrance.tick<100)entrance.step();
  const spawned=entrance.entities[0];assert(spawned?.state==='falling','Entreefixture laat geen lemming vallen.');
  ctx.clearRect(0,0,96,96);sprites.draw(ctx,{...spawned,x:32,y:48},entrance.tick,assets);matchesOriginal(ctx,ref,spawned.frame%4,'Vallen uit de ingang');
});
await test('Parachute opent eenmaal en blijft daarna de vier oorspronkelijke zweefframes afspelen',async()=>{
  const fixture=await originalSprites(),ctx=spriteCanvas(),l=new NativeLemming(1,32,48);l.change('floating');
  for(const dir of [1,-1]){l.dir=dir;const ref=fixture.animations.find(a=>a.name===`float-${dir===1?'r':'l'}`);
    for(const [tick,frame]of [[0,0],[1,1],[2,2],[3,3],[4,4],[5,5],[6,6],[7,7],[8,4],[20,4],[21,5],[22,6],[23,7],[24,4]]){
      l.frame=tick;l.floatTick=tick+1;ctx.clearRect(0,0,96,96);sprites.draw(ctx,l,tick,assets);matchesOriginal(ctx,ref,frame,`Parachute ${dir} tick ${tick}`);
    }
  }
});
await test('Eindige dood- en uitgangsanimaties verdwijnen na hun laatste originele frame',()=>{
  const ctx=spriteCanvas();for(const [state,count]of [['drowning',16],['fried',14],['splat',16],['exiting',8]]){
    const l=new NativeLemming(1,32,48);l.change(state);l.frame=count;l.age=count;
    ctx.clearRect(0,0,96,96);sprites.draw(ctx,l,count,assets);assert(!ctx.getImageData(0,0,96,96).data.some((v,i)=>i%4===3&&v),`${state} bleef na het laatste frame staan.`);
  }
});
await test('Lemmini loopt over kleine opstapjes en keert bij een muur',()=>{const e=flat(),l=walker(e);for(let y=93;y<100;y++)e.level.mask[y*400+110]=1;l.step(e);assert(l.x===101&&l.y===100,'Kleine opstap verhinderde het lopen.');for(let y=80;y<100;y++)e.level.mask[y*400+102]=1;l.step(e);assert(l.dir===-1,'Lemmini liep door een hoge muur.');});
await test('Builder legt de eerste echte pixelstenen op animatiefase 9',()=>{const e=flat(),l=walker(e,100,100);l.assign(4,e);const before=solidCount(e.level);for(let i=0;i<8;i++)l.step(e);assert(solidCount(e.level)===before,'Een steen verscheen voor het juiste frame.');l.step(e);assert(solidCount(e.level)>before,'De eerste steen ontbrak op frame 9.');});
await test('Staal blokkeert iedere destructiemaskerpixel',()=>{const e=flat();for(let y=89;y<111;y++)for(let x=112;x<128;x++){const i=y*400+x;e.level.mask[i]=1;e.level.steel[i]=1;}const n=solidCount(e.level);const r=e.level.applyMask('explode',0,112,89,0,'bomb');assert(r.blocked>0&&solidCount(e.level)===n,`Een explosie verwijderde staal: ${JSON.stringify(r)}, ${n}→${solidCount(e.level)}.`);});
await test('One-way terrein laat graven alleen in de klassieke richting toe',()=>{const e=flat();for(let x=120;x<130;x++){const i=100*400+x;e.level.oneWay[i]=1;}assert(e.level.clearPixel(124,100,-1,'bash')===-1,'Tegen de pijl in kon bashen.');assert(e.level.clearPixel(125,100,1,'bash')===1,'Met de pijl mee kon bashen niet.');});
await test('Bomber: vijf seconden, oh-no animatie, één explosie en één verlies',()=>{const e=flat(),l=walker(e,100,100);l.assign(2,e);for(let i=0;i<Math.ceil(5/TICK);i++)e.step();assert(l.state==='ohno','Bomber startte de oh-no-fase niet na vijf seconden.');for(let i=0;i<16;i++)e.step();assert(l.state==='dead'&&e.dead===1,'Bomber verwijderde zichzelf niet na oh-no.');const events=e.drainEvents().filter(x=>x.type==='explode');assert(events.length===1,'Explosie werd niet precies eenmaal gemeld.');assert(solidCount(e.level)<400,'De explosie maakte geen gat.');});
await test('Basher verwijdert een volle wand en loopt aan de andere kant door',()=>{const e=flat(),l=walker(e,110,100);for(let y=68;y<100;y++)for(let x=120;x<124;x++){const i=y*400+x;e.level.mask[i]=1;e.level.colors[i]=e.level.style.brickColor;}e.level.dirty=true;e.level.flush();l.assign(5,e);for(let i=0;i<220&&l.x<130;i++)l.step(e);assert(l.x>=124&&solidCount(e.level)<528,`Basher kwam niet door: x=${l.x}, state=${l.state}, wandpixels=${solidCount(e.level)}.`);});
await test('Graver maakt een opening en valt daarna door de vloer',()=>{const e=flat(),l=walker(e,100,100);l.assign(7,e);for(let i=0;i<20;i++)l.step(e);assert(!e.level.solid(100,100),'Digger liet de grond intact.');assert(l.y>100||l.state==='falling','Digger viel niet door het gat.');});
await test('Blokker stopt de groep en keert volgende lemmingen om',()=>{const e=flat(),b=walker(e,104,100);b.change('blocking');const l=new NativeLemming(2,100,100);l.change('walking');assert(e.blockedByLemming(l),'Een blocker hield de volgende lemming niet tegen.');l.step(e);assert(l.dir===-1,'De volgende lemming keerde niet om.');});
await test('Waterval- en exit-trigger gebruiken echte Amiga-triggerrechthoeken',()=>{const d=assets.levels[0],e=new Engine(d,assets);const exit=e.level.objects.find(p=>p.meta?.kind==='exit');assert(exit,'Level mist de uitgang.');const r=e.level.triggerRect(exit),l=walker(e,r.x+Math.floor(r.w/2),r.y+Math.floor(r.h/2));e.trigger(l);assert(e.saved===1&&l.state==='exiting','Uitgang redde de lemming niet.');});
await test('Klassieke skills blijven permanent of beperkt tot hun juiste toestanden',()=>{assert(SKILLS.length===8,'Niet alle acht skills zijn aanwezig.');const e=flat(),l=walker(e);assert(l.assign(0,e)&&l.climber,'Climber is niet permanent toegewezen.');assert(!l.assign(0,e),'Climber kon tweemaal worden toegewezen.');assert(l.assign(1,e)&&l.floater,'Floater is niet permanent toegewezen.');assert(l.assign(2,e)&&l.bomb!==null,'Bomber kon niet worden toegewezen.');assert(!l.assign(2,e),'Lemming kreeg meer dan één Bomber.');});
await test('Replay voert opdrachten op dezelfde tick uit en reproduceert checksum',()=>{const a=new Engine(assets.levels[1],assets);while(a.tick<46)a.step();assert(a.entities.length,'Replayfixture spawn mislukte.');assert(a.command({type:'skill',lemming:1,skill:1}),'Floater-opdracht mislukte.');while(a.tick<190)a.step();const r=a.exportReplay();const b=new Engine(assets.levels[1],assets);b.replay=r;while(b.tick<r.ticks)b.step();assert(b.digest()===r.checksum,`Checksum ${b.digest()} wijkt af van ${r.checksum}.`);});
await test('Practice snapshot herstelt terraingaten en de simulatiestand',()=>{const e=flat(),l=walker(e);l.assign(7,e);for(let i=0;i<20;i++)e.step();const s=e.snapshot(),digest=e.digest();for(let i=0;i<20;i++)e.step();e.restore(s);assert(e.digest()===digest,'Herstel zette de simulatie niet terug.');});
await test('Origineel Fun 1 is met één strategische Digger te halen',()=>{let solvedAt=null;for(const target of [760,780,800,820,840,860,880,900]){const e=new Engine(assets.levels[0],assets);let issued=false;for(let n=0;n<6000&&!e.finished&&!e.success;n++){for(const l of e.live)if(!issued&&l.state==='walking'&&l.x>=target&&e.command({type:'skill',lemming:l.id,skill:7}))issued=true;e.step();}if(e.success){solvedAt=target;break;}}assert(solvedAt!==null,`Geen testoplossing gevonden; geprobeerd tot x=${[760,780,800,820,840,860,880,900].at(-1)}.`);});
await test('Origineel Fun 2 laat alle lemmings met Floaters veilig landen',()=>{const e=new Engine(assets.levels[1],assets);let guard=0;while(!e.finished&&guard++<6000){for(const l of e.live)if(e.skills[1]&&l.state==='falling')e.command({type:'skill',lemming:l.id,skill:1});e.step();}assert(e.saved>=assets.levels[1].required,`Fun 2 redde ${e.saved}/${e.data.total}; ${e.dead} stierven.`);});
await test('Origineel Fun 3 kan met Blockers minimaal het doel redden',()=>{const e=new Engine(assets.levels[2],assets);let guard=0;while(!e.finished&&!e.success&&guard++<7000){for(const l of e.live)if(l.state==='walking'&&e.skills[3]){let fatal=false;for(let d=1;d<=8;d++){const x=l.x+l.dir*d;if(e.level.solid(x,l.y))continue;let drop=0;while(drop<=64&&!e.level.solid(x,l.y+drop))drop++;if(drop>63)fatal=true;break;}if(fatal)e.command({type:'skill',lemming:l.id,skill:3});}e.step();}assert(e.saved>=assets.levels[2].required,`Dynamische blockerroute redde ${e.saved}/${e.data.total}; ${e.dead} dood.`);});
await test('Origineel Fun 4 is met Climbers en de ene Miner te halen',()=>{let best=0;for(const target of [650,670,690,710,730,750,770,790,810]){const e=new Engine(assets.levels[3],assets),climbed=new Set();let mined=false;for(let n=0;n<9000&&!e.finished&&!e.success;n++){for(const l of e.live){if(e.skills[0]&&!climbed.has(l.id)&&e.command({type:'skill',lemming:l.id,skill:0}))climbed.add(l.id);if(!mined&&l.state==='walking'&&l.x>=target&&e.command({type:'skill',lemming:l.id,skill:6}))mined=true;}e.step();}best=Math.max(best,e.saved);}assert(best>=assets.levels[3].required,`Geen minerroute redde alle lemmings; beste ${best}.`);});
await test('Origineel Fun 5 kan met Bashers door de oorspronkelijke muren',()=>{const e=new Engine(assets.levels[4],assets);let guard=0;while(!e.finished&&guard++<9000){for(const l of e.live)if(l.state==='walking'&&e.skills[5]){let wall=false;for(let i=8;i<=11;i++)wall||=e.level.solid(l.x+l.dir*i,l.y-6);if(wall)e.command({type:'skill',lemming:l.id,skill:5});}e.step();}assert(e.saved>=assets.levels[4].required,`Fun 5 redde ${e.saved}/${e.data.total}; ${e.dead} dood; ${e.spawned} uit; tick ${e.tick}; states ${JSON.stringify(e.entities.slice(-8).map(l=>[l.id,l.x,l.y,l.state,l.deathReason]))}.`);});
await test('Progress-API ondersteunt alle 120 level-ID’s en weigert ongeldige records',async()=>{const g=await fetch('/api/progress');assert(g.ok,'Voortgangs-API is niet beschikbaar.');const b=await g.json();assert(Array.isArray(b.progress),'API gaf geen voortgangslijst.');const bad=await fetch('/api/progress',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({levelId:'mayhem-30',saved:-1,total:10,completed:false,ticks:0,replay:{}})});assert(bad.status===400,'API accepteerde negatieve scores.');});
await test('Water, vuur en traps gebruiken eigen Amiga-triggers en cooldown',()=>{for(const kind of ['water','fire']){const style=assets.styles.find(s=>s.objects.some(o=>o.kind===kind));assert(style,`Geen style met ${kind}: ${JSON.stringify(assets.styles.map(s=>s.objects.map(o=>o.kind)))}`);const meta=style.objects.find(o=>o.kind===kind),base=assets.levels[0],d={...base,style:style.id,width:400,height:160,terrain:[],steel:[],objects:[{id:meta.id,x:150,y:80}]},e=new Engine(d,assets),p=e.level.objects[0],r=e.level.triggerRect(p),l=walker(e,r.x+1,r.y+1);e.trigger(l);assert(e.dead===1,`${kind} doodde niet via de trigger.`);}const style=assets.styles.find(s=>s.objects.some(o=>o.kind==='trap'));assert(style,'Trapstyle ontbreekt.');const meta=style.objects.find(o=>o.kind==='trap'),base=assets.levels[0],d={...base,style:style.id,width:400,height:160,terrain:[],steel:[],objects:[{id:meta.id,x:150,y:80}]},e=new Engine(d,assets),p=e.level.objects[0],r=e.level.triggerRect(p),a=walker(e,r.x+1,r.y+1);e.trigger(a);const b=new NativeLemming(2,r.x+1,r.y+1);b.change('walking');e.entities.push(b);e.trigger(b);assert(e.dead===1&&p.busy===meta.frames.length&&b.alive,'Trap trigger/cooldown werkte niet.');});
await test('Nuke bombardeert de actieve groep na elk eigen aftellen',()=>{const e=flat(),a=walker(e,100,100),b=new NativeLemming(2,130,100);b.change('walking');e.entities.push(b);e.spawned=2;e.data.total=2;assert(e.command({type:'nuke'}),'Nuke-opdracht werd geweigerd.');for(let i=0;i<260&&!e.finished;i++)e.step();assert(e.dead===2&&e.entities.every(x=>x.state==='dead'),'Nuke stopte niet na twee afzonderlijke bommers.');});
await test('Tijdslimiet beëindigt een poging zonder de speler te nukeren',()=>{const e=flat();e.data.timeSeconds=1;walker(e,100,100);for(let i=0;i<30&&!e.finished;i++)e.step();assert(e.finished&&e.endReason==='time'&&!e.nuking,'Timer eindigde niet onafhankelijk van Nuke.');});
await test('Originele Amiga-muziek en effecten zijn bereikbaar',async()=>{for(const f of ['/assets/audio/music/orig_01_cancan_amiga.ogg','/assets/audio/music/orig_05_tim8_amiga.ogg','/assets/audio/sfx/splash.wav','/assets/audio/sfx/explode.wav']){const r=await fetch(f,{method:'HEAD'});assert(r.ok,'Audiobestand mist: '+f);}});
status.textContent=`${pass} geslaagd · ${fail} mislukt`;status.className=fail?'fail':'pass';
}
run.addEventListener('click',()=>execute().catch(e=>{status.textContent='Testfout: '+e.message;status.className='fail';out.textContent+=e.stack||'';}));
