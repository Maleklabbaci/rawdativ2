/**
 * Style context — Rawdha+ « Atelier numérique » : vitrine de crèche contemporaine, éditoriale et stable.
 * Les surfaces produit, l'asymétrie sûre et les personnages ont leur zone de sécurité ; les mouvements utilisent uniquement transform/opacity.
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
    { title: 'Accueil & enfants', text: 'Chaque enfant est attendu, suivi et accompagné dès son arrivée.', items: ['Tableau de bord', 'Enfants', 'Classes', 'Admissions'] },
    { title: 'Présences & équipe', text: 'Une journée fluide pour les enfants comme pour votre équipe.', items: ['Présences', 'Personnel', 'Activités', 'Repas'] },
    { title: 'Gestion & pilotage', text: 'Moins de tâches dispersées, plus de temps pour votre crèche.', items: ['Paiements', 'Rapports', 'Comptes', 'Paramètres'] },
    { title: 'Communication & réseau', text: 'Des familles rassurées et une Directrice bien entourée.', items: ['Communication', 'Notifications', 'Rawdha Connect', 'Aide & support'] },
  ],
  ar: [
    { title: 'الواجهة والأطفال', text: 'كل طفل منتظر ومتابَع منذ لحظة وصوله.', items: ['لوحة المتابعة', 'الأطفال', 'الأقسام', 'طلبات التسجيل'] },
    { title: 'الحضور والفريق', text: 'يوم سلس للأطفال كما لفريقك.', items: ['الحضور', 'الموظفون', 'الأنشطة', 'الوجبات'] },
    { title: 'التسيير والمتابعة', text: 'مهام متفرقة أقل ووقت أكثر لحضانتك.', items: ['الدفعات', 'التقارير', 'الحسابات'] },
    { title: 'التواصل والشبكة', text: 'أولياء مطمئنون ومديرة محاطة بشبكتها.', items: ['التواصل', 'الإشعارات', 'Rawdha Connect', 'المساعدة والدعم'] },
  ],
};

const copy = {
  fr: {
    nav: { platform: 'La plateforme', modules: 'Fonctionnalités', network: 'Rawdha Connect', login: 'Se connecter', request: 'Demander un accès' },
    footer: 'Plateforme professionnelle de gestion de crèche',
    menu: 'Ouvrir la navigation',
    close: 'Fermer la navigation',
    eyebrow: 'Pensé pour le vrai rythme des crèches',
    title: 'Votre journée est déjà pleine. Votre outil doit la rendre plus claire.',
    text: 'Rawdha+ aide votre équipe à accueillir les enfants, organiser chaque moment et donner aux familles les bonnes nouvelles au bon moment.',
    primary: 'Essai gratuit de 15 jours',
    secondary: 'Se connecter',
    guarantees: ['15 jours gratuits', 'Sans engagement', 'Toutes les fonctionnalités'],
    productLabel: 'Vue du matin',
    productTitle: 'Tout est prêt pour commencer la journée.',
    productItems: ['Arrivées et présences', 'Activité du jour', 'Informations repas'],
    dailyLabel: 'Une journée bien orchestrée',
    dailyTitle: 'Les détails du quotidien, enfin dans le bon ordre.',
    dailyText: 'Un espace de travail pensé autour de ce que votre équipe vit réellement, de l’accueil du matin au départ des enfants.',
    dailySteps: [
      { title: 'Accueillir avec attention', text: 'Chaque arrivée, absence et consigne est immédiatement visible.' },
      { title: 'Faire vivre la journée', text: 'Classes, activités, repas et équipe restent coordonnés.' },
      { title: 'Partager au bon moment', text: 'Les bonnes nouvelles rejoignent les familles avec simplicité.' },
      { title: 'Piloter avec confiance', text: 'La Directrice garde les repères utiles pour avancer.' },
    ],
    modulesLabel: 'Un espace, pas dix outils',
    modulesTitle: 'Tout ce qui aide votre crèche à avancer tient dans une même expérience.',
    modulesText: 'Admissions, enfants, repas, activités, familles, gestion et réseau : chaque partie est reliée au quotidien de votre équipe.',
    connectLabel: 'Rawdha Connect',
    connectTitle: 'Une communauté professionnelle, sans quitter votre environnement de travail.',
    connectText: 'Échangez vos pratiques, trouvez de nouvelles idées et restez au contact de Directrices qui vivent les mêmes journées.',
    connectItems: ['Fil professionnel', 'Messagerie entre Directrices', 'Annonces et notifications'],
    connectAction: 'Découvrir Rawdha Connect',
    securityLabel: 'Un cadre de confiance',
    securityTitle: 'Votre crèche garde son espace, simple et sécurisé.',
    securityText: 'Chaque demande est relue avant activation pour protéger votre équipe et les informations confiées par les familles.',
    securityStatus: 'Demande en attente',
    trialLabel: 'Prête à simplifier vos journées ?',
    trialTitle: '15 jours pour voir ce que Rawdha+ change vraiment dans votre crèche.',
    trialText: 'Découvrez toutes les fonctionnalités, sans engagement, avec vos habitudes de travail réelles.',
    finalPrimary: 'Commencer mon essai gratuit',
    finalSecondary: 'J’ai déjà un compte',
  },
  ar: {
    nav: { platform: 'المنصة', modules: 'الوظائف', network: 'Rawdha Connect', login: 'تسجيل الدخول', request: 'اطلبي الولوج' },
    footer: 'منصة احترافية لتسيير الحضانة',
    menu: 'فتح التنقل',
    close: 'غلق التنقل',
    eyebrow: 'مصممة لإيقاع الحضانات الحقيقي',
    title: 'يومكِ مليء بالفعل. أداتكِ يجب أن تجعله أوضح.',
    text: 'تساعد Rawdha+ فريقك على استقبال الأطفال وتنظيم كل لحظة ومشاركة الأخبار المناسبة مع الأولياء في الوقت المناسب.',
    primary: 'تجربة مجانية لمدة 15 يوماً',
    secondary: 'تسجيل الدخول',
    guarantees: ['15 يوماً مجاناً', 'دون التزام', 'كل الوظائف متاحة'],
    productLabel: 'مشهد الصباح',
    productTitle: 'كل شيء جاهز لبدء اليوم.',
    productItems: ['الوصول والحضور', 'نشاط اليوم', 'معلومات الوجبات'],
    dailyLabel: 'يوم منظم جيداً',
    dailyTitle: 'تفاصيل اليوم، أخيراً بالترتيب الصحيح.',
    dailyText: 'فضاء عمل مصمم حول ما يعيشه فريقك فعلاً، من استقبال الصباح إلى مغادرة الأطفال.',
    dailySteps: [
      { title: 'استقبال باهتمام', text: 'كل وصول وغياب وتعليمة يظهر مباشرة.' },
      { title: 'يوم حيّ', text: 'الأقسام والأنشطة والوجبات والفريق تبقى منسجمة.' },
      { title: 'مشاركة في الوقت المناسب', text: 'الأخبار المناسبة تصل إلى الأولياء ببساطة.' },
      { title: 'تسيير بثقة', text: 'تحتفظ المديرة بالمؤشرات المفيدة للتقدم.' },
    ],
    modulesLabel: 'فضاء واحد، لا عشر أدوات',
    modulesTitle: 'كل ما يساعد حضانتك على التقدم يجتمع في تجربة واحدة.',
    modulesText: 'التسجيل والأطفال والوجبات والأنشطة والأولياء والتسيير والشبكة: كل جزء مرتبط بيوم فريقك.',
    connectLabel: 'Rawdha Connect',
    connectTitle: 'مجتمع مهني دون مغادرة بيئة عملك.',
    connectText: 'تبادلي الممارسات واكتشفي أفكاراً جديدة وابقَي على اتصال بمديرات يعشن الأيام نفسها.',
    connectItems: ['منشورات مهنية', 'رسائل بين المديرات', 'إعلانات وإشعارات'],
    connectAction: 'اكتشفي Rawdha Connect',
    securityLabel: 'إطار موثوق',
    securityTitle: 'حضانتك تحتفظ بفضائها، ببساطة وأمان.',
    securityText: 'يُراجع كل طلب قبل التفعيل لحماية فريقك والمعلومات التي يمنحها الأولياء.',
    securityStatus: 'الطلب في انتظار المراجعة',
    trialLabel: 'هل أنتِ مستعدة لتبسيط يومكِ؟',
    trialTitle: '15 يوماً لترَي ما الذي تغيّره Rawdha+ فعلاً في حضانتك.',
    trialText: 'اكتشفي كل الوظائف دون التزام، ومع عادات عمل فريقك الحقيقية.',
    finalPrimary: 'بدء التجربة المجانية',
    finalSecondary: 'لدي حساب بالفعل',
  },
};

const heroChildCutout = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894126178/dMkiqSbJoYNzfQRA.png';
const educatorCutout = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894126178/RHSIOiqWXzjCBuwj.png';
const childrenConnectCutout = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894126178/wBBSQnFEgEEjxLoo.png';

const dailyTones = ['border-[#f2d3bf] bg-[#fffaf7]', 'border-[#cfe1ee] bg-[#f8fcff]', 'border-[#d4e2c7] bg-[#fbfdf8]', 'border-[#e4d9cc] bg-[#fffdf9]'];
const dailyAccent = ['bg-[#f26b4d]', 'bg-[#0876c9]', 'bg-[#679751]', 'bg-[#d49d26]'];
const groupAccent = ['before:bg-[#f26b4d]', 'before:bg-[#0876c9]', 'before:bg-[#679751]', 'before:bg-[#d49d26]'];

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

  const productSidePadding = isArabic ? 'lg:pl-48' : 'lg:pr-48';
  const productChildPosition = isArabic ? '-left-9' : '-right-9';

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="min-h-screen overflow-x-hidden bg-[#f7f8fa] text-[#10293a]">
      <style>{`
        @keyframes rawdha-child-float { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-9px) rotate(0.7deg); } }
        @keyframes rawdha-educator-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .landing-hero { background: radial-gradient(circle at 76% 17%, rgba(249, 199, 79, 0.17), transparent 24%), radial-gradient(circle at 12% 94%, rgba(242, 107, 77, 0.16), transparent 27%), #10293a; }
        .landing-grid { background-image: linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px); background-size: 28px 28px; }
        .product-surface { box-shadow: 0 28px 65px rgba(0, 0, 0, 0.25); }
        .landing-card { transition: transform 220ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 220ms cubic-bezier(0.23, 1, 0.32, 1), border-color 220ms ease-out; }
        .module-card { position: relative; overflow: hidden; }
        .module-card::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 4px; }
        .module-card[dir='rtl']::before { inset: 0 0 0 auto; }
        @media (hover: hover) and (prefers-reduced-motion: no-preference) { .landing-card:hover { transform: translateY(-5px); box-shadow: 0 20px 40px rgba(16, 41, 58, 0.12); } }
        .landing-card:active { transform: scale(0.985); }
        @media (prefers-reduced-motion: no-preference) { .rawdah-child-float { animation: rawdha-child-float 5.8s ease-in-out infinite; } .rawdah-educator-float { animation: rawdha-educator-float 6.8s ease-in-out infinite; } }
        @media (prefers-reduced-motion: reduce) { .rawdah-child-float, .rawdah-educator-float { animation: none; } }
        @media (min-width: 1280px) { .module-card:nth-child(1), .module-card:nth-child(4) { grid-column: span 2 / span 2; } }
      `}</style>

      <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex min-w-0 items-center gap-2.5 text-start" aria-label="Rawdha+">
            <img src="/rawdah-logo.png" alt="Rawdha+" className="h-10 w-10 shrink-0 rounded-full object-contain" />
            <span className="min-w-0 leading-none"><span className="block text-sm font-black tracking-[-0.04em] text-[#10293a]">RAWDHA<span className="text-[#f26b4d]">+</span></span><span className={`mt-1 hidden whitespace-nowrap font-bold text-slate-500 sm:block ${isArabic ? 'text-[10px]' : 'text-[8px] uppercase tracking-[0.07em]'}`}>{content.footer}</span></span>
          </button>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigation principale">
            <button type="button" onClick={() => scrollTo('plateforme')} className="text-sm font-bold text-slate-700 transition hover:text-[#f26b4d]">{content.nav.platform}</button>
            <button type="button" onClick={() => scrollTo('modules')} className="text-sm font-bold text-slate-700 transition hover:text-[#f26b4d]">{content.nav.modules}</button>
            <button type="button" onClick={() => scrollTo('connect')} className="text-sm font-bold text-slate-700 transition hover:text-[#f26b4d]">{content.nav.network}</button>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <div className="flex rounded-full border border-slate-200 bg-slate-50 p-0.5"><button type="button" onClick={() => setLanguage('fr')} aria-pressed={!isArabic} className={`rounded-full px-2.5 py-1 text-[10px] font-black ${!isArabic ? 'bg-[#10293a] text-white' : 'text-slate-600'}`}>FR</button><button type="button" onClick={() => setLanguage('ar')} aria-pressed={isArabic} className={`rounded-full px-2.5 py-1 text-[10px] font-black ${isArabic ? 'bg-[#10293a] text-white' : 'text-slate-600'}`}>ع</button></div>
            <button type="button" onClick={() => onNavigate('login')} className="text-sm font-bold text-slate-700 transition hover:text-[#f26b4d]">{content.nav.login}</button>
            <button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center gap-2 rounded-xl bg-[#10293a] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#f26b4d] active:scale-[0.98]">{content.nav.request}<Arrow className="h-4 w-4" /></button>
          </div>

          <button type="button" onClick={() => setMenuOpen((value) => !value)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-[#10293a] md:hidden" aria-label={menuOpen ? content.close : content.menu}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {menuOpen && <div className="border-t border-slate-200 bg-white p-4 md:hidden"><div className="mx-auto max-w-7xl space-y-2"><div className="flex items-center justify-between rounded-xl bg-slate-50 p-2"><span className="text-xs font-bold text-slate-700">{isArabic ? 'لغة الواجهة' : 'Langue de l’interface'}</span><div className="flex rounded-lg border border-slate-200 bg-white p-0.5"><button type="button" onClick={() => setLanguage('fr')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${!isArabic ? 'bg-[#10293a] text-white' : 'text-slate-600'}`}>Français</button><button type="button" onClick={() => setLanguage('ar')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${isArabic ? 'bg-[#10293a] text-white' : 'text-slate-600'}`}>العربية</button></div></div>{[['plateforme', content.nav.platform], ['modules', content.nav.modules], ['connect', content.nav.network]].map(([id, label]) => <button key={id} type="button" onClick={() => scrollTo(id)} className="block w-full rounded-xl px-3 py-3 text-start text-sm font-bold text-slate-700 hover:bg-slate-50">{label}</button>)}<div className="grid grid-cols-2 gap-2 pt-2"><button type="button" onClick={() => onNavigate('login')} className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-bold text-slate-700">{content.nav.login}</button><button type="button" onClick={() => onNavigate('request')} className="rounded-xl bg-[#f26b4d] px-3 py-3 text-sm font-bold text-white">{content.nav.request}</button></div></div></div>}
      </header>

      <main>
        <section id="plateforme" className="landing-hero landing-grid relative overflow-hidden px-4 py-14 text-white sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.88fr] lg:items-center lg:gap-16">
            <div className="max-w-2xl"><p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#f9c74f]"><span className="h-2 w-2 rounded-full bg-[#f26b4d]" />{content.eyebrow}</p><h1 className="mt-5 text-4xl font-black leading-[1.03] tracking-[-0.055em] sm:text-5xl lg:text-6xl">{content.title}</h1><p className="mt-7 max-w-xl text-base font-medium leading-7 text-slate-300 sm:text-lg">{content.text}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f26b4d] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#ff8264] active:scale-[0.98]">{content.primary}<Arrow className="h-4 w-4" /></button><button type="button" onClick={() => onNavigate('login')} className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 py-3.5 text-sm font-bold text-white transition hover:border-white/50 hover:bg-white/10">{content.secondary}</button></div><div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-300">{content.guarantees.map((item) => <span key={item} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#f9c74f]" />{item}</span>)}</div><div className="relative mt-7 flex h-48 justify-center md:hidden"><span className="absolute bottom-1 h-28 w-28 rounded-full bg-[#f9c74f]/20 blur-xl" /><img src={heroChildCutout} alt="" className="rawdah-child-float relative z-10 h-52 w-auto object-contain" /></div></div>
            <div className="relative hidden min-h-[420px] md:block"><div className={`product-surface relative z-10 mt-8 rounded-[2rem] border border-white/15 bg-[#f8fbfe] p-6 text-[#10293a] ${productSidePadding}`}><div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5"><div className="flex items-center gap-3"><img src="/rawdah-logo.png" alt="" className="h-10 w-10 rounded-full object-contain" /><div><p className="text-sm font-black tracking-[-0.03em]">RAWDHA+</p><p className="text-xs font-medium text-slate-500">{content.productLabel}</p></div></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{isArabic ? 'اليوم' : 'Aujourd’hui'}</span></div><div className="mt-8"><span className="text-[10px] font-black uppercase tracking-[0.13em] text-[#f26b4d]">{isArabic ? 'تنظيم اليوم' : 'Organisation du jour'}</span><h2 className="mt-3 max-w-md text-2xl font-black leading-tight tracking-[-0.035em]">{content.productTitle}</h2></div><div className="mt-7 space-y-3">{content.productItems.map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_8px_18px_rgba(16,41,58,0.04)]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-[#0876c9]">{index === 0 ? <CalendarCheck className="h-4 w-4" /> : index === 1 ? <ClipboardList className="h-4 w-4" /> : <Bell className="h-4 w-4" />}</span><span className="text-sm font-bold text-slate-700">{item}</span></div>)}</div></div><span className={`absolute ${productChildPosition} -top-1 z-20 h-40 w-40 rounded-full bg-[#f9c74f]/25 blur-2xl`} /><img src={heroChildCutout} alt="" className={`rawdah-child-float pointer-events-none absolute ${productChildPosition} -top-9 z-30 h-[330px] w-auto object-contain`} /></div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-[#f7f8fa] px-4 py-16 sm:px-6 sm:py-24 lg:px-8"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16"><div className="max-w-xl"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#f26b4d]">{content.dailyLabel}</p><h2 className="mt-4 text-3xl font-black leading-[1.08] tracking-[-0.045em] text-[#10293a] sm:text-4xl">{content.dailyTitle}</h2><p className="mt-5 text-base font-medium leading-7 text-slate-600">{content.dailyText}</p><div className="relative mt-8 hidden min-h-[260px] overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white lg:block"><span className="absolute right-7 top-7 h-20 w-20 rounded-full bg-[#f9c74f]/30" /><img src={educatorCutout} alt="" className="rawdah-educator-float absolute bottom-0 left-1/2 h-[295px] w-auto -translate-x-1/2 object-contain" /></div></div><div className="grid gap-4 sm:grid-cols-2 sm:content-start">{content.dailySteps.map((step, index) => <article key={step.title} className={`landing-card rounded-[1.5rem] border p-5 ${dailyTones[index]}`}><div className="flex items-center justify-between gap-3"><span className={`grid h-9 w-9 place-items-center rounded-full text-xs font-black text-white ${dailyAccent[index]}`}>0{index + 1}</span><span className="h-px flex-1 bg-slate-200" /></div><h3 className="mt-7 text-lg font-black tracking-[-0.025em] text-[#10293a]">{step.title}</h3><p className="mt-3 text-sm font-medium leading-6 text-slate-600">{step.text}</p></article>)}</div></div></section>

        <section id="modules" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8"><div className="mx-auto max-w-7xl"><div className="grid gap-6 border-b border-slate-200 pb-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-end"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#f26b4d]">{content.modulesLabel}</p><h2 className="mt-4 max-w-2xl text-3xl font-black leading-[1.08] tracking-[-0.045em] text-[#10293a] sm:text-4xl">{content.modulesTitle}</h2></div><p className="max-w-2xl text-base font-medium leading-7 text-slate-600">{content.modulesText}</p></div><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{groups.map((group, index) => <article key={group.title} dir={isArabic ? 'rtl' : 'ltr'} className={`landing-card module-card rounded-[1.5rem] border border-slate-200 bg-[#fbfcfd] p-6 ${groupAccent[index]}`}><p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">0{index + 1}</p><h3 className="mt-6 text-lg font-black tracking-[-0.025em] text-[#10293a]">{group.title}</h3><p className="mt-3 max-w-md text-sm font-medium leading-6 text-slate-600">{group.text}</p><ul className="mt-6 grid gap-2 border-t border-slate-200 pt-4 text-sm font-bold text-slate-700">{group.items.map((item) => <li key={item} className="flex items-center gap-2"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />{item}</li>)}</ul></article>)}</div></div></section>

        <section id="connect" className="scroll-mt-20 bg-[#10293a] px-4 py-16 text-white sm:px-6 sm:py-24 lg:px-8"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16"><div><div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#f9c74f]"><Network className="h-4 w-4" />{content.connectLabel}</div><h2 className="mt-5 max-w-2xl text-3xl font-black leading-[1.08] tracking-[-0.045em] sm:text-4xl">{content.connectTitle}</h2><p className="mt-5 max-w-xl text-base font-medium leading-7 text-slate-300">{content.connectText}</p><button type="button" onClick={() => onNavigate('login')} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#f26b4d] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#ff8264] active:scale-[0.98]">{content.connectAction}<Arrow className="h-4 w-4" /></button></div><div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 sm:p-7"><span className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#0876c9]/25 blur-2xl" /><div className={`relative z-10 rounded-[1.5rem] border border-white/10 bg-[#f7f8fa] p-5 text-[#10293a] ${isArabic ? 'lg:pl-44' : 'lg:pr-44'}`}><div className="flex items-center justify-between"><p className="text-sm font-black">Rawdha Connect</p><span className="h-2 w-2 rounded-full bg-[#679751]" /></div><div className="mt-6 space-y-3">{content.connectItems.map((item, index) => <div key={item} className="landing-card flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#fff0eb] text-[#f26b4d]">{index === 0 ? <Network className="h-4 w-4" /> : index === 1 ? <MessageCircle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}</span><span className="text-sm font-bold text-slate-700">{item}</span></div>)}</div></div><img src={childrenConnectCutout} alt="" className={`rawdah-child-float pointer-events-none absolute bottom-2 z-20 h-52 w-auto object-contain sm:h-60 ${isArabic ? '-left-6' : '-right-6'}`} /></div></div></section>

        <section className="bg-[#f7f8fa] px-4 py-16 sm:px-6 sm:py-24 lg:px-8"><div className="mx-auto grid max-w-7xl gap-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(16,41,58,0.06)] sm:p-10 lg:grid-cols-[1fr_0.72fr] lg:items-center lg:p-12"><div><div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#f26b4d]"><ShieldCheck className="h-4 w-4" />{content.securityLabel}</div><h2 className="mt-5 text-3xl font-black leading-[1.08] tracking-[-0.045em] text-[#10293a] sm:text-4xl">{content.securityTitle}</h2><p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-600">{content.securityText}</p></div><div className="landing-card rounded-[1.5rem] border border-slate-200 bg-[#fbfcfd] p-6 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#fff0eb] text-[#f26b4d]"><ShieldCheck className="h-7 w-7" /></span><p className="mt-5 text-sm font-black text-[#10293a]">{content.securityStatus}</p><p className="mt-2 text-xs font-bold text-emerald-700">{isArabic ? 'تحت مراجعة المسؤول' : 'En cours de vérification'}</p><p className="mt-5 rounded-xl border border-[#f2d3bf] bg-[#fffaf7] p-3 text-xs font-medium text-slate-600">{isArabic ? 'يتم التفعيل بعد مراجعة الطلب.' : 'Activation après vérification de la demande.'}</p></div></div></section>

        <section className="bg-[#f26b4d] px-4 py-16 text-white sm:px-6 sm:py-24 lg:px-8"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.76fr] lg:items-end"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#10293a]">{content.trialLabel}</p><h2 className="mt-5 max-w-3xl text-3xl font-black leading-[1.05] tracking-[-0.05em] sm:text-5xl">{content.trialTitle}</h2><p className="mt-5 max-w-2xl text-base font-medium leading-7 text-white/85">{content.trialText}</p><div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-white/90"><span>15 {isArabic ? 'يوماً' : 'jours'}</span><span>•</span><span>{isArabic ? 'دون التزام' : 'Sans engagement'}</span><span>•</span><span>{isArabic ? 'كل الوظائف' : 'Toutes les fonctionnalités'}</span></div></div><div className="rounded-[1.75rem] bg-[#10293a] p-6 shadow-[0_22px_45px_rgba(104,35,25,0.25)]"><h3 className="text-xl font-black">{isArabic ? 'ابدئي عندما تكونين مستعدة.' : 'Commencez quand vous êtes prête.'}</h3><div className="mt-6 flex flex-col gap-3"><button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-[#10293a] transition hover:bg-[#f9c74f] active:scale-[0.98]">{content.finalPrimary}<Arrow className="h-4 w-4" /></button><button type="button" onClick={() => onNavigate('login')} className="rounded-xl border border-white/25 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">{content.finalSecondary}</button></div></div></div></section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-7 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><img src="/rawdah-logo.png" alt="Rawdha+" className="h-8 w-8 rounded-full object-contain" /><span className="font-black text-[#10293a]">RAWDHA<span className="text-[#f26b4d]">+</span></span><span>{content.footer}</span></div><div className="flex items-center gap-3"><Globe2 className="h-4 w-4" /><button type="button" onClick={() => setLanguage(isArabic ? 'fr' : 'ar')} className="font-bold text-slate-700 hover:text-[#f26b4d]">{isArabic ? 'Français' : 'العربية'}</button><span>© 2026 RAWDHA+</span></div></div></footer>
    </div>
  );
}
