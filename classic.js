import {ClassicAssets} from './classic-assets.js';
import {Engine} from './engine.js';
import {NativeSprites} from './native-sprites.js';
import {GameAudio} from './audio.js';
import {validReplay} from './server/progress.js';
import {TICK,SKILLS} from './lemming-native.js';

const $=id=>document.getElementById(id),canvas=$('gameCanvas'),ctx=canvas.getContext('2d',{alpha:false}),mini=$('minimap'),mctx=mini.getContext('2d');
const names=['Klimmer','Zwever','Bomber','Blokkeren','Bouwer','Basher','Mijnwerker','Graver'];
const animation=['klimmen','parachute','ohno','blokkeren','bouwen','bashen','mijnen','graven'];
const store={read(k,fallback){try{return localStorage.getItem(k)??fallback}catch{return fallback}},write(k,v){try{localStorage.setItem(k,v)}catch{}}};
const assets=new ClassicAssets(),sprites=new NativeSprites();
let engine=null,data=null,levelIndex=0,selectedSkill=-1,selectedId=null,hoverId=null,paused=true,speed=1,started=false,watching=false,practiceUsed=false;
let cameraX=0,cameraY=0,zoom=1,lastTime=0,accumulator=0,frames=0,frameClock=0,lastNuke=0,latestReplay=null,progress={},pendingSave=null,saveBusy=false;
let snapshots=[],lastSnapshot=-1,handlesEnd=false,importedReplay=null,pointers=new Map(),pinch=null,drag=null,edgeScroll=0;
const audio=new GameAudio(message=>say(message));
const goalPct=d=>Math.ceil(d.required*100/d.total);
function say(message,error=false){const n=$('melding');n.textContent=message;n.classList.toggle('error',error);}
function loadPreference(){
  audio.effects=store.read('lr-effects','on')==='on';audio.musicEnabled=store.read('lr-music','off')==='on';audio.setVolume(Number(store.read('lr-volume','45'))/100);
  $('effects').setAttribute('aria-pressed',String(audio.effects));$('effects').textContent='Effecten '+(audio.effects?'aan':'uit');
  $('music').setAttribute('aria-pressed',String(audio.musicEnabled));$('music').textContent='Muziek '+(audio.musicEnabled?'aan':'uit');$('volume').value=Math.round(audio.volume*100);
}
function renderSkillButtons(){
  const root=$('skills');root.replaceChildren();
  SKILLS.forEach((_,i)=>{
    const b=document.createElement('button');b.type='button';b.dataset.skill=i;b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',`${names[i]}: 0 beschikbaar`);
    const key=document.createElement('span');key.className='skill-key';key.textContent=String(i+1);
    const icon=document.createElement('canvas');icon.width=32;icon.height=26;icon.className='skill-picture';icon.setAttribute('aria-hidden','true');
    const count=document.createElement('span');count.className='skill-count';count.textContent='0';
    const label=document.createElement('span');label.className='skill-name';label.textContent=names[i];
    b.append(key,icon,count,label);b.addEventListener('click',()=>chooseSkill(i));root.append(b);
  });
  sprites.nativeReady.then(()=>root.querySelectorAll('.skill-picture').forEach((c,i)=>sprites.frame(c.getContext('2d'),animation[i],0,16,22,false,1)));
}
function chooseSkill(index){
  if(!engine||watching||engine.finished||engine.skills[index]<=0)return;
  selectedSkill=selectedSkill===index?-1:index;updateHud();
  say(selectedSkill<0?'Skillkeuze opgeheven.':`${names[index]} geselecteerd; klik op een lemming.`);
}
function setPaused(value){paused=value;$('pauzeKnop').setAttribute('aria-pressed',String(value));$('pauzeKnop').textContent=value?'Verder':'Pauze';$('pauseBadge').hidden=!value;if(value)audio.pause();else if(audio.musicEnabled&&started)audio.playMusic();lastTime=0;accumulator=0;}
function setSpeed(value){speed=value;$('snelKnop').setAttribute('aria-pressed',String(value===2));$('snelKnop').textContent=value===2?'Normale snelheid':'2× snelheid';}
function levelTitle(d){return d.name.replace(/\s+/g,' ').trim();}
function resetLevel(index=levelIndex){
  levelIndex=index;data=assets.levels[index];engine=new Engine(data,assets);engine.silent=false;cameraX=data.camera||0;cameraY=0;zoom=Number($('zoom').value)||1;
  selectedSkill=-1;selectedId=null;hoverId=null;started=false;watching=false;importedReplay=null;practiceUsed=$('practice').checked;latestReplay=null;pendingSave=null;handlesEnd=false;lastNuke=0;
  $('introOverlay').hidden=false;$('eindOverlay').hidden=true;$('pauseBadge').hidden=true;$('practicePanel').hidden=!$('practice').checked;
  $('levelChoice').value=data.id;$('levelEyebrow').textContent=`${data.rating.toUpperCase()} ${String(data.number).padStart(2,'0')}`;$('levelTitle').textContent=levelTitle(data);
  $('levelGoal').textContent=`Breng minstens ${data.required} van de ${data.total} lemmings naar de uitgang (${goalPct(data)}%).`;
  $('levelHint').textContent=levelHints[index]||'Bekijk de route en verdeel je skills zorgvuldig; klik op een lemming om een opdracht toe te wijzen.';$('startKnop').disabled=false;$('nextLevel').hidden=index===assets.levels.length-1;
  $('statNeed').textContent=goalPct(data)+'%';$('releaseRate').textContent=data.releaseRate;
  $('watchReplay').disabled=!progress[data.id]?.replay;$('exportReplay').disabled=true;$('replayStatus').textContent=progress[data.id]?.replay?'Beste resultaat en replay geladen.':'Je handelingen worden tijdens het spelen opgenomen.';
  $('bestResult').textContent=progress[data.id]?`Beste: ${progress[data.id].percent}%${progress[data.id].completed?' · gehaald':''}`:'Nog geen opgeslagen resultaat';
  setPaused(true);setSpeed(1);snapshots=[];lastSnapshot=-1;addSnapshot();updateHud();audio.setLevel(index%5);draw();
}
const levelHints=[
  'Graaf een tunnel door de vloer zodat de groep naar de lagere uitgang kan vallen.',
  'Geef iedere lemming de parachute voordat de lange val begint.',
  'Een blocker keert de groep om; leid ze terug naar de veilige route.',
  'Klimmers komen over wanden. Een mijnwerker kan een doorgang door de rots maken.',
  'Laat de groep met bashers door de muren breken.'
];
function start(watch=null){
  if(watch){const replayIndex=assets.levels.findIndex(d=>d.id===watch.levelId);if(replayIndex<0)return;if(!engine||data.id!==watch.levelId||engine.tick||engine.finished)resetLevel(replayIndex);}
  if(!engine)return;started=true;$('introOverlay').hidden=true;$('eindOverlay').hidden=true;$('pauseBadge').hidden=false;
  if(watch){watching=true;importedReplay=watch;engine.replay=structuredClone(watch);engine.commands=[];latestReplay=watch;practiceUsed=true;$('practice').checked=true;$('practicePanel').hidden=false;say('Replay wordt afgespeeld; resultaten worden niet opgeslagen.');}
  else{watching=false;engine.replay=null;practiceUsed=$('practice').checked;say(practiceUsed?'Oefenstand actief; dit resultaat telt niet mee.':'Level gestart.');}
  setPaused(false);if(audio.musicEnabled)audio.playMusic();canvas.focus({preventScroll:true});lastTime=0;accumulator=0;
}
function updateHud(){
  if(!engine)return;
  $('statOut').textContent=`${String(engine.spawned).padStart(2,'0')}/${engine.data.total}`;$('statSaved').textContent=`${Math.floor(engine.saved*100/engine.data.total)}%`;
  $('statNeed').textContent=goalPct(data)+'%';$('statTime').textContent=timeString(engine.remaining);$('releaseRate').textContent=engine.rate;
  document.querySelectorAll('#skills button').forEach((b,i)=>{
    const left=engine.skills[i];b.querySelector('.skill-count').textContent=left;b.disabled=left<=0||watching||engine.finished;
    b.setAttribute('aria-pressed',String(selectedSkill===i));b.setAttribute('aria-label',`${names[i]}: ${left} beschikbaar${selectedSkill===i?', geselecteerd':''}`);
  });
  const active=engine.live.find(e=>e.id===selectedId);$('cursorReadout').textContent=active?`Lemming ${active.id} · ${stateName(active.state)} · ${active.dir>0?'→':'←'}`:selectedSkill>=0?`${names[selectedSkill]} gekozen`:'Kies een lemming';
  $('tempoMinKnop').disabled=watching||engine.rate<=data.releaseRate||engine.finished;$('tempoPlusKnop').disabled=watching||engine.rate>=99||engine.finished;
  $('nukeKnop').disabled=watching||engine.finished||engine.nuking;
  $('pauzeKnop').disabled=!started||engine.finished;$('snelKnop').disabled=!started||engine.finished||watching;
  if(selectedSkill>=0&&engine.skills[selectedSkill]<=0)selectedSkill=-1;
  if($('practice').checked&&!watching){$('practicePanel').hidden=false;$('timeline').max=engine.tick;$('timeline').value=engine.tick;$('practiceTime').textContent=timeString(engine.tick*TICK);}
  updateMinimap();
}
function timeString(t){let s=Math.max(0,Math.ceil(t));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function stateName(s){return ({walking:'loopt',falling:'valt',floating:'zweeft',climbing:'klimt',hoisting:'trekt zich op',blocking:'blokkeert',building:'bouwt',shrugging:'draait om',bashing:'slaat',mining:'mijnt',digging:'graaft',ohno:'bomber',jumping:'springt'})[s]||s;}
function updateMinimap(){
  if(!engine)return;const t=engine.level;t.flush();mctx.imageSmoothingEnabled=false;mctx.fillStyle=t.style.background;mctx.fillRect(0,0,160,16);mctx.drawImage(t.canvas,0,0,160,16);
  for(const e of engine.live){mctx.fillStyle=e.state==='ohno'?'#ff4444':'#80ff80';mctx.fillRect(Math.floor(e.x*160/t.width),Math.max(0,Math.min(15,Math.floor(e.y*16/t.height))),1,1);}
  mctx.strokeStyle='#fff';mctx.lineWidth=1;mctx.strokeRect(cameraX*160/t.width+.5,cameraY*16/t.height+.5,Math.max(1,320/zoom*160/t.width-1),Math.max(1,160/zoom*16/t.height-1));
}
function draw(){
  if(!engine)return;const t=engine.level;t.flush();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=t.style.background;ctx.fillRect(0,0,320,160);
  ctx.save();ctx.scale(zoom,zoom);ctx.translate(-Math.floor(cameraX),-Math.floor(cameraY));
  if(t.specialBackground){const bg=t.specialBackground;for(let x=Math.floor(cameraX/bg.width)*bg.width;x<cameraX+320/zoom;x+=bg.width)ctx.drawImage(bg,x,0);}
  t.drawObjects(ctx,engine.tick,false);ctx.drawImage(t.canvas,0,0);t.drawObjects(ctx,engine.tick,true);
  for(const e of engine.entities){const selected=e.id===selectedId||e.id===hoverId;sprites.draw(ctx,e,engine.tick,assets,selected);}
  ctx.restore();
  if(started&&!paused&&engine.live.length&&frames%3===0){const edge=canvas.getBoundingClientRect();if(edge.width){const pointerX=lastPointer?.x;if(pointerX!==undefined){if(pointerX<edge.left+24)edgeScroll=-1;else if(pointerX>edge.right-24)edgeScroll=1;else edgeScroll=0;}}}
}
let lastPointer=null;
function addSnapshot(){if(!engine||watching)return;snapshots.push({tick:engine.tick,state:engine.snapshot()});lastSnapshot=engine.tick;
  if(snapshots.length>22)snapshots.splice(1,snapshots.length-22);
}
function consumeEvents(){for(const event of engine.drainEvents())audio.fx(event.type);}
function advance(){
  if(!started||paused||!engine||engine.finished)return;
  if(edgeScroll){cameraX=clamp(cameraX+edgeScroll*3,0,data.width-320/zoom);}
  engine.step();consumeEvents();
  if(watching&&importedReplay&&engine.tick>=importedReplay.ticks&&!engine.finished){engine.finished=true;engine.endReason='replay-end';}
  if(engine.tick%50===0)addSnapshot();
  if(engine.finished)finish();
}
function animate(now){
  requestAnimationFrame(animate);if(!engine)return;
  if(!lastTime)lastTime=now;let dt=Math.min(.2,(now-lastTime)/1000);lastTime=now;
  if(!paused&&started){accumulator+=dt*speed;let n=0;while(accumulator>=TICK&&n<8){advance();accumulator-=TICK;n++;}}
  if(++frames%2===0){draw();updateHud();}
}
function finish(){if(handlesEnd)return;handlesEnd=true;setPaused(true);if(!watching)latestReplay=engine.exportReplay();$('endTitle').textContent=engine.success?'Level gehaald!':'Level niet gehaald';
  $('endText').textContent=`${engine.saved} van ${data.total} gered (${Math.floor(engine.saved*100/data.total)}%). Nodig: ${data.required}. ${engine.endReason==='time'?'De tijd is op.':''}`;
  $('endReplay').hidden=false;$('eindOverlay').hidden=false;$('pauseBadge').hidden=true;$('exportReplay').disabled=false;$('replayStatus').textContent=`Replay van ${data.name} beschikbaar.`;
  if(practiceUsed||watching){
    if(watching){const valid=importedReplay&&engine.tick===importedReplay.ticks&&engine.digest()===importedReplay.checksum;$('replayStatus').textContent=valid?'Replay afgelopen; de simulatie komt overeen met de checksum.':'Replay afgelopen; de opgeslagen checksum komt niet overeen.';}
    $('saveState').textContent=watching?'Replay afgelopen; score niet opgeslagen.':'Oefenresultaat niet opgeslagen.';$('retrySave').hidden=true;return;
  }
  pendingSave={levelId:data.id,saved:engine.saved,total:data.total,completed:engine.success,ticks:engine.tick,replay:latestReplay};saveProgress();
}
async function saveProgress(){if(!pendingSave||saveBusy)return;saveBusy=true;$('saveState').textContent='Voortgang opslaan…';$('retrySave').hidden=true;
  try{const r=await fetch('/api/progress',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(pendingSave)});const b=await r.json();if(!r.ok)throw Error(b.error||'Voortgang opslaan is niet gelukt.');
    pendingSave=null;await loadProgress(false);$('saveState').textContent='Voortgang veilig opgeslagen.';
  }catch(e){$('saveState').textContent=e.message+' Je replay blijft beschikbaar.';$('retrySave').hidden=false;}
  finally{saveBusy=false;}
}
async function loadProgress(showErrors=true){
  try{const r=await fetch('/api/progress',{cache:'no-store'});if(!r.ok)throw Error('Voortgang kon niet worden opgehaald.');const b=await r.json();progress=Object.fromEntries((b.progress||[]).map(p=>[p.level_id,p]));
    $('retryProgress').hidden=true;
    const ratings=['Fun','Tricky','Taxing','Mayhem'];
    $('levelChoice').replaceChildren(...ratings.map(r=>{const group=document.createElement('optgroup');group.label=r;for(const d of assets.levels.filter(x=>x.rating===r)){const o=document.createElement('option');o.value=d.id;o.textContent=`${r} ${d.number} · ${d.name}${progress[d.id]?` · ${progress[d.id].percent}%`:''}`;group.append(o);}return group;}));
    $('levelChoice').disabled=false;if(data){$('levelChoice').value=data.id;$('bestResult').textContent=progress[data.id]?`Beste: ${progress[data.id].percent}%${progress[data.id].completed?' · gehaald':''}`:'Nog geen opgeslagen resultaat';$('watchReplay').disabled=!progress[data.id]?.replay;}return true;
  }catch(e){if(showErrors){say(e.message,true);$('retryProgress').hidden=false;}return false;}
}
function chooseLevel(id){const i=assets.levels.findIndex(d=>d.id===id);if(i>=0)resetLevel(i);}
function chooseEntity(worldX,worldY,shift=false){
  if(!engine)return null;const candidates=engine.live.filter(e=>Math.abs(e.x-worldX)<=8&&Math.abs(e.y-worldY)<=9&&(!shift||e.state==='walking'));
  candidates.sort((a,b)=>Math.hypot(a.x-worldX,a.y-worldY)-Math.hypot(b.x-worldX,b.y-worldY));
  if(!candidates.length)return null;
  if(candidates.length>1&&candidates.some(e=>e.id===selectedId)){const k=candidates.findIndex(e=>e.id===selectedId);return candidates[(k+1)%candidates.length];}return candidates[0];
}
function assignEntity(e){
  if(!e||selectedSkill<0||watching)return false;
  const ok=engine.command({type:'skill',lemming:e.id,skill:selectedSkill});if(ok){selectedId=e.id;consumeEvents();updateHud();say(`${names[selectedSkill]} toegewezen aan lemming ${e.id}.`);return true;}
  say('Deze lemming kan die skill nu niet krijgen.');return false;
}
function canvasPoint(clientX,clientY){const r=canvas.getBoundingClientRect();return {x:(clientX-r.left)/r.width*320,y:(clientY-r.top)/r.height*160};}
function worldPoint(clientX,clientY){const p=canvasPoint(clientX,clientY);return {x:cameraX+p.x/zoom,y:cameraY+p.y/zoom};}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function pointerDown(e){canvas.setPointerCapture?.(e.pointerId);const point=canvasPoint(e.clientX,e.clientY);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,point});lastPointer={x:e.clientX,y:e.clientY};
  if(pointers.size===1){const world=worldPoint(e.clientX,e.clientY);const hit=chooseEntity(world.x,world.y,e.shiftKey);drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,hit};}
  if(pointers.size===2){const ps=[...pointers.values()];pinch={distance:Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y),zoom,anchor:worldPoint((ps[0].x+ps[1].x)/2,(ps[0].y+ps[1].y)/2),center:canvasPoint((ps[0].x+ps[1].x)/2,(ps[0].y+ps[1].y)/2)};drag=null;}
  e.preventDefault();}
