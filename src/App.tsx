import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getRedirectResult, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  Award,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  Compass,
  FileBarChart,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  Sun,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { auth, testConnection } from './lib/firebase';
import {
  ensureDailyAssessment,
  ensureUserAccount,
  evaluateAndSyncProfileRewards,
  subscribeProfileCollection,
  subscribeProfiles,
  subscribeSubscriptionSettings,
  subscribeUserAccount,
  syncComputedAssessmentForDate,
  updateUserPreferences,
} from './lib/firestoreService';
import {
  verifyStoredDeviceTokens,
  type SignedDeviceGrantPayload,
  type SignedDeviceSettingsPayload,
} from './lib/apiClient';
import {
  evaluateSubscriptionAccess,
  getDeviceGrantTokensList,
  getDeviceSettingsToken,
} from './lib/subscription';
import { buildEffectiveAssessments, getTodayDateKey } from './lib/scoring';
import type {
  Achievement,
  AIInsight,
  AppMode,
  AppTab,
  AuditLog,
  BehaviorCategory,
  BehaviorObservation,
  BehaviorReport,
  DailyAssessment,
  MonitoredProfile,
  PrayerRecord,
  Responsibility,
  Reward,
  StudySession,
  SubscriptionSettings,
  TaskItem,
  UserAccount,
} from './types/behavior';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthGate } from './components/AuthGate';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { SubscriptionBlockedScreen } from './components/SubscriptionBlockedScreen';
import { ProfileSetupModal } from './components/ProfileSetupModal';
import { ProfileManagerModal } from './components/ProfileManagerModal';
import { GuardianPinModal } from './components/GuardianPinModal';
import { IslamicEmblem } from './components/IslamicDecor';
import { DashboardView } from './components/DashboardView';
import { DailyAssessmentView } from './components/DailyAssessmentView';
import { ObedienceView } from './components/ObedienceView';
import { StudyView } from './components/StudyView';
import { PrayerView } from './components/PrayerView';
import { ResponsibilitiesView } from './components/ResponsibilitiesView';
import { RewardsView } from './components/RewardsView';
import { AIInsightsView } from './components/AIInsightsView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';

