import fs from 'node:fs';
const server=fs.readFileSync(new URL('../server.cjs',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
const render=fs.readFileSync(new URL('../render.yaml',import.meta.url),'utf8');
const checks=[
  [server.includes("/api/admin/backup/full"),'missing full backup endpoint'],
  [server.includes("database.json") && server.includes("uploads"),'backup does not include database/uploads'],
  [admin.includes('data-panel="database"'),'missing Database admin navigation'],
  [admin.includes('Завантажити повну резервну копію'),'missing backup download button'],
  [render.includes('value: "13031234"'),'admin password not embedded in render.yaml'],
];
const failed=checks.filter(([ok])=>!ok).map(([,msg])=>msg);
if(failed.length){console.error(failed.join('\n'));process.exit(1)}
console.log('backup-admin checks passed');
