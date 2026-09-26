import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const port = 3800 + Math.floor(Math.random() * 100);
const dataDir = await mkdtemp(path.join(tmpdir(), 'svitco-about-'));
const env = { ...process.env, PORT: String(port), DATA_DIR: dataDir, ADMIN_PASSWORD: 'test-password-123', SESSION_SECRET: 'test-secret-with-more-than-thirty-two-characters' };
let server;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function start(){ server = spawn(process.execPath, ['server.cjs'], { cwd:path.resolve('.'), env, stdio:'ignore' }); }
async function ready(){ for(let i=0;i<40;i++){ try{ const r=await fetch(`http://localhost:${port}/api/health`); if(r.ok)return; }catch{} await wait(100); } throw new Error('Server did not start.'); }
async function stop(){ if(!server)return; server.kill('SIGTERM'); await new Promise(resolve=>server.once('exit',resolve)); }
async function login(){ const r=await fetch(`http://localhost:${port}/api/admin/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'test-password-123'})}); if(!r.ok)throw new Error('Login failed.'); return r.headers.getSetCookie().map(value=>value.split(';')[0]).join('; '); }

try{
  start(); await ready();
  const cookie=await login();
  const form=new FormData();
  form.append('image',new Blob([await readFile('public/assets/favicon-32x32.png')],{type:'image/png'}),'test-logo.png');
  const upload=await fetch(`http://localhost:${port}/api/admin/about-image`,{method:'POST',headers:{Cookie:cookie},body:form});
  if(upload.status!==201)throw new Error(`Logo upload failed: ${await upload.text()}`);
  const uploaded=await upload.json();
  await stop();
  start(); await ready();
  const site=await (await fetch(`http://localhost:${port}/api/site`)).json();
  if(site.settings.aboutImage!==uploaded.url)throw new Error('Uploaded logo did not persist after restart.');
  console.log('About image upload and restart persistence passed.');
}finally{
 await stop(); await rm(dataDir,{recursive:true,force:true});
}

