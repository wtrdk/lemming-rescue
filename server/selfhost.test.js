import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {openUsers,createUser,hashPassword,verifyPassword} from './users.js';
import {progressAPI} from './progress.js';
import {Backups} from './backups.js';
import {changeRole,deleteUser} from './users.js';
const sample=(saved=5)=>({levelId:'fun-1',saved,total:10,ticks:100,completed:false,replay:{version:'native-1',levelId:'fun-1',ticks:100,commands:[]}});
const legacySchema=`CREATE TABLE progress(level_id TEXT PRIMARY KEY,saved INTEGER,total INTEGER,percent INTEGER,completed INTEGER,ticks INTEGER,replay TEXT,updated_at TEXT)`;
const adapter=sqlite=>({prepare(sql){const statement=sqlite.prepare(sql);return{all:async()=>({results:statement.all()}),bind(...v){return{all:async()=>({results:statement.all(...v)}),run:async()=>statement.run(...v)}}}}});
test('Existing Site progress API retains the shared schema',async()=>{
  const db=new DatabaseSync(':memory:');db.exec(legacySchema);
  const put=await progressAPI(new Request('http://test/api/progress',{method:'PUT',body:JSON.stringify(sample())}),adapter(db));assert.equal(put.status,200);
  const read=await progressAPI(new Request('http://test/api/progress'),adapter(db));assert.equal((await read.json()).progress[0].percent,50);db.close();
});
test('Authentication, migration, user isolation, logout and session revocation',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'lemming-users-'));
  const seed=new DatabaseSync(path.join(directory,'progress.sqlite'));seed.exec(legacySchema);
  seed.prepare('INSERT INTO progress VALUES(?,?,?,?,?,?,?,?)').run('fun-1',5,10,50,0,100,JSON.stringify(sample().replay),'2026-01-01');seed.close();
  const port=19381,base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['server/selfhost.js'],{cwd:process.cwd(),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATA_DIR:directory,STATIC_DIR:path.resolve('dist/client'),LEMMING_RESCUE_USERNAME:'wtrdk',LEMMING_RESCUE_PASSWORD:'first-owner-password'}});
  let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
  let store;
  try{
    await new Promise((resolve,reject)=>{const deadline=setTimeout(()=>reject(new Error('Server startup: '+output)),10000);const check=setInterval(()=>{if(output.includes('luistert')){clearInterval(check);clearTimeout(deadline);resolve();}else if(child.exitCode!==null){clearInterval(check);clearTimeout(deadline);reject(new Error(output));}},20);});
    store=await openUsers(directory);await createUser(store,'alice','second-user-password');
    const request=(route,init={})=>fetch(base+route,{redirect:'manual',...init});
    const login=async(name,password)=>{const r=await request('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:name,password})});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);return r.headers.get('set-cookie').split(';')[0];};
    assert.equal((await request('/api/progress')).status,401);
    const loginPage=await request('/');assert.match(loginPage.headers.get('content-security-policy'),/img-src data:/);
    const loginHtml=await loginPage.text();assert.match(loginHtml,/name="username"/);assert.match(loginHtml,/<canvas id="lemmingScene">/);assert.match(loginHtml,/data:image\/png;base64,[A-Za-z0-9+/]+=*/);
    const sceneScript=loginHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert.ok(sceneScript);assert.doesNotThrow(()=>new Function(sceneScript));
    const owner=await login('WTRDK','first-owner-password'),alice=await login('alice','second-user-password');
    const get=cookie=>request('/api/progress',{headers:{cookie}}).then(r=>r.json());
    assert.equal((await get(owner)).progress[0].percent,50);assert.deepEqual((await get(alice)).progress,[]);
    const put=async(cookie,saved)=>request('/api/progress',{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({...sample(saved),userId:1})});
    assert.equal((await put(alice,8)).status,200);assert.equal((await put(owner,6)).status,200);
    assert.equal((await get(owner)).progress[0].percent,60);assert.equal((await get(alice)).progress[0].percent,80);
    assert.equal((await put(alice,7)).status,200);assert.equal((await get(alice)).progress[0].percent,80);
    const html=await request('/',{headers:{cookie:alice}});assert.equal(html.headers.get('cache-control'),'private, no-store');assert.match(await html.text(),/Ingelogd als <strong>alice/);
    // Web roles, protected management, password changes and backup downloads.
    const admin=await request('/api/admin/users',{headers:{cookie:owner}});assert.equal(admin.status,200);
    const accounts=await admin.json();assert.equal(accounts.users.find(u=>u.username==='wtrdk').isAdmin,true);assert.equal(JSON.stringify(accounts).includes('password_hash'),false);
    for(const endpoint of ['/admin','/api/admin/users','/api/admin/backups'])assert.equal((await request(endpoint,{headers:{cookie:alice}})).status,403);
    const edit=(route,method,body,cookie=owner)=>request(route,{method,headers:{cookie,'content-type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await edit('/api/admin/users','POST',{username:'bob',password:'bob-first-password',isAdmin:false})).status,201);
    const bobId=store.prepare("SELECT id FROM users WHERE username='bob'").get().id;
    assert.equal((await edit('/api/admin/users/'+bobId,'PATCH',{isAdmin:true})).status,200);
    const bob=await login('bob','bob-first-password');assert.equal((await request('/admin',{headers:{cookie:bob}})).status,200);
    assert.equal((await edit('/api/admin/users/'+bobId,'PATCH',{isAdmin:false})).status,200);assert.equal((await request('/api/admin/users',{headers:{cookie:bob}})).status,403);
    assert.equal((await edit('/api/admin/users/'+accounts.currentUserId,'DELETE',{confirmation:'wtrdk'})).status,400);
    assert.throws(()=>changeRole(store,accounts.currentUserId,false),/laatste beheerder/);
    assert.throws(()=>deleteUser(store,accounts.currentUserId),/laatste beheerder/);
    assert.equal((await edit('/api/admin/users/'+bobId+'/password','POST',{password:'bob-second-password'})).status,200);
    assert.equal((await request('/api/progress',{headers:{cookie:bob}})).status,401);
    const bob2=await login('bob','bob-second-password');
    assert.equal((await edit('/api/account/password','POST',{currentPassword:'bad',newPassword:'bob-third-password'},bob2)).status,400);
    assert.equal((await edit('/api/account/password','POST',{currentPassword:'bob-second-password',newPassword:'bob-third-password'},bob2)).status,200);
    assert.equal((await request('/api/progress',{headers:{cookie:bob2}})).status,401);
    const bob3=await login('bob','bob-third-password');
    assert.equal((await edit('/api/admin/users/'+bobId,'DELETE',{confirmation:'wrong'})).status,400);
    assert.equal((await edit('/api/admin/users/'+bobId,'DELETE',{confirmation:'bob'})).status,200);
    assert.equal((await request('/api/progress',{headers:{cookie:bob3}})).status,401);
    const challenge=async(cookie,saved,skills,ticks,practice=false)=>edit('/api/progress','PUT',{...sample(saved),completed:true,ticks,practice,replay:{...sample().replay,ticks,commands:Array.from({length:skills},()=>({type:'skill',tick:50,lemming:1,skill:7}))}},cookie);
    assert.equal((await challenge(owner,6,4,200)).status,200);
    assert.equal((await challenge(owner,5,2,300)).status,200);
    assert.equal((await challenge(owner,5,3,100)).status,200);
    assert.equal((await challenge(alice,8,3,150)).status,200);
    const scores=mode=>request('/api/leaderboard?level=fun-1&mode='+mode,{headers:{cookie:owner}}).then(r=>r.json());
    assert.equal((await scores('saved')).records[0].username,'alice');
    assert.equal((await scores('skills')).records[0].skills,2);
    assert.equal((await scores('time')).records[0].ticks,100);
    assert.equal((await challenge(owner,10,0,1,true)).status,200);assert.equal((await scores('saved')).records.find(r=>r.username==='wtrdk').saved,6);
    assert.equal((await challenge(alice,8,3,100)).status,200);assert.deepEqual((await scores('time')).records.map(r=>r.rank),[1,1]);
    assert.equal((await request('/api/leaderboard')).status,401);
    const backup=await edit('/api/admin/backups','POST',{});assert.equal(backup.status,201);const {name}=await backup.json();
    const bytes=await request('/api/admin/backups/'+name,{headers:{cookie:owner}});assert.equal(bytes.status,200);assert.equal(bytes.headers.get('cache-control'),'private, no-store');
    const restored=path.join(directory,'restored.sqlite');await writeFile(restored,Buffer.from(await bytes.arrayBuffer()));const recovered=new DatabaseSync(restored,{readOnly:true});
    assert.equal(recovered.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(recovered.prepare('SELECT COUNT(*) AS n FROM users').get().n,2);assert.equal(recovered.prepare('SELECT COUNT(*) AS n FROM challenge_records').get().n,6);recovered.close();
    assert.equal((await request('/api/admin/backups/'+name,{headers:{cookie:alice}})).status,403);
    assert.equal((await request('/api/admin/backups/not-a-backup',{headers:{cookie:owner}})).status,400);
    const status=await (await request('/api/admin/backups',{headers:{cookie:owner}})).json();assert.equal(status.hour,3);assert.equal(status.timezone,'Europe/Amsterdam');assert.ok(status.files.length>=2);
    assert.equal((await request('/api/auth/logout',{method:'POST',headers:{cookie:alice,origin:'http://evil.example'}})).status,403);
    assert.equal((await request('/api/auth/logout',{method:'POST',headers:{cookie:alice}})).status,303);assert.equal((await request('/api/progress',{headers:{cookie:alice}})).status,401);
    const renewed=await login('alice','second-user-password');store.prepare('UPDATE users SET password_hash=? WHERE username=?').run(await hashPassword('changed-user-password'),'alice');
    assert.equal((await request('/api/progress',{headers:{cookie:renewed}})).status,401);
    const alice2=await login('alice','changed-user-password');store.prepare('DELETE FROM users WHERE username=?').run('alice');assert.equal((await request('/api/progress',{headers:{cookie:alice2}})).status,401);
    const hashes=store.prepare('SELECT password_hash FROM users').all();assert.equal(hashes[0].password_hash.includes('first-owner-password'),false);assert.equal(await verifyPassword('first-owner-password',hashes[0].password_hash),true);
    for(let i=0;i<10;i++)assert.equal((await request('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'wtrdk',password:'bad'})})).status,401);
    assert.equal((await request('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'wtrdk',password:'bad'})})).status,429);
    assert.equal((await request('/api/health')).status,200);
  }finally{
    store?.close();const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill();await stopped;await rm(directory,{recursive:true,force:true});
  }
});


test('Daily backup timing, duplicate prevention, retention and consistent SQLite recovery',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'lemming-backups-')),db=new DatabaseSync(':memory:');
  db.exec("CREATE TABLE test(value TEXT); INSERT INTO test VALUES('before')");
  try{
    const backups=new Backups(db,directory,{days:2,hour:3,timezone:'Europe/Amsterdam'});
    await backups.check(new Date('2026-10-01T00:00:00Z'));assert.equal((await backups.list()).length,1);
    await backups.check(new Date('2026-10-01T02:00:00Z'));assert.equal((await backups.list()).length,1);
    await backups.check(new Date('2026-10-02T00:30:00Z'));assert.equal((await backups.list()).length,1);
    db.exec("INSERT INTO test VALUES('after')");
    await backups.check(new Date('2026-10-02T01:00:00Z'));assert.equal((await backups.list()).length,2);
    const file=backups.file('lemming-2026-10-02.sqlite'),restored=new DatabaseSync(file,{readOnly:true});assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM test').get().n,2);restored.close();
    for(const row of await backups.list())await utimes(backups.file(row.name),new Date('2026-10-01T00:00:00Z'),new Date('2026-10-01T00:00:00Z'));
    await backups.check(new Date('2026-10-05T01:00:00Z'));assert.equal((await backups.list()).length,1);
    assert.throws(()=>backups.file('../progress.sqlite'),/Ongeldige/);
  }finally{db.close();await rm(directory,{recursive:true,force:true});}
});
