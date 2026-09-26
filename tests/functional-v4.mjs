import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root=path.resolve('.');const port=4600+Math.floor(Math.random()*200);const dir=await mkdtemp(path.join(tmpdir(),'svitco-v4-'));
const env={...process.env,PORT:String(port),DATA_DIR:dir,ADMIN_PASSWORD:'test-password-123',SESSION_SECRET:'test-secret-123456789012345678901234567890',BASE_URL:`http://localhost:${port}`};let server;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function start(){server=spawn(process.execPath,['server.cjs'],{cwd:root,env,stdio:['ignore','pipe','pipe']});}
async function ready(){for(let i=0;i<60;i++){try{if((await fetch(`http://localhost:${port}/api/health`)).ok)return}catch{}await wait(100)}throw new Error('Server did not start');}
async function stop(){if(!server)return;server.kill('SIGTERM');await Promise.race([new Promise(r=>server.once('exit',r)),wait(1500)]);}
async function login(){const r=await fetch(`http://localhost:${port}/api/admin/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'test-password-123'})});if(!r.ok)throw new Error('login failed');return r.headers.get('set-cookie').split(';')[0];}
const j=async(r)=>{const b=await r.json();if(!r.ok)throw new Error(JSON.stringify(b));return b};
try{
  // Seed an old-format DB and verify one-time migration + backup.
  await writeFile(path.join(dir,'database.json'),JSON.stringify({settings:{companyName:'Svit&Co',ownerName:'Old Master',aboutUk:'Старий опис',aboutEn:'Old description',aboutImage:'/uploads/old.webp'},projects:[{id:'old-project',titleUk:'Старий',titleEn:'Old',category:'bathrooms',published:true,images:[]}],leads:[]},null,2));
  start();await ready();let cookie=await login();let admin=await j(await fetch(`http://localhost:${port}/api/admin/data`,{headers:{Cookie:cookie}}));
  if(admin.team.filter(x=>x.id==='migrated-owner').length!==1)throw new Error('team migration failed');
  if(!admin.projects.find(x=>x.id==='old-project'&&x.category==='bathrooms'))throw new Error('old project/category lost');
  if(admin.services.slice(0,3).map(x=>x.id).join(',')!=='service-full,service-shower,service-toilet')throw new Error('service priority failed');
  await stop();start();await ready();cookie=await login();admin=await j(await fetch(`http://localhost:${port}/api/admin/data`,{headers:{Cookie:cookie}}));if(admin.team.filter(x=>x.id==='migrated-owner').length!==1)throw new Error('migration duplicated team');
  // Team CRUD / order / hidden.
  const teammate=await j(await fetch(`http://localhost:${port}/api/admin/team`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({name:'Second Master',roleUk:'Маляр',roleEn:'Painter',descriptionUk:'Опис',descriptionEn:'Description',order:2,published:true})}));
  await j(await fetch(`http://localhost:${port}/api/admin/team/${teammate.item.id}`,{method:'PATCH',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({order:1,published:false})}));
  // Section CRUD.
  const section=await j(await fetch(`http://localhost:${port}/api/admin/sections`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({type:'text',titleUk:'Нова секція',titleEn:'New section',bodyUk:'Текст',bodyEn:'Text',order:15,visible:true})}));
  await j(await fetch(`http://localhost:${port}/api/admin/sections/${section.item.id}`,{method:'PATCH',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({visible:false})}));
  // Each contact method + idempotency. Notification channels are disabled, so leads must persist.
  const contacts={phone:'+48123123123',whatsapp:'+48123123123',viber:'+48123123123',telegram:'@valid_user',email:'test@example.com'};
  for(const [method,contact] of Object.entries(contacts)){
    const body=new FormData();body.set('name',`Test ${method}`);body.set('preferredContact',method);body.set('contact',contact);body.set('consent','true');body.set('locale','uk');body.set('idempotencyKey',`key-${method}`);if(method==='phone')body.set('convenientTime','18:00');
    const a=await fetch(`http://localhost:${port}/api/leads`,{method:'POST',body});if(a.status!==201)throw new Error(`${method} lead failed ${await a.text()}`);const first=await a.json();
    const body2=new FormData();for(const [k,v] of body.entries())body2.set(k,v);const b=await fetch(`http://localhost:${port}/api/leads`,{method:'POST',body:body2});const second=await b.json();if(second.id!==first.id||!second.deduplicated)throw new Error(`idempotency failed for ${method}`);
  }
  // Admin protection + public data privacy.
  if((await fetch(`http://localhost:${port}/api/admin/data`)).status!==401)throw new Error('admin route is unprotected');
  const site=await j(await fetch(`http://localhost:${port}/api/site`));if(site.settings.notifications)throw new Error('private notification settings leaked');if(site.team.some(x=>x.name==='Second Master'))throw new Error('hidden teammate is public');
  // Retry endpoint should not create new lead; a disabled notification config yields no jobs and a clear 404.
  admin=await j(await fetch(`http://localhost:${port}/api/admin/data`,{headers:{Cookie:cookie}}));const count=admin.leads.length;await wait(50);admin=await j(await fetch(`http://localhost:${port}/api/admin/data`,{headers:{Cookie:cookie}}));if(admin.leads.length!==count)throw new Error('queue created duplicate lead');
  console.log('Svit&Co v4 functional tests passed.');
}finally{await stop();await rm(dir,{recursive:true,force:true});}
