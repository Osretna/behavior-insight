import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { GoogleGenAI, Type } from '@google/genai';

const apiApp = express();

// Read Firebase project config safely across local server and Vercel serverless bundles
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidatePaths = [
  path.resolve(process.cwd(), 'firebase-applet-config.json'),
  path.resolve(__dirname, '..', 'firebase-applet-config.json'),
];
let firebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
for (const candidate of candidatePaths) {
  try {
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, 'utf-8');
      const parsed = JSON.parse(raw) as { projectId?: string };
      if (parsed.projectId) {
        firebaseProjectId = parsed.projectId;
        break;
      }
    }
  } catch {
    // try next candidate
  }
}

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email: string;
  };
}

// Security Headers Middleware
apiApp.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  next();
});

apiApp.use(express.json({ limit: '512kb' }));

// Sliding-window in-memory rate limiters
const pinAttempts = new Map<string, { count: number; resetAt: number }>();
const aiRequests = new Map<string, { count: number; resetAt: number }>();
const adminLoginAttempts = new Map<string, { count: number; resetAt: number }>();

// Precomputed salted scrypt credential verifier (zero plaintext secrets in source)
const DEFAULT_ADMIN_SCRYPT =
  '6e3b3a948122ece9b52282f5989a5ee3:591cf5fa244c9832860f87d3b5cd5f491e709b04c4d4881c029764f6fa644a0330a68127fe817ec36dd666fd5a42b1eb7e34e67f64d417eb4c633472182b5aa8';

function getAdminSigningKey(): Uint8Array {
  const secret =
    process.env.ADMIN_JWT_SECRET ||
    crypto
      .createHmac('sha256', firebaseProjectId || 'behavior-insight')
      .update('bi-admin-jwt-key-v1')
      .digest('hex');
  return new TextEncoder().encode(secret);
}

function timingSafeTextEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUser = (process.env.ADMIN_USERNAME || 'admin').trim();
  if (!timingSafeTextEqual(username.trim(), expectedUser)) {
    return false;
  }
  const envPass = process.env.ADMIN_PASSWORD;
  if (envPass && envPass.length > 0) {
    return timingSafeTextEqual(password, envPass);
  }
  const [salt, expectedHex] = DEFAULT_ADMIN_SCRYPT.split(':');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  return derivedBuf.length === expectedBuf.length && crypto.timingSafeEqual(derivedBuf, expectedBuf);
}

async function verifyAdminBearer(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'مصادقة الإدارة مطلوبة.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  if (!token || token.length > 4096) {
    res.status(401).json({ error: 'رمز الإدارة غير صالح.' });
    return;
  }
  try {
    const { payload } = await jwtVerify(token, getAdminSigningKey(), {
      issuer: 'behavior-insight-admin',
      audience: 'admin-session',
    });
    if (payload.role !== 'super_admin') {
      res.status(403).json({ error: 'صلاحية غير كافية.' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: 'انتهت جلسة الإدارة. يرجى تسجيل الدخول مجدداً.' });
  }
}

