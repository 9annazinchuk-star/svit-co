import fs from 'node:fs';
const admin=fs.readFileSync(new URL('../public/js/admin.js',import.meta.url),'utf8');
const server=fs.readFileSync(new URL('../server.cjs',import.meta.url),'utf8');
const checks=[
  [admin.includes('deleteMediaByUrl'), 'admin delete helper missing'],
  [admin.includes('removeEverywhere:true'), 'admin does not request full deletion'],
  [admin.includes('Видалити його ПОВНІСТЮ'), 'full-delete confirmation missing'],
  [server.includes('removeEverywhere=req.body?.removeEverywhere===true'), 'server removeEverywhere support missing'],
  [server.includes("p.images=(p.images||[]).filter(im=>im.url!==from)"), 'project gallery cleanup missing'],
  [server.includes("s.images=(s.images||[]).filter(im=>im.url!==from)"), 'section gallery cleanup missing']
];
const failed=checks.filter(([ok])=>!ok);
if(failed.length){for(const [,msg] of failed) console.error(msg);process.exit(1)}
console.log('photo delete v11 checks passed');
