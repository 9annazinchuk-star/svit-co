import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const admin=read('public/js/admin.js'), app=read('public/js/app.js'), ah=read('public/admin.html'), ih=read('public/index.html'), server=read('server.cjs'), css=read('public/css/admin.css');
const assert=(x,m)=>{if(!x)throw new Error(m)};
// Literal DOM ids used from JS must exist in corresponding HTML.
for(const [js,html,name] of [[admin,ah,'admin'],[app,ih,'public']]){
  const ids=[...js.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map(m=>m[1]);
  for(const id of new Set(ids)){const exists=html.includes(`id=\"${id}\"`)||html.includes(`id='${id}'`)||js.includes(`id=\"${id}\"`)||js.includes(`id=\\\"${id}\\\"`);assert(exists,`${name}: missing #${id}`);}
}
// Every asset photo path referenced by server/app must exist.
const refs=[...new Set([...server.matchAll(/['"](\/assets\/photos\/[^'"]+)['"]/g),...app.matchAll(/['"](\/assets\/photos\/[^'"]+)['"]/g)].map(m=>m[1]))];
for(const ref of refs) assert(fs.existsSync(path.join(root,'public',ref)),`missing asset ${ref}`);
// Critical public navigation targets exist.
for(const id of ['projects','services','process','team','contact']) assert(new RegExp(`id=["']${id}["']`).test(ih),`missing public nav target ${id}`);
// Full media controls coverage.
assert(ah.includes('heroDirectUploadButton'),'hero direct upload missing');
for(const token of ["mediaField('image','Зображення послуги'","mediaField('photo','Фото майстра'","mediaField('coverImage','Обкладинка'","mediaField('image','Основне зображення'"]) assert(admin.includes(token),`missing media field: ${token}`);
assert(admin.includes('uploadGalleryMedia')&&admin.includes('galleryDirectUpload'),'direct gallery upload missing');
assert(admin.includes("edit.kind==='projects'||edit.kind==='sections'"),'gallery persistence for sections/projects missing');
assert(server.includes('images:Array.isArray(b.images)'),'server section gallery persistence missing');
assert(server.includes('Галерея секції'),'media usage for section gallery missing');
assert(app.includes("s.type==='gallery'"),'public custom gallery render missing');
// Backup/restore, auth, social links.
for(const token of ['/api/admin/backup/full','/api/admin/backup/restore','requireAdmin','ADMIN_PASSWORD','facebook','instagram']) assert(server.includes(token),`server missing ${token}`);
assert(ah.includes('name="facebook"')&&ah.includes('name="instagram"'),'social inputs missing');
assert(app.includes("socialItem('Facebook'")&&app.includes("socialItem('Instagram'"),'social public render missing');
// Mobile admin modal accessibility.
for(const token of ['height:100dvh','safe-area-inset-bottom','overflow-y:auto']) assert(css.includes(token),`mobile admin CSS missing ${token}`);
// No dangerous free-form script editor.
assert(!ah.includes('name="javascript"')&&!ah.includes('name="html"'),'unsafe free-form editor field found');
assert(server.includes('database-corrupt-')&&server.includes('Файл НЕ перезаписано'),'corrupt DB overwrite protection missing');
assert(server.includes('starterProjectsV6')&&server.includes('projects:clone(starterProjects)'),'editable starter portfolio migration missing');
console.log(`deep audit v8 static checks passed (${refs.length} referenced photo assets verified).`);
