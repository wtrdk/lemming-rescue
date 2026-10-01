import {build} from 'vite';
import {build as bundle} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
await build();
await bundle({entryPoints:['server/worker.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});
const hosting=JSON.parse(await readFile('.openai/hosting.json','utf8'));
const workerConfig={
  name:'lemming-rescue',
  main:'./index.js',
  compatibility_date:'2026-09-30',
  assets:{directory:'../client',binding:'ASSETS',run_worker_first:['/api/*']},
  ...(hosting.d1?{d1_databases:[{binding:hosting.d1,database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000'}]}:{})
};
await mkdir('dist/server',{recursive:true});
await writeFile('dist/server/wrangler.json',JSON.stringify(workerConfig,null,2)+'\n');