function checkRateLimit(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

// Verify Firebase ID Token via Google's official JWKS
async function verifyFirebaseAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'مصادقة مطلوبة للوصول إلى هذه الخدمة.' });
    return;
  }
  if (!firebaseProjectId) {
    res.status(500).json({ error: 'تعذر التحقق من إعدادات المشروع.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  if (!token || token.length > 4096) {
    res.status(401).json({ error: 'رمز المصادقة غير صالح.' });
    return;
  }
  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${firebaseProjectId}`,
      audience: firebaseProjectId,
    });
    const uid = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email : '';
    const emailVerified = payload.email_verified === true;
    if (!uid || !emailVerified) {
      res.status(403).json({ error: 'يرجى التحقق من البريد الإلكتروني للحساب أولاً.' });
      return;
    }
    req.authUser = { uid, email };
    next();
  } catch {
    res.status(401).json({ error: 'انتهت صلاحية الجلسة أو الرمز غير موثوق.' });
  }
}

// Health check
apiApp.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Admin Auth Login (server-verified credentials -> HS256 JWT)
apiApp.post('/api/admin/login', async (req: Request, res: Response) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(adminLoginAttempts, ip, 12, 15 * 60 * 1000)) {
    res.status(429).json({ error: 'تم تجاوز عدد المحاولات المسموح به. يرجى الانتظار قليلاً.' });
    return;
  }

  const username = typeof req.body?.username === 'string' ? req.body.username : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!username || !password || username.length > 100 || password.length > 200) {
    res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور.' });
    return;
  }

  if (!verifyAdminCredentials(username, password)) {
    res.status(401).json({ error: 'بيانات الدخول غير صحيحة.' });
    return;
  }

  adminLoginAttempts.delete(ip);
  const adminToken = await new SignJWT({ role: 'super_admin', username: username.trim() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('behavior-insight-admin')
    .setAudience('admin-session')
    .setExpirationTime('12h')
    .sign(getAdminSigningKey());

  res.json({ adminToken });
});

// Sign a tamper-proof subscription grant for same-phone user management
apiApp.post('/api/admin/device-grant', verifyAdminBearer, async (req: Request, res: Response) => {
  const uid = typeof req.body?.uid === 'string' ? req.body.uid.trim().slice(0, 128) : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().slice(0, 254) : '';
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim().slice(0, 120) : '';
  const subscriptionStatus = req.body?.subscriptionStatus === 'suspended' ? 'suspended' : 'active';
  const validFrom =
    typeof req.body?.validFrom === 'string' && (/^\d{4}-\d{2}-\d{2}$/.test(req.body.validFrom) || req.body.validFrom === '')
      ? req.body.validFrom
      : '';
  const validUntil =
    typeof req.body?.validUntil === 'string' && (/^\d{4}-\d{2}-\d{2}$/.test(req.body.validUntil) || req.body.validUntil === '')
      ? req.body.validUntil
      : '';
  const subscriptionPlanLabel =
    typeof req.body?.subscriptionPlanLabel === 'string' ? req.body.subscriptionPlanLabel.trim().slice(0, 80) : '';
  const rawPrice = Number(req.body?.subscriptionPrice);
  const subscriptionPrice = Number.isFinite(rawPrice) && rawPrice >= 0 && rawPrice <= 1000000 ? rawPrice : 0;

  if (!uid || !email) {
    res.status(400).json({ error: 'بيانات المستخدم غير مكتملة.' });
    return;
  }

  const grantToken = await new SignJWT({
    uid,
    email,
    displayName,
    subscriptionStatus,
    validFrom,
    validUntil,
    subscriptionPlanLabel,
    subscriptionPrice,
    updatedAt: new Date().toISOString(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('behavior-insight-admin')
    .setAudience('device-grant')
    .setExpirationTime('730d')
    .sign(getAdminSigningKey());

  res.json({ grantToken });
});

// Sign a tamper-proof global settings payload (WhatsApp number & monthly subscription defaults)
apiApp.post('/api/admin/settings-grant', verifyAdminBearer, async (req: Request, res: Response) => {
  const rawPhone = typeof req.body?.whatsappNumber === 'string' ? req.body.whatsappNumber.replace(/[^\d+]/g, '').slice(0, 24) : '';
  const rawPrice = Number(req.body?.defaultMonthlyPrice);
  const defaultMonthlyPrice = Number.isFinite(rawPrice) && rawPrice >= 0 && rawPrice <= 1000000 ? rawPrice : 0;
  const currency = typeof req.body?.currency === 'string' && req.body.currency.trim() ? req.body.currency.trim().slice(0, 16) : 'ج.م';

  const settingsToken = await new SignJWT({
    whatsappNumber: rawPhone,
    defaultMonthlyPrice,
    currency,
    updatedAt: new Date().toISOString(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('behavior-insight-admin')
    .setAudience('device-settings')
    .setExpirationTime('730d')
    .sign(getAdminSigningKey());

  res.json({ settingsToken });
});

// Verify stored device grant & settings tokens (prevents client-side localStorage tampering)
apiApp.post('/api/subscription/verify', async (req: Request, res: Response) => {
  const grantTokensRaw = Array.isArray(req.body?.grantTokens) ? req.body.grantTokens.slice(0, 30) : [];
  const settingsTokenRaw = typeof req.body?.settingsToken === 'string' ? req.body.settingsToken.trim() : '';

  const grants: Record<string, unknown>[] = [];
  for (const tok of grantTokensRaw) {
    if (typeof tok !== 'string' || tok.length > 4096) continue;
    try {
      const { payload } = await jwtVerify(tok, getAdminSigningKey(), {
        issuer: 'behavior-insight-admin',
        audience: 'device-grant',
      });
      if (typeof payload.uid === 'string') {
        grants.push({
          uid: payload.uid,
          email: payload.email || '',
          displayName: payload.displayName || '',
          subscriptionStatus: payload.subscriptionStatus === 'suspended' ? 'suspended' : 'active',
          validFrom: typeof payload.validFrom === 'string' ? payload.validFrom : '',
          validUntil: typeof payload.validUntil === 'string' ? payload.validUntil : '',
          subscriptionPlanLabel: typeof payload.subscriptionPlanLabel === 'string' ? payload.subscriptionPlanLabel : '',
          subscriptionPrice: typeof payload.subscriptionPrice === 'number' ? payload.subscriptionPrice : 0,
          updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : '',
        });
      }
    } catch {
      // ignore invalid or tampered tokens
    }
  }

  let settings: Record<string, unknown> | null = null;
  if (settingsTokenRaw && settingsTokenRaw.length <= 4096) {
    try {
      const { payload } = await jwtVerify(settingsTokenRaw, getAdminSigningKey(), {
        issuer: 'behavior-insight-admin',
        audience: 'device-settings',
      });
      settings = {
        whatsappNumber: typeof payload.whatsappNumber === 'string' ? payload.whatsappNumber : '',
        defaultMonthlyPrice: typeof payload.defaultMonthlyPrice === 'number' ? payload.defaultMonthlyPrice : 0,
        currency: typeof payload.currency === 'string' ? payload.currency : 'ج.م',
        updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : '',
      };
    } catch {
      settings = null;
    }
  }

  res.json({ grants, settings });
});

// 1. Guardian PIN Hashing (salted scrypt)
apiApp.post('/api/guardian/pin/hash', verifyFirebaseAuth, (req: AuthenticatedRequest, res: Response) => {
  const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
  if (!/^\d{4,8}$/.test(pin)) {
    res.status(400).json({ error: 'يجب أن يتكون رمز الحماية PIN من 4 إلى 8 أرقام.' });
    return;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 64).toString('hex');
  res.json({ pinHash: `${salt}:${derived}` });
});

// 2. Guardian PIN Verification (constant-time comparison + brute-force protection)
apiApp.post('/api/guardian/pin/verify', verifyFirebaseAuth, (req: AuthenticatedRequest, res: Response) => {
  const uid = req.authUser!.uid;
  const allowed = checkRateLimit(pinAttempts, uid, 6, 5 * 60 * 1000);
  if (!allowed) {
    res.status(429).json({
      verified: false,
      error: 'تم تجاوز عدد المحاولات المسموح به. يرجى الانتظار 5 دقائق قبل المحاولة مجدداً.',
    });
    return;
  }
  const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
  const storedHash = typeof req.body?.pinHash === 'string' ? req.body.pinHash.trim() : '';
  if (!/^\d{4,8}$/.test(pin) || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(storedHash)) {
    res.status(400).json({ verified: false, error: 'صيغة رمز الحماية غير صالحة.' });
    return;
  }
  const [salt, originalHex] = storedHash.split(':');
  const derivedBuf = crypto.scryptSync(pin, salt, 64);
  const originalBuf = Buffer.from(originalHex, 'hex');
  const isMatch = derivedBuf.length === originalBuf.length && crypto.timingSafeEqual(derivedBuf, originalBuf);
  if (isMatch) {
    pinAttempts.delete(uid);
  }
  res.json({ verified: isMatch });
});

// 3. SSRF-Safe Prayer Times Proxy (Aladhan Official API)
apiApp.get('/api/prayer-times', verifyFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const latRaw = typeof req.query.lat === 'string' ? Number(req.query.lat) : NaN;
  const lngRaw = typeof req.query.lng === 'string' ? Number(req.query.lng) : NaN;
  const cityRaw = typeof req.query.city === 'string' ? req.query.city.trim().slice(0, 80) : '';
  const countryRaw = typeof req.query.country === 'string' ? req.query.country.trim().slice(0, 80) : '';
  const isEgypt = countryRaw.toLowerCase().includes('egypt') || countryRaw.includes('مصر');
  const defaultMethod = isEgypt ? 5 : 4;
  const methodRaw = typeof req.query.method === 'string' ? Number(req.query.method) : defaultMethod;
  const method = Number.isInteger(methodRaw) && methodRaw >= 1 && methodRaw <= 15 ? methodRaw : defaultMethod;

  const now = new Date();
  const fallbackDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const dateRaw = typeof req.query.date === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(req.query.date)
    ? req.query.date
    : fallbackDate;

  let targetUrl: URL;
  if (Number.isFinite(latRaw) && Number.isFinite(lngRaw) && latRaw >= -90 && latRaw <= 90 && lngRaw >= -180 && lngRaw <= 180) {
    targetUrl = new URL(`https://api.aladhan.com/v1/timings/${dateRaw}`);
    targetUrl.searchParams.set('latitude', latRaw.toFixed(4));
    targetUrl.searchParams.set('longitude', lngRaw.toFixed(4));
    targetUrl.searchParams.set('method', String(method));
  } else {
    const safeCity = cityRaw || 'Cairo';
    const safeCountry = countryRaw || 'Egypt';
    targetUrl = new URL(`https://api.aladhan.com/v1/timingsByCity/${dateRaw}`);
    targetUrl.searchParams.set('city', safeCity);
    targetUrl.searchParams.set('country', safeCountry);
    targetUrl.searchParams.set('method', String(method));
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const upstream = await fetch(targetUrl.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    if (!upstream.ok) {
      res.status(502).json({ error: 'تعذر جلب مواقيت الصلاة حالياً من المزود الخارجي.' });
      return;
    }
    const json = (await upstream.json()) as {
      code?: number;
      data?: {
        timings?: Record<string, string>;
        date?: {
          hijri?: { date?: string; weekday?: { ar?: string }; month?: { ar?: string }; year?: string; day?: string };
          gregorian?: { date?: string };
        };
        meta?: { timezone?: string; method?: { name?: string } };
      };
    };
    const timings = json.data?.timings;
    if (!timings) {
      res.status(502).json({ error: 'استجابة مواقيت الصلاة غير مكتملة.' });
      return;
    }
    const stripOffset = (t?: string) => (t ? t.split(' ')[0] : '--:--');
    res.json({
      timings: {
        Fajr: stripOffset(timings.Fajr),
        Sunrise: stripOffset(timings.Sunrise),
        Dhuhr: stripOffset(timings.Dhuhr),
        Asr: stripOffset(timings.Asr),
        Maghrib: stripOffset(timings.Maghrib),
        Isha: stripOffset(timings.Isha),
      },
      hijri: json.data?.date?.hijri ?? null,
      timezone: json.data?.meta?.timezone ?? '',
      methodName: json.data?.meta?.method?.name ?? '',
    });
  } catch {
    res.status(504).json({ error: 'انتهت مهلة الاتصال بخدمة مواقيت الصلاة.' });
  }
});

