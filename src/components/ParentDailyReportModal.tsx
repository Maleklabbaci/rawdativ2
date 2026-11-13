import React, { useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { publishParentAnnouncement } from '../utils/parentPortal';
import {
  BookHeart,
  Check,
  Clock,
  Copy,
  MessageCircle,
  Moon,
  Palette,
  Printer,
  Smile,
  Utensils,
  X,
} from 'lucide-react';
import type { Activite, Enfant, Presence, Repas } from '../types';

function normalizePhoneForWa(raw?: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  let normalized = digits;
  if (normalized.startsWith('00213')) normalized = normalized.slice(2);
  else if (normalized.startsWith('0') && normalized.length === 10) normalized = `213${normalized.slice(1)}`;
  else if (normalized.length === 9 && /^[567]/.test(normalized)) normalized = `213${normalized}`;
  return /^213[567]\d{8}$/.test(normalized) ? normalized : null;
}

const WEEKDAY_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

interface ParentDailyReportModalProps {
  enfant: Enfant;
  date: string;
  presence?: Presence | null;
  repasList?: Repas[];
  activitesList?: Activite[];
  creche?: { nom?: string } | null;
  isArabic: boolean;
  onClose: () => void;
}

export default function ParentDailyReportModal({
  enfant,
  date,
  presence,
  repasList = [],
  activitesList = [],
  creche,
  isArabic,
  onClose,
}: ParentDailyReportModalProps) {
  const [siesteInput, setSiesteInput] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteStatus, setNoteStatus] = useState('');
  const sentNote = useRef('');
  const noteInFlight = useRef(false);
  const sendNote = async () => {
    const note = customNote.trim();
    if (!note || noteInFlight.current || note === sentNote.current || !user || user.role !== 'directeur' || user.approvalStatus !== 'approved' || enfant.crecheId !== user.id) return;
    noteInFlight.current = true; sentNote.current = note; setNoteBusy(true); setNoteStatus('');
    try {
      const result = await publishParentAnnouncement({ crecheId: user.id, crecheNom: creche?.nom || user.nomCreche || 'Crèche', title: isArabic ? 'ملاحظة من الروضة' : 'Un mot de la crèche', message: note, pushMessage: isArabic ? 'ملاحظة جديدة متاحة في فضاء الأولياء.' : 'Une nouvelle remarque est disponible dans votre espace parent.', category: 'info', targetScope: 'child', targetEnfantId: enfant.id, enfants: [enfant] });
      setNoteStatus(result.pushStatus === 'confirmed' && result.sentPushCount > 0 ? (isArabic ? 'تم حفظ الملاحظة وقبلت خدمة الإشعارات إرسالها.' : 'Remarque enregistrée, envoi accepté par le service de notifications.') : (isArabic ? 'تم حفظ الملاحظة، لكن تسليم الإشعار غير مؤكد.' : 'Remarque enregistrée dans l’espace parent ; réception de la notification non confirmée.'));
    } catch { setNoteStatus(isArabic ? 'النتيجة غير مؤكدة. تحققي من الرسائل قبل إعادة المحاولة.' : 'Résultat non confirmé. Vérifiez les messages avant de réessayer pour éviter un doublon.'); }
    finally { noteInFlight.current = false; setNoteBusy(false); }
  };


  const formattedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(isArabic ? 'ar-DZ' : 'fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(`${date}T12:00:00`));
    } catch {
      return date;
    }
  }, [date, isArabic]);

  const dayMeals = useMemo(() => {
    const dt = new Date(`${date}T12:00:00`);
    const dayNameFr = Number.isNaN(dt.getTime()) ? '' : WEEKDAY_FR[dt.getDay()];
    return repasList.filter(
      r =>
        r.date === date ||
        (dayNameFr && r.jour && r.jour.toLowerCase() === dayNameFr.toLowerCase())
    );
  }, [date, repasList]);

  const dayActivities = useMemo(() => {
    return activitesList
      .filter(act => (!act.date || act.date === date) && (!act.groupe || act.groupe === enfant.groupeAge))
      .slice(0, 3);
  }, [activitesList, date, enfant.groupeAge]);

  const parentWaPhone = useMemo(() => {
    for (const parent of enfant.parents || []) {
      const normalized = normalizePhoneForWa(parent.telephone);
      if (normalized) return normalized;
    }
    return null;
  }, [enfant.parents]);

  const translateAppetite = (val?: string) => {
    if (!val) return isArabic ? 'غير مسجل' : 'Non renseigné';
    if (!isArabic) return val;
    const map: Record<string, string> = {
      Tout: 'أكل الوجبة كاملة',
      Moitié: 'أكل نصف الوجبة',
      Peu: 'أكل القليل',
      Rien: 'لم يأكل',
      Bien: 'شهية جيدة',
    };
    return map[val] || val;
  };

  const translateMood = (val?: string) => {
    if (!val) return isArabic ? 'غير مسجل' : 'Non renseignée';
    if (!isArabic) return val;
    const map: Record<string, string> = {
      Joyeux: 'مبتهج وسعيد',
      Calme: 'هادئ',
      Fatigué: 'متعب قليلاً',
      Grognon: 'متضايق قليلاً',
    };
    return map[val] || val;
  };

  const mealMenuLine = useMemo(
    () => dayMeals.map(m => m.menu).filter(Boolean).join(' · '),
    [dayMeals]
  );

  const fullTextSummary = useMemo(() => {
    const childName = `${enfant.prenom} ${enfant.nom}`;
    const crecheName = creche?.nom || 'Rawdha+';
    const activitiesLine = dayActivities.map(a => a.titre).filter(Boolean).join(', ');

    if (isArabic) {
      const lines = [
        `دفتر المتابعة اليومي — ${crecheName}`,
        `الطفل(ة): ${childName} | ${formattedDate}`,
        `• الحضور: ${
          presence?.statut === 'Présent'
            ? `حاضر (${presence.heureArrivee || '—'}${presence.heureDepart ? ` إلى ${presence.heureDepart}` : ''})`
            : presence?.statut || 'لم يُسجَّل بعد'
        }`,
      ];
      if (presence?.temperature) lines.push(`• الحرارة عند الاستقبال: ${presence.temperature}°C`);
      if (presence?.humeur) lines.push(`• المزاج اليوم: ${translateMood(presence.humeur)}`);
      if (presence?.repas || mealMenuLine) {
        lines.push(
          `• الوجبة والشهية: ${translateAppetite(presence?.repas)}${mealMenuLine ? ` (${mealMenuLine})` : ''}`
        );
      }
      if (siesteInput.trim()) lines.push(`• القيلولة: ${siesteInput.trim()}`);
      if (activitiesLine) lines.push(`• أنشطة اليوم: ${activitiesLine}`);
      if (customNote.trim()) lines.push(`• ملاحظة المربية: ${customNote.trim()}`);
      lines.push('مساء سعيد للأسرة الكريمة.');
      return lines.join('\n');
    }

    const lines = [
      `Carnet de liaison du jour — ${crecheName}`,
      `Enfant : ${childName} | ${formattedDate}`,
      `• Présence : ${
        presence?.statut === 'Présent'
          ? `Présent(e) (${presence.heureArrivee || '—'}${presence.heureDepart ? ` → ${presence.heureDepart}` : ''})`
          : presence?.statut || 'Non pointé'
      }`,
    ];
    if (presence?.temperature) lines.push(`• Température à l’accueil : ${presence.temperature}°C`);
    if (presence?.humeur) lines.push(`• Humeur : ${presence.humeur}`);
    if (presence?.repas || mealMenuLine) {
      lines.push(
        `• Repas : ${presence?.repas || 'Servi'}${mealMenuLine ? ` (${mealMenuLine})` : ''}`
      );
    }
    if (siesteInput.trim()) lines.push(`• Sieste : ${siesteInput.trim()}`);
    if (activitiesLine) lines.push(`• Activités : ${activitiesLine}`);
    if (customNote.trim()) lines.push(`• Mot de l’équipe : ${customNote.trim()}`);
    lines.push('Belle fin de journée à toute la famille.');
    return lines.join('\n');
  }, [creche?.nom, customNote, dayActivities, enfant.nom, enfant.prenom, formattedDate, isArabic, mealMenuLine, presence, siesteInput]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullTextSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const waHref = parentWaPhone
    ? `https://wa.me/${parentWaPhone}?text=${encodeURIComponent(fullTextSummary)}`
    : null;

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-slate-950/65 p-3 sm:items-center sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="my-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
      >
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <BookHeart className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 sm:text-lg">
                {isArabic ? 'دفتر المتابعة اليومي للأولياء' : 'Carnet de liaison du jour'}
              </h2>
              <p className="text-xs text-slate-500">
                {enfant.prenom} {enfant.nom} · {formattedDate}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isArabic ? 'إغلاق' : 'Fermer'}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Grille synthétique de la journée */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 font-bold text-slate-500">
              <Clock className="h-3.5 w-3.5 text-indigo-500" />
              <span>{isArabic ? 'الأوقات' : 'Horaires'}</span>
            </p>
            <p className="mt-1 font-extrabold text-slate-900">
              {presence?.statut === 'Présent'
                ? `${presence.heureArrivee || '—'} → ${presence.heureDepart || (isArabic ? 'في الروضة' : 'En crèche')}`
                : presence?.statut || (isArabic ? 'لم يُسجَّل' : 'Non pointé')}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 font-bold text-slate-500">
              <Smile className="h-3.5 w-3.5 text-amber-500" />
              <span>{isArabic ? 'المزاج والحرارة' : 'Humeur & accueil'}</span>
            </p>
            <p className="mt-1 font-extrabold text-slate-900">
              {translateMood(presence?.humeur)}
              {presence?.temperature ? ` · ${presence.temperature}°C` : ''}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 font-bold text-slate-500">
              <Utensils className="h-3.5 w-3.5 text-emerald-600" />
              <span>{isArabic ? 'الوجبة' : 'Repas pris'}</span>
            </p>
            <p className="mt-1 font-extrabold text-slate-900">{translateAppetite(presence?.repas)}</p>
            {mealMenuLine && (
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{mealMenuLine}</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 font-bold text-slate-500">
              <Moon className="h-3.5 w-3.5 text-violet-600" />
              <span>{isArabic ? 'القيلولة' : 'Sieste'}</span>
            </p>
            <input
              type="text"
              value={siesteInput}
              onChange={e => setSiesteInput(e.target.value)}
              placeholder={isArabic ? 'مثال: 1 سا 15 د' : 'Ex. : 1h15 calme'}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {dayActivities.length > 0 && (
          <div className="mt-2.5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs">
            <p className="flex items-center gap-1.5 font-bold text-indigo-800">
              <Palette className="h-3.5 w-3.5" />
              <span>{isArabic ? 'أنشطة القسم اليوم' : 'Activités du jour'}</span>
            </p>
            <p className="mt-1 font-semibold text-slate-800">
              {dayActivities.map(a => a.titre).join(' · ')}
            </p>
          </div>
        )}

        {/* Mot personnalisé de l'équipe */}
        <div className="mt-3.5">
          <label className="mb-1 block text-xs font-bold text-slate-700">
            {isArabic ? 'كلمة المربية للأولياء' : 'Mot de l’équipe pour les parents'}
          </label>
          <textarea
            rows={2}
            maxLength={600}
            value={customNote}
            onChange={e => setCustomNote(e.target.value)}
            placeholder={
              isArabic
                ? 'مثال: قضى يوماً رائعاً وشارك في ورشة التلوين...'
                : 'Ex. : Très belle journée, a beaucoup aimé l’atelier peinture...'
            }
            className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500"
          />
          {user?.role === 'directeur' && user.approvalStatus === 'approved' && enfant.crecheId === user.id && <button type="button" disabled={noteBusy || !customNote.trim() || customNote.trim() === sentNote.current} onClick={() => void sendNote()} className="mt-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{noteBusy ? (isArabic ? 'جاري الحفظ…' : 'Enregistrement…') : (isArabic ? 'حفظ وإرسال للأولياء' : 'Enregistrer et prévenir les parents')}</button>}
          {noteStatus && <p role="status" className="mt-2 text-xs font-semibold text-slate-600">{noteStatus}</p>}
        </div>

        {/* Actions directes */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? (isArabic ? 'تم النسخ' : 'Copié') : isArabic ? 'نسخ الملخص' : 'Copier'}</span>
            </button>

            <button
              type="button"
              onClick={() => typeof window !== 'undefined' && typeof window.print === 'function' && window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{isArabic ? 'طباعة' : 'Imprimer'}</span>
            </button>
          </div>

          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" />
              <span>{isArabic ? 'إرسال عبر واتساب' : 'Envoyer sur WhatsApp'}</span>
            </a>
          ) : (
            <span className="text-[11px] font-medium text-slate-400">
              {isArabic ? 'لا يوجد رقم واتساب مسجل للولي' : 'Pas de n° WhatsApp parent'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
