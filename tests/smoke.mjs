import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const port = 3400 + Math.floor(Math.random() * 300);
const dataDir = await mkdtemp(path.join(tmpdir(), 'renovation-site-'));
const server = spawn(process.execPath, ['server.cjs'], { cwd: path.resolve('.'), env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, ADMIN_PASSWORD: 'test-password-123', SESSION_SECRET: 'test-secret-with-more-than-thirty-two-characters' }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
server.stdout.on('data', (d) => logs += d);
server.stderr.on('data', (d) => logs += d);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
async function ready(){for(let i=0;i<30;i++){try{const response=await fetch(`http://localhost:${port}/api/health`);if(response.ok)return}catch{}await wait(120)}throw new Error(`Server did not start: ${logs}`)}
try {
  await ready();
  const page = await fetch(`http://localhost:${port}/uk`);
  if (!page.ok || !(await page.text()).includes('leadForm')) throw new Error('Public page smoke test failed.');
  const site = await fetch(`http://localhost:${port}/api/site`);
  if (!site.ok || !(await site.json()).settings) throw new Error('Site API smoke test failed.');
  const lead = await fetch(`http://localhost:${port}/api/leads`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({locale:'uk',name:'Test Client',preferredContact:'email',email:'test@example.com',message:'Test request',consent:true}) });
  if (lead.status !== 201) throw new Error(`Lead API smoke test failed: ${await lead.text()}`);
  const login = await fetch(`http://localhost:${port}/api/admin/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:'test-password-123'}) });
  if (!login.ok || !login.headers.get('set-cookie')) throw new Error('Admin login smoke test failed.');
  console.log('Smoke tests passed.');
} finally {
  server.kill('SIGTERM');
  await rm(dataDir, { recursive:true, force:true });
}
