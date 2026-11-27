export type AxisKey = 'obedience' | 'study' | 'prayer' | 'responsibilities';
export type AxisState = 'committed' | 'partial' | 'not_committed' | 'unrated';
export type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export type PrayerStatus = 'on_time' | 'late' | 'missed' | 'unlogged';
export type AppMode = 'guardian' | 'tracked';
export type AppTab =
  | 'dashboard'
  | 'assessment'
  | 'obedience'
  | 'study'
  | 'prayer'
  | 'responsibilities'
  | 'rewards'
  | 'ai'
  | 'reports'
  | 'settings';

export interface AxisWeights {
  obedience: number;
  study: number;
  prayer: number;
  responsibilities: number;
}

export type SubscriptionStatus = 'active' | 'suspended';

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  role: 'guardian';
  preferredLanguage: 'ar' | 'en';
  theme: 'dark' | 'light';
  pinEnabled?: boolean;
  pinHash?: string;
  subscriptionStatus?: SubscriptionStatus;
  validFrom?: string;
  validUntil?: string;
  subscriptionPlanLabel?: string;
  subscriptionPrice?: number;
  lastLoginAt?: string;
  deviceInfo?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SubscriptionSettings {
  whatsappNumber: string;
  defaultMonthlyPrice: number;
  currency: string;
  updatedAt?: unknown;
}

