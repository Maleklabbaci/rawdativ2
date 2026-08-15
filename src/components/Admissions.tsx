import React, { useMemo, useState } from 'react';
import { ClipboardCheck, Copy, Download, ExternalLink, FileText, Link2, Loader2, QrCode, RefreshCw, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import * as QRCode from 'qrcode';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { DemandeAdmission, InscriptionLink } from '../types';

export default function Admissions() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const { inscriptionLinks, demandesAdmission, createInscriptionLink, toggleInscriptionLink, decideAdmission } = useDb();
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState<(InscriptionLink & { token: string }) | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<DemandeAdmission | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const pending = demandesAdmission.filter(item => item.statut === 'en_attente');
  const linkUrl = useMemo(() => newLink?.token ? `${window.location.origin}/admission?token=${encodeURIComponent(newLink.token)}` : '', [newLink]);

  const createLink = async () => {
    setCreating(true);
    try {
      const created = await createInscriptionLink(label || (isAr ? 'رابط التسجيل' : "Lien d'inscription"));
      setNewLink(created);
      setLabel('');
      setCopied(false);
      const dataUrl = await QRCode.toDataURL(`${window.location.origin}/admission?token=${encodeURIComponent(created.token)}`, { width: 520, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#172554', light: '#ffffff' } });
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error('Erreur création lien admission:', error);
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async () => {
    if (!linkUrl) return;
    await navigator.clipboard?.writeText(linkUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const anchor = document.createElement('a');
    anchor.href = qrDataUrl;
    anchor.download = 'rawdha-lien-admission.png';
    anchor.click();
  };

  const decide = async (demande: DemandeAdmission, statut: 'acceptee' | 'refusee') => {
    const confirmation = isAr
      ? (statut === 'acceptee' ? 'هل تريد قبول هذا الطفل وإضافته إلى قائمة الأطفال؟' : 'هل تريد رفض هذا الطلب؟')
      : (statut === 'acceptee' ? "Confirmer l'ajout de cet enfant dans la crèche ?" : 'Confirmer le refus de cette demande ?');
    if (!window.confirm(confirmation)) return;
    let motif = '';
    if (statut === 'refusee') {
      motif = window.prompt(isAr ? 'سبب الرفض (اختياري)' : 'Motif du refus (facultatif)') || '';
    }
    setBusyId(demande.id);
    try {
      await decideAdmission(demande.id, statut, motif);
      setSelected(null);
    } catch (error) {
      console.error('Erreur décision admission:', error);
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (link: InscriptionLink) => {
    setBusyId(link.id);
    try { await toggleInscriptionLink(link.id, !link.active); } catch (error) { console.error('Erreur activation lien:', error); } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-8" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-indigo-500">RAWDHA+ • {isAr ? 'قبول الأطفال' : 'Admissions'}</p><h1 className="text-3xl font-black tracking-tight text-slate-950">{isAr ? 'روابط التسجيل والطلبات' : "Liens d'inscription & demandes"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{isAr ? 'أنشئ رابطاً خاصاً بروضتك، أرسله للأولياء، ثم راجع كل ملف قبل القبول.' : 'Créez un lien propre à votre crèche, transmettez-le aux parents, puis vérifiez chaque dossier avant acceptation.'}</p></div>
        <div className="flex items-center gap-2 rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700"><ShieldCheck className="h-5 w-5" />{isAr ? 'القبول بقرار الإدارة' : 'Validation par la direction'}</div>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-xl shadow-indigo-900/10 sm:p-8">
          <div className="flex items-start gap-4"><div className="rounded-2xl bg-white/15 p-3"><QrCode className="h-7 w-7" /></div><div><h2 className="text-xl font-black">{isAr ? 'إنشاء رابط جديد' : 'Créer un nouveau lien'}</h2><p className="mt-1 text-sm leading-6 text-indigo-100">{isAr ? 'الرابط يخص هذه الروضة فقط ويمكن تعطيله في أي وقت.' : 'Le lien est dédié à cette crèche et peut être désactivé à tout moment.'}</p></div></div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row"><input value={label} onChange={e => setLabel(e.target.value)} placeholder={isAr ? 'اسم الرابط (اختياري)' : "Nom du lien (facultatif)"} className="min-w-0 flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-indigo-200 focus:border-white/60" /><button type="button" onClick={createLink} disabled={creating} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-60"><Link2 className="h-4 w-4" />{creating ? (isAr ? 'جاري الإنشاء...' : 'Création...') : (isAr ? 'إنشاء الرابط' : 'Générer le lien')}</button></div>
          {newLink && linkUrl && <div className="mt-6 grid gap-5 rounded-3xl bg-white p-5 text-slate-900 sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-wider text-emerald-600">{isAr ? 'تم إنشاء الرابط' : 'Lien créé'}</p><p className="mt-2 break-all rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">{linkUrl}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={copyLink} className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100"><Copy className="h-3.5 w-3.5" />{copied ? (isAr ? 'تم النسخ' : 'Copié') : (isAr ? 'نسخ الرابط' : 'Copier')}</button><a href={linkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"><ExternalLink className="h-3.5 w-3.5" />{isAr ? 'فتح' : 'Ouvrir'}</a><button type="button" onClick={downloadQr} className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"><Download className="h-3.5 w-3.5" />{isAr ? 'تحميل QR' : 'Télécharger QR'}</button></div></div><img src={qrDataUrl} alt="QR code admission" className="mx-auto h-40 w-40 rounded-2xl border border-slate-100 p-2" /></div>}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">{isAr ? 'روابط روضتك' : 'Liens de votre crèche'}</h2><p className="mt-1 text-xs text-slate-500">{isAr ? 'يمكنك تعطيل رابط في أي وقت.' : 'Désactivez un lien à tout moment.'}</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">{inscriptionLinks.length}</span></div><div className="mt-5 space-y-3">{inscriptionLinks.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">{isAr ? 'لم يتم إنشاء أي رابط بعد.' : "Aucun lien n'a encore été créé."}</div> : inscriptionLinks.map(link => <div key={link.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{link.label || (isAr ? 'رابط التسجيل' : "Lien d'inscription")}</p><p className="mt-1 text-[11px] text-slate-500">{link.createdAt ? new Date(link.createdAt).toLocaleString(isAr ? 'ar-DZ' : 'fr-DZ') : ''}</p></div><button type="button" disabled={busyId === link.id} onClick={() => toggle(link)} className={`rounded-xl px-3 py-2 text-xs font-black transition ${link.active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>{busyId === link.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : link.active ? (isAr ? 'نشط' : 'Actif') : (isAr ? 'متوقف' : 'Désactivé')}</button></div>)}</div></div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-indigo-600" /><h2 className="text-xl font-black text-slate-900">{isAr ? 'طلبات التسجيل' : "Demandes d'admission"}</h2></div><p className="mt-1 text-sm text-slate-500">{isAr ? 'راجع الملفات الواردة قبل إضافة الطفل إلى قاعدة التسيير.' : 'Vérifiez les dossiers reçus avant de créer l’enfant dans votre gestion.'}</p></div><span className="rounded-full bg-amber-50 px-4 py-2 text-xs font-black text-amber-700">{pending.length} {isAr ? 'في الانتظار' : 'en attente'}</span></div><div className="mt-6 grid gap-4 lg:grid-cols-2">{demandesAdmission.length === 0 ? <div className="lg:col-span-2 rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">{isAr ? 'لا توجد طلبات تسجيل حالياً.' : "Aucune demande d'admission pour le moment."}</div> : [...demandesAdmission].sort((a, b) => b.dateDemande.localeCompare(a.dateDemande)).map(demande => <AdmissionCard key={demande.id} demande={demande} isAr={isAr} selected={selected?.id === demande.id} busy={busyId === demande.id} onSelect={() => setSelected(selected?.id === demande.id ? null : demande)} onDecide={decide} />)}</div></section>
    </div>
  );
}

function AdmissionCard({ demande, isAr, selected, busy, onSelect, onDecide }: { key?: React.Key; demande: DemandeAdmission; isAr: boolean; selected: boolean; busy: boolean; onSelect: () => void; onDecide: (demande: DemandeAdmission, statut: 'acceptee' | 'refusee') => void }) {
  const statusClass = demande.statut === 'acceptee' ? 'bg-emerald-50 text-emerald-700' : demande.statut === 'refusee' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700';
  const statusLabel = demande.statut === 'acceptee' ? (isAr ? 'مقبول' : 'Acceptée') : demande.statut === 'refusee' ? (isAr ? 'مرفوض' : 'Refusée') : (isAr ? 'في الانتظار' : 'En attente');
  return <article className="rounded-2xl border border-slate-200 p-5 transition hover:border-indigo-200 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><UserRound className="h-5 w-5" /></div><div className="min-w-0"><h3 className="truncate text-base font-black text-slate-900">{demande.prenom} {demande.nom}</h3><p className="mt-1 text-xs text-slate-500">{demande.parentPrenom} {demande.parentNom} • {demande.parentTelephone}</p></div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${statusClass}`}>{statusLabel}</span></div><p className="mt-4 text-xs text-slate-500">{new Date(demande.dateDemande).toLocaleString(isAr ? 'ar-DZ' : 'fr-DZ')} • {demande.groupeAge}</p><button type="button" onClick={onSelect} className="mt-4 text-xs font-black text-indigo-600 hover:text-indigo-800">{selected ? (isAr ? 'إخفاء التفاصيل' : 'Masquer les détails') : (isAr ? 'عرض الملف' : 'Voir le dossier')}</button>{selected && <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-600"><Detail label={isAr ? 'تاريخ الميلاد' : 'Date de naissance'} value={demande.dateNaissance} /><Detail label={isAr ? 'الحساسيات' : 'Allergies'} value={demande.allergie || '—'} /><Detail label={isAr ? 'النظام الغذائي' : 'Régime'} value={demande.regimeAlimentaire || '—'} /><Detail label={isAr ? 'البريد' : 'E-mail'} value={demande.parentEmail || '—'} /><Detail label={isAr ? 'العنوان' : 'Adresse'} value={demande.parentAdresse || '—'} />{demande.statut === 'refusee' && demande.motifRefus && <Detail label={isAr ? 'سبب الرفض' : 'Motif du refus'} value={demande.motifRefus} />} {demande.statut === 'en_attente' && <div className="flex flex-wrap gap-2 pt-2"><button type="button" disabled={busy} onClick={() => onDecide(demande, 'acceptee')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-60"><ClipboardCheck className="h-3.5 w-3.5" />{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (isAr ? 'قبول وإضافة الطفل' : 'Accepter et ajouter')}</button><button type="button" disabled={busy} onClick={() => onDecide(demande, 'refusee')} className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-60"><XCircle className="h-3.5 w-3.5" />{isAr ? 'رفض' : 'Refuser'}</button></div>}</div>}</article>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[110px_1fr] gap-2 text-xs"><span className="font-black text-slate-500">{label}</span><span className="break-words text-slate-700">{value}</span></div>;
}
