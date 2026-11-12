import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  BellRing,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Home,
  Plus,
  QrCode,
  Search,
  Send,
  Smartphone,
  UserCheck,
  X,
} from 'lucide-react';
import * as QRCode from 'qrcode';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import {
  approveParentLinkRequest,
  buildParentQrUrl,
  ensureDemoParentPortalSeed,
  findMatchingChildrenForRequest,
  loadParentAnnouncements,
  loadParentLinkRequests,
  publishParentAnnouncement,
  rejectParentLinkRequest,
  subscribeToParentPortalChanges,
  type ParentAnnouncement,
  type ParentLinkRequest,
} from '../utils/parentPortal';

interface Props {
  mode: 'links' | 'push';
  onOpenInlineSimulator?: () => void;
}

export default function ParentPortalDirectorPanel({ mode, onOpenInlineSimulator }: Props) {
  const { user, creche } = useAuth();
  const { enfants: allEnfants, presences, repas, activites, paiements } = useDb();
  const { language } = useLanguage();
  const toast = useToast();
  const isFr = language !== 'ar';

  const crecheId = user?.id || 'preview-director';
  const crecheNom = creche?.nom || user?.nomCreche || 'Crèche Les Petits Soleils';

  const enfants = useMemo(
    () => allEnfants.filter((c) => !c.crecheId || c.crecheId === crecheId),
    [allEnfants, crecheId],
  );

  const qrUrl = useMemo(() => buildParentQrUrl(crecheId, crecheNom), [crecheId, crecheNom]);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedQr, setCopiedQr] = useState(false);

  const [requests, setRequests] = useState<ParentLinkRequest[]>([]);
  const [announcements, setAnnouncements] = useState<ParentAnnouncement[]>([]);
  const [selectedChildIdsByReq, setSelectedChildIdsByReq] = useState<Record<string, string[]>>({});
  const requestTargetsRef = useRef<Record<string, string>>({});
  const [pickerOpenReqId, setPickerOpenReqId] = useState<string | null>(null);
  const [childSearch, setChildSearch] = useState('');
  const [busyReqId, setBusyReqId] = useState<string | null>(null);

  // Formulaire Annonce Push
  const [annCategory, setAnnCategory] = useState<ParentAnnouncement['category']>('info');
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [targetScope, setTargetScope] = useState<'all' | 'group' | 'child'>('all');
  const [targetGroup, setTargetGroup] = useState<'Bébés' | 'Moyens' | 'Grands'>('Bébés');
  const [targetEnfantId, setTargetEnfantId] = useState('');
  const [sendingPush, setSendingPush] = useState(false);
  const sendingPushRef = useRef(false);
  const [sendResult, setSendResult] = useState('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrUrl, {
      width: 440,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#1e1b4b', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [qrUrl]);

  useEffect(() => {
    ensureDemoParentPortalSeed({
      crecheId,
      crecheNom,
      enfants,
      presences,
      repas,
      activites,
      paiements,
    });

    let mounted = true;
    const syncAll = async () => {
      const [reqs, anns] = await Promise.all([
        loadParentLinkRequests(crecheId),
        loadParentAnnouncements(crecheId),
      ]);
      if (!mounted) return;
      setRequests(reqs);
      setAnnouncements(anns);

      const targets: Record<string, string> = {};
      for (const r of reqs) targets[r.id] = `${r.status}:${r.requestedChildId || ''}:${JSON.stringify(r.requestedChildren)}`;
      const changedTargets = new Set(reqs.filter(r => requestTargetsRef.current[r.id] !== targets[r.id]).map(r => r.id));
      requestTargetsRef.current = targets;
      setSelectedChildIdsByReq((prev) => {
        const next = { ...prev };
        for (const r of reqs) {
          if (!next[r.id] || changedTargets.has(r.id)) {
            next[r.id] =
              r.linkedEnfantIds.length > 0
                ? r.linkedEnfantIds
                : r.requestedChildId
                  ? enfants.filter(child => child.id === r.requestedChildId).map(child => child.id)
                  : findMatchingChildrenForRequest(r, enfants);
          }
        }
        return next;
      });
    };

    void syncAll();
    const unsub = subscribeToParentPortalChanges(() => {
      void syncAll();
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [crecheId, crecheNom, enfants, presences, repas, activites, paiements]);

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const approvedRequests = requests.filter((r) => r.status === 'approved');
  const pushActiveCount = approvedRequests.filter((r) => r.pushEnabled).length;

  const toggleChildForRequest = (reqId: string, childId: string) => {
    setSelectedChildIdsByReq((prev) => {
      const current = prev[reqId] || [];
      const exists = current.includes(childId);
      return {
        ...prev,
        [reqId]: exists ? current.filter((id) => id !== childId) : [...current, childId],
      };
    });
  };

  const handleApprove = async (req: ParentLinkRequest) => {
    const chosenIds = selectedChildIdsByReq[req.id] || [];
    if (chosenIds.length === 0) {
      toast.error(
        isFr
          ? 'Sélectionnez au moins un enfant à rattacher avant de valider.'
          : 'يرجى اختيار طفل واحد على الأقل قبل المصادقة.',
      );
      setPickerOpenReqId(req.id);
      return;
    }
    setBusyReqId(req.id);
    try {
      await approveParentLinkRequest({
        requestId: req.id,
        enfantIds: chosenIds,
        enfants,
        presences,
        repas,
        activites,
        paiements,
      });
      setPickerOpenReqId(null);
      toast.success(
        isFr
          ? `Accès validé pour ${req.parentPrenom} ${req.parentNom} (${chosenIds.length} enfant(s))`
          : `تمت المصادقة على ربط ${req.parentPrenom} ${req.parentNom}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la validation.');
    } finally {
      setBusyReqId(null);
    }
  };

  const handleReject = async (req: ParentLinkRequest) => {
    setBusyReqId(req.id);
    try {
      await rejectParentLinkRequest(req.id, isFr ? 'Dossier non trouvé' : 'الملف غير مطابق');
      toast.info(isFr ? 'Demande refusée.' : 'تم رفض الطلب.');
    } catch {
      toast.error(isFr ? 'Refus non confirmé. Actualisez avant de réessayer.' : 'لم يتم تأكيد الرفض. حدّثي الصفحة قبل إعادة المحاولة.');
    } finally {
      setBusyReqId(null);
    }
  };

  const applyPreset = (preset: ParentAnnouncement['category']) => {
    setAnnCategory(preset);
    if (preset === 'fermeture') {
      setAnnTitle(isFr ? 'Information : Fermeture exceptionnelle' : 'إعلام: غلق استثنائي للروضة');
      setAnnMessage(
        isFr
          ? 'Chers parents, nous vous informons que la crèche sera fermée demain à l’occasion du jour férié. Reprise aux horaires habituels le lendemain.'
          : 'أولياءنا الكرام، نعلمكم بأن الروضة ستكون مغلقة غداً بمناسبة العطلة الرسمية، وتُستأنف الدراسة في التوقيت المعتاد.',
      );
    } else if (preset === 'evenement') {
      setAnnTitle(isFr ? 'Fête & journée thématique à la crèche' : 'احتفالية ويوم ترفيهي بالروضة');
      setAnnMessage(
        isFr
          ? 'Demain aura lieu notre journée festive à la crèche ! Les enfants peuvent venir en tenue traditionnelle s’ils le souhaitent.'
          : 'ننظم غداً يوماً احتفالياً مميزاً لأطفالنا في الروضة! يمكن للأطفال الحضور باللباس التقليدي.',
      );
    } else if (preset === 'rappel') {
      setAnnTitle(isFr ? 'Rappel : Sac & tenue de rechange' : 'تذكير: حقيبة الطفل وملابس الغيار');
      setAnnMessage(
        isFr
          ? 'Merci de vérifier qu’une tenue de rechange complète de saison est bien présente dans le sac de votre enfant.'
          : 'يرجى التأكد من وضع ملابس غيار موسمية كاملة داخل حقيبة طفلكم.',
      );
    } else if (preset === 'sante') {
      setAnnTitle(isFr ? 'Prévention santé saisonnière' : 'وقاية صحية موسمية');
      setAnnMessage(
        isFr
          ? 'Par mesure de prévention pour tous les enfants, merci de garder votre enfant au repos à la maison en cas de fièvre.'
          : 'حرصاً على سلامة جميع الأطفال، نرجو إبقاء الطفل في راحة بالمنزل في حال ارتفاع درجة الحرارة.',
      );
    } else {
      setAnnTitle('');
      setAnnMessage('');
    }
  };

  const handleSendPush = async (e: FormEvent) => {
    e.preventDefault();
    if (sendingPushRef.current) return;
    setSendResult('');
    if (!annTitle.trim() || !annMessage.trim()) {
      toast.error(isFr ? 'Renseignez le titre et le message.' : 'يرجى ملء العنوان والرسالة.');
      return;
    }
    if (targetScope === 'child' && !targetEnfantId) {
      setSendResult(isFr ? 'Choisissez l’enfant destinataire.' : 'اختاري الطفل المعني.');
      return;
    }
    sendingPushRef.current = true;
    setSendingPush(true);
    try {
      const res = await publishParentAnnouncement({
        crecheId,
        crecheNom,
        title: annTitle,
        message: annMessage,
        category: annCategory,
        targetScope,
        targetGroup: targetScope === 'group' ? targetGroup : undefined,
        targetEnfantId: targetScope === 'child' ? targetEnfantId : undefined,
        enfants,
      });
      setAnnTitle('');
      setAnnMessage('');
      if (res.pushStatus === 'demo') {
        setSendResult(isFr ? 'Annonce de démonstration uniquement : aucune notification réelle.' : 'إعلان تجريبي فقط، لم يُرسل إشعار حقيقي.');
      } else if (res.pushStatus === 'unknown') {
        setSendResult(isFr ? 'Annonce publiée. Résultat du Push inconnu : vérifiez avant de renvoyer.' : 'تم نشر الإعلان. نتيجة الإشعارات غير معروفة؛ تحققي قبل الإرسال مجدداً.');
      } else if (res.pushStatus === 'incomplete') {
        setSendResult(isFr ? `Annonce publiée. Push incomplet ou indisponible (${res.sentPushCount} accepté(s)).` : 'تم نشر الإعلان، لكن إرسال الإشعارات غير مكتمل أو غير متاح.');
      } else {
        setSendResult(isFr ? `Annonce publiée. Push accepté pour ${res.sentPushCount} appareil(s) ; réception non garantie.` : `تم نشر الإعلان وقبول الإشعارات لـ ${res.sentPushCount} جهاز؛ الاستلام غير مضمون.`);
      }
    } catch (err) {
      setSendResult(err instanceof Error ? err.message : (isFr ? 'Envoi non confirmé. Vérifiez l’historique avant de réessayer.' : 'لم يتم تأكيد الإرسال. تحققي من السجل قبل إعادة المحاولة.'));
    } finally {
      sendingPushRef.current = false;
      setSendingPush(false);
    }
  };

  const copyQrLink = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopiedQr(true);
      setTimeout(() => setCopiedQr(false), 1800);
    } catch {
      toast.error('Impossible de copier le lien.');
    }
  };

  const downloadQrImage = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = 'qr-espace-parent-rawdha.png';
    a.click();
  };

  if (mode === 'push') {
    return (
      <div className="space-y-4">
        {/* Composer d'annonce Push */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                <BellRing className="h-4 w-4 shrink-0" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-black text-slate-900 truncate">
                  {isFr ? 'Envoyer une notification Push aux parents' : 'إرسال إشعار فوري لهواتف الأولياء'}
                </h2>
                <p className="text-xs text-slate-500 truncate">
                  {isFr
                    ? `${approvedRequests.length} famille(s) liée(s) · ${pushActiveCount} accès avec Push enregistré`
                    : `${approvedRequests.length} عائلة مرتبطة · ${pushActiveCount} إشعار مسجل`}
                </p>
              </div>
            </div>
            {onOpenInlineSimulator && (
              <button
                type="button"
                onClick={onOpenInlineSimulator}
                className="min-h-8! inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer shrink-0"
              >
                <Smartphone className="h-3.5 w-3.5 shrink-0" />
                <span>{isFr ? 'Voir téléphone Parent en direct' : 'عرض هاتف الولي مباشرة'}</span>
              </button>
            )}
          </div>

          {/* Modèles rapides en 1 clic */}
          <details className="rounded-xl border border-slate-100 bg-slate-50 p-3"><summary className="cursor-pointer text-xs font-bold text-slate-600">{isFr ? 'Utiliser un modèle (facultatif)' : 'استخدام نموذج (اختياري)'}</summary>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {(
              [
                { id: 'fermeture', fr: 'Jour férié', ar: 'عطلة / غلق' },
                { id: 'evenement', fr: 'Fête crèche', ar: 'احتفالية' },
                { id: 'rappel', fr: 'Sac & habits', ar: 'ملابس الغيار' },
                { id: 'sante', fr: 'Info santé', ar: 'وقاية صحية' },
                { id: 'info', fr: 'Message libre', ar: 'رسالة حرة' },
              ] as const
            ).map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyPreset(tpl.id)}
                className={`min-h-8! rounded-xl border px-2.5 py-1.5 text-xs font-bold transition cursor-pointer truncate ${
                  annCategory === tpl.id
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {isFr ? tpl.fr : tpl.ar}
              </button>
            ))}
          </div>

          </details>

          <form onSubmit={handleSendPush} className="space-y-3">

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                {isFr ? 'Titre de la notification *' : 'عنوان الإشعار *'}
              </label>
              <input
                type="text"
                required
                maxLength={120}
                placeholder={isFr ? 'Ex: Crèche fermée dimanche (Jour férié)' : 'مثال: غلق الروضة يوم الأحد'}
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                {isFr ? 'Message / sous-titre *' : 'الرسالة / العنوان الفرعي *'}
              </label>
              <textarea
                rows={3}
                required
                maxLength={600}
                placeholder={isFr ? 'Écrivez votre message aux familles...' : 'اكتبوا رسالتكم للأولياء...'}
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  {isFr ? 'Destinataires *' : 'الفئة المستهدفة *'}
                </label>
                <select
                  value={targetScope}
                  onChange={(e) => setTargetScope(e.target.value as 'all' | 'group' | 'child')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
                >
                  <option value="all">{isFr ? 'Tous les parents liés' : 'كل الأولياء المرتبطين'}</option>
                  <option value="group">{isFr ? 'Une section précise (Bébés / Moyens / Grands)' : 'قسم محدد'}</option>
                  <option value="child">{isFr ? 'Les parents d’un seul enfant' : 'ولي طفل محدد'}</option>
                </select>
              </div>

              {targetScope === 'group' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    {isFr ? 'Section cible' : 'القسم'}
                  </label>
                  <select
                    value={targetGroup}
                    onChange={(e) => setTargetGroup(e.target.value as 'Bébés' | 'Moyens' | 'Grands')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="Bébés">{isFr ? 'Bébés (0–2 ans)' : 'الرضع (0-2)'}</option>
                    <option value="Moyens">{isFr ? 'Moyens (2–4 ans)' : 'المتوسطون (2-4)'}</option>
                    <option value="Grands">{isFr ? 'Grands (4–6 ans)' : 'الكبار (4-6)'}</option>
                  </select>
                </div>
              )}

              {targetScope === 'child' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    {isFr ? 'Enfant concerné' : 'الطفل المعني'}
                  </label>
                  <select
                    value={targetEnfantId}
                    onChange={(e) => setTargetEnfantId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="">{isFr ? 'Choisir un enfant...' : 'اختر طفلاً...'}</option>
                    {enfants.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.prenom} {c.nom} ({c.groupeAge})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{isFr ? 'Aperçu sur le téléphone' : 'معاينة على الهاتف'}</p>
              <div className="flex items-start gap-3 rounded-xl bg-white p-3"><img src="/rawdah-logo.png" alt="" className="h-9 w-9 shrink-0 rounded-xl"/><div className="min-w-0"><p className="text-[10px] font-bold text-slate-500">{crecheNom}</p><p className="break-words text-sm font-bold text-slate-900">{annTitle.trim() || (isFr ? 'Titre de la notification' : 'عنوان الإشعار')}</p><p className="break-words text-xs text-slate-600">{annMessage.trim() || (isFr ? 'Votre message apparaîtra ici.' : 'تظهر رسالتك هنا.')}</p></div></div>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">{isFr ? 'La notification peut être visible sur l’écran verrouillé. Évitez les informations sensibles. Seuls les parents ayant activé les notifications peuvent recevoir le Push.' : 'قد يظهر الإشعار على شاشة الهاتف المقفلة. تجنبي المعلومات الحساسة. يصل الإشعار للأولياء الذين فعّلوا الإشعارات فقط.'}</p>
            {sendResult && <p role="status" className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs font-semibold leading-relaxed text-indigo-900">{sendResult}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sendingPush}
                className="min-h-10! w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-sm transition cursor-pointer disabled:opacity-60"
              >
                <Send className="h-4 w-4 shrink-0" />
                <span>
                  {sendingPush
                    ? isFr
                      ? 'Envoi en cours...'
                      : 'جارٍ الإرسال...'
                    : isFr
                    ? 'Envoyer la notification Push'
                    : 'إرسال الإشعار الفوري'}
                </span>
              </button>
            </div>
          </form>
        </section>

        {/* Historique des annonces envoyées */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
          <h3 className="text-sm font-black text-slate-900">
            {isFr ? `Historique des envois (${announcements.length})` : `سجل الإشعارات المرسلة (${announcements.length})`}
          </h3>
          {announcements.length === 0 ? (
            <p className="text-xs text-slate-500">{isFr ? 'Aucune annonce envoyée.' : 'لا توجد إشعارات مرسلة.'}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {announcements.map((a) => (
                <div key={a.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{a.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{a.message}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[11px] font-bold text-slate-500">
                    <span className="rounded-lg bg-indigo-50 text-indigo-700 px-2 py-0.5">
                      {a.targetScope === 'all'
                        ? isFr
                          ? 'Toute la crèche'
                          : 'الكل'
                        : a.targetScope === 'group'
                        ? a.targetGroup
                        : isFr
                        ? 'Individuel'
                        : 'فردي'}
                    </span>
                    <span className="tabular-nums text-slate-400">
                      {new Date(a.createdAt).toLocaleDateString(isFr ? 'fr-FR' : 'ar-DZ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // MODE 'links' : QR Code unique + Validation automatique des liaisons parents
  const filteredPickerChildren = enfants.filter((c) => {
    const q = childSearch.toLowerCase();
    return !q || `${c.prenom} ${c.nom}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Encart QR Code Unique Crèche */}
      <section className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/40 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="h-32 w-32 shrink-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xs grid place-items-center">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Espace Parent" className="h-full w-full object-contain" />
            ) : (
              <QrCode className="h-10 w-10 text-indigo-600" />
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-2.5 text-center md:text-start">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-black text-indigo-800 uppercase">
                {isFr ? '1 seul QR à afficher à l’entrée' : 'رمز QR موحد على مدخل الروضة'}
              </span>
              <h2 className="mt-1 text-sm sm:text-base font-black text-slate-900">
                {isFr ? 'QR Code Automatique — Pass Parent & Notifications Push' : 'رمز QR الذكي لربط الأولياء والإشعارات'}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {isFr
                  ? 'Le parent scanne ce QR, saisit son ou ses enfant(s), vous validez ici en 1 clic, puis son téléphone lui propose automatiquement l’icône d’écran d’accueil et les notifications Push.'
                  : 'يمسح الولي هذا الرمز، يكتب اسم طفله أو إخوته، تصادقون بنقرة واحدة، ثم يقترح هاتفه التثبيت وتفعيل الإشعارات تلقائياً.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <button
                type="button"
                onClick={() => void copyQrLink()}
                className="min-h-9! inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                {copiedQr ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
                <span>{copiedQr ? (isFr ? 'Copié !' : 'تم النسخ') : isFr ? 'Copier le lien' : 'نسخ الرابط'}</span>
              </button>

              <button
                type="button"
                onClick={downloadQrImage}
                className="min-h-9! inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span>{isFr ? 'Télécharger QR' : 'تحميل QR'}</span>
              </button>

              {onOpenInlineSimulator && (
                <button
                  type="button"
                  onClick={onOpenInlineSimulator}
                  className="min-h-9! inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition cursor-pointer"
                >
                  <Smartphone className="h-3.5 w-3.5 shrink-0" />
                  <span>{isFr ? 'Simuler téléphone Parent ici' : 'محاكاة هاتف الولي هنا'}</span>
                </button>
              )}

              <a
                href={qrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-9! inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span>{isFr ? 'Nouvel onglet' : 'علامة تبويب جديدة'}</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Demandes de liaison en attente */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-black text-slate-900">
            {isFr
              ? `Demandes de liaison en attente (${pendingRequests.length})`
              : `طلبات الربط قيد الانتظار (${pendingRequests.length})`}
          </h3>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-emerald-500" />
            {isFr ? 'Aucune demande parent en attente.' : 'لا توجد طلبات ربط معلقة حالياً.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingRequests.map((req) => {
              const selectedIds = selectedChildIdsByReq[req.id] || [];
              const isPickerOpen = pickerOpenReqId === req.id;
              const invitedChild = req.requestedChildId ? enfants.find(child => child.id === req.requestedChildId) : undefined;

              return (
                <div key={req.id} className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-slate-900">
                          {req.parentPrenom} {req.parentNom}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {req.parentLien} · {req.parentTelephone}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        {isFr ? 'Enfant(s) déclaré(s) : ' : 'الأطفال المصرح بهم: '}
                        <strong className="text-slate-900">
                          {req.requestedChildId ? (invitedChild ? `${invitedChild.prenom} ${invitedChild.nom}` : (isFr ? 'Enfant indisponible' : 'ملف الطفل غير متاح')) : req.requestedChildren.map((c) => `${c.prenom} ${c.nom}`).join(' + ')}
                        </strong>
                      </p>

                      {req.requestedChildId && <p className="text-xs text-amber-700">{isFr ? 'Invitation personnelle : vérifiez l’identité du parent avant de valider.' : 'دعوة شخصية: تحققي من هوية الولي قبل الموافقة.'}</p>}
                      {/* Badges des dossiers enfants auto-associés */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {selectedIds.map((cid) => {
                          const child = enfants.find((e) => e.id === cid);
                          if (!child) return null;
                          return (
                            <span
                              key={cid}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800"
                            >
                              <UserCheck className="h-3 w-3 shrink-0" />
                              {child.prenom} {child.nom} ({child.groupeAge})
                            </span>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            setChildSearch('');
                            setPickerOpenReqId(isPickerOpen ? null : req.id);
                          }}
                          className="min-h-7! inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                        >
                          <Plus className="h-3 w-3 shrink-0" />
                          <span>
                            {isFr ? 'Choisir / modifier enfants' : 'اختيار الأطفال'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyReqId === req.id}
                        onClick={() => void handleApprove(req)}
                        className="min-h-9! inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-black text-white transition cursor-pointer disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5 shrink-0" />
                        <span>{isFr ? 'Accepter & lier' : 'قبول وربط'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyReqId === req.id}
                        onClick={() => void handleReject(req)}
                        className="min-h-9! h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
                        title={isFr ? 'Refuser' : 'رفض'}
                        aria-label={isFr ? 'Refuser' : 'رفض'}
                      >
                        <X className="h-4 w-4 shrink-0" />
                      </button>
                    </div>
                  </div>

                  {/* Sélecteur multi-enfants déroulant */}
                  {isPickerOpen && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <div className="relative">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder={isFr ? 'Rechercher un enfant à lier...' : 'ابحث عن طفل...'}
                          value={childSearch}
                          onChange={(e) => setChildSearch(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white ps-8 pe-3 py-1.5 text-xs font-semibold outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {filteredPickerChildren.slice(0, 24).map((child) => {
                          const checked = selectedIds.includes(child.id);
                          return (
                            <label
                              key={child.id}
                              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-bold cursor-pointer ${
                                checked
                                  ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                                  : 'border-slate-200 bg-white text-slate-700'
                              }`}
                            >
                              <span className="truncate">
                                {child.prenom} {child.nom} · {child.groupeAge}
                              </span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleChildForRequest(req.id, child.id)}
                                className="accent-indigo-600"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Parents déjà connectés */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900">
            {isFr
              ? `Parents rattachés (${approvedRequests.length})`
              : `الأولياء المرتبطون (${approvedRequests.length})`}
          </h3>
        </div>

        {approvedRequests.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-500">
            {isFr ? 'Aucun parent rattaché pour le moment.' : 'لا يوجد أولياء مرتبطون بعد.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {approvedRequests.map((req) => (
              <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-900">
                    {req.parentPrenom} {req.parentNom}{' '}
                    <span className="text-slate-400 font-medium">· {req.parentTelephone}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {req.linkedEnfantIds.map((cid) => {
                      const c = enfants.find((item) => item.id === cid);
                      return (
                        <span
                          key={cid}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700"
                        >
                          {c ? `${c.prenom} ${c.nom} (${c.groupeAge})` : cid}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      req.homeScreenInstalled
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Home className="h-3 w-3 shrink-0" />
                    {req.homeScreenInstalled ? (isFr ? 'Écran accueil OK' : 'مُثبت') : isFr ? 'Web' : 'ويب'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      req.pushEnabled
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    <Smartphone className="h-3 w-3 shrink-0" />
                    {req.pushEnabled ? 'Push ON' : isFr ? 'Push en attente' : 'بانتظار التفعيل'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
