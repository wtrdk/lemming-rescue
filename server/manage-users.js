import path from 'node:path';
import {createInterface} from 'node:readline/promises';
import {openUsers,createUser,hashPassword,username,deleteUser,changeRole} from './users.js';
async function secret(label){
  if(!process.stdin.isTTY)throw new Error('Voer dit commando interactief uit met docker compose exec (zonder -T).');
  process.stdout.write(label);
  return new Promise((resolve,reject)=>{
    let value='';process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
    const done=()=>{process.stdin.removeListener('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};
    const onData=chunk=>{for(const char of chunk){if(char==='\u0003'){done();reject(new Error('Afgebroken.'));return;}if(char==='\r'||char==='\n'){done();resolve(value);return;}if(char==='\u007f'||char==='\b')value=value.slice(0,-1);else if(char>=' ')value+=char;}};
    process.stdin.on('data',onData);
  });
}
const [command,name]=process.argv.slice(2);
let sqlite;
try{
  if(!['list','add','password','delete','admin','user'].includes(command))throw new Error('Gebruik: node server/manage-users.js list | add NAAM | password NAAM | delete NAAM | admin NAAM | user NAAM');
  sqlite=await openUsers(path.resolve(process.env.DATA_DIR||'./data'));
  if(command==='list'){
    const rows=sqlite.prepare('SELECT username,created_at,is_admin FROM users ORDER BY username').all();
    for(const row of rows)console.log(row.username+' · '+(row.is_admin?'beheerder':'speler')+' · '+row.created_at.slice(0,10));
  }else{
    const normalized=username(name),existing=sqlite.prepare('SELECT id FROM users WHERE username=?').get(normalized);
    if(command==='add'&&existing)throw new Error('Deze gebruiker bestaat al.');
    if(command!=='add'&&!existing)throw new Error('Deze gebruiker bestaat niet.');
    if(command==='delete'){
      if(sqlite.prepare('SELECT COUNT(*) AS count FROM users').get().count<=1)throw new Error('De laatste gebruiker kan niet worden verwijderd.');
      const prompt=createInterface({input:process.stdin,output:process.stdout});
      const answer=await prompt.question('Verwijder '+normalized+' en alle bijbehorende scores? Typ de gebruikersnaam: ');prompt.close();
      if(answer!==normalized)throw new Error('Verwijderen afgebroken.');
      deleteUser(sqlite,existing.id);
      console.log('Gebruiker en voortgang verwijderd.');
    }else if(command==='admin'||command==='user'){changeRole(sqlite,existing.id,command==='admin');console.log('Rol gewijzigd.');
    }else{
      const password=await secret('Nieuw wachtwoord (minimaal 12 tekens): '),confirm=await secret('Herhaal wachtwoord: ');
      if(password!==confirm)throw new Error('De wachtwoorden verschillen.');
      if(command==='add')await createUser(sqlite,normalized,password);
      else sqlite.prepare('UPDATE users SET password_hash=? WHERE id=?').run(await hashPassword(password),existing.id);
      console.log(command==='add'?'Gebruiker aangemaakt.':'Wachtwoord gewijzigd; bestaande sessies zijn ingetrokken.');
    }
  }
}catch(error){console.error(error.message);process.exitCode=1;}finally{sqlite?.close();}
