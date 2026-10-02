import {backup,DatabaseSync} from 'node:sqlite';
import {mkdir,readdir,stat,chmod,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
const pattern=/^lemming-\d{4}-\d{2}-\d{2}(?:-\d{6}-[a-f0-9]{6})?\.sqlite$/;
export class Backups{
  constructor(sqlite,directory,{days=14,hour=3,timezone='Europe/Amsterdam'}={}){
    if(!Number.isInteger(days)||days<1||days>365||!Number.isInteger(hour)||hour<0||hour>23)throw new Error('Ongeldige backupinstellingen.');
    this.sqlite=sqlite;this.directory=path.resolve(directory);this.days=days;this.hour=hour;this.timezone=timezone;this.pending=null;this.error=null;
    this.clock=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
  }
  day(now=new Date()){const parts=Object.fromEntries(this.clock.formatToParts(now).map(p=>[p.type,p.value]));return{date:parts.year+'-'+parts.month+'-'+parts.day,hour:Number(parts.hour)};}
  file(name){if(!pattern.test(name))throw new Error('Ongeldige backupnaam.');return path.join(this.directory,name);}
  async list(){await mkdir(this.directory,{recursive:true,mode:0o700});const names=(await readdir(this.directory)).filter(n=>pattern.test(n));const rows=await Promise.all(names.map(async name=>{const info=await stat(this.file(name));return{name,size:info.size,createdAt:info.mtime.toISOString()};}));return rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  async create(manual=false,now=new Date()){
    if(this.pending)return this.pending;
    this.pending=this.perform(manual,now).then(result=>{this.error=null;return result;},error=>{this.error='Back-up mislukt: '+error.message;throw error;}).finally(()=>this.pending=null);
    return this.pending;
  }
  async perform(manual,now){
    const day=this.day(now),tag=manual?'-'+now.toISOString().slice(11,19).replaceAll(':','')+'-'+randomBytes(3).toString('hex'):'';
    const name='lemming-'+day.date+tag+'.sqlite',file=this.file(name),temp=file+'.partial';
    const rows=await this.list();if(!manual&&rows.some(r=>r.name===name))return name;
    const removeSidecars=async()=>{for(const suffix of ['-wal','-shm'])try{await unlink(temp+suffix);}catch(error){if(error.code!=='ENOENT')throw error;}};
    try{await backup(this.sqlite,temp);await chmod(temp,0o600);const check=new DatabaseSync(temp,{readOnly:true});try{if(check.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw new Error('De backupcontrole faalde.');}finally{check.close();}await removeSidecars();await rename(temp,file);}catch(e){await unlink(temp).catch(()=>{});await removeSidecars().catch(()=>{});throw e;}
    const cutoff=now.getTime()-this.days*86400000;
    for(const row of rows)if(new Date(row.createdAt).getTime()<cutoff)await unlink(this.file(row.name));
    console.log('Back-up gemaakt: '+name);return name;
  }
  async check(now=new Date()){const rows=await this.list();if(!rows.length||this.day(now).hour>=this.hour)await this.create(false,now);}
  async start(){await this.check().catch(e=>{this.error=e.message;console.error('Backup:',e.message);});this.timer=setInterval(()=>this.check().catch(e=>{this.error=e.message;console.error('Backup:',e.message);}),60000);this.timer.unref();}
  stop(){clearInterval(this.timer);}
  async status(){return{files:await this.list(),error:this.error,keepDays:this.days,hour:this.hour,timezone:this.timezone};}
}
