import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cookie,
  Copy,
  CreditCard,
  FileText,
  MessageCircle,
  Scale,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  buildLegalHref,
  buildOfficialWhatsappHref,
  LEGAL_CONFIG,
  resolveInitialLegalTab,
  type LegalTab,
} from '../config/legal';

type RequesterRole = 'directeur' | 'parent';
type RequestAction = 'suppression' | 'resiliation';

export default function PrivacyPolicy() {
  const { language, setLanguage } = useLanguage();
  const isAr = language === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const [activeTab, setActiveTab] = useState<LegalTab>(() =>
    typeof window !== 'undefined'
      ? resolveInitialLegalTab(window.location.pathname, window.location.search)
      : 'confidentialite'
  );

  // État du formulaire de demande de suppression / résiliation (#18 & #20)
  const [requesterRole, setRequesterRole] = useState<RequesterRole>('directeur');
  const [requestAction, setRequestAction] = useState<RequestAction>('suppression');
  const [fullName, setFullName] = useState('');
  const [contactValue, setContactValue] = useState('');
  const [crecheName, setCrecheName] = useState('');
  const [details, setDetails] = useState('');
  const [copiedRequest, setCopiedRequest] = useState(false);
  const [cookieResetDone, setCookieResetDone] = useState(false);

  useEffect(() => {
    const syncFromUrl = () => {
      setActiveTab(resolveInitialLegalTab(window.location.pathname, window.location.search));
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const selectTab = (tab: LegalTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const nextHref = buildLegalHref(tab);
      if (`${window.location.pathname}${window.location.search}` !== nextHref) {
        window.history.replaceState({}, '', nextHref);
      }
    }
  };

  const tabs: { id: LegalTab; labelFr: string; labelAr: string; icon: React.ReactNode }[] = [
    {
      id: 'confidentialite',
      labelFr: 'Confidentialité',
      labelAr: 'الخصوصية',
      icon: <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'cgu',
      labelFr: 'Conditions (CGU)',
      labelAr: 'شروط الاستخدام',
      icon: <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'remboursement',
      labelFr: 'Abonnement & remboursement',
      labelAr: 'الاشتراك والاسترجاع',
      icon: <CreditCard className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'cookies',
      labelFr: 'Cookies, SDK & mentions',
      labelAr: 'ملفات الارتباط والبيانات القانونية',
      icon: <Cookie className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'suppression',
      labelFr: 'Suppression & résiliation',
      labelAr: 'حذف البيانات وإلغاء الاشتراك',
      icon: <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
  ];

  const preparedRequestText = isAr
    ? [
        requestAction === 'suppression'
          ? 'طلب رسمي لحذف الحساب والبيانات الشخصية — Rawdha+'
          : 'طلب رسمي لعدم تجديد / إلغاء الاشتراك — Rawdha+',
        `الصفة: ${requesterRole === 'directeur' ? 'مديرة روضة' : 'ولي أمر / وصي قانوني'}`,
        `الاسم الكامل: ${fullName.trim() || '—'}`,
        `البريد أو الهاتف: ${contactValue.trim() || '—'}`,
        `اسم الروضة: ${crecheName.trim() || '—'}`,
        details.trim() ? `تفاصيل إضافية: ${details.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : [
        requestAction === 'suppression'
          ? 'Demande officielle de suppression de compte et de données — Rawdha+'
          : 'Demande officielle de résiliation / non-renouvellement — Rawdha+',
        `Profil : ${requesterRole === 'directeur' ? 'Directrice de crèche' : 'Parent / représentant légal'}`,
        `Nom complet : ${fullName.trim() || '—'}`,
        `E-mail ou téléphone : ${contactValue.trim() || '—'}`,
        `Établissement : ${crecheName.trim() || '—'}`,
        details.trim() ? `Précisions : ${details.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n');

  const canSendRequest = Boolean(fullName.trim() && contactValue.trim() && crecheName.trim());

  const handleCopyPreparedRequest = async () => {
    if (!canSendRequest) return;
    try {
      await navigator.clipboard.writeText(preparedRequestText);
      setCopiedRequest(true);
      window.setTimeout(() => setCopiedRequest(false), 3000);
    } catch {
      setCopiedRequest(false);
    }
  };

  const handleResetCookieBanner = () => {
    try {
      window.localStorage.removeItem(LEGAL_CONFIG.cookieNoticeStorageKey);
      setCookieResetDone(true);
      window.setTimeout(() => setCookieResetDone(false), 3000);
    } catch {
      setCookieResetDone(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#f8fafc] text-slate-900" dir={isAr ? 'rtl' : 'ltr'}>
      <a href="#main-content" className="rawdha-skip-link">
        {isAr ? 'الانتقال إلى المحتوى الرئيسي' : 'Aller au contenu principal'}
      </a>

      {/* Barre supérieure sobre */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src="/rawdah-logo.png"
              alt={isAr ? 'شعار روضة+' : 'Logo Rawdha+'}
              className="h-9 w-9 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-0.5"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">RAWDHA+</p>
              <h1 className="truncate text-sm font-extrabold text-slate-900 sm:text-lg">
                {isAr ? 'المركز القانوني وحماية البيانات' : 'Centre légal & protection des données'}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div
              className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-0.5"
              role="group"
              aria-label={isAr ? 'اختيار اللغة' : 'Choisir la langue'}
            >
              <button
                type="button"
                onClick={() => setLanguage('fr')}
                aria-pressed={!isAr}
                className={`min-h-0 rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                  !isAr ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ar')}
                aria-pressed={isAr}
                className={`min-h-0 rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                  isAr ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                عربي
              </button>
            </div>

            <a
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:px-3.5"
            >
              <BackIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{isAr ? 'العودة إلى الرئيسية' : 'Retour à l’accueil'}</span>
              <span className="sm:hidden">{isAr ? 'الرئيسية' : 'Accueil'}</span>
            </a>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-3 py-6 outline-none sm:px-6 sm:py-9">
        {/* Bandeau de référence légale */}
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-600 shadow-2xs sm:text-sm">
          <Scale className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" aria-hidden="true" />
          <div>
            <p className="font-bold text-slate-900">
              {isAr
                ? 'شفافية كاملة وحماية للبيانات وفق التشريع الجزائري'
                : 'Transparence complète & conformité à la réglementation algérienne'}
            </p>
            <p className="mt-0.5">
              {isAr
                ? `${LEGAL_CONFIG.applicableLawAr}. آخر تحديث: ${LEGAL_CONFIG.lastUpdatedAr}.`
                : `${LEGAL_CONFIG.applicableLawFr}. Dernière mise à jour : ${LEGAL_CONFIG.lastUpdatedFr}.`}
            </p>
          </div>
        </div>

        {/* Navigation par onglets accessible au clavier et sans débordement mobile */}
        <nav
          aria-label={isAr ? 'الأقسام القانونية' : 'Rubriques légales'}
          className="mb-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
        >
          {tabs.map(tab => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                aria-current={selected ? 'page' : undefined}
                className={`inline-flex min-w-0 items-center justify-center sm:justify-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition cursor-pointer sm:text-sm ${
                  selected
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span className="truncate">{isAr ? tab.labelAr : tab.labelFr}</span>
              </button>
            );
          })}
        </nav>

        {/* Contenu de l’onglet sélectionné */}
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-8">
          {activeTab === 'confidentialite' && (
            <div className="space-y-6 text-sm leading-7 text-slate-700">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">
                  {isAr ? 'سياسة الخصوصية وحماية البيانات الشخصية' : 'Politique de confidentialité et protection des données'}
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {isAr
                    ? 'تنطبق هذه السياسة على فضاء مديرات الروضات وروابط التسجيل الموجهة للأولياء.'
                    : 'Applicable à l’espace de gestion des Directrices et aux formulaires publics de pré-inscription destinés aux familles.'}
                </p>
              </div>

              <LegalSection title={isAr ? '1. المسؤولون عن معالجة البيانات' : '1. Responsables du traitement'}>
                {isAr
                  ? 'بالنسبة لملفات الأطفال والأولياء والموظفين داخل كل مؤسسة: تُعد إدارة الروضة المعنية هي المسؤولة عن المعالجة، وتتصرف Rawdha+ بصفتها مزوداً تقنياً يوفر عزلاً صارماً للبيانات بين كل روضة وأخرى. أما بالنسبة لحسابات المديرات وطلبات الانضمام إلى المنصة، فتتولى Rawdha+ معالجتها لتفعيل الخدمة وتأمينها.'
                  : 'Pour les dossiers des enfants, des familles et du personnel d’un établissement : la crèche concernée est responsable du traitement, et Rawdha+ intervient comme sous-traitant technique assurant l’isolation stricte des données entre établissements. Pour les comptes Directrices et demandes d’accès à la plateforme, Rawdha+ est responsable du traitement nécessaire à l’ouverture et à la sécurisation du compte.'}
              </LegalSection>

              <LegalSection title={isAr ? '2. تقليل البيانات المجموعة (الضرورية فقط)' : '2. Minimisation des données (zéro collecte inutile)'}>
                {isAr
                  ? 'لا نطلب إلا المعلومات الضرورية لتسيير الروضة واستقبال الطفل بأمان: الهوية، تاريخ الميلاد، بيانات الاتصال بالولي الشرعي، الأشخاص المخولين بالاستلام، والملاحظات الصحية أو الغذائية اللازمة لرعاية الطفل (كالحساسيات)، إضافة إلى الفواتير وسجل الحضور. الحقول الاختيارية مشار إليها بوضوح.'
                  : 'Seules les données strictement nécessaires à l’accueil sécurisé de l’enfant et à la gestion de l’établissement sont demandées : identité, date de naissance, coordonnées du représentant légal, personnes autorisées à la sortie, informations de santé ou d’allergies indispensables à la prise en charge, présences et suivi de facturation. Les champs facultatifs sont explicitement indiqués.'}
              </LegalSection>

              <LegalSection title={isAr ? '3. حماية بيانات القُصّر وسلطة الولي الشرعي' : '3. Données des enfants mineurs & autorité parentale'}>
                {isAr
                  ? 'يُشترط في كل طلب تسجيل عبر الرابط العام أن يصدر حصرياً عن شخص بالغ يتصرف بصفته الأب أو الأم أو الوصي القانوني المخول للطفل، مع إقرار صريح بذلك قبل الإرسال. يُمنع إرسال بيانات طفل دون صفة قانونية. ولا يؤدي إرسال النموذج إلى قبول آلي دون مراجعة إدارة الروضة.'
                  : 'Toute soumission d’un dossier d’enfant via un lien d’admission est strictement réservée à une personne majeure agissant en qualité de parent ou de tuteur légal habilité, avec attestation explicite obligatoire avant l’envoi. Aucun enfant n’est inscrit de manière automatisée sans validation humaine de la direction de la crèche.'}
              </LegalSection>

              <LegalSection title={isAr ? '4. الأمان وعزل قواعد البيانات والمعالجة المحلية للوثائق' : '4. Sécurité, cloisonnement et traitement local des documents PDF'}>
                {isAr
                  ? 'تُحمى كلمات المرور عبر التشفير القياسي، وتُطبق قواعد عزل على مستوى الصفوف (Row-Level Security) بحيث لا يمكن لأي روضة الاطلاع على بيانات روضة أخرى. كما أن مسح وثائق الأطفال وتحويلها إلى PDF ومعاينتها مباشرة داخل المنصة (عبر المكتبتين المفتوحتين pdf-lib وMozilla PDF.js) يتم محلياً 100% داخل متصفحكم دون إرسال أي صورة أو شهادة طبية إلى خادم تحويل خارجي.'
                  : 'Les mots de passe sont hachés de manière sécurisée et ne sont jamais visibles par l’administration. Rawdha+ applique un cloisonnement strict par établissement (Row-Level Security PostgreSQL) empêchant toute lecture croisée entre crèches. En outre, la conversion Photo → PDF et la lecture directe des pièces enfants dans l’application (moteurs open-source pdf-lib sous licence MIT et Mozilla PDF.js sous licence Apache-2.0) s’exécutent à 100 % localement dans votre navigateur : aucun certificat médical ni carnet de vaccination n’est transmis à un serveur tiers de conversion.'}
              </LegalSection>

              <LegalSection title={isAr ? '5. مدة الاحتفاظ وحقوقكم القانونية (القانون 18-07)' : '5. Conservation et exercice de vos droits (Loi 18-07)'}>
                {isAr
                  ? 'تُحفظ البيانات طوال فترة تفعيل الحساب أو قيد الطفل بالروضة، مع مراعاة التزامات الحفظ المحاسبي القانونية. يحق لكم طلب الاطلاع على بياناتكم أو تصحيحها أو الاعتراض عليها أو حذفها عبر قسم «حذف البيانات وإلغاء الاشتراك» في هذه الصفحة أو بالتواصل مع إدارة الروضة بالنسبة لملفات الأطفال.'
                  : 'Les données sont conservées pendant la durée d’activité du compte ou de scolarisation de l’enfant, sous réserve des obligations légales de conservation comptable. Conformément à la Loi n° 18-07, vous disposez d’un droit d’accès, de rectification, d’opposition et de suppression exerçable depuis l’onglet « Suppression & résiliation » ou directement auprès de la crèche concernée pour un dossier enfant.'}
              </LegalSection>
            </div>
          )}

          {activeTab === 'cgu' && (
            <div className="space-y-6 text-sm leading-7 text-slate-700">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">
                  {isAr ? 'الشروط العامة لاستخدام منصة Rawdha+' : 'Conditions générales d’utilisation (CGU)'}
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {isAr
                    ? 'القواعد المنظمة لاستخدام المنصة من طرف دور الحضانة والمستخدمين المصرح لهم.'
                    : 'Règles encadrant l’accès et l’utilisation professionnelle de la plateforme Rawdha+.'}
                </p>
              </div>

              <LegalSection title={isAr ? '1. موضوع الخدمة' : '1. Objet du service'}>
                {isAr
                  ? 'توفر Rawdha+ برنامجاً سحابياً لتسيير دور الحضانة ورياض الأطفال (متابعة الأطفال، الحضور، الأقسام، الوجبات، الأنشطة، الفوترة، والتواصل المهني عبر Rawdha Connect).'
                  : 'Rawdha+ met à disposition des crèches et établissements préscolaires une application de gestion quotidienne couvrant les dossiers enfants, les présences, les classes, les repas, les activités, la facturation et l’espace d’échange professionnel Rawdha Connect.'}
              </LegalSection>

              <LegalSection title={isAr ? '2. فتح الحساب والتحقق اليدوي' : '2. Ouverture de compte et validation préalable'}>
                {isAr
                  ? 'حمايةً للمؤسسات والأسر، يخضع كل طلب فتح حساب مديرة لمراجعة يدوية قبل التفعيل. تلتزم المديرة بتقديم معلومات صحيحة حول المؤسسة والحفاظ على سرية بيانات الدخول الخاصة بها.'
                  : 'Pour protéger les établissements et les familles, chaque demande d’accès Directrice fait l’objet d’une vérification avant activation. La Directrice s’engage à fournir des informations exactes sur son établissement et à préserver la confidentialité de ses identifiants.'}
              </LegalSection>

              <LegalSection title={isAr ? '3. شفافية الأسعار (صفر رسوم خفية)' : '3. Transparence tarifaire — zéro frais caché'}>
                {isAr
                  ? `تستفيد كل روضة جديدة من تجربة مجانية لمدة ${LEGAL_CONFIG.trialDays} يوماً دون بطاقة بنكية ودون التزام. بعد انتهاء التجربة، يبلغ سعر الاشتراك الشهري الشامل ${LEGAL_CONFIG.monthlyPlanPriceDzd} د.ج / شهر دون أي رسوم خفية للتثبيت أو الإلغاء، ودون أي اقتطاع بنكي تلقائي مفاجئ.`
                  : `Chaque nouvelle crèche bénéficie d’un essai gratuit de ${LEGAL_CONFIG.trialDays} jours sans carte bancaire ni engagement. Au-delà de l’essai, le plan complet s’élève à ${LEGAL_CONFIG.monthlyPlanPriceDzd.toLocaleString('fr-FR')} DA / mois tout compris : zéro frais d’ouverture, zéro frais caché et aucun prélèvement bancaire automatique imposé.`}
              </LegalSection>

              <LegalSection title={isAr ? '4. التزامات النزاهة والوضوح' : '4. Engagements d’intégrité (zéro pratique trompeuse)'}>
                {isAr
                  ? 'تلتزم Rawdha+ بعدم استخدام أي أنماط مضللة (Dark Patterns)، وبعدم نشر أي تقييمات وهمية، وبتوضيح المزايا قيد الإعداد بشفافية تامة (مثل تطبيقات المتاجر أو التنبيهات الآلية غير المفعلة).'
                  : 'Rawdha+ s’interdit tout dark pattern (aucune case pré-cochée en cachette, aucun obstacle à la résiliation), ne publie aucun faux avis client et signale honnêtement les fonctionnalités non encore actives (« Prochainement » ou « Non disponible »).'}
              </LegalSection>

              <LegalSection title={isAr ? '5. القانون الواجب التطبيق' : '5. Responsabilités et droit applicable'}>
                {isAr
                  ? 'تظل كل روضة مسؤولة عن صحة البيانات التي تدخلها وعن الحصول على الأذونات القانونية من أولياء الأمور. تخضع هذه الشروط للقانون الجزائري.'
                  : 'Chaque crèche demeure responsable de l’exactitude des dossiers saisis dans son espace et du recueil des autorisations parentales réglementaires. Les présentes conditions sont régies par le droit algérien.'}
              </LegalSection>
            </div>
          )}

          {activeTab === 'remboursement' && (
            <div className="space-y-6 text-sm leading-7 text-slate-700">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">
                  {isAr ? 'سياسة التجربة والاشتراك والاسترجاع' : 'Politique d’essai, d’abonnement et de remboursement'}
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {isAr
                    ? 'شروط واضحة للتجربة المجانية، إيقاف التجديد، واسترجاع المبالغ.'
                    : 'Conditions claires d’essai gratuit, d’arrêt d’abonnement et de remboursement.'}
                </p>
              </div>

              <LegalSection title={isAr ? '1. تجربة مجانية لمدة 15 يوماً دون التزام' : '1. Essai gratuit de 15 jours sans engagement'}>
                {isAr
                  ? `يمكنكم تجربة جميع وظائف المنصة مجاناً لمدة ${LEGAL_CONFIG.trialDays} يوماً دون دفع أي مبلغ مسبق. عند انتهاء الفترة التجريبية، يتوقف الحساب مؤقتاً مع حفظ بياناتكم بأمان إلى غاية اختياركم تفعيل الاشتراك أو طلب حذف الحساب.`
                  : `Vous testez l’intégralité des fonctionnalités gratuitement pendant ${LEGAL_CONFIG.trialDays} jours, sans avance de frais. À la fin de l’essai, si vous choisissez de ne pas souscrire, aucun montant ne vous est facturé ; vous pouvez demander à tout moment la suppression complète de votre compte.`}
              </LegalSection>

              <LegalSection title={isAr ? '2. إلغاء الاشتراك وعدم التجديد في أي وقت' : '2. Résiliation libre et arrêt du renouvellement'}>
                {isAr
                  ? 'لا يوجد أي عقد التزام طويل الأمد مفروض. يمكن للمديرة إيقاف تجديد اشتراكها الشهري في أي وقت بضغطة زر من صفحة «الدعم» داخل التطبيق أو من تبويب «حذف البيانات وإلغاء الاشتراك» دون أي غرامة، ويبقى الحساب متاحاً حتى نهاية الشهر المدفوع.'
                  : 'Aucun engagement de durée minimale n’est imposé. La Directrice peut demander l’arrêt du renouvellement mensuel à tout moment et sans frais depuis la page « Support » de l’application ou via l’onglet « Suppression & résiliation ». L’accès reste acquis jusqu’au terme de la période déjà réglée.'}
              </LegalSection>

              <LegalSection title={isAr ? '3. حالات وشروط الاسترجاع المالي' : '3. Conditions de remboursement'}>
                {isAr
                  ? 'يحق للمؤسسة طلب استرجاع كامل للمبلغ المدفوع (أو تمديد معادل حسب اختيارها) في الحالات التالية: (أ) حدوث دفع مزدوج أو خطأ في المبلغ المفوتر، (ب) تعذر تقني جوهري يعود للمنصة يمنع استخدام الحساب خلال 7 أيام من تاريخ التفعيل أو التجديد دون التمكن من حله. تُعالج طلبات الاسترجاع خلال 7 أيام عمل كحد أقصى.'
                  : 'Un remboursement intégral (ou un avoir équivalent au choix de l’établissement) est accordé : (a) en cas de double règlement ou d’erreur sur le montant facturé ; (b) en cas de dysfonctionnement technique majeur imputable à Rawdha+ empêchant l’accès normal au service signalé dans les 7 jours suivant l’activation ou le renouvellement payé. Toute demande est traitée dans un délai maximal de 7 jours ouvrés.'}
              </LegalSection>
            </div>
          )}

          {activeTab === 'cookies' && (
            <div className="space-y-6 text-sm leading-7 text-slate-700">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">
                  {isAr
                    ? 'ملفات الارتباط، الخدمات التقنية، التراخيص والبيانات القانونية'
                    : 'Politique de cookies, SDK tiers, licences & mentions légales'}
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {isAr
                    ? 'جرد تقني شفاف للتخزين المحلي والمكتبات المعتمدة وبيانات الناشر.'
                    : 'Inventaire transparent du stockage navigateur, des services tiers, des licences et des coordonnées.'}
                </p>
              </div>

              <LegalSection title={isAr ? '1. سياسة ملفات الارتباط والتخزين المحلي (الضرورية فقط)' : '1. Cookies et stockage local strictement nécessaires'}>
                <p>
                  {isAr
                    ? 'لا تستخدم Rawdha+ أي ملفات ارتباط إعلانية أو أدوات تتبع تجارية لبيع البيانات. يقتصر التخزين المحلي في متصفحكم على العناصر التقنية الضرورية التالية:'
                    : 'Rawdha+ n’utilise aucun cookie publicitaire, aucun pixel de reciblage et aucun traqueur commercial. Seuls les éléments techniques suivants sont enregistrés localement sur votre appareil :'}
                </p>
                <ul className="mt-2.5 list-disc space-y-1.5 ps-5 text-xs sm:text-sm">
                  <li>
                    <strong>Supabase Auth (`sb-*-auth-token`)</strong> :{' '}
                    {isAr
                      ? 'حفظ جلسة الدخول الآمنة حتى لا تضطروا لإعادة الاتصال عند كل تحديث للصفحة.'
                      : 'maintien sécurisé de votre session authentifiée jusqu’à votre déconnexion.'}
                  </li>
                  <li>
                    <strong>`rawdha_language` / `rawdha_language_selected`</strong> :{' '}
                    {isAr
                      ? 'تذكر لغة الواجهة المختارة (العربية أو الفرنسية).'
                      : 'mémorisation de la langue d’affichage choisie (français ou arabe).'}
                  </li>
                  <li>
                    <strong>`rawdha_cookie_notice_v1`</strong> :{' '}
                    {isAr
                      ? 'حفظ إغلاق شريط إشعار ملفات الارتباط.'
                      : 'mémorisation de la prise de connaissance du bandeau d’information.'}
                  </li>
                  <li>
                    <strong>`rawdha_chunk_reload_once` (`sessionStorage`)</strong> :{' '}
                    {isAr
                      ? 'حماية تقنية لتحديث التطبيق تلقائياً عند نشر نسخة جديدة.'
                      : 'sécurité technique évitant un écran figé après une mise à jour de version.'}
                  </li>
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleResetCookieBanner}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 cursor-pointer"
                  >
                    {isAr ? 'إعادة إظهار شريط ملفات الارتباط' : 'Réafficher le bandeau cookies'}
                  </button>
                  {cookieResetDone && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      {isAr ? 'تمت إعادة التعيين.' : 'Préférence réinitialisée.'}
                    </span>
                  )}
                </div>
              </LegalSection>

              <LegalSection title={isAr ? '2. مراجعة حزم البرمجيات والخدمات الخارجية (SDK Audit)' : '2. Audit des SDK et services techniques tiers'}>
                {isAr
                  ? 'تعتمد المنصة حصرياً على خدمات تقنية موثوقة وضرورية للتشغيل: Supabase (قاعدة البيانات والمصادقة المشفرة)، Capacitor (تنبيهات النظام على أندرويد بعد تسجيل الدخول فقط)، وGoogle Fonts لتحميل الخطوط. لا يتم تضمين أي SDK للإعلانات أو التحليل السلوكي الخفي.'
                  : 'L’application s’appuie uniquement sur des briques techniques vérifiées : Supabase (authentification et base de données isolée), Capacitor (notifications natives Android activées uniquement après connexion d’un utilisateur) et Google Fonts (chargement des polices). Aucun SDK publicitaire ou de profilage comportemental n’est embarqué.'}
              </LegalSection>

              <LegalSection title={isAr ? '3. تراخيص الخطوط والأيقونات والوسائط' : '3. Licences des polices, icônes et visuels'}>
                {isAr
                  ? 'الخطوط المعتمدة (Plus Jakarta Sans وOutfit وAlexandria وJetBrains Mono) مرخصة بموجب رخصة الخطوط المفتوحة SIL Open Font License 1.1. الأيقونات مقدمة من مكتبة Lucide (رخصة ISC/MIT) ومعالجة ملفات PDF تتم محلياً داخل المتصفح عبر مكتبة pdf-lib المفتوحة المصدر (رخصة MIT). الصور التوضيحية في الواجهة مستخدمة بترخيص، وتبقى شعارات الروضات وصور الأطفال ملكاً خالصاً للمؤسسات والأولياء.'
                  : 'Les polices Plus Jakarta Sans, Outfit, Alexandria et JetBrains Mono sont utilisées sous licence libre SIL Open Font License 1.1. Les icônes proviennent de Lucide Icons (licence ISC / MIT) et la conversion locale des photos de pièces en PDF repose sur pdf-lib (licence MIT, exécutée intégralement dans le navigateur). Les photographies d’illustration de la vitrine sont exploitées sous licence autorisée ; les logos d’établissements et pièces confiées demeurent la propriété exclusive des crèches et familles.'}
              </LegalSection>

              <LegalSection title={isAr ? '4. البيانات القانونية ووسائل الاتصال الرسمية' : '4. Mentions de l’éditeur & contact officiel'}>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-700 sm:text-sm">
                  <p>
                    <strong>{isAr ? 'الخدمة:' : 'Service :'}</strong> {LEGAL_CONFIG.brandName} —{' '}
                    {isAr
                      ? 'منصة برمجية لتسيير دور الحضانة والمؤسسات التربوية التحضيرية'
                      : 'Plateforme logicielle de gestion pour crèches et établissements préscolaires'}
                  </p>
                  <p>
                    <strong>{isAr ? 'البلد والاختصاص القانوني:' : 'Pays & juridiction :'}</strong>{' '}
                    {isAr ? LEGAL_CONFIG.countryAr : LEGAL_CONFIG.countryFr}
                  </p>
                  {LEGAL_CONFIG.registrationReference && (
                    <p>
                      <strong>{isAr ? 'المرجع القانوني:' : 'Référence légale :'}</strong>{' '}
                      {LEGAL_CONFIG.registrationReference}
                    </p>
                  )}
                  <p>
                    <strong>{isAr ? 'الهاتف وواتساب الرسمي:' : 'Téléphone & WhatsApp officiel :'}</strong>{' '}
                    <span dir="ltr">{LEGAL_CONFIG.whatsappDisplay}</span>
                  </p>
                  <p>
                    <strong>{isAr ? 'قناة الدعم المباشر:' : 'Canal d’assistance :'}</strong>{' '}
                    {LEGAL_CONFIG.officialEmail ? (
                      <a href={`mailto:${LEGAL_CONFIG.officialEmail}`} className="font-bold text-indigo-700 underline">
                        {LEGAL_CONFIG.officialEmail}
                      </a>
                    ) : isAr ? (
                      'عبر وحدة «الدعم» المدمجة داخل الحساب أو عبر واتساب الرسمي أعلاه.'
                    ) : (
                      'Via le module « Support » intégré à votre espace Rawdha+ ou le numéro WhatsApp officiel ci-dessus.'
                    )}
                  </p>
                </div>
              </LegalSection>
            </div>
          )}

          {activeTab === 'suppression' && (
            <div className="space-y-6 text-sm leading-7 text-slate-700">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">
                  {isAr ? 'طلب حذف البيانات أو إلغاء تجديد الاشتراك' : 'Demande de suppression des données ou de résiliation'}
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {isAr
                    ? 'مسار رسمي مباشر متاح مع أو بدون تسجيل الدخول (متوافق مع القانون 18-07 ومتطلبات Google Play).'
                    : 'Parcours officiel accessible avec ou sans connexion (conforme Loi 18-07 et exigences Google Play Data Safety).'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600 sm:text-sm">
                <p className="font-bold text-slate-900">
                  {isAr ? 'كيف تتم معالجة طلبكم؟' : 'Comment votre demande est-elle traitée ?'}
                </p>
                <ul className="mt-1.5 list-disc space-y-1 ps-5">
                  <li>
                    {isAr
                      ? 'حساب مديرة روضة: يتم إيقاف تجديد الاشتراك أو حذف الحساب وجميع بيانات الفضاء بعد التحقق من هوية صاحبة الحساب خلال مدة أقصاها 15 يوم عمل.'
                      : 'Compte Directrice : l’arrêt du renouvellement ou la suppression complète du compte et des données de l’espace crèche est effectué après vérification d’identité sous 15 jours ouvrés maximum.'}
                  </li>
                  <li>
                    {isAr
                      ? 'ملف طفل مرسل من ولي أمر: بما أن الروضة هي المسؤولة القانونية عن ملفات أطفالها، يمكنكم توجيه الطلب مباشرة لإدارة الروضة المعنية أو إبلاغنا لتحويله إليها.'
                      : 'Dossier d’admission parent : la crèche étant responsable des dossiers de ses élèves, vous pouvez transmettre cette demande à la direction de la crèche concernée ou à notre support pour relais.'}
                  </li>
                </ul>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    {isAr ? 'نوع الطلب *' : 'Nature de la demande *'}
                  </label>
                  <select
                    value={requestAction}
                    onChange={e => setRequestAction(e.target.value as RequestAction)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="suppression">
                      {isAr ? 'حذف الحساب والبيانات الشخصية' : 'Suppression du compte et des données'}
                    </option>
                    <option value="resiliation">
                      {isAr ? 'إلغاء الاشتراك / عدم التجديد الشهري' : 'Résiliation / Non-renouvellement d’abonnement'}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    {isAr ? 'صفتكم *' : 'Votre profil *'}
                  </label>
                  <select
                    value={requesterRole}
                    onChange={e => setRequesterRole(e.target.value as RequesterRole)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="directeur">
                      {isAr ? 'مديرة روضة (حساب Rawdha+)' : 'Directrice de crèche (compte Rawdha+)'}
                    </option>
                    <option value="parent">
                      {isAr ? 'ولي أمر / وصي قانوني (ملف تسجيل)' : 'Parent / tuteur légal (dossier enfant)'}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    {isAr ? 'الاسم واللقب *' : 'Nom et prénom *'}
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder={isAr ? 'الاسم الكامل' : 'Ex. : Nadia Benaissa'}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    {isAr ? 'البريد الإلكتروني أو الهاتف المرتبط بالحساب *' : 'E-mail ou téléphone associé *'}
                  </label>
                  <input
                    type="text"
                    value={contactValue}
                    onChange={e => setContactValue(e.target.value)}
                    placeholder={isAr ? 'direction@creche.dz / 0555...' : 'direction@creche.dz ou 0555...'}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    {isAr ? 'اسم الروضة المعنية *' : 'Nom de la crèche concernée *'}
                  </label>
                  <input
                    type="text"
                    value={crecheName}
                    onChange={e => setCrecheName(e.target.value)}
                    placeholder={isAr ? 'اسم المؤسسة' : 'Ex. : Crèche Les Petits Pas'}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    {isAr ? 'توضيحات إضافية (اختياري)' : 'Précisions complémentaires (facultatif)'}
                  </label>
                  <textarea
                    rows={3}
                    value={details}
                    onChange={e => setDetails(e.target.value)}
                    placeholder={
                      isAr
                        ? 'اذكروا اسم الطفل في حال تعلق الطلب بملف تسجيل أولياء...'
                        : 'Précisez par exemple le prénom de l’enfant s’il s’agit d’une demande parentale...'
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <a
                  href={canSendRequest ? buildOfficialWhatsappHref(preparedRequestText) : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!canSendRequest}
                  onClick={e => {
                    if (!canSendRequest) e.preventDefault();
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition sm:text-sm ${
                    canSendRequest
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'cursor-not-allowed bg-slate-200 text-slate-500'
                  }`}
                >
                  <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {isAr ? 'إرسال الطلب عبر واتساب الرسمي' : 'Envoyer la demande au support officiel'}
                  </span>
                </a>

                <button
                  type="button"
                  disabled={!canSendRequest}
                  onClick={() => void handleCopyPreparedRequest()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer sm:text-sm"
                >
                  <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{isAr ? 'نسخ نص الطلب الرسمي' : 'Copier le texte de la demande'}</span>
                </button>

                {copiedRequest && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {isAr ? 'تم نسخ الطلب.' : 'Demande copiée.'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Pied de page interne avec liens rapides */}
          <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {isAr
                ? `© 2026 ${LEGAL_CONFIG.brandName} — ${LEGAL_CONFIG.countryAr}`
                : `© 2026 ${LEGAL_CONFIG.brandName} — ${LEGAL_CONFIG.countryFr}`}
            </p>
            <div className="flex flex-wrap items-center gap-3 font-semibold">
              <a href="/login/" className="text-indigo-700 hover:underline">
                {isAr ? 'فضاء المديرة' : 'Connexion Directrice'}
              </a>
              <span aria-hidden="true">·</span>
              <a href="/signin/" className="text-indigo-700 hover:underline">
                {isAr ? 'تجربة 15 يوماً' : 'Essai gratuit 15 jours'}
              </a>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      <h3 className="mb-2 text-base font-bold text-slate-900">{title}</h3>
      <div>{children}</div>
    </section>
  );
}
