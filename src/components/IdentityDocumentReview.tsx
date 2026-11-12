import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { prepareIdentityPhoto } from '../utils/prepareIdentityPhoto';
import { readIdentityLocally, type LocalIdentityAssistance } from '../utils/localIdentityAssistance';

type Review = { account_id: string; account_first_name: string; account_last_name: string; auto_match?: 'not_checked' | 'matched' | 'not_matched' | 'unreadable'; ocr_first_name?: string | null; ocr_last_name?: string | null };
async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('identity-document-review', { body });
  if (error) {
    const context = (error as { context?: unknown }).context;
    const details = context instanceof Response ? await context.clone().json().catch(() => null) : null;
    throw new Error(details?.error || 'Service indisponible. Réessayez.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
const panel = 'rounded-2xl border border-slate-200 bg-white p-4 sm:p-5';
const button = 'rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
async function decodeIdentityDocument(value: unknown): Promise<Blob> {
  if (!(value instanceof Blob) || !value.size || value.size > 2097152) throw new Error('Document indisponible.');
  const bytes=new Uint8Array(await value.slice(0,8).arrayBuffer());
  const jpeg=bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff;
  const png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
  if (!jpeg && !png) throw new Error('Document illisible.');
  return new Blob([value],{type:jpeg?'image/jpeg':'image/png'});
}

export function IdentityDocumentRequest({ userId, firstName, lastName, isFrench }: { userId: string; firstName: string; lastName: string; isFrench: boolean }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    const { data, error: dbError } = await supabase.from('identity_document_reviews').select('status').eq('account_id', userId).maybeSingle();
    if (dbError) { setError(isFrench ? 'Statut indisponible.' : 'الحالة غير متاحة.'); setLoaded(false); return; }
    setStatus(data?.status || 'unverified'); setLoaded(true);
  }, [userId, isFrench]);
  useEffect(() => { void refresh(); }, [refresh]);
  const submit = async (file: File) => {
    if (lock.current) return;
    if (!['image/jpeg','image/png'].includes(file.type) || !file.size || file.size>20*1024*1024) {setError(isFrench ? 'Choisis une image JPEG ou PNG de 20 Mo maximum.' : 'اختاري صورة JPEG أو PNG حتى 20 ميغابايت.');return;}
    lock.current=true;setBusy(true);setError('');
    try {
      const photo=await prepareIdentityPhoto(file);
      const image=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1] || '');reader.onerror=()=>reject(new Error('Lecture impossible.'));reader.readAsDataURL(photo)});
      await invoke({action:'submit',mime:'image/jpeg',image});await refresh();
    } catch(e) {setError(e instanceof Error && e.message !== 'invalid_photo' ? e.message : (isFrench?'Photo illisible ou envoi impossible. Essaie une image JPEG ou PNG.':'تعذر إرسال الصورة. اختاري صورة JPEG أو PNG.'));}
    finally {lock.current=false;setBusy(false);}
  };
  const label = status === 'pending' ? (isFrench ? 'En cours de certification' : 'التحقق جارٍ') : status === 'document_reviewed' ? (isFrench ? 'Document contrôlé' : 'تمت مراجعة الوثيقة') : status === 'refused' ? (isFrench ? 'Document non retenu' : 'لم تُقبل الوثيقة') : (isFrench ? 'Non contrôlé' : 'لم تتم المراجعة');
  return <section className={panel} aria-labelledby="identity-review-title">
    <h2 id="identity-review-title" className="text-base font-bold text-slate-900">{isFrench ? 'Contrôle du document d’identité' : 'مراجعة وثيقة الهوية'}</h2>
    <p className="mt-1 text-sm text-slate-600">{isFrench ? 'Ton document est transmis au super admin pour vérification.' : 'تُرسل وثيقتك للمسؤول لمراجعتها.'}</p>
    <p className="mt-2 text-sm font-bold text-slate-800">{firstName} {lastName} · {loaded ? label : (isFrench ? 'Statut indisponible' : 'الحالة غير متاحة')}</p>
    {loaded && status !== 'pending' && status !== 'document_reviewed' && <div className="mt-4 space-y-3"><p className="text-xs leading-5 text-slate-600">{isFrench ? 'En ajoutant ta carte, tu acceptes son envoi pour contrôle. Elle est supprimée de la base active après la décision ; les sauvegardes peuvent subsister selon leur durée de conservation.' : 'بإضافة بطاقتك، توافقين على إرسالها للمراجعة. تُحذف من قاعدة البيانات النشطة بعد القرار؛ قد تبقى في النسخ الاحتياطية.'}</p><input ref={fileInput} type="file" accept="image/jpeg,image/png" className="sr-only" onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void submit(file)}}/><input ref={cameraInput} type="file" accept="image/jpeg,image/png" capture="environment" className="sr-only" onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void submit(file)}}/><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy} onClick={()=>cameraInput.current?.click()}>{busy ? (isFrench?'Envoi…':'جارٍ الإرسال…') : (isFrench?'Prendre une photo':'التقاط صورة')}</button><button type="button" className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-bold text-indigo-700 disabled:opacity-50" disabled={busy} onClick={()=>fileInput.current?.click()}>{isFrench?'Importer une photo':'استيراد صورة'}</button></div></div>}
    {status === 'pending' && <p className="mt-3 rounded-xl bg-indigo-50 p-3 text-xs leading-5 text-indigo-800">{isFrench ? 'Ta demande est en cours de certification. Le super admin prendra la décision.' : 'طلبك قيد التحقق، وسيصدر المسؤول القرار.'}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
  </section>;
}

