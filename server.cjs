const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const cookieSession = require('cookie-session');
const { rateLimit } = require('express-rate-limit');
const { execFile } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const execFileAsync = promisify(execFile);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'database.json');
const isProduction = process.env.NODE_ENV === 'production';
const baseUrl = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SCHEMA_VERSION = 6;

const defaultServices = [
  { id:'service-full', slug:'full-renovation', titleUk:'Ремонт квартир під ключ', titleEn:'Complete Apartment Renovation', descriptionUk:'Комплексний ремонт квартири та внутрішнє оздоблення від підготовчих робіт до фінальних деталей.', descriptionEn:'Complete apartment renovation and interior finishing from preparation through final details.', image:'/assets/photos/service-full.webp', imageAltUk:'Інтер’єр після комплексного ремонту квартири', imageAltEn:'Apartment interior after complete renovation', order:1, featured:true, published:true, portfolioCategory:'apartments' },
  { id:'service-shower', slug:'shower-rooms', titleUk:'Ремонт та облаштування душових кімнат', titleEn:'Shower Room Renovation', descriptionUk:'Оздоблення душової з увагою до гідроізоляції, плитки, сантехніки та практичного використання простору.', descriptionEn:'Shower room finishing with attention to waterproofing, tiling, plumbing and practical use of space.', image:'/assets/photos/bathroom-renovation.webp', imageAltUk:'Оздоблена душова кімната', imageAltEn:'Finished shower room', order:2, featured:false, published:true, portfolioCategory:'showers' },
  { id:'service-toilet', slug:'toilets', titleUk:'Ремонт туалетів', titleEn:'Toilet Renovation', descriptionUk:'Оновлення туалетів: підготовка поверхонь, плитка, сантехнічні роботи та чистове оздоблення.', descriptionEn:'Toilet renovation including surface preparation, tiling, plumbing and finish work.', image:'/assets/photos/sample-bathroom.webp', imageAltUk:'Оздоблений туалет', imageAltEn:'Finished toilet room', order:3, featured:false, published:true, portfolioCategory:'toilets' },
  { id:'service-kitchen', slug:'kitchens', titleUk:'Ремонт кухонь', titleEn:'Kitchen Renovation', descriptionUk:'Оздоблення кухонь, підготовка поверхонь, монтаж покриттів і завершальні роботи.', descriptionEn:'Kitchen finishing, surface preparation, installation of finishes and final works.', image:'/assets/photos/kitchen-renovation.webp', imageAltUk:'Відремонтована кухня', imageAltEn:'Renovated kitchen', order:4, featured:false, published:true, portfolioCategory:'kitchens' },
  { id:'service-finishing', slug:'finishing', titleUk:'Внутрішнє оздоблення', titleEn:'Interior Finishing', descriptionUk:'Шпаклювання, гіпсокартон, декоративні та інші внутрішні оздоблювальні роботи.', descriptionEn:'Plastering, drywall, decorative and other interior finishing work.', image:'/assets/photos/service-finishing.webp', imageAltUk:'Внутрішнє оздоблення приміщення', imageAltEn:'Interior finishing work', order:5, featured:false, published:true, portfolioCategory:'finishing' },
  { id:'service-painting', slug:'painting', titleUk:'Фарбування', titleEn:'Painting', descriptionUk:'Підготовка стін і стель та акуратне фінішне фарбування.', descriptionEn:'Wall and ceiling preparation followed by careful finish painting.', image:'/assets/photos/service-painting.webp', imageAltUk:'Фарбування стін', imageAltEn:'Interior wall painting', order:6, featured:false, published:true, portfolioCategory:'painting' },
  { id:'service-flooring', slug:'flooring', titleUk:'Підлога', titleEn:'Flooring', descriptionUk:'Підготовка основи та монтаж підлогових покриттів.', descriptionEn:'Subfloor preparation and flooring installation.', image:'/assets/photos/service-flooring.webp', imageAltUk:'Монтаж підлоги', imageAltEn:'Flooring installation', order:7, featured:false, published:true, portfolioCategory:'flooring' }
];

const defaultSections = [
  {id:'services',type:'services',order:10,visible:true,titleUk:'Послуги з ремонту',titleEn:'Renovation Services',descriptionUk:'Від окремої кімнати до комплексного ремонту квартири.',descriptionEn:'From a single room to a complete apartment renovation.'},
  {id:'projects',type:'portfolio',order:20,visible:true,titleUk:'Вибрані проєкти',titleEn:'Selected Projects',descriptionUk:'Приклади реальних робіт Svit&Co.',descriptionEn:'Examples of real Svit&Co work.'},
  {id:'process',type:'steps',order:30,visible:true,titleUk:'Як ми працюємо',titleEn:'How We Work',descriptionUk:'Зрозумілий процес від першого контакту до завершення робіт.',descriptionEn:'A clear process from first contact to project completion.'},
  {id:'team',type:'team',order:40,visible:true,titleUk:'Наша команда',titleEn:'Our Team',descriptionUk:'Фахівці, які працюють над вашим ремонтом.',descriptionEn:'The people working on your renovation.'},
  {id:'advantages',type:'advantages',order:50,visible:true,titleUk:'Наш підхід',titleEn:'Our Approach',descriptionUk:'Практичність, ясна комунікація та увага до деталей.',descriptionEn:'Practicality, clear communication and attention to detail.'},
  {id:'faq',type:'faq',order:60,visible:true,titleUk:'Поширені запитання',titleEn:'Frequently Asked Questions',descriptionUk:'Короткі відповіді перед першою розмовою.',descriptionEn:'Brief answers before our first conversation.'},
  {id:'contact',type:'cta',order:70,visible:true,titleUk:'Розкажіть про свій проєкт',titleEn:'Tell Us About Your Project',descriptionUk:'Залиште заявку й виберіть зручний спосіб відповіді.',descriptionEn:'Send a request and choose how you would like us to reply.'}
];


