import {defineConfig} from 'vite';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {progressAPI} from './server/progress.js';
const previewProgress={name:'game-progress-preview',configureServer(server){
  mkdirSync('.sites-runtime',{recursive:true});const sqlite=new DatabaseSync('.sites-runtime/game-progress.sqlite');
  // Apply generated, tracked migrations only in this local preview database.
  const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8'));
  sqlite.exec('CREATE TABLE IF NOT EXISTS preview_migrations (tag TEXT PRIMARY KEY)');
  for(const entry of journal.entries){if(!sqlite.prepare('SELECT tag FROM preview_migrations WHERE tag=?').get(entry.tag)){
    sqlite.exec(readFileSync(`drizzle/${entry.tag}.sql`,'utf8'));sqlite.prepare('INSERT INTO preview_migrations VALUES (?)').run(entry.tag);
  }}
  const db={prepare(sql){return{bind(...values){return{run:async()=>sqlite.prepare(sql).run(...values)};},all:async()=>({results:sqlite.prepare(sql).all()})};}};
  server.middlewares.use('/api/progress',async(req,res)=>{
    const chunks=[];for await(const c of req)chunks.push(c);
    const request=new Request('http://preview/api/progress',{method:req.method,headers:{'content-type':'application/json'},...(req.method==='GET'?{}:{body:Buffer.concat(chunks)})});
    const response=await progressAPI(request,db);res.statusCode=response.status;for(const[k,v]of response.headers)res.setHeader(k,v);res.end(await response.text());
  });
}};
export default defineConfig({plugins:[previewProgress],server:{host:'0.0.0.0',allowedHosts:['terminal.local']},build:{outDir:'dist/client',rollupOptions:{input:{main:'index.html',rescue:'rescue.html',versus:'versus.html'}}}});
