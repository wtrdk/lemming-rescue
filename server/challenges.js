import {validReplay} from './progress.js';
const modes=['saved','skills','time'];
const comparison={saved:['saved','skills','ticks'],skills:['skills','saved','ticks'],time:['ticks','saved','skills']};
export function compare(mode,a,b){for(const key of comparison[mode]){const n=key==='saved'?b[key]-a[key]:a[key]-b[key];if(n)return n;}return 0;}
export function initChallenges(sqlite,levels){
  sqlite.exec(`CREATE TABLE IF NOT EXISTS challenge_records (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,level_id TEXT NOT NULL,
    mode TEXT NOT NULL,saved INTEGER NOT NULL,total INTEGER NOT NULL,skills INTEGER NOT NULL,
    ticks INTEGER NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(user_id,level_id,mode));
    CREATE TABLE IF NOT EXISTS app_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  if(!sqlite.prepare("SELECT value FROM app_meta WHERE key='challenges-v1'").get()){
    sqlite.exec('BEGIN IMMEDIATE');
    try{for(const row of sqlite.prepare('SELECT * FROM progress').all()){
      try{recordChallenge(sqlite,levels,row.user_id,{levelId:row.level_id,...row,completed:Boolean(row.completed),replay:JSON.parse(row.replay)});}catch{}
    }sqlite.exec("INSERT INTO app_meta VALUES('challenges-v1','done'); COMMIT");}catch(error){sqlite.exec('ROLLBACK');throw error;}
  }
}
export function recordChallenge(sqlite,levels,userId,p){
  const level=levels.find(l=>l.id===p.levelId);
  if(!level||p.practice===true||p.completed!==true||p.total!==level.total||!Number.isInteger(p.saved)||p.saved<level.required||p.saved>p.total||!validReplay(p.replay,p.levelId)||p.replay.ticks!==p.ticks||p.ticks<1||p.ticks>Math.ceil(level.timeSeconds*50/3)+1)return false;
  if(p.replay.saved!==undefined&&p.replay.saved!==p.saved)return false;
  const entry={saved:p.saved,total:p.total,ticks:p.ticks,skills:p.replay.commands.filter(c=>c.type==='skill').length};
  for(const mode of modes){
    const old=sqlite.prepare('SELECT saved,skills,ticks FROM challenge_records WHERE user_id=? AND level_id=? AND mode=?').get(userId,p.levelId,mode);
    if(!old||compare(mode,entry,old)<0)sqlite.prepare(`INSERT INTO challenge_records VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id,level_id,mode) DO UPDATE SET saved=excluded.saved,total=excluded.total,skills=excluded.skills,ticks=excluded.ticks,updated_at=excluded.updated_at`)
      .run(userId,p.levelId,mode,entry.saved,entry.total,entry.skills,entry.ticks,new Date().toISOString());
  }return true;
}
export function leaderboard(sqlite,levels,levelId,mode){
  if(!modes.includes(mode)||!levels.some(l=>l.id===levelId))throw new Error('Onbekend level of onbekende challenge.');
  const rows=sqlite.prepare('SELECT u.username,c.saved,c.total,c.skills,c.ticks,c.updated_at FROM challenge_records c JOIN users u ON u.id=c.user_id WHERE c.level_id=? AND c.mode=?').all(levelId,mode);
  rows.sort((a,b)=>compare(mode,a,b)||a.username.localeCompare(b.username));
  const metric=mode==='time'?'ticks':mode;let previous=null,rank=0;
  return rows.map((row,i)=>{if(row[metric]!==previous)rank=i+1;previous=row[metric];return{...row,rank,seconds:row.ticks*3/50};});
}