function buildServerFallbackAnalysis(body: {
  profileName?: string;
  period?: 'daily' | 'weekly' | 'monthly';
  dateKey?: string;
  records?: Record<string, unknown>;
}) {
  const name = String(body.profileName || 'المتابَع').slice(0, 80);
  const period = body.period === 'weekly' || body.period === 'monthly' ? body.period : 'daily';
  const records = (body.records || {}) as {
    dailyAssessments?: Array<{ scores?: Record<string, number | null> }>;
    obedienceObservations?: Array<{ outcome?: string; firstTimeResponse?: boolean; neededReminder?: boolean }>;
    studySessions?: Array<{ status?: string; actualMinutes?: number; focusLevel?: number }>;
    prayerRecords?: Array<{ prayers?: Record<string, string> }>;
    tasks?: Array<{ status?: string; guardianApproved?: boolean }>;
  };

  const assessments = Array.isArray(records.dailyAssessments) ? records.dailyAssessments : [];
  const obs = Array.isArray(records.obedienceObservations) ? records.obedienceObservations : [];
  const study = Array.isArray(records.studySessions) ? records.studySessions : [];
  const prayers = Array.isArray(records.prayerRecords) ? records.prayerRecords : [];
  const tasks = Array.isArray(records.tasks) ? records.tasks : [];

  const totals = assessments
    .map((a) => a.scores?.total)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const avgTotal = totals.length
    ? Math.round((totals.reduce((s, n) => s + n, 0) / totals.length) * 10) / 10
    : null;

  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const completedStudy = study.filter((s) => s.status === 'completed').length;
  const totalStudyMins = study.reduce((s, x) => s + (Number(x.actualMinutes) || 0), 0);

  let loggedPrayers = 0;
  let onTimePrayers = 0;
  for (const pr of prayers) {
    for (const val of Object.values(pr.prayers || {})) {
      if (val && val !== 'unlogged') {
        loggedPrayers += 1;
        if (val === 'on_time') onTimePrayers += 1;
      }
    }
  }

  return {
    summary: `البيانات الفعلية لـ ${name} (${period === 'daily' ? 'اليوم' : period === 'weekly' ? 'أسبوعي' : 'شهري'}): ${
      avgTotal !== null ? `متوسط التقييم ${avgTotal}/10` : 'تقييم قيد التجميع'
    }، ${obs.length} موقف سلوكي، ${study.length} جلسة مذاكرة (${totalStudyMins} دقيقة)، ${loggedPrayers} صلاة مسجلة، و${completedTasks}/${tasks.length} مهمة منجزة.`,
    strongestAxis: avgTotal !== null && avgTotal >= 7.5 ? 'التوازن السلوكي العام' : 'بيانات المتابعة المسجلة',
    improvementAxis: tasks.length > completedTasks ? 'إتمام الواجبات اليومية' : 'استمرار التسجيل اليومي لجميع المحاور',
    recurringPatterns: obs.length
      ? `تم رصد ${obs.length} موقفاً (${obs.filter((o) => o.outcome === 'positive').length} استجابة إيجابية، ${obs.filter((o) => o.neededReminder).length} احتاج تذكيراً).`
      : 'سجلات سماع الكلام غير مسجلة في هذه الفترة.',
    studyConsistency: study.length
      ? `${study.length} جلسات (${completedStudy} مكتملة) بإجمالي ${totalStudyMins} دقيقة فعلية.`
      : 'لا توجد جلسات مذاكرة مسجلة في هذه الفترة.',
    responsibilityFollowup: tasks.length
      ? `تم إنجاز ${completedTasks} من ${tasks.length} مهمة يومية.`
      : 'لا توجد مهام مسجلة في هذه الفترة.',
    prayerSummary: loggedPrayers
      ? `تم تسجيل ${loggedPrayers} صلاة بلطف (${onTimePrayers} في وقتها).`
      : 'لم تُسجَّل صلوات في هذه الفترة بعد.',
    performanceDelta:
      totals.length >= 2
        ? `أحدث تقييم ${totals[totals.length - 1]}/10 مقارنة بالسجل السابق.`
        : 'لا توجد أيام مقارنة كافية في السجل بعد.',
    recommendations: [
      'متابعة التسجيل اليومي بانتظام لقياس التحسن بدقة موضوعية.',
      'تعزيز الاستجابة السريعة والالتزام بالمهام بمكافآت تشجيعية لطيفة.',
    ],
  };
}

