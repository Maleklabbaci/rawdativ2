/**
 * Style context — Vitrine officielle Rawdha+: lumière éditoriale, photographie humaine,
 * contraste affirmé et animations calmes. Le hero raconte une journée de crèche sans
 * compromettre les accès de connexion/inscription déjà établis dans l’application.
 */
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Globe2,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Network,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

type LandingDestination = 'login' | 'request';

interface LandingPageProps {
  onNavigate: (destination: LandingDestination) => void;
}

const featureGroups = {
  fr: [
    { title: 'Accueil & enfants', text: 'Le suivi de votre crèche dès l’ouverture de la journée.', items: ['Tableau de bord', 'Enfants', 'Classes', 'Admissions'] },
    { title: 'Présences & équipe', text: 'Les opérations de terrain organisées au même endroit.', items: ['Présences', 'Personnel', 'Activités', 'Repas'] },
    { title: 'Gestion & pilotage', text: 'Les informations utiles pour décider et suivre votre activité.', items: ['Paiements', 'Rapports', 'Comptes', 'Paramètres'] },
    { title: 'Communication & réseau', text: 'Les échanges utiles avec vos familles, votre équipe et votre réseau.', items: ['Communication', 'Notifications', 'Rawdha Connect', 'Aide & support'] },
  ],
  ar: [
    { title: 'الواجهة والأطفال', text: 'متابعة حضانتك منذ بداية اليوم.', items: ['لوحة المتابعة', 'الأطفال', 'الأقسام', 'طلبات التسجيل'] },
    { title: 'الحضور والفريق', text: 'عمليات الميدان منظمة في مكان واحد.', items: ['الحضور', 'الموظفون', 'الأنشطة', 'الوجبات'] },
    { title: 'التسيير والمتابعة', text: 'المعلومات المفيدة لاتخاذ القرار ومتابعة النشاط.', items: ['الدفعات', 'التقارير', 'الحسابات', 'الإعدادات'] },
    { title: 'التواصل والشبكة', text: 'التبادلات المفيدة مع الأولياء والفريق والشبكة.', items: ['التواصل', 'الإشعارات', 'Rawdha Connect', 'المساعدة والدعم'] },
  ],
};

const dayFlow = {
  fr: [
    { phase: 'Matin', title: 'Accueillir', text: 'Présences, arrivées et consignes à suivre.' },
    { phase: 'Journée', title: 'Organiser', text: 'Classes, activités, repas et équipe.' },
    { phase: 'Suivi', title: 'Informer', text: 'Messages, notifications et échanges utiles.' },
    { phase: 'Pilotage', title: 'Décider', text: 'Paiements, rapports et indicateurs.' },
  ],
  ar: [
    { phase: 'الصباح', title: 'استقبال', text: 'الحضور والوصول والتعليمات الواجب متابعتها.' },
    { phase: 'خلال اليوم', title: 'تنظيم', text: 'الأقسام والأنشطة والوجبات والفريق.' },
    { phase: 'المتابعة', title: 'إعلام', text: 'الرسائل والإشعارات والتبادلات المفيدة.' },
    { phase: 'التسيير', title: 'قرار', text: 'الدفعات والتقارير ومؤشرات المتابعة.' },
  ],
};

