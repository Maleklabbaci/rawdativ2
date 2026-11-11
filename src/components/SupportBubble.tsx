import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Headset,
  MessageCircle,
  Search,
  X,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { LEGAL_CONFIG } from '../config/legal';

type SupportBubbleProps = {
  currentPage: string;
  onNavigate: (page: 'aide' | 'demarrage' | 'support') => void;
};

interface HelpItem {
  id: string;
  pages: string[];
  qFr: string;
  aFr: string;
  qAr: string;
  aAr: string;
}

const HELP_ITEMS: HelpItem[] = [
  {
    id: 'presences-pointage',
    pages: ['dashboard', 'presences'],
    qFr: 'Comment pointer rapidement le matin ?',
    aFr: 'Ouvrez Présences, filtrez sur « À pointer » puis appuyez sur Présent ou Absent. Utilisez « Maintenant » uniquement si l’enfant arrive à l’instant.',
    qAr: 'كيف أسجل الحضور بسرعة صباحاً؟',
    aAr: 'افتحي صفحة الحضور، اختاري فلتر « متبقي » ثم اضغطي حاضر أو غائب. استعملي زر « الآن » فقط إذا وصل الطفل في هذه اللحظة.',
  },
  {
    id: 'presences-locked',
    pages: ['presences'],
    qFr: 'Une journée est validée : comment corriger une erreur ?',
    aFr: 'Cliquez sur « Rouvrir la journée » en haut de la page Présences, effectuez la correction, puis validez à nouveau la journée.',
    qAr: 'اليوم معتمد: كيف أصحح خطأ في التسجيل؟',
    aAr: 'اضغطي على « إعادة فتح اليوم » أعلى صفحة الحضور، عدّلي التسجيل ثم اعتمدي اليوم من جديد.',
  },
  {
    id: 'enfants-retrait',
    pages: ['enfants', 'presences'],
    qFr: 'Comment autoriser et confirmer le retrait d’un enfant ?',
    aFr: 'Ouvrez le dossier de l’enfant → onglet Retrait. Vous pouvez préremplir un parent en 1 clic, mais la vérification de la pièce d’identité et la case d’attestation restent obligatoires.',
    qAr: 'كيف أوثّق استلام الطفل عند الانصراف؟',
    aAr: 'افتحي ملف الطفل ← تبويب الاستلام. يمكنك تعبئة بيانات الولي بنقرة واحدة، مع وجوب التحقق من بطاقة الهوية وتأكيد الإقرار.',
  },
  {
    id: 'enfants-qr',
    pages: ['enfants', 'admissions'],
    qFr: 'À quoi sert le QR permanent d’admission ?',
    aFr: 'Les parents scannent ce QR pour envoyer une demande d’inscription sans accéder aux données internes. Vous validez ou refusez ensuite chaque demande.',
    qAr: 'ما فائدة رمز QR الدائم للتسجيل؟',
    aAr: 'يمسح الأولياء الرمز لإرسال طلب تسجيل دون أي وصول إلى بيانات الروضة الداخلية، ثم تقبلين أو ترفضين كل طلب.',
  },
  {
    id: 'paiements-batch',
    pages: ['paiements', 'dashboard'],
    qFr: 'Comment créer toutes les factures du mois en une fois ?',
    aFr: 'Dans Factures, cliquez sur « Préparer le mois ». Les enfants ayant déjà une facture sur ce mois sont exclus automatiquement pour éviter tout doublon.',
    qAr: 'كيف أنشئ فواتير الشهر لكل الأطفال دفعة واحدة؟',
    aAr: 'في صفحة الفواتير اضغطي « تحضير فواتير الشهر ». يتم استبعاد الأطفال الذين لديهم فاتورة لنفس الشهر تلقائياً لمنع التكرار.',
  },
  {
    id: 'paiements-whatsapp',
    pages: ['paiements', 'communication'],
    qFr: 'Pourquoi le rappel WhatsApp est-il parfois suspendu ?',
    aFr: 'Par sécurité, les relances sont bloquées si une facture du dossier a une période ancienne à vérifier ou un soupçon de doublon, afin de ne jamais réclamer un montant incertain.',
    qAr: 'لماذا يتوقف زر التذكير عبر واتساب أحياناً؟',
    aAr: 'حمايةً للمصداقية، يتم تعليق التذكير إذا كانت هناك فترة قديمة تحتاج مراجعة أو اشتباه تكرار في ملف الطفل.',
  },
  {
    id: 'paiements-statut',
    pages: ['paiements', 'rapports'],
    qFr: 'Le statut « Payé » remplace-t-il un reçu comptable ?',
    aFr: 'Non. Le statut enregistré dans Rawdha+ est un repère interne de gestion et ne constitue pas une preuve bancaire ou comptable d’encaissement.',
    qAr: 'هل حالة « مدفوعة » تعتبر وصلاً محاسبياً؟',
    aAr: 'لا. الحالة المسجلة هي أداة متابعة داخلية للروضة ولا تُعد إثباتاً محاسبياً أو بنكياً للتحصيل.',
  },
  {
    id: 'repas-allergies',
    pages: ['repas', 'enfants', 'dashboard'],
    qFr: 'Comment éviter les oublis sur les allergies alimentaires ?',
    aFr: 'Renseignez les allergies dans le dossier de l’enfant. Si le champ est vide, l’application indique « non renseignées » plutôt que « aucune allergie ».',
    qAr: 'كيف أتابع الحساسية الغذائية للأطفال؟',
    aAr: 'سجّلي الحساسية داخل ملف الطفل. عند ترك الحقل فارغاً يظهر تنبيه بأنه غير مسجل بدلاً من افتراض عدم وجود حساسية.',
  },
  {
    id: 'achats-reglement',
    pages: ['achats'],
    qFr: 'Pourquoi le moyen de paiement est-il demandé sur un achat payé ?',
    aFr: 'Lorsqu’une dépense est marquée « Payé », le mode de règlement (espèces, virement, chèque, carte) est requis pour garder un suivi clair des sorties.',
    qAr: 'لماذا يُطلب تحديد وسيلة الدفع عند تسجيل مصروف مدفوع؟',
    aAr: 'عند اختيار حالة « مدفوع » يلزم تحديد وسيلة الدفع لضمان دقة متابعة المصاريف دون افتراض الدفع نقداً.',
  },
];

