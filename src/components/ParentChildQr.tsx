import { useState } from 'react';
import { Copy, Download, QrCode, Share2, X } from 'lucide-react';
import * as QRCode from 'qrcode';
import { supabase } from '../supabase';
import { useDb } from '../contexts/DbContext';

export default function ParentChildQr({ childId, childName, crecheId, crecheName, isArabic, compact = false }: { childId: string; childName: string; crecheId: string; crecheName: string; isArabic: boolean; compact?: boolean }) {
  const { enfants } = useDb();
  const parents = enfants.find(child => child.id === childId && child.crecheId === crecheId)?.parents || [];
  const [parentId, setParentId] = useState('');
  const isDemo = Boolean(import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [message, setMessage] = useState('');
  const createInvite = async (chosenParentId = parentId) => {
    if (busy) return;
    setBusy(true); setMessage(''); setQr(''); setInviteUrl('');
    try {
      const { data, error } = isDemo ? { data: { token: '0'.repeat(64) }, error: null } : chosenParentId ? await supabase.rpc('rawdha_create_registered_parent_invite', { p_enfant_id: childId, p_parent_id: chosenParentId }) : await supabase.rpc('rawdha_create_child_parent_invite', { p_enfant_id: childId });
      if (error || typeof data?.token !== 'string' || !/^[0-9a-f]{64}$/.test(data.token)) throw new Error('unavailable');
      const url = new URL('/espace-parent', window.location.origin);
      url.searchParams.set('creche', crecheId);
      if (crecheName.trim()) url.searchParams.set('nom', crecheName.trim());
      url.hash = new URLSearchParams(chosenParentId ? { enfant: data.token, rapide: '1' } : { enfant: data.token }).toString();
      const image = await QRCode.toDataURL(url.toString(), { width: 420, margin: 2, errorCorrectionLevel: 'M' });
      setInviteUrl(url.toString()); setQr(image);
    } catch { setMessage(isArabic ? 'تعذر إنشاء الرابط. تحققي من الاتصال والإعدادات.' : 'Impossible de créer le lien. Vérifiez la connexion et les coordonnées enregistrées du parent.'); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); setMessage(isArabic ? 'تم نسخ الرابط.' : 'Lien copié.'); }
    catch { setMessage(isArabic ? 'انسخي الرابط يدوياً من الحقل.' : 'Copiez le lien manuellement dans le champ.'); }
  };
  const share = async () => {
    if (!navigator.share) return copy();
    try { await navigator.share({ title: 'Espace Parent Rawdha+', text: isArabic ? 'رابط شخصي لفضاء الأولياء.' : 'Voici votre lien personnel pour demander l’accès à l’espace parent.', url: inviteUrl }); }
    catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setMessage(isArabic ? 'انسخي الرابط يدوياً.' : 'Partage indisponible : copiez le lien manuellement.'); }
  };
  const close = () => { setOpen(false); setQr(''); setInviteUrl(''); setMessage(''); setParentId(''); };
  return <>
    <button type="button" onClick={() => { setOpen(true); if (parents.length === 0) void createInvite(''); }} aria-label={isArabic ? `رمز الولي للطفل ${childName}` : `QR parent de ${childName}`} title={isArabic ? 'رمز ورابط الولي' : 'QR et lien parent'} className={compact ? 'inline-flex min-h-8! h-8 items-center justify-center gap-1.5 rounded-lg bg-indigo-50 px-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100' : 'inline-flex min-h-10 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700'}><QrCode size={16}/>{compact ? <span className="hidden lg:inline">QR</span> : (isArabic ? 'رمز ورابط الولي' : 'QR et lien parent')}</button>
    {open && <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/65 p-4" onClick={close}>
      <div role="dialog" aria-modal="true" aria-label={isArabic ? 'ربط الولي' : 'Relier le parent'} className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between gap-3"><div><h3 className="text-lg font-black text-slate-900">{isArabic ? 'ربط هاتف الولي' : 'Relier le parent'}</h3><p className="text-sm text-slate-500">{childName}</p></div><button type="button" onClick={close} aria-label={isArabic ? 'إغلاق' : 'Fermer'} className="rounded-xl p-2 text-slate-500"><X size={18}/></button></div>
        {parents.length > 0 && <div className="mt-4 rounded-xl bg-indigo-50 p-3"><label htmlFor={`qr-parent-${childId}`} className="text-xs font-bold text-indigo-900">{isArabic ? 'اختاري الولي المسجل لتسهيل الربط' : 'Choisir le parent déjà enregistré'}</label><select id={`qr-parent-${childId}`} value={parentId} onChange={e => { setParentId(e.target.value); setQr(''); setInviteUrl(''); setMessage(''); }} disabled={busy} className="mt-2 w-full rounded-lg border border-indigo-200 bg-white p-2 text-sm"><option value="">{isArabic ? 'ولي جديد: يملأ بياناته' : 'Nouveau parent : il renseigne ses coordonnées'}</option>{parents.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom} · {p.lien}</option>)}</select><button type="button" disabled={busy} onClick={() => void createInvite()} className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{isArabic ? 'إنشاء الرمز' : 'Créer le QR'}</button>{parentId && <p className="mt-2 text-xs text-indigo-800">{isArabic ? 'لن يحتاج الولي لإدخال بياناته. تحققي من هويته قبل الموافقة.' : 'Le parent ne saisira pas ses coordonnées. Vérifiez son identité avant de valider.'}</p>}</div>}
        {busy ? <p role="status" className="py-12 text-center text-sm text-slate-500">{isArabic ? 'جاري إنشاء الرمز...' : 'Création du QR...'}</p> : qr ? <img src={qr} alt={isArabic ? 'رمز ربط الولي' : 'QR de liaison parent'} className="mx-auto my-4 h-52 w-52 max-w-full rounded-xl border border-slate-100"/> : null}
        {isDemo && <p role="status" className="my-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">{isArabic ? 'عرض تجريبي فقط: الرمز والرابط غير فعالين.' : 'Aperçu fictif : ce QR et ce lien ne sont pas actifs.'}</p>}
        <p className="text-xs leading-relaxed text-slate-600">{isArabic ? 'الرابط والرمز شخصيان وصالحان 48 ساعة ولمرة واحدة. لا ترسليهما إلا للولي المعني. تصادق المديرة قبل عرض بيانات الطفل.' : 'QR et lien personnels, valables 48 h et une seule fois. Partagez-les uniquement avec le parent concerné. Vous validez sa demande avant l’accès aux données.'}</p>
        {inviteUrl && <div className="mt-4"><label htmlFor="parent-invite-url" className="text-xs font-bold text-slate-600">{isArabic ? 'الرابط الشخصي' : 'Lien personnel'}</label><input id="parent-invite-url" readOnly value={inviteUrl} onFocus={e => e.currentTarget.select()} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"/><div className="mt-2 flex gap-2"><button type="button" onClick={() => void copy()} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700"><Copy size={14}/>{isArabic ? 'نسخ' : 'Copier'}</button><button type="button" onClick={() => void share()} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-700"><Share2 size={14}/>{isArabic ? 'مشاركة' : 'Partager'}</button></div></div>}
        {message && <p role="status" className="mt-3 text-xs text-slate-600">{message}</p>}
        <div className="mt-4 flex gap-2">{qr && <a href={qr} download="rawdha-qr-parent.png" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white"><Download size={14}/>{isArabic ? 'تحميل' : 'Télécharger QR'}</a>}<button type="button" disabled={busy} onClick={() => void createInvite()} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50">{isArabic ? 'رمز جديد' : 'Nouveau QR'}</button></div>
      </div>
    </div>}
  </>;
}