const copy = {
  fr: {
    nav: { platform: 'Plateforme', modules: 'Fonctionnalités', network: 'Rawdha Connect', login: 'Se connecter', request: 'Demander un accès' },
    badge: 'Plateforme de gestion de crèche',
    title: 'Gérez votre crèche avec une vision claire de chaque journée.',
    text: 'Rawdha+ rassemble les admissions, présences, classes, activités, équipe, paiements et communication dans un seul espace bilingue.',
    primary: 'Essai gratuit de 15 jours',
    secondary: 'Se connecter',
    assurance: ['15 jours gratuits', 'Sans engagement', 'Toutes les fonctionnalités'],
    heroPhotoAlt: 'Éducatrice accompagnant des enfants dans une salle de crèche lumineuse',
    activityLabel: 'Le rythme d’une journée Rawdha+',
    activityItems: ['08:10 · Présences enregistrées', '09:30 · Activité préparée', '11:45 · Repas à confirmer', '15:30 · Message envoyé aux familles'],
    previewLabel: 'Aperçu de la plateforme',
    previewTitle: 'Tableau de bord',
    previewToday: 'Aujourd’hui',
    previewItems: ['Présences à consulter', 'Demandes d’admission', 'Paiements à vérifier'],
    overview: 'Tout ce que vous gérez dans votre crèche, réuni dans Rawdha+.',
    overviewText: 'Rawdha+ couvre les opérations du quotidien, le suivi administratif, la communication et le réseau professionnel dans la même plateforme.',
    modulesLabel: 'Les fonctionnalités Rawdha+',
    dayFlowLabel: 'Une journée mieux organisée',
    dayFlowTitle: 'Les bonnes informations, au bon moment.',
    dayFlowText: 'Rawdha+ accompagne les temps importants de la journée sans multiplier les outils ou les feuilles de suivi.',
    connectLabel: 'Rawdha Connect',
    connectTitle: 'Le réseau professionnel des Directrices, directement dans Rawdha+.',
    connectText: 'Partagez une activité, échangez avec votre réseau, découvrez une annonce ou recevez une information officielle sans quitter la plateforme.',
    connectItems: ['Fil professionnel', 'Messagerie entre Directrices', 'Annonces et notifications'],
    connectAction: 'Accéder à Rawdha Connect',
    securityLabel: 'Un accès simple et maîtrisé',
    securityTitle: 'Chaque Directeur rejoint la plateforme après validation.',
    securityText: 'Une demande crée un accès en attente. L’administrateur garde le contrôle avant l’activation complète du compte.',
    trialLabel: 'Essai gratuit',
    trialTitle: '15 jours pour essayer Rawdha+ gratuitement.',
    trialText: 'Découvrez toutes les fonctionnalités de la plateforme pendant 15 jours, sans engagement. Votre demande Directeur est ensuite examinée avant l’activation complète.',
    finalTitle: 'Commencez à gérer votre crèche avec plus de visibilité.',
    finalText: 'Créez votre demande et démarrez votre essai gratuit de 15 jours après validation.',
    finalPrimary: 'Commencer mon essai gratuit',
    finalSecondary: 'J’ai déjà un compte',
    footer: 'Plateforme professionnelle de gestion de crèche',
    menu: 'Ouvrir la navigation',
    close: 'Fermer la navigation',
  },
  ar: {
    nav: { platform: 'المنصة', modules: 'الوظائف', network: 'Rawdha Connect', login: 'تسجيل الدخول', request: 'اطلبي الولوج' },
    badge: 'منصة تسيير الحضانة',
    title: 'سيّري حضانتك برؤية واضحة لكل يوم.',
    text: 'تجمع Rawdha+ طلبات التسجيل والحضور والأقسام والأنشطة والفريق والدفعات والتواصل في فضاء واحد ثنائي اللغة.',
    primary: 'تجربة مجانية لمدة 15 يوماً',
    secondary: 'تسجيل الدخول',
    assurance: ['15 يوماً مجاناً', 'دون التزام', 'كل الوظائف متاحة'],
    heroPhotoAlt: 'مربية ترافق الأطفال في قاعة حضانة مضيئة',
    activityLabel: 'إيقاع يوم مع Rawdha+',
    activityItems: ['08:10 · تسجيل الحضور', '09:30 · تحضير النشاط', '11:45 · تأكيد الوجبة', '15:30 · إرسال رسالة للأولياء'],
    previewLabel: 'نظرة على المنصة',
    previewTitle: 'لوحة المتابعة',
    previewToday: 'اليوم',
    previewItems: ['حضور يحتاج مراجعة', 'طلبات تسجيل', 'دفعات تحتاج متابعة'],
    overview: 'كل ما تسيّرينه في حضانتك، مجمع في Rawdha+.',
    overviewText: 'تغطي Rawdha+ عمليات اليوم والتسيير الإداري والتواصل والشبكة المهنية في المنصة نفسها.',
    modulesLabel: 'وظائف Rawdha+',
    dayFlowLabel: 'يوم أكثر تنظيماً',
    dayFlowTitle: 'المعلومة المناسبة، في الوقت المناسب.',
    dayFlowText: 'ترافق Rawdha+ أهم لحظات اليوم دون تعدد الأدوات أو جداول المتابعة المنفصلة.',
    connectLabel: 'Rawdha Connect',
    connectTitle: 'شبكة مهنية للمديرات، داخل Rawdha+ مباشرة.',
    connectText: 'شاركي نشاطاً وتبادلي الخبرات مع شبكتك واكتشفي إعلاناً أو استقبلي معلومة رسمية دون مغادرة المنصة.',
    connectItems: ['منشورات مهنية', 'رسائل بين المديرات', 'إعلانات وإشعارات'],
    connectAction: 'الدخول إلى Rawdha Connect',
    securityLabel: 'ولوج بسيط ومتحكم فيه',
    securityTitle: 'كل مديرة تنضم إلى المنصة بعد المصادقة.',
    securityText: 'ينشئ الطلب ولوجاً في انتظار المراجعة. يبقى المسؤول متحكماً قبل التفعيل الكامل للحساب.',
    trialLabel: 'تجربة مجانية',
    trialTitle: '15 يوماً لتجربة Rawdha+ مجاناً.',
    trialText: 'اكتشفي كل وظائف المنصة لمدة 15 يوماً دون التزام. يُراجع طلب المديرة قبل التفعيل الكامل.',
    finalTitle: 'ابدئي تسيير حضانتك برؤية أوضح.',
    finalText: 'أنشئي طلبك وابدئي تجربتك المجانية لمدة 15 يوماً بعد المصادقة.',
    finalPrimary: 'بدء التجربة المجانية',
    finalSecondary: 'لدي حساب بالفعل',
    footer: 'منصة احترافية لتسيير الحضانة',
    menu: 'فتح التنقل',
    close: 'غلق التنقل',
  },
};

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const { language, setLanguage } = useLanguage();
  const isArabic = language === 'ar';
  const content = isArabic ? copy.ar : copy.fr;
  const currentFeatures = isArabic ? featureGroups.ar : featureGroups.fr;
  const currentDayFlow = isArabic ? dayFlow.ar : dayFlow.fr;
  const activityItems = [...content.activityItems, ...content.activityItems];
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 16);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
    return () => window.removeEventListener('scroll', updateHeader);
  }, []);

  const scrollToSection = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const Arrow = isArabic ? ArrowLeft : ArrowRight;

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="min-h-screen overflow-x-hidden bg-slate-50 font-sans text-slate-950">
      <style>{`
        @keyframes rawdha-activity-flow { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .rawdah-activity-track { animation: rawdha-activity-flow 24s linear infinite; }
        .rawdah-activity-track:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .rawdah-activity-track { animation: none; } }
      `}</style>
      <header className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-200 ${scrolled ? 'border-slate-300 bg-white/95 shadow-sm backdrop-blur' : 'border-slate-200 bg-white/95 backdrop-blur'}`}>
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5" aria-label="Rawdha+">
            <img src="/rawdah-logo.png" alt="Rawdha+" className="h-11 w-11 rounded-xl object-contain shadow-sm" />
            <span className="text-left leading-tight"><span className="block text-[17px] font-black tracking-tight text-slate-950">RAWDHA<span className="text-[#e85b2d]">+</span></span><span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">{content.footer}</span></span>
          </button>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Navigation principale">
            <button type="button" onClick={() => scrollToSection('plateforme')} className="text-sm font-bold text-slate-700 transition hover:text-[#c94b24]">{content.nav.platform}</button>
            <button type="button" onClick={() => scrollToSection('modules')} className="text-sm font-bold text-slate-700 transition hover:text-[#c94b24]">{content.nav.modules}</button>
            <button type="button" onClick={() => scrollToSection('connect')} className="text-sm font-bold text-slate-700 transition hover:text-[#c94b24]">{content.nav.network}</button>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <div className="flex rounded-lg border border-slate-300 bg-slate-100 p-0.5"><button type="button" onClick={() => setLanguage('fr')} className={`rounded-md px-2 py-1 text-[10px] font-black ${!isArabic ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-700'}`}>FR</button><button type="button" onClick={() => setLanguage('ar')} className={`rounded-md px-2 py-1 text-[10px] font-black ${isArabic ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-700'}`}>ع</button></div>
            <button type="button" onClick={() => onNavigate('login')} className="px-2 text-sm font-bold text-slate-800 transition hover:text-[#c94b24]">{content.nav.login}</button>
            <button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center gap-2 rounded-lg bg-[#e85b2d] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#d84d21] active:scale-[0.97]">{content.nav.request}<Arrow className="h-4 w-4" /></button>
          </div>

          <button type="button" onClick={() => setMenuOpen((value) => !value)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-300 bg-white text-slate-800 md:hidden" aria-label={menuOpen ? content.close : content.menu}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {menuOpen && <div className="border-t border-slate-300 bg-white px-4 py-4 shadow-lg md:hidden"><div className="flex flex-col gap-1">{[['plateforme', content.nav.platform], ['modules', content.nav.modules], ['connect', content.nav.network]].map(([id, label]) => <button key={id} type="button" onClick={() => scrollToSection(id)} className="rounded-lg px-3 py-3 text-start text-sm font-bold text-slate-900 hover:bg-slate-100">{label}</button>)}<div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => onNavigate('login')} className="rounded-lg border border-slate-300 px-3 py-3 text-sm font-bold text-slate-900">{content.nav.login}</button><button type="button" onClick={() => onNavigate('request')} className="rounded-lg bg-[#e85b2d] px-3 py-3 text-sm font-bold text-white">{content.nav.request}</button></div></div></div>}
      </header>

      <main>
        <section id="plateforme" className="scroll-mt-20 border-b border-slate-300 bg-[#f7f1ea] px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32 lg:px-8 lg:pb-20">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16">
            <div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-orange-300 bg-orange-50 px-3 py-2 text-[11px] font-bold text-[#b9411e]"><ShieldCheck className="h-4 w-4" />{content.badge}</span><h1 className="mt-6 text-4xl font-black leading-[1.04] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">{content.title}</h1><p className="mt-6 max-w-xl text-base font-medium leading-7 text-slate-700 sm:text-lg">{content.text}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#e85b2d] px-5 py-3.5 text-sm font-bold text-white shadow-[0_10px_18px_rgba(201,75,36,0.20)] transition hover:bg-[#c94b24] active:scale-[0.97]">{content.primary}<Arrow className="h-4 w-4" /></button><button type="button" onClick={() => onNavigate('login')} className="inline-flex items-center justify-center rounded-lg border border-slate-400 bg-white px-5 py-3.5 text-sm font-bold text-slate-900 transition hover:border-slate-950 hover:bg-slate-50">{content.secondary}</button></div><div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-700">{content.assurance.map((item) => <span key={item} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-700" />{item}</span>)}</div></div>
            <div className="relative min-h-[360px] overflow-hidden rounded-[28px] border border-slate-300 bg-slate-950 shadow-[0_22px_46px_rgba(15,23,42,0.20)] sm:min-h-[460px]"><img src="/manus-storage/rawdha-hero-classroom_b11ff637.jpg" alt={content.heroPhotoAlt} className="absolute inset-0 h-full w-full object-cover object-[68%_center]" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/10 to-transparent" /><div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/40 bg-white/95 p-4 shadow-xl backdrop-blur sm:inset-x-6 sm:bottom-6 sm:p-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><img src="/rawdah-logo.png" alt="" className="h-8 w-8 rounded-lg object-contain" /><div><p className="text-xs font-black text-slate-950">RAWDHA+</p><p className="text-[10px] font-bold text-slate-600">{content.previewLabel}</p></div></div><span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-white">{content.previewToday}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{content.previewItems.map((item, index) => <div key={item} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2.5">{index === 0 ? <CalendarCheck className="h-4 w-4 shrink-0 stroke-[1.8] text-[#c94b24]" /> : index === 1 ? <ClipboardList className="h-4 w-4 shrink-0 stroke-[1.8] text-[#c94b24]" /> : <CreditCard className="h-4 w-4 shrink-0 stroke-[1.8] text-[#c94b24]" />}<span className="text-[10px] font-bold leading-4 text-slate-800">{item}</span></div>)}</div></div></div>
          </div>
          <div className="mx-auto mt-10 max-w-7xl overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"><div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3"><span className="h-2 w-2 animate-pulse rounded-full bg-[#e85b2d]" /><p className="text-xs font-black text-slate-900">{content.activityLabel}</p></div><div className="overflow-hidden py-3"><div className="rawdah-activity-track flex w-max items-center gap-7 whitespace-nowrap px-4">{activityItems.map((item, index) => <span key={`${item}-${index}`} className="inline-flex items-center gap-2 text-xs font-bold text-slate-700"><span className="h-1.5 w-1.5 rounded-full bg-[#e85b2d]" />{item}</span>)}</div></div></div>
        </section>

        <section className="border-b border-slate-300 bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-16">
              <div><p className="text-sm font-bold text-[#c94b24]">{content.dayFlowLabel}</p><h2 className="mt-3 max-w-xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{content.dayFlowTitle}</h2></div>
              <p className="max-w-2xl text-base font-medium leading-7 text-slate-700">{content.dayFlowText}</p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {currentDayFlow.map(({ phase, title, text }, index) => <article key={phase} className="border-t-2 border-slate-950 pt-4"><p className="text-xs font-black tracking-[0.12em] text-[#c94b24]">{String(index + 1).padStart(2, '0')} · {phase}</p><h3 className="mt-3 text-lg font-black text-slate-950">{title}</h3><p className="mt-2 text-sm font-medium leading-6 text-slate-700">{text}</p></article>)}
            </div>
          </div>
        </section>

        <section id="modules" className="scroll-mt-20 bg-slate-50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"><div className="mx-auto max-w-7xl"><div className="max-w-3xl"><p className="text-sm font-bold text-[#c94b24]">{content.modulesLabel}</p><h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{content.overview}</h2><p className="mt-4 text-base font-medium leading-7 text-slate-700">{content.overviewText}</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{currentFeatures.map(({ title, text, items }) => <article key={title} className="rounded-xl border border-slate-300 bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]"><h3 className="text-base font-black text-slate-950">{title}</h3><p className="mt-2 min-h-12 text-sm font-medium leading-6 text-slate-700">{text}</p><ul className="mt-5 border-t border-slate-200 pt-3 text-sm font-bold text-slate-800">{items.map((item) => <li key={item} className="border-b border-slate-200 py-2.5 last:border-b-0">{item}</li>)}</ul></article>)}</div></div></section>

        <section id="connect" className="scroll-mt-20 border-y border-slate-300 bg-[#eef4fb] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-20">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-700"><Network className="h-4 w-4 stroke-[1.8]" />{content.connectLabel}</div>
              <h2 className="mt-5 max-w-2xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{content.connectTitle}</h2>
              <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-700">{content.connectText}</p>
              <div className="mt-7 space-y-3">{content.connectItems.map((item) => <p key={item} className="flex items-center gap-2 text-sm font-bold text-slate-800"><CheckCircle2 className="h-4 w-4 stroke-[1.8] text-slate-700" />{item}</p>)}</div>
              <button type="button" onClick={() => onNavigate('login')} className="mt-8 inline-flex items-center gap-2 text-sm font-black text-[#e85b2d] transition hover:text-[#c94b24]">{content.connectAction}<Arrow className="h-4 w-4" /></button>
            </div>
            <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-4"><Network className="h-5 w-5 stroke-[1.8] text-slate-700" /><div><p className="text-sm font-black text-slate-950">Rawdha Connect</p><p className="text-xs font-medium text-slate-600">{isArabic ? 'فضاء مهني للمديرات' : 'Espace professionnel des Directrices'}</p></div></div>
              <div className="mt-4 rounded-xl border border-slate-300 p-4">
                <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><img src="/rawdah-logo.png" alt="" className="h-9 w-9 rounded-lg object-contain" /><div><p className="text-sm font-black text-slate-950">Rawdha+</p><p className="text-[11px] font-medium text-slate-600">{isArabic ? 'منصة الحضانات' : 'Plateforme des crèches'}</p></div></div><span className="text-xs font-bold text-slate-600">{isArabic ? 'إعلان' : 'Annonce'}</span></div>
                <p className="mt-4 text-sm font-medium leading-6 text-slate-800">{isArabic ? 'تابعي أخبار المنصة وشاركي خبراتك المهنية مع شبكتك.' : 'Retrouvez les informations de la plateforme et partagez vos pratiques professionnelles avec votre réseau.'}</p>
                <div className="mt-4 flex gap-4 border-t border-slate-200 pt-3 text-xs font-bold text-slate-700"><span className="inline-flex items-center gap-1"><Bell className="h-3.5 w-3.5" />{isArabic ? 'إشعارات' : 'Notifications'}</span><span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{isArabic ? 'رسائل' : 'Messages'}</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"><div className="mx-auto grid max-w-7xl gap-10 rounded-2xl border border-orange-200 bg-[#fff5ef] p-7 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:p-10 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:p-14"><div><p className="text-sm font-bold text-[#c94b24]">{content.securityLabel}</p><h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{content.securityTitle}</h2><p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-700">{content.securityText}</p></div><div className="rounded-xl border border-orange-300 bg-white p-5 shadow-sm"><ShieldCheck className="h-7 w-7 text-[#c94b24]" /><p className="mt-4 text-sm font-black text-slate-950">{isArabic ? 'حالة الوصول' : 'Statut d’accès'}</p><div className="mt-3 space-y-2 text-sm font-medium text-slate-700"><p className="flex items-center justify-between"><span>{isArabic ? 'الطلب' : 'Demande'}</span><span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-bold text-[#b9411e]">{isArabic ? 'في الانتظار' : 'En attente'}</span></p><p className="flex items-center justify-between"><span>{isArabic ? 'التفعيل' : 'Activation'}</span><span className="text-xs font-bold text-slate-700">{isArabic ? 'بعد المراجعة' : 'Après validation'}</span></p></div></div></div></section>

        <section className="border-y border-slate-300 bg-[#fff7f2] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.82fr] lg:items-end"><div><p className="text-sm font-bold text-[#c94b24]">{content.trialLabel}</p><h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">{content.trialTitle}</h2><p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-700">{content.trialText}</p><div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-slate-800"><span>{isArabic ? '15 يوماً' : '15 jours'}</span><span className="text-[#c94b24]">•</span><span>{isArabic ? 'دون التزام' : 'Sans engagement'}</span><span className="text-[#c94b24]">•</span><span>{isArabic ? 'كل الوظائف' : 'Toutes les fonctionnalités'}</span></div></div><div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)]"><h3 className="text-xl font-black">{content.finalTitle}</h3><p className="mt-3 text-sm font-medium leading-6 text-slate-200">{content.finalText}</p><div className="mt-6 flex flex-col gap-3"><button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#e85b2d] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#ff6b36] active:scale-[0.97]">{content.finalPrimary}<Arrow className="h-4 w-4" /></button><button type="button" onClick={() => onNavigate('login')} className="rounded-lg border border-slate-500 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">{content.finalSecondary}</button></div></div></div></section>
      </main>

      <footer className="border-t border-slate-300 bg-white px-4 py-7 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs font-medium text-slate-600 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><img src="/rawdah-logo.png" alt="Rawdha+" className="h-7 w-7 rounded-lg object-contain" /><span className="font-black text-slate-950">RAWDHA<span className="text-[#e85b2d]">+</span></span><span>{content.footer}</span></div><div className="flex items-center gap-3"><Globe2 className="h-4 w-4" /><button type="button" onClick={() => setLanguage(isArabic ? 'fr' : 'ar')} className="font-bold text-slate-800 hover:text-[#c94b24]">{isArabic ? 'Français' : 'العربية'}</button><span>© 2026 RAWDHA+</span></div></div></footer>
    </div>
  );
}