const starterProjects = [
  {id:'interior-apartment',category:'apartments',coverImage:'/assets/photos/sample-apartment.webp',titleUk:'Сучасний житловий інтер’єр',titleEn:'Contemporary Residential Interior',descriptionUk:'Світлий сучасний інтер’єр із чистими лініями, спокійними матеріалами та продуманою організацією простору.',descriptionEn:'A bright contemporary interior with clean lines, calm materials and carefully organised space.',longDescriptionUk:'Комплексний підхід до внутрішнього простору: підготовка поверхонь, оздоблення, робота з підлогою, стінами та деталями, які формують цілісний інтер’єр.',longDescriptionEn:'A complete approach to the interior: surface preparation, finishing, flooring, walls and the details that create a cohesive living space.',propertyTypeUk:'Квартира',propertyTypeEn:'Apartment',published:true,order:1,starterContent:true,images:[{id:'spi-1',url:'/assets/photos/sample-apartment.webp',order:0},{id:'spi-2',url:'/assets/photos/service-full.webp',order:1},{id:'spi-3',url:'/assets/photos/service-flooring.webp',order:2}]},
  {id:'kitchen-living',category:'kitchens',coverImage:'/assets/photos/sample-kitchen.webp',titleUk:'Кухня та житлова зона',titleEn:'Kitchen and Living Area',descriptionUk:'Функціональний житловий простір із сучасним оздобленням та візуально чистими переходами між зонами.',descriptionEn:'A functional living space with contemporary finishes and clean transitions between zones.',longDescriptionUk:'Приклад комплексного внутрішнього оздоблення кухні та житлової зони з акцентом на акуратні поверхні, покриття та завершальні деталі.',longDescriptionEn:'An example of complete interior finishing for a kitchen and living area, focused on precise surfaces, finishes and final details.',propertyTypeUk:'Кухня та вітальня',propertyTypeEn:'Kitchen & living room',published:true,order:2,starterContent:true,images:[{id:'spk-1',url:'/assets/photos/sample-kitchen.webp',order:0},{id:'spk-2',url:'/assets/photos/kitchen-renovation.webp',order:1},{id:'spk-3',url:'/assets/photos/service-painting.webp',order:2}]},
  {id:'shower-room',category:'showers',coverImage:'/assets/photos/sample-bathroom.webp',titleUk:'Сучасна душова кімната',titleEn:'Contemporary Shower Room',descriptionUk:'Практичне оформлення душової з акцентом на плитку, сантехніку та чисту геометрію.',descriptionEn:'A practical shower-room interior focused on tiling, plumbing and clean geometry.',longDescriptionUk:'Оздоблення душової кімнати включає підготовку основи, гідроізоляцію, плиточні та сантехнічні роботи, а також фінальне акуратне оформлення.',longDescriptionEn:'Shower-room finishing includes substrate preparation, waterproofing, tiling and plumbing work followed by careful final finishing.',propertyTypeUk:'Душова кімната',propertyTypeEn:'Shower room',published:true,order:3,starterContent:true,images:[{id:'sps-1',url:'/assets/photos/sample-bathroom.webp',order:0},{id:'sps-2',url:'/assets/photos/bathroom-renovation.webp',order:1},{id:'sps-3',url:'/assets/photos/service-finishing.webp',order:2}]},
  {id:'interior-finishing',category:'finishing',coverImage:'/assets/photos/about-workshop.webp',titleUk:'Внутрішнє оздоблення',titleEn:'Interior Finishing',descriptionUk:'Акуратне оновлення поверхонь і деталей, що формують завершений вигляд приміщення.',descriptionEn:'Careful finishing of surfaces and details that shape the completed interior.',longDescriptionUk:'Комплекс внутрішніх оздоблювальних робіт може включати гіпсокартон, шпаклювання, фарбування, підготовку поверхонь та монтаж фінішних покриттів.',longDescriptionEn:'Interior finishing can include drywall, plastering, painting, surface preparation and installation of final finishes.',propertyTypeUk:'Внутрішні приміщення',propertyTypeEn:'Interior spaces',published:true,order:4,starterContent:true,images:[{id:'spf-1',url:'/assets/photos/about-workshop.webp',order:0},{id:'spf-2',url:'/assets/photos/service-drywall.webp',order:1},{id:'spf-3',url:'/assets/photos/service-finishing.webp',order:2}]}
];

const initialDatabase = {
  schemaVersion: SCHEMA_VERSION,
  meta:{migrations:{},createdAt:new Date().toISOString()},
  settings: {
    companyName:'Svit&Co', logoUrl:'/assets/logo-svitco.webp',
    hero:{ titleUk:'Ремонт квартир під ключ', titleEn:'Complete Apartment Renovation', subtitleUk:'Комплексний ремонт квартир і внутрішнє оздоблення з увагою до деталей.', subtitleEn:'Complete apartment renovation and interior finishing with attention to detail.', image:'/assets/photos/hero-renovation.webp', imageAltUk:'Сучасний інтер’єр після ремонту', imageAltEn:'Modern interior after renovation', primaryTextUk:'Отримати консультацію', primaryTextEn:'Get a Consultation', primaryAction:'contact', secondaryTextUk:'Переглянути роботи', secondaryTextEn:'View Our Work', secondaryAction:'projects' },
    contacts:{ phone:'',email:'',whatsapp:'',viber:'',telegram:'',facebook:'',instagram:'',workingHours:'',serviceArea:'',availableMethods:['phone','whatsapp','viber','telegram','email'],visibleButtons:{phone:true,email:true,whatsapp:true,viber:true,telegram:true,facebook:true,instagram:true}},
    notifications:{ telegram:{enabled:false,chatId:'',configured:false}, email:{enabled:false,to:'',configured:false}, sms:{enabled:false,to:'',configured:false}, whatsapp:{enabled:false,to:'',configured:false}, maxAttempts:3, lastAttempts:[] },
    brand:{companyName:'Svit&Co',logoUrl:'/assets/logo-svitco.webp'},
    seo:{titleUk:'Ремонт квартир під ключ | Svit&Co',titleEn:'Complete Apartment Renovation | Svit&Co',descriptionUk:'Комплексний ремонт квартир та внутрішнє оздоблення Svit&Co.',descriptionEn:'Complete apartment renovation and interior finishing by Svit&Co.'},
    content:{advantages:[{id:'a1',uk:'Чітка комунікація',en:'Clear communication'},{id:'a2',uk:'Акуратне виконання',en:'Careful workmanship'},{id:'a3',uk:'Увага до деталей',en:'Attention to detail'}],steps:[{id:'s1',uk:'Знайомимося із завданням',en:'We learn about your project'},{id:'s2',uk:'Узгоджуємо обсяг робіт',en:'We agree on the scope'},{id:'s3',uk:'Виконуємо роботи',en:'We carry out the work'},{id:'s4',uk:'Передаємо результат',en:'We hand over the result'}],faq:[]}
  },
  services:defaultServices, projects:clone(starterProjects), team:[], sections:defaultSections, media:[], leads:[], notificationQueue:[]
};

