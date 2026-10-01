import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {openUsers,createUser,hashPassword,verifyPassword,username} from './users.js';
import {progressAPI} from './progress.js';
import {initChallenges,recordChallenge} from './challenges.js';
import {Backups} from './backups.js';
import {features} from './features.js';
import {createLoginPage} from './login-page.js';

const root=path.resolve(process.env.STATIC_DIR||'./dist/client');
const dataDir=path.resolve(process.env.DATA_DIR||'./data');
const port=Number(process.env.PORT||8080);
const host=process.env.HOST||'0.0.0.0';
const sqlite=await openUsers(dataDir);
let owner=sqlite.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get();
if(!owner){
  const result=await createUser(sqlite,process.env.LEMMING_RESCUE_USERNAME||'wtrdk',process.env.LEMMING_RESCUE_PASSWORD,true);
  owner={id:Number(result.lastInsertRowid)};
  console.log('Eerste account aangemaakt: '+(process.env.LEMMING_RESCUE_USERNAME||'wtrdk'));
}
const dummyHash=await hashPassword(randomBytes(32).toString('hex'));
const sessions=new Map(),attempts=new Map();
const sessionLifetime=12*60*60*1000,attemptWindow=15*60*1000;
setInterval(()=>{const now=Date.now();for(const [key,s] of sessions)if(s.expires<=now)sessions.delete(key);for(const [key,a] of attempts)if(a.until<=now)attempts.delete(key);},60000).unref();
const loginPage=createLoginPage((await readFile(path.join(root,'assets/sprites/lemmings-amiga.png'))).toString('base64'));
// Migrate the shared score table once; existing records belong to the first account.
const columns=sqlite.prepare("PRAGMA table_info(progress)").all();
if(columns.length&&!columns.some(c=>c.name==='user_id')){
  sqlite.exec('BEGIN IMMEDIATE');
  try{
    sqlite.exec(`ALTER TABLE progress RENAME TO shared_progress;
      CREATE TABLE progress (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        level_id TEXT NOT NULL,saved INTEGER NOT NULL,total INTEGER NOT NULL,
        percent INTEGER NOT NULL,completed INTEGER NOT NULL,ticks INTEGER NOT NULL,
        replay TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,level_id)
      );`);
    sqlite.prepare('INSERT INTO progress SELECT ?,level_id,saved,total,percent,completed,ticks,replay,updated_at FROM shared_progress').run(owner.id);
    sqlite.exec('DROP TABLE shared_progress; COMMIT');
  }catch(error){sqlite.exec('ROLLBACK');throw error;}
}else sqlite.exec(`CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level_id TEXT NOT NULL,saved INTEGER NOT NULL,total INTEGER NOT NULL,
  percent INTEGER NOT NULL,completed INTEGER NOT NULL,ticks INTEGER NOT NULL,
  replay TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,level_id)
)`);
const levels=JSON.parse(await readFile(path.join(root,'assets/classic/levels.json'),'utf8'));
initChallenges(sqlite,levels);
const backups=new Backups(sqlite,process.env.BACKUP_DIR||path.join(dataDir,'backups'),{days:Number(process.env.BACKUP_KEEP_DAYS||14),hour:Number(process.env.BACKUP_HOUR||3),timezone:process.env.BACKUP_TIMEZONE||'Europe/Amsterdam'});
await backups.start();
const db={prepare(sql){const statement=sqlite.prepare(sql);return{
  all:async()=>({results:statement.all()}),
  bind(...values){return{all:async()=>({results:statement.all(...values)}),run:async()=>statement.run(...values)};}
};}};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ogg':'audio/ogg','.wav':'audio/wav','.ico':'image/x-icon'};
const reply=(res,status,body)=>{const payload=Buffer.from(body);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':payload.length,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(payload);};

const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/',`http://${host}:${port}`);
    if(url.pathname==='/api/health'){
      sqlite.prepare('SELECT 1').get();reply(res,200,'{"status":"ok"}');return;
    }
    const cookieHeader=req.headers.cookie||'';
    const sessionMatch=/(?:^|;\s*)lemming_session=([a-f0-9]{64})(?:;|$)/.exec(cookieHeader);
    let user=null;
    const session=sessionMatch?sessions.get(sessionMatch[1]):null;
    if(session&&session.expires>Date.now()){
      const current=sqlite.prepare('SELECT id,username,password_hash,is_admin FROM users WHERE id=?').get(session.userId);
      if(current&&current.password_hash===session.revision)user=current;
    }
    if(sessionMatch&&!user)sessions.delete(sessionMatch[1]);
    const sessionValid=Boolean(user);
    if(!['GET','HEAD'].includes(req.method)&&req.headers.origin){
      if(new URL(req.headers.origin).host!==req.headers.host){reply(res,403,'{"error":"Ongeldige herkomst."}');return;}
    }
    if(url.pathname==='/api/auth/login'&&req.method==='POST'){
      if(!req.headers['content-type']?.startsWith('application/json')){reply(res,415,'{"error":"Gebruik JSON."}');return;}
      // Use the socket address, never an untrusted forwarding header.
      const client=req.socket.remoteAddress,now=Date.now(),attempt=attempts.get(client);
      if(attempt&&attempt.until>now&&attempt.count>=10){res.setHeader('retry-after',String(Math.ceil((attempt.until-now)/1000)));reply(res,429,'{"error":"Te veel inlogpogingen."}');return;}
      if(!attempt||attempt.until<=now)attempts.set(client,{count:0,until:now+attemptWindow});
      attempts.get(client).count++;
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096){reply(res,413,'{"error":"Verzoek te groot."}');return;}chunks.push(chunk);}
      let supplied={},normalized='';try{supplied=JSON.parse(Buffer.concat(chunks).toString('utf8'));normalized=username(supplied?.username);}catch{}
      const account=sqlite.prepare('SELECT id,username,password_hash FROM users WHERE username=?').get(normalized);
      const valid=await verifyPassword(supplied?.password,account?.password_hash||dummyHash);
      if(!valid||!account){reply(res,401,'{"error":"Gebruikersnaam of wachtwoord klopt niet."}');return;}
      attempts.delete(client);
      if(sessionMatch)sessions.delete(sessionMatch[1]);
      const token=randomBytes(32).toString('hex');sessions.set(token,{userId:account.id,revision:account.password_hash,expires:now+sessionLifetime});
      const secure=req.socket.encrypted||req.headers['x-forwarded-proto']==='https';
      const payload=Buffer.from('{"ok":true}');res.writeHead(200,{'content-type':'application/json; charset=utf-8','content-length':payload.length,'cache-control':'no-store','set-cookie':`lemming_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionLifetime/1000}${secure?'; Secure':''}`,'x-content-type-options':'nosniff'});res.end(payload);return;
    }
    if(url.pathname==='/api/auth/logout'&&req.method==='POST'){
      if(sessionMatch)sessions.delete(sessionMatch[1]);res.writeHead(303,{'location':'/','cache-control':'no-store','set-cookie':'lemming_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'});res.end();return;
    }
    if(url.pathname==='/api/auth/status'){
      const payload=Buffer.from(JSON.stringify({authenticated:sessionValid,username:user?.username||null}));res.writeHead(200,{'content-type':'application/json; charset=utf-8','content-length':payload.length,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(payload);return;
    }
    if(!sessionValid){
      if(url.pathname==='/login'||url.pathname==='/'){
        if(req.method!=='GET'&&req.method!=='HEAD'){reply(res,405,'{"error":"Deze handeling wordt niet ondersteund."}');return;}
        const body=Buffer.from(loginPage);res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-length':body.length,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});if(req.method==='HEAD')res.end();else res.end(body);return;
      }
      if(url.pathname.startsWith('/api/')){reply(res,401,'{"error":"Log eerst in."}');return;}
      const next=encodeURIComponent(url.pathname+url.search);res.writeHead(302,{'location':`/?next=${next}`,'cache-control':'no-store','referrer-policy':'no-referrer'});res.end();return;
    }
    if(url.pathname==='/login'){res.writeHead(303,{'location':'/','cache-control':'no-store'});res.end();return;}
    if(await features(req,res,url,user,sqlite,backups,levels))return;
    if(url.pathname==='/api/progress'){
      let body;
      if(!['GET','HEAD'].includes(req.method||'GET')){
        const chunks=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>250000){reply(res,413,'{"error":"Deze replay is te groot."}');return;}chunks.push(chunk);}
        body=Buffer.concat(chunks);
      }
      const init={method:req.method,headers:req.headers};
      if(body?.length)init.body=body;
      const response=await progressAPI(new Request(`http://selfhost${url.pathname}${url.search}`,init),db,user.id);
      if(response.ok&&req.method==='PUT'&&body){recordChallenge(sqlite,levels,user.id,JSON.parse(body.toString('utf8')));}
      const bytes=Buffer.from(await response.arrayBuffer());res.writeHead(response.status,Object.fromEntries(response.headers));res.end(bytes);return;
    }
    if(!['GET','HEAD'].includes(req.method||'GET')){reply(res,405,'{"error":"Deze handeling wordt niet ondersteund."}');return;}
    let relative;try{relative=decodeURIComponent(url.pathname);}catch{reply(res,400,'{"error":"Ongeldig pad."}');return;}
    if(relative.includes('\0')){reply(res,400,'{"error":"Ongeldig pad."}');return;}
    if(relative==='/')relative='/index.html';
    const file=path.resolve(root,`.${relative}`);
    if(file!==root&&!file.startsWith(root+path.sep)){reply(res,404,'{"error":"Niet gevonden."}');return;}
    let info;try{info=await stat(file);}catch{reply(res,404,'{"error":"Niet gevonden."}');return;}
    if(!info.isFile()){reply(res,404,'{"error":"Niet gevonden."}');return;}
    const ext=path.extname(file).toLowerCase();
    const cache=ext==='.html'||ext==='.json'?'private, no-store':'private, max-age=86400';
    if(ext==='.html'){
      const strip=`<div style="max-width:960px;margin:0 auto 12px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;font:14px system-ui;color:#b8f2c7"><span>Ingelogd als <strong>${user.username}</strong></span><nav style="display:flex;flex-wrap:wrap;gap:12px"><a href="/scoreboard" style="color:inherit">Scorebord</a><a href="/account" style="color:inherit">Mijn account</a>${user.is_admin?'<a href="/admin" style="color:inherit">Beheer</a>':''}</nav><form method="POST" action="/api/auth/logout" style="margin:0"><button type="submit" style="padding:8px 12px;border:1px solid #b8f2c755;border-radius:8px;background:#18352c;color:#d0f6c9;cursor:pointer">Uitloggen</button></form></div>`;
      const html=(await readFile(file,'utf8')).replace(/(<body[^>]*>)/i,'$1'+strip);
      const bytes=Buffer.from(html);res.writeHead(200,{'content-type':types['.html'],'content-length':bytes.length,'cache-control':cache,'x-content-type-options':'nosniff','referrer-policy':'same-origin'});res.end(req.method==='HEAD'?undefined:bytes);return;
    }
    const headers={'content-type':types[ext]||'application/octet-stream','cache-control':cache,'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','accept-ranges':'bytes'};
    let start=0,end=info.size-1,status=200;
    if(req.headers.range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(!match){reply(res,416,'{"error":"Ongeldig bereik."}');return;}
      if(match[1]===''){const suffix=Number(match[2]);if(!suffix){reply(res,416,'{"error":"Ongeldig bereik."}');return;}start=Math.max(0,info.size-suffix);}
      else{start=Number(match[1]);if(match[2])end=Number(match[2]);}
      if(start>=info.size||start>end){res.writeHead(416,{'content-range':`bytes */${info.size}`,'content-length':0});res.end();return;}
      end=Math.min(end,info.size-1);status=206;headers['content-range']=`bytes ${start}-${end}/${info.size}`;
    }
    headers['content-length']=end-start+1;
    res.writeHead(status,headers);if(req.method==='HEAD'){res.end();return;}
    createReadStream(file,{start,end}).pipe(res);
  }catch(error){console.error('Request failed:',error?.message);if(!res.headersSent)reply(res,500,'{"error":"Interne serverfout."}');else res.destroy();}
});
server.listen(port,host,()=>console.log(`Lemming Rescue luistert op ${host}:${port}; voortgang staat in ${dataDir}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{backups.stop();await backups.pending?.catch(()=>{});sqlite.close();process.exit(0);}));
