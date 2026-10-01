import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {progressAPI} from './progress.js';

const root=path.resolve(process.env.STATIC_DIR||'./dist/client');
const dataDir=path.resolve(process.env.DATA_DIR||'./data');
const port=Number(process.env.PORT||8080);
const host=process.env.HOST||'0.0.0.0';
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
