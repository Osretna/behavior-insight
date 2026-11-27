import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { GoogleGenAI, Type } from '@google/genai';

const PORT = 3000;
const app = express();

// Read Firebase project config safely
const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let firebaseProjectId = '';
try {
  const raw = fs.readFileSync(firebaseConfigPath, 'utf-8');
  const parsed = JSON.parse(raw) as { projectId?: string };
  firebaseProjectId = parsed.projectId ?? '';
} catch {
  console.warn('Could not read firebase-applet-config.json at startup.');
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
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  next();
});

app.use(express.json({ limit: '512kb' }));

// Sliding-window in-memory rate limiters
const pinAttempts = new Map<string, { count: number; resetAt: number }>();
const aiRequests = new Map<string, { count: number; resetAt: number }>();

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
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// 1. Guardian PIN Hashing (salted scrypt)
app.post('/api/guardian/pin/hash', verifyFirebaseAuth, (req: AuthenticatedRequest, res: Response) => {
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
app.post('/api/guardian/pin/verify', verifyFirebaseAuth, (req: AuthenticatedRequest, res: Response) => {
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
app.get('/api/prayer-times', verifyFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const latRaw = typeof req.query.lat === 'string' ? Number(req.query.lat) : NaN;
  const lngRaw = typeof req.query.lng === 'string' ? Number(req.query.lng) : NaN;
  const cityRaw = typeof req.query.city === 'string' ? req.query.city.trim().slice(0, 80) : '';
  const countryRaw = typeof req.query.country === 'string' ? req.query.country.trim().slice(0, 80) : '';
  const methodRaw = typeof req.query.method === 'string' ? Number(req.query.method) : 4;
  const method = Number.isInteger(methodRaw) && methodRaw >= 1 && methodRaw <= 15 ? methodRaw : 4;

  const dateRaw = typeof req.query.date === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(req.query.date)
    ? req.query.date
    : '';

  let targetUrl: URL;
  if (Number.isFinite(latRaw) && Number.isFinite(lngRaw) && latRaw >= -90 && latRaw <= 90 && lngRaw >= -180 && lngRaw <= 180) {
    const pathSegment = dateRaw ? `/v1/timings/${dateRaw}` : '/v1/timings';
    targetUrl = new URL(`https://api.aladhan.com${pathSegment}`);
    targetUrl.searchParams.set('latitude', latRaw.toFixed(4));
    targetUrl.searchParams.set('longitude', lngRaw.toFixed(4));
    targetUrl.searchParams.set('method', String(method));
  } else {
    const safeCity = cityRaw || 'Cairo';
    const safeCountry = countryRaw || 'Egypt';
    const pathSegment = dateRaw ? `/v1/timingsByCity/${dateRaw}` : '/v1/timingsByCity';
    targetUrl = new URL(`https://api.aladhan.com${pathSegment}`);
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

// 4. Gemini AI Smart Behavioral Analysis (Strict Factual Grounding)
app.post('/api/ai/analyze', verifyFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const uid = req.authUser!.uid;
  const allowed = checkRateLimit(aiRequests, uid, 20, 60 * 60 * 1000);
  if (!allowed) {
    res.status(429).json({ error: 'تم الوصول للحد الأقصى لتحليلات الذكاء الاصطناعي في الساعة. يرجى المحاولة لاحقاً.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'مفتاح Gemini API غير مهيأ على الخادم.' });
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
    console.error('AI analysis error:', error);
    res.status(502).json({ error: 'تعذر إتمام التحليل الذكي حالياً. يرجى المحاولة بعد قليل.' });
  }
});

// Vite Dev Middleware or Static Production Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BEHAVIOR INSIGHT server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
