import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Languages, Sparkles } from 'lucide-react';

interface LanguageChoiceModalProps {
  onChoose: (language: 'fr' | 'ar') => void;
}

export default function LanguageChoiceModal({ onChoose }: LanguageChoiceModalProps) {
  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-md sm:items-center sm:p-4" dir="ltr" role="dialog" aria-modal="true" aria-labelledby="language-choice-title">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] bg-white shadow-2xl shadow-indigo-950/40 sm:rounded-[2rem]"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-violet-600 to-fuchsia-600 px-4 py-6 text-center text-white sm:px-10 sm:py-10">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" />
          <div className="absolute -bottom-32 -left-10 h-64 w-64 rounded-full bg-fuchsia-300/10" />
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur-sm">
            <Languages className="h-8 w-8" />
          </div>
          <div className="relative mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            RAWDHA+
          </div>
          <h1 id="language-choice-title" className="relative mt-4 text-xl font-black tracking-tight sm:text-3xl">
            Choisissez la langue de votre plateforme
          </h1>
          <p className="relative mx-auto mt-3 max-w-lg text-sm leading-relaxed text-indigo-100">
            اختر لغة المنصة التي تفضلها. يمكنك تغييرها لاحقاً في أي وقت من الإعدادات.
          </p>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:gap-4 sm:p-8">
          <button
            type="button"
            onClick={() => onChoose('fr')}
            className="group rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-left transition hover:border-indigo-500 hover:bg-indigo-50/50 hover:shadow-lg hover:shadow-indigo-100 cursor-pointer sm:p-6"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-2xl">🇫🇷</span>
              <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-600" />
            </div>
            <h2 className="mt-5 text-xl font-black text-slate-900">Français</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">Utiliser Rawdha+ en français</p>
          </button>

          <button
            type="button"
            onClick={() => onChoose('ar')}
            dir="rtl"
            className="group rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-right transition hover:border-violet-500 hover:bg-violet-50/50 hover:shadow-lg hover:shadow-violet-100 cursor-pointer sm:p-6"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-2xl">🇩🇿</span>
              <ArrowLeft className="h-5 w-5 text-slate-300 transition group-hover:-translate-x-1 group-hover:text-violet-600" />
            </div>
            <h2 className="mt-5 text-xl font-black text-slate-900">العربية</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">استعمل روضتي باللغة العربية</p>
          </button>
        </div>

        <p className="px-6 pb-6 text-center text-[11px] font-medium text-slate-400 sm:px-8 sm:pb-8">
          Votre choix sera mémorisé pour vos prochaines connexions · سيتم حفظ اختيارك للمرات القادمة
        </p>
      </motion.div>
    </div>
  );
}