const PAGE_LABELS: Record<string, { fr: string; ar: string }> = {
  dashboard: { fr: 'Accueil', ar: 'الرئيسية' },
  presences: { fr: 'Présences', ar: 'الحضور' },
  enfants: { fr: 'Enfants', ar: 'الأطفال' },
  paiements: { fr: 'Factures', ar: 'الفواتير' },
  achats: { fr: 'Achats', ar: 'المشتريات' },
  repas: { fr: 'Repas', ar: 'الوجبات' },
  classes: { fr: 'Classes', ar: 'الأقسام' },
  admissions: { fr: 'Admissions', ar: 'التسجيلات' },
  parametres: { fr: 'Paramètres', ar: 'الإعدادات' },
};

export default function SupportBubble({ currentPage, onNavigate }: SupportBubbleProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const sortedItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = HELP_ITEMS.filter(item => {
      if (!term) return true;
      const haystack = `${item.qFr} ${item.aFr} ${item.qAr} ${item.aAr}`.toLowerCase();
      return haystack.includes(term);
    });
    return [...filtered].sort((a, b) => {
      const aMatch = a.pages.includes(currentPage) ? 0 : 1;
      const bMatch = b.pages.includes(currentPage) ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [currentPage, query]);

  const choose = (page: 'aide' | 'demarrage' | 'support') => {
    setOpen(false);
    onNavigate(page);
  };

  const pageTitle = PAGE_LABELS[currentPage]
    ? isArabic
      ? PAGE_LABELS[currentPage].ar
      : PAGE_LABELS[currentPage].fr
    : 'Rawdha+';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setQuery('');
          setExpandedId(sortedItems[0]?.id ?? null);
          setOpen(true);
        }}
        aria-expanded={open}
        aria-label={isArabic ? 'فتح مساعد Rawdha+' : 'Ouvrir l’assistant Rawdha+'}
        title={isArabic ? 'مساعدة سريعة' : 'Aide contextuelle'}
        className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50/90 text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-700 active:scale-95 cursor-pointer"
      >
        <CircleHelp className="h-4 w-4" />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            dir={isArabic ? 'rtl' : 'ltr'}
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end"
            role="dialog"
            aria-modal="true"
            aria-label={isArabic ? 'مساعدة الصفحة' : 'Aide contextuelle'}
          >
            <div
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-slate-950/35 backdrop-blur-xs"
            />
            <section className="relative z-10 flex max-h-[86dvh] sm:max-h-none sm:h-full w-full sm:max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-none border-t sm:border-t-0 sm:border-s border-slate-200 bg-white shadow-2xl">
              {/* Header sobre */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <h2 className="truncate text-sm sm:text-base font-extrabold text-slate-900">
                    {isArabic ? `مساعدة · ${pageTitle}` : `Aide · ${pageTitle}`}
                  </h2>
                  <p className="truncate text-xs text-slate-500">
                    {isArabic ? 'إجابات مختصرة أو تواصل مباشر مع الدعم' : 'Réponses courtes ou contact humain direct'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={isArabic ? 'إغلاق المساعد' : 'Fermer l’assistant'}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Recherche d'aide */}
              <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={
                      isArabic ? 'ابحثي عن سؤال (حضور، فاتورة، استلام…)' : 'Chercher une question (présence, facture, retrait…)'
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 ps-9 pe-3 text-xs font-medium text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Questions fréquentes adaptées à l'écran */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 space-y-2">
                {sortedItems.length > 0 ? (
                  sortedItems.map(item => {
                    const isExpanded = expandedId === item.id;
                    const isContextual = item.pages.includes(currentPage);
                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border transition ${
                          isExpanded ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200/80 bg-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          aria-expanded={isExpanded}
                          className="flex w-full items-center justify-between gap-2.5 p-3 text-start cursor-pointer"
                        >
                          <div className="min-w-0">
                            {isContextual && (
                              <span className="mb-1 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                {isArabic ? 'مرتبط بهذه الصفحة' : 'Sur cet écran'}
                              </span>
                            )}
                            <p className="text-xs font-bold text-slate-900 leading-snug">
                              {isArabic ? item.qAr : item.qFr}
                            </p>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                              isExpanded ? 'rotate-180 text-indigo-600' : ''
                            }`}
                          />
                        </button>
                        {isExpanded && (
                          <p className="border-t border-slate-100 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
                            {isArabic ? item.aAr : item.aFr}
                          </p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="py-6 text-center text-xs font-medium text-slate-400">
                    {isArabic ? 'لا يوجد سؤال مطابق. يمكنك مراسلة الدعم مباشرة أدناه.' : 'Aucune réponse directe trouvée. Contactez-nous ci-dessous.'}
                  </p>
                )}
              </div>

              {/* Liens directs et support humain */}
              <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:px-5 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => choose('aide')}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate">{isArabic ? 'الدليل السريع' : 'Guide rapide'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => choose('demarrage')}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                  >
                    <ClipboardList className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{isArabic ? 'إعداد البداية' : 'Configuration'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => choose('support')}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-700 cursor-pointer"
                  >
                    <Headset className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{isArabic ? 'الدعم' : 'Support'}</span>
                  </button>
                  <a
                    href={`https://wa.me/${LEGAL_CONFIG.whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span className="truncate">WhatsApp</span>
                  </a>
                </div>
              </div>
            </section>
          </div>,
          document.body
        )}
    </>
  );
}
