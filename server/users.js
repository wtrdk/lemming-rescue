import {randomBytes,scrypt as derive,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {DatabaseSync} from 'node:sqlite';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
const scrypt=promisify(derive);
// OWASP scrypt profile: N=2^15, r=8, p=3 (32 MiB).
const options={N:32768,r:8,p:3,maxmem:64*1024*1024};
export function username(value){
  const result=String(value||'').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(result))throw new Error('Gebruikersnaam: 3–32 letters, cijfers, punten, streepjes of underscores.');
  return result;
}
export async function hashPassword(password){
  if(typeof password!=='string'||password.length<12||password.length>256)throw new Error('Kies een wachtwoord van 12–256 tekens.');
  const salt=randomBytes(16).toString('hex');
  return 'scrypt-v1:'+salt+':'+Buffer.from(await scrypt(password,salt,64,options)).toString('hex');
}
export async function verifyPassword(password,encoded){
  if(typeof password!=='string'||password.length>256)return false;
  const [version,salt,hash]=encoded.split(':');
  if(version!=='scrypt-v1'||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(hash))return false;
  const actual=await scrypt(password,salt,64,options);
  return timingSafeEqual(actual,Buffer.from(hash,'hex'));
}
export async function openUsers(dataDir){
  await mkdir(dataDir,{recursive:true});
  const sqlite=new DatabaseSync(path.join(dataDir,'progress.sqlite'));
  sqlite.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, created_at TEXT NOT NULL
    );`);
  const columns=sqlite.prepare('PRAGMA table_info(users)').all();
  if(!columns.some(c=>c.name==='is_admin')){
    sqlite.exec('BEGIN IMMEDIATE');
    try{sqlite.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0 CHECK(is_admin IN (0,1))');
      sqlite.exec('UPDATE users SET is_admin=1 WHERE id=(SELECT MIN(id) FROM users)');sqlite.exec('COMMIT');
    }catch(error){sqlite.exec('ROLLBACK');throw error;}
  }
  return sqlite;
}
export async function createUser(sqlite,name,password,isAdmin=false){
  const normalized=username(name),hash=await hashPassword(password);
  if(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n===0)isAdmin=true;
  return sqlite.prepare('INSERT INTO users(username,password_hash,created_at,is_admin) VALUES(?,?,?,?)').run(normalized,hash,new Date().toISOString(),isAdmin?1:0);
}

export function changeRole(sqlite,id,isAdmin){
  sqlite.exec('BEGIN IMMEDIATE');
  try{
    const row=sqlite.prepare('SELECT is_admin FROM users WHERE id=?').get(id);
    if(!row)throw new Error('Gebruiker niet gevonden.');
    if(row.is_admin&&!isAdmin&&sqlite.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin=1').get().n<=1)throw new Error('De laatste beheerder moet behouden blijven.');
    sqlite.prepare('UPDATE users SET is_admin=? WHERE id=?').run(isAdmin?1:0,id);sqlite.exec('COMMIT');
  }catch(error){sqlite.exec('ROLLBACK');throw error;}
}
export function deleteUser(sqlite,id){
  sqlite.exec('BEGIN IMMEDIATE');
  try{
    const row=sqlite.prepare('SELECT is_admin FROM users WHERE id=?').get(id);
    if(!row)throw new Error('Gebruiker niet gevonden.');
    if(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n<=1)throw new Error('De laatste gebruiker moet behouden blijven.');
    if(row.is_admin&&sqlite.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin=1').get().n<=1)throw new Error('De laatste beheerder moet behouden blijven.');
    sqlite.prepare('DELETE FROM progress WHERE user_id=?').run(id);sqlite.prepare('DELETE FROM users WHERE id=?').run(id);sqlite.exec('COMMIT');
  }catch(error){sqlite.exec('ROLLBACK');throw error;}
}