let writeQueue = Promise.resolve();
let queueTimer = null;
function clone(v){return JSON.parse(JSON.stringify(v));}
function cleanText(value,max=4000){return String(value??'').replace(/[<>]/g,'').trim().slice(0,max);}
function bool(value){return value===true||value==='true'||value==='on'||value===1;}
function number(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function normalizePhone(value){return cleanText(value,50).replace(/[^+\d\s().-]/g,'');}
function normalizeTelegram(value){return cleanText(value,200).replace(/^@/,'');}
function safeEquals(a,b){const l=Buffer.from(String(a));const r=Buffer.from(String(b));return l.length===r.length&&crypto.timingSafeEqual(l,r);}
function id(){return crypto.randomUUID();}
function sortByOrder(items){return [...(items||[])].sort((a,b)=>(a.order??999)-(b.order??999));}
function publicSettings(settings){ const copy=clone(settings); delete copy.notifications; return copy; }
async function atomicWrite(data){writeQueue=writeQueue.then(async()=>{await fsp.mkdir(DATA_DIR,{recursive:true});const tmp=`${DB_PATH}.${process.pid}.tmp`;await fsp.writeFile(tmp,JSON.stringify(data,null,2),'utf8');await fsp.rename(tmp,DB_PATH);});return writeQueue;}
async function createBackup(reason='migration'){try{await fsp.access(DB_PATH);}catch{return;}await fsp.mkdir(BACKUP_DIR,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-');await fsp.copyFile(DB_PATH,path.join(BACKUP_DIR,`database-${stamp}-${reason}.json`));}
function mergeDefaults(target,defaults){if(Array.isArray(defaults))return Array.isArray(target)?target:clone(defaults);const out=(target&&typeof target==='object')?target:{};for(const [k,v] of Object.entries(defaults)){if(out[k]===undefined)out[k]=clone(v);else if(v&&typeof v==='object'&&!Array.isArray(v))out[k]=mergeDefaults(out[k],v);}return out;}
function migrateDb(raw){
  const db=mergeDefaults(raw||{},initialDatabase); db.meta=db.meta||{migrations:{}};db.meta.migrations=db.meta.migrations||{};
  if(!db.meta.migrations.teamFromAbout){const old=raw?.settings||{};const hasOld=old.ownerName||old.aboutUk||old.aboutEn||old.aboutImage;if(hasOld&&!db.team.length){db.team.push({id:'migrated-owner',name:cleanText(old.ownerName||'Майстер',200),roleUk:'Майстер',roleEn:'Specialist',descriptionUk:cleanText(old.aboutUk||'',2000),descriptionEn:cleanText(old.aboutEn||'',2000),photo:old.aboutImage||'',photoAltUk:'Фото майстра Svit&Co',photoAltEn:'Svit&Co specialist',specializations:[],experience:'',order:1,published:true});}db.meta.migrations.teamFromAbout=new Date().toISOString();}
  if(!db.meta.migrations.contactsV4){const old=raw?.settings||{};const c=db.settings.contacts;for(const k of ['phone','email','whatsapp','viber','telegram','facebook','instagram','workingHours','serviceArea']) if(!c[k]&&old[k])c[k]=old[k];db.meta.migrations.contactsV4=new Date().toISOString();}
  if(!db.meta.migrations.seoV4){const old=raw?.settings||{};const s=db.settings.seo;if(old.seoTitleUk)s.titleUk=old.seoTitleUk;if(old.seoTitleEn)s.titleEn=old.seoTitleEn;if(old.seoDescriptionUk)s.descriptionUk=old.seoDescriptionUk;if(old.seoDescriptionEn)s.descriptionEn=old.seoDescriptionEn;db.meta.migrations.seoV4=new Date().toISOString();}
  if(!db.meta.migrations.heroV4){const old=raw?.settings||{};if(old.heroImage)db.settings.hero.image=old.heroImage;db.meta.migrations.heroV4=new Date().toISOString();}
  if(!db.meta.migrations.starterProjectsV6){if(!(db.projects||[]).length)db.projects=clone(starterProjects);db.meta.migrations.starterProjectsV6=new Date().toISOString();}
  // Preserve existing projects/categories; only normalize missing fields.
  db.projects=(db.projects||[]).map((p,i)=>({...p,id:p.id||id(),createdAt:p.createdAt||new Date().toISOString(),category:p.category||'apartments',published:p.published!==false,coverImage:p.coverImage||p.images?.[0]?.url||'',order:Number.isFinite(Number(p.order))?Number(p.order):i+1,location:p.location||'',area:p.area||'',year:p.year||'',propertyTypeUk:p.propertyTypeUk||'',propertyTypeEn:p.propertyTypeEn||'',longDescriptionUk:p.longDescriptionUk||'',longDescriptionEn:p.longDescriptionEn||'',workListUk:p.workListUk||'',workListEn:p.workListEn||'',images:(p.images||[]).map((x,j)=>({...x,id:x.id||id(),order:Number.isFinite(Number(x.order))?Number(x.order):j}))}));
  db.sections=(db.sections||[]).map(s=>({...s,images:Array.isArray(s.images)?s.images.map((x,j)=>({...x,id:x.id||id(),order:Number.isFinite(Number(x.order))?Number(x.order):j})):[]}));db.schemaVersion=SCHEMA_VERSION;return db;
}
async function ensureStorage(){
  await fsp.mkdir(UPLOAD_DIR,{recursive:true});
  let rawText;
  try{rawText=await fsp.readFile(DB_PATH,'utf8');}
  catch(e){if(e.code==='ENOENT'){await atomicWrite(clone(initialDatabase));return;}throw e;}
  let existing;
  try{existing=JSON.parse(rawText);}
  catch(e){
    await fsp.mkdir(BACKUP_DIR,{recursive:true});
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const corruptCopy=path.join(BACKUP_DIR,`database-corrupt-${stamp}.json`);
    await fsp.writeFile(corruptCopy,rawText,'utf8').catch(()=>{});
    throw new Error(`database.json пошкоджений. Файл НЕ перезаписано; копію збережено як ${path.basename(corruptCopy)}.`);
  }
  if(existing.schemaVersion!==SCHEMA_VERSION){await createBackup('pre-v6');await atomicWrite(migrateDb(existing));}
  else{const migrated=migrateDb(existing);if(JSON.stringify(migrated)!==JSON.stringify(existing))await atomicWrite(migrated);}
}
async function readDb(){await ensureStorage();return JSON.parse(await fsp.readFile(DB_PATH,'utf8'));}

function requireAdmin(req,res,next){if(req.session?.admin===true)return next();return res.status(401).json({error:'Unauthorized'});}
const allowedMime=new Set(['image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif']);
const logoMime=new Set([...allowedMime,'image/svg+xml']);
const storage=multer.diskStorage({destination:(_r,_f,cb)=>cb(null,UPLOAD_DIR),filename:(_r,file,cb)=>{const ext={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/avif':'.avif','image/heic':'.heic','image/heif':'.heif','image/svg+xml':'.svg'}[file.mimetype]||'';cb(null,`${Date.now()}-${id()}${ext}`);}});
const imageUpload=multer({storage,limits:{fileSize:8*1024*1024,files:12},fileFilter:(_r,f,cb)=>allowedMime.has(f.mimetype)?cb(null,true):cb(new Error('Only JPG, PNG, WebP, AVIF, HEIC and HEIF images are allowed.'))});
const logoUpload=multer({storage,limits:{fileSize:5*1024*1024,files:1},fileFilter:(_r,f,cb)=>logoMime.has(f.mimetype)?cb(null,true):cb(new Error('Unsupported logo type.'))});
const backupUpload=multer({dest:os.tmpdir(),limits:{fileSize:500*1024*1024,files:1},fileFilter:(_r,f,cb)=>{const name=String(f.originalname||'').toLowerCase();const ok=name.endsWith('.tar.gz')||['application/gzip','application/x-gzip','application/octet-stream'].includes(f.mimetype);return ok?cb(null,true):cb(new Error('Виберіть резервну копію .tar.gz, створену цим сайтом.'));}});
async function sniffImage(file){const b=Buffer.alloc(24);const h=await fsp.open(file.path,'r');await h.read(b,0,24,0);await h.close();const jpeg=b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;const png=b.slice(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const webp=b.slice(0,4).toString()==='RIFF'&&b.slice(8,12).toString()==='WEBP';const brand=b.slice(8,12).toString();const iso=b.slice(4,8).toString()==='ftyp';const avif=iso&&['avif','avis'].includes(brand);const heic=iso&&['heic','heix','hevc','hevx','heim','heis','mif1','msf1'].includes(brand);if(!(jpeg||png||webp||avif||heic)){await fsp.unlink(file.path).catch(()=>{});throw new Error('File content does not match a supported image format.');}file._isHeic=heic;}
async function optimizeImage(file){await sniffImage(file);try{const out=file.path.replace(/\.[^.]+$/,'.webp');await execFileAsync('convert',[file.path,'-auto-orient','-resize','2200x2200>','-quality','82',out]);if(out!==file.path){await fsp.unlink(file.path).catch(()=>{});file.path=out;file.filename=path.basename(out);file.mimetype='image/webp';}}catch(e){if(file._isHeic){await fsp.unlink(file.path).catch(()=>{});throw new Error('HEIC/HEIF фото не вдалося конвертувати. Виберіть JPG/PNG або увімкніть конвертацію зображень на сервері.');}/* ImageMagick is optional for already browser-safe formats. */}return file;}
async function validateFiles(files){for(const f of files||[]){await optimizeImage(f);try{const {stdout}=await execFileAsync('identify',['-format','%w %h',f.path]);const [w,h]=String(stdout).trim().split(/\s+/).map(Number);if(Number.isFinite(w)&&Number.isFinite(h)){f.width=w;f.height=h;}}catch{}}}
function collectMediaUsage(db,url){const places=[];if(db.settings.hero?.image===url)places.push('Головний екран');for(const s of db.services||[])if(s.image===url)places.push(`Послуга: ${s.titleUk||s.titleEn}`);for(const t of db.team||[])if(t.photo===url)places.push(`Команда: ${t.name}`);for(const p of db.projects||[]){if(p.coverImage===url)places.push(`Обкладинка проєкту: ${p.titleUk||p.titleEn}`);if((p.images||[]).some(x=>x.url===url))places.push(`Галерея проєкту: ${p.titleUk||p.titleEn}`);}for(const s of db.sections||[]){if(s.image===url)places.push(`Секція: ${s.titleUk||s.titleEn}`);if((s.images||[]).some(x=>x.url===url))places.push(`Галерея секції: ${s.titleUk||s.titleEn}`);}return places;}
function mediaFromFile(file,body={}){return {id:id(),url:`/uploads/${file.filename}`,originalName:cleanText(file.originalname,240),mime:file.mimetype,size:file.size,width:Number(file.width)||null,height:Number(file.height)||null,aspectRatio:file.width&&file.height?Number((file.width/file.height).toFixed(4)):null,altUk:cleanText(body.altUk,240),altEn:cleanText(body.altEn,240),createdAt:new Date().toISOString()};}

app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],imgSrc:["'self'",'data:','blob:'],styleSrc:["'self'"],scriptSrc:["'self'"],connectSrc:["'self'"],fontSrc:["'self'",'data:'],objectSrc:["'none'"],frameAncestors:["'none'"],upgradeInsecureRequests:isProduction?[]:null}},crossOriginResourcePolicy:{policy:'same-origin'}}));
app.use(compression());app.use(express.json({limit:'1mb'}));app.use(express.urlencoded({extended:true,limit:'1mb'}));
app.use(cookieSession({name:'svitco_admin',keys:[process.env.SESSION_SECRET||'local-development-secret-change-me'],maxAge:8*60*60*1000,httpOnly:true,secure:isProduction,sameSite:'lax'}));
app.use('/uploads',express.static(UPLOAD_DIR,{maxAge:isProduction?'7d':0}));app.use(express.static(path.join(ROOT,'public'),{extensions:['html'],maxAge:isProduction?'1h':0}));
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:12,standardHeaders:true,legacyHeaders:false});const leadLimiter=rateLimit({windowMs:15*60*1000,limit:12,standardHeaders:true,legacyHeaders:false});
app.get('/api/health',(_r,res)=>res.json({ok:true,schemaVersion:SCHEMA_VERSION}));
app.get('/api/site',async(_r,res)=>{const db=await readDb();res.json({settings:publicSettings(db.settings),services:sortByOrder(db.services).filter(x=>x.published),projects:sortByOrder(db.projects).filter(x=>x.published),team:sortByOrder(db.team).filter(x=>x.published),sections:sortByOrder(db.sections).filter(x=>x.visible)});});

