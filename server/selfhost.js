import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir,stat} from 'node:fs/promises';
import {randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {progressAPI} from './progress.js';

const root=path.resolve(process.env.STATIC_DIR||'./dist/client');
const dataDir=path.resolve(process.env.DATA_DIR||'./data');
const port=Number(process.env.PORT||8080);
const host=process.env.HOST||'0.0.0.0';
const loginPassword=process.env.LEMMING_RESCUE_PASSWORD;
if(!loginPassword||loginPassword.length<12)throw new Error('Stel LEMMING_RESCUE_PASSWORD in op minimaal 12 tekens.');
const scrypt=promisify(scryptCallback);
const expectedPassword=await scrypt(loginPassword,'lemming-rescue-login-v1',64);
const sessions=new Map();
const sessionLifetime=12*60*60*1000;
const loginPage=`<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101927"><title>Lemming Rescue · Inloggen</title><style>
:root{color-scheme:dark;--cream:#fff5d8;--muted:#b7c5d2;--mint:#b8f2c7;--gold:#ffd66b;--ink:#101927}*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:28px;background:radial-gradient(ellipse at 50% 0%,#29475a 0,#152638 42%,#101927 78%);font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:var(--cream)}.card{width:min(100%,440px);padding:36px;border:1px solid #ffffff28;border-radius:24px;background:linear-gradient(160deg,#20354adf,#111c2beF);box-shadow:0 24px 80px #0008;text-align:center}.scene{height:118px;position:relative;margin:-5px auto 12px;overflow:hidden;border-bottom:5px solid #786b49;border-radius:10px;background:linear-gradient(#334d63,#253a4a 67%,#314534 68%)}.hill{position:absolute;bottom:0;width:160px;height:44px;border-radius:50% 50% 0 0;background:#546b43}.hill.left{left:-25px}.hill.right{right:-17px;height:32px;background:#68794c}.door{position:absolute;right:42px;bottom:4px;width:26px;height:47px;border:3px solid #d7c18d;border-bottom:0;border-radius:13px 13px 0 0;background:#283341}.door:after{content:"";position:absolute;right:4px;bottom:5px;width:4px;height:4px;border-radius:50%;background:var(--gold)}.lemming{position:absolute;bottom:3px;left:95px;width:22px;height:34px;animation:walk 2.8s ease-in-out infinite}.hair{position:absolute;top:0;left:3px;width:17px;height:10px;border-radius:7px 7px 2px 2px;background:#f0d86a}.head{position:absolute;top:5px;left:5px;width:14px;height:13px;border-radius:50%;background:#f4c79e}.bodypart{position:absolute;top:17px;left:4px;width:16px;height:12px;border-radius:5px;background:#69d59a}.leg{position:absolute;top:26px;left:6px;width:5px;height:9px;background:#d3e7dd;transform-origin:top;animation:step .32s infinite alternate}.leg.two{left:13px;animation-delay:-.32s}.arm{position:absolute;top:18px;left:17px;width:9px;height:4px;border-radius:3px;background:#f4c79e;transform:rotate(-23deg)}.spark{position:absolute;left:40%;top:19px;color:#fff0a2;font-size:20px;animation:twinkle 1.8s infinite}.spark.s2{left:67%;top:37px;animation-delay:.7s}@keyframes step{to{transform:rotate(35deg)}}@keyframes walk{0%,100%{transform:translateX(-10px)}50%{transform:translateX(15px)}}@keyframes twinkle{50%{opacity:.25;transform:scale(.75)}}h1{font-size:1.85rem;letter-spacing:-.04em;margin:5px 0 8px}p{color:var(--muted);margin:0 0 24px;line-height:1.5}label{display:block;text-align:left;font-weight:650;font-size:.9rem;margin:0 0 8px}input{width:100%;padding:14px 15px;border:1px solid #8295a455;border-radius:12px;background:#0d1723;color:white;font:inherit;outline:none}input:focus{border-color:var(--mint);box-shadow:0 0 0 3px #b8f2c722}button{width:100%;margin-top:14px;padding:14px;border:0;border-radius:12px;background:linear-gradient(135deg,#d0f6c9,#90e3b7);color:#153026;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 7px 22px #68c99b30}button:hover{filter:brightness(1.06);transform:translateY(-1px)}button:disabled{opacity:.65;cursor:wait;transform:none}.error{min-height:24px;margin:10px 0 0;color:#ffaaa4;font-size:.92rem}.foot{margin-top:21px;color:#8192a1;font-size:.78rem}@media(max-width:480px){.card{padding:28px 22px}}
</style></head><body><main class="card"><div class="scene" aria-hidden="true"><div class="hill left"></div><div class="hill right"></div><div class="door"></div><span class="spark">✦</span><span class="spark s2">✦</span><div class="lemming"><i class="hair"></i><i class="head"></i><i class="bodypart"></i><i class="leg"></i><i class="leg two"></i><i class="arm"></i></div></div><h1>Lemming Rescue</h1><p>De uitgang is dichtbij. Log in om je lemmings weer veilig door het level te loodsen.</p><form id="login"><label for="password">Toegangswachtwoord</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus><button id="submit" type="submit">Naar het level</button><div class="error" id="error" role="alert" aria-live="polite"></div></form><div class="foot">Een klein beetje veiligheid voor een grote reddingsmissie</div></main><script>
const form=document.querySelector('#login'),button=document.querySelector('#submit'),error=document.querySelector('#error');form.addEventListener('submit',async event=>{event.preventDefault();error.textContent='';button.disabled=true;button.textContent='Even controleren…';try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:form.password.value})});if(!response.ok)throw new Error('Dat wachtwoord klopt niet. Probeer het opnieuw.');const next=new URLSearchParams(location.search).get('next')||'/';location.replace(next.startsWith('/')&&!next.startsWith('//')?next:'/')}catch(e){error.textContent=e.message||'Inloggen is niet gelukt.';button.disabled=false;button.textContent='Naar het level';form.password.select()}});
</script></body></html>`;
await mkdir(dataDir,{recursive:true});
const sqlite=new DatabaseSync(path.join(dataDir,'progress.sqlite'));
sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
sqlite.exec(`CREATE TABLE IF NOT EXISTS progress (
  level_id TEXT PRIMARY KEY NOT NULL,
  saved INTEGER NOT NULL,
  total INTEGER NOT NULL,
  percent INTEGER NOT NULL,
  completed INTEGER NOT NULL,
  ticks INTEGER NOT NULL,
  replay TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);
const db={prepare(sql){const statement=sqlite.prepare(sql);return{
  all:async()=>({results:statement.all()}),
  bind(...values){return{run:async()=>statement.run(...values)};}
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
    let sessionValid=false;
    if(sessionMatch){const expires=sessions.get(sessionMatch[1]);if(expires&&expires>Date.now()){sessions.set(sessionMatch[1],Date.now()+sessionLifetime);sessionValid=true;}else sessions.delete(sessionMatch[1]);}
    if(url.pathname==='/api/auth/login'&&req.method==='POST'){
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096){reply(res,413,'{"error":"Verzoek te groot."}');return;}chunks.push(chunk);}
      let supplied;try{supplied=JSON.parse(Buffer.concat(chunks).toString('utf8')).password;}catch{supplied='';}
      if(typeof supplied!=='string'||supplied.length>1024){reply(res,401,'{"error":"Onjuist wachtwoord."}');return;}
      const actual=await scrypt(supplied,'lemming-rescue-login-v1',64);
      if(!timingSafeEqual(expectedPassword,actual)){reply(res,401,'{"error":"Onjuist wachtwoord."}');return;}
      const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+sessionLifetime);
      const secure=req.socket.encrypted||req.headers['x-forwarded-proto']==='https';
      const payload=Buffer.from('{"ok":true}');res.writeHead(200,{'content-type':'application/json; charset=utf-8','content-length':payload.length,'cache-control':'no-store','set-cookie':`lemming_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionLifetime/1000}${secure?'; Secure':''}`,'x-content-type-options':'nosniff'});res.end(payload);return;
    }
    if(url.pathname==='/api/auth/logout'&&req.method==='POST'){
      if(sessionMatch)sessions.delete(sessionMatch[1]);res.writeHead(204,{'cache-control':'no-store','set-cookie':'lemming_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'});res.end();return;
    }
    if(url.pathname==='/api/auth/status'){
      const payload=Buffer.from(JSON.stringify({authenticated:sessionValid}));res.writeHead(200,{'content-type':'application/json; charset=utf-8','content-length':payload.length,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(payload);return;
    }
    if(!sessionValid){
      if(url.pathname==='/login'||url.pathname==='/'){
        if(req.method!=='GET'&&req.method!=='HEAD'){reply(res,405,'{"error":"Deze handeling wordt niet ondersteund."}');return;}
        const body=Buffer.from(loginPage);res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-length':body.length,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});if(req.method==='HEAD')res.end();else res.end(body);return;
      }
      if(url.pathname.startsWith('/api/')){reply(res,401,'{"error":"Log eerst in."}');return;}
      const next=encodeURIComponent(url.pathname+url.search);res.writeHead(302,{'location':`/?next=${next}`,'cache-control':'no-store','referrer-policy':'no-referrer'});res.end();return;
    }
    if(url.pathname==='/api/progress'){
      let body;
      if(!['GET','HEAD'].includes(req.method||'GET')){
        const chunks=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>250000){reply(res,413,'{"error":"Deze replay is te groot."}');return;}chunks.push(chunk);}
        body=Buffer.concat(chunks);
      }
      const init={method:req.method,headers:req.headers};
      if(body?.length)init.body=body;
      const response=await progressAPI(new Request(`http://selfhost${url.pathname}${url.search}`,init),db);
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
    const cache=/-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(file)?'public, max-age=31536000, immutable':ext==='.html'||ext==='.json'?'no-cache':'public, max-age=86400';
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
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{sqlite.close();process.exit(0);}));
