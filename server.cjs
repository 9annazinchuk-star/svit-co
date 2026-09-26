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

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'database.json');
const isProduction = process.env.NODE_ENV === 'production';
const baseUrl = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

const initialDatabase = {
  settings: {
    companyName: 'Svit&Co',
    ownerName: 'OWNER NAME',
    phone: '',
    whatsapp: '',
    email: '',
    telegram: '',
    viber: '',
    messenger: '',
    smsEnabled: false,
    city: 'CITY',
    serviceArea: 'SERVICE AREA',
    country: 'COUNTRY',
    workingHours: 'WORKING HOURS',
    aboutUk: 'Працюємо уважно, пояснюємо кожен етап і дбайливо ставимося до вашого простору.',
    aboutEn: 'We work carefully, explain every stage and treat your space with respect.',
    heroImage: '/assets/photos/hero-renovation.webp',
    logoUrl: '/assets/logo-svitco.webp',
    seoTitleUk: 'Ремонт квартир та внутрішнє оздоблення',
    seoTitleEn: 'Apartment renovation and interior finishing',
    seoDescriptionUk: 'Професійний ремонт квартир із чіткою комунікацією та увагою до деталей.',
    seoDescriptionEn: 'Professional apartment renovation with clear communication and attention to detail.'
  },
  projects: [],
  leads: []
};

let writeQueue = Promise.resolve();

async function ensureStorage() {
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
  try { await fsp.access(DB_PATH); }
  catch { await atomicWrite(initialDatabase); }
}

async function readDb() {
  await ensureStorage();
  try {
    return JSON.parse(await fsp.readFile(DB_PATH, 'utf8'));
  } catch (error) {
    console.error('Database read failed:', error.message);
    return structuredClone(initialDatabase);
  }
}

function atomicWrite(data) {
  writeQueue = writeQueue.then(async () => {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    const temporary = `${DB_PATH}.${process.pid}.tmp`;
    await fsp.writeFile(temporary, JSON.stringify(data, null, 2), 'utf8');
    await fsp.rename(temporary, DB_PATH);
  });
  return writeQueue;
}

function cleanText(value, max = 2000) {
  return String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max);
}

function normalizePhone(value) {
  return cleanText(value, 40).replace(/[^+\d\s().-]/g, '');
}

function safeEquals(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireAdmin(req, res, next) {
  if (req.session?.admin === true) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif', 'image/svg+xml': '.svg' }[file.mimetype] || '';
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => allowedMime.has(file.mimetype) ? cb(null, true) : cb(new Error('Only JPG, PNG, WebP and AVIF images are allowed.'))
});
const logoMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);
const logoUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => logoMime.has(file.mimetype) ? cb(null, true) : cb(new Error('Only JPG, PNG, WebP and SVG logos are allowed.'))
});

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  crossOriginResourcePolicy: { policy: 'same-origin' }
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieSession({
  name: 'svitco_admin',
  keys: [process.env.SESSION_SECRET || 'local-development-secret-change-me'],
  maxAge: 8 * 60 * 60 * 1000,
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax'
}));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: isProduction ? '7d' : 0, immutable: isProduction }));
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'], maxAge: isProduction ? '1h' : 0 }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });
const leadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/site', async (_req, res) => {
  const db = await readDb();
  res.json({ settings: db.settings, projects: db.projects.filter((project) => project.published) });
});