function validateContact(method,contact){if(['phone','whatsapp','viber'].includes(method))return /^\+?[\d\s().-]{6,50}$/.test(contact);if(method==='email')return /^\S+@\S+\.\S+$/.test(contact);if(method==='telegram')return /^(@?[A-Za-z0-9_]{5,32}|https?:\/\/(t\.me|telegram\.me)\/[A-Za-z0-9_]{5,32}\/?$)/i.test(contact);return false;}
app.post('/api/leads',leadLimiter,imageUpload.array('photos',5),async(req,res)=>{try{await validateFiles(req.files);const b=req.body||{};if(b.website)return res.status(202).json({ok:true});const name=cleanText(b.name,120),method=cleanText(b.preferredContact,30),contact=cleanText(b.contact,200),consent=bool(b.consent);if(!name||!method||!contact||!consent)return res.status(400).json({error:'Required fields are missing.'});if(!validateContact(method,contact))return res.status(400).json({error:'Invalid contact for the selected method.'});const db=await readDb();if(!(db.settings.contacts.availableMethods||[]).includes(method))return res.status(400).json({error:'Selected contact method is not available.'});const key=cleanText(b.idempotencyKey,100);if(key){const existing=db.leads.find(x=>x.idempotencyKey===key);if(existing)return res.status(200).json({ok:true,id:existing.id,deduplicated:true});}
const lead={id:id(),idempotencyKey:key||id(),createdAt:new Date().toISOString(),status:'new',locale:['en','uk','nl'].includes(b.locale)?b.locale:'en',name,service:cleanText(b.service,120),preferredContact:method,contact,convenientTime:method==='phone'?cleanText(b.convenientTime,120):'',message:cleanText(b.message,4000),photos:(req.files||[]).map(f=>`/uploads/${f.filename}`),notificationStatus:'queued'};db.leads.unshift(lead);enqueueLeadNotifications(db,lead);await atomicWrite(db);scheduleQueue(50);return res.status(201).json({ok:true,id:lead.id});}catch(e){for(const f of req.files||[])await fsp.unlink(f.path).catch(()=>{});throw e;}});

app.post('/api/admin/login',loginLimiter,(req,res)=>{const configured=process.env.ADMIN_PASSWORD||'13031234';if(!safeEquals(req.body?.password||'',configured))return res.status(401).json({error:'Incorrect password.'});req.session.admin=true;res.json({ok:true,usingDefaultPassword:!process.env.ADMIN_PASSWORD});});
app.post('/api/admin/logout',requireAdmin,(req,res)=>{req.session=null;res.json({ok:true});});app.get('/api/admin/session',(req,res)=>res.json({authenticated:req.session?.admin===true}));
app.get('/api/admin/data',requireAdmin,async(_r,res)=>{const db=await readDb();const safe=clone(db);safe.settings.notifications=notificationConfiguration(db.settings.notifications);safe.media=(safe.media||[]).map(m=>({...m,usage:collectMediaUsage(db,m.url)}));res.json(safe);});

