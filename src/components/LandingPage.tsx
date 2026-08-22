/**
 * Style context — Rawdha+ « Cadre clair » : vitrine bilingue sobre et stable.
 * Fond ivoire, bleu de confiance, cartes régulières et aucun effet dépendant de la taille d’écran.
 */
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Globe2,
  Menu,
  MessageCircle,
  Network,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

type LandingDestination = 'login' | 'request';

interface LandingPageProps {
  onNavigate: (destination: LandingDestination) => void;
}

type FeatureGroup = {
  title: string;
  text: string;
  items: string[];
};

const featureGroups: Record<'fr' | 'ar', FeatureGroup[]> = {
  fr: [
    { title: 'Accueil & enfants', text: 'Une vision claire des informations essentielles.', items: ['Tableau de bord', 'Enfants', 'Classes', 'Admissions'] },
    { title: 'Présences & équipe', text: 'Les opérations de la journée réunies au même endroit.', items: ['Présences', 'Personnel', 'Activités', 'Repas'] },
    { title: 'Gestion & pilotage', text: 'Les indicateurs utiles pour piloter votre établissement.', items: ['Paiements', 'Rapports', 'Comptes', 'Paramètres'] },
    { title: 'Communication & réseau', text: 'Un lien fiable avec les familles et les professionnels.', items: ['Communication', 'Notifications', 'Rawdha Connect', 'Aide & support'] },
  ],
  ar: [
    { title: 'الواجهة والأطفال', text: 'رؤية واضحة للمعلومات الأساسية.', items: ['لوحة المتابعة', 'الأطفال', 'الأقسام', 'طلبات التسجيل'] },
    { title: 'الحضور والفريق', text: 'عمليات اليوم مجمعة في مكان واحد.', items: ['الحضور', 'الموظفون', 'الأنشطة', 'الوجبات'] },
    { title: 'التسيير والمتابعة', text: 'المؤشرات المفيدة لتسيير مؤسستك.', items: ['الدفعات', 'التقارير', 'الحسابات', 'الإعدادات'] },
    { title: 'التواصل والشبكة', text: 'صلة موثوقة بالأولياء والمهنيين.', items: ['التواصل', 'الإشعارات', 'Rawdha Connect', 'المساعدة والدعم'] },
  ],
};

