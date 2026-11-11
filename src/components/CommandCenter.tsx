import { useMemo } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Info } from 'lucide-react';
import { Classe, Enfant, Paiement, Personnel, Presence } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import {
  buildCommandCenterAlerts,
  type CommandCenterAlert,
  type CommandCenterAlertLevel,
} from '../utils/commandCenterRules';

export interface CommandCenterProps {
  enfants: ReadonlyArray<Enfant>;
  presences: ReadonlyArray<Presence>;
  paiements: ReadonlyArray<Paiement>;
  personnel: ReadonlyArray<Personnel>;
  classes: ReadonlyArray<Classe>;
  loading?: boolean;
  onNavigate?: (page: string) => void;
}

function alertStyle(level: CommandCenterAlertLevel) {
  if (level === 'urgent') {
    return {
      dot: 'bg-rose-500',
      icon: 'text-rose-600 bg-rose-50',
    };
  }
  if (level === 'check') {
    return {
      dot: 'bg-amber-500',
      icon: 'text-amber-600 bg-amber-50',
    };
  }
  return {
    dot: 'bg-indigo-500',
    icon: 'text-indigo-600 bg-indigo-50',
  };
}

export default function CommandCenter({
  enfants,
  presences,
  paiements,
  personnel,
  classes,
  loading = false,
  onNavigate,
}: CommandCenterProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const alerts = useMemo<CommandCenterAlert[]>(
    () =>
      buildCommandCenterAlerts({
        enfants,
        presences,
        paiements,
        personnel,
        classes,
        now: new Date(),
        locale: isArabic ? 'ar' : 'fr',
        maxAlerts: 4,
      }),
    [enfants, presences, paiements, personnel, classes, isArabic],
  );

  if (loading) {
    return <div className="h-16 rounded-2xl border border-slate-200/70 bg-white" />;
  }

  if (alerts.length === 0) {
    return (
      <section className="flex items-center gap-2.5 rounded-2xl border border-emerald-200/70 bg-emerald-50/50 px-4 py-3 text-xs font-semibold text-emerald-800">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        <span>
          {isArabic
            ? 'لا توجد تنبيهات مستعجلة حالياً — كل الملفات الأساسية محدّثة.'
            : 'Rien d’urgent à signaler — les dossiers et suivis du jour sont à jour.'}
        </span>
      </section>
    );
  }

  return (
    <section
      aria-label={isArabic ? 'ما يجب مراجعته اليوم' : 'À vérifier aujourd’hui'}
      className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {isArabic ? 'ما يجب مراجعته اليوم' : 'À vérifier'}
        </h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 tabular-nums">
          {alerts.length}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {alerts.map(alert => {
          const style = alertStyle(alert.level);
          return (
            <div
              key={alert.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${style.icon}`}>
                  {alert.level === 'info' ? (
                    <Info className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs sm:text-sm font-semibold text-slate-900">
                    {alert.title}
                  </p>
                  {alert.detail && (
                    <p className="hidden sm:block truncate text-xs text-slate-500 mt-0.5">
                      {alert.detail}
                    </p>
                  )}
                </div>
              </div>

              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate(alert.targetPage)}
                  className="min-h-8! whitespace-nowrap inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                >
                  <span>{alert.actionLabel}</span>
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