export function IdentityDocumentAdmin({ isFrench }: { isFrench: boolean }) {
  const [requests, setRequests] = useState<Review[]>([]);
  const [selected, setSelected] = useState<Review | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [checked, setChecked] = useState(false);
  const [localReading, setLocalReading] = useState<{state:'reading'|'done'|'error'; result?:LocalIdentityAssistance} | null>(null);
  const readingController = useRef<AbortController | null>(null);
  useEffect(() => () => { readingController.current?.abort(); }, []);
  useEffect(() => {
    const controller=readingController.current;
    return () => { if(controller && readingController.current===controller){controller.abort();readingController.current=null;} };
  }, [selected?.account_id]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => { try { const data = await invoke({ action: 'list' }); const next: Review[] = data.requests || []; setRequests(next); setSelected(current => current ? next.find(r => r.account_id === current.account_id) || null : null); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Erreur.'); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  useEffect(() => {
    if (!selected && imageUrl) setImageUrl('');
  }, [selected, imageUrl]);
  const open = async (request: Review) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setChecked(false); setSelected(null); setImageUrl('');
    readingController.current?.abort(); setLocalReading(null);
    try {
      const blob = await decodeIdentityDocument(await invoke({ action: 'document', accountId: request.account_id }));
      setImageUrl(URL.createObjectURL(blob)); setSelected(request);
      const controller=new AbortController();readingController.current=controller;setLocalReading({state:'reading'});
      const timer=window.setTimeout(()=>controller.abort(),90000);
      void readIdentityLocally(blob,{first:request.account_first_name,last:request.account_last_name},controller.signal)
        .then(result=>{if(readingController.current===controller)setLocalReading({state:'done',result});})
        .catch(()=>{if(readingController.current===controller)setLocalReading({state:'error'});})
        .finally(()=>window.clearTimeout(timer));
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const decide = async (decision: 'document_reviewed' | 'refused') => {
    if (!selected || lock.current || (decision === 'document_reviewed' && !checked)) return;
    lock.current = true; setBusy(true); setError('');
    try { await invoke({ action: 'decide', accountId: selected.account_id, decision }); readingController.current?.abort(); readingController.current=null; setLocalReading(null); setSelected(null); setImageUrl(''); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className={panel} aria-labelledby="identity-admin-title"><h2 id="identity-admin-title" className="text-base font-bold">{isFrench ? 'Documents à contrôler' : 'الوثائق للمراجعة'}</h2>
    <p className="mt-1 text-xs text-slate-600">{isFrench ? 'Comparez manuellement le nom du compte à la carte. La carte seule ne prouve ni l’identité ni le rôle dans la crèche.' : 'قارني اسم الحساب بالبطاقة يدوياً. البطاقة وحدها لا تثبت الهوية أو الصفة في الحضانة.'}</p>
    <button type="button" onClick={() => void load()} disabled={busy} className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">{isFrench ? 'Actualiser les demandes' : 'تحديث الطلبات'}</button>
    <div className="mt-3 space-y-2">{requests.map(r => <div key={r.account_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3"><span className="text-sm font-semibold">{r.account_first_name} {r.account_last_name}</span><button type="button" disabled={busy} onClick={() => void open(r)} className="rounded-lg border border-slate-300 px-3 py-1 text-sm">{isFrench ? 'Examiner' : 'مراجعة'}</button></div>)}{!requests.length && !error && <p className="text-sm text-slate-500">{isFrench ? 'Aucune demande.' : 'لا توجد طلبات.'}</p>}</div>
    {selected && imageUrl && <div className="mt-4 space-y-3 border-t border-slate-200 pt-4"><div className="rounded-xl bg-indigo-50 p-3 text-xs leading-5 text-indigo-900" role="status"><p className="font-bold">{isFrench ? 'Aide à la lecture automatique · sur cet appareil' : 'مساعدة القراءة الآلية · على هذا الجهاز'}</p><p className="mt-1">{localReading?.state === 'reading' ? (isFrench?'Lecture en cours…':'جارٍ القراءة…') : localReading?.state === 'error' ? (isFrench?'Lecture indisponible : vérifiez la carte manuellement.':'القراءة غير متاحة: راجع البطاقة يدوياً.') : localReading?.result?.kind === 'exact' || localReading?.result?.kind === 'possible' ? (isFrench?'Noms possiblement concordants.':'الأسماء قد تكون متطابقة.') : localReading?.result?.kind === 'different' ? (isFrench?'Différence détectée ou lecture incorrecte : vérifiez la carte.':'اختلاف أو خطأ في القراءة: راجع البطاقة.') : (isFrench?'Lecture incertaine ou illisible.':'القراءة غير مؤكدة أو غير واضحة.')}</p>{(localReading?.result?.name.first || localReading?.result?.name.last) && <p className="mt-1 break-words">{isFrench ? 'Nom lu' : 'الاسم المقروء'} : {localReading?.result?.name.first || '—'} {localReading?.result?.name.last || '—'}</p>}<p className="mt-1">{isFrench ? 'Résultat indicatif, non enregistré et non envoyé à un service OCR. Il ne prouve ni l’identité ni l’authenticité.' : 'نتيجة استرشادية غير محفوظة ولا تُرسل لخدمة قراءة. لا تثبت الهوية أو صحة الوثيقة.'}</p></div><p className="text-sm font-bold">{isFrench ? 'Nom du compte' : 'اسم الحساب'} : {selected.account_first_name} {selected.account_last_name}</p><img src={imageUrl} alt={isFrench ? 'Document transmis' : 'الوثيقة المرسلة'} className="max-h-[450px] max-w-full rounded-lg object-contain" /><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />{isFrench ? 'J’ai comparé le nom du document à celui du compte.' : 'قارنت اسم الوثيقة باسم الحساب.'}</label><p className="text-xs text-slate-600">{isFrench ? 'La décision supprime la carte de la base active.' : 'يحذف القرار البطاقة من قاعدة البيانات النشطة.'}</p><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy || !checked} onClick={() => void decide('document_reviewed')}>{isFrench ? 'Document contrôlé' : 'تمت المراجعة'}</button><button type="button" disabled={busy} onClick={() => void decide('refused')} className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-bold text-rose-700">{isFrench ? 'Refuser' : 'رفض'}</button><button type="button" onClick={() => { readingController.current?.abort(); readingController.current=null; setLocalReading(null); setSelected(null); setImageUrl(''); }} className="rounded-xl px-4 py-2 text-sm">{isFrench ? 'Fermer' : 'إغلاق'}</button></div></div>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
  </section>;
}