function pointerMove(e){const p=pointers.get(e.pointerId);lastPointer={x:e.clientX,y:e.clientY};if(!p){const w=worldPoint(e.clientX,e.clientY);hoverId=chooseEntity(w.x,w.y)?.id??null;return;}
  p.x=e.clientX;p.y=e.clientY;
  if(pinch&&pointers.size>=2){const ps=[...pointers.values()],dist=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);zoom=clamp(Math.round(pinch.zoom*dist/Math.max(1,pinch.distance)),1,3);$('zoom').value=String(zoom);cameraX=clamp(pinch.anchor.x-pinch.center.x/zoom,0,data.width-320/zoom);cameraY=clamp(pinch.anchor.y-pinch.center.y/zoom,0,data.height-160/zoom);return;}
  if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6)drag.moved=true;
  if(drag.moved){const r=canvas.getBoundingClientRect();cameraX=clamp(cameraX-dx/r.width*320/zoom,0,data.width-320/zoom);cameraY=clamp(cameraY-dy/r.height*160/zoom,0,data.height-160/zoom);}drag.x=e.clientX;drag.y=e.clientY;}
function pointerUp(e){const p=pointers.get(e.pointerId);if(p&&drag&&drag.id===e.pointerId&&!drag.moved&&pointers.size===1){const hit=drag.hit;if(hit){selectedId=hit.id;if(selectedSkill>=0)assignEntity(hit);else{updateHud();say(`Lemming ${hit.id} geselecteerd. Kies een skill.`);}}else{selectedId=null;hoverId=null;}}
  pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;if(drag?.id===e.pointerId)drag=null;e.preventDefault();}
canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);
function useNuke(){if(!engine||watching||engine.finished||engine.nuking)return;const now=performance.now();if(now-lastNuke<900){if(engine.command({type:'nuke'})){lastNuke=0;say('Nuke gestart.');}}else{lastNuke=now;say('Klik nogmaals binnen 0,9 seconde om de Nuke te bevestigen.');setTimeout(()=>{if(lastNuke===now){lastNuke=0;say('Nuke niet gestart. Klik tweemaal om te bevestigen.');}},950);}}
function alterRate(delta){if(!engine||watching)return;const rate=clamp(engine.rate+delta,data.releaseRate,99);if(engine.command({type:'rate',rate}))updateHud();}
function restart(){resetLevel(levelIndex);say('Level opnieuw gestart.');}
function cycleSelection(){if(!engine)return;const eligible=engine.live.filter(e=>selectedSkill<0||e.canAssign(selectedSkill,engine.level));if(!eligible.length){say('Geen geschikte lemming beschikbaar.');return;}let i=eligible.findIndex(e=>e.id===selectedId);selectedId=eligible[(i+1)%eligible.length].id;updateHud();}
function keydown(e){if(document.activeElement!==canvas&&document.activeElement!==document.body)return;
  if(e.key>='1'&&e.key<='8'){chooseSkill(Number(e.key)-1);e.preventDefault();}
  else if(e.key==='Tab'){cycleSelection();e.preventDefault();}
  else if(e.key==='Enter'&&selectedId){assignEntity(engine.live.find(x=>x.id===selectedId));e.preventDefault();}
  else if(e.code==='Space'){if(started&&!engine.finished)setPaused(!paused);e.preventDefault();}
  else if(e.key.toLowerCase()==='r'){restart();}
  else if(e.key.toLowerCase()==='n')useNuke();
  else if(e.key==='ArrowLeft'){cameraX=clamp(cameraX-24,0,data.width-320/zoom);e.preventDefault();}
  else if(e.key==='ArrowRight'){cameraX=clamp(cameraX+24,0,data.width-320/zoom);e.preventDefault();}
  else if(e.key==='ArrowUp'){cameraY=clamp(cameraY-12,0,data.height-160/zoom);e.preventDefault();}
  else if(e.key==='ArrowDown'){cameraY=clamp(cameraY+12,0,data.height-160/zoom);e.preventDefault();}
  else if(e.key==='+'||e.key==='=')alterRate(1);else if(e.key==='-')alterRate(-1);
  draw();updateHud();}
