import { useMemo } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Info,
  Siren,
  Users,
} from 'lucide-react';
import type { Classe, Enfant, Paiement, Personnel, Presence } from '../types';
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
  classes: ReadonlyArray<Classe & { childrenIds?: string[] }>;
  loading?: boolean;
  enabled?: boolean;
  onNavigate?: (page: string) => void;
}

const COMMAND_CENTER_ENABLED = true;

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function alertTone(level: CommandCenterAlertLevel) {
  if (level === 'urgent') {
    return {
      container: 'border-rose-100 bg-rose-50/70',
      icon: 'bg-rose-100 text-rose-600',
      title: 'text-rose-950',
      text: 'text-rose-800/80',
      button: 'text-rose-700 hover:bg-rose-100',
      label: 'Urgent',
    };
  }

  if (level === 'check') {
    return {
      container: 'border-amber-100 bg-amber-50/70',
      icon: 'bg-amber-100 text-amber-700',
      title: 'text-amber-950',
      text: 'text-amber-900/75',
      button: 'text-amber-800 hover:bg-amber-100',
      label: 'À vérifier',
    };
  }

  return {
    container: 'border-sky-100 bg-sky-50/70',
    icon: 'bg-sky-100 text-sky-700',
    title: 'text-sky-950',
    text: 'text-sky-900/75',
    button: 'text-sky-800 hover:bg-sky-100',
    label: 'Info',
  };
}

function AlertIcon({ level }: { level: CommandCenterAlertLevel }) {
  if (level === 'urgent') return <Siren className="h-4 w-4" aria-hidden="true" />;
  if (level === 'check') return <ClipboardCheck className="h-4 w-4" aria-hidden="true" />;
  return <Info className="h-4 w-4" aria-hidden="true" />;
}

function CommandCenterSkeleton() {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs sm:p-5" aria-label="Chargement du Command Center">
      <div className="animate-pulse space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="h-3 w-52 rounded bg-slate-100" />
          </div>
          <div className="h-8 w-20 rounded-xl bg-slate-100" />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[1, 2, 3].map(item => <div key={item} className="h-20 rounded-xl bg-slate-100" />)}
        </div>
        <div className="h-16 rounded-xl bg-slate-100" />
      </div>
    </section>
  );
}

function AlertRow({ alert, onNavigate }: { alert: CommandCenterAlert; onNavigate?: (page: string) => void }) {
  const tone = alertTone(alert.level);

  return (
    <div className={`flex min-w-0 items-start gap-3 rounded-xl border p-3 ${tone.container}`}>
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}>
        <AlertIcon level={alert.level} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`text-xs font-black ${tone.title}`}>{alert.title}</h3>
          <span className={`rounded-full bg-white/70 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${tone.text}`}>
            {tone.label}
          </span>
        </div>
        <p className={`mt-1 text-[11px] font-semibold leading-relaxed ${tone.text}`}>{alert.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onNavigate?.(alert.targetPage)}
        className={`mt-0.5 flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black transition active:scale-[0.97] ${tone.button}`}
        aria-label={`Ouvrir ${alert.title}`}
      >
        <span className="hidden sm:inline">Ouvrir</span>
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function CommandCenter({
  enfants,
  presences,
  paiements,
  personnel,
  classes,
  loading = false,
  enabled = COMMAND_CENTER_ENABLED,
  onNavigate,
}: CommandCenterProps) {
  const now = new Date();

  const todaySummary = useMemo(() => {
    const activeChildren = enfants.filter(enfant => enfant.statut === 'Actif');
    const activeIds = new Set(activeChildren.map(enfant => enfant.id));
    const today = localDateKey(now);
    const statusByChild = new Map<string, Presence['statut']>();

    presences.forEach(presence => {
      if (presence.date === today && activeIds.has(presence.enfantId)) {
        statusByChild.set(presence.enfantId, presence.statut);
      }
    });

    const presents = activeChildren.filter(enfant => statusByChild.get(enfant.id) === 'Présent').length;
    const absents = activeChildren.filter(enfant => {
      const status = statusByChild.get(enfant.id);
      return status === 'Absent justifié' || status === 'Absent non justifié';
    }).length;
    const attendanceRate = activeChildren.length > 0 ? Math.round((presents / activeChildren.length) * 100) : 0;

    return {
      expected: activeChildren.length,
      presents,
      absents,
      attendanceRate,
    };
  }, [enfants, presences, now]);

  const alerts = useMemo(() => buildCommandCenterAlerts({
    enfants,
    presences,
    paiements,
    personnel,
    classes,
    now,
    maxAlerts: 6,
  }), [enfants, presences, paiements, personnel, classes, now]);

  const urgentCount = alerts.filter(alert => alert.level === 'urgent').length;
  const checkCount = alerts.filter(alert => alert.level === 'check').length;

  if (!enabled) return null;
  if (loading) return <CommandCenterSkeleton />;

  return (
    <section className="min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-xs sm:p-5" aria-labelledby="command-center-title">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <CircleAlert className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="command-center-title" className="text-sm font-black tracking-tight text-slate-900">Rawdha Command Center</h2>
              <p className="text-[10px] font-bold text-slate-400">La vue courte qui aide à décider maintenant.</p>
            </div>
          </div>
        </div>
        <div className="flex w-fit items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-1.5 text-[10px] font-black text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Aujourd'hui
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl bg-emerald-50/80 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Présents</span>
            <Users className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="mt-1 text-xl font-black text-emerald-900">{todaySummary.presents}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Absents</span>
          <p className="mt-1 text-xl font-black text-slate-800">{todaySummary.absents}</p>
        </div>
        <div className="rounded-xl bg-indigo-50/80 p-3">
          <span className="text-[10px] font-black uppercase tracking-wide text-indigo-600">Attendus</span>
          <p className="mt-1 text-xl font-black text-indigo-900">{todaySummary.expected}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400">
        <span className="rounded-full bg-slate-50 px-2 py-1">Taux de présence : <strong className="text-slate-700">{todaySummary.attendanceRate}%</strong></span>
        {urgentCount > 0 && <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-700">{urgentCount} urgent{urgentCount > 1 ? 's' : ''}</span>}
        {checkCount > 0 && <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{checkCount} à vérifier</span>}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Radar Rawdha</h3>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-400">Les priorités détectées dans vos données du jour.</p>
          </div>
          {alerts.length > 0 && <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">{alerts.length} signal{alerts.length > 1 ? 'aux' : ''}</span>}
        </div>

        {alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.map(alert => (
              <div key={alert.id}>
                <AlertRow alert={alert} onNavigate={onNavigate} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-black text-emerald-900">Tout va bien aujourd'hui</p>
              <p className="mt-0.5 text-[11px] font-semibold text-emerald-800/75">Aucune priorité ne demande votre attention immédiate.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
