/**
 * Style context — Rawdha+ « Jardin de journée » : vitrine de crèche chaleureuse, colorée et stable.
 * Les séparations organiques restent dans le flux, les personnages ont leur zone de sécurité et les mouvements utilisent uniquement transform/opacity.
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
    { title: 'Accueil & enfants', text: 'Chaque enfant est attendu, suivi et accompagné dès son arrivée.', items: ['Tableau de bord', 'Enfants', 'Classes', 'Admissions'] },
    { title: 'Présences & équipe', text: 'Une journée fluide pour les enfants comme pour votre équipe.', items: ['Présences', 'Personnel', 'Activités', 'Repas'] },
    { title: 'Gestion & pilotage', text: 'Moins de tâches dispersées, plus de temps pour votre crèche.', items: ['Paiements', 'Rapports', 'Comptes', 'Paramètres'] },
    { title: 'Communication & réseau', text: 'Des familles rassurées et une Directrice bien entourée.', items: ['Communication', 'Notifications', 'Rawdha Connect', 'Aide & support'] },
  ],
  ar: [
    { title: 'الواجهة والأطفال', text: 'كل طفل منتظر ومتابَع منذ لحظة وصوله.', items: ['لوحة المتابعة', 'الأطفال', 'الأقسام', 'طلبات التسجيل'] },
    { title: 'الحضور والفريق', text: 'يوم سلس للأطفال كما لفريقك.', items: ['الحضور', 'الموظفون', 'الأنشطة', 'الوجبات'] },
    { title: 'التسيير والمتابعة', text: 'مهام متفرقة أقل ووقت أكثر لحضانتك.', items: ['الدفعات', 'التقارير', 'الحسابات', 'الإعدادات'] },
    { title: 'التواصل والشبكة', text: 'أولياء مطمئنون ومديرة محاطة بشبكتها.', items: ['التواصل', 'الإشعارات', 'Rawdha Connect', 'المساعدة والدعم'] },
  ],
};

const copy = {
  fr: {
    nav: { platform: 'La plateforme', modules: 'Fonctionnalités', network: 'Rawdha Connect', login: 'Se connecter', request: 'Demander un accès' },
    footer: 'Plateforme professionnelle de gestion de crèche',
    menu: 'Ouvrir la navigation',
    close: 'Fermer la navigation',
    eyebrow: 'Pour les crèches qui font grandir les petits chaque jour',
    title: 'Plus de temps pour les enfants. Plus de sérénité pour votre crèche.',
    text: 'Rawdha+ aide votre équipe à accueillir les enfants, partager les bonnes informations aux familles et vivre chaque journée avec plus de simplicité.',
    primary: 'Essai gratuit de 15 jours',
    secondary: 'Se connecter',
    guarantees: ['15 jours gratuits', 'Sans engagement', 'Toutes les fonctionnalités'],
    productLabel: 'Un matin à la crèche',
    productTitle: 'Commencer la journée avec tout ce qu’il faut pour bien accueillir.',
    productItems: ['Arrivées et présences', 'Activité du jour', 'Informations repas'],
    dailyLabel: 'Une journée qui fait du bien',
    dailyTitle: 'Des enfants attendus, des familles rassurées, une équipe alignée.',
    dailyText: 'Rawdha+ accompagne les moments concrets de la crèche, du premier bonjour jusqu’au départ des enfants.',
    dailySteps: [
      { title: 'Bien accueillir', text: 'Chaque arrivée, absence et consigne est à portée de main.' },
      { title: 'Faire vivre la journée', text: 'Classes, activités, repas et équipe restent coordonnés.' },
      { title: 'Rassurer les familles', text: 'Les bonnes nouvelles arrivent au bon moment.' },
      { title: 'Garder le cap', text: 'La Directrice pilote sa crèche avec des repères fiables.' },
    ],
    modulesLabel: 'La crèche, dans tous ses moments',
    modulesTitle: 'Ce dont votre équipe a besoin pour prendre soin du quotidien.',
    modulesText: 'Admissions, enfants, repas, activités, familles et gestion : chaque espace est pensé pour soutenir ce qui se passe vraiment dans votre crèche.',
    connectLabel: 'Rawdha Connect',
    connectTitle: 'Parce qu’une Directrice ne devrait jamais avancer seule.',
    connectText: 'Échangez vos pratiques, trouvez des idées pour vos enfants et restez connectée à des Directrices qui vivent le même quotidien.',
    connectItems: ['Fil professionnel', 'Messagerie entre Directrices', 'Annonces et notifications'],
    connectAction: 'Découvrir Rawdha Connect',
    securityLabel: 'Un espace qui vous ressemble',
    securityTitle: 'Votre crèche garde un espace à elle, simple et sécurisé.',
    securityText: 'Chaque demande est relue avant l’activation pour que votre équipe et les informations de vos familles restent protégées.',
    securityStatus: 'Demande en attente',
    trialLabel: 'Commencez en douceur',
    trialTitle: '15 jours pour imaginer des journées de crèche plus sereines.',
    trialText: 'Découvrez toutes les fonctionnalités sans engagement et voyez comment Rawdha+ peut accompagner votre équipe et vos familles.',
    finalPrimary: 'Commencer mon essai gratuit',
    finalSecondary: 'J’ai déjà un compte',
  },
  ar: {
    nav: { platform: 'المنصة', modules: 'الوظائف', network: 'Rawdha Connect', login: 'تسجيل الدخول', request: 'اطلبي الولوج' },
    footer: 'منصة احترافية لتسيير الحضانة',
    menu: 'فتح التنقل',
    close: 'غلق التنقل',
    eyebrow: 'للحضانات التي تساعد الصغار على النمو كل يوم',
    title: 'وقت أكثر للأطفال. وراحة أكبر لحضانتك.',
    text: 'تساعد Rawdha+ فريقك على استقبال الأطفال ومشاركة المعلومات المناسبة مع الأولياء وعيش كل يوم ببساطة أكبر.',
    primary: 'تجربة مجانية لمدة 15 يوماً',
    secondary: 'تسجيل الدخول',
    guarantees: ['15 يوماً مجاناً', 'دون التزام', 'كل الوظائف متاحة'],
    productLabel: 'صباح في الحضانة',
    productTitle: 'ابدئي اليوم بكل ما تحتاجينه لاستقبال الأطفال جيداً.',
    productItems: ['الوصول والحضور', 'نشاط اليوم', 'معلومات الوجبات'],
    dailyLabel: 'يوم يمنحك راحة أكثر',
    dailyTitle: 'أطفال منتظرون، أولياء مطمئنون، وفريق منسجم.',
    dailyText: 'ترافق Rawdha+ لحظات الحضانة الحقيقية، من أول تحية إلى مغادرة الأطفال.',
    dailySteps: [
      { title: 'استقبال جيد', text: 'كل وصول وغياب وتعليمة في متناول يدك.' },
      { title: 'يوم حيّ', text: 'الأقسام والأنشطة والوجبات والفريق تبقى منسجمة.' },
      { title: 'طمأنة الأولياء', text: 'الأخبار المناسبة تصل في الوقت المناسب.' },
      { title: 'تسيير بثقة', text: 'تدير المديرة حضانتها بمؤشرات موثوقة.' },
    ],
    modulesLabel: 'الحضانة في كل لحظاتها',
    modulesTitle: 'ما يحتاجه فريقك للعناية بيومه.',
    modulesText: 'التسجيل والأطفال والوجبات والأنشطة والأولياء والتسيير: كل فضاء مصمم لدعم ما يحدث فعلاً في حضانتك.',
    connectLabel: 'Rawdha Connect',
    connectTitle: 'لأن المديرة لا ينبغي أن تتقدم وحدها.',
    connectText: 'تبادلي الممارسات واكتشفي أفكاراً للأطفال وابقَي على اتصال بمديرات يعشن اليوم نفسه.',
    connectItems: ['منشورات مهنية', 'رسائل بين المديرات', 'إعلانات وإشعارات'],
    connectAction: 'اكتشفي Rawdha Connect',
    securityLabel: 'فضاء يشبه حضانتك',
    securityTitle: 'حضانتك تحتفظ بفضاء خاص، بسيط وآمن.',
    securityText: 'يُراجع كل طلب قبل التفعيل حتى تبقى معلومات فريقك وأولياء أطفالك محمية.',
    securityStatus: 'الطلب في انتظار المراجعة',
    trialLabel: 'ابدئي بهدوء',
    trialTitle: '15 يوماً لتتخيلي أياماً أكثر راحة في الحضانة.',
    trialText: 'اكتشفي كل الوظائف دون التزام وانظري كيف ترافق Rawdha+ فريقك وأولياء أطفالك.',
    finalPrimary: 'بدء التجربة المجانية',
    finalSecondary: 'لدي حساب بالفعل',
  },
};

const heroChildCutout = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894126178/dMkiqSbJoYNzfQRA.png';
const educatorCutout = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894126178/RHSIOiqWXzjCBuwj.png';
const childrenConnectCutout = 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894126178/wBBSQnFEgEEjxLoo.png';

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
    <div dir={isArabic ? 'rtl' : 'ltr'} className="min-h-screen overflow-x-hidden bg-[#fff9f0] text-[#10293a]">
      <style>{`
        @keyframes rawdha-child-float { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-10px) rotate(1deg); } }
        @keyframes rawdha-educator-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @media (prefers-reduced-motion: no-preference) {
          .rawdah-child-float { animation: rawdha-child-float 5.5s ease-in-out infinite; }
          .rawdah-educator-float { animation: rawdha-educator-float 6.5s ease-in-out infinite; }
        }
        @media (prefers-reduced-motion: reduce) { .rawdah-child-float, .rawdah-educator-float { animation: none; } }
        .landing-hero { background: radial-gradient(circle at 85% 17%, rgba(249, 199, 79, 0.34) 0, rgba(249, 199, 79, 0.12) 9%, transparent 27%), radial-gradient(circle at 7% 88%, rgba(242, 107, 77, 0.13) 0, transparent 22%), #fff9f0; }
        .landing-curve { position: relative; z-index: 1; margin-top: -2rem; border-radius: 2.5rem 2.5rem 0 0; padding-top: 5.5rem; }
        .landing-daily { background: radial-gradient(circle at 94% 20%, rgba(249, 199, 79, 0.22) 0, transparent 18%), #eaf6ff; }
        .landing-modules { background: radial-gradient(circle at 7% 16%, rgba(242, 107, 77, 0.14) 0, transparent 17%), #fff6d9; }
        .landing-connect { background: radial-gradient(circle at 92% 16%, rgba(8, 118, 201, 0.12) 0, transparent 20%), #e8f6df; }
        .landing-security { background: radial-gradient(circle at 8% 82%, rgba(249, 199, 79, 0.28) 0, transparent 18%), #fff0eb; }
        .landing-trial { background: #10293a; }
        .landing-lift { transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 200ms cubic-bezier(0.23, 1, 0.32, 1), border-color 200ms ease-out; }
        .landing-daily article:nth-child(1) { border-color: #f4c96b; background: #fffdf7; }
        .landing-daily article:nth-child(2) { border-color: #b7dcf3; background: #fafdff; }
        .landing-daily article:nth-child(3) { border-color: #c8df9a; background: #fcfff7; }
        .landing-daily article:nth-child(4) { border-color: #f4b5a3; background: #fffaf8; }
        .landing-daily article:nth-child(1) > span { background: #e4a329; }
        .landing-daily article:nth-child(2) > span { background: #0876c9; }
        .landing-daily article:nth-child(3) > span { background: #5d9b42; }
        .landing-daily article:nth-child(4) > span { background: #e56b4d; }
        .landing-modules article:nth-child(1) { border-color: #f2cb6c; background: #fffdf8; }
        .landing-modules article:nth-child(2) { border-color: #a6d7f5; background: #fbfeff; }
        .landing-modules article:nth-child(3) { border-color: #b9df9b; background: #fbfff7; }
        .landing-modules article:nth-child(4) { border-color: #f3b0a0; background: #fff9f7; }
        .landing-connect-card { border-color: #b9dcaa; box-shadow: 0 18px 45px rgba(50, 95, 48, 0.08); }
        .landing-security-card { border-color: #f1c3b5; background: #fffaf8; }
        .landing-trial-card { border: 3px solid #f9c74f; box-shadow: 0 18px 42px rgba(4, 21, 31, 0.22); }
        .landing-lift:active { transform: scale(0.985); }
        @media (hover: hover) and (prefers-reduced-motion: no-preference) { .landing-lift:hover { transform: translateY(-4px); box-shadow: 0 15px 28px rgba(16, 41, 58, 0.12); } }
        @media (min-width: 640px) { .landing-curve { margin-top: -2.5rem; border-radius: 3.5rem 3.5rem 0 0; padding-top: 7.5rem; } }
      `}</style>
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
        <section id="plateforme" className="landing-hero relative overflow-hidden px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-20">
            <div className="max-w-2xl"><p className="text-sm font-bold text-[#0876c9]">{content.eyebrow}</p><h1 className="mt-4 text-4xl font-black leading-[1.08] tracking-tight text-[#10293a] sm:text-5xl lg:text-6xl">{content.title}</h1><p className="mt-6 text-base font-medium leading-7 text-slate-600 sm:text-lg">{content.text}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0876c9] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#0666ae] active:scale-[0.98]">{content.primary}<Arrow className="h-4 w-4" /></button><button type="button" onClick={() => onNavigate('login')} className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:border-[#0876c9] hover:text-[#0876c9]">{content.secondary}</button></div><div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-600">{content.guarantees.map((item) => <span key={item} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{item}</span>)}</div><div className="relative mt-5 flex h-44 justify-end md:hidden"><span className="absolute bottom-3 right-2 h-24 w-24 rounded-full bg-amber-50" /><img src={heroChildCutout} alt="" className="rawdah-child-float relative z-10 h-48 w-auto object-contain" /></div></div>
            <div className="relative hidden min-h-[390px] md:block"><span className="absolute -right-3 top-7 h-36 w-36 rounded-full bg-amber-50" /><img src={heroChildCutout} alt="" className="rawdah-child-float pointer-events-none absolute -right-10 -top-9 z-20 h-[330px] w-auto object-contain lg:h-[350px]" /><aside className="relative z-10 mt-10 mr-20 rounded-2xl border border-slate-200 bg-[#f8fbfe] p-5 shadow-sm lg:pr-48"><div className="flex items-center justify-between border-b border-slate-200 pb-4"><div className="flex items-center gap-3"><img src="/rawdah-logo.png" alt="" className="h-10 w-10 rounded-full object-contain" /><div><p className="text-sm font-black text-[#10293a]">RAWDHA+</p><p className="text-xs font-medium text-slate-500">{content.productLabel}</p></div></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{isArabic ? 'اليوم' : 'Aujourd’hui'}</span></div><h2 className="mt-7 text-2xl font-black leading-tight text-[#10293a]">{content.productTitle}</h2><div className="mt-6 space-y-3">{content.productItems.map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-[#0876c9]">{index === 0 ? <CalendarCheck className="h-4 w-4" /> : index === 1 ? <ClipboardList className="h-4 w-4" /> : <Bell className="h-4 w-4" />}</span><span className="text-sm font-bold text-slate-700">{item}</span></div>)}</div></aside></div>
          </div>
        </section>

        <section className="landing-curve landing-daily px-4 py-14 sm:px-6 sm:py-20 lg:px-8"><div className="mx-auto max-w-7xl"><div className="max-w-3xl"><p className="text-sm font-bold text-[#0876c9]">{content.dailyLabel}</p><h2 className="mt-3 text-3xl font-black tracking-tight text-[#10293a] sm:text-4xl">{content.dailyTitle}</h2><p className="mt-4 text-base font-medium leading-7 text-slate-600">{content.dailyText}</p></div><div className="mt-10 grid gap-6 lg:grid-cols-[0.58fr_1.42fr] lg:items-end"><div className="relative hidden min-h-[310px] rounded-[2rem] border border-[#b7dcf3] bg-[#fffdf7] lg:block"><span className="absolute left-8 top-8 h-20 w-20 rounded-full bg-[#f9c74f]/30" /><img src={educatorCutout} alt="" className="rawdah-educator-float absolute bottom-0 left-1/2 z-10 h-[340px] w-auto -translate-x-1/2 object-contain" /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{content.dailySteps.map((step, index) => <article key={step.title} className="landing-lift rounded-2xl border p-5"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#0876c9] text-xs font-black text-white">0{index + 1}</span><h3 className="mt-5 text-lg font-black text-[#10293a]">{step.title}</h3><p className="mt-2 text-sm font-medium leading-6 text-slate-600">{step.text}</p></article>)}</div></div></div></section>

        <section id="modules" className="landing-curve landing-modules scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20 lg:px-8"><div className="mx-auto max-w-7xl"><div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end"><div><p className="text-sm font-bold text-[#c9641f]">{content.modulesLabel}</p><h2 className="mt-3 text-3xl font-black tracking-tight text-[#10293a] sm:text-4xl">{content.modulesTitle}</h2></div><p className="max-w-2xl text-base font-medium leading-7 text-slate-600">{content.modulesText}</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{groups.map((group) => <article key={group.title} className="landing-lift rounded-2xl border p-5 shadow-sm"><h3 className="text-base font-black text-[#10293a]">{group.title}</h3><p className="mt-2 min-h-12 text-sm font-medium leading-6 text-slate-600">{group.text}</p><ul className="mt-5 border-t border-slate-200 pt-2 text-sm font-bold text-slate-700">{group.items.map((item) => <li key={item} className="border-b border-slate-100 py-2.5 last:border-b-0">{item}</li>)}</ul></article>)}</div></div></section>

        <section id="connect" className="landing-curve landing-connect scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20 lg:px-8"><div className="landing-connect-card mx-auto grid max-w-7xl gap-10 rounded-[2rem] border bg-[#fffdf7] p-6 sm:p-10 lg:grid-cols-[1fr_0.78fr] lg:items-center lg:p-12"><div><div className="inline-flex items-center gap-2 text-sm font-bold text-[#4c8737]"><Network className="h-4 w-4" />{content.connectLabel}</div><h2 className="mt-4 text-3xl font-black tracking-tight text-[#10293a] sm:text-4xl">{content.connectTitle}</h2><p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600">{content.connectText}</p><button type="button" onClick={() => onNavigate('login')} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#4c8737] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#3e702d] active:scale-[0.98]">{content.connectAction}<Arrow className="h-4 w-4" /></button></div><div className="relative min-h-[280px] rounded-2xl border border-[#b9dcaa] bg-[#f7fff4] p-5 sm:min-h-[300px] lg:pr-44"><p className="relative z-10 text-sm font-black text-[#10293a]">Rawdha Connect</p><div className="relative z-10 mt-5 space-y-3">{content.connectItems.map((item, index) => <div key={item} className="landing-lift flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e8f6df] text-[#4c8737]">{index === 0 ? <Network className="h-4 w-4" /> : index === 1 ? <MessageCircle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}</span><span className="text-sm font-bold text-slate-700">{item}</span></div>)}</div><span className="absolute bottom-4 right-4 h-24 w-24 rounded-full bg-[#f9c74f]/30" /><img src={childrenConnectCutout} alt="" className="rawdah-child-float pointer-events-none absolute bottom-0 right-0 z-10 h-52 w-auto object-contain sm:h-60" /></div></div></section>

        <section className="landing-curve landing-security px-4 py-14 sm:px-6 sm:py-20 lg:px-8"><div className="landing-security-card mx-auto grid max-w-7xl gap-8 rounded-[2rem] border p-6 sm:p-10 lg:grid-cols-[1fr_0.64fr] lg:items-center lg:p-12"><div><div className="inline-flex items-center gap-2 text-sm font-bold text-[#c4543c]"><ShieldCheck className="h-4 w-4" />{content.securityLabel}</div><h2 className="mt-4 text-3xl font-black tracking-tight text-[#10293a] sm:text-4xl">{content.securityTitle}</h2><p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600">{content.securityText}</p></div><div className="landing-lift rounded-2xl border border-[#f1c3b5] bg-white p-6 text-center shadow-sm"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f9c74f]/40 text-[#b77b00]"><ShieldCheck className="h-7 w-7" /></span><p className="mt-4 text-sm font-black text-[#10293a]">{content.securityStatus}</p><p className="mt-2 text-xs font-bold text-emerald-700">{isArabic ? 'تحت مراجعة المسؤول' : 'En cours de vérification'}</p><p className="mt-5 rounded-xl bg-[#fff6d9] p-3 text-xs font-medium text-slate-600">{isArabic ? 'يتم التفعيل بعد مراجعة الطلب.' : 'Activation après vérification de la demande.'}</p></div></div></section>

        <section className="landing-curve landing-trial px-4 py-14 text-white sm:px-6 sm:py-20 lg:px-8"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.76fr] lg:items-end"><div><p className="text-sm font-bold text-[#f9c74f]">{content.trialLabel}</p><h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">{content.trialTitle}</h2><p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-300">{content.trialText}</p><div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-slate-200"><span>15 {isArabic ? 'يوماً' : 'jours'}</span><span>•</span><span>{isArabic ? 'دون التزام' : 'Sans engagement'}</span><span>•</span><span>{isArabic ? 'كل الوظائف' : 'Toutes les fonctionnalités'}</span></div></div><div className="landing-trial-card rounded-2xl bg-white p-6 text-[#10293a]"><h3 className="text-xl font-black">{isArabic ? 'ابدئي عندما تكونين مستعدة.' : 'Commencez quand vous êtes prête.'}</h3><div className="mt-6 flex flex-col gap-3"><button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f26b4d] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#df593d] active:scale-[0.98]">{content.finalPrimary}<Arrow className="h-4 w-4" /></button><button type="button" onClick={() => onNavigate('login')} className="rounded-xl border border-slate-300 px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:border-[#0876c9] hover:text-[#0876c9]">{content.finalSecondary}</button></div></div></div></section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-7 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><img src="/rawdah-logo.png" alt="Rawdha+" className="h-8 w-8 rounded-full object-contain" /><span className="font-black text-[#10293a]">RAWDHA<span className="text-[#e85b2d]">+</span></span><span>{content.footer}</span></div><div className="flex items-center gap-3"><Globe2 className="h-4 w-4" /><button type="button" onClick={() => setLanguage(isArabic ? 'fr' : 'ar')} className="font-bold text-slate-700 hover:text-[#0876c9]">{isArabic ? 'Français' : 'العربية'}</button><span>© 2026 RAWDHA+</span></div></div></footer>
    </div>
  );
}