document.addEventListener('keydown',keydown);
$('startKnop').addEventListener('click',async()=>{await audio.unlock();start();});
$('levelChoice').addEventListener('change',e=>chooseLevel(e.target.value));
$('pauzeKnop').addEventListener('click',()=>{if(started&&!engine.finished)setPaused(!paused);});$('snelKnop').addEventListener('click',()=>setSpeed(speed===1?2:1));$('herstartKnop').addEventListener('click',restart);
$('nukeKnop').addEventListener('click',useNuke);$('tempoMinKnop').addEventListener('click',()=>alterRate(-1));$('tempoPlusKnop').addEventListener('click',()=>alterRate(1));
$('zoom').addEventListener('change',()=>{const old=zoom;zoom=Number($('zoom').value);const cx=cameraX+160/old,cy=cameraY+80/old;cameraX=clamp(cx-160/zoom,0,data.width-320/zoom);cameraY=clamp(cy-80/zoom,0,data.height-160/zoom);draw();});
function minimapMove(e){const r=mini.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*160,y=(e.clientY-r.top)/r.height*16;cameraX=clamp(x/160*data.width-160/zoom,0,data.width-320/zoom);cameraY=clamp(y/16*data.height-80/zoom,0,data.height-160/zoom);draw();}
mini.addEventListener('pointerdown',e=>{mini.setPointerCapture(e.pointerId);minimapMove(e);});mini.addEventListener('pointermove',e=>{if(e.buttons)minimapMove(e);});mini.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){cameraX=clamp(cameraX+(e.key==='ArrowRight'?24:-24),0,data.width-320/zoom);draw();e.preventDefault();}});
$('practice').addEventListener('change',e=>{if(e.target.checked){practiceUsed=true;$('practicePanel').hidden=false;say('Oefenstand actief; dit resultaat telt niet mee.');}else{$('practicePanel').hidden=true;say(practiceUsed?'Deze poging blijft een oefenpoging.':'Oefenstand uit.');}});
function seek(target,branch=true){
  if(!engine||watching)return;target=clamp(Math.floor(target),0,engine.tick);const original=engine.commands.slice();let snap=snapshots.filter(s=>s.tick<=target).at(-1);
  if(!snap){engine=new Engine(data,assets);snapshots=[{tick:0,state:engine.snapshot()}];snap=snapshots[0];}
  engine.restore(snap.state);engine.commands=original;engine.replay=null;engine.silent=true;
  while(engine.tick<target&&!engine.finished)engine.step();engine.silent=false;engine.drainEvents();
  if(branch)engine.commands=original.filter(c=>c.tick<target);
  selectedId=null;paused=true;$('eindOverlay').hidden=true;handlesEnd=false;pendingSave=null;setPaused(true);draw();updateHud();say(`Oefenstand: hersteld op ${timeString(engine.tick*TICK)}.`);
}
$('rewind').addEventListener('click',()=>{if($('practice').checked&&engine)seek(engine.tick-Math.ceil(5/TICK));});$('step').addEventListener('click',()=>{if($('practice').checked&&engine&&started&&!watching){engine.silent=false;engine.step();consumeEvents();if(engine.finished)finish();draw();updateHud();}});
$('timeline').addEventListener('change',e=>{if($('practice').checked)seek(Number(e.target.value));});$('timeline').addEventListener('input',e=>{$('practiceTime').textContent=timeString(Number(e.target.value)*TICK);});
$('retrySave').addEventListener('click',saveProgress);$('retryProgress').addEventListener('click',()=>loadProgress(true));$('nextLevel').addEventListener('click',()=>resetLevel(Math.min(levelIndex+1,assets.levels.length-1)));$('retryLevel').addEventListener('click',restart);
$('endReplay').addEventListener('click',()=>{if(latestReplay)start(latestReplay);});$('watchReplay').addEventListener('click',()=>{const replay=progress[data.id]?.replay||latestReplay;if(replay)start(replay);});
function downloadReplay(){const replay=latestReplay||progress[data.id]?.replay;if(!replay)return;const blob=new Blob([JSON.stringify(replay,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`lemming-rescue-${replay.levelId}-replay.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
$('exportReplay').addEventListener('click',downloadReplay);
$('importReplay').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';try{if(!file)return;if(file.size>250000)throw Error('Replaybestand is groter dan 250 kB.');const r=JSON.parse(await file.text());if(!assets.levels.some(x=>x.id===r.levelId)||!validReplay(r,r.levelId))throw Error('Dit replaybestand is ongeldig of hoort bij een onbekend level.');latestReplay=r;$('replayStatus').textContent=`Replay geladen voor ${assets.levels.find(x=>x.id===r.levelId).name}.`;if(r.levelId!==data.id)chooseLevel(r.levelId);$('endReplay').hidden=false;$('exportReplay').disabled=false;start(r);}catch(err){$('replayStatus').textContent=err.message;}});
$('effects').addEventListener('click',async()=>{audio.effects=!audio.effects;store.write('lr-effects',audio.effects?'on':'off');$('effects').setAttribute('aria-pressed',String(audio.effects));$('effects').textContent='Effecten '+(audio.effects?'aan':'uit');if(audio.effects){await audio.unlock();audio.fx('letsgo');}});
$('music').addEventListener('click',async()=>{audio.musicEnabled=!audio.musicEnabled;store.write('lr-music',audio.musicEnabled?'on':'off');$('music').setAttribute('aria-pressed',String(audio.musicEnabled));$('music').textContent='Muziek '+(audio.musicEnabled?'aan':'uit');await audio.unlock();if(audio.musicEnabled&&started&&!paused)audio.playMusic();else audio.pause();});
$('volume').addEventListener('input',e=>{audio.setVolume(Number(e.target.value)/100);store.write('lr-volume',e.target.value);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.pause();lastTime=0;accumulator=0;}else if(audio.musicEnabled&&started&&!paused)audio.playMusic();});
$('options').addEventListener('toggle',()=>{if($('options').open)audio.unlock();});
async function boot(){
  loadPreference();say('Originele levels en graphics laden…');
  try{await Promise.all([assets.ready,sprites.nativeReady]);renderSkillButtons();await loadProgress(true);resetLevel(0);$('levelChoice').disabled=false;say('Fun 1 staat klaar. Er zijn 120 Amiga-levels beschikbaar.');}
  catch(e){say(`De game kon niet worden gestart: ${e.message}`,true);$('startKnop').disabled=true;}
  requestAnimationFrame(animate);
}
boot();
export const gameApp={get engine(){return engine},get assets(){return assets},get data(){return data},get progress(){return progress},get latestReplay(){return latestReplay},start,resetLevel,seek};
