import {stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createUser,hashPassword,verifyPassword,changeRole,deleteUser} from './users.js';
import {leaderboard} from './challenges.js';
import {featurePage} from './pages.js';
const send=(res,status,data)=>{const bytes=Buffer.from(JSON.stringify(data));res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':bytes.length,'cache-control':'private, no-store','x-content-type-options':'nosniff'});res.end(bytes);};
async function json(req,maxSize=4096){
  if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('Gebruik JSON.');
  const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>maxSize)throw new Error('Verzoek te groot.');chunks.push(c);}
  const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Ongeldig verzoek.');return value;
}
const passwordAttempts=new Map();
export async function features(req,res,url,user,sqlite,backups,levels,atlases){
  const route=url.pathname,isAdmin=route==='/admin'||route.startsWith('/api/admin/');
  if(isAdmin&&!user.is_admin){send(res,403,{error:'Alleen beheerders hebben toegang.'});return true;}
  if(['/admin','/account','/scoreboard'].includes(route)){
    if(!['GET','HEAD'].includes(req.method)){send(res,405,{error:'Deze handeling wordt niet ondersteund.'});return true;}
    const html=Buffer.from(featurePage(route.slice(1),user));res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-length':html.length,'cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:html);return true;
  }
  if(!route.startsWith('/api/admin/')&&route!=='/api/account/password'&&route!=='/api/leaderboard'&&route!=='/api/levels'&&!route.startsWith('/api/levels/'))return false;
  try{
    if(route==='/api/levels'&&req.method==='GET'){
      const rows=sqlite.prepare(`SELECT l.id,l.owner_id,l.data,l.updated_at,u.username AS owner
        FROM user_levels l JOIN users u ON u.id=l.owner_id
        WHERE l.owner_id=? OR EXISTS(SELECT 1 FROM level_shares s WHERE s.level_id=l.id AND s.recipient_id=?)
        ORDER BY l.updated_at DESC`).all(user.id,user.id);
      send(res,200,{levels:rows.map(r=>({id:r.id,ownerId:r.owner_id,owner:r.owner,updatedAt:r.updated_at,shared:r.owner_id!==user.id,data:JSON.parse(r.data)}))});return true;
    }
    if(route==='/api/levels'&&req.method==='POST'){
      const p=await json(req,150000),level=p.data;
      validateCustomLevel(level,atlases);
      const id='custom-'+crypto.randomUUID(),now=new Date().toISOString();
      level.id=id;level.rating='Custom';level.number=0;
      sqlite.prepare('INSERT INTO user_levels(id,owner_id,name,data,updated_at) VALUES(?,?,?,?,?)').run(id,user.id,level.name,JSON.stringify(level),now);
      send(res,201,{id,updatedAt:now});return true;
    }
    const levelRoute=/^\/api\/levels\/([^/]+)(?:\/(share))?$/.exec(route);
    if(levelRoute){
      const id=decodeURIComponent(levelRoute[1]);
      const owned=sqlite.prepare('SELECT id FROM user_levels WHERE id=? AND owner_id=?').get(id,user.id);
      if(levelRoute[2]==='share'&&req.method==='POST'){
        if(!owned){send(res,404,{error:'Dit level is niet van jouw account.'});return true;}
        const p=await json(req),recipient=sqlite.prepare('SELECT id,username FROM users WHERE username=? COLLATE NOCASE').get(String(p.username||'').trim().toLowerCase());
        if(!recipient){send(res,404,{error:'Gebruiker niet gevonden.'});return true;}
        if(recipient.id===user.id){send(res,400,{error:'Je kunt je eigen level niet met jezelf delen.'});return true;}
        sqlite.prepare('INSERT OR IGNORE INTO level_shares(level_id,recipient_id,shared_at) VALUES(?,?,?)').run(id,recipient.id,new Date().toISOString());
        send(res,200,{ok:true,username:recipient.username});return true;
      }
      if(levelRoute[2]==='share'&&req.method==='DELETE'){
        if(!owned){send(res,404,{error:'Dit level is niet van jouw account.'});return true;}
        const p=await json(req),recipient=sqlite.prepare('SELECT id FROM users WHERE username=? COLLATE NOCASE').get(String(p.username||'').trim().toLowerCase());
        if(!recipient){send(res,404,{error:'Gebruiker niet gevonden.'});return true;}
        const removed=sqlite.prepare('DELETE FROM level_shares WHERE level_id=? AND recipient_id=?').run(id,recipient.id);
        if(!removed.changes){send(res,404,{error:'Dit level wordt niet met die gebruiker gedeeld.'});return true;}
        send(res,200,{ok:true});return true;
      }
      if(req.method==='PUT'){
        if(!owned){send(res,404,{error:'Dit level is niet van jouw account.'});return true;}
        const p=await json(req,150000),level=p.data;validateCustomLevel(level,atlases);level.id=id;level.rating='Custom';level.number=0;
        const now=new Date().toISOString();sqlite.prepare('UPDATE user_levels SET name=?,data=?,updated_at=? WHERE id=? AND owner_id=?').run(level.name,JSON.stringify(level),now,id,user.id);
        send(res,200,{ok:true,updatedAt:now});return true;
      }
      if(req.method==='DELETE'){
        if(!owned){send(res,404,{error:'Dit level is niet van jouw account.'});return true;}
        sqlite.prepare('DELETE FROM user_levels WHERE id=? AND owner_id=?').run(id,user.id);send(res,200,{ok:true});return true;
      }
      send(res,405,{error:'Deze handeling wordt niet ondersteund.'});return true;
    }
    if(route==='/api/leaderboard'&&req.method==='GET'){
      send(res,200,{levels:levels.map(({id,name,rating,number})=>({id,name,rating,number})),records:leaderboard(sqlite,levels,url.searchParams.get('level')||'fun-1',url.searchParams.get('mode')||'saved')});return true;
    }
    if(route==='/api/account/password'&&req.method==='POST'){
      const now=Date.now(),a=passwordAttempts.get(user.id);if(a&&a.until>now&&a.count>=10){send(res,429,{error:'Te veel pogingen. Probeer over 15 minuten opnieuw.'});return true;}
      for(const [id,entry]of passwordAttempts)if(entry.until<=now)passwordAttempts.delete(id);
      const attempt=passwordAttempts.get(user.id)||{count:0,until:now+900000};attempt.count++;passwordAttempts.set(user.id,attempt);
      const p=await json(req);if(!await verifyPassword(p.currentPassword,user.password_hash)){send(res,400,{error:'Het huidige wachtwoord klopt niet.'});return true;}
      const hash=await hashPassword(p.newPassword),result=sqlite.prepare('UPDATE users SET password_hash=? WHERE id=? AND password_hash=?').run(hash,user.id,user.password_hash);
      if(!result.changes)throw new Error('Je account is ondertussen gewijzigd. Log opnieuw in.');passwordAttempts.delete(user.id);send(res,200,{ok:true});return true;
    }
    if(route==='/api/admin/users'){
      if(req.method==='GET')send(res,200,{currentUserId:user.id,users:sqlite.prepare('SELECT id,username,is_admin,created_at FROM users ORDER BY username').all().map(u=>({id:u.id,username:u.username,isAdmin:Boolean(u.is_admin),createdAt:u.created_at}))});
      else if(req.method==='POST'){const p=await json(req);if(typeof p.isAdmin!=='boolean')throw new Error('Kies een geldige rol.');await createUser(sqlite,p.username,p.password,p.isAdmin);send(res,201,{ok:true});}
      else send(res,405,{error:'Deze handeling wordt niet ondersteund.'});return true;
    }
    const match=/^\/api\/admin\/users\/(\d+)(\/password)?$/.exec(route);
    if(match){
      const id=Number(match[1]),target=sqlite.prepare('SELECT id,username FROM users WHERE id=?').get(id);if(!target){send(res,404,{error:'Gebruiker niet gevonden.'});return true;}
      if(id===user.id)throw new Error('Gebruik Mijn account voor je eigen wachtwoord. Je eigen rol of account kan hier niet worden verwijderd.');
      const p=await json(req);
      if(match[2]&&req.method==='POST')sqlite.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await hashPassword(p.password),id);
      else if(!match[2]&&req.method==='PATCH'){if(typeof p.isAdmin!=='boolean')throw new Error('Kies een geldige rol.');changeRole(sqlite,id,p.isAdmin);}
      else if(!match[2]&&req.method==='DELETE'){if(p.confirmation!==target.username)throw new Error('Typ de gebruikersnaam om verwijderen te bevestigen.');deleteUser(sqlite,id);}
      else{send(res,405,{error:'Deze handeling wordt niet ondersteund.'});return true;}send(res,200,{ok:true});return true;
    }
    if(route==='/api/admin/backups'){
      if(req.method==='GET')send(res,200,await backups.status());else if(req.method==='POST'){await json(req);const name=await backups.create(true);send(res,201,{name});}else send(res,405,{error:'Deze handeling wordt niet ondersteund.'});return true;
    }
    if(route.startsWith('/api/admin/backups/')&&['GET','HEAD'].includes(req.method)){
      const name=decodeURIComponent(route.slice('/api/admin/backups/'.length)),file=backups.file(name);let info;try{info=await stat(file);}catch{send(res,404,{error:'Back-up niet gevonden.'});return true;}
      res.writeHead(200,{'content-type':'application/octet-stream','content-length':info.size,'content-disposition':`attachment; filename="${name}"`,'cache-control':'private, no-store','x-content-type-options':'nosniff'});if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);return true;
    }
    send(res,404,{error:'Niet gevonden.'});return true;
  }catch(error){const msg=error.message?.includes('UNIQUE constraint')?'Deze gebruikersnaam bestaat al.':error instanceof SyntaxError?'Ongeldig verzoek.':error.message;send(res,400,{error:msg||'Deze handeling is niet gelukt.'});return true;}
}

