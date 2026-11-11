import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Copy, Download, ExternalLink, QrCode, ShieldCheck, UserRound, XCircle, Loader2, X } from 'lucide-react';
import * as QRCode from 'qrcode';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { DemandeAdmission } from '../types';
import DocumentScannerSlot from './DocumentScannerSlot';
import type { ChildDocumentKey } from '../utils/documentPdf';

export default function Admissions() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { inscriptionLinks, demandesAdmission, decideAdmission } = useDb();
  const [selected, setSelected] = useState<DemandeAdmission | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<{ demande: DemandeAdmission; statut: 'acceptee' | 'refusee' } | null>(null);
  const [decisionMotif, setDecisionMotif] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const permanentLink = useMemo(() => inscriptionLinks.find(link => link.active && link.token), [inscriptionLinks]);
  const linkUrl = permanentLink?.token ? `${window.location.origin}/admission?token=${encodeURIComponent(permanentLink.token)}` : '';
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let current = true;
    setQrDataUrl('');
    setQrError(false);
    setCopied(false);
    setCopyError(false);
    if (linkUrl) {
      QRCode.toDataURL(linkUrl, { width: 520, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#172554', light: '#ffffff' } })
        .then(url => { if (current) setQrDataUrl(url); })
        .catch(() => { if (current) setQrError(true); });
    }
    return () => { current = false; };
  }, [linkUrl]);

  const pending = demandesAdmission.filter(item => item.statut === 'en_attente');

  const copyLink = async () => {
    if (!linkUrl) return;
    setCopied(false);
    setCopyError(false);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopyError(true); }
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const anchor = document.createElement('a');
    anchor.href = qrDataUrl;
    anchor.download = 'rawdha-qr-permanent.png';
    anchor.click();
  };

  const decide = async (demande: DemandeAdmission, statut: 'acceptee' | 'refusee', motif = '') => {
    setBusyId(demande.id);
    try {
      await decideAdmission(demande.id, statut, motif);
      setSelected(null);
    } catch (error) {
      console.error('Erreur décision admission:', error);
      throw error;
    } finally {
      setBusyId(null);
    }
  };

  const requestDecision = (demande: DemandeAdmission, statut: 'acceptee' | 'refusee') => {
    setDecisionError('');
    setDecisionMotif('');
    setPendingDecision({ demande, statut });
  };

  const cancelDecision = () => {
    if (busyId) return;
    setPendingDecision(null);
    setDecisionMotif('');
    setDecisionError('');
  };

  const confirmDecision = async () => {
    if (!pendingDecision) return;
    setDecisionError('');
    try {
      await decide(pendingDecision.demande, pendingDecision.statut, decisionMotif.trim());
      setPendingDecision(null);
      setDecisionMotif('');
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : (isAr ? 'تعذر معالجة الطلب.' : 'Impossible de traiter la demande.'));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{isAr ? 'طلبات التسجيل ورمز QR' : 'Admissions & QR'}</h1>
          <p className="hidden sm:block mt-0.5 text-xs text-slate-500">{isAr ? 'شارك رمز الروضة الدائم مع الأولياء وراجع الطلبات الواردة.' : 'Partagez votre lien permanent aux parents et validez les demandes reçues.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">{pending.length} {isAr ? 'في الانتظار' : 'en attente'}</span>
          <span className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">{demandesAdmission.length} {isAr ? 'إجمالاً' : 'reçue(s)'}</span>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><QrCode className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">{isAr ? 'رمز QR الدائم لروضتك' : 'Votre QR permanent'}</h2>
            <p className="text-xs text-slate-500 truncate">{isAr ? 'يفتح استمارة التسجيل فقط دون أي وصول لبياناتك الداخلية.' : 'Ouvre uniquement le formulaire public d’inscription.'}</p>
          </div>
        </div>
        {permanentLink && linkUrl ? (
          <div className="mt-3.5 grid gap-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <p className="truncate rounded-lg border border-slate-200/80 bg-white px-2.5 py-2 text-xs font-medium text-slate-600">{linkUrl}</p>
              <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                <button type="button" onClick={copyLink} className="min-h-9! whitespace-nowrap inline-flex items-center justify-center gap-1 rounded-xl bg-indigo-600 px-2.5 sm:px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"><Copy className="h-3.5 w-3.5 shrink-0" /><span>{copied ? (isAr ? 'تم النسخ' : 'Copié') : (isAr ? 'نسخ' : 'Copier')}</span></button>
                <a href={linkUrl} target="_blank" rel="noreferrer" className="min-h-9! whitespace-nowrap inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink className="h-3.5 w-3.5 shrink-0" /><span>{isAr ? 'فتح' : 'Ouvrir'}</span></a>
                <button type="button" disabled={!qrDataUrl} onClick={downloadQr} aria-label={isAr ? 'تحميل QR' : 'Télécharger QR'} className="min-h-9! whitespace-nowrap inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"><Download className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{isAr ? 'تحميل' : 'QR PNG'}</span></button>
              </div>
              {copyError && <p role="alert" className="mt-2 text-xs font-bold text-rose-700">{isAr ? 'تعذر النسخ. انسخ الرابط المعروض يدوياً.' : 'Copie impossible. Copiez le lien affiché manuellement.'}</p>}
            </div>
            {qrDataUrl ? <img src={qrDataUrl} alt={isAr ? "رمز التسجيل" : "QR code admission permanent"} className="mx-auto h-32 w-32 rounded-xl border border-slate-200 bg-white p-2" /> : <p role="status" className="text-xs font-semibold text-slate-500">{qrError ? (isAr ? "تعذر عرض الرمز. حاول إعادة تحميل الصفحة." : "Impossible d’afficher le QR. Rechargez la page.") : (isAr ? "جارٍ إعداد الرمز…" : "Préparation du QR…")}</p>}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-600">{qrError ? (isAr ? 'تعذر عرض الرمز. حاول إعادة تحميل الصفحة.' : 'Impossible d’afficher le QR. Rechargez la page.') : import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true' ? (isAr ? 'رمز التسجيل غير متاح في النسخة التجريبية.' : 'Le QR d’inscription n’est pas disponible dans cet aperçu de démonstration.') : (isAr ? 'جاري تجهيز رمز الروضة الدائم...' : 'Le QR permanent est en cours de préparation automatiquement...')}</div>
        )}
      </section>

      <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-2xs"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-bold text-slate-900">{isAr ? 'طلبات التسجيل' : "Demandes reçues"}</h2><p className="hidden sm:block mt-0.5 text-xs text-slate-500">{isAr ? 'راجع الملفات الواردة قبل إضافة الطفل إلى قاعدة التسيير.' : 'Vérifiez chaque dossier avant de créer l’enfant dans votre gestion.'}</p></div><span className="shrink-0 whitespace-nowrap rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{pending.length} {isAr ? 'في الانتظار' : 'en attente'}</span></div><div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2">{demandesAdmission.length === 0 ? <div className="lg:col-span-2 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">{isAr ? 'لا توجد طلبات تسجيل حالياً.' : "Aucune demande d'admission pour le moment."}</div> : [...demandesAdmission].sort((a, b) => b.dateDemande.localeCompare(a.dateDemande)).map(demande => <AdmissionCard key={demande.id} demande={demande} isAr={isAr} selected={selected?.id === demande.id} busy={busyId === demande.id} onSelect={() => setSelected(selected?.id === demande.id ? null : demande)} onDecide={requestDecision} />)}</div></section>

      {pendingDecision && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="admission-decision-title">
        <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8" dir={isAr ? 'rtl' : 'ltr'}>
          <div className="flex items-start justify-between gap-4">
            <div><div className="flex items-center gap-2 text-indigo-700"><ShieldCheck className="h-5 w-5" /><p className="text-xs font-black uppercase tracking-wider">{isAr ? 'تأكيد القرار' : 'Confirmation de la décision'}</p></div><h2 id="admission-decision-title" className="mt-2 text-xl font-black text-slate-950">{pendingDecision.statut === 'acceptee' ? (isAr ? 'قبول وإضافة الطفل؟' : 'Accepter et ajouter cet enfant ?') : (isAr ? 'رفض طلب التسجيل؟' : 'Refuser cette demande ?')}</h2></div>
            <button type="button" onClick={cancelDecision} disabled={Boolean(busyId)} aria-label={isAr ? 'إغلاق' : 'Fermer'} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-sm font-black text-slate-900">{pendingDecision.demande.prenom} {pendingDecision.demande.nom}</p><p className="mt-1 text-xs text-slate-500">{pendingDecision.demande.parentPrenom} {pendingDecision.demande.parentNom} • {pendingDecision.demande.parentTelephone}</p></div>
          <p className="mt-4 text-sm leading-6 text-slate-600">{pendingDecision.statut === 'acceptee' ? (isAr ? 'سيتم إنشاء ملف طفل نشط وربطه بهذه الطلبية. لا يمكن التراجع عن الإنشاء تلقائياً.' : 'Cette confirmation créera un dossier enfant actif et le rattachera à cette demande. La création ne sera pas annulée automatiquement.') : (isAr ? 'سيتم وضع الطلب في حالة مرفوض ويمكن إضافة سبب اختياري.' : 'La demande passera au statut refusé. Vous pouvez ajouter un motif facultatif.')}</p>
          {pendingDecision.statut === 'refusee' && <textarea value={decisionMotif} onChange={event => setDecisionMotif(event.target.value)} maxLength={1000} rows={3} placeholder={isAr ? 'سبب الرفض (اختياري)' : 'Motif du refus (facultatif)'} className="mt-4 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-indigo-200 focus:ring-4" />}
          {decisionError && <p role="alert" className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{decisionError}</p>}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={cancelDecision} disabled={Boolean(busyId)} className="min-h-11 rounded-xl px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-100 disabled:opacity-50">{isAr ? 'إلغاء' : 'Annuler'}</button><button type="button" onClick={confirmDecision} disabled={Boolean(busyId)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-black text-white disabled:opacity-60 ${pendingDecision.statut === 'acceptee' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>{busyId ? <Loader2 className="h-4 w-4 animate-spin" /> : pendingDecision.statut === 'acceptee' ? (isAr ? 'تأكيد القبول والإضافة' : 'Confirmer l’acceptation') : (isAr ? 'تأكيد الرفض' : 'Confirmer le refus')}</button></div>
        </div>
      </div>}
    </div>
  );
}

function AdmissionCard({ demande, isAr, selected, busy, onSelect, onDecide }: { key?: string; demande: DemandeAdmission; isAr: boolean; selected: boolean; busy: boolean; onSelect: () => void; onDecide: (demande: DemandeAdmission, statut: 'acceptee' | 'refusee') => void }) {
  const statusClass = demande.statut === 'acceptee' ? 'bg-emerald-50 text-emerald-700' : demande.statut === 'refusee' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700';
  const statusLabel = demande.statut === 'acceptee' ? (isAr ? 'مقبول' : 'Acceptée') : demande.statut === 'refusee' ? 'مرفوض' : (isAr ? 'في الانتظار' : 'En attente');
  const attachedDocs = demande.documentsFichiers || {};
  const docEntries: Array<[ChildDocumentKey, string]> = [
    ['certificatMedical', isAr ? 'الشهادة الطبية' : 'Certificat médical'],
    ['carnetVaccination', isAr ? 'دفتر التلقيح' : 'Carnet de vaccination'],
    ['justificatifDomicile', isAr ? 'إثبات السكن' : 'Justificatif de domicile'],
    ['photoIdentite', isAr ? 'صورة الهوية' : "Photo d'identité"],
  ];
  return <article className="min-w-0 rounded-2xl border border-slate-200/85 p-4 transition hover:border-indigo-200 hover:shadow-xs"><div className="flex items-start justify-between gap-2.5"><div className="flex min-w-0 items-center gap-2.5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><UserRound className="h-4.5 w-4.5" /></div><div className="min-w-0"><h3 className="truncate text-sm font-bold text-slate-900">{demande.prenom} {demande.nom}</h3><p className="mt-0.5 truncate text-xs text-slate-500">{demande.parentPrenom} {demande.parentNom} · {demande.parentTelephone}</p></div></div><span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${statusClass}`}>{demande.statut === 'refusee' && !isAr ? 'Refusée' : statusLabel}</span></div><div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5"><p className="truncate text-[11px] font-medium text-slate-500 tabular-nums">{new Date(demande.dateDemande).toLocaleDateString(isAr ? 'ar-DZ' : 'fr-DZ')} · {demande.groupeAge}</p><button type="button" onClick={onSelect} className="min-h-8! shrink-0 whitespace-nowrap inline-flex items-center rounded-lg px-2 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 cursor-pointer">{selected ? (isAr ? 'إخفاء' : 'Masquer') : (isAr ? 'عرض الملف' : 'Voir le dossier')}</button></div>{selected && <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3 text-sm text-slate-600"><Detail label={isAr ? 'تاريخ الميلاد' : 'Date de naissance'} value={demande.dateNaissance} /><Detail label={isAr ? 'الحساسيات' : 'Allergies'} value={demande.allergie || '—'} /><Detail label={isAr ? 'النظام الغذائي' : 'Régime'} value={demande.regimeAlimentaire || '—'} /><Detail label={isAr ? 'البريد' : 'E-mail'} value={demande.parentEmail || '—'} /><Detail label={isAr ? 'العنوان' : 'Adresse'} value={demande.parentAdresse || '—'} /><div className="grid gap-2 pt-1 sm:grid-cols-2">{docEntries.map(([k, lbl]) => <DocumentScannerSlot key={k} docKey={k} label={lbl} isArabic={isAr} value={attachedDocs[k]} declaredWithoutFile={Boolean(demande.documentsRequis?.[k] && !attachedDocs[k])} readOnly childName={`${demande.prenom} ${demande.nom}`.trim()} />)}</div>{demande.statut === 'refusee' && demande.motifRefus && <Detail label={isAr ? 'سبب الرفض' : 'Motif du refus'} value={demande.motifRefus} />} {demande.statut === 'en_attente' && <div className="grid grid-cols-2 gap-2 pt-2"><button type="button" disabled={busy} onClick={() => onDecide(demande, 'acceptee')} className="min-h-9! whitespace-nowrap inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"><ClipboardCheck className="h-3.5 w-3.5 shrink-0" />{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (isAr ? 'قبول وإضافة' : 'Accepter et ajouter')}</button><button type="button" disabled={busy} onClick={() => onDecide(demande, 'refusee')} className="min-h-9! whitespace-nowrap inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60 cursor-pointer"><XCircle className="h-3.5 w-3.5 shrink-0" />{isAr ? 'رفض' : 'Refuser'}</button></div>}</div>}</article>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[110px_1fr] gap-2 text-xs"><span className="font-black text-slate-500">{label}</span><span className="break-words text-slate-700">{value}</span></div>;
}