function MainApp() {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [profiles, setProfiles] = useState<MonitoredProfile[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [profilesRetryTick, setProfilesRetryTick] = useState(0);
  const [activeProfileId, setActiveProfileId] = useState<string>('');

  // Mode & UI State
  const [appMode, setAppMode] = useState<AppMode>('guardian');
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [selectedAssessmentDate, setSelectedAssessmentDate] = useState<string>(() => getTodayDateKey());
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileManagerOpen, setProfileManagerOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Admin & Subscription Control State
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [cloudSettings, setCloudSettings] = useState<SubscriptionSettings | null>(null);
  const [verifiedGrants, setVerifiedGrants] = useState<SignedDeviceGrantPayload[]>([]);
  const [verifiedSettings, setVerifiedSettings] = useState<SignedDeviceSettingsPayload | null>(null);
  const [deviceGrantSyncTick, setDeviceGrantSyncTick] = useState(0);

  // Active Profile Subcollections
  const [categories, setCategories] = useState<BehaviorCategory[]>([]);
  const [assessments, setAssessments] = useState<DailyAssessment[]>([]);
  const [observations, setObservations] = useState<BehaviorObservation[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [prayerRecords, setPrayerRecords] = useState<PrayerRecord[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [reports, setReports] = useState<BehaviorReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Apply theme class to documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Startup connection check & auth listener
  useEffect(() => {
    testConnection();
    let active = true;

    try {
      sessionStorage.removeItem('bi_auth_redirect_pending');
      sessionStorage.removeItem('bi_redirect_failed');
    } catch {
      // ignore
    }

    getRedirectResult(auth)
      .then((result) => {
        if (!active) return;
        if (result?.user) {
          setAuthError(null);
          setUser(result.user);
        }
      })
      .catch(() => {
        // ignore stale redirect state; AuthGate uses signInWithPopup
      });

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!active) return;
      setUser(firebaseUser);
      if (firebaseUser) {
        setAuthError(null);
        try {
          const account = await ensureUserAccount(firebaseUser);
          if (!active) return;
          setUserAccount(account);
          setTheme(account.theme || 'dark');
        } catch (err) {
          console.error('Failed ensuring user account', err);
        }
      } else {
        setUserAccount(null);
        setProfiles([]);
        setProfilesLoaded(false);
        setActiveProfileId('');
      }
      setAuthReady(true);
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  // Subscribe to profiles when authenticated (with graceful error & timeout recovery)
  useEffect(() => {
    if (!user) return;
    let settled = false;
    setProfilesError(null);

    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        setProfilesError('استغرق تحميل الملفات وقتاً أطول من المعتاد. تأكد من اتصالك بالإنترنت أو أعد المحاولة.');
        setProfilesLoaded(true);
      }
    }, 8000);

    const unsub = subscribeProfiles(
      user.uid,
      (list) => {
        settled = true;
        window.clearTimeout(timeoutId);
        setProfilesError(null);
        setProfiles(list);
        setProfilesLoaded(true);
        setActiveProfileId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          return list[0]?.id || '';
        });
      },
      (err) => {
        settled = true;
        window.clearTimeout(timeoutId);
        setProfilesError(err.message || 'تعذر تحميل قائمة الأسماء.');
        setProfilesLoaded(true);
      }
    );

    return () => {
      window.clearTimeout(timeoutId);
      unsub();
    };
  }, [user, profilesRetryTick]);

  // Verify any server-signed device subscription grants & settings stored on this phone
  useEffect(() => {
    let active = true;
    const grantTokens = getDeviceGrantTokensList();
    const settingsToken = getDeviceSettingsToken();
    if (grantTokens.length === 0 && !settingsToken) {
      setVerifiedGrants([]);
      setVerifiedSettings(null);
      return;
    }
    verifyStoredDeviceTokens(grantTokens, settingsToken)
      .then((res) => {
        if (!active) return;
        setVerifiedGrants(res.grants);
        setVerifiedSettings(res.settings);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [deviceGrantSyncTick]);

  // Real-time listeners for current user's subscription state & global WhatsApp/price settings
  useEffect(() => {
    if (!user) {
      setCloudSettings(null);
      return;
    }
    const unsubAccount = subscribeUserAccount(user.uid, (acc) => {
      if (acc) setUserAccount(acc);
    });
    const unsubSettings = subscribeSubscriptionSettings((s) => {
      setCloudSettings(s);
    });
    return () => {
      unsubAccount();
      unsubSettings();
    };
  }, [user]);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) || null,
    [profiles, activeProfileId]
  );

  const matchingDeviceGrant = useMemo(
    () => (user ? verifiedGrants.find((g) => g.uid === user.uid) || null : null),
    [user, verifiedGrants]
  );

  const effectiveSubscriptionSettings = useMemo(
    () => cloudSettings || verifiedSettings,
    [cloudSettings, verifiedSettings]
  );

  const subscriptionAccess = useMemo(
    () =>
      evaluateSubscriptionAccess({
        email: user?.email,
        account: userAccount,
        deviceGrant: matchingDeviceGrant,
        settings: effectiveSubscriptionSettings,
      }),
    [user?.email, userAccount, matchingDeviceGrant, effectiveSubscriptionSettings]
  );

  // Instant 0ms automatic evaluation computed from all entered records across all dates
  const effectiveAssessments = useMemo(
    () =>
      buildEffectiveAssessments(
        activeProfile,
        assessments,
        observations,
        studySessions,
        prayerRecords,
        tasks
      ),
    [activeProfile, assessments, observations, studySessions, prayerRecords, tasks]
  );

  // Subscribe to all active profile collections
  useEffect(() => {
    if (!user || !activeProfileId) return;
    const uid = user.uid;
    const pid = activeProfileId;
    const todayKey = getTodayDateKey();

    ensureDailyAssessment(uid, pid, todayKey).catch(() => {});

    const logColError = (name: string) => (err: Error) => {
      console.warn(`Collection ${name} listener warning:`, err.message);
    };

    const unsubs = [
      subscribeProfileCollection<BehaviorCategory>(uid, pid, 'behaviorCategories', setCategories, undefined, 'desc', logColError('behaviorCategories')),
      subscribeProfileCollection<DailyAssessment>(uid, pid, 'dailyAssessments', setAssessments, 'dateKey', 'desc', logColError('dailyAssessments')),
      subscribeProfileCollection<BehaviorObservation>(uid, pid, 'observations', setObservations, 'createdAt', 'desc', logColError('observations')),
      subscribeProfileCollection<StudySession>(uid, pid, 'studySessions', setStudySessions, 'createdAt', 'desc', logColError('studySessions')),
      subscribeProfileCollection<PrayerRecord>(uid, pid, 'prayerRecords', setPrayerRecords, 'dateKey', 'desc', logColError('prayerRecords')),
      subscribeProfileCollection<Responsibility>(uid, pid, 'responsibilities', setResponsibilities, 'createdAt', 'asc', logColError('responsibilities')),
      subscribeProfileCollection<TaskItem>(uid, pid, 'tasks', setTasks, 'createdAt', 'desc', logColError('tasks')),
      subscribeProfileCollection<Reward>(uid, pid, 'rewards', setRewards, 'createdAt', 'desc', logColError('rewards')),
      subscribeProfileCollection<Achievement>(uid, pid, 'achievements', setAchievements, 'earnedAt', 'desc', logColError('achievements')),
      subscribeProfileCollection<AIInsight>(uid, pid, 'aiInsights', setAiInsights, 'createdAt', 'desc', logColError('aiInsights')),
      subscribeProfileCollection<BehaviorReport>(uid, pid, 'reports', setReports, 'createdAt', 'desc', logColError('reports')),
      subscribeProfileCollection<AuditLog>(uid, pid, 'auditLogs', setAuditLogs, 'createdAt', 'desc', logColError('auditLogs')),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user, activeProfileId]);

  // Debounced auto-persistence of computed scores (across all modified dates) and badges/points
  const syncTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!user || !activeProfile) return;

    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      const existingByDate = new Map(assessments.map((a) => [a.dateKey, a]));
      const prayerByDate = new Map(prayerRecords.map((p) => [p.dateKey, p]));

      for (const eff of effectiveAssessments) {
        const stored = existingByDate.get(eff.dateKey);
        if (stored?.manualOverride?.isOverridden) continue;
        const needsWrite = stored
          ? stored.scores.obedience !== eff.scores.obedience ||
            stored.scores.study !== eff.scores.study ||
            stored.scores.prayer !== eff.scores.prayer ||
            stored.scores.responsibilities !== eff.scores.responsibilities ||
            stored.scores.total !== eff.scores.total
          : eff.scores.total !== null;

        if (needsWrite) {
          syncComputedAssessmentForDate(
            user.uid,
            activeProfile,
            eff.dateKey,
            observations,
            studySessions,
            prayerByDate.get(eff.dateKey) ?? null,
            tasks,
            stored
          ).catch(() => {});
        }
      }

      evaluateAndSyncProfileRewards(
        user.uid,
        activeProfile,
        effectiveAssessments,
        observations,
        studySessions,
        prayerRecords,
        tasks,
        achievements,
        rewards
      ).catch(() => {});
    }, 450);

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [
    user,
    activeProfile,
    assessments,
    effectiveAssessments,
    observations,
    studySessions,
    prayerRecords,
    tasks,
    achievements,
    rewards,
  ]);

  const renderStage = (): React.ReactNode => {
    if (!authReady) {
      return (
        <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#071120]">
          <div className="flex flex-col items-center gap-3">
            <IslamicEmblem size={48} />
            <p className="text-sm text-slate-500 dark:text-slate-400">جاري تهيئة BEHAVIOR INSIGHT...</p>
          </div>
        </div>
      );
    }

    if (!user) {
      return (
        <AuthGate
          initialError={authError}
          onSignedIn={(signedInUser) => {
            setAuthError(null);
            setUser(signedInUser);
          }}
          onTriggerAdmin={() => setAdminModalOpen(true)}
        />
      );
    }

    if (!subscriptionAccess.allowed) {
      return (
        <SubscriptionBlockedScreen
          userEmail={user.email || userAccount?.email || ''}
          displayName={userAccount?.displayName || user.displayName || 'مستخدم'}
          access={subscriptionAccess}
          whatsappNumber={effectiveSubscriptionSettings?.whatsappNumber || ''}
          currency={effectiveSubscriptionSettings?.currency || 'ج.م'}
          onSignOut={() => signOut(auth)}
          onTriggerAdmin={() => setAdminModalOpen(true)}
        />
      );
    }

    if (!profilesLoaded) {
      return (
        <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#071120] p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <IslamicEmblem size={44} />
            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">جاري تحميل قائمة الأسماء والملفات الشخصية...</p>
          </div>
        </div>
      );
    }

    if (profilesError && profiles.length === 0) {
      return (
        <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#071120] p-6">
          <div className="max-w-md w-full rounded-3xl bg-white dark:bg-[#0D192D] border border-slate-200 dark:border-slate-800 p-7 text-center space-y-4 shadow-xl">
            <IslamicEmblem size={48} />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">تعذر تحميل الملفات الشخصية</h2>
            <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
              {profilesError}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setProfilesLoaded(false);
                  setProfilesError(null);
                  setProfilesRetryTick((t) => t + 1);
                }}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة المحاولة</span>
              </button>
              <button
                type="button"
                onClick={() => setProfilesError(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>إضافة ملف جديد</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="text-xs text-slate-500 hover:text-rose-500 underline cursor-pointer"
            >
              تبديل حساب Gmail
            </button>
          </div>
        </div>
      );
    }

    if (profiles.length === 0 || !activeProfile) {
      return (
        <ProfileSetupModal
          uid={user.uid}
          onCreated={(id) => {
            setProfilesError(null);
            setActiveProfileId(id);
          }}
        />
      );
    }

  const handleToggleMode = () => {
    if (appMode === 'guardian') {
      setAppMode('tracked');
      if (activeTab === 'settings') setActiveTab('dashboard');
      return;
    }
    if (userAccount?.pinEnabled && userAccount.pinHash) {
      setPendingAction(() => () => setAppMode('guardian'));
      setPinModalOpen(true);
    } else {
      setAppMode('guardian');
    }
  };

  const handleNavigate = (tab: AppTab) => {
    if (tab === 'settings' && appMode === 'tracked') {
      if (userAccount?.pinEnabled && userAccount.pinHash) {
        setPendingAction(() => () => {
          setAppMode('guardian');
          setActiveTab('settings');
        });
        setPinModalOpen(true);
        return;
      }
      setAppMode('guardian');
    }
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleThemeToggle = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (userAccount) {
      updateUserPreferences(user.uid, { theme: next }, userAccount).catch(() => {});
    }
  };

  const navItems: { id: AppTab; label: string; icon: React.ReactNode; guardianOnly?: boolean }[] = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'assessment', label: 'التقييم اليومي', icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'obedience', label: 'سماع الكلام', icon: <Compass className="w-4 h-4" /> },
    { id: 'study', label: 'المذاكرة والتركيز', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'prayer', label: 'المحافظة على الصلاة', icon: <Moon className="w-4 h-4" /> },
    { id: 'responsibilities', label: 'الواجبات والمسؤوليات', icon: <CheckSquare className="w-4 h-4" /> },
    { id: 'rewards', label: 'النقاط والمكافآت', icon: <Award className="w-4 h-4" /> },
    { id: 'ai', label: 'التحليل الذكي AI', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'reports', label: 'التقارير والتصدير', icon: <FileBarChart className="w-4 h-4" /> },
    { id: 'settings', label: 'الإعدادات والأمان', icon: <Settings className="w-4 h-4" />, guardianOnly: true },
  ];

  const visibleNav = navItems.filter((item) => !(item.guardianOnly && appMode === 'tracked'));
  const activeNavLabel = navItems.find((n) => n.id === activeTab)?.label || 'لوحة التحكم';
  const guardianName = userAccount?.displayName || user.displayName || 'ولي الأمر';

  return (
    <div
      dir="rtl"
      className={`min-h-screen flex flex-col lg:flex-row ${
        theme === 'dark' ? 'islamic-lattice-dark bg-[#071120]' : 'islamic-lattice-light bg-slate-50'
      } text-slate-900 dark:text-slate-100`}
    >
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-72 shrink-0 border-l border-slate-200 dark:border-slate-800/90 bg-white/90 dark:bg-[#0A1527]/95 backdrop-blur-md sticky top-0 h-screen p-5 justify-between no-print">
        <div className="space-y-5 overflow-y-auto">
          {/* Brand */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <IslamicEmblem size={40} />
            <div>
              <div className="font-display font-bold text-base text-slate-900 dark:text-white tracking-tight">
                BEHAVIOR INSIGHT
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                نحو سلوك أفضل.. يوم بعد يوم
              </div>
            </div>
          </div>

          {/* Profile Switcher */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-slate-500 dark:text-slate-400">
                الاسم المختار للتقييم ({profiles.length})
              </label>
              <button
                type="button"
                onClick={() => setProfileManagerOpen(true)}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>قائمة الأسماء</span>
              </button>
            </div>
            <select
              value={activeProfile.id}
              onChange={(e) => setActiveProfileId(e.target.value)}
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.age} سنة)
                </option>
              ))}
            </select>
          </div>

          {/* Mode Switcher */}
          <button
            type="button"
            onClick={handleToggleMode}
            className={`w-full min-h-[42px] px-3.5 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
              appMode === 'guardian'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300'
            }`}
          >
            <span className="flex items-center gap-2">
              {appMode === 'guardian' ? <Shield className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              <span>{appMode === 'guardian' ? 'وضع ولي الأمر' : `وضع ${activeProfile.name}`}</span>
            </span>
            {appMode === 'tracked' && userAccount?.pinEnabled && <Lock className="w-3.5 h-3.5" />}
          </button>

          {/* Navigation */}
          <nav className="space-y-1">
            {visibleNav.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full min-h-[42px] px-3.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          <PWAInstallButton />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleThemeToggle}
              className="min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              <span>{theme === 'dark' ? 'فاتح' : 'داكن'}</span>
            </button>

            <button
              type="button"
              onClick={() => signOut(auth)}
              className="min-h-[40px] px-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Compact Header (<= 48px) */}
      <header className="lg:hidden sticky top-0 z-30 h-12 px-3 bg-white/90 dark:bg-[#0A1527]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between no-print">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200"
            aria-label="القائمة"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-sm truncate text-slate-900 dark:text-white">
            {activeNavLabel}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleToggleMode}
            className="min-h-[40px] px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
          >
            {appMode === 'guardian' ? 'ولي الأمر' : activeProfile.name}
          </button>
          <button
            type="button"
            onClick={handleThemeToggle}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300"
            aria-label="تبديل المظهر"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex no-print">
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 w-72 max-w-[82vw] h-full bg-white dark:bg-[#0A1527] p-5 flex flex-col justify-between overflow-y-auto shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <IslamicEmblem size={34} />
                  <span className="font-display font-bold text-sm text-slate-900 dark:text-white">
                    BEHAVIOR INSIGHT
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <select
                  value={activeProfile.id}
                  onChange={(e) => setActiveProfileId(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.age} سنة)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setProfileManagerOpen(true);
                  }}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  <span>قائمة الأسماء وإضافة طفل جديد</span>
                </button>
              </div>

              <nav className="space-y-1">
                {visibleNav.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full min-h-[44px] px-3.5 rounded-xl text-sm font-medium flex items-center gap-3 ${
                      activeTab === item.id
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="mt-6 space-y-2">
              <PWAInstallButton />
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="w-full min-h-[44px] px-4 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-10 max-w-7xl w-full mx-auto space-y-6">
        {/* Always-Visible Names Dropdown & Evaluation Quick Bar */}
        <div className="no-print rounded-2xl bg-white/95 dark:bg-[#0D192D]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-3.5 sm:px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm"
              style={{ backgroundColor: activeProfile.avatarColor || '#0D9488' }}
            >
              {activeProfile.name.trim().charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                اختر الاسم من القائمة للتقييم والمتابعة ({profiles.length} {profiles.length === 1 ? 'اسم' : 'أسماء'})
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <select
                  aria-label="اختيار الاسم للتقييم"
                  value={activeProfile.id}
                  onChange={(e) => setActiveProfileId(e.target.value)}
                  className="w-full sm:w-auto min-w-[200px] max-w-full min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.age} سنة
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setProfileManagerOpen(true)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-emerald-500/40 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>إضافة / قائمة الأسماء</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedAssessmentDate(getTodayDateKey());
                setActiveTab('assessment');
              }}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تقييم {activeProfile.name} اليوم</span>
            </button>
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <DashboardView
            uid={user.uid}
            profile={activeProfile}
            appMode={appMode}
            guardianName={guardianName}
            assessments={effectiveAssessments}
            observations={observations}
            studySessions={studySessions}
            prayerRecords={prayerRecords}
            responsibilities={responsibilities}
            tasks={tasks}
            onNavigate={handleNavigate}
            onOpenAssessmentForDate={(dk) => {
              setSelectedAssessmentDate(dk);
              setActiveTab('assessment');
            }}
          />
        )}
        {activeTab === 'assessment' && (
          <DailyAssessmentView
            uid={user.uid}
            profile={activeProfile}
            appMode={appMode}
            guardianName={guardianName}
            initialDateKey={selectedAssessmentDate}
            assessments={effectiveAssessments}
            observations={observations}
            studySessions={studySessions}
            prayerRecords={prayerRecords}
            tasks={tasks}
          />
        )}
        {activeTab === 'obedience' && (
          <ObedienceView
            uid={user.uid}
            profile={activeProfile}
            appMode={appMode}
            observations={observations}
          />
        )}
        {activeTab === 'study' && (
          <StudyView
            uid={user.uid}
            profile={activeProfile}
            appMode={appMode}
            sessions={studySessions}
          />
        )}
        {activeTab === 'prayer' && (
          <PrayerView uid={user.uid} profile={activeProfile} prayerRecords={prayerRecords} />
        )}
        {activeTab === 'responsibilities' && (
          <ResponsibilitiesView
            uid={user.uid}
            profile={activeProfile}
            appMode={appMode}
            guardianName={guardianName}
            responsibilities={responsibilities}
            tasks={tasks}
          />
        )}
        {activeTab === 'rewards' && (
          <RewardsView
            uid={user.uid}
            profile={activeProfile}
            appMode={appMode}
            rewards={rewards}
            achievements={achievements}
          />
        )}
        {activeTab === 'ai' && (
          <AIInsightsView
            uid={user.uid}
            profile={activeProfile}
            appMode={appMode}
            guardianName={guardianName}
            assessments={effectiveAssessments}
            observations={observations}
            studySessions={studySessions}
            prayerRecords={prayerRecords}
            tasks={tasks}
            aiInsights={aiInsights}
          />
        )}
        {activeTab === 'reports' && (
          <ReportsView
            uid={user.uid}
            profile={activeProfile}
            assessments={effectiveAssessments}
            observations={observations}
            studySessions={studySessions}
            prayerRecords={prayerRecords}
            tasks={tasks}
            savedReports={reports}
          />
        )}
        {activeTab === 'settings' && userAccount && (
          <SettingsView
            uid={user.uid}
            userAccount={userAccount}
            profile={activeProfile}
            profiles={profiles}
            categories={categories}
            auditLogs={auditLogs}
            onSelectProfile={(id) => setActiveProfileId(id)}
            onThemeChange={(t) => setTheme(t)}
          />
        )}
      </main>

      {/* Mobile Bottom Thumb-Zone Tab Bar (56px height) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-14 bg-white/95 dark:bg-[#0A1527]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center no-print">
        {[
          { id: 'dashboard', label: 'الرئيسية', icon: <LayoutDashboard className="w-5 h-5" /> },
          { id: 'assessment', label: 'التقييم', icon: <CheckCircle2 className="w-5 h-5" /> },
          { id: 'study', label: 'المذاكرة', icon: <BookOpen className="w-5 h-5" /> },
          { id: 'prayer', label: 'الصلاة', icon: <Moon className="w-5 h-5" /> },
          { id: 'responsibilities', label: 'المهام', icon: <CheckSquare className="w-5 h-5" /> },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleNavigate(tab.id as AppTab)}
              className={`h-full flex flex-col items-center justify-center gap-0.5 ${
                active ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {tab.icon}
              <span className="text-[10px] leading-none">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Guardian PIN Modal */}
      <GuardianPinModal
        isOpen={pinModalOpen}
        pinHash={userAccount?.pinHash || ''}
        onClose={() => {
          setPinModalOpen(false);
          setPendingAction(null);
        }}
        onUnlocked={() => {
          setPinModalOpen(false);
          if (pendingAction) pendingAction();
          setPendingAction(null);
        }}
      />

      {/* Profile Names Manager Modal */}
      <ProfileManagerModal
        isOpen={profileManagerOpen}
        uid={user.uid}
        profiles={profiles}
        activeProfileId={activeProfileId}
        onSelectProfile={(id) => {
          setActiveProfileId(id);
        }}
        onClose={() => setProfileManagerOpen(false)}
      />

      <OfflineIndicator />
    </div>
    );
  };

  return (
    <>
      {renderStage()}
      <AdminDashboardModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        verifiedGrants={verifiedGrants}
        verifiedSettings={verifiedSettings}
        cloudSettings={cloudSettings}
        onDeviceDataChanged={() => setDeviceGrantSyncTick((t) => t + 1)}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