function validateCustomLevel(d,atlases){
  if(!d||typeof d!=='object'||Array.isArray(d))throw new Error('Leveldata ontbreekt.');
  if(typeof d.name!=='string'||!d.name.trim()||d.name.trim().length>64)throw new Error('Geef het level een naam van maximaal 64 tekens.');
  for(const [field,min,max] of [['width',320,3200],['height',160,160],['total',1,100],['required',1,100],['timeSeconds',30,3600],['releaseRate',1,99],['style',0,4],['specialStyle',0,4]])if(!Number.isInteger(d[field])||d[field]<min||d[field]>max)throw new Error(`Ongeldige levelinstelling: ${field}.`);
  if(d.required>d.total||!Array.isArray(d.skills)||d.skills.length!==8||d.skills.some(n=>!Number.isInteger(n)||n<0||n>99))throw new Error('Controleer het aantal lemmings, reddingsdoel en skills.');
  if(!Array.isArray(d.terrain)||d.terrain.length>1500||!Array.isArray(d.objects)||d.objects.length>100||!Array.isArray(d.steel||[])||(d.steel||[]).length>250)throw new Error('Dit level bevat te veel onderdelen.');
  const style=atlases[d.style];if(!style)throw new Error('Onbekende graphicsstijl.');
  const point=(p,w,h)=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&w>0&&h>0&&p.x+w<=d.width&&p.y+h<=d.height;
  for(const p of d.terrain){const tile=style.terrain.find(t=>t.id===p.id);if(!tile||!point(p,tile.w,tile.h)||typeof p.flip!=='boolean')throw new Error('Ongeldig terreinonderdeel.');}
  for(const p of d.objects){const object=style.objects.find(o=>o.id===p.id);if(!object||object.kind==='unknown-special'||!point(p,object.frames?.[0]?.w,object.frames?.[0]?.h)||typeof p.flip!=='boolean')throw new Error('Ongeldig levelobject.');}
  const kinds=d.objects.map(p=>style.objects.find(o=>o.id===p.id)?.kind);if(!kinds.includes('entrance')||!kinds.includes('exit'))throw new Error('Plaats minstens één ingang en één uitgang.');
  for(const r of d.steel||[])if(![r.x,r.y,r.w,r.h].every(Number.isInteger)||r.x<0||r.y<0||r.w<1||r.h<1||r.x+r.w>d.width||r.y+r.h>d.height)throw new Error('Ongeldig staalblok.');
}