app.post('/api/leads', leadLimiter, upload.array('photos', 5), async (req, res) => {
  const body = req.body || {};
  if (body.website) return res.status(202).json({ ok: true });
  const name = cleanText(body.name, 120);
  const preferred = cleanText(body.preferredContact, 30);
  const phone = normalizePhone(body.phone);
  const email = cleanText(body.email, 160).toLowerCase();
  const whatsapp = normalizePhone(body.whatsapp);
  if (!name || !preferred) return res.status(400).json({ error: 'Name and preferred contact method are required.' });
  if (preferred === 'email' && !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
  if (['phone', 'sms'].includes(preferred) && phone.length < 6) return res.status(400).json({ error: 'A valid phone number is required.' });
  if (preferred === 'whatsapp' && (whatsapp || phone).length < 6) return res.status(400).json({ error: 'A valid WhatsApp number is required.' });
  const lead = {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'new',
    locale: body.locale === 'en' ? 'en' : 'uk', name, phone, whatsapp, email,
    preferredContact: preferred,
    alternativeContact: cleanText(body.alternativeContact, 30),
    propertyType: cleanText(body.propertyType, 80), service: cleanText(body.service, 120),
    area: cleanText(body.area, 40), location: cleanText(body.location, 160),
    startDate: cleanText(body.startDate, 80), message: cleanText(body.message, 4000),
    consent: body.consent === true || body.consent === 'on' || body.consent === 'true',
    photos: (req.files || []).map((file) => `/uploads/${file.filename}`)
  };
  if (!lead.consent) return res.status(400).json({ error: 'Consent is required.' });
  const db = await readDb();
  db.leads.unshift(lead);
  await atomicWrite(db);
  res.status(201).json({ ok: true, id: lead.id });
});

app.post('/api/admin/login', loginLimiter, (req, res) => {
  const configured = process.env.ADMIN_PASSWORD || 'change-me-now';
  if (!safeEquals(req.body?.password || '', configured)) return res.status(401).json({ error: 'Incorrect password.' });
  req.session.admin = true;
  res.json({ ok: true, usingDefaultPassword: !process.env.ADMIN_PASSWORD });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

app.get('/api/admin/session', (req, res) => res.json({ authenticated: req.session?.admin === true }));

app.get('/api/admin/data', requireAdmin, async (_req, res) => res.json(await readDb()));

app.patch('/api/admin/settings', requireAdmin, async (req, res) => {
  const permitted = ['companyName','ownerName','phone','whatsapp','email','telegram','viber','messenger','smsEnabled','city','serviceArea','country','workingHours','aboutUk','aboutEn','heroImage','seoTitleUk','seoTitleEn','seoDescriptionUk','seoDescriptionEn'];
  const db = await readDb();
  for (const key of permitted) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) db.settings[key] = key === 'smsEnabled' ? Boolean(req.body[key]) : cleanText(req.body[key], 2000);
  }
  await atomicWrite(db);
  res.json({ ok: true, settings: db.settings });
});

app.post('/api/admin/hero-image', requireAdmin, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Image is required.' });
  const db = await readDb();
  db.settings.heroImage = `/uploads/${req.file.filename}`;
  await atomicWrite(db);
  res.status(201).json({ ok: true, url: db.settings.heroImage });
});

app.post('/api/admin/logo', requireAdmin, logoUpload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Logo file is required.' });
  if (req.file.mimetype === 'image/svg+xml') {
    const svg = await fsp.readFile(req.file.path, 'utf8');
    if (/<script|javascript:|\son\w+\s*=/i.test(svg)) {
      await fsp.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Unsafe SVG content.' });
    }
  }
  const db = await readDb();
  const previous = db.settings.logoUrl;
  db.settings.logoUrl = `/uploads/${req.file.filename}`;
  await atomicWrite(db);
  if (previous?.startsWith('/uploads/')) fsp.unlink(path.join(UPLOAD_DIR, path.basename(previous))).catch(() => {});
  res.status(201).json({ ok: true, url: db.settings.logoUrl });
});

app.delete('/api/admin/logo', requireAdmin, async (_req, res) => {
  const db = await readDb();
  const previous = db.settings.logoUrl;
  db.settings.logoUrl = '/assets/logo-svitco.webp';
  await atomicWrite(db);
  if (previous?.startsWith('/uploads/')) fsp.unlink(path.join(UPLOAD_DIR, path.basename(previous))).catch(() => {});
  res.json({ ok: true, url: db.settings.logoUrl });
});

