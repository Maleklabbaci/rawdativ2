import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, FileCheck2, ShieldCheck } from 'lucide-react';
import type { Enfant, Personnel } from '../types';

interface DasCompliancePanelProps {
  enfants: Enfant[];
  personnel: Personnel[];
  isArabic: boolean;
  onNavigate?: (page: string) => void;
}

export default function DasCompliancePanel({
  enfants,
  personnel,
  isArabic,
  onNavigate,
}: DasCompliancePanelProps) {
  const [expanded, setExpanded] = useState(false);

  const audit = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const activeChildren = enfants.filter(e => e.statut === 'Actif');
    const activeStaff = personnel.filter(p => p.statut === 'Actif');

    const childAlerts: { id: string; name: string; missing: string[] }[] = [];
    for (const child of activeChildren) {
      const docs = child.documentsRequis || {
        certificatMedical: false,
        carnetVaccination: false,
        justificatifDomicile: false,
        photoIdentite: false,
      };
      const missing: string[] = [];
      if (!docs.certificatMedical) missing.push(isArabic ? 'شهادة طبية' : 'Certificat médical');
      if (!docs.carnetVaccination) missing.push(isArabic ? 'دفتر التلقيح' : 'Carnet de vaccination');
      if (!docs.justificatifDomicile) missing.push(isArabic ? 'إثبات الإقامة' : 'Justificatif domicile');
      if (!docs.photoIdentite) missing.push(isArabic ? 'صورة شمسية' : 'Photo d’identité');
      if ((child.parents?.length || 0) === 0 && (child.contactsUrgence?.length || 0) === 0) {
        missing.push(isArabic ? 'رقم طوارئ للولي' : 'Contact parent / urgence');
      }
      const rawChild = child as Enfant & { assuranceActive?: boolean; assuranceDateExpiration?: string };
      if (rawChild.assuranceDateExpiration && rawChild.assuranceDateExpiration < todayStr) {
        missing.push(isArabic ? 'تأمين منتهي الصلاحية' : 'Assurance expirée');
      }

      if (missing.length > 0) {
        childAlerts.push({
          id: child.id,
          name: `${child.prenom} ${child.nom}`,
          missing,
        });
      }
    }

    const staffAlerts: { id: string; name: string; poste: string }[] = [];
    for (const member of activeStaff) {
      if (!member.assuranceActive) {
        staffAlerts.push({
          id: member.id,
          name: `${member.prenom} ${member.nom}`,
          poste: member.poste,
        });
      }
    }

    const totalEntities = activeChildren.length + activeStaff.length;
    const compliantEntities =
      Math.max(0, activeChildren.length - childAlerts.length) +
      Math.max(0, activeStaff.length - staffAlerts.length);
    const readinessPct = totalEntities > 0 ? Math.round((compliantEntities / totalEntities) * 100) : 100;

    return {
      totalEntities,
      readinessPct,
      childAlerts,
      staffAlerts,
      totalAlerts: childAlerts.length + staffAlerts.length,
    };
  }, [enfants, isArabic, personnel]);

  if (audit.totalEntities === 0) return null;

  const isAllReady = audit.totalAlerts === 0;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start transition hover:bg-slate-50/70 cursor-pointer"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              isAllReady ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {isAllReady ? (
              <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
            ) : (
              <FileCheck2 className="h-4.5 w-4.5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-900">
                {isArabic ? 'الجاهزية لمراقبة مديرية النشاط الاجتماعي (DAS)' : 'Prête pour contrôle DAS'}
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                  isAllReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                }`}
              >
                {audit.readinessPct}%
              </span>
            </div>
            <p className="truncate text-xs text-slate-500">
              {isAllReady
                ? isArabic
                  ? 'جميع الملفات الطبية والتأمينات مكتملة للأطفال والفريق.'
                  : 'Tous les dossiers réglementaires et assurances sont complets.'
                : isArabic
                  ? `${audit.childAlerts.length} ملف طفل و ${audit.staffAlerts.length} ملف موظف بحاجة لاستكمال الوثائق`
                  : `${audit.childAlerts.length} dossier(s) enfant et ${audit.staffAlerts.length} membre(s) d’équipe à compléter`}
            </p>
          </div>
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-4">
          {isAllReady ? (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                {isArabic
                  ? 'لا توجد أي وثيقة ناقصة حالياً.'
                  : 'Aucune pièce manquante détectée dans les dossiers actifs.'}
              </span>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {audit.childAlerts.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      {isArabic ? 'ملفات الأطفال غير المكتملة' : 'Pièces enfants manquantes'} ({audit.childAlerts.length})
                    </span>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('enfants')}
                        className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        {isArabic ? 'فتح الملفات' : 'Ouvrir Enfants'}
                      </button>
                    )}
                  </div>
                  <div className="max-h-40 space-y-1.5 overflow-y-auto pe-1">
                    {audit.childAlerts.slice(0, 8).map(item => (
                      <div key={item.id} className="text-xs text-slate-700">
                        <strong className="font-bold text-slate-900">{item.name}</strong> :{' '}
                        <span className="text-slate-500">{item.missing.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {audit.staffAlerts.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      {isArabic ? 'تأمين الفريق / CNAS' : 'Assurance / CNAS équipe'} ({audit.staffAlerts.length})
                    </span>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('personnel')}
                        className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        {isArabic ? 'فتح الفريق' : 'Ouvrir Personnel'}
                      </button>
                    )}
                  </div>
                  <div className="max-h-40 space-y-1.5 overflow-y-auto pe-1">
                    {audit.staffAlerts.map(st => (
                      <div key={st.id} className="text-xs text-slate-700">
                        <strong className="font-bold text-slate-900">{st.name}</strong>{' '}
                        <span className="text-slate-500">({st.poste})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
