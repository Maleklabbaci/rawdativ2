import { ArrowRight, CheckCircle2, Circle, HelpCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';

type LaunchPage = 'parametres' | 'classes' | 'enfants' | 'personnel' | 'presences';

interface DirectorLaunchPanelProps {
  onNavigate?: (page: LaunchPage) => void;
}

export default function DirectorLaunchPanel({ onNavigate }: DirectorLaunchPanelProps) {
  const { user, creche } = useAuth();
  const { enfants, classes, personnel, presences } = useDb();
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  if (!user || user.role !== 'directeur') return null;

  const isProfileReady = Boolean(
    user.nom?.trim() &&
    user.prenom?.trim() &&
    (user.nomCreche?.trim() || (creche.nom && creche.nom !== 'RAWDHA+')),
  );
  const visibleEnfants = enfants.filter((item) => item.crecheId === user.id);
  const visibleClasses = classes.filter((item) => item.crecheId === user.id);
  const visiblePersonnel = personnel.filter((item) => item.crecheId === user.id);
  const visiblePresences = presences.filter((item) => visibleEnfants.some((enfant) => enfant.id === item.enfantId));

  const steps = [
    {
      key: 'profile',
      label: isArabic ? 'أكمل معلومات الحضانة' : 'Compléter les informations de la crèche',
      detail: isArabic ? 'الاسم، العنوان والهاتف' : 'Nom, adresse et téléphone',
      done: isProfileReady,
      page: 'parametres' as const,
    },
    {
      key: 'class',
      label: isArabic ? 'إنشاء أول قسم' : 'Créer votre première classe',
      detail: isArabic ? 'نظم الأطفال حسب الفئة العمرية' : 'Organisez les enfants par section',
      done: visibleClasses.length > 0,
      page: 'classes' as const,
    },
    {
      key: 'child',
      label: isArabic ? 'إضافة أول طفل' : 'Ajouter votre premier enfant',
      detail: isArabic ? 'يدوياً أو عبر ملف CSV' : 'Manuellement ou avec un fichier CSV',
      done: visibleEnfants.length > 0,
      page: 'enfants' as const,
    },
    {
      key: 'staff',
      label: isArabic ? 'إضافة عضو للفريق' : 'Ajouter un membre du personnel',
      detail: isArabic ? 'شارك مهام التسيير' : 'Partagez les tâches de gestion',
      done: visiblePersonnel.length > 0,
      page: 'personnel' as const,
    },
    {
      key: 'presence',
      label: isArabic ? 'تسجيل أول حضور' : 'Enregistrer une première présence',
      detail: isArabic ? 'ابدأ المتابعة اليومية' : 'Commencez le suivi quotidien',
      done: visiblePresences.length > 0,
      page: 'presences' as const,
    },
  ];
  const completed = steps.filter((step) => step.done).length;
  const progress = Math.round((completed / steps.length) * 100);

  return (
    <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-800 p-4 text-white shadow-xl shadow-indigo-900/10 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-2xl bg-white/10 p-3"><Sparkles className="h-5 w-5 text-indigo-200" /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">RAWDHA+ • {isArabic ? 'بداية سريعة' : 'Démarrage rapide'}</p>
            <h2 className="mt-1 text-lg font-black sm:text-xl">{isArabic ? 'جهز فضاء حضانتك' : 'Préparez votre espace directeur'}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-indigo-100/80">{isArabic ? 'أكمل هذه الخطوات وابدأ العمل بدون تعقيد.' : 'Suivez ces étapes pour commencer à travailler sans vous perdre dans les menus.'}</p>
          </div>
        </div>
        <div className="min-w-[150px] rounded-2xl bg-white/10 p-3">
          <div className="flex items-center justify-between text-xs font-black"><span>{isArabic ? 'التقدم' : 'Progression'}</span><span>{progress}%</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-emerald-300 transition-all" style={{ width: `${progress}%` }} /></div>
          <p className="mt-2 text-[10px] font-bold text-indigo-100/75">{completed}/{steps.length} {isArabic ? 'مراحل مكتملة' : 'étapes terminées'}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-2 lg:grid-cols-5">
        {steps.map((step) => (
          <button
            key={step.key}
            type="button"
            onClick={() => onNavigate?.(step.page)}
            className="group rounded-2xl border border-white/10 bg-white/10 p-3 text-left transition hover:bg-white/15 disabled:cursor-default"
          >
            <div className="flex items-start justify-between gap-2">
              {step.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" /> : <Circle className="h-5 w-5 shrink-0 text-indigo-200" />}
              {!step.done && <ArrowRight className="h-4 w-4 text-indigo-200 transition group-hover:translate-x-1" />}
            </div>
            <p className="mt-3 text-xs font-black leading-4">{step.label}</p>
            <p className="mt-1 text-[10px] font-semibold leading-4 text-indigo-100/70">{step.detail}</p>
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] font-bold text-indigo-100/80">
        <HelpCircle className="h-4 w-4 shrink-0 text-indigo-200" />
        <span>{isArabic ? 'تحتاج مساعدة؟ استخدم زر الدعم العائم أسفل الشاشة للتواصل مباشرة.' : 'Besoin d’aide ? Utilisez le bouton de support flottant en bas de l’écran pour nous écrire directement.'}</span>
      </div>
    </section>
  );
}
