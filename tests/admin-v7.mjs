import fs from 'node:fs';
const html=fs.readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/css/admin.css',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../public/js/admin.js',import.meta.url),'utf8');
const server=fs.readFileSync(new URL('../server.cjs',import.meta.url),'utf8');
function must(cond,msg){if(!cond)throw new Error(msg)}
must(!html.includes('Керуйте сайтом без редагування коду.'),'login marketing copy should be removed');
must(html.includes('id="restoreBackupForm"'),'restore form missing');
must(server.includes("/api/admin/backup/restore"),'restore endpoint missing');
must(server.includes('before-restore-'),'safety backup before restore missing');
must(html.includes('name="facebook"')&&html.includes('name="instagram"'),'social URL fields missing');
must(js.includes("not_configured:'Не налаштовано'"),'notification status should be localized');
must(css.includes('.media-upload .media-upload-submit'),'media upload alignment rules missing');
must(css.includes('.lead-card>.card-actions'),'lead action alignment rules missing');
console.log('admin v7 checks passed');
