const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export async function progressAPI(request,db){
  try{
    if(!db)return json({error:'Je voortgang kan nu niet worden geladen. Probeer het opnieuw.'},503);
    if(request.method==='GET'){
      const data=await db.prepare('SELECT level_id, saved, total, percent, completed, ticks, replay FROM progress ORDER BY level_id').all();
      return json({progress:data.results.map(row=>({...row,replay:JSON.parse(row.replay)}))});
    }
    if(request.method!=='PUT')return json({error:'Deze handeling wordt niet ondersteund.'},405);
    const raw=await request.text();if(raw.length>250000)return json({error:'Deze replay is te groot.'},413);
    let p;try{p=JSON.parse(raw);}catch{return json({error:'Ongeldige voortgang.'},400);}
    if(!/^(fun|tricky|taxing|mayhem)-(?:[1-9]|[12][0-9]|30)$/.test(p.levelId)||!Number.isInteger(p.saved)||!Number.isInteger(p.total)||p.total<1||p.total>100||p.saved<0||p.saved>p.total||!Number.isInteger(p.ticks)||p.ticks<0||p.ticks>18000||typeof p.completed!=='boolean'||!validReplay(p.replay,p.levelId))return json({error:'Deze voortgang is niet geldig.'},400);
    const percent=Math.floor(p.saved*100/p.total);
    await db.prepare(`INSERT INTO progress (level_id,saved,total,percent,completed,ticks,replay,updated_at)
      VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(level_id) DO UPDATE SET
      saved=excluded.saved,total=excluded.total,percent=excluded.percent,
      completed=MAX(progress.completed,excluded.completed),ticks=excluded.ticks,
      replay=excluded.replay,updated_at=excluded.updated_at
      WHERE excluded.percent>progress.percent OR (excluded.percent=progress.percent AND excluded.ticks<progress.ticks)`)
      .bind(p.levelId,p.saved,p.total,percent,p.completed?1:0,p.ticks,JSON.stringify(p.replay),new Date().toISOString()).run();
    return json({saved:true});
  }catch(error){console.error('Progress persistence failed',error?.message);return json({error:'Opslaan is nog niet gelukt. Je resultaat blijft beschikbaar; probeer opnieuw.'},503);}
}
export function validReplay(r,levelId){
  if(!r||r.version!=='native-1'||r.levelId!==levelId||!Number.isInteger(r.ticks)||r.ticks<0||r.ticks>18000||!Array.isArray(r.commands)||r.commands.length>2500)return false;
  let tick=-1;for(const c of r.commands){
    if(!Number.isInteger(c.tick)||c.tick<tick||c.tick>r.ticks)return false;tick=c.tick;
    if(c.type==='skill'){if(!Number.isInteger(c.lemming)||c.lemming<1||c.lemming>100||!Number.isInteger(c.skill)||c.skill<0||c.skill>7)return false;}
    else if(c.type==='rate'){if(!Number.isInteger(c.rate)||c.rate<1||c.rate>99)return false;}
    else if(c.type!=='nuke')return false;
  }return true;
}