app.get('/api/admin/backup/full',requireAdmin,async(_req,res)=>{
  let stageDir=null, archivePath=null;
  try{
    await writeQueue;
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    stageDir=await fsp.mkdtemp(path.join(os.tmpdir(),'svitco-backup-'));
    const exportRoot=path.join(stageDir,'SvitCo-backup');
    await fsp.mkdir(exportRoot,{recursive:true});
    await fsp.copyFile(DB_PATH,path.join(exportRoot,'database.json'));
    try{await fsp.cp(UPLOAD_DIR,path.join(exportRoot,'uploads'),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
    await fsp.mkdir(path.join(exportRoot,'uploads'),{recursive:true});
    const db=await readDb();
    const manifest={
      product:'Svit&Co website backup',
      createdAt:new Date().toISOString(),
      schemaVersion:db.schemaVersion||SCHEMA_VERSION,
      includes:['database.json','uploads/'],
      excludes:['Environment Variables','ADMIN_PASSWORD','SESSION_SECRET','API tokens and provider secrets'],
      restoreNote:'Restore database.json and uploads/ into the configured DATA_DIR before starting the application.'
    };
    await fsp.writeFile(path.join(exportRoot,'BACKUP-MANIFEST.json'),JSON.stringify(manifest,null,2),'utf8');
    archivePath=path.join(stageDir,`SvitCo-full-backup-${stamp}.tar.gz`);
    await execFileAsync('tar',['-czf',archivePath,'-C',stageDir,'SvitCo-backup']);
    res.setHeader('Cache-Control','no-store');
    res.download(archivePath,path.basename(archivePath),err=>{
      fsp.rm(stageDir,{recursive:true,force:true}).catch(()=>{});
      if(err&&!res.headersSent)res.status(500).json({error:'Backup download failed.'});
    });
  }catch(e){
    if(stageDir)await fsp.rm(stageDir,{recursive:true,force:true}).catch(()=>{});
    console.error('Full backup failed:',e.message);
    res.status(500).json({error:'Could not create full backup archive.'});
  }
});


app.post('/api/admin/backup/restore',requireAdmin,backupUpload.single('backup'),async(req,res)=>{
  let stageDir=null,nextUploads=null;
  const uploaded=req.file?.path;
  try{
    if(!req.file) return res.status(400).json({error:'Файл резервної копії не вибрано.'});
    await writeQueue;
    clearTimeout(queueTimer);
    stageDir=await fsp.mkdtemp(path.join(os.tmpdir(),'svitco-restore-'));
    const {stdout:listOut}=await execFileAsync('tar',['-tzf',uploaded],{maxBuffer:10*1024*1024});
    const entries=String(listOut).split(/\r?\n/).filter(Boolean);
    if(!entries.length||!entries.some(x=>x==='SvitCo-backup/database.json')) throw new Error('Архів не містить SvitCo-backup/database.json.');
    for(const entry of entries){
      const normalized=entry.replace(/\\/g,'/');
      if(normalized.startsWith('/')||normalized.includes('../')||!normalized.startsWith('SvitCo-backup/')) throw new Error('Архів має небезпечну або невідому структуру.');
    }
    const {stdout:verboseOut}=await execFileAsync('tar',['-tvzf',uploaded],{maxBuffer:20*1024*1024});
    for(const line of String(verboseOut).split(/\r?\n/).filter(Boolean)){
      const type=line[0];
      if(type!=='-'&&type!=='d') throw new Error('Архів містить непідтримувані посилання або спеціальні файли.');
    }
    await execFileAsync('tar',['--no-same-owner','--no-same-permissions','-xzf',uploaded,'-C',stageDir]);
    const root=path.join(stageDir,'SvitCo-backup');
    const dbCandidate=path.join(root,'database.json');
    const raw=JSON.parse(await fsp.readFile(dbCandidate,'utf8'));
    if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw new Error('database.json має неправильний формат.');
    for(const key of ['settings','services','projects','team','sections','media','leads']) if(!(key in raw)) throw new Error(`У database.json відсутній розділ ${key}.`);
    const restored=migrateDb(raw);
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    const safety=path.join(BACKUP_DIR,`before-restore-${stamp}`);
    await fsp.mkdir(safety,{recursive:true});
    try{await fsp.copyFile(DB_PATH,path.join(safety,'database.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
    try{await fsp.cp(UPLOAD_DIR,path.join(safety,'uploads'),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
    const sourceUploads=path.join(root,'uploads');
    nextUploads=path.join(DATA_DIR,`.uploads-restore-${Date.now()}`);
    await fsp.rm(nextUploads,{recursive:true,force:true});
    try{await fsp.cp(sourceUploads,nextUploads,{recursive:true});}catch(e){if(e.code==='ENOENT')await fsp.mkdir(nextUploads,{recursive:true});else throw e;}
    await fsp.rm(UPLOAD_DIR,{recursive:true,force:true});
    await fsp.rename(nextUploads,UPLOAD_DIR); nextUploads=null;
    await atomicWrite(restored);
    let uploadCount=0;try{uploadCount=(await fsp.readdir(UPLOAD_DIR,{withFileTypes:true})).filter(x=>x.isFile()).length;}catch{}
    scheduleQueue(5000);
    res.json({ok:true,summary:{projects:restored.projects?.length||0,leads:restored.leads?.length||0,uploads:uploadCount},safetyBackup:path.basename(safety)});
  }catch(e){
    console.error('Restore failed:',e.message);
    scheduleQueue(5000);
    res.status(400).json({error:e.message||'Не вдалося відновити резервну копію.'});
  }finally{
    if(nextUploads) await fsp.rm(nextUploads,{recursive:true,force:true}).catch(()=>{});
    if(stageDir) await fsp.rm(stageDir,{recursive:true,force:true}).catch(()=>{});
    if(uploaded) await fsp.unlink(uploaded).catch(()=>{});
  }
});

app.patch('/api/admin/hero',requireAdmin,async(req,res)=>{const db=await readDb();for(const k of ['titleUk','titleEn','subtitleUk','subtitleEn','image','imageAltUk','imageAltEn','primaryTextUk','primaryTextEn','primaryAction','secondaryTextUk','secondaryTextEn','secondaryAction'])if(k in req.body)db.settings.hero[k]=cleanText(req.body[k],2000);await atomicWrite(db);res.json({ok:true,hero:db.settings.hero});});
app.patch('/api/admin/contacts',requireAdmin,async(req,res)=>{const db=await readDb();const c=db.settings.contacts;for(const k of ['phone','email','whatsapp','viber','telegram','facebook','instagram','workingHours','serviceArea'])if(k in req.body)c[k]=cleanText(req.body[k],500);if(Array.isArray(req.body.availableMethods)){if(!req.body.availableMethods.length)return res.status(400).json({error:'At least one client contact method must remain enabled.'});c.availableMethods=req.body.availableMethods.filter(x=>['phone','whatsapp','viber','telegram','email'].includes(x));}if(req.body.visibleButtons)c.visibleButtons={...c.visibleButtons,...req.body.visibleButtons};await atomicWrite(db);res.json({ok:true,contacts:c});});
app.patch('/api/admin/seo',requireAdmin,async(req,res)=>{const db=await readDb();for(const k of ['titleUk','titleEn','descriptionUk','descriptionEn'])if(k in req.body)db.settings.seo[k]=cleanText(req.body[k],500);await atomicWrite(db);res.json({ok:true,seo:db.settings.seo});});
app.post('/api/admin/logo',requireAdmin,logoUpload.single('logo'),async(req,res)=>{if(!req.file)return res.status(400).json({error:'Logo file is required.'});if(req.file.mimetype==='image/svg+xml'){const svg=await fsp.readFile(req.file.path,'utf8');if(/<script|javascript:|\son\w+\s*=/i.test(svg)){await fsp.unlink(req.file.path).catch(()=>{});return res.status(400).json({error:'Unsafe SVG content.'});}}else await validateFiles([req.file]);const db=await readDb();const previous=db.settings.brand.logoUrl||db.settings.logoUrl;const url=`/uploads/${req.file.filename}`;db.settings.brand.logoUrl=url;db.settings.logoUrl=url;await atomicWrite(db);if(previous?.startsWith('/uploads/')&&previous!==url)await fsp.unlink(path.join(UPLOAD_DIR,path.basename(previous))).catch(()=>{});res.status(201).json({ok:true,url});});
app.delete('/api/admin/logo',requireAdmin,async(_req,res)=>{const db=await readDb();const previous=db.settings.brand.logoUrl||db.settings.logoUrl;db.settings.brand.logoUrl='/assets/logo-svitco.webp';db.settings.logoUrl='/assets/logo-svitco.webp';await atomicWrite(db);if(previous?.startsWith('/uploads/'))await fsp.unlink(path.join(UPLOAD_DIR,path.basename(previous))).catch(()=>{});res.json({ok:true,url:db.settings.logoUrl});});
app.patch('/api/admin/content',requireAdmin,async(req,res)=>{const db=await readDb();for(const k of ['advantages','steps','faq'])if(Array.isArray(req.body[k]))db.settings.content[k]=req.body[k].map((x,i)=>({id:x.id||id(),uk:cleanText(x.uk,1000),en:cleanText(x.en,1000),questionUk:cleanText(x.questionUk,500),questionEn:cleanText(x.questionEn,500),answerUk:cleanText(x.answerUk,2000),answerEn:cleanText(x.answerEn,2000),order:i+1}));await atomicWrite(db);res.json({ok:true,content:db.settings.content});});

function crudRoutes(name,normalize){
  app.post(`/api/admin/${name}`,requireAdmin,async(req,res)=>{const db=await readDb();const item=normalize(req.body,null,db);db[name].push(item);await atomicWrite(db);res.status(201).json({ok:true,item});});
  app.patch(`/api/admin/${name}/:id`,requireAdmin,async(req,res)=>{const db=await readDb();const i=db[name].findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({error:'Not found.'});db[name][i]=normalize(req.body,db[name][i],db);await atomicWrite(db);res.json({ok:true,item:db[name][i]});});
  app.delete(`/api/admin/${name}/:id`,requireAdmin,async(req,res)=>{const db=await readDb();const i=db[name].findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({error:'Not found.'});const [removed]=db[name].splice(i,1);await atomicWrite(db);res.json({ok:true,removed});});
}
crudRoutes('services',(b,old)=>({...(old||{}),id:old?.id||id(),slug:cleanText(b.slug||old?.slug||'',80)||`service-${Date.now()}`,titleUk:cleanText(b.titleUk??old?.titleUk,200),titleEn:cleanText(b.titleEn??old?.titleEn,200),descriptionUk:cleanText(b.descriptionUk??old?.descriptionUk,3000),descriptionEn:cleanText(b.descriptionEn??old?.descriptionEn,3000),image:cleanText(b.image??old?.image,500),imageAltUk:cleanText(b.imageAltUk??old?.imageAltUk,240),imageAltEn:cleanText(b.imageAltEn??old?.imageAltEn,240),order:number(b.order,old?.order??999),featured:('featured'in b)?bool(b.featured):!!old?.featured,published:('published'in b)?bool(b.published):(old?.published!==false),portfolioCategory:cleanText(b.portfolioCategory??old?.portfolioCategory,80)}));
crudRoutes('team',(b,old)=>({...(old||{}),id:old?.id||id(),name:cleanText(b.name??old?.name,200),roleUk:cleanText(b.roleUk??old?.roleUk,200),roleEn:cleanText(b.roleEn??old?.roleEn,200),descriptionUk:cleanText(b.descriptionUk??old?.descriptionUk,3000),descriptionEn:cleanText(b.descriptionEn??old?.descriptionEn,3000),photo:cleanText(b.photo??old?.photo,500),photoAltUk:cleanText(b.photoAltUk??old?.photoAltUk,240),photoAltEn:cleanText(b.photoAltEn??old?.photoAltEn,240),specializations:Array.isArray(b.specializations)?b.specializations.map(x=>cleanText(x,100)).filter(Boolean):(old?.specializations||[]),experience:cleanText(b.experience??old?.experience,120),order:number(b.order,old?.order??999),published:('published'in b)?bool(b.published):(old?.published!==false)}));
crudRoutes('sections',(b,old)=>({...(old||{}),id:old?.id||id(),type:cleanText(b.type??old?.type,40),titleUk:cleanText(b.titleUk??old?.titleUk,200),titleEn:cleanText(b.titleEn??old?.titleEn,200),descriptionUk:cleanText(b.descriptionUk??old?.descriptionUk,3000),descriptionEn:cleanText(b.descriptionEn??old?.descriptionEn,3000),image:cleanText(b.image??old?.image,500),imageAltUk:cleanText(b.imageAltUk??old?.imageAltUk,240),imageAltEn:cleanText(b.imageAltEn??old?.imageAltEn,240),bodyUk:cleanText(b.bodyUk??old?.bodyUk,5000),bodyEn:cleanText(b.bodyEn??old?.bodyEn,5000),images:Array.isArray(b.images)?b.images.map((x,i)=>({id:x.id||id(),url:cleanText(x.url,500),altUk:cleanText(x.altUk,240),altEn:cleanText(x.altEn,240),order:number(x.order,i)})):(old?.images||[]),order:number(b.order,old?.order??999),visible:('visible'in b)?bool(b.visible):(old?.visible!==false)}));

app.post('/api/admin/media',requireAdmin,imageUpload.single('image'),async(req,res)=>{await validateFiles(req.file?[req.file]:[]);if(!req.file)return res.status(400).json({error:'Image required.'});const db=await readDb();const m=await mediaFromFile(req.file,req.body);db.media.unshift(m);await atomicWrite(db);res.status(201).json({ok:true,media:{...m,usage:[]}});});
app.patch('/api/admin/media/:id',requireAdmin,async(req,res)=>{const db=await readDb();const m=db.media.find(x=>x.id===req.params.id);if(!m)return res.status(404).json({error:'Not found.'});m.altUk=cleanText(req.body.altUk??m.altUk,240);m.altEn=cleanText(req.body.altEn??m.altEn,240);await atomicWrite(db);res.json({ok:true,media:{...m,usage:collectMediaUsage(db,m.url)}});});
app.delete('/api/admin/media/:id',requireAdmin,async(req,res)=>{const db=await readDb();const m=db.media.find(x=>x.id===req.params.id);if(!m)return res.status(404).json({error:'Not found.'});const usage=collectMediaUsage(db,m.url),removeEverywhere=req.body?.removeEverywhere===true,replacementUrl=cleanText(req.body?.replacementUrl||'',500);if(usage.length&&!removeEverywhere&&!replacementUrl)return res.status(409).json({error:'Image is in use.',usage});if(usage.length){const from=m.url,to=replacementUrl;if(removeEverywhere){if(db.settings.hero.image===from)db.settings.hero.image='';for(const s of db.services)if(s.image===from)s.image='';for(const t of db.team)if(t.photo===from)t.photo='';for(const p of db.projects){if(p.coverImage===from)p.coverImage='';p.images=(p.images||[]).filter(im=>im.url!==from);}for(const s of db.sections){if(s.image===from)s.image='';s.images=(s.images||[]).filter(im=>im.url!==from);}}else{if(db.settings.hero.image===from)db.settings.hero.image=to;for(const s of db.services)if(s.image===from)s.image=to;for(const t of db.team)if(t.photo===from)t.photo=to;for(const p of db.projects){if(p.coverImage===from)p.coverImage=to;for(const im of p.images||[])if(im.url===from)im.url=to;}for(const s of db.sections){if(s.image===from)s.image=to;for(const im of s.images||[])if(im.url===from)im.url=to;}}}db.media=db.media.filter(x=>x.id!==m.id);await atomicWrite(db);if(m.url.startsWith('/uploads/'))await fsp.unlink(path.join(UPLOAD_DIR,path.basename(m.url))).catch(()=>{});res.json({ok:true,removedEverywhere:removeEverywhere,usage});});

app.post('/api/admin/projects',requireAdmin,async(req,res)=>{const db=await readDb();const p={id:id(),createdAt:new Date().toISOString(),titleUk:cleanText(req.body.titleUk,200),titleEn:cleanText(req.body.titleEn,200),descriptionUk:cleanText(req.body.descriptionUk,3000),descriptionEn:cleanText(req.body.descriptionEn,3000),longDescriptionUk:cleanText(req.body.longDescriptionUk,8000),longDescriptionEn:cleanText(req.body.longDescriptionEn,8000),category:cleanText(req.body.category,80)||'apartments',coverImage:cleanText(req.body.coverImage,500),location:cleanText(req.body.location,240),area:cleanText(req.body.area,120),year:cleanText(req.body.year,40),propertyTypeUk:cleanText(req.body.propertyTypeUk,160),propertyTypeEn:cleanText(req.body.propertyTypeEn,160),workListUk:cleanText(req.body.workListUk,2000),workListEn:cleanText(req.body.workListEn,2000),published:bool(req.body.published),order:number(req.body.order,db.projects.length+1),images:Array.isArray(req.body.images)?req.body.images:[]};if(!p.titleUk&&!p.titleEn)return res.status(400).json({error:'Project title is required.'});db.projects.push(p);await atomicWrite(db);res.status(201).json({ok:true,project:p});});
app.patch('/api/admin/projects/:id',requireAdmin,async(req,res)=>{const db=await readDb();const p=db.projects.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({error:'Project not found.'});for(const k of ['titleUk','titleEn','descriptionUk','descriptionEn','longDescriptionUk','longDescriptionEn','category','coverImage','location','area','year','propertyTypeUk','propertyTypeEn','workListUk','workListEn'])if(k in req.body)p[k]=cleanText(req.body[k],k.startsWith('longDescription')?8000:3000);if('published'in req.body)p.published=bool(req.body.published);if('order'in req.body)p.order=number(req.body.order,p.order);if(Array.isArray(req.body.images))p.images=req.body.images.map((x,i)=>({...x,id:x.id||id(),url:cleanText(x.url,500),altUk:cleanText(x.altUk,240),altEn:cleanText(x.altEn,240),order:number(x.order,i)}));await atomicWrite(db);res.json({ok:true,project:p});});
app.delete('/api/admin/projects/:id',requireAdmin,async(req,res)=>{const db=await readDb();const p=db.projects.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({error:'Project not found.'});db.projects=db.projects.filter(x=>x.id!==p.id);await atomicWrite(db);res.json({ok:true});});

app.patch('/api/admin/leads/:id',requireAdmin,async(req,res)=>{const db=await readDb();const lead=db.leads.find(x=>x.id===req.params.id);if(!lead)return res.status(404).json({error:'Lead not found.'});if(['new','contacted','completed','archived'].includes(req.body.status))lead.status=req.body.status;await atomicWrite(db);res.json({ok:true,lead});});
app.get('/api/admin/leads.csv',requireAdmin,async(_req,res)=>{const db=await readDb();const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;const cols=['createdAt','status','name','service','preferredContact','contact','convenientTime','locale','message','notificationStatus'];const csv=[cols.join(','),...db.leads.map(x=>cols.map(k=>esc(x[k])).join(','))].join('\n');res.type('text/csv').attachment('leads.csv').send('\ufeff'+csv);});

function notificationConfiguration(n){return {maxAttempts:n.maxAttempts||3,lastAttempts:(n.lastAttempts||[]).slice(0,30),telegram:{enabled:!!n.telegram?.enabled,chatId:n.telegram?.chatId||'',configured:!!(process.env.TELEGRAM_BOT_TOKEN&&n.telegram?.chatId)},email:{enabled:!!n.email?.enabled,to:n.email?.to||'',configured:!!(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM&&n.email?.to)},sms:{enabled:!!n.sms?.enabled,to:n.sms?.to||'',configured:!!(process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&(process.env.TWILIO_FROM_NUMBER||process.env.TWILIO_MESSAGING_SERVICE_SID)&&n.sms?.to)},whatsapp:{enabled:!!n.whatsapp?.enabled,to:n.whatsapp?.to||'',configured:!!(process.env.WHATSAPP_ACCESS_TOKEN&&process.env.WHATSAPP_PHONE_NUMBER_ID&&process.env.WHATSAPP_TEMPLATE_NAME&&n.whatsapp?.to)}};}
app.get('/api/admin/notifications/config',requireAdmin,async(_r,res)=>{const db=await readDb();res.json(notificationConfiguration(db.settings.notifications));});
app.patch('/api/admin/notifications/config',requireAdmin,async(req,res)=>{const db=await readDb();for(const ch of ['telegram','email','sms','whatsapp'])if(req.body[ch]){db.settings.notifications[ch].enabled=bool(req.body[ch].enabled);if('to'in req.body[ch])db.settings.notifications[ch].to=cleanText(req.body[ch].to,300);if(ch==='telegram'&&'chatId'in req.body[ch])db.settings.notifications.telegram.chatId=cleanText(req.body[ch].chatId,200);}if('maxAttempts'in req.body)db.settings.notifications.maxAttempts=Math.max(1,Math.min(6,number(req.body.maxAttempts,3)));await atomicWrite(db);res.json(notificationConfiguration(db.settings.notifications));});
function leadMessage(lead){return `Нова заявка Svit&Co\nІм’я: ${lead.name}\nПослуга: ${lead.service||'—'}\nБажаний канал: ${lead.preferredContact}\nКонтакт: ${lead.contact}\nПовідомлення: ${(lead.message||'—').slice(0,500)}\nЧас: ${lead.createdAt}\nАдмінка: ${baseUrl}/admin#lead-${lead.id}`;}
function enqueueLeadNotifications(db,lead){const cfg=notificationConfiguration(db.settings.notifications);for(const ch of ['telegram','email','sms','whatsapp'])if(cfg[ch].enabled)db.notificationQueue.push({id:id(),leadId:lead.id,channel:ch,status:'pending',attempts:0,nextAttemptAt:new Date().toISOString(),createdAt:new Date().toISOString(),lastError:''});if(!['telegram','email','sms','whatsapp'].some(ch=>cfg[ch].enabled))lead.notificationStatus='not_configured';}
async function sendChannel(channel,text,cfg,queueId){
  if(channel==='telegram'){if(!cfg.telegram.configured)throw new Error('Telegram not configured');const r=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:cfg.telegram.chatId,text,disable_web_page_preview:true})});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw new Error(j.description||`Telegram HTTP ${r.status}`);return {providerId:String(j.result?.message_id||''),providerStatus:'sent'};}
  if(channel==='email'){if(!cfg.email.configured)throw new Error('Email not configured');const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`svitco-${queueId}`},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[cfg.email.to],subject:'Нова заявка Svit&Co',text})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||`Email HTTP ${r.status}`);return {providerId:String(j.id||''),providerStatus:'accepted'};}
  if(channel==='sms'){if(!cfg.sms.configured)throw new Error('SMS not configured');const auth=Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');const body=new URLSearchParams({To:cfg.sms.to,Body:text.slice(0,1500)});if(process.env.TWILIO_MESSAGING_SERVICE_SID)body.set('MessagingServiceSid',process.env.TWILIO_MESSAGING_SERVICE_SID);else body.set('From',process.env.TWILIO_FROM_NUMBER);const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'},body});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||`SMS HTTP ${r.status}`);return {providerId:String(j.sid||''),providerStatus:String(j.status||'accepted')};}
  if(channel==='whatsapp'){if(!cfg.whatsapp.configured)throw new Error('WhatsApp not configured');const r=await fetch(`https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:cfg.whatsapp.to.replace(/\D/g,''),type:'template',template:{name:process.env.WHATSAPP_TEMPLATE_NAME,language:{code:process.env.WHATSAPP_TEMPLATE_LANGUAGE||'en_US'}}})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error?.message||`WhatsApp HTTP ${r.status}`);return {providerId:String(j.messages?.[0]?.id||''),providerStatus:'accepted'};}
  throw new Error('Unsupported channel');
}
async function processQueue(){const db=await readDb();const now=Date.now();const cfg=notificationConfiguration(db.settings.notifications);let changed=false;for(const q of db.notificationQueue){if(!['pending','retry'].includes(q.status)||new Date(q.nextAttemptAt).getTime()>now)continue;const lead=db.leads.find(x=>x.id===q.leadId);if(!lead){q.status='failed';q.lastError='Lead missing';changed=true;continue;}q.attempts++;try{const result=await sendChannel(q.channel,leadMessage(lead),cfg,q.id);q.status=result.providerStatus==='sent'?'sent':'accepted';q.providerId=result.providerId;q.providerStatus=result.providerStatus;q.lastError='';q.lastAttemptAt=new Date().toISOString();}catch(e){q.lastError=cleanText(e.message,500);q.lastAttemptAt=new Date().toISOString();q.status=q.attempts>=(db.settings.notifications.maxAttempts||3)?'failed':'retry';q.nextAttemptAt=new Date(Date.now()+Math.min(30*60*1000,60*1000*Math.pow(3,q.attempts-1))).toISOString();}db.settings.notifications.lastAttempts.unshift({at:new Date().toISOString(),channel:q.channel,status:q.status,error:q.lastError,leadId:q.leadId});db.settings.notifications.lastAttempts=db.settings.notifications.lastAttempts.slice(0,30);changed=true;}if(changed){for(const lead of db.leads){const jobs=db.notificationQueue.filter(q=>q.leadId===lead.id);if(jobs.length){lead.notificationStatus=jobs.every(q=>q.status==='sent')?'sent':jobs.every(q=>['sent','accepted'].includes(q.status))?'accepted':jobs.some(q=>q.status==='failed')?'delivery_issue':'queued';}}await atomicWrite(db);}scheduleQueue(60*1000);}
function scheduleQueue(ms=60*1000){clearTimeout(queueTimer);queueTimer=setTimeout(()=>processQueue().catch(e=>console.error('Queue:',e.message)),ms);queueTimer.unref?.();}
app.post('/api/admin/notifications/test/:channel',requireAdmin,async(req,res)=>{const db=await readDb();const cfg=notificationConfiguration(db.settings.notifications);try{const result=await sendChannel(req.params.channel,'Тестове сповіщення Svit&Co: підключення працює.',cfg,`test-${Date.now()}`);res.json({ok:true,result});}catch(e){res.status(400).json({error:e.message});}});
app.post('/api/admin/notifications/retry/:leadId',requireAdmin,async(req,res)=>{const db=await readDb();const jobs=db.notificationQueue.filter(q=>q.leadId===req.params.leadId);if(!jobs.length)return res.status(404).json({error:'No notification jobs for this lead.'});for(const q of jobs.filter(q=>q.status==='failed')){q.status='retry';q.attempts=0;q.nextAttemptAt=new Date().toISOString();}await atomicWrite(db);scheduleQueue(20);res.json({ok:true});});

app.get('/robots.txt',(_r,res)=>res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${baseUrl}/sitemap.xml\n`));
app.get('/sitemap.xml',(_r,res)=>res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${baseUrl}/en</loc></url><url><loc>${baseUrl}/uk</loc></url><url><loc>${baseUrl}/nl</loc></url></urlset>`));
app.get(['/uk','/en','/nl','/uk/privacy','/en/privacy','/nl/privacy','/uk/terms','/en/terms','/nl/terms','/uk/project/:id','/en/project/:id','/nl/project/:id'],(_r,res)=>res.sendFile(path.join(ROOT,'public','index.html')));app.get('/admin',(_r,res)=>res.sendFile(path.join(ROOT,'public','admin.html')));
app.use((error,req,res,_next)=>{console.error(error);if(req.files)for(const f of req.files)fsp.unlink(f.path).catch(()=>{});if(req.file)fsp.unlink(req.file.path).catch(()=>{});if(error instanceof multer.MulterError)return res.status(400).json({error:error.code==='LIMIT_FILE_SIZE'?'Image exceeds 8 MB.':error.message});res.status(400).json({error:error.message||'Request failed.'});});

ensureStorage().then(()=>{app.listen(PORT,()=>{console.log(`Svit&Co site running on port ${PORT}`);scheduleQueue(5000);});}).catch(e=>{console.error(e);process.exit(1);});
