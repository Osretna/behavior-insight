import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  AXIS_META,
  BADGE_CATALOG,
  DEFAULT_RESPONSIBILITIES,
  type Achievement,
  type AIInsight,
  type AuditLog,
  type AxisKey,
  type AxisState,
  type AxisWeights,
  type BehaviorCategory,
  type BehaviorObservation,
  type BehaviorReport,
  type DailyAssessment,
  type MonitoredProfile,
  type PrayerKey,
  type PrayerRecord,
  type PrayerStatus,
  type Responsibility,
  type Reward,
  type StudySession,
  type TaskItem,
  type UserAccount,
} from '../types/behavior';
import {
  calculateStreak,
  clampScore,
  computeLiveAssessmentForDate,
  computeObedienceScore,
  computePrayerScore,
  computeResponsibilitiesScore,
  computeStudyScore,
  computeWeightedTotal,
  deriveAxisState,
  getTodayDateKey,
} from './scoring';

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function trunc(val: string | undefined | null, maxLen: number): string {
  if (!val) return '';
  return String(val).slice(0, maxLen);
}

function toSortComparable(val: unknown): number | string {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const maybeTs = val as { toMillis?: () => number; seconds?: number };
    if (typeof maybeTs.toMillis === 'function') return maybeTs.toMillis();
    if (typeof maybeTs.seconds === 'number') return maybeTs.seconds * 1000;
  }
  return 0;
}

