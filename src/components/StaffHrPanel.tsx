import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock, Plus, Trash2, Wallet, XCircle } from 'lucide-react';
import { getCollectionDocument, setCollectionDocument, supabase } from '../supabase';
import type { Personnel } from '../types';
import { formatCurrency } from '../utils/format';

export type StaffAttendanceStatus = 'present' | 'retard' | 'absent';

export interface StaffAttendanceRecord {
  staffId: string;
  date: string;
  status: StaffAttendanceStatus;
  arrivalTime?: string;
}

export interface StaffSalaryAdvance {
  id: string;
  staffId: string;
  amount: number;
  date: string;
  note?: string;
}

interface StoredStaffHrDoc {
  version: number;
  baseSalaries: Record<string, number>;
  attendance: StaffAttendanceRecord[];
  advances: StaffSalaryAdvance[];
}

function localTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function StaffHrPanel({
  crecheId,
  personnel,
  isArabic,
}: {
  crecheId?: string;
  personnel: Personnel[];
  isArabic: boolean;
}) {
  const isDemo = Boolean(import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true');
  const docId = crecheId ? `rh_${crecheId}` : '';
  const storageKey = crecheId ? `rawdha_rh_${crecheId}` : '';

  const [doc, setDoc] = useState<StoredStaffHrDoc>({
    version: 1,
    baseSalaries: {},
    attendance: [],
    advances: [],
  });

  const [selectedDate, setSelectedDate] = useState<string>(localTodayStr);
  const selectedMonth = selectedDate.slice(0, 7);

  const [advStaffId, setAdvStaffId] = useState<string>('');
  const [advAmount, setAdvAmount] = useState<string>('');
  const [advNote, setAdvNote] = useState<string>('');
  const [editingSalaryStaffId, setEditingSalaryStaffId] = useState<string | null>(null);
  const [salaryDraft, setSalaryDraft] = useState<string>('');

  useEffect(() => {
    if (!crecheId) return;
    let cancelled = false;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredStaffHrDoc>;
        setDoc({
          version: 1,
          baseSalaries: parsed.baseSalaries || {},
          attendance: Array.isArray(parsed.attendance) ? parsed.attendance : [],
          advances: Array.isArray(parsed.advances) ? parsed.advances : [],
        });
      }
    } catch {
      // Ignore
    }

    if (isDemo || typeof (supabase as any)?.from !== 'function') return;

    (async () => {
      try {
        const remote = await getCollectionDocument<StoredStaffHrDoc>('parametres', docId);
        if (!cancelled && remote) {
          const normalized: StoredStaffHrDoc = {
            version: 1,
            baseSalaries: remote.baseSalaries || {},
            attendance: Array.isArray(remote.attendance) ? remote.attendance : [],
            advances: Array.isArray(remote.advances) ? remote.advances : [],
          };
          setDoc(normalized);
          try {
            localStorage.setItem(storageKey, JSON.stringify(normalized));
          } catch {
            // Ignore
          }
        }
      } catch {
        // Fallback local
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [crecheId, docId, isDemo, storageKey]);

  const persist = useCallback(
    async (next: StoredStaffHrDoc) => {
      setDoc(next);
      if (!crecheId) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Ignore
      }
      if (!isDemo && typeof (supabase as any)?.from === 'function') {
        await setCollectionDocument('parametres', docId, { id: docId, ...next });
      }
    },
    [crecheId, docId, isDemo, storageKey]
  );

  const activeStaff = useMemo(
    () => personnel.filter(p => p.statut === 'Actif'),
    [personnel]
  );

  const setStaffAttendance = async (staffId: string, status: StaffAttendanceStatus) => {
    const nowHHMM = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    const filtered = doc.attendance.filter(a => !(a.staffId === staffId && a.date === selectedDate));
    const next: StoredStaffHrDoc = {
      ...doc,
      attendance: [
        ...filtered,
        {
          staffId,
          date: selectedDate,
          status,
          arrivalTime: status !== 'absent' ? nowHHMM : undefined,
        },
      ],
    };
    await persist(next);
  };

  const handleSaveBaseSalary = async (staffId: string) => {
    const val = Math.max(0, Math.round(Number(salaryDraft) || 0));
    const next: StoredStaffHrDoc = {
      ...doc,
      baseSalaries: { ...doc.baseSalaries, [staffId]: val },
    };
    setEditingSalaryStaffId(null);
    await persist(next);
  };

  const handleAddAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = advStaffId || activeStaff[0]?.id;
    const numeric = Math.round(Number(advAmount));
    if (!targetId || !Number.isFinite(numeric) || numeric <= 0) return;

    const item: StaffSalaryAdvance = {
      id: `adv-${Date.now().toString(36)}`,
      staffId: targetId,
      amount: numeric,
      date: selectedDate,
      note: advNote.trim() || undefined,
    };
    const next: StoredStaffHrDoc = {
      ...doc,
      advances: [item, ...doc.advances],
    };
    setAdvAmount('');
    setAdvNote('');
    await persist(next);
  };

  const handleDeleteAdvance = async (advId: string) => {
    await persist({
      ...doc,
      advances: doc.advances.filter(a => a.id !== advId),
    });
  };

  const monthAdvances = useMemo(
    () => doc.advances.filter(a => a.date.startsWith(selectedMonth)),
    [doc.advances, selectedMonth]
  );

  return (
    <div className="space-y-5">
      {/* Sélecteur de date RH */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 sm:text-base">
            {isArabic ? 'حضور الفريق والتسبيقات على الأجر' : 'Pointage de l’équipe & avances sur salaire'}
          </h2>
          <p className="text-xs text-slate-500">
            {isArabic
              ? `متابعة الحضور ليوم ${selectedDate} وحساب التسبيقات لشهر ${selectedMonth}`
              : `Appel RH du ${selectedDate} et suivi mensuel des avances (${selectedMonth})`}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <Calendar className="h-4 w-4 text-slate-500" />
          <input
            type="date"
            aria-label={isArabic ? 'تاريخ حضور الفريق' : 'Date pointage équipe'}
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Tableau / Cartes par membre actif */}
      <div className="space-y-2.5">
        {activeStaff.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-xs text-slate-500">
            {isArabic ? 'لا يوجد موظفون نشطون مسجلون بعد.' : 'Aucun membre actif enregistré pour le moment.'}
          </div>
        ) : (
          activeStaff.map(member => {
            const dayRec = doc.attendance.find(a => a.staffId === member.id && a.date === selectedDate);
            const monthRecs = doc.attendance.filter(
              a => a.staffId === member.id && a.date.startsWith(selectedMonth)
            );
            const presentDays = monthRecs.filter(a => a.status === 'present').length;
            const lateDays = monthRecs.filter(a => a.status === 'retard').length;
            const absentDays = monthRecs.filter(a => a.status === 'absent').length;

            const baseSalary = doc.baseSalaries[member.id] || 0;
            const memberMonthAdvances = monthAdvances
              .filter(a => a.staffId === member.id)
              .reduce((sum, a) => sum + a.amount, 0);
            const netRemaining = Math.max(0, baseSalary - memberMonthAdvances);

            return (
              <div
                key={member.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs lg:flex-row lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold text-slate-900">
                      {member.prenom} {member.nom}
                    </p>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {member.poste}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    {isArabic
                      ? `هذا الشهر: ${presentDays} حضور · ${lateDays} تأخر · ${absentDays} غياب`
                      : `Ce mois : ${presentDays} j présent(e) · ${lateDays} retard(s) · ${absentDays} absence(s)`}
                  </p>
                </div>

                {/* Salaire & avances du mois */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {editingSalaryStaffId === member.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        value={salaryDraft}
                        onChange={e => setSalaryDraft(e.target.value)}
                        placeholder={isArabic ? 'الأجر الشهري' : 'Salaire mensuel'}
                        className="w-28 rounded-lg border border-indigo-300 px-2.5 py-1.5 text-xs font-bold text-slate-900 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveBaseSalary(member.id)}
                        className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white cursor-pointer"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSalaryStaffId(member.id);
                        setSalaryDraft(baseSalary ? String(baseSalary) : '');
                      }}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      {baseSalary > 0
                        ? isArabic
                          ? `الأجر: ${formatCurrency(baseSalary)} · تسبيقات: ${formatCurrency(memberMonthAdvances)} · الصافي: ${formatCurrency(netRemaining)}`
                          : `Salaire : ${formatCurrency(baseSalary)} · Avances : ${formatCurrency(memberMonthAdvances)} · Reste : ${formatCurrency(netRemaining)}`
                        : isArabic
                          ? `+ تحديد الأجر (تسبيقات: ${formatCurrency(memberMonthAdvances)})`
                          : `+ Définir salaire (Avances : ${formatCurrency(memberMonthAdvances)})`}
                    </button>
                  )}
                </div>

                {/* Boutons de pointage du jour */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void setStaffAttendance(member.id, 'present')}
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      dayRec?.status === 'present'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-emerald-50'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{isArabic ? 'حاضر' : 'Présent'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void setStaffAttendance(member.id, 'retard')}
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      dayRec?.status === 'retard'
                        ? 'border-amber-500 bg-amber-500 text-slate-950'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-amber-50'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>{isArabic ? 'تأخر' : 'Retard'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void setStaffAttendance(member.id, 'absent')}
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      dayRec?.status === 'absent'
                        ? 'border-rose-600 bg-rose-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-rose-50'
                    }`}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>{isArabic ? 'غائب' : 'Absent'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Saisie rapide d'une avance sur salaire */}
      {activeStaff.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              {isArabic ? 'تسجيل تسبيق على الأجر' : 'Enregistrer une avance sur salaire'}
            </h3>
          </div>

          <form onSubmit={handleAddAdvance} className="grid gap-2.5 sm:grid-cols-4">
            <select
              value={advStaffId || activeStaff[0]?.id || ''}
              onChange={e => setAdvStaffId(e.target.value)}
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
            >
              {activeStaff.map(m => (
                <option key={m.id} value={m.id}>
                  {m.prenom} {m.nom}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={1}
              value={advAmount}
              onChange={e => setAdvAmount(e.target.value)}
              placeholder={isArabic ? 'المبلغ (د.ج)' : 'Montant (DA)'}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500"
              required
            />

            <input
              type="text"
              value={advNote}
              onChange={e => setAdvNote(e.target.value)}
              placeholder={isArabic ? 'ملاحظة اختيارية' : 'Motif / note (facultatif)'}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
            />

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isArabic ? 'إضافة التسبيق' : 'Ajouter l’avance'}</span>
            </button>
          </form>

          {monthAdvances.length > 0 && (
            <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
              {monthAdvances.map(adv => {
                const staff = personnel.find(p => p.id === adv.staffId);
                return (
                  <div key={adv.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-900">
                        {staff ? `${staff.prenom} ${staff.nom}` : '—'}
                      </span>{' '}
                      <span className="font-black text-indigo-700 tabular-nums">
                        {formatCurrency(adv.amount)}
                      </span>{' '}
                      <span className="text-slate-500">
                        · {adv.date}
                        {adv.note ? ` (${adv.note})` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteAdvance(adv.id)}
                      aria-label={isArabic ? 'حذف التسبيق' : 'Supprimer l’avance'}
                      className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
