import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';

type LaunchPage = 'parametres' | 'classes' | 'enfants' | 'personnel' | 'presences';

interface DirectorLaunchPanelProps {
  onNavigate?: (page: LaunchPage) => void;
}

export default function DirectorLaunchPanel({ onNavigate }: DirectorLaunchPanelProps) {
  const { user, creche } = useAuth();
  const { enfants = [], classes = [], personnel = [], presences = [] } = useDb();
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const completionStorageKey = user?.id ? `rawdha:director-launch-complete:${user.id}` : null;
  const [dismissed, setDismissed] = useState(() =>
    Boolean(
      completionStorageKey &&
        typeof window !== 'undefined' &&
        window.localStorage.getItem(completionStorageKey) === '1',
    ),
  );

  const isProfileReady = Boolean(
    user?.nom?.trim() &&
      user?.prenom?.trim() &&
      (user?.nomCreche?.trim() || (creche?.nom && creche.nom !== 'RAWDHA+')),
  );
  const visibleEnfants = enfants.filter(item => item.crecheId === user?.id);
  const visibleClasses = classes.filter(item => item.crecheId === user?.id);
  const visiblePersonnel = personnel.filter(item => item.crecheId === user?.id);
  const visiblePresences = presences.filter(item => visibleEnfants.some(enfant => enfant.id === item.enfantId));

  const steps = [
    {
      key: 'profile',
      label: isArabic ? 'معلومات الحضانة' : 'Informations de la crèche',
      done: isProfileReady,
      page: 'parametres' as const,
    },
    {
      key: 'class',
      label: isArabic ? 'إنشاء أول قسم' : 'Créer une classe',
      done: visibleClasses.length > 0,
      page: 'classes' as const,
    },
    {
      key: 'child',
      label: isArabic ? 'إضافة أول طفل' : 'Ajouter un enfant',
      done: visibleEnfants.length > 0,
      page: 'enfants' as const,
    },
    {
      key: 'staff',
      label: isArabic ? 'إضافة عضو للفريق' : 'Ajouter l’équipe',
      done: visiblePersonnel.length > 0,
      page: 'personnel' as const,
    },
    {
      key: 'presence',
      label: isArabic ? 'تسجيل أول حضور' : 'Premier appel',
      done: visiblePresences.length > 0,
      page: 'presences' as const,
    },
  ];

  const completed = steps.filter(step => step.done).length;
  const progress = Math.round((completed / steps.length) * 100);

  useEffect(() => {
    if (progress === 100 && completionStorageKey && typeof window !== 'undefined') {
      window.localStorage.setItem(completionStorageKey, '1');
    }
  }, [completionStorageKey, progress]);

  if (!user || user.role !== 'directeur' || progress === 100 || dismissed) return null;

  const dismiss = () => {
    if (completionStorageKey && typeof window !== 'undefined') {
      window.localStorage.setItem(completionStorageKey, '1');
    }
    setDismissed(true);
  };

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">
            {isArabic ? 'إعداد الحضانة' : 'Premiers pas'}
            <span className="ms-2 text-xs font-medium text-slate-500">
              ({completed}/{steps.length})
            </span>
          </h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={isArabic ? 'إخفاء' : 'Masquer'}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {steps.map(step => (
          <button
            key={step.key}
            type="button"
            onClick={() => onNavigate?.(step.page)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              step.done
                ? 'border-emerald-200/70 bg-emerald-50/50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700'
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
            <span>{step.label}</span>
            {!step.done && <ArrowRight className="h-3 w-3 shrink-0 text-slate-400 rtl:rotate-180" />}
          </button>
        ))}
      </div>
    </section>
  );
}