// 4. Smart Behavioral Analysis (Gemini AI with Automatic Zero-API Fallback)
apiApp.post('/api/ai/analyze', verifyFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.authUser!.uid;
  const allowed = checkRateLimit(aiRequests, uid, 20, 60 * 60 * 1000);
  if (!allowed) {
    res.status(429).json({ error: 'تم الوصول للحد الأقصى لتحليلات الذكاء الاصطناعي في الساعة. يرجى المحاولة لاحقاً.' });
    return;
  }

  const body = req.body as {
    profileName?: string;
    profileAge?: number;
    period?: 'daily' | 'weekly' | 'monthly';
    dateKey?: string;
    records?: Record<string, unknown>;
  };

  if (!body || !body.profileName || !body.records) {
    res.status(400).json({ error: 'بيانات السجلات مطلوبة لإجراء التحليل.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.json({ analysis: buildServerFallbackAnalysis(body) });
    return;
  }

  const period = body.period === 'weekly' || body.period === 'monthly' ? body.period : 'daily';
  const safePayload = JSON.stringify(body.records).slice(0, 28000);

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const systemInstruction = `أنت محلل تربوي وسلوكي دقيق داخل نظام BEHAVIOR INSIGHT.
القواعد الصارمة التي لا يجوز مخالفتها:
1. لا تخترع أي معلومات أو أرقام أو أحداث غير موجودة حرفياً في البيانات المقدمة.
2. إذا كانت السجلات في أحد المحاور فارغة أو غير مسجلة، صرّح بوضوح أن البيانات غير مسجلة بعد ولا تفترض تقصيراً.
3. لا تصدر أي تشخيص نفسي أو طبي إطلاقاً.
4. لا تصدر أي أحكام دينية أو فقهية على المستخدم إطلاقاً، وتناول متابعة الصلاة باحترام ولطف وخصوصية.
5. ميّز بوضوح في صياغتك بين "البيانات الفعلية المسجلة" وبين "الاستنتاجات والتوصيات التربوية العملية".
6. قدم توصيات عملية قصيرة، لطيفة، وقابلة للتطبيق اليومي من قِبل ولي الأمر والشخص المتابَع.
7. اكتب بلغة عربية واضحة، مشجعة، ومناسبة للأسرة.`;

  const prompt = `حلل السجلات السلوكية الفعلية التالية للشخص: "${String(body.profileName).slice(0, 80)}" (العمر: ${Number(body.profileAge) || 'غير محدد'}).
الفترة المطلوبة: ${period === 'daily' ? 'التحليل اليومي' : period === 'weekly' ? 'التحليل الأسبوعي' : 'التحليل الشهري'} (تاريخ المرجع: ${String(body.dateKey || '')}).

السجلات الفعلية (JSON):
${safePayload}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: 'ملخص الأداء الفعلي المبني على السجلات فقط' },
            strongestAxis: { type: Type.STRING, description: 'أقوى محور وفق السجلات المتاحة' },
            improvementAxis: { type: Type.STRING, description: 'المحور الذي يحتاج إلى مزيد من الدعم أو الانتظام' },
            recurringPatterns: { type: Type.STRING, description: 'أكثر السلوكيات والملاحظات تكراراً في السجل' },
            studyConsistency: { type: Type.STRING, description: 'تحليل انتظام المذاكرة وجودتها بناءً على الجلسات المسجلة' },
            responsibilityFollowup: { type: Type.STRING, description: 'متابعة إنجاز الواجبات والمسؤوليات' },
            prayerSummary: { type: Type.STRING, description: 'ملخص محترم ولطيف لسجل الصلوات المسجلة' },
            performanceDelta: { type: Type.STRING, description: 'مقارنة الأداء بالأيام أو الفترات السابقة إن وجدت بيانات' },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'من 2 إلى 4 توصيات عملية قابلة للتطبيق والمراجعة من ولي الأمر',
            },
          },
          required: [
            'summary',
            'strongestAxis',
            'improvementAxis',
            'recurringPatterns',
            'studyConsistency',
            'responsibilityFollowup',
            'prayerSummary',
            'performanceDelta',
            'recommendations',
          ],
        },
      },
    });

    const text = (response.text ?? '{}').trim();
    const parsed = JSON.parse(text);
    res.json({ analysis: parsed });
  } catch (error) {
    console.warn('Gemini fallback triggered:', error);
    res.json({ analysis: buildServerFallbackAnalysis(body) });
  }
});

export default apiApp;