export interface MonitoredProfile {
  id: string;
  ownerId: string;
  name: string;
  age: number;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  avatarColor?: string;
  weights: AxisWeights;
  prayerAlertsEnabled: boolean;
  dailyGoalMinutes: number;
  activeStreak: number;
  totalPoints: number;
  totalStars: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BehaviorCategory {
  id: string;
  ownerId: string;
  profileId: string;
  key: AxisKey;
  title: string;
  description: string;
  weight: number;
  subCriteria: string[];
  updatedAt?: unknown;
}

export interface DailyAssessment {
  id: string;
  ownerId: string;
  profileId: string;
  dateKey: string;
  status: 'draft' | 'finalized';
  axisStates: Record<AxisKey, AxisState>;
  scores: {
    obedience: number | null;
    study: number | null;
    prayer: number | null;
    responsibilities: number | null;
    total: number | null;
  };
  manualOverride?: {
    isOverridden: boolean;
    reason: string;
    modifiedBy: string;
    originalTotal: number | null;
  };
  dailyEvents: string;
  endOfDaySummary: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BehaviorObservation {
  id: string;
  ownerId: string;
  profileId: string;
  dateKey: string;
  situation: string;
  guidanceGiven: string;
  reaction: string;
  outcome: 'positive' | 'partial' | 'needs_support';
  firstTimeResponse: boolean;
  neededReminder: boolean;
  criterionKey: string;
  isPoliteQuestion: boolean;
  pointsAwarded: number;
  notes: string;
  createdAt?: unknown;
}

export interface StudySession {
  id: string;
  ownerId: string;
  profileId: string;
  dateKey: string;
  subject: string;
  goalDescription: string;
  targetMinutes: number;
  startTime: string;
  endTime: string;
  actualMinutes: number;
  activityType: 'homework' | 'review' | 'exercises' | 'reading';
  focusLevel: number;
  qualityRating: number;
  status: 'completed' | 'partial' | 'incomplete' | 'postponed';
  postponeReason: string;
  notes: string;
  createdAt?: unknown;
}

export interface PrayerEntry {
  status: PrayerStatus;
  loggedAt: string;
  note: string;
}

export interface PrayerRecord {
  id: string;
  ownerId: string;
  profileId: string;
  dateKey: string;
  prayers: Record<PrayerKey, PrayerEntry>;
  updatedAt?: unknown;
}

export interface Responsibility {
  id: string;
  ownerId: string;
  profileId: string;
  title: string;
  description: string;
  dueTime: string;
  priority: 'high' | 'medium' | 'low';
  recurrence: 'daily' | 'weekly' | 'monthly';
  requiresProof: boolean;
  active: boolean;
  createdAt?: unknown;
}

export interface TaskItem {
  id: string;
  ownerId: string;
  profileId: string;
  responsibilityId: string;
  dateKey: string;
  title: string;
  description: string;
  dueTime: string;
  priority: 'high' | 'medium' | 'low';
  recurrence: 'daily' | 'weekly' | 'monthly';
  status: 'pending' | 'completed' | 'partial' | 'missed';
  completedAt?: string;
  proofImageDataUrl?: string;
  guardianApproved: boolean;
  guardianApprovedBy?: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Reward {
  id: string;
  ownerId: string;
  profileId: string;
  title: string;
  description: string;
  category: string;
  costPoints: number;
  redeemed: boolean;
  redeemedAt?: string;
  createdAt?: unknown;
}

export interface Achievement {
  id: string;
  ownerId: string;
  profileId: string;
  badgeKey: string;
  title: string;
  description: string;
  pointsBonus: number;
  earnedAt?: unknown;
}

export interface AIInsight {
  id: string;
  ownerId: string;
  profileId: string;
  dateKey: string;
  period: 'daily' | 'weekly' | 'monthly';
  summary: string;
  strongestAxis: string;
  improvementAxis: string;
  recurringPatterns: string;
  studyConsistency: string;
  responsibilityFollowup: string;
  prayerSummary: string;
  performanceDelta: string;
  recommendations: string[];
  status: 'pending_review' | 'approved' | 'rejected';
  approvedBy?: string;
  createdAt?: unknown;
}

export interface BehaviorReport {
  id: string;
  ownerId: string;
  profileId: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  averageScore: number;
  axisAverages: {
    obedience: number | null;
    study: number | null;
    prayer: number | null;
    responsibilities: number | null;
  };
  highlights: string;
  createdAt?: unknown;
}

export interface AuditLog {
  id: string;
  ownerId: string;
  profileId: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  reason: string;
  details: string;
  createdAt?: unknown;
}

export interface PrayerTimesResponse {
  timings: {
    Fajr: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
  };
  hijri?: {
    date?: string;
    day?: string;
    weekday?: { ar?: string };
    month?: { ar?: string };
    year?: string;
  } | null;
  timezone?: string;
  methodName?: string;
}

export const AXIS_META: Record<
  AxisKey,
  {
    key: AxisKey;
    titleAr: string;
    titleEn: string;
    subtitleAr: string;
    accentColor: string;
    defaultCriteria: string[];
  }
> = {
  obedience: {
    key: 'obedience',
    titleAr: 'سماع الكلام والاستجابة',
    titleEn: 'Listening & Guidance',
    subtitleAr: 'الاستجابة للتوجيهات باحترام وأدب',
    accentColor: '#0D9488',
    defaultCriteria: [
      'الاستجابة عند طلب تنفيذ شيء',
      'سرعة الاستجابة بصورة مناسبة',
      'احترام الوالدين أو المسؤولين',
      'التحدث بأدب واحترام',
      'عدم تجاهل التعليمات',
      'تنفيذ التوجيهات دون جدال غير مناسب',
      'تقبل النصيحة',
      'الاعتراف بالخطأ ومحاولة تصحيحه',
      'التعامل الهادئ عند الاختلاف',
    ],
  },
  study: {
    key: 'study',
    titleAr: 'المذاكرة والتعلم',
    titleEn: 'Study & Learning',
    subtitleAr: 'الالتزام بالجدول وجودة التركيز',
    accentColor: '#2563EB',
    defaultCriteria: [
      'الالتزام بالوقت المحدد للمذاكرة',
      'إنجاز الواجبات المدرسية',
      'مراجعة الدروس اليومية',
      'حل التدريبات والأنشطة',
      'مستوى التركيز أثناء الجلسة',
    ],
  },
  prayer: {
    key: 'prayer',
    titleAr: 'المحافظة على الصلاة',
    titleEn: 'Prayer Consistency',
    subtitleAr: 'متابعة الصلوات الخمس في أوقاتها بخصوصية',
    accentColor: '#10B981',
    defaultCriteria: [
      'أداء صلاة الفجر',
      'أداء صلاة الظهر',
      'أداء صلاة العصر',
      'أداء صلاة المغرب',
      'أداء صلاة العشاء',
    ],
  },
  responsibilities: {
    key: 'responsibilities',
    titleAr: 'الواجبات والمسؤوليات',
    titleEn: 'Responsibilities & Tasks',
    subtitleAr: 'تحمل المسؤولية والالتزام بالمهام اليومية',
    accentColor: '#C8A24A',
    defaultCriteria: [
      'ترتيب الغرفة والسرير',
      'المحافظة على النظافة الشخصية',
      'ترتيب الكتب والأدوات',
      'المساعدة في الأعمال المنزلية',
      'تحمل المسؤولية دون تذكير متكرر',
    ],
  },
};

export const PRAYERS_META: { key: PrayerKey; nameAr: string; nameEn: string }[] = [
  { key: 'fajr', nameAr: 'الفجر', nameEn: 'Fajr' },
  { key: 'dhuhr', nameAr: 'الظهر', nameEn: 'Dhuhr' },
  { key: 'asr', nameAr: 'العصر', nameEn: 'Asr' },
  { key: 'maghrib', nameAr: 'المغرب', nameEn: 'Maghrib' },
  { key: 'isha', nameAr: 'العشاء', nameEn: 'Isha' },
];

export const BADGE_CATALOG: {
  key: string;
  titleAr: string;
  descriptionAr: string;
  pointsBonus: number;
}[] = [
  {
    key: 'commitment_hero',
    titleAr: 'بطل الالتزام',
    descriptionAr: 'تحقيق تقييم إجمالي 8.5 فأعلى في يوم كامل',
    pointsBonus: 50,
  },
  {
    key: 'study_star',
    titleAr: 'نجم المذاكرة',
    descriptionAr: 'إكمال 3 جلسات مذاكرة بتركيز عالٍ (4 أو 5)',
    pointsBonus: 40,
  },
  {
    key: 'prayer_guardian',
    titleAr: 'محافظ على الصلاة',
    descriptionAr: 'تسجيل الصلوات الخمس كاملة في يوم واحد',
    pointsBonus: 60,
  },
  {
    key: 'responsibility_owner',
    titleAr: 'صاحب المسؤولية',
    descriptionAr: 'إنجاز جميع المسؤوليات اليومية واعتمادها من ولي الأمر',
    pointsBonus: 45,
  },
  {
    key: 'distinguished_week',
    titleAr: 'أسبوع متميز',
    descriptionAr: 'تحقيق سلسلة التزام لمدة 7 أيام متتالية',
    pointsBonus: 120,
  },
  {
    key: 'month_achievement',
    titleAr: 'إنجاز الشهر',
    descriptionAr: 'تجاوز 1000 نقطة تحفيزية إيجابية',
    pointsBonus: 200,
  },
];

export const DEFAULT_RESPONSIBILITIES: {
  title: string;
  description: string;
  dueTime: string;
  priority: 'high' | 'medium' | 'low';
  recurrence: 'daily' | 'weekly' | 'monthly';
  requiresProof: boolean;
}[] = [
  {
    title: 'ترتيب الغرفة والسرير',
    description: 'ترتيب السرير وتنظيم الغرفة بعد الاستيقاظ',
    dueTime: '08:30',
    priority: 'high',
    recurrence: 'daily',
    requiresProof: true,
  },
  {
    title: 'المحافظة على النظافة الشخصية',
    description: 'تنظيف الأسنان والوضوء والاهتمام بالمظهر',
    dueTime: '09:00',
    priority: 'high',
    recurrence: 'daily',
    requiresProof: false,
  },
  {
    title: 'ترتيب الكتب والأدوات المدرسية',
    description: 'تجهيز الحقيبة وترتيب المكتب بعد المذاكرة',
    dueTime: '19:30',
    priority: 'medium',
    recurrence: 'daily',
    requiresProof: true,
  },
  {
    title: 'المساعدة في الأعمال المنزلية',
    description: 'المساهمة الإيجابية في ترتيب المائدة أو مساعدة الأسرة',
    dueTime: '20:00',
    priority: 'medium',
    recurrence: 'daily',
    requiresProof: false,
  },
];
