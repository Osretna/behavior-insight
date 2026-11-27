import type { AIAnalysisOutput } from './apiClient';
import {
  AXIS_META,
  PRAYERS_META,
  type AxisKey,
  type BehaviorObservation,
  type DailyAssessment,
  type PrayerRecord,
  type StudySession,
  type TaskItem,
} from '../types/behavior';
import { getOffsetDateKey, getTodayDateKey } from './scoring';

export interface LocalAnalysisInput {
  profileName: string;
  profileAge?: number;
  period: 'daily' | 'weekly' | 'monthly';
  dateKey: string;
  assessments: DailyAssessment[];
  observations: BehaviorObservation[];
  studySessions: StudySession[];
  prayerRecords: PrayerRecord[];
  tasks: TaskItem[];
}

function trunc(text: string, maxLen: number): string {
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

export function generateLocalBehaviorAnalysis(input: LocalAnalysisInput): AIAnalysisOutput {
  const todayKey = input.dateKey || getTodayDateKey();
  const days = input.period === 'daily' ? 1 : input.period === 'weekly' ? 7 : 30;
  const minDate = getOffsetDateKey(-(days - 1), todayKey);
  const periodLabelAr =
    input.period === 'daily' ? 'اليوم' : input.period === 'weekly' ? 'آخر 7 أيام' : 'آخر 30 يوماً';

  const periodAssessments = input.assessments
    .filter((a) => a.dateKey >= minDate && a.dateKey <= todayKey)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const periodObs = input.observations.filter((o) => o.dateKey >= minDate && o.dateKey <= todayKey);
  const periodStudy = input.studySessions.filter((s) => s.dateKey >= minDate && s.dateKey <= todayKey);
  const periodPrayers = input.prayerRecords.filter((p) => p.dateKey >= minDate && p.dateKey <= todayKey);
  const periodTasks = input.tasks.filter((t) => t.dateKey >= minDate && t.dateKey <= todayKey);

  const totalEntriesCount =
    periodObs.length +
    periodStudy.length +
    periodPrayers.reduce(
      (acc, pr) => acc + Object.values(pr.prayers).filter((p) => p.status !== 'unlogged').length,
      0
    ) +
    periodTasks.length;

  // Compute average score per axis from recorded assessments
  const axisKeys: AxisKey[] = ['obedience', 'study', 'prayer', 'responsibilities'];
  const axisAverages: { key: AxisKey; title: string; avg: number; count: number }[] = [];

  for (const key of axisKeys) {
    const vals = periodAssessments
      .map((a) => a.scores[key])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (vals.length > 0) {
      const avg = round1(vals.reduce((s, n) => s + n, 0) / vals.length);
      axisAverages.push({
        key,
        title: AXIS_META[key].titleAr,
        avg,
        count: vals.length,
      });
    }
  }

  const totalScores = periodAssessments
    .map((a) => a.scores.total)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const overallAvg =
    totalScores.length > 0 ? round1(totalScores.reduce((s, n) => s + n, 0) / totalScores.length) : null;

  if (totalEntriesCount === 0 && totalScores.length === 0) {
    return {
      summary: `البيانات الفعلية غير مسجلة بعد لـ ${input.profileName} خلال ${periodLabelAr} (${minDate} إلى ${todayKey}). ابدأ بتسجيل المواقف السلوكية أو جلسات المذاكرة أو الصلوات أو المهام اليومية ليتم التحليل تلقائياً.`,
      strongestAxis: 'لا توجد سجلات مقيمة بعد',
      improvementAxis: 'بانتظار تسجيل أول بيانات',
      recurringPatterns: 'لم يتم رصد أنماط متكررة لعدم وجود سجلات مدخلة في هذه الفترة.',
      studyConsistency: 'لا توجد جلسات مذاكرة مسجلة في هذه الفترة.',
      responsibilityFollowup: 'لا توجد مهام أو مسؤوليات مسجلة في هذه الفترة.',
      prayerSummary: 'لم يتم تسجيل بيانات الصلوات في هذه الفترة بعد.',
      performanceDelta: 'لا تتوفر أيام مقارنة كافية في السجل حتى الآن.',
      recommendations: [
        `ابدأ بتسجيل موقف إيجابي أو تذكيري واحد لـ ${input.profileName} في محور سماع الكلام.`,
        'أضف جلسة مذاكرة قصيرة لمدة 20–30 دقيقة لقياس مستوى التركيز الفعلي.',
        'فعّل متابعة المهام اليومية المعتادة واعتمادها في نهاية اليوم.',
      ],
    };
  }

  // Strongest & improvement axes
  const sortedAxes = [...axisAverages].sort((a, b) => b.avg - a.avg);
  const strongest = sortedAxes[0];
  const weakest = sortedAxes.length > 1 ? sortedAxes[sortedAxes.length - 1] : sortedAxes[0];
  const missingAxes = axisKeys
    .filter((k) => !axisAverages.some((a) => a.key === k))
    .map((k) => AXIS_META[k].titleAr);

  const strongestAxis = strongest
    ? trunc(`${strongest.title} (متوسط ${strongest.avg}/10 خلال ${strongest.count} يوم)`, 118)
    : 'بيانات المحاور غير مكتملة';

  let improvementAxis = 'المحافظة على التوازن الحالي';
  if (missingAxes.length > 0 && sortedAxes.length < 4) {
    improvementAxis = trunc(`تسجيل بيانات محور: ${missingAxes[0]}`, 118);
  } else if (weakest && strongest && weakest.key !== strongest.key) {
    improvementAxis = trunc(`${weakest.title} (متوسط ${weakest.avg}/10)`, 118);
  } else if (weakest && weakest.avg < 8) {
    improvementAxis = trunc(`${weakest.title} (متوسط ${weakest.avg}/10)`, 118);
  }

  // Obedience patterns
  const posObs = periodObs.filter((o) => o.outcome === 'positive').length;
  const partialObs = periodObs.filter((o) => o.outcome === 'partial').length;
  const supportObs = periodObs.filter((o) => o.outcome === 'needs_support').length;
  const firstTimeCount = periodObs.filter((o) => o.firstTimeResponse).length;
  const reminderCount = periodObs.filter((o) => o.neededReminder).length;
  const politeCount = periodObs.filter((o) => o.isPoliteQuestion).length;

  let recurringPatterns = '';
  if (periodObs.length === 0) {
    recurringPatterns = 'سجلات محور سماع الكلام غير مسجلة في هذه الفترة.';
  } else {
    const parts: string[] = [
      `تم تسجيل ${periodObs.length} موقفاً (${posObs} استجابة إيجابية، ${partialObs} جزئية، ${supportObs} تحتاج دعماً).`,
    ];
    if (firstTimeCount > 0) parts.push(`الاستجابة من المرة الأولى: ${firstTimeCount} مرة.`);
    if (reminderCount > 0) parts.push(`الحاجة لتذكير: ${reminderCount} مرة.`);
    if (politeCount > 0) parts.push(`النقاش أو الاستفسار بأدب: ${politeCount} مرة.`);
    recurringPatterns = parts.join(' ');
  }

  // Study consistency
  let studyConsistency = '';
  const completedStudy = periodStudy.filter((s) => s.status === 'completed');
  const postponedStudy = periodStudy.filter((s) => s.status === 'postponed' || s.status === 'incomplete');
  if (periodStudy.length === 0) {
    studyConsistency = 'لم تُسجَّل جلسات مذاكرة في هذه الفترة.';
  } else {
    const totalActualMins = periodStudy.reduce((sum, s) => sum + (s.actualMinutes || 0), 0);
    const avgFocus = round1(
      periodStudy.reduce((sum, s) => sum + (s.focusLevel || 3), 0) / periodStudy.length
    );
    const avgQuality = round1(
      periodStudy.reduce((sum, s) => sum + (s.qualityRating || 3), 0) / periodStudy.length
    );
    const subjects = Array.from(new Set(periodStudy.map((s) => s.subject).filter(Boolean))).slice(0, 4);
    studyConsistency = `${periodStudy.length} جلسات (${completedStudy.length} مكتملة، ${postponedStudy.length} مؤجلة/غير مكتملة) بإجمالي ${totalActualMins} دقيقة، متوسط التركيز ${avgFocus}/5 وجودة الإنجاز ${avgQuality}/5${
      subjects.length ? ` في مواد: ${subjects.join('، ')}` : ''
    }.`;
  }

  // Responsibilities & tasks
  let responsibilityFollowup = '';
  const completedTasks = periodTasks.filter((t) => t.status === 'completed').length;
  const approvedTasks = periodTasks.filter((t) => t.guardianApproved).length;
  const pendingOrMissedTasks = periodTasks.filter(
    (t) => t.status === 'pending' || t.status === 'missed'
  ).length;
  if (periodTasks.length === 0) {
    responsibilityFollowup = 'لم تُسجَّل مهام يومية في هذه الفترة.';
  } else {
    const rate = Math.round((completedTasks / periodTasks.length) * 100);
    responsibilityFollowup = `تم إنجاز ${completedTasks} من أصل ${periodTasks.length} مهمة بنسبة ${rate}% (معتمد من ولي الأمر: ${approvedTasks}، متبقٍ/فائت: ${pendingOrMissedTasks}).`;
  }

  // Prayer summary (respectful, gentle, factual)
  let prayerSummary = '';
  let onTimeCount = 0;
  let lateCount = 0;
  let missedCount = 0;
  const lateOrMissedNames = new Map<string, number>();

  for (const rec of periodPrayers) {
    for (const meta of PRAYERS_META) {
      const st = rec.prayers[meta.key]?.status;
      if (st === 'on_time') onTimeCount += 1;
      else if (st === 'late') {
        lateCount += 1;
        lateOrMissedNames.set(meta.nameAr, (lateOrMissedNames.get(meta.nameAr) || 0) + 1);
      } else if (st === 'missed') {
        missedCount += 1;
        lateOrMissedNames.set(meta.nameAr, (lateOrMissedNames.get(meta.nameAr) || 0) + 1);
      }
    }
  }
  const loggedPrayersTotal = onTimeCount + lateCount + missedCount;
  if (loggedPrayersTotal === 0) {
    prayerSummary = 'لم تُسجَّل صلوات في السجل اليومي خلال هذه الفترة.';
  } else {
    const topHint = Array.from(lateOrMissedNames.entries()).sort((a, b) => b[1] - a[1])[0];
    prayerSummary = `تم تسجيل ${loggedPrayersTotal} صلاة بلطف (${onTimeCount} في وقتها، ${lateCount} متأخرة، ${missedCount} لم تُؤدَّ بعد)${
      topHint ? `، وتستحق صلاة ${topHint[0]} تشجيعاً إضافياً` : ''
    }.`;
  }

  // Performance delta
  let performanceDelta = '';
  if (totalScores.length < 2) {
    performanceDelta =
      totalScores.length === 1
        ? `البيانات الفعلية ليوم واحد فقط بدرجة إجمالية ${totalScores[0]}/10.`
        : 'لا توجد درجات إجمالية كافية للمقارنة الزمنية.';
  } else {
    const latest = totalScores[totalScores.length - 1];
    const prevAvg = round1(
      totalScores.slice(0, -1).reduce((s, n) => s + n, 0) / (totalScores.length - 1)
    );
    const diff = round1(latest - prevAvg);
    if (diff >= 0.3) {
      performanceDelta = `تحسن ملحوظ بمقدار +${diff} درجة؛ أحدث تقييم (${latest}/10) أعلى من متوسط الأيام السابقة (${prevAvg}/10).`;
    } else if (diff <= -0.3) {
      performanceDelta = `انخفاض طفيف بمقدار ${diff} درجة؛ أحدث تقييم (${latest}/10) مقارنة بمتوسط الأيام السابقة (${prevAvg}/10).`;
    } else {
      performanceDelta = `أداء مستقر عند ${latest}/10 قريب جداً من متوسط الأيام السابقة (${prevAvg}/10).`;
    }
  }

  // Actionable educational recommendations
  const recommendations: string[] = [];
  if (reminderCount > firstTimeCount && periodObs.length > 0) {
    recommendations.push(
      'استخدم تذكيراً بصرياً أو عدّاً هادئاً لمرة واحدة مع تعزيز فوري عند الاستجابة من أول مرة.'
    );
  }
  if (periodStudy.length > 0) {
    const avgFocus =
      periodStudy.reduce((sum, s) => sum + (s.focusLevel || 3), 0) / periodStudy.length;
    if (avgFocus < 3.6 || postponedStudy.length > 0) {
      recommendations.push(
        'تقسيم المذاكرة إلى فترات قصيرة (20 دقيقة تركيز + 5 دقائق راحة) قبل وقت اللعب.'
      );
    }
  }
  if (pendingOrMissedTasks > 0 && periodTasks.length > 0) {
    recommendations.push(
      'مراجعة قائمة المسؤوليات قبل النوم بربع ساعة واعتماد المهام المنجزة لتحفيز الالتزام.'
    );
  }
  if (lateCount + missedCount > 0) {
    recommendations.push(
      'ربط تنبيه الصلاة المدمج بوقت هادئ للوضوء والتشجيع اللفظي اللطيف بعد كل صلاة.'
    );
  }
  if (missingAxes.length > 0) {
    recommendations.push(
      `الاستمرار في تسجيل بيانات (${missingAxes.slice(0, 2).join(' و')}) لتكوين صورة يومية متكاملة.`
    );
  }
  if (recommendations.length < 2) {
    recommendations.push(
      `تقديم مكافأة معنوية أو نقطة إضافية لـ ${input.profileName} عند استمرار التقييم أعلى من 8/10 لثلاثة أيام متتالية.`
    );
    recommendations.push(
      'الاستفادة من بطاقة نقاط القوة الحالية لبناء ثقة إيجابية تدعم باقي المحاور اليومية.'
    );
  }

  const summary = trunc(
    `البيانات الفعلية المسجلة لـ ${input.profileName} خلال ${periodLabelAr} (${minDate} إلى ${todayKey}): ${
      overallAvg !== null ? `متوسط التقييم العام ${overallAvg}/10 عبر ${totalScores.length} يوم` : 'تقييم قيد التجميع'
    }، بإجمالي ${periodObs.length} موقف سلوكي، ${periodStudy.length} جلسة مذاكرة، ${loggedPrayersTotal} صلاة مسجلة، و${completedTasks}/${periodTasks.length} مهمة منجزة.`,
    1950
  );

  return {
    summary,
    strongestAxis,
    improvementAxis,
    recurringPatterns: trunc(recurringPatterns, 980),
    studyConsistency: trunc(studyConsistency, 980),
    responsibilityFollowup: trunc(responsibilityFollowup, 980),
    prayerSummary: trunc(prayerSummary, 980),
    performanceDelta: trunc(performanceDelta, 980),
    recommendations: recommendations.slice(0, 4).map((r) => trunc(r, 390)),
  };
}
