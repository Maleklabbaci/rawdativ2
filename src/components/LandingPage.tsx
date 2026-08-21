/**
 * Style context — Rawdha+ « Carnet en Mouvement » : collage éditorial lumineux,
 * grands aplats bleu, jaune, menthe et corail, courbes organiques et photos humaines.
 * Les mouvements restent courts, accessibles et au service des vrais parcours de la plateforme.
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
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

type LandingDestination = 'login' | 'request';

interface LandingPageProps {
  onNavigate: (destination: LandingDestination) => void;
}

type FeatureGroup = {
  order: string;
  title: string;
  text: string;
  items: string[];
  tone: 'blue' | 'yellow' | 'mint' | 'coral';
};

const featureGroups: Record<'fr' | 'ar', FeatureGroup[]> = {
  fr: [
    { order: '01', title: 'Accueil & enfants', text: 'Une vue claire dès le premier bonjour.', items: ['Tableau de bord', 'Enfants', 'Classes', 'Admissions'], tone: 'blue' },
    { order: '02', title: 'Présences & équipe', text: 'Le terrain, enfin réuni dans le même rythme.', items: ['Présences', 'Personnel', 'Activités', 'Repas'], tone: 'yellow' },
    { order: '03', title: 'Gestion & pilotage', text: 'Les repères utiles pour avancer sereinement.', items: ['Paiements', 'Rapports', 'Comptes', 'Paramètres'], tone: 'mint' },
    { order: '04', title: 'Communication & réseau', text: 'Vos échanges, votre équipe, votre communauté.', items: ['Communication', 'Notifications', 'Rawdha Connect', 'Aide & support'], tone: 'coral' },
  ],
  ar: [
    { order: '01', title: 'الواجهة والأطفال', text: 'رؤية واضحة منذ أول تحية في الصباح.', items: ['لوحة المتابعة', 'الأطفال', 'الأقسام', 'طلبات التسجيل'], tone: 'blue' },
    { order: '02', title: 'الحضور والفريق', text: 'عمليات الميدان في إيقاع واحد.', items: ['الحضور', 'الموظفون', 'الأنشطة', 'الوجبات'], tone: 'yellow' },
    { order: '03', title: 'التسيير والمتابعة', text: 'المؤشرات المفيدة للتقدم بثقة.', items: ['الدفعات', 'التقارير', 'الحسابات', 'الإعدادات'], tone: 'mint' },
    { order: '04', title: 'التواصل والشبكة', text: 'تبادلاتك وفريقك ومجتمعك المهني.', items: ['التواصل', 'الإشعارات', 'Rawdha Connect', 'المساعدة والدعم'], tone: 'coral' },
  ],
};

const copy = {
  fr: {
    nav: { platform: 'La plateforme', modules: 'Fonctionnalités', network: 'Rawdha Connect', login: 'Se connecter', request: 'Demander un accès' },
    eyebrow: 'La plateforme des crèches qui avancent',
    title: 'Une journée de crèche mieux organisée, plus légère à vivre.',
    text: 'Rawdha+ rassemble les admissions, les présences, l’équipe, les paiements et les échanges avec les familles dans un seul espace bilingue.',
    primary: 'Essai gratuit de 15 jours',
    secondary: 'Se connecter',
    assurances: ['15 jours gratuits', 'Sans engagement', 'Toutes les fonctionnalités'],
    heroPhotoAlt: 'Éducatrice et enfants dans une activité en crèche',
    heroCardLabel: 'Aujourd’hui dans votre crèche',
    heroCardItems: ['Présences à consulter', '2 demandes à suivre', 'Repas à confirmer'],
    railLabel: 'Les petits gestes qui font une grande journée',
    railItems: ['08:10 · Présences enregistrées', '09:30 · Activité préparée', '11:45 · Repas confirmé', '15:30 · Message aux familles'],
    rhythmLabel: 'Un rythme qui vous ressemble',
    rhythmTitle: 'Du premier accueil au dernier message, tout reste à sa place.',
    rhythmText: 'Rawdha+ suit votre vraie journée de terrain sans vous noyer dans les écrans.',
    rhythmSteps: [
      { title: 'Accueillir', text: 'Les arrivées et présences, simplement.' },
      { title: 'Organiser', text: 'Classes, équipe, activités et repas.' },
      { title: 'Informer', text: 'Les bonnes nouvelles, au bon moment.' },
      { title: 'Décider', text: 'Les données utiles pour aller plus loin.' },
    ],
    modulesLabel: 'Tout un monde, dans Rawdha+',
    modulesTitle: 'Les essentiels de votre crèche, enfin réunis.',
    modulesText: 'Des outils concrets pour gérer l’essentiel, libérer du temps et garder le lien avec les familles.',
    connectLabel: 'Rawdha Connect',
    connectTitle: 'Votre réseau professionnel, sans quitter votre plateforme.',
    connectText: 'Partagez des pratiques, suivez les annonces utiles et échangez avec des Directrices qui vivent les mêmes journées que vous.',
    connectItems: ['Fil professionnel', 'Messagerie entre Directrices', 'Annonces et notifications'],
    connectAction: 'Découvrir Rawdha Connect',
    teamPhotoAlt: 'Deux Directrices échangeant dans une crèche',
    securityLabel: 'Un accès qui reste entre de bonnes mains',
    securityTitle: 'Chaque demande est relue avant l’activation.',
    securityText: 'Votre administrateur garde la maîtrise des accès pendant que votre future équipe prépare son arrivée.',
    securityStatus: 'Demande en attente',
    trialLabel: 'Faites un premier pas',
    trialTitle: '15 jours pour voir ce que Rawdha+ peut vraiment changer.',
    trialText: 'Testez toutes les fonctionnalités sans engagement. Votre demande est examinée avant l’activation complète.',
    finalPrimary: 'Commencer mon essai gratuit',
    finalSecondary: 'J’ai déjà un compte',
    footer: 'Plateforme professionnelle de gestion de crèche',
    menu: 'Ouvrir la navigation',
    close: 'Fermer la navigation',
  },
  ar: {
    nav: { platform: 'المنصة', modules: 'الوظائف', network: 'Rawdha Connect', login: 'تسجيل الدخول', request: 'اطلبي الولوج' },
    eyebrow: 'منصة الحضانات التي تتقدم',
    title: 'يوم حضانتك أكثر تنظيماً، وأسهل في العيش.',
    text: 'تجمع Rawdha+ طلبات التسجيل والحضور والفريق والدفعات والتبادل مع الأولياء في فضاء واحد ثنائي اللغة.',
    primary: 'تجربة مجانية لمدة 15 يوماً',
    secondary: 'تسجيل الدخول',
    assurances: ['15 يوماً مجاناً', 'دون التزام', 'كل الوظائف متاحة'],
    heroPhotoAlt: 'مربية وأطفال في نشاط داخل الحضانة',
    heroCardLabel: 'اليوم في حضانتك',
    heroCardItems: ['حضور يحتاج مراجعة', 'طلبان للمتابعة', 'وجبات للتأكيد'],
    railLabel: 'تفاصيل صغيرة تصنع يوماً كبيراً',
    railItems: ['08:10 · تسجيل الحضور', '09:30 · تحضير النشاط', '11:45 · تأكيد الوجبة', '15:30 · رسالة للأولياء'],
    rhythmLabel: 'إيقاع يشبه يومك',
    rhythmTitle: 'من أول استقبال إلى آخر رسالة، كل شيء في مكانه.',
    rhythmText: 'ترافق Rawdha+ يومك الحقيقي في الميدان دون إغراقك في الشاشات.',
    rhythmSteps: [
      { title: 'استقبال', text: 'الوصول والحضور ببساطة.' },
      { title: 'تنظيم', text: 'الأقسام والفريق والأنشطة والوجبات.' },
      { title: 'إعلام', text: 'الأخبار المناسبة في الوقت المناسب.' },
      { title: 'قرار', text: 'المعلومات المفيدة للتقدم أكثر.' },
    ],
    modulesLabel: 'عالم كامل في Rawdha+',
    modulesTitle: 'أساسيات حضانتك، مجمعة أخيراً.',
    modulesText: 'أدوات عملية لتسيير الأساسيات وتوفير الوقت والحفاظ على صلة دائمة مع الأولياء.',
    connectLabel: 'Rawdha Connect',
    connectTitle: 'شبكتك المهنية، دون مغادرة منصتك.',
    connectText: 'شاركي الممارسات وتابعي الإعلانات المفيدة وتبادلي الخبرات مع مديرات يعشن الأيام نفسها.',
    connectItems: ['منشورات مهنية', 'رسائل بين المديرات', 'إعلانات وإشعارات'],
    connectAction: 'اكتشفي Rawdha Connect',
    teamPhotoAlt: 'مديرتان تتبادلان الحديث داخل حضانة',
    securityLabel: 'ولوج يبقى بين أيدٍ موثوقة',
    securityTitle: 'كل طلب يخضع للمراجعة قبل التفعيل.',
    securityText: 'يبقى المسؤول متحكماً في الولوج بينما يستعد فريقك القادم للانضمام.',
    securityStatus: 'الطلب في انتظار المراجعة',
    trialLabel: 'خذي الخطوة الأولى',
    trialTitle: '15 يوماً لترَي ما الذي يمكن أن تغيّره Rawdha+ فعلاً.',
    trialText: 'جرّبي كل الوظائف دون التزام. يُراجع طلبك قبل التفعيل الكامل.',
    finalPrimary: 'بدء التجربة المجانية',
    finalSecondary: 'لدي حساب بالفعل',
    footer: 'منصة احترافية لتسيير الحضانة',
    menu: 'فتح التنقل',
    close: 'غلق التنقل',
  },
};

const heroImage = '/manus-storage/rawdha-editorial-hero_74727eeb.jpg';
const activityImage = '/manus-storage/rawdha-editorial-activity_77ad7fc6.jpg';
const teamImage = '/manus-storage/rawdha-editorial-team_372422e6.jpg';

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const { language, setLanguage } = useLanguage();
  const isArabic = language === 'ar';
  const content = isArabic ? copy.ar : copy.fr;
  const groups = isArabic ? featureGroups.ar : featureGroups.fr;
  const Arrow = isArabic ? ArrowLeft : ArrowRight;
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const landingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 12);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
    return () => window.removeEventListener('scroll', updateHeader);
  }, []);

  useEffect(() => {
    const root = landingRef.current;
    if (!root) return;
    const elements = Array.from(root.querySelectorAll('[data-reveal]')) as HTMLElement[];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach((element) => element.setAttribute('data-reveal', 'visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.setAttribute('data-reveal', 'visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const railItems = [...content.railItems, ...content.railItems];

  return (
    <div ref={landingRef} dir={isArabic ? 'rtl' : 'ltr'} className="min-h-screen overflow-x-hidden bg-[#fffaf0] text-[#10293a]">
      <style>{`
        @keyframes rawdha-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes rawdha-float { 0%, 100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-13px) rotate(-3deg); } }
        @keyframes rawdha-photo-breathe { 0%,100% { transform: scale(1.025); } 50% { transform: scale(1.065); } }
        .rawdah-display { font-family: ui-rounded, "Arial Rounded MT Bold", Arial, sans-serif; letter-spacing: -0.055em; }
        .rawdah-rail-track { animation: rawdha-marquee 25s linear infinite; }
        .rawdah-rail:hover .rawdah-rail-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: no-preference) {
          .rawdah-reveal { opacity: 0; transform: translate3d(0, 28px, 0) rotate(-0.6deg); transition: opacity 650ms cubic-bezier(0.23, 1, 0.32, 1), transform 650ms cubic-bezier(0.23, 1, 0.32, 1); }
          .rawdah-reveal[data-reveal="visible"] { opacity: 1; transform: translate3d(0, 0, 0) rotate(0); }
          .rawdah-delay-1 { transition-delay: 100ms; }
          .rawdah-delay-2 { transition-delay: 200ms; }
          .rawdah-delay-3 { transition-delay: 300ms; }
          .rawdah-float { animation: rawdha-float 7s ease-in-out infinite; }
          .rawdah-photo-breathe { animation: rawdha-photo-breathe 13s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite; }
        }
        @media (prefers-reduced-motion: reduce) { .rawdah-rail-track, .rawdah-float, .rawdah-photo-breathe { animation: none; } }
      `}</style>

      <header className={`fixed inset-x-0 top-0 z-50 px-3 py-3 transition-all duration-300 sm:px-6 ${scrolled ? 'bg-[#fffaf0]/85 shadow-[0_3px_18px_rgba(16,41,58,0.12)] backdrop-blur' : ''}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full border border-[#10293a]/15 bg-white px-3 py-2 shadow-[0_7px_0_rgba(16,41,58,0.08)] sm:px-4">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex shrink-0 items-center gap-2" aria-label="Rawdha+">
            <img src="/rawdah-logo.png" alt="Rawdha+" className="h-10 w-10 rounded-full object-contain" />
            <span className="hidden leading-tight sm:block"><span className="block text-sm font-black text-[#10293a]">RAWDHA<span className="text-[#f06445]">+</span></span><span className="block text-[8px] font-bold uppercase tracking-[0.12em] text-[#5f6d76]">{content.footer}</span></span>
          </button>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Navigation principale">
            <button type="button" onClick={() => scrollTo('plateforme')} className="text-xs font-black text-[#10293a] transition hover:text-[#0876c9]">{content.nav.platform}</button>
            <button type="button" onClick={() => scrollTo('modules')} className="text-xs font-black text-[#10293a] transition hover:text-[#0876c9]">{content.nav.modules}</button>
            <button type="button" onClick={() => scrollTo('connect')} className="text-xs font-black text-[#10293a] transition hover:text-[#0876c9]">{content.nav.network}</button>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <div className="flex rounded-full bg-[#edf1ed] p-1"><button type="button" onClick={() => setLanguage('fr')} className={`rounded-full px-2.5 py-1 text-[10px] font-black ${!isArabic ? 'bg-[#10293a] text-white' : 'text-[#10293a]'}`}>FR</button><button type="button" onClick={() => setLanguage('ar')} className={`rounded-full px-2.5 py-1 text-[10px] font-black ${isArabic ? 'bg-[#10293a] text-white' : 'text-[#10293a]'}`}>ع</button></div>
            <button type="button" onClick={() => onNavigate('login')} className="px-2 text-xs font-black text-[#10293a] transition hover:text-[#0876c9]">{content.nav.login}</button>
            <button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center gap-1.5 rounded-full bg-[#f9b928] px-4 py-2.5 text-xs font-black text-[#10293a] shadow-[0_3px_0_#d39108] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none">{content.nav.request}<Arrow className="h-3.5 w-3.5" /></button>
          </div>

          <button type="button" onClick={() => setMenuOpen((value) => !value)} className="grid h-9 w-9 place-items-center rounded-full bg-[#10293a] text-white md:hidden" aria-label={menuOpen ? content.close : content.menu}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {menuOpen && <div className="mx-auto mt-2 max-w-7xl rounded-3xl border border-[#10293a]/10 bg-white p-3 shadow-xl md:hidden"><div className="flex flex-col gap-1">{[['plateforme', content.nav.platform], ['modules', content.nav.modules], ['connect', content.nav.network]].map(([id, label]) => <button key={id} type="button" onClick={() => scrollTo(id)} className="rounded-2xl px-4 py-3 text-start text-sm font-black text-[#10293a] hover:bg-[#fff4d2]">{label}</button>)}<div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#10293a]/10 pt-3"><button type="button" onClick={() => onNavigate('login')} className="rounded-2xl border border-[#10293a]/20 px-3 py-3 text-xs font-black text-[#10293a]">{content.nav.login}</button><button type="button" onClick={() => onNavigate('request')} className="rounded-2xl bg-[#f9b928] px-3 py-3 text-xs font-black text-[#10293a]">{content.nav.request}</button></div></div></div>}
      </header>

      <main>
        <section id="plateforme" className="relative overflow-hidden bg-[#0876c9] px-4 pb-0 pt-28 text-white sm:px-6 sm:pt-36 lg:px-8">
          <div className="rawdah-float absolute -right-20 top-24 h-44 w-44 rounded-[42%_58%_52%_48%] bg-[#f9b928] opacity-95" />
          <div className="absolute -bottom-20 left-[14%] h-40 w-72 rotate-[10deg] rounded-[50%] bg-[#00a66c]" />
          <div className="relative z-10 mx-auto grid max-w-7xl gap-12 pb-14 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16 lg:pb-20">
            <div data-reveal className="rawdah-reveal max-w-2xl"><p className="inline-flex rounded-full border border-white/45 bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em]">{content.eyebrow}</p><h1 className="rawdah-display mt-6 text-5xl font-black leading-[0.94] sm:text-6xl lg:text-7xl">{content.title}</h1><p className="mt-7 max-w-xl text-base font-semibold leading-7 text-white/88 sm:text-lg">{content.text}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f9b928] px-6 py-4 text-sm font-black text-[#10293a] shadow-[0_4px_0_#d39108] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none">{content.primary}<Arrow className="h-4 w-4" /></button><button type="button" onClick={() => onNavigate('login')} className="inline-flex items-center justify-center rounded-full border-2 border-white/70 px-6 py-4 text-sm font-black text-white transition hover:bg-white hover:text-[#0876c9]">{content.secondary}</button></div><div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-xs font-black text-white">{content.assurances.map((item) => <span key={item} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#f9b928]" />{item}</span>)}</div></div>

            <div data-reveal className="rawdah-reveal rawdah-delay-2 relative min-h-[410px] sm:min-h-[500px]"><div className="absolute left-1/2 top-0 h-[89%] w-[74%] -translate-x-1/2 rotate-[5deg] rounded-[48%_52%_18%_21%] bg-[#f9b928]" /><div className="absolute right-2 top-2 h-[85%] w-[78%] -rotate-[3deg] overflow-hidden rounded-[42%_18%_40%_20%] border-[7px] border-white shadow-[0_18px_0_rgba(16,41,58,0.20)] sm:right-5"><img src={heroImage} alt={content.heroPhotoAlt} className="rawdah-photo-breathe h-full w-full object-cover object-[60%_center]" /></div><div className="absolute bottom-0 left-0 w-[88%] rounded-[26px_26px_26px_5px] border-2 border-[#10293a]/15 bg-white p-4 text-[#10293a] shadow-[0_13px_0_rgba(16,41,58,0.24)] sm:p-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><img src="/rawdah-logo.png" alt="" className="h-8 w-8 rounded-full object-contain" /><p className="text-xs font-black">RAWDHA+</p></div><span className="rounded-full bg-[#00a66c] px-2.5 py-1 text-[10px] font-black text-white">{content.heroCardLabel}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{content.heroCardItems.map((item, index) => <div key={item} className="flex items-center gap-2 rounded-xl bg-[#fff4d2] px-2.5 py-2 text-[10px] font-black leading-4"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[#0876c9]">{index === 0 ? <CalendarCheck className="h-3 w-3" /> : index === 1 ? <ClipboardList className="h-3 w-3" /> : <Bell className="h-3 w-3" />}</span>{item}</div>)}</div></div></div>
          </div>
          <div className="rawdah-rail relative z-10 -mb-px overflow-hidden bg-[#f9b928] py-4 text-[#10293a]"><div className="rawdah-rail-track flex w-max items-center gap-7 whitespace-nowrap px-5">{[...railItems, ...railItems].map((item, index) => <span key={`${item}-${index}`} className="inline-flex items-center gap-2 text-xs font-black"><span className="h-2 w-2 rounded-full bg-[#f06445]" />{index === 0 && <span className="rounded-full bg-[#10293a] px-2 py-1 text-[9px] text-white">{content.railLabel}</span>}{item}</span>)}</div></div>
        </section>

        <section data-reveal className="rawdah-reveal relative overflow-hidden bg-[#fffaf0] px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-20"><div><p className="text-sm font-black text-[#f06445]">{content.rhythmLabel}</p><h2 className="rawdah-display mt-4 max-w-xl text-4xl font-black leading-[0.98] text-[#10293a] sm:text-5xl">{content.rhythmTitle}</h2><p className="mt-6 max-w-xl text-base font-semibold leading-7 text-[#50616e]">{content.rhythmText}</p><div className="mt-8 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-[45%_55%_40%_60%] bg-[#f9b928] text-[#10293a]"><Users className="h-5 w-5" /></span><p className="text-sm font-black text-[#10293a]">{isArabic ? 'متابعة واضحة للفريق والأطفال والأولياء.' : 'Un suivi clair pour votre équipe, vos enfants et vos familles.'}</p></div></div><div className="grid gap-4 sm:grid-cols-2">{content.rhythmSteps.map((step, index) => <article key={step.title} data-reveal className={`rawdah-reveal rawdah-delay-${index} rounded-[28px] border-2 border-[#10293a]/15 p-6 ${index === 0 ? 'bg-[#f9b928]' : index === 1 ? 'bg-[#d6eff0]' : index === 2 ? 'bg-[#00a66c] text-white' : 'bg-white'}`}><span className={`grid h-10 w-10 place-items-center rounded-full text-xs font-black ${index === 2 ? 'bg-white text-[#00a66c]' : 'bg-[#10293a] text-white'}`}>0{index + 1}</span><h3 className="rawdah-display mt-8 text-2xl font-black">{step.title}</h3><p className={`mt-3 text-sm font-bold leading-6 ${index === 2 ? 'text-white/85' : 'text-[#50616e]'}`}>{step.text}</p></article>)}</div></div>
          <div className="absolute -bottom-28 -left-20 h-52 w-72 rotate-[-12deg] rounded-[50%] border-[28px] border-[#d6eff0]" />
        </section>

        <section id="modules" className="scroll-mt-20 bg-[#fff4d2] px-4 py-20 sm:px-6 sm:py-24 lg:px-8"><div className="mx-auto max-w-7xl"><div data-reveal className="rawdah-reveal grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end"><div><p className="text-sm font-black text-[#f06445]">{content.modulesLabel}</p><h2 className="rawdah-display mt-4 max-w-xl text-4xl font-black leading-[0.98] text-[#10293a] sm:text-5xl">{content.modulesTitle}</h2></div><p className="max-w-2xl text-base font-semibold leading-7 text-[#50616e]">{content.modulesText}</p></div><div className="mt-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{groups.map((group, index) => <article key={group.title} data-reveal className={`rawdah-reveal rawdah-delay-${index} rounded-[30px] border-2 border-[#10293a]/15 p-6 shadow-[0_9px_0_rgba(16,41,58,0.16)] transition duration-300 hover:-translate-y-2 ${group.tone === 'blue' ? 'bg-[#0876c9] text-white xl:rotate-[-2deg]' : group.tone === 'yellow' ? 'bg-[#f9b928] text-[#10293a] xl:translate-y-7' : group.tone === 'mint' ? 'bg-[#00a66c] text-white xl:rotate-[2deg]' : 'bg-[#f06445] text-white xl:translate-y-4'}`}><div className="flex items-start justify-between gap-3"><span className="text-4xl font-black opacity-50">{group.order}</span><span className={`h-3 w-3 rounded-full ${group.tone === 'yellow' ? 'bg-[#10293a]' : 'bg-white'}`} /></div><h3 className="rawdah-display mt-10 text-2xl font-black leading-none">{group.title}</h3><p className={`mt-4 min-h-14 text-sm font-bold leading-6 ${group.tone === 'yellow' ? 'text-[#10293a]/75' : 'text-white/85'}`}>{group.text}</p><ul className={`mt-6 border-t pt-3 text-sm font-black ${group.tone === 'yellow' ? 'border-[#10293a]/20' : 'border-white/30'}`}>{group.items.map((item) => <li key={item} className={`border-b py-2.5 ${group.tone === 'yellow' ? 'border-[#10293a]/15' : 'border-white/20'}`}>{item}</li>)}</ul></article>)}</div></div></section>

        <section id="connect" className="scroll-mt-20 relative overflow-hidden bg-[#00a66c] px-4 py-20 text-white sm:px-6 sm:py-24 lg:px-8"><div className="absolute -right-24 top-10 h-72 w-72 rounded-full border-[38px] border-[#f9b928]" /><div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.92fr] lg:items-center lg:gap-20"><div data-reveal className="rawdah-reveal"><div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs font-black"><Network className="h-4 w-4" />{content.connectLabel}</div><h2 className="rawdah-display mt-6 max-w-2xl text-4xl font-black leading-[0.98] sm:text-5xl">{content.connectTitle}</h2><p className="mt-6 max-w-2xl text-base font-semibold leading-7 text-white/85">{content.connectText}</p><div className="mt-8 space-y-3">{content.connectItems.map((item) => <p key={item} className="flex items-center gap-2 text-sm font-black"><CheckCircle2 className="h-4 w-4 text-[#f9b928]" />{item}</p>)}</div><button type="button" onClick={() => onNavigate('login')} className="mt-9 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#00a66c] shadow-[0_4px_0_rgba(16,41,58,0.28)] transition hover:-translate-y-0.5">{content.connectAction}<Arrow className="h-4 w-4" /></button></div><div data-reveal className="rawdah-reveal rawdah-delay-2 relative min-h-[370px]"><div className="absolute inset-x-8 top-1 h-[84%] rotate-[-4deg] rounded-[32px_64px_32px_64px] bg-[#f9b928]" /><div className="absolute inset-x-0 bottom-0 h-[91%] rotate-[3deg] overflow-hidden rounded-[64px_30px_64px_30px] border-[7px] border-white shadow-[0_17px_0_rgba(16,41,58,0.24)]"><img src={teamImage} alt={content.teamPhotoAlt} className="h-full w-full object-cover object-[36%_center]" /></div><div className="absolute -bottom-2 right-2 rounded-[22px_22px_4px_22px] bg-[#10293a] p-4 shadow-xl"><p className="text-[10px] font-black text-white/70">Rawdha Connect</p><div className="mt-2 flex gap-3 text-xs font-black"><span className="inline-flex items-center gap-1"><Bell className="h-3.5 w-3.5 text-[#f9b928]" />{isArabic ? 'إشعارات' : 'Notifications'}</span><span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5 text-[#f9b928]" />{isArabic ? 'رسائل' : 'Messages'}</span></div></div></div></div></section>

        <section className="bg-[#fffaf0] px-4 py-20 sm:px-6 sm:py-24 lg:px-8"><div data-reveal className="rawdah-reveal mx-auto grid max-w-7xl gap-10 overflow-hidden rounded-[42px] bg-[#0876c9] p-7 text-white shadow-[0_14px_0_rgba(16,41,58,0.2)] sm:p-12 lg:grid-cols-[1fr_0.86fr] lg:items-center lg:p-14"><div><div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs font-black"><ShieldCheck className="h-4 w-4 text-[#f9b928]" />{content.securityLabel}</div><h2 className="rawdah-display mt-6 max-w-2xl text-4xl font-black leading-[0.98] sm:text-5xl">{content.securityTitle}</h2><p className="mt-6 max-w-2xl text-base font-semibold leading-7 text-white/85">{content.securityText}</p></div><div data-reveal className="rawdah-reveal rawdah-delay-2 relative min-h-[280px]"><div className="absolute left-6 top-0 h-48 w-48 rounded-[44%_56%_52%_48%] bg-[#f06445]" /><div className="absolute right-0 top-9 h-40 w-40 rounded-full bg-[#f9b928]" /><img src={activityImage} alt="" className="absolute bottom-0 left-1/2 h-[87%] w-[72%] -translate-x-1/2 rounded-[50%_50%_18px_18px] border-4 border-white object-cover shadow-xl" /><div className="absolute bottom-2 left-0 rounded-2xl bg-white p-4 text-[#10293a] shadow-lg"><p className="text-xs font-black">{content.securityStatus}</p><p className="mt-1 text-[10px] font-bold text-[#00a66c]">{isArabic ? 'تحت مراجعة المسؤول' : 'En cours de vérification'}</p></div></div></div></section>

        <section className="relative overflow-hidden bg-[#f9b928] px-4 py-20 sm:px-6 sm:py-24 lg:px-8"><div className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-[#f06445]" /><div className="absolute -bottom-24 right-0 h-72 w-72 rounded-[44%_56%_52%_48%] bg-[#00a66c]" /><div data-reveal className="rawdah-reveal relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.82fr] lg:items-end"><div><p className="text-sm font-black text-[#0876c9]">{content.trialLabel}</p><h2 className="rawdah-display mt-4 max-w-3xl text-4xl font-black leading-[0.96] text-[#10293a] sm:text-6xl">{content.trialTitle}</h2><p className="mt-6 max-w-2xl text-base font-bold leading-7 text-[#10293a]/75">{content.trialText}</p><div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm font-black text-[#10293a]"><span>15 {isArabic ? 'يوماً' : 'jours'}</span><span>•</span><span>{isArabic ? 'دون التزام' : 'Sans engagement'}</span><span>•</span><span>{isArabic ? 'كل الوظائف' : 'Toutes les fonctionnalités'}</span></div></div><div data-reveal className="rawdah-reveal rawdah-delay-2 rounded-[32px] border-2 border-[#10293a] bg-white p-6 shadow-[0_9px_0_#10293a]"><p className="text-xs font-black text-[#f06445]">RAWDHA+</p><h3 className="rawdah-display mt-4 text-3xl font-black leading-none text-[#10293a]">{isArabic ? 'ابدئي بخطوة بسيطة.' : 'Faites un premier pas.'}</h3><div className="mt-7 flex flex-col gap-3"><button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f06445] px-5 py-3.5 text-sm font-black text-white shadow-[0_3px_0_#ad3c27] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none">{content.finalPrimary}<Arrow className="h-4 w-4" /></button><button type="button" onClick={() => onNavigate('login')} className="rounded-full border-2 border-[#10293a] px-5 py-3.5 text-sm font-black text-[#10293a] transition hover:bg-[#10293a] hover:text-white">{content.finalSecondary}</button></div></div></div></section>
      </main>

      <footer className="border-t-2 border-[#10293a]/10 bg-white px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs font-bold text-[#50616e] sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><img src="/rawdah-logo.png" alt="Rawdha+" className="h-8 w-8 rounded-full object-contain" /><span className="font-black text-[#10293a]">RAWDHA<span className="text-[#f06445]">+</span></span><span>{content.footer}</span></div><div className="flex items-center gap-3"><Globe2 className="h-4 w-4" /><button type="button" onClick={() => setLanguage(isArabic ? 'fr' : 'ar')} className="font-black text-[#10293a] hover:text-[#0876c9]">{isArabic ? 'Français' : 'العربية'}</button><span>© 2026 RAWDHA+</span></div></div></footer>
    </div>
  );
}
