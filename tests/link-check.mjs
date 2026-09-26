import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const port=4100+Math.floor(Math.random()*100);
const dataDir=await mkdtemp(path.join(tmpdir(),'svitco-links-'));
const server=spawn(process.execPath,['server.cjs'],{cwd:path.resolve('.'),env:{...process.env,PORT:String(port),DATA_DIR:dataDir,ADMIN_PASSWORD:'test-password-123',SESSION_SECRET:'test-secret-with-more-than-thirty-two-characters'},stdio:'ignore'});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function ready(){for(let i=0;i<40;i++){try{if((await fetch(`http://localhost:${port}/api/health`)).ok)return}catch{}await wait(100)}throw new Error('Server did not start.');}
try{
  await ready();
  for(const route of ['/','/uk','/en','/admin','/robots.txt','/sitemap.xml']){
    const response=await fetch(`http://localhost:${port}${route}`);
    if(!response.ok)throw new Error(`${route} returned ${response.status}`);
  }
  for(const route of ['/uk','/en','/admin']){
    const html=await (await fetch(`http://localhost:${port}${route}`)).text();
    const ids=new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]));
    for(const match of html.matchAll(/\shref="#([^"]+)"/g))if(!ids.has(match[1]))throw new Error(`${route} contains missing anchor #${match[1]}`);
    const assets=[...html.matchAll(/\s(?:src|href)="(\/(?:assets|css|js)\/[^"#?]+|\/favicon\.svg)"/g)].map(match=>match[1]);
    for(const asset of new Set(assets)){
      const response=await fetch(`http://localhost:${port}${asset}`);
      if(!response.ok)throw new Error(`${route} asset ${asset} returned ${response.status}`);
    }
  }
  console.log('Page, anchor and local asset link checks passed.');
}finally{
  server.kill('SIGTERM');
  await rm(dataDir,{recursive:true,force:true});
}