const copy = {
  fr: {
    nav: { platform: 'La plateforme', modules: 'Fonctionnalités', network: 'Rawdha Connect', login: 'Se connecter', request: 'Demander un accès' },
    footer: 'Plateforme professionnelle de gestion de crèche',
    menu: 'Ouvrir la navigation',
    close: 'Fermer la navigation',
    eyebrow: 'Plateforme bilingue de gestion de crèche',
    title: 'Tout ce qui compte pour votre crèche, dans un espace clair.',
    text: 'Rawdha+ rassemble les admissions, les présences, l’équipe, les paiements et les échanges avec les familles dans une seule plateforme.',
    primary: 'Essai gratuit de 15 jours',
    secondary: 'Se connecter',
    guarantees: ['15 jours gratuits', 'Sans engagement', 'Toutes les fonctionnalités'],
    productLabel: 'Aperçu de votre journée',
    productTitle: 'Les informations essentielles, sans chercher partout.',
    productItems: ['Présences à consulter', '2 demandes à suivre', 'Repas à confirmer'],
    dailyLabel: 'Une journée mieux suivie',
    dailyTitle: 'Accueillir, organiser, informer, décider.',
    dailyText: 'Des repères simples pour accompagner votre équipe de l’ouverture à la fin de journée.',
    dailySteps: [
      { title: 'Accueillir', text: 'Les arrivées et présences, simplement.' },
      { title: 'Organiser', text: 'Classes, activités, repas et équipe.' },
      { title: 'Informer', text: 'Les messages utiles aux familles.' },
      { title: 'Décider', text: 'Les données utiles pour avancer.' },
    ],
    modulesLabel: 'Les fonctionnalités Rawdha+',
    modulesTitle: 'Les essentiels de votre établissement, réunis.',
    modulesText: 'Des outils concrets pour réduire les tâches dispersées et conserver une vue fiable de votre crèche.',
    connectLabel: 'Rawdha Connect',
    connectTitle: 'Le réseau professionnel des Directrices.',
    connectText: 'Échangez des pratiques, suivez les annonces utiles et contactez votre réseau sans quitter Rawdha+.',
    connectItems: ['Fil professionnel', 'Messagerie entre Directrices', 'Annonces et notifications'],
    connectAction: 'Découvrir Rawdha Connect',
    securityLabel: 'Accès sécurisé',
    securityTitle: 'Chaque demande est relue avant l’activation.',
    securityText: 'L’administrateur garde la maîtrise des accès afin que chaque crèche utilise un espace adapté et validé.',
    securityStatus: 'Demande en attente',
    trialLabel: 'Essai gratuit',
    trialTitle: '15 jours pour découvrir Rawdha+ sereinement.',
    trialText: 'Testez toutes les fonctionnalités sans engagement. Votre demande est examinée avant l’activation complète.',
    finalPrimary: 'Commencer mon essai gratuit',
    finalSecondary: 'J’ai déjà un compte',
  },
  ar: {
    nav: { platform: 'المنصة', modules: 'الوظائف', network: 'Rawdha Connect', login: 'تسجيل الدخول', request: 'اطلبي الولوج' },
    footer: 'منصة احترافية لتسيير الحضانة',
    menu: 'فتح التنقل',
    close: 'غلق التنقل',
    eyebrow: 'منصة ثنائية اللغة لتسيير الحضانة',
    title: 'كل ما يهم حضانتك، في فضاء واضح.',
    text: 'تجمع Rawdha+ طلبات التسجيل والحضور والفريق والدفعات والتبادل مع الأولياء في منصة واحدة.',
    primary: 'تجربة مجانية لمدة 15 يوماً',
    secondary: 'تسجيل الدخول',
    guarantees: ['15 يوماً مجاناً', 'دون التزام', 'كل الوظائف متاحة'],
    productLabel: 'نظرة على يومك',
    productTitle: 'المعلومات الأساسية، دون البحث في أماكن متعددة.',
    productItems: ['حضور يحتاج مراجعة', 'طلبان للمتابعة', 'وجبات للتأكيد'],
    dailyLabel: 'يوم أكثر تنظيماً',
    dailyTitle: 'استقبال، تنظيم، إعلام، قرار.',
    dailyText: 'مؤشرات بسيطة لمرافقة فريقك من بداية اليوم إلى نهايته.',
    dailySteps: [
      { title: 'استقبال', text: 'الوصول والحضور ببساطة.' },
      { title: 'تنظيم', text: 'الأقسام والأنشطة والوجبات والفريق.' },
      { title: 'إعلام', text: 'الرسائل المفيدة للأولياء.' },
      { title: 'قرار', text: 'المعلومات المفيدة للتقدم.' },
    ],
    modulesLabel: 'وظائف Rawdha+',
    modulesTitle: 'أساسيات مؤسستك، مجمعة في مكان واحد.',
    modulesText: 'أدوات عملية لتقليل المهام المتفرقة والحفاظ على رؤية موثوقة لحضانتك.',
    connectLabel: 'Rawdha Connect',
    connectTitle: 'شبكة مهنية للمديرات.',
    connectText: 'تبادلي الممارسات وتابعي الإعلانات المفيدة وتواصلي مع شبكتك دون مغادرة Rawdha+.',
    connectItems: ['منشورات مهنية', 'رسائل بين المديرات', 'إعلانات وإشعارات'],
    connectAction: 'اكتشفي Rawdha Connect',
    securityLabel: 'ولوج آمن',
    securityTitle: 'كل طلب يخضع للمراجعة قبل التفعيل.',
    securityText: 'يبقى المسؤول متحكماً في الولوج حتى تستخدم كل حضانة فضاءً مناسباً ومصادقاً عليه.',
    securityStatus: 'الطلب في انتظار المراجعة',
    trialLabel: 'تجربة مجانية',
    trialTitle: '15 يوماً لاكتشاف Rawdha+ بثقة.',
    trialText: 'جرّبي كل الوظائف دون التزام. يُراجع طلبك قبل التفعيل الكامل.',
    finalPrimary: 'بدء التجربة المجانية',
    finalSecondary: 'لدي حساب بالفعل',
  },
};

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const { language, setLanguage } = useLanguage();
  const isArabic = language === 'ar';
  const content = isArabic ? copy.ar : copy.fr;
  const groups = isArabic ? featureGroups.ar : featureGroups.fr;
  const Arrow = isArabic ? ArrowLeft : ArrowRight;
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="min-h-screen overflow-x-hidden bg-[#f8fafc] text-[#10293a]">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-18 sm:px-6 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex min-w-0 items-center gap-2.5 text-start" aria-label="Rawdha+">
            <img src="/rawdah-logo.png" alt="Rawdha+" className="h-10 w-10 shrink-0 rounded-full object-contain" />
            <span className="min-w-0 leading-none"><span className="block text-sm font-black tracking-[-0.03em] text-[#10293a]">RAWDHA<span className="text-[#e85b2d]">+</span></span><span className={`mt-1 hidden whitespace-nowrap font-bold text-slate-500 sm:block ${isArabic ? 'text-[10px]' : 'text-[8px] uppercase tracking-[0.07em]'}`}>{content.footer}</span></span>
          </button>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Navigation principale">
            <button type="button" onClick={() => scrollTo('plateforme')} className="text-sm font-bold text-slate-700 transition hover:text-[#0876c9]">{content.nav.platform}</button>
            <button type="button" onClick={() => scrollTo('modules')} className="text-sm font-bold text-slate-700 transition hover:text-[#0876c9]">{content.nav.modules}</button>
            <button type="button" onClick={() => scrollTo('connect')} className="text-sm font-bold text-slate-700 transition hover:text-[#0876c9]">{content.nav.network}</button>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"><button type="button" onClick={() => setLanguage('fr')} aria-pressed={!isArabic} className={`rounded-md px-2 py-1 text-[10px] font-black ${!isArabic ? 'bg-[#10293a] text-white' : 'text-slate-600'}`}>FR</button><button type="button" onClick={() => setLanguage('ar')} aria-pressed={isArabic} className={`rounded-md px-2 py-1 text-[10px] font-black ${isArabic ? 'bg-[#10293a] text-white' : 'text-slate-600'}`}>ع</button></div>
            <button type="button" onClick={() => onNavigate('login')} className="text-sm font-bold text-slate-700 transition hover:text-[#0876c9]">{content.nav.login}</button>
            <button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center gap-2 rounded-lg bg-[#0876c9] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0666ae] active:scale-[0.98]">{content.nav.request}<Arrow className="h-4 w-4" /></button>
          </div>

          <button type="button" onClick={() => setMenuOpen((value) => !value)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-[#10293a] md:hidden" aria-label={menuOpen ? content.close : content.menu}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {menuOpen && <div className="border-t border-slate-200 bg-white p-4 md:hidden"><div className="mx-auto max-w-7xl space-y-2"><div className="flex items-center justify-between rounded-lg bg-slate-50 p-2"><span className="text-xs font-bold text-slate-700">{isArabic ? 'لغة الواجهة' : 'Langue de l’interface'}</span><div className="flex rounded-md border border-slate-200 bg-white p-0.5"><button type="button" onClick={() => setLanguage('fr')} className={`rounded px-3 py-1.5 text-xs font-bold ${!isArabic ? 'bg-[#10293a] text-white' : 'text-slate-600'}`}>Français</button><button type="button" onClick={() => setLanguage('ar')} className={`rounded px-3 py-1.5 text-xs font-bold ${isArabic ? 'bg-[#10293a] text-white' : 'text-slate-600'}`}>العربية</button></div></div>{[['plateforme', content.nav.platform], ['modules', content.nav.modules], ['connect', content.nav.network]].map(([id, label]) => <button key={id} type="button" onClick={() => scrollTo(id)} className="block w-full rounded-lg px-3 py-3 text-start text-sm font-bold text-slate-700 hover:bg-slate-50">{label}</button>)}<div className="grid grid-cols-2 gap-2 pt-2"><button type="button" onClick={() => onNavigate('login')} className="rounded-lg border border-slate-300 px-3 py-3 text-sm font-bold text-slate-700">{content.nav.login}</button><button type="button" onClick={() => onNavigate('request')} className="rounded-lg bg-[#0876c9] px-3 py-3 text-sm font-bold text-white">{content.nav.request}</button></div></div></div>}
      </header>

      <main>
        <section id="plateforme" className="border-b border-slate-200 bg-white px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-20">
            <div className="max-w-2xl"><p className="text-sm font-bold text-[#0876c9]">{content.eyebrow}</p><h1 className="mt-4 text-4xl font-black leading-[1.08] tracking-tight text-[#10293a] sm:text-5xl lg:text-6xl">{content.title}</h1><p className="mt-6 text-base font-medium leading-7 text-slate-600 sm:text-lg">{content.text}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0876c9] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#0666ae] active:scale-[0.98]">{content.primary}<Arrow className="h-4 w-4" /></button><button type="button" onClick={() => onNavigate('login')} className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:border-[#0876c9] hover:text-[#0876c9]">{content.secondary}</button></div><div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-600">{content.guarantees.map((item) => <span key={item} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{item}</span>)}</div></div>
            <aside className="hidden rounded-2xl border border-slate-200 bg-[#f8fbfe] p-5 shadow-sm md:block"><div className="flex items-center justify-between border-b border-slate-200 pb-4"><div className="flex items-center gap-3"><img src="/rawdah-logo.png" alt="" className="h-10 w-10 rounded-full object-contain" /><div><p className="text-sm font-black text-[#10293a]">RAWDHA+</p><p className="text-xs font-medium text-slate-500">{content.productLabel}</p></div></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{isArabic ? 'اليوم' : 'Aujourd’hui'}</span></div><h2 className="mt-7 text-2xl font-black leading-tight text-[#10293a]">{content.productTitle}</h2><div className="mt-6 space-y-3">{content.productItems.map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-[#0876c9]">{index === 0 ? <CalendarCheck className="h-4 w-4" /> : index === 1 ? <ClipboardList className="h-4 w-4" /> : <Bell className="h-4 w-4" />}</span><span className="text-sm font-bold text-slate-700">{item}</span></div>)}</div></aside>
          </div>
        </section>

        <section className="bg-[#f8fafc] px-4 py-14 sm:px-6 sm:py-20 lg:px-8"><div className="mx-auto max-w-7xl"><div className="max-w-3xl"><p className="text-sm font-bold text-[#0876c9]">{content.dailyLabel}</p><h2 className="mt-3 text-3xl font-black tracking-tight text-[#10293a] sm:text-4xl">{content.dailyTitle}</h2><p className="mt-4 text-base font-medium leading-7 text-slate-600">{content.dailyText}</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{content.dailySteps.map((step, index) => <article key={step.title} className="rounded-xl border border-slate-200 bg-white p-5"><span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-xs font-black text-[#0876c9]">0{index + 1}</span><h3 className="mt-5 text-lg font-black text-[#10293a]">{step.title}</h3><p className="mt-2 text-sm font-medium leading-6 text-slate-600">{step.text}</p></article>)}</div></div></section>

        <section id="modules" className="scroll-mt-20 bg-white px-4 py-14 sm:px-6 sm:py-20 lg:px-8"><div className="mx-auto max-w-7xl"><div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end"><div><p className="text-sm font-bold text-[#0876c9]">{content.modulesLabel}</p><h2 className="mt-3 text-3xl font-black tracking-tight text-[#10293a] sm:text-4xl">{content.modulesTitle}</h2></div><p className="max-w-2xl text-base font-medium leading-7 text-slate-600">{content.modulesText}</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{groups.map((group) => <article key={group.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-base font-black text-[#10293a]">{group.title}</h3><p className="mt-2 min-h-12 text-sm font-medium leading-6 text-slate-600">{group.text}</p><ul className="mt-5 border-t border-slate-200 pt-2 text-sm font-bold text-slate-700">{group.items.map((item) => <li key={item} className="border-b border-slate-100 py-2.5 last:border-b-0">{item}</li>)}</ul></article>)}</div></div></section>

        <section id="connect" className="scroll-mt-20 bg-[#eef6fc] px-4 py-14 sm:px-6 sm:py-20 lg:px-8"><div className="mx-auto grid max-w-7xl gap-10 rounded-2xl border border-blue-100 bg-white p-6 sm:p-10 lg:grid-cols-[1fr_0.78fr] lg:items-center lg:p-12"><div><div className="inline-flex items-center gap-2 text-sm font-bold text-[#0876c9]"><Network className="h-4 w-4" />{content.connectLabel}</div><h2 className="mt-4 text-3xl font-black tracking-tight text-[#10293a] sm:text-4xl">{content.connectTitle}</h2><p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600">{content.connectText}</p><button type="button" onClick={() => onNavigate('login')} className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#0876c9] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0666ae]">{content.connectAction}<Arrow className="h-4 w-4" /></button></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-5"><p className="text-sm font-black text-[#10293a]">Rawdha Connect</p><div className="mt-5 space-y-3">{content.connectItems.map((item, index) => <div key={item} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-[#0876c9]">{index === 0 ? <Network className="h-4 w-4" /> : index === 1 ? <MessageCircle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}</span><span className="text-sm font-bold text-slate-700">{item}</span></div>)}</div></div></div></section>

        <section className="bg-white px-4 py-14 sm:px-6 sm:py-20 lg:px-8"><div className="mx-auto grid max-w-7xl gap-8 rounded-2xl border border-slate-200 bg-[#f8fafc] p-6 sm:p-10 lg:grid-cols-[1fr_0.64fr] lg:items-center lg:p-12"><div><div className="inline-flex items-center gap-2 text-sm font-bold text-[#0876c9]"><ShieldCheck className="h-4 w-4" />{content.securityLabel}</div><h2 className="mt-4 text-3xl font-black tracking-tight text-[#10293a] sm:text-4xl">{content.securityTitle}</h2><p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600">{content.securityText}</p></div><div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-amber-700"><ShieldCheck className="h-7 w-7" /></span><p className="mt-4 text-sm font-black text-[#10293a]">{content.securityStatus}</p><p className="mt-2 text-xs font-bold text-emerald-700">{isArabic ? 'تحت مراجعة المسؤول' : 'En cours de vérification'}</p><p className="mt-5 rounded-lg bg-slate-50 p-3 text-xs font-medium text-slate-600">{isArabic ? 'يتم التفعيل بعد مراجعة الطلب.' : 'Activation après vérification de la demande.'}</p></div></div></section>

        <section className="bg-[#10293a] px-4 py-14 text-white sm:px-6 sm:py-20 lg:px-8"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.76fr] lg:items-end"><div><p className="text-sm font-bold text-[#7fc1f1]">{content.trialLabel}</p><h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">{content.trialTitle}</h2><p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-300">{content.trialText}</p><div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-slate-200"><span>15 {isArabic ? 'يوماً' : 'jours'}</span><span>•</span><span>{isArabic ? 'دون التزام' : 'Sans engagement'}</span><span>•</span><span>{isArabic ? 'كل الوظائف' : 'Toutes les fonctionnalités'}</span></div></div><div className="rounded-xl bg-white p-6 text-[#10293a]"><h3 className="text-xl font-black">{isArabic ? 'ابدئي عندما تكونين مستعدة.' : 'Commencez quand vous êtes prête.'}</h3><div className="mt-6 flex flex-col gap-3"><button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0876c9] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#0666ae]">{content.finalPrimary}<Arrow className="h-4 w-4" /></button><button type="button" onClick={() => onNavigate('login')} className="rounded-lg border border-slate-300 px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:border-[#0876c9] hover:text-[#0876c9]">{content.finalSecondary}</button></div></div></div></section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-7 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><img src="/rawdah-logo.png" alt="Rawdha+" className="h-8 w-8 rounded-full object-contain" /><span className="font-black text-[#10293a]">RAWDHA<span className="text-[#e85b2d]">+</span></span><span>{content.footer}</span></div><div className="flex items-center gap-3"><Globe2 className="h-4 w-4" /><button type="button" onClick={() => setLanguage(isArabic ? 'fr' : 'ar')} className="font-bold text-slate-700 hover:text-[#0876c9]">{isArabic ? 'Français' : 'العربية'}</button><span>© 2026 RAWDHA+</span></div></div></footer>
    </div>
  );
}
