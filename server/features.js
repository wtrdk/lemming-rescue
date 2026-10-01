import {stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createUser,hashPassword,verifyPassword,changeRole,deleteUser} from './users.js';
import {leaderboard} from './challenges.js';
import {featurePage} from './pages.js';
const send=(res,status,data)=>{const bytes=Buffer.from(JSON.stringify(data));res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':bytes.length,'cache-control':'private, no-store','x-content-type-options':'nosniff'});res.end(bytes);};
async function json(req){
  if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('Gebruik JSON.');
  const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>4096)throw new Error('Verzoek te groot.');chunks.push(c);}
  const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Ongeldig verzoek.');return value;
}
const passwordAttempts=new Map();
export async function features(req,res,url,user,sqlite,backups,levels){
  const route=url.pathname,isAdmin=route==='/admin'||route.startsWith('/api/admin/');
  if(isAdmin&&!user.is_admin){send(res,403,{error:'Alleen beheerders hebben toegang.'});return true;}
  if(['/admin','/account','/scoreboard'].includes(route)){
    if(!['GET','HEAD'].includes(req.method)){send(res,405,{error:'Deze handeling wordt niet ondersteund.'});return true;}
    const html=Buffer.from(featurePage(route.slice(1),user));res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-length':html.length,'cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:html);return true;
  }
  if(!route.startsWith('/api/admin/')&&route!=='/api/account/password'&&route!=='/api/leaderboard')return false;
  try{
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
