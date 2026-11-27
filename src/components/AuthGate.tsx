import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { BookOpen, CheckSquare, Compass, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { IslamicEmblem, IslamicGeometricHeaderBackdrop } from './IslamicDecor';

export function AuthGate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر إتمام تسجيل الدخول.';
      setError(msg.includes('popup-closed') ? 'تم إغلاق نافذة تسجيل الدخول قبل الإتمام.' : 'حدث خطأ أثناء تسجيل الدخول عبر Google. يرجى المحاولة مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen relative flex items-center justify-center p-4 sm:p-8 bg-[#071120] text-slate-100 overflow-hidden">
      <IslamicGeometricHeaderBackdrop />

      <div className="relative z-10 max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden border border-white/10 bg-[#0B172A]/90 backdrop-blur-xl shadow-2xl">
        {/* Right Column: Brand & Four Axes Overview */}
        <div className="lg:col-span-7 p-7 sm:p-10 flex flex-col justify-between gap-8 border-b lg:border-b-0 lg:border-l border-white/10">
          <div>
            <div className="flex items-center gap-3.5 mb-6">
              <IslamicEmblem size={46} />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  BEHAVIOR INSIGHT
                </h1>
                <p className="text-xs sm:text-sm text-emerald-300 font-medium">
                  نحو سلوك أفضل.. يوم بعد يوم
                </p>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-snug mb-3">
              نظام التقييم والمتابعة السلوكية والتربوية الذكي
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
              منصة أسرية وتربوية متكاملة لمتابعة الأداء اليومي بموضوعية، وحفظ السجلات سحابياً بأمان، وحساب التقييم من 1 إلى 10 مع تقارير دورية وتحليل ذكي منضبط.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center gap-2.5 text-teal-300 font-semibold text-sm mb-1">
                <Compass className="w-4 h-4 shrink-0" />
                <span>سماع الكلام والاستجابة</span>
              </div>
              <p className="text-xs text-slate-400">تسجيل المواقف اليومية واحترام حق الحوار بأدب</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center gap-2.5 text-sky-300 font-semibold text-sm mb-1">
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>المذاكرة والتعلم</span>
              </div>
              <p className="text-xs text-slate-400">مؤقت تركيز مدمج وتقييم جودة المذاكرة</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center gap-2.5 text-emerald-300 font-semibold text-sm mb-1">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>المحافظة على الصلاة</span>
              </div>
              <p className="text-xs text-slate-400">متابعة خاصة ومحترمة للصلوات الخمس ومواقيتها</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center gap-2.5 text-amber-300 font-semibold text-sm mb-1">
                <CheckSquare className="w-4 h-4 shrink-0" />
                <span>الواجبات والمسؤوليات</span>
              </div>
              <p className="text-xs text-slate-400">مهام يومية متجددة وإرفاق إثبات واعتماد ولي الأمر</p>
            </div>
          </div>
        </div>

        {/* Left Column: Secure Sign In */}
        <div className="lg:col-span-5 p-7 sm:p-10 flex flex-col justify-center bg-[#091324]/70">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center text-emerald-300 mb-5">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">تسجيل الدخول الآمن</h3>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            تُحفظ جميع البيانات في قاعدة بيانات Firebase مشفرة ومفصولة تماماً لكل حساب، مع دعم حماية رمز PIN لوضع ولي الأمر.
          </p>

          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs leading-relaxed">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-3 transition-colors shadow-lg shadow-emerald-950/50 cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#ffffff" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z" />
            </svg>
            <span>{loading ? 'جاري التحقق من الحساب...' : 'المتابعة باستخدام حساب Google'}</span>
          </button>

          <div className="mt-6 pt-5 border-t border-white/10 flex items-center gap-2 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>حماية كاملة لقواعد البيانات وعزل تام لخصوصية الأسرة</span>
          </div>
        </div>
      </div>
    </div>
  );
}
