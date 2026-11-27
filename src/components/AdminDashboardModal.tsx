import React, { useEffect, useMemo, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import {
  Calendar,
  CheckCircle2,
  Cloud,
  DollarSign,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import {
  issueSignedDeviceGrant,
  issueSignedDeviceSettings,
  loginAdminPanel,
  type SignedDeviceGrantPayload,
  type SignedDeviceSettingsPayload,
} from '../lib/apiClient';
import {
  subscribeAllUsers,
  subscribeSubscriptionSettings,
  updateSubscriptionSettings,
  updateUserSubscription,
} from '../lib/firestoreService';
import {
  computeDateRangeForPreset,
  DURATION_PRESETS,
  getDeviceUsers,
  isAdminEmail,
  sanitizeWhatsAppDigits,
  saveDeviceGrantToken,
  saveDeviceSettingsToken,
  type DurationPresetKey,
} from '../lib/subscription';
import { getTodayDateKey } from '../lib/scoring';
import type { SubscriptionSettings, SubscriptionStatus, UserAccount } from '../types/behavior';

interface MergedAdminUser {
  uid: string;
  email: string;
  displayName: string;
  subscriptionStatus: SubscriptionStatus;
  validFrom: string;
  validUntil: string;
  subscriptionPlanLabel: string;
  subscriptionPrice: number;
  lastLoginAt: string;
  deviceInfo: string;
  source: 'cloud' | 'device' | 'both';
}

export function AdminDashboardModal({
  isOpen,
  onClose,
  verifiedGrants,
  verifiedSettings,
  cloudSettings,
  onDeviceDataChanged,
}: {
  isOpen: boolean;
  onClose: () => void;
  verifiedGrants: SignedDeviceGrantPayload[];
  verifiedSettings: SignedDeviceSettingsPayload | null;
  cloudSettings: SubscriptionSettings | null;
  onDeviceDataChanged: () => void;
}) {
  const [adminToken, setAdminToken] = useState<string>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Cloud Admin sync state
  const [currentFirebaseEmail, setCurrentFirebaseEmail] = useState<string>(
    () => auth.currentUser?.email || ''
  );
  const isCloudAdmin = isAdminEmail(currentFirebaseEmail);
  const [cloudUsers, setCloudUsers] = useState<UserAccount[]>([]);
  const [adminCloudSettings, setAdminCloudSettings] = useState<SubscriptionSettings | null>(cloudSettings);
  const [linkingGoogle, setLinkingGoogle] = useState(false);

  // Global WhatsApp & Pricing Form
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [defaultMonthlyPrice, setDefaultMonthlyPrice] = useState('100');
  const [currency, setCurrency] = useState('ج.م');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  // Users Search & Editor State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [selectedUid, setSelectedUid] = useState<string>('');
  const [validFrom, setValidFrom] = useState<string>(() => getTodayDateKey());
  const [validUntil, setValidUntil] = useState<string>('');
  const [planLabel, setPlanLabel] = useState<string>('شهر');
  const [userPrice, setUserPrice] = useState<string>('100');
  const [savingUser, setSavingUser] = useState(false);
  const [userActionMsg, setUserActionMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setCurrentFirebaseEmail(u?.email || '');
    });
    return () => unsub();
  }, []);

  // Load initial settings into form
  useEffect(() => {
    const effective = adminCloudSettings || cloudSettings || verifiedSettings;
    if (effective) {
      setWhatsappNumber(effective.whatsappNumber || '');
      setDefaultMonthlyPrice(String(effective.defaultMonthlyPrice ?? 100));
      setCurrency(effective.currency || 'ج.م');
    }
  }, [adminCloudSettings, cloudSettings, verifiedSettings]);

  // Subscribe to cloud users and global settings when Admin token & Admin Gmail are active
  useEffect(() => {
    if (!isOpen || !adminToken || !isCloudAdmin) return;
    const unsubUsers = subscribeAllUsers(
      (list) => setCloudUsers(list),
      (err) => console.warn('Admin cloud users listener warning:', err.message)
    );
    const unsubSettings = subscribeSubscriptionSettings(
      (s) => {
        if (s) setAdminCloudSettings(s);
      },
      () => {}
    );
    return () => {
      unsubUsers();
      unsubSettings();
    };
  }, [isOpen, adminToken, isCloudAdmin]);

  // Merge cloud users, device users, and verified device grants
  const mergedUsers = useMemo<MergedAdminUser[]>(() => {
    const map = new Map<string, MergedAdminUser>();
    const defaultPriceNum = Number(defaultMonthlyPrice) || 0;

    for (const du of getDeviceUsers()) {
      map.set(du.uid, {
        uid: du.uid,
        email: du.email,
        displayName: du.displayName || du.email.split('@')[0] || 'مستخدم',
        subscriptionStatus: 'active',
        validFrom: '',
        validUntil: '',
        subscriptionPlanLabel: '',
        subscriptionPrice: defaultPriceNum,
        lastLoginAt: du.lastLoginAt || '',
        deviceInfo: 'هذا الهاتف',
        source: 'device',
      });
    }

    for (const cu of cloudUsers) {
      if (isAdminEmail(cu.email)) continue;
      const existing = map.get(cu.uid);
      map.set(cu.uid, {
        uid: cu.uid,
        email: cu.email,
        displayName: cu.displayName || existing?.displayName || 'مستخدم',
        subscriptionStatus: cu.subscriptionStatus === 'suspended' ? 'suspended' : 'active',
        validFrom: cu.validFrom || '',
        validUntil: cu.validUntil || '',
        subscriptionPlanLabel: cu.subscriptionPlanLabel || '',
        subscriptionPrice:
          typeof cu.subscriptionPrice === 'number' && cu.subscriptionPrice > 0
            ? cu.subscriptionPrice
            : defaultPriceNum,
        lastLoginAt: cu.lastLoginAt || existing?.lastLoginAt || '',
        deviceInfo: cu.deviceInfo || existing?.deviceInfo || '',
        source: existing ? 'both' : 'cloud',
      });
    }

    for (const gr of verifiedGrants) {
      if (isAdminEmail(gr.email)) continue;
      const existing = map.get(gr.uid);
      map.set(gr.uid, {
        uid: gr.uid,
        email: gr.email || existing?.email || '',
        displayName: gr.displayName || existing?.displayName || 'مستخدم',
        subscriptionStatus: gr.subscriptionStatus,
        validFrom: gr.validFrom,
        validUntil: gr.validUntil,
        subscriptionPlanLabel: gr.subscriptionPlanLabel,
        subscriptionPrice: gr.subscriptionPrice > 0 ? gr.subscriptionPrice : existing?.subscriptionPrice ?? defaultPriceNum,
        lastLoginAt: existing?.lastLoginAt || '',
        deviceInfo: existing?.deviceInfo || 'هذا الهاتف',
        source: existing?.source === 'cloud' ? 'both' : 'device',
      });
    }

    return Array.from(map.values()).filter((u) => !isAdminEmail(u.email));
  }, [cloudUsers, verifiedGrants, defaultMonthlyPrice]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mergedUsers.filter((u) => {
      if (statusFilter !== 'all' && u.subscriptionStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });
  }, [mergedUsers, searchQuery, statusFilter]);

  const selectedUser = useMemo(
    () => mergedUsers.find((u) => u.uid === selectedUid) || filteredUsers[0] || null,
    [mergedUsers, filteredUsers, selectedUid]
  );

  // Sync editor inputs when selected user changes
  useEffect(() => {
    if (!selectedUser) return;
    setSelectedUid(selectedUser.uid);
    setValidFrom(selectedUser.validFrom || getTodayDateKey());
    setValidUntil(selectedUser.validUntil || '');
    setPlanLabel(selectedUser.subscriptionPlanLabel || 'شهر');
    setUserPrice(
      String(
        selectedUser.subscriptionPrice > 0
          ? selectedUser.subscriptionPrice
          : Number(defaultMonthlyPrice) || 100
      )
    );
    setUserActionMsg(null);
  }, [selectedUser?.uid]);

  if (!isOpen) return null;

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const token = await loginAdminPanel(username, password);
      setAdminToken(token);
      setUsername('');
      setPassword('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLinkAdminGmail = async () => {
    setLinkingGoogle(true);
    setSettingsMsg(null);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      setCurrentFirebaseEmail(res.user.email || '');
    } catch {
      setSettingsMsg('تعذر ربط حساب Gmail حالياً.');
    } finally {
      setLinkingGoogle(false);
    }
  };

  const handleSaveGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsMsg(null);
    const cleanedPhone = whatsappNumber.replace(/[^\d+]/g, '').trim();
    const normalizedDigits = sanitizeWhatsAppDigits(cleanedPhone);
    if (cleanedPhone && !normalizedDigits) {
      setSettingsMsg('يرجى إدخال رقم واتساب صحيح متضمناً كود الدولة (مثال: 201012345678).');
      return;
    }

    const numericPrice = Math.max(0, Number(defaultMonthlyPrice) || 0);
    setSavingSettings(true);
    try {
      const token = await issueSignedDeviceSettings(adminToken, {
        whatsappNumber: cleanedPhone,
        defaultMonthlyPrice: numericPrice,
        currency: currency.trim() || 'ج.م',
      });
      saveDeviceSettingsToken(token);

      if (isCloudAdmin) {
        await updateSubscriptionSettings({
          whatsappNumber: cleanedPhone,
          defaultMonthlyPrice: numericPrice,
          currency: currency.trim() || 'ج.م',
        });
      }

      onDeviceDataChanged();
      setSettingsMsg('تم حفظ رقم الواتساب وقيمة الاشتراك بنجاح.');
    } catch (err) {
      setSettingsMsg(err instanceof Error ? err.message : 'تعذر حفظ الإعدادات.');
    } finally {
      setSavingSettings(false);
    }
  };

  const applyPreset = (preset: DurationPresetKey) => {
    const base = validFrom || getTodayDateKey();
    const range = computeDateRangeForPreset(preset, base);
    setValidFrom(range.validFrom);
    setValidUntil(range.validUntil);
    setPlanLabel(range.label);
  };

  const handleApplyUserSubscription = async (targetStatus: SubscriptionStatus) => {
    if (!selectedUser) return;
    setUserActionMsg(null);

    if (targetStatus === 'active' && validFrom && validUntil && validUntil < validFrom) {
      setUserActionMsg('تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية.');
      return;
    }

    const priceNum = Math.max(0, Number(userPrice) || 0);
    setSavingUser(true);
    try {
      const grantToken = await issueSignedDeviceGrant(adminToken, {
        uid: selectedUser.uid,
        email: selectedUser.email,
        displayName: selectedUser.displayName,
        subscriptionStatus: targetStatus,
        validFrom: validFrom || '',
        validUntil: validUntil || '',
        subscriptionPlanLabel: planLabel || '',
        subscriptionPrice: priceNum,
      });
      saveDeviceGrantToken(selectedUser.uid, grantToken);

      if (isCloudAdmin && (selectedUser.source === 'cloud' || selectedUser.source === 'both')) {
        await updateUserSubscription(selectedUser.uid, {
          subscriptionStatus: targetStatus,
          validFrom: validFrom || '',
          validUntil: validUntil || '',
          subscriptionPlanLabel: planLabel || '',
          subscriptionPrice: priceNum,
        });
      }

      onDeviceDataChanged();
      setUserActionMsg(
        targetStatus === 'active'
          ? `تم تفعيل وتشغيل حساب (${selectedUser.email}) بنجاح.`
          : `تم إيقاف حساب (${selectedUser.email}) وستظهر له رسالة التواصل عبر الواتساب.`
      );
    } catch (err) {
      setUserActionMsg(err instanceof Error ? err.message : 'تعذر تحديث صلاحيات المستخدم.');
    } finally {
      setSavingUser(false);
    }
  };

  const handleAdminClose = () => {
    setAdminToken('');
    setUsername('');
    setPassword('');
    setLoginError(null);
    onClose();
  };

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={handleAdminClose} />

      {!adminToken ? (
        <div className="relative z-10 max-w-sm w-full rounded-3xl border border-white/15 bg-[#0B172A] text-slate-100 p-6 sm:p-7 shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">بوابة الإدارة</h3>
                <p className="text-[11px] text-slate-400">الوصول مخصص للمسؤول فقط</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAdminClose}
              className="w-9 h-9 rounded-xl hover:bg-white/10 flex items-center justify-center text-slate-400 cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs">
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">اسم المستخدم</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="اسم المستخدم"
                  className="w-full min-h-[44px] pr-10 pl-3 rounded-xl border border-slate-700 bg-slate-900/90 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">كلمة المرور</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="كلمة المرور"
                  className="w-full min-h-[44px] pr-10 pl-10 rounded-xl border border-slate-700 bg-slate-900/90 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  aria-label="إظهار أو إخفاء كلمة المرور"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-sm transition-colors cursor-pointer"
            >
              {loginLoading ? 'جاري التحقق...' : 'دخول لوحة الإدارة'}
            </button>
          </form>
        </div>
      ) : (
        <div className="relative z-10 max-w-5xl w-full max-h-[92vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#0B172A] text-slate-100 p-5 sm:p-7 shadow-2xl space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  لوحة تحكم الإدارة والاشتراكات
                </h2>
                <p className="text-xs text-slate-400">
                  التحكم الكامل في صلاحيات المستخدمين وفترات التشغيل وبيانات التواصل عبر الواتساب
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAdminClose}
                className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>خروج من الإدارة</span>
              </button>
            </div>
          </div>

          {/* Sync Status Banner */}
          <div
            className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isCloudAdmin
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-sky-500/10 border-sky-500/30 text-sky-200'
            }`}
          >
            <div className="flex items-start sm:items-center gap-2.5 text-xs">
              {isCloudAdmin ? (
                <Cloud className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
              ) : (
                <Smartphone className="w-4 h-4 text-sky-400 shrink-0 mt-0.5 sm:mt-0" />
              )}
              <span>
                {isCloudAdmin
                  ? `متصل سحابياً بحساب الإدارة (${currentFirebaseEmail}) — التعديلات تُطبق فوراً على جميع المستخدمين في كل الأجهزة.`
                  : 'وضع إدارة هذا الهاتف: يمكنك تشغيل أو إيقاف المستخدمين الذين سجلوا الدخول على هذا الهاتف مباشرة، أو ربط حساب الإدارة السحابي للتحكم عن بُعد.'}
              </span>
            </div>
            {!isCloudAdmin && (
              <button
                type="button"
                onClick={handleLinkAdminGmail}
                disabled={linkingGoogle}
                className="shrink-0 min-h-[38px] px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
              >
                {linkingGoogle ? 'جاري الربط...' : 'ربط حساب الإدارة السحابي (Gmail)'}
              </button>
            )}
          </div>

          {/* Section 1: WhatsApp & Monthly Subscription Price */}
          <form
            onSubmit={handleSaveGlobalSettings}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  إعدادات رقم الواتساب والاشتراك الشهري
                </h3>
              </div>
              {sanitizeWhatsAppDigits(whatsappNumber) && (
                <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg" dir="ltr">
                  wa.me/{sanitizeWhatsAppDigits(whatsappNumber)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-xs text-slate-300 font-semibold">
                  رقم الواتساب الخاص بك (مع كود الدولة)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="201012345678"
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-slate-300 font-semibold">
                  قيمة الاشتراك الشهري
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-amber-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={defaultMonthlyPrice}
                    onChange={(e) => setDefaultMonthlyPrice(e.target.value)}
                    className="w-full min-h-[42px] pr-9 pl-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-slate-300 font-semibold">العملة</label>
                <div className="flex gap-2">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="flex-1 min-h-[42px] px-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white"
                  >
                    <option value="ج.م">ج.م (جنيه مصري)</option>
                    <option value="ر.س">ر.س (ريال سعودي)</option>
                    <option value="د.إ">د.إ (درهم إماراتي)</option>
                    <option value="$">$ (دولار)</option>
                  </select>

                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
                  </button>
                </div>
              </div>
            </div>

            {settingsMsg && (
              <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
                {settingsMsg}
              </p>
            )}
          </form>

          {/* Section 2: Users Management & Period Activation */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Users List */}
            <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    المستخدمون ({filteredUsers.length})
                  </h3>
                </div>

                <div className="flex gap-1">
                  {(
                    [
                      { id: 'all', label: 'الكل' },
                      { id: 'active', label: 'نشط' },
                      { id: 'suspended', label: 'متوقف' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setStatusFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        statusFilter === f.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالبريد الإلكتروني أو الاسم..."
                  className="w-full min-h-[40px] pr-9 pl-3 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-2 max-h-[340px] overflow-y-auto pl-1">
                {filteredUsers.length === 0 ? (
                  <div className="p-5 rounded-xl border border-dashed border-slate-700 text-center text-xs text-slate-400 leading-relaxed">
                    لا يوجد مستخدمون مسجلون على هذا الهاتف بعد. بمجرد دخول أي مستخدم بحساب Gmail سيظهر هنا لإدارة اشتراكه وتفعيل فترته.
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected = selectedUser?.uid === u.uid;
                    const today = getTodayDateKey();
                    const isExpired = Boolean(u.validUntil && today > u.validUntil);
                    return (
                      <button
                        key={u.uid}
                        type="button"
                        onClick={() => setSelectedUid(u.uid)}
                        className={`w-full text-right p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-white truncate">
                            {u.displayName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              u.subscriptionStatus === 'suspended'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : isExpired
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {u.subscriptionStatus === 'suspended'
                              ? 'متوقف'
                              : isExpired
                                ? 'منتهي'
                                : 'يعمل'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 truncate mt-1" dir="ltr">
                          {u.email}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
                          <span>
                            {u.validFrom || u.validUntil
                              ? `${u.validFrom || 'الآن'} ← ${u.validUntil || 'مفتوح'}`
                              : 'تشغيل مفتوح (افتراضي)'}
                          </span>
                          {u.subscriptionPrice > 0 && (
                            <span className="text-amber-300 font-semibold">
                              {u.subscriptionPrice} {currency}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected User Editor */}
            <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5 space-y-5">
              {!selectedUser ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400 text-sm">
                  <Users className="w-10 h-10 mb-2 opacity-40" />
                  <p>اختر مستخدماً من القائمة لتحديد فترة السماح أو إيقاف / تشغيل الحساب.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                    <div>
                      <div className="text-xs text-slate-400">المستخدم المحدد للتحكم</div>
                      <div className="text-base font-bold text-white">{selectedUser.displayName}</div>
                      <div className="text-xs text-emerald-300 font-mono" dir="ltr">
                        {selectedUser.email}
                      </div>
                    </div>
                    <div
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                        selectedUser.subscriptionStatus === 'suspended'
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      }`}
                    >
                      الحالة الحالية:{' '}
                      {selectedUser.subscriptionStatus === 'suspended' ? 'متوقف عن العمل' : 'نشط ويعمل'}
                    </div>
                  </div>

                  {/* Quick Automatic Duration Buttons + Manual From/To */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span>تحديد فترة السماح تلقائياً أو يدوياً (من / إلى)</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {DURATION_PRESETS.map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => applyPreset(preset.key)}
                          className={`min-h-[36px] px-3.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                            planLabel === preset.label
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-slate-950 border-slate-700 text-slate-200 hover:border-emerald-500/50'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="block text-xs text-slate-300 font-semibold">من تاريخ</label>
                        <input
                          type="date"
                          value={validFrom}
                          onChange={(e) => {
                            setValidFrom(e.target.value);
                            setPlanLabel('مخصص');
                          }}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs text-slate-300 font-semibold">إلى تاريخ</label>
                        <input
                          type="date"
                          value={validUntil}
                          onChange={(e) => {
                            setValidUntil(e.target.value);
                            setPlanLabel('مخصص');
                          }}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs text-slate-300 font-semibold">
                          قيمة الاشتراك ({currency})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={userPrice}
                          onChange={(e) => setUserPrice(e.target.value)}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {userActionMsg && (
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{userActionMsg}</span>
                    </div>
                  )}

                  {/* Action Buttons: Activate vs Suspend */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      disabled={savingUser}
                      onClick={() => handleApplyUserSubscription('active')}
                      className="min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-sm inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer"
                    >
                      <PlayCircle className="w-5 h-5" />
                      <span>تفعيل وتشغيل المستخدم خلال الفترة</span>
                    </button>

                    <button
                      type="button"
                      disabled={savingUser}
                      onClick={() => handleApplyUserSubscription('suspended')}
                      className="min-h-[48px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold text-sm inline-flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 cursor-pointer"
                    >
                      <PauseCircle className="w-5 h-5" />
                      <span>إيقاف المستخدم عن العمل</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