app.post('/api/admin/projects', requireAdmin, upload.array('images', 10), async (req, res) => {
  const project = {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(),
    titleUk: cleanText(req.body.titleUk, 160), titleEn: cleanText(req.body.titleEn, 160),
    descriptionUk: cleanText(req.body.descriptionUk, 2000), descriptionEn: cleanText(req.body.descriptionEn, 2000),
    category: cleanText(req.body.category, 60) || 'apartments', location: cleanText(req.body.location, 120),
    published: req.body.published === 'true' || req.body.published === 'on',
    images: (req.files || []).map((file, index) => ({ id: crypto.randomUUID(), url: `/uploads/${file.filename}`, altUk: cleanText(req.body.altUk, 240), altEn: cleanText(req.body.altEn, 240), focalX: 50, focalY: 50, order: index }))
  };
  if (!project.titleUk || !project.titleEn) return res.status(400).json({ error: 'Both project titles are required.' });
  const db = await readDb();
  db.projects.unshift(project);
  await atomicWrite(db);
  res.status(201).json({ ok: true, project });
});

app.patch('/api/admin/projects/:id', requireAdmin, async (req, res) => {
  const db = await readDb();
  const project = db.projects.find((item) => item.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const keys = ['titleUk','titleEn','descriptionUk','descriptionEn','category','location','published'];
  for (const key of keys) if (Object.prototype.hasOwnProperty.call(req.body, key)) project[key] = key === 'published' ? Boolean(req.body[key]) : cleanText(req.body[key], 2000);
  await atomicWrite(db);
  res.json({ ok: true, project });
});

app.post('/api/admin/projects/:id/images', requireAdmin, upload.array('images', 10), async (req, res) => {
  const db = await readDb();
  const project = db.projects.find((item) => item.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const additions = (req.files || []).map((file, index) => ({ id: crypto.randomUUID(), url: `/uploads/${file.filename}`, altUk: cleanText(req.body.altUk, 240), altEn: cleanText(req.body.altEn, 240), focalX: 50, focalY: 50, order: project.images.length + index }));
  project.images.push(...additions);
  await atomicWrite(db);
  res.status(201).json({ ok: true, images: project.images });
});

app.delete('/api/admin/projects/:projectId/images/:imageId', requireAdmin, async (req, res) => {
  const db = await readDb();
  const project = db.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const image = project.images.find((item) => item.id === req.params.imageId);
  project.images = project.images.filter((item) => item.id !== req.params.imageId);
  await atomicWrite(db);
  if (image?.url?.startsWith('/uploads/')) fsp.unlink(path.join(UPLOAD_DIR, path.basename(image.url))).catch(() => {});
  res.json({ ok: true });
});

app.delete('/api/admin/projects/:id', requireAdmin, async (req, res) => {
  const db = await readDb();
  const project = db.projects.find((item) => item.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  db.projects = db.projects.filter((item) => item.id !== req.params.id);
  await atomicWrite(db);
  for (const image of project.images || []) if (image.url?.startsWith('/uploads/')) fsp.unlink(path.join(UPLOAD_DIR, path.basename(image.url))).catch(() => {});
  res.json({ ok: true });
});

app.patch('/api/admin/leads/:id', requireAdmin, async (req, res) => {
  const db = await readDb();
  const lead = db.leads.find((item) => item.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });
  lead.status = ['new','contacted','completed','archived'].includes(req.body.status) ? req.body.status : lead.status;
  await atomicWrite(db);
  res.json({ ok: true, lead });
});

app.get('/api/admin/leads.csv', requireAdmin, async (_req, res) => {
  const db = await readDb();
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const columns = ['createdAt','status','name','phone','whatsapp','email','preferredContact','service','location','message'];
  const csv = [columns.join(','), ...db.leads.map((lead) => columns.map((key) => escape(lead[key])).join(','))].join('\n');
  res.type('text/csv').attachment('leads.csv').send('\ufeff' + csv);
});

app.get('/robots.txt', (_req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${baseUrl}/sitemap.xml\n`));
app.get('/sitemap.xml', (_req, res) => res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${baseUrl}/uk</loc></url><url><loc>${baseUrl}/en</loc></url></urlset>`));

app.get(['/uk','/en','/uk/privacy','/en/privacy','/uk/terms','/en/terms'], (_req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(ROOT, 'public', 'admin.html')));

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Image exceeds 8 MB.' : error.message });
  res.status(400).json({ error: error.message || 'Request failed.' });
});

ensureStorage().then(() => app.listen(PORT, () => console.log(`Svit&Co site running on port ${PORT}`))).catch((error) => { console.error(error); process.exit(1); });
