import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  HeartHandshake,
  School,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { UserAccount } from '../types';

interface WelcomeDirectorModalProps {
  user: UserAccount;
  language: 'fr' | 'ar';
  onLanguageChange: (language: 'fr' | 'ar') => void;
  onDone: () => void;
}

export default function WelcomeDirectorModal({
  user,
  language,
  onLanguageChange,
  onDone,
}: WelcomeDirectorModalProps) {
  const isArabic = language === 'ar';
  const firstName = user.prenom || (isArabic ? 'مديرتنا' : 'Directeur');

  const content = isArabic
    ? {
        eyebrow: 'مرحباً بك في Rawdha+',
        title: `أهلاً ${firstName}، سعيدون بانضمامك إلينا`,
        subtitle: 'منصتك الذكية لإدارة الحضانة بسهولة، أمان واحترافية.',
        trial: 'تجربة مجانية لمدة 7 أيام',
        trialText: 'استفد من جميع مزايا Rawdha+ خلال فترة التجربة، بدون التزام.',
        benefitsTitle: 'كل ما تحتاجه حضانتك في مكان واحد',
        benefits: [
          ['إدارة الأطفال', 'ملفات الأطفال، معلومات الأولياء والوثائق في متناول يدك.', Users],
          ['الحضور والمتابعة', 'تسجيل الحضور والغياب ومتابعة يوم الحضانة بسرعة.', CalendarDays],
          ['الدفع والفواتير', 'تنظيم الرسوم، المدفوعات والفواتير بطريقة واضحة.', BarChart3],
          ['فريق متصل', 'تواصل أفضل مع الفريق والأولياء مع حماية بياناتك.', ShieldCheck],
        ] as const,
        stepsTitle: 'كيف تبدأ؟',
        steps: [
          ['01', 'أكمل إعداد الحضانة', 'أضف اسم الحضانة، العنوان، الهاتف والتعريفة.'],
          ['02', 'أضف بياناتك', 'أنشئ ملفات الأطفال والموظفين والأقسام.'],
          ['03', 'أدر يومك بسهولة', 'تابع الحضور، المدفوعات والتقارير من لوحة واحدة.'],
        ],
        support: 'نحن معك',
        supportText: 'إذا احتجت المساعدة، يمكنك التواصل مع فريق Rawdha+ مباشرة من داخل المنصة.',
        cta: 'ابدأ الآن',
        later: 'يمكنك مراجعة هذه المعلومات لاحقاً من إعدادات حسابك.',
      }
    : {
        eyebrow: 'Bienvenue sur Rawdha+',
        title: `Bonjour ${firstName}, bienvenue dans votre nouvelle plateforme`,
        subtitle: 'La solution simple, moderne et sécurisée pour piloter votre crèche au quotidien.',
        trial: '7 jours d’essai gratuit',
        trialText: 'Profitez de toutes les fonctionnalités de Rawdha+ pendant votre période d’essai, sans engagement.',
        benefitsTitle: 'Tout ce dont votre crèche a besoin, au même endroit',
        benefits: [
          ['Gestion des enfants', 'Dossiers enfants, informations des parents et documents toujours accessibles.', Users],
          ['Présences & suivi', 'Enregistrez les présences et suivez chaque journée en quelques clics.', CalendarDays],
          ['Paiements & factures', 'Organisez les tarifs, paiements et factures avec une vision claire.', BarChart3],
          ['Une équipe connectée', 'Travaillez mieux avec votre équipe et protégez vos données.', ShieldCheck],
        ] as const,
        stepsTitle: 'Comment commencer ?',
        steps: [
          ['01', 'Configurez votre crèche', 'Ajoutez le nom, l’adresse, le téléphone et le tarif mensuel.'],
          ['02', 'Ajoutez vos données', 'Créez les fiches des enfants, du personnel et des classes.'],
          ['03', 'Gérez votre quotidien', 'Suivez les présences, paiements et rapports depuis un seul espace.'],
        ],
        support: 'Nous sommes à vos côtés',
        supportText: 'Besoin d’aide ? Contactez directement l’équipe Rawdha+ depuis la plateforme.',
        cta: 'Commencer maintenant',
        later: 'Vous pourrez retrouver ces informations plus tard dans les paramètres de votre compte.',
      };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
        dir={isArabic ? 'rtl' : 'ltr'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-director-title"
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="relative w-full max-w-4xl max-h-[94vh] overflow-y-auto rounded-[2rem] bg-white shadow-2xl shadow-indigo-950/30"
        >
          <button
            type="button"
            onClick={onDone}
            aria-label={isArabic ? 'إغلاق' : 'Fermer'}
            className="absolute top-4 ltr:right-4 rtl:left-4 z-10 w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-violet-600 to-fuchsia-600 px-6 py-8 sm:px-10 sm:py-10 text-white">
            <div className="absolute -top-20 ltr:-right-10 rtl:-left-10 w-56 h-56 rounded-full bg-white/10" />
            <div className="absolute -bottom-28 ltr:left-1/3 rtl:right-1/3 w-72 h-72 rounded-full bg-fuchsia-300/10" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold tracking-wide backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  {content.eyebrow}
                </div>
                <h1 id="welcome-director-title" className="mt-5 text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                  {content.title}
                </h1>
                <p className="mt-3 max-w-xl text-sm sm:text-base leading-relaxed text-indigo-100">
                  {content.subtitle}
                </p>
              </div>
              <div className="flex items-center gap-2 self-start rounded-xl bg-white/15 p-1 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => onLanguageChange('fr')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black transition cursor-pointer ${language === 'fr' ? 'bg-white text-indigo-700 shadow-sm' : 'text-white/75 hover:text-white'}`}
                >
                  FR
                </button>
                <button
                  type="button"
                  onClick={() => onLanguageChange('ar')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black transition cursor-pointer ${language === 'ar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-white/75 hover:text-white'}`}
                >
                  عربي
                </button>
              </div>
            </div>

            <div className="relative mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-white/20 bg-white/12 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-300 text-amber-900 shadow-lg shadow-amber-950/10">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-black">{content.trial}</p>
                  <p className="mt-0.5 text-xs text-indigo-100">{content.trialText}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                {isArabic ? 'بدون التزام' : 'Sans engagement'}
              </div>
            </div>
          </div>

          <div className="space-y-8 p-5 sm:p-8">
            <section>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <School className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-black text-slate-900">{content.benefitsTitle}</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {content.benefits.map(([title, description, Icon]) => (
                  <div key={title} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-indigo-100 hover:bg-indigo-50/40">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900">{title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-slate-950 p-5 sm:p-6 text-white">
              <h2 className="text-lg font-black">{content.stepsTitle}</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-3">
                {content.steps.map(([number, title, description], index) => (
                  <div key={number} className="relative">
                    {index < content.steps.length - 1 && <div className="absolute top-5 hidden h-px w-full bg-white/15 md:block ltr:left-[calc(50%+28px)] rtl:right-[calc(50%+28px)]" />}
                    <div className="relative flex items-start gap-3 md:block">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-sm font-black shadow-lg shadow-indigo-950/30">{number}</div>
                      <div className="mt-0 md:mt-3">
                        <h3 className="text-sm font-black">{title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-300">{description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-black text-emerald-900">{content.support}</p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-800/80">{content.supportText}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onDone}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 cursor-pointer"
              >
                {content.cta}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </button>
            </div>
            <p className="text-center text-[11px] text-slate-400">{content.later}</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