function sortByField<T extends Record<string, unknown>>(
  items: T[],
  field: string,
  dir: 'asc' | 'desc'
): T[] {
  return [...items].sort((a, b) => {
    const va = toSortComparable(a[field]);
    const vb = toSortComparable(b[field]);
    let cmp = 0;
    if (typeof va === 'number' && typeof vb === 'number') {
      cmp = va - vb;
    } else {
      cmp = String(va).localeCompare(String(vb));
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

// --- User Account ---
export async function ensureUserAccount(user: User): Promise<UserAccount> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserAccount;
    }
    const newUser: Omit<UserAccount, 'createdAt' | 'updatedAt'> & {
      createdAt: ReturnType<typeof serverTimestamp>;
      updatedAt: ReturnType<typeof serverTimestamp>;
    } = {
      uid: user.uid,
      email: trunc(user.email || 'user@example.com', 254),
      displayName: trunc(user.displayName || 'ولي الأمر', 120),
      role: 'guardian',
      preferredLanguage: 'ar',
      theme: 'dark',
      pinEnabled: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(userRef, newUser);
    return {
      ...newUser,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function updateUserPreferences(
  uid: string,
  prefs: { displayName?: string; preferredLanguage?: 'ar' | 'en'; theme?: 'dark' | 'light' },
  current: UserAccount
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: trunc(prefs.displayName ?? current.displayName, 120),
      preferredLanguage: prefs.preferredLanguage ?? current.preferredLanguage,
      theme: prefs.theme ?? current.theme,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserPin(
  uid: string,
  pinEnabled: boolean,
  pinHash: string
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      pinEnabled,
      pinHash: trunc(pinHash, 256),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Profiles ---
export function subscribeProfiles(
  uid: string,
  onData: (profiles: MonitoredProfile[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/profiles`;
  const q = query(collection(db, 'users', uid, 'profiles'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({ ...(d.data() as Omit<MonitoredProfile, 'id'>), id: d.id }));
      onData(sortByField(list as Array<MonitoredProfile & Record<string, unknown>>, 'createdAt', 'asc') as MonitoredProfile[]);
    },
    (error) => {
      if (onError) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('subscribeProfiles error:', msg);
        onError(new Error(msg));
        return;
      }
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createMonitoredProfile(
  uid: string,
  input: {
    name: string;
    age: number;
    city?: string;
    country?: string;
    dailyGoalMinutes?: number;
    avatarColor?: string;
  }
): Promise<string> {
  const profileId = makeSafeId('prof');
  const path = `users/${uid}/profiles/${profileId}`;
  const defaultWeights: AxisWeights = {
    obedience: 25,
    study: 25,
    prayer: 25,
    responsibilities: 25,
  };
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists() && auth.currentUser) {
      await ensureUserAccount(auth.currentUser);
    }
    await setDoc(doc(db, 'users', uid, 'profiles', profileId), {
      ownerId: uid,
      name: trunc(input.name.trim(), 100),
      age: Math.min(99, Math.max(3, Math.round(input.age))),
      city: trunc(input.city || 'القاهرة', 100),
      country: trunc(input.country || 'Egypt', 100),
      avatarColor: trunc(input.avatarColor || '#0D9488', 32),
      weights: defaultWeights,
      prayerAlertsEnabled: true,
      dailyGoalMinutes: Math.min(600, Math.max(10, Math.round(input.dailyGoalMinutes || 60))),
      activeStreak: 0,
      totalPoints: 0,
      totalStars: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Seed default 4 behavior categories
    const axes: AxisKey[] = ['obedience', 'study', 'prayer', 'responsibilities'];
    for (const key of axes) {
      const meta = AXIS_META[key];
      await setDoc(doc(db, 'users', uid, 'profiles', profileId, 'behaviorCategories', key), {
        ownerId: uid,
        profileId,
        key,
        title: meta.titleAr,
        description: meta.subtitleAr,
        weight: 25,
        subCriteria: meta.defaultCriteria,
        updatedAt: serverTimestamp(),
      });
    }

    // Seed default responsibilities
    for (const item of DEFAULT_RESPONSIBILITIES) {
      const respId = makeSafeId('resp');
      await setDoc(doc(db, 'users', uid, 'profiles', profileId, 'responsibilities', respId), {
        ownerId: uid,
        profileId,
        title: item.title,
        description: item.description,
        dueTime: item.dueTime,
        priority: item.priority,
        recurrence: item.recurrence,
        requiresProof: item.requiresProof,
        active: true,
        createdAt: serverTimestamp(),
      });
    }

    // Seed starter motivational rewards
    const starterRewards = [
      {
        title: 'نزهة عائلية مفضلة',
        description: 'خروج في نزهة أو نشاط ترفيهي من اختيار الشخص',
        category: 'نزهة',
        costPoints: 250,
      },
      {
        title: 'اختيار وجبة مفضلة',
        description: 'تحديد وجبة العشاء أو الحلوى المفضلة في نهاية الأسبوع',
        category: 'وجبة مفضلة',
        costPoints: 150,
      },
      {
        title: 'وقت إضافي لنشاط ترفيهي',
        description: 'ساعة إضافية للرسم أو الرياضة أو اللعب المفيد',
        category: 'نشاط ترفيهي',
        costPoints: 100,
      },
    ];
    for (const rw of starterRewards) {
      const rewardId = makeSafeId('rew');
      await setDoc(doc(db, 'users', uid, 'profiles', profileId, 'rewards', rewardId), {
        ownerId: uid,
        profileId,
        title: rw.title,
        description: rw.description,
        category: rw.category,
        costPoints: rw.costPoints,
        redeemed: false,
        createdAt: serverTimestamp(),
      });
    }

    return profileId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateProfileDetails(
  uid: string,
  profileId: string,
  data: Partial<
    Pick<
      MonitoredProfile,
      'name' | 'age' | 'city' | 'country' | 'latitude' | 'longitude' | 'avatarColor' | 'prayerAlertsEnabled' | 'dailyGoalMinutes'
    >
  >
): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}`;
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (data.name !== undefined) payload.name = trunc(data.name.trim(), 100);
  if (data.age !== undefined) payload.age = Math.min(99, Math.max(3, Math.round(data.age)));
  if (data.city !== undefined) payload.city = trunc(data.city.trim(), 100);
  if (data.country !== undefined) payload.country = trunc(data.country.trim(), 100);
  if (data.latitude !== undefined) payload.latitude = data.latitude;
  if (data.longitude !== undefined) payload.longitude = data.longitude;
  if (data.avatarColor !== undefined) payload.avatarColor = trunc(data.avatarColor, 32);
  if (data.prayerAlertsEnabled !== undefined) payload.prayerAlertsEnabled = data.prayerAlertsEnabled;
  if (data.dailyGoalMinutes !== undefined) payload.dailyGoalMinutes = Math.min(600, Math.max(10, Math.round(data.dailyGoalMinutes)));

  try {
    await updateDoc(doc(db, 'users', uid, 'profiles', profileId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMonitoredProfile(uid: string, profileId: string): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'profiles', profileId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateProfileWeights(
  uid: string,
  profileId: string,
  weights: AxisWeights,
  actorName: string
): Promise<void> {
  const sum = weights.obedience + weights.study + weights.prayer + weights.responsibilities;
  if (sum !== 100) {
    throw new Error('يجب أن يكون مجموع أوزان المحاور الأربعة مساوياً 100%.');
  }
  const path = `users/${uid}/profiles/${profileId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'profiles', profileId), {
      weights,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(uid, profileId, {
      action: 'UPDATE_WEIGHTS',
      entityType: 'profile',
      entityId: profileId,
      actorName,
      reason: 'تعديل أوزان التقييم للمحاور الأربعة',
      details: `سماع الكلام: ${weights.obedience}%، المذاكرة: ${weights.study}%، الصلاة: ${weights.prayer}%، الواجبات: ${weights.responsibilities}%`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncProfileStats(
  uid: string,
  profileId: string,
  stats: { activeStreak: number; totalPoints: number; totalStars: number }
): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'profiles', profileId), {
      activeStreak: Math.max(0, Math.round(stats.activeStreak)),
      totalPoints: Math.max(0, Math.round(stats.totalPoints)),
      totalStars: Math.max(0, Math.round(stats.totalStars)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Subcollection Subscriptions ---
export function subscribeProfileCollection<T>(
  uid: string,
  profileId: string,
  colName: string,
  onData: (items: T[]) => void,
  orderField?: string,
  dir: 'asc' | 'desc' = 'desc',
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/profiles/${profileId}/${colName}`;
  const colRef = collection(db, 'users', uid, 'profiles', profileId, colName);
  const q = query(colRef, where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id }));
      const sorted = orderField ? sortByField(items, orderField, dir) : items;
      onData(sorted as T[]);
    },
    (error) => {
      if (onError) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`subscribeProfileCollection(${colName}) error:`, msg);
        onError(new Error(msg));
        return;
      }
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// --- Behavior Categories ---
export async function updateBehaviorCategory(
  uid: string,
  profileId: string,
  categoryId: string,
  data: { title: string; description: string; weight: number; subCriteria: string[] }
): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}/behaviorCategories/${categoryId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'profiles', profileId, 'behaviorCategories', categoryId), {
      title: trunc(data.title, 120),
      description: trunc(data.description, 500),
      weight: Math.min(100, Math.max(0, Math.round(data.weight))),
      subCriteria: data.subCriteria.slice(0, 20).map((s) => trunc(s.trim(), 120)).filter(Boolean),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Daily Assessment ---
export async function ensureDailyAssessment(
  uid: string,
  profileId: string,
  dateKey: string
): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}/dailyAssessments/${dateKey}`;
  const ref = doc(db, 'users', uid, 'profiles', profileId, 'dailyAssessments', dateKey);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerId: uid,
        profileId,
        dateKey,
        status: 'draft',
        axisStates: {
          obedience: 'unrated',
          study: 'unrated',
          prayer: 'unrated',
          responsibilities: 'unrated',
        },
        scores: {
          obedience: null,
          study: null,
          prayer: null,
          responsibilities: null,
          total: null,
        },
        dailyEvents: '',
        endOfDaySummary: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveDailyAssessment(
  uid: string,
  profileId: string,
  dateKey: string,
  payload: {
    status: 'draft' | 'finalized';
    axisStates: Record<AxisKey, AxisState>;
    scores: DailyAssessment['scores'];
    dailyEvents: string;
    endOfDaySummary: string;
  },
  existingAssessment?: DailyAssessment
): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}/dailyAssessments/${dateKey}`;
  const ref = doc(db, 'users', uid, 'profiles', profileId, 'dailyAssessments', dateKey);
  try {
    if (!existingAssessment) {
      await setDoc(ref, {
        ownerId: uid,
        profileId,
        dateKey,
        status: payload.status,
        axisStates: payload.axisStates,
        scores: payload.scores,
        dailyEvents: trunc(payload.dailyEvents, 3000),
        endOfDaySummary: trunc(payload.endOfDaySummary, 2000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (existingAssessment.status === 'finalized') {
      await updateDoc(ref, {
        status: 'draft',
        updatedAt: serverTimestamp(),
      });
    }

    await updateDoc(ref, {
      status: payload.status,
      axisStates: payload.axisStates,
      scores: payload.scores,
      dailyEvents: trunc(payload.dailyEvents, 3000),
      endOfDaySummary: trunc(payload.endOfDaySummary, 2000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function overrideAssessmentScore(
  uid: string,
  profileId: string,
  dateKey: string,
  newScores: DailyAssessment['scores'],
  originalTotal: number | null,
  reason: string,
  modifiedBy: string
): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}/dailyAssessments/${dateKey}`;
  const ref = doc(db, 'users', uid, 'profiles', profileId, 'dailyAssessments', dateKey);
  try {
    await updateDoc(ref, {
      scores: newScores,
      manualOverride: {
        isOverridden: true,
        reason: trunc(reason.trim(), 500),
        modifiedBy: trunc(modifiedBy.trim(), 120),
        originalTotal,
      },
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(uid, profileId, {
      action: 'MANUAL_SCORE_OVERRIDE',
      entityType: 'dailyAssessment',
      entityId: dateKey,
      actorName: modifiedBy,
      reason: reason.trim(),
      details: `تعديل الدرجة الإجمالية من ${originalTotal ?? 'غير مقيم'} إلى ${newScores.total ?? 'غير مقيم'}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Recompute and sync scores for a given date from actual records
export async function syncComputedAssessmentForDate(
  uid: string,
  profile: MonitoredProfile,
  dateKey: string,
  observations: BehaviorObservation[],
  sessions: StudySession[],
  prayerRecord: PrayerRecord | null,
  tasks: TaskItem[],
  currentAssessment?: DailyAssessment
): Promise<void> {
  if (currentAssessment?.manualOverride?.isOverridden) {
    return;
  }

  const computed = computeLiveAssessmentForDate(
    profile,
    dateKey,
    observations,
    sessions,
    prayerRecord,
    tasks,
    currentAssessment
  );

  // Skip Firestore write if computed scores and states already match persisted assessment
  if (currentAssessment) {
    const sameScores =
      currentAssessment.scores.obedience === computed.scores.obedience &&
      currentAssessment.scores.study === computed.scores.study &&
      currentAssessment.scores.prayer === computed.scores.prayer &&
      currentAssessment.scores.responsibilities === computed.scores.responsibilities &&
      currentAssessment.scores.total === computed.scores.total;
    const sameStates =
      currentAssessment.axisStates.obedience === computed.axisStates.obedience &&
      currentAssessment.axisStates.study === computed.axisStates.study &&
      currentAssessment.axisStates.prayer === computed.axisStates.prayer &&
      currentAssessment.axisStates.responsibilities === computed.axisStates.responsibilities;
    if (sameScores && sameStates) {
      return;
    }
  } else if (computed.scores.total === null) {
    // Nothing entered yet for a brand-new date; avoid creating empty docs unnecessarily
    return;
  }

  await saveDailyAssessment(
    uid,
    profile.id,
    dateKey,
    {
      status: currentAssessment?.status ?? 'draft',
      axisStates: computed.axisStates,
      scores: computed.scores,
      dailyEvents: currentAssessment?.dailyEvents ?? '',
      endOfDaySummary: currentAssessment?.endOfDaySummary ?? '',
    },
    currentAssessment
  );
}

// --- Axis 1: Observations ---
export async function addObservation(
  uid: string,
  profileId: string,
  input: Omit<BehaviorObservation, 'id' | 'ownerId' | 'profileId' | 'createdAt'>
): Promise<string> {
  const id = makeSafeId('obs');
  const path = `users/${uid}/profiles/${profileId}/observations/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'profiles', profileId, 'observations', id), {
      ownerId: uid,
      profileId,
      dateKey: input.dateKey,
      situation: trunc(input.situation.trim(), 500),
      guidanceGiven: trunc(input.guidanceGiven.trim(), 500),
      reaction: trunc(input.reaction.trim(), 500),
      outcome: input.outcome,
      firstTimeResponse: input.firstTimeResponse,
      neededReminder: input.neededReminder,
      criterionKey: trunc(input.criterionKey, 80),
      isPoliteQuestion: input.isPoliteQuestion,
      pointsAwarded: Math.min(50, Math.max(0, Math.round(input.pointsAwarded))),
      notes: trunc(input.notes, 1000),
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteObservation(uid: string, profileId: string, obsId: string): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}/observations/${obsId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'profiles', profileId, 'observations', obsId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Axis 2: Study Sessions ---
export async function addStudySession(
  uid: string,
  profileId: string,
  input: Omit<StudySession, 'id' | 'ownerId' | 'profileId' | 'createdAt'>
): Promise<string> {
  const id = makeSafeId('study');
  const path = `users/${uid}/profiles/${profileId}/studySessions/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'profiles', profileId, 'studySessions', id), {
      ownerId: uid,
      profileId,
      dateKey: input.dateKey,
      subject: trunc(input.subject.trim(), 120),
      goalDescription: trunc(input.goalDescription.trim(), 300),
      targetMinutes: Math.min(480, Math.max(1, Math.round(input.targetMinutes))),
      startTime: trunc(input.startTime, 20),
      endTime: trunc(input.endTime, 20),
      actualMinutes: Math.min(480, Math.max(0, Math.round(input.actualMinutes))),
      activityType: input.activityType,
      focusLevel: Math.min(5, Math.max(1, Math.round(input.focusLevel))),
      qualityRating: Math.min(5, Math.max(1, Math.round(input.qualityRating))),
      status: input.status,
      postponeReason: trunc(input.postponeReason, 300),
      notes: trunc(input.notes, 1000),
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateStudySessionStatus(
  uid: string,
  profileId: string,
  sessionId: string,
  updates: Partial<StudySession>
): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}/studySessions/${sessionId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'profiles', profileId, 'studySessions', sessionId), {
      ...updates,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteStudySession(uid: string, profileId: string, sessionId: string): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}/studySessions/${sessionId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'profiles', profileId, 'studySessions', sessionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Axis 3: Prayer Records ---
export async function upsertPrayerStatus(
  uid: string,
  profileId: string,
  dateKey: string,
  prayerKey: PrayerKey,
  status: PrayerStatus,
  note: string,
  existingRecord?: PrayerRecord
): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}/prayerRecords/${dateKey}`;
  const ref = doc(db, 'users', uid, 'profiles', profileId, 'prayerRecords', dateKey);
  const nowStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const emptyPrayers: PrayerRecord['prayers'] = {
    fajr: { status: 'unlogged', loggedAt: '', note: '' },
    dhuhr: { status: 'unlogged', loggedAt: '', note: '' },
    asr: { status: 'unlogged', loggedAt: '', note: '' },
    maghrib: { status: 'unlogged', loggedAt: '', note: '' },
    isha: { status: 'unlogged', loggedAt: '', note: '' },
  };
  const prayers = existingRecord ? { ...existingRecord.prayers } : emptyPrayers;
  prayers[prayerKey] = {
    status,
    loggedAt: status === 'unlogged' ? '' : nowStr,
    note: trunc(note, 400),
  };

  try {
    if (!existingRecord) {
      await setDoc(ref, {
        ownerId: uid,
        profileId,
        dateKey,
        prayers,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        prayers,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Axis 4: Responsibilities & Tasks ---
export async function addResponsibility(
  uid: string,
  profileId: string,
  input: Omit<Responsibility, 'id' | 'ownerId' | 'profileId' | 'createdAt'>
): Promise<string> {
  const id = makeSafeId('resp');
  const path = `users/${uid}/profiles/${profileId}/responsibilities/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'profiles', profileId, 'responsibilities', id), {
      ownerId: uid,
      profileId,
      title: trunc(input.title.trim(), 160),
      description: trunc(input.description, 500),
      dueTime: trunc(input.dueTime, 20),
      priority: input.priority,
      recurrence: input.recurrence,
      requiresProof: input.requiresProof,
      active: input.active,
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleResponsibilityActive(
  uid: string,
  profileId: string,
  respId: string,
  active: boolean
): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}/responsibilities/${respId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'profiles', profileId, 'responsibilities', respId), { active });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addTaskItem(
  uid: string,
  profileId: string,
  input: Omit<TaskItem, 'id' | 'ownerId' | 'profileId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = makeSafeId('task');
  const path = `users/${uid}/profiles/${profileId}/tasks/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'profiles', profileId, 'tasks', id), {
      ownerId: uid,
      profileId,
      responsibilityId: trunc(input.responsibilityId, 128),
      dateKey: input.dateKey,
      title: trunc(input.title.trim(), 160),
      description: trunc(input.description, 500),
      dueTime: trunc(input.dueTime, 20),
      priority: input.priority,
      recurrence: input.recurrence,
      status: input.status,
      guardianApproved: input.guardianApproved,
      notes: trunc(input.notes, 1000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function ensureDailyTasksForDate(
  uid: string,
  profileId: string,
  dateKey: string,
  responsibilities: Responsibility[],
  existingTasks: TaskItem[]
): Promise<void> {
  const dayTasks = existingTasks.filter((t) => t.dateKey === dateKey);
  const existingRespIds = new Set(dayTasks.map((t) => t.responsibilityId));
  const activeDaily = responsibilities.filter((r) => r.active && !existingRespIds.has(r.id));

  for (const r of activeDaily) {
    await addTaskItem(uid, profileId, {
      responsibilityId: r.id,
      dateKey,
      title: r.title,
      description: r.description,
      dueTime: r.dueTime,
      priority: r.priority,
      recurrence: r.recurrence,
      status: 'pending',
      guardianApproved: false,
      notes: '',
    });
  }
}

export async function updateTaskProgress(
  uid: string,
  profileId: string,
  taskId: string,
  updates: {
    status: TaskItem['status'];
    notes: string;
    proofImageDataUrl?: string;
  }
): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}/tasks/${taskId}`;
  const payload: Record<string, unknown> = {
    status: updates.status,
    notes: trunc(updates.notes, 1000),
    completedAt: updates.status === 'completed' ? new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '',
    updatedAt: serverTimestamp(),
  };
  if (updates.proofImageDataUrl !== undefined) {
    payload.proofImageDataUrl = trunc(updates.proofImageDataUrl, 195000);
  }
  try {
    await updateDoc(doc(db, 'users', uid, 'profiles', profileId, 'tasks', taskId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function approveTaskByGuardian(
  uid: string,
  profileId: string,
  taskId: string,
  guardianName: string,
  approved: boolean,
  status: TaskItem['status'],
  notes: string
): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}/tasks/${taskId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'profiles', profileId, 'tasks', taskId), {
      guardianApproved: approved,
      guardianApprovedBy: trunc(guardianName, 120),
      status,
      notes: trunc(notes, 1000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTaskItem(uid: string, profileId: string, taskId: string): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}/tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'profiles', profileId, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Rewards & Achievements ---
export async function addReward(
  uid: string,
  profileId: string,
  input: { title: string; description: string; category: string; costPoints: number }
): Promise<void> {
  const id = makeSafeId('rew');
  const path = `users/${uid}/profiles/${profileId}/rewards/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'profiles', profileId, 'rewards', id), {
      ownerId: uid,
      profileId,
      title: trunc(input.title.trim(), 140),
      description: trunc(input.description, 400),
      category: trunc(input.category, 60),
      costPoints: Math.min(100000, Math.max(1, Math.round(input.costPoints))),
      redeemed: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function redeemReward(
  uid: string,
  profile: MonitoredProfile,
  reward: Reward
): Promise<void> {
  if (profile.totalPoints < reward.costPoints) {
    throw new Error('النقاط الحالية غير كافية لاستبدال هذه المكافأة.');
  }
  const path = `users/${uid}/profiles/${profile.id}/rewards/${reward.id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'profiles', profile.id, 'rewards', reward.id), {
      redeemed: true,
      redeemedAt: new Date().toISOString(),
    });
    await syncProfileStats(uid, profile.id, {
      activeStreak: profile.activeStreak,
      totalPoints: profile.totalPoints - reward.costPoints,
      totalStars: profile.totalStars,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function evaluateAndSyncProfileRewards(
  uid: string,
  profile: MonitoredProfile,
  assessments: DailyAssessment[],
  observations: BehaviorObservation[],
  sessions: StudySession[],
  prayerRecords: PrayerRecord[],
  tasks: TaskItem[],
  achievements: Achievement[],
  rewards: Reward[] = []
): Promise<void> {
  const today = getTodayDateKey();
  const existingKeys = new Set(achievements.map((a) => a.badgeKey));

  const todayAssessment = assessments.find((a) => a.dateKey === today);
  const todayPrayer = prayerRecords.find((p) => p.dateKey === today);
  const todayTasks = tasks.filter((t) => t.dateKey === today);
  const highFocusSessions = sessions.filter((s) => s.status === 'completed' && s.focusLevel >= 4);
  const streak = calculateStreak(assessments);

  let earnedPointsBonus = 0;
  const awardBadge = async (badgeKey: string) => {
    if (existingKeys.has(badgeKey)) return;
    const def = BADGE_CATALOG.find((b) => b.key === badgeKey);
    if (!def) return;
    const achId = makeSafeId('ach');
    const path = `users/${uid}/profiles/${profile.id}/achievements/${achId}`;
    try {
      await setDoc(doc(db, 'users', uid, 'profiles', profile.id, 'achievements', achId), {
        ownerId: uid,
        profileId: profile.id,
        badgeKey: def.key,
        title: def.titleAr,
        description: def.descriptionAr,
        pointsBonus: def.pointsBonus,
        earnedAt: serverTimestamp(),
      });
      earnedPointsBonus += def.pointsBonus;
      existingKeys.add(badgeKey);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  if (todayAssessment?.scores.total !== null && (todayAssessment?.scores.total ?? 0) >= 8.5) {
    await awardBadge('commitment_hero');
  }
  if (highFocusSessions.length >= 3) {
    await awardBadge('study_star');
  }
  if (
    todayPrayer &&
    Object.values(todayPrayer.prayers).every((p) => p.status === 'on_time' || p.status === 'late')
  ) {
    await awardBadge('prayer_guardian');
  }
  if (
    todayTasks.length > 0 &&
    todayTasks.every((t) => t.status === 'completed' && t.guardianApproved)
  ) {
    await awardBadge('responsibility_owner');
  }
  if (streak >= 7) {
    await awardBadge('distinguished_week');
  }

  const obsPoints = observations.reduce((s, o) => s + o.pointsAwarded, 0);
  const studyPoints = sessions.filter((s) => s.status === 'completed').length * 15;
  const prayerPoints = prayerRecords.reduce((acc, rec) => {
    return (
      acc +
      Object.values(rec.prayers).filter((p) => p.status === 'on_time').length * 8 +
      Object.values(rec.prayers).filter((p) => p.status === 'late').length * 4
    );
  }, 0);
  const taskPoints = tasks.filter((t) => t.status === 'completed').length * 12;
  const badgePoints = achievements.reduce((s, a) => s + a.pointsBonus, 0) + earnedPointsBonus;
  const computedEarned = obsPoints + studyPoints + prayerPoints + taskPoints + badgePoints;
  const redeemedCost = rewards.filter((r) => r.redeemed).reduce((s, r) => s + r.costPoints, 0);
  const netPoints = Math.max(0, computedEarned - redeemedCost);
  const stars = Math.floor(computedEarned / 25);

  if (computedEarned >= 1000) {
    await awardBadge('month_achievement');
  }

  if (streak !== profile.activeStreak || stars !== profile.totalStars || netPoints !== profile.totalPoints) {
    await syncProfileStats(uid, profile.id, {
      activeStreak: streak,
      totalPoints: netPoints,
      totalStars: stars,
    });
  }
}

// --- AI Insights ---
export async function saveAIInsight(
  uid: string,
  profileId: string,
  input: Omit<AIInsight, 'id' | 'ownerId' | 'profileId' | 'createdAt'>
): Promise<string> {
  const id = makeSafeId('ai');
  const path = `users/${uid}/profiles/${profileId}/aiInsights/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'profiles', profileId, 'aiInsights', id), {
      ownerId: uid,
      profileId,
      dateKey: input.dateKey,
      period: input.period,
      summary: trunc(input.summary, 2000),
      strongestAxis: trunc(input.strongestAxis, 120),
      improvementAxis: trunc(input.improvementAxis, 120),
      recurringPatterns: trunc(input.recurringPatterns, 1000),
      studyConsistency: trunc(input.studyConsistency, 1000),
      responsibilityFollowup: trunc(input.responsibilityFollowup, 1000),
      prayerSummary: trunc(input.prayerSummary, 1000),
      performanceDelta: trunc(input.performanceDelta, 1000),
      recommendations: input.recommendations.slice(0, 10).map((r) => trunc(r, 400)),
      status: 'pending_review',
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function reviewAIInsight(
  uid: string,
  profileId: string,
  insightId: string,
  status: 'approved' | 'rejected',
  approvedBy: string
): Promise<void> {
  const path = `users/${uid}/profiles/${profileId}/aiInsights/${insightId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'profiles', profileId, 'aiInsights', insightId), {
      status,
      approvedBy: trunc(approvedBy, 120),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Reports ---
export async function saveBehaviorReport(
  uid: string,
  profileId: string,
  input: Omit<BehaviorReport, 'id' | 'ownerId' | 'profileId' | 'createdAt'>
): Promise<string> {
  const id = makeSafeId('rep');
  const path = `users/${uid}/profiles/${profileId}/reports/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'profiles', profileId, 'reports', id), {
      ownerId: uid,
      profileId,
      reportType: input.reportType,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      averageScore: clampScore(input.averageScore),
      axisAverages: input.axisAverages,
      highlights: trunc(input.highlights, 2000),
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// --- Audit Logs ---
export async function writeAuditLog(
  uid: string,
  profileId: string,
  entry: Omit<AuditLog, 'id' | 'ownerId' | 'profileId' | 'createdAt'>
): Promise<void> {
  const id = makeSafeId('log');
  const path = `users/${uid}/profiles/${profileId}/auditLogs/${id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'profiles', profileId, 'auditLogs', id), {
      ownerId: uid,
      profileId,
      action: trunc(entry.action, 80),
      entityType: trunc(entry.entityType, 80),
      entityId: trunc(entry.entityId, 128),
      actorName: trunc(entry.actorName, 120),
      reason: trunc(entry.reason, 500),
      details: trunc(entry.details, 1000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// --- Backup Export ---
export async function exportProfileBackup(uid: string, profileId: string): Promise<string> {
  const subcollections = [
    'behaviorCategories',
    'dailyAssessments',
    'observations',
    'studySessions',
    'prayerRecords',
    'responsibilities',
    'tasks',
    'rewards',
    'achievements',
    'aiInsights',
    'reports',
  ];

  const profileSnap = await getDoc(doc(db, 'users', uid, 'profiles', profileId));
  const backup: Record<string, unknown> = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    profile: profileSnap.exists() ? profileSnap.data() : null,
    collections: {} as Record<string, unknown[]>,
  };

  const cols: Record<string, unknown[]> = {};
  for (const name of subcollections) {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'profiles', profileId, name), where('ownerId', '==', uid))
    );
    cols[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  backup.collections = cols;
  return JSON.stringify(backup, null, 2);
}

export async function restoreProfileBackup(
  uid: string,
  profileId: string,
  rawJson: string
): Promise<number> {
  let parsed: { collections?: Record<string, Array<Record<string, unknown>>> };
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('ملف النسخة الاحتياطية غير صالح (JSON غير سليم).');
  }
  if (!parsed || typeof parsed.collections !== 'object' || !parsed.collections) {
    throw new Error('بنية النسخة الاحتياطية غير مكتملة.');
  }

  let restoredCount = 0;
  const cols = parsed.collections;

  if (Array.isArray(cols.responsibilities)) {
    for (const r of cols.responsibilities.slice(0, 50)) {
      if (typeof r.title !== 'string') continue;
      await addResponsibility(uid, profileId, {
        title: r.title,
        description: typeof r.description === 'string' ? r.description : '',
        dueTime: typeof r.dueTime === 'string' ? r.dueTime : '18:00',
        priority: r.priority === 'high' || r.priority === 'low' ? r.priority : 'medium',
        recurrence: r.recurrence === 'weekly' || r.recurrence === 'monthly' ? r.recurrence : 'daily',
        requiresProof: Boolean(r.requiresProof),
        active: r.active !== false,
      });
      restoredCount += 1;
    }
  }

  if (Array.isArray(cols.observations)) {
    for (const o of cols.observations.slice(0, 100)) {
      if (typeof o.situation !== 'string' || typeof o.dateKey !== 'string') continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(o.dateKey)) continue;
      await addObservation(uid, profileId, {
        dateKey: o.dateKey,
        situation: o.situation,
        guidanceGiven: typeof o.guidanceGiven === 'string' ? o.guidanceGiven : 'توجيه',
        reaction: typeof o.reaction === 'string' ? o.reaction : 'استجابة',
        outcome: o.outcome === 'partial' || o.outcome === 'needs_support' ? o.outcome : 'positive',
        firstTimeResponse: Boolean(o.firstTimeResponse),
        neededReminder: Boolean(o.neededReminder),
        criterionKey: typeof o.criterionKey === 'string' ? o.criterionKey : '',
        isPoliteQuestion: Boolean(o.isPoliteQuestion),
        pointsAwarded: typeof o.pointsAwarded === 'number' ? o.pointsAwarded : 10,
        notes: typeof o.notes === 'string' ? o.notes : '',
      });
      restoredCount += 1;
    }
  }

  if (Array.isArray(cols.studySessions)) {
    for (const s of cols.studySessions.slice(0, 100)) {
      if (typeof s.subject !== 'string' || typeof s.dateKey !== 'string') continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.dateKey)) continue;
      await addStudySession(uid, profileId, {
        dateKey: s.dateKey,
        subject: s.subject,
        goalDescription: typeof s.goalDescription === 'string' ? s.goalDescription : s.subject,
        targetMinutes: typeof s.targetMinutes === 'number' ? s.targetMinutes : 30,
        startTime: typeof s.startTime === 'string' ? s.startTime : '16:00',
        endTime: typeof s.endTime === 'string' ? s.endTime : '16:30',
        actualMinutes: typeof s.actualMinutes === 'number' ? s.actualMinutes : 30,
        activityType:
          s.activityType === 'homework' || s.activityType === 'exercises' || s.activityType === 'reading'
            ? s.activityType
            : 'review',
        focusLevel: typeof s.focusLevel === 'number' ? s.focusLevel : 4,
        qualityRating: typeof s.qualityRating === 'number' ? s.qualityRating : 4,
        status:
          s.status === 'partial' || s.status === 'incomplete' || s.status === 'postponed'
            ? s.status
            : 'completed',
        postponeReason: typeof s.postponeReason === 'string' ? s.postponeReason : '',
        notes: typeof s.notes === 'string' ? s.notes : '',
      });
      restoredCount += 1;
    }
  }

  return restoredCount;
}
