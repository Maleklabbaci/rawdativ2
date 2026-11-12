/**
 * Style context — Rawdha+ « Journée algérienne » : vitrine photographique de crèche locale, chaleureuse et stable.
 * Scènes algériennes contemporaines, détails de vie quotidienne, panneaux couleur à contraste accessible (WCAG AA) et pied de page légal complet.
 */
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarCheck,
  Globe2,
  Heart,
  Menu,
  MessageCircle,
  Network,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { buildLegalHref, LEGAL_CONFIG } from '../config/legal';

type LandingDestination = 'login' | 'request';

interface LandingPageProps {
  onNavigate: (destination: LandingDestination) => void;
}

const visuals = {
  hero: '/landing/hero-focus.jpg',
  heroActivity: '/landing/hero-motion.jpg',
  heroTeam: '/landing/hero-macro.jpg',
  activity: '/landing/hero-activites.jpg?v=4',
  team: '/landing/connect-selfie.jpg?v=2',
};

const copy = {
  fr: {
    skipToContent: 'Aller au contenu principal',
    nav: {
      platform: 'La plateforme',
      modules: 'Fonctionnalités',
      network: 'Rawdha Connect',
      login: 'Se connecter',
      request: 'Demander un accès',
    },
    footer: 'Plateforme professionnelle de gestion de crèche',
    menu: 'Ouvrir la navigation',
    close: 'Fermer la navigation',
    heroAlt: 'Enfant découvrant des jeux éducatifs à la crèche',
    eyebrow: 'Pour les crèches qui font grandir les petits chaque jour',
    title: '15 jours gratuits',
    titleRest: 'pour gérer votre crèche',
    heroSlides: [
      { title: '15 jours gratuits', subtitle: 'pour gérer votre crèche' },
      { title: 'Une crèche organisée', subtitle: 'pour simplifier votre quotidien' },
      { title: 'Plus de temps', subtitle: 'pour les enfants et votre équipe' },
    ],
    trialBadge: '15 jours gratuits',
    pauseHero: 'Mettre le défilement en pause',
    playHero: 'Reprendre le défilement',
    slideLabel: 'Afficher la photo',
    heroPrice: '1 900 DA / mois après les 15 jours',
    text: 'Rawdha+ aide votre équipe à accueillir les enfants, rester organisée et partager les bons moments avec les familles.',
    primary: 'Commencer mon essai',
    secondary: 'Se connecter',
    guarantees: ['Sans engagement', 'Sans carte bancaire pour l’essai'],
    welcomeTag: 'Bienvenue chez Rawdha+',
    welcomeTitle: 'Une journée mieux organisée commence par un accueil plus serein.',
    welcomeText:
      'Chaque arrivée, activité, repas et information famille retrouve naturellement sa place. Votre équipe garde plus de temps pour l’essentiel : les enfants.',
    detailsTag: 'Dans votre journée',
    detailsTitle: 'Les informations importantes ne se perdent plus entre deux messages.',
    detailsText:
      'Rawdha+ accompagne votre équipe du premier accueil jusqu’au dernier départ, avec les détails nécessaires au bon moment.',
    dailyDetails: [
      {
        title: 'Accueil & présences',
        text: 'Pointage des arrivées, absences justifiées et personnes autorisées au départ.',
        note: 'Arrivées · absences · sorties',
      },
      {
        title: 'Vie de la crèche',
        text: 'Activités, repas, sieste et consignes de la journée restent partagés avec l’équipe.',
        note: 'Classes · repas · activités',
      },
      {
        title: 'Familles & direction',
        text: 'Messages utiles, paiements, suivi des enfants et vue d’ensemble de la Directrice.',
        note: 'Communication · paiements · rapports',
      },
    ],
    featureTag: 'Tout pour le quotidien',
    featureTitle: 'Un seul espace pour les petits moments qui font une grande journée.',
    featureText:
      'Admissions, présences, classes, activités, repas, familles et pilotage : Rawdha+ relie les informations utiles sans compliquer le travail de l’équipe.',
    featureAction: 'Découvrir la plateforme',
    featureItems: [
      'Admissions & enfants',
      'Présences & départs',
      'Activités & repas',
      'Familles & communication',
    ],
    connectTag: 'Rawdha Connect',
    connectTitle: 'Parce qu’une Directrice ne devrait jamais avancer seule.',
    connectText:
      'Échangez vos pratiques, découvrez des idées et restez connectée à des Directrices qui vivent le même quotidien.',
    connectAction: 'Découvrir Rawdha Connect',
    connectItems: ['Fil professionnel', 'Messagerie entre Directrices', 'Annonces importantes'],
    trustTitle: 'Le bon choix pour une crèche qui prend soin de chaque détail.',
    trustItems: [
      'Un espace simple pour votre équipe',
      'Des familles mieux informées',
      'Des informations protégées',
    ],
    securityTitle: 'Votre crèche garde un espace à elle, simple et sécurisé.',
    securityText:
      'L’accès à votre espace est immédiat. Le contrôle du document d’identité reste facultatif.',
    securityStatus: 'Compte créé',
    trialTag: 'Commencez en douceur',
    trialTitle: '15 jours pour imaginer des journées de crèche plus sereines.',
    trialText:
      'Découvrez toutes les fonctionnalités gratuitement et sans carte bancaire. Au-delà de l’essai : 1 900 DA / mois tout compris, résiliable à tout moment sans frais cachés.',
    finalPrimary: 'Commencer mon essai gratuit',
    finalSecondary: 'J’ai déjà un compte',
    legalLinks: {
      privacy: 'Confidentialité',
      terms: 'Conditions (CGU)',
      refund: 'Abonnement & remboursement',
      cookies: 'Cookies & mentions',
      deletion: 'Suppression des données',
    },
  },
  ar: {
    skipToContent: 'الانتقال إلى المحتوى الرئيسي',
    nav: {
      platform: 'المنصة',
      modules: 'الوظائف',
      network: 'Rawdha Connect',
      login: 'تسجيل الدخول',
      request: 'ابدئي مجاناً',
    },
    footer: 'منصة احترافية لتسيير الحضانة',
    menu: 'فتح التنقل',
    close: 'غلق التنقل',
    heroAlt: 'طفل يكتشف ألعاباً تعليمية في الحضانة',
    eyebrow: 'للحضانات التي تساعد الصغار على النمو كل يوم',
    title: '15 يوماً مجاناً',
    titleRest: 'لتسيير حضانتك',
    heroSlides: [
      { title: '15 يوماً مجاناً', subtitle: 'لتسيير حضانتك' },
      { title: 'حضانة منظمة', subtitle: 'لتسهيل يومك' },
      { title: 'وقت أكثر', subtitle: 'للأطفال ولفريقك' },
    ],
    trialBadge: '15 يوماً مجاناً',
    pauseHero: 'إيقاف الانتقال مؤقتاً',
    playHero: 'استئناف الانتقال',
    slideLabel: 'عرض الصورة',
    heroPrice: '1900 د.ج / شهر بعد 15 يوماً',
    text: 'تساعد Rawdha+ فريقك على استقبال الأطفال والبقاء منظماً ومشاركة اللحظات الجميلة مع الأولياء.',
    primary: 'ابدئي تجربتك',
    secondary: 'تسجيل الدخول',
    guarantees: ['دون التزام', 'التجربة دون بطاقة بنكية'],
    welcomeTag: 'مرحباً بكِ في Rawdha+',
    welcomeTitle: 'يوم أكثر تنظيماً يبدأ باستقبال أكثر هدوءاً.',
    welcomeText:
      'كل وصول ونشاط ووجبة ومعلومة للأولياء تجد مكانها الطبيعي. ويبقى لفريقك وقت أكثر لما هو أساسي: الأطفال.',
    detailsTag: 'خلال يومكِ',
    detailsTitle: 'المعلومات المهمة لا تضيع بين الرسائل.',
    detailsText:
      'ترافق Rawdha+ فريقك من أول استقبال إلى آخر مغادرة، بالتفاصيل الضرورية في الوقت المناسب.',
    dailyDetails: [
      {
        title: 'الاستقبال والحضور',
        text: 'تسجيل الوصول والغيابات المبررة والأشخاص المخولين بالمغادرة.',
        note: 'وصول · غياب · مغادرة',
      },
      {
        title: 'حياة الحضانة',
        text: 'الأنشطة والوجبات والقيلولة وتعليمات اليوم تبقى مشتركة مع الفريق.',
        note: 'أقسام · وجبات · أنشطة',
      },
      {
        title: 'الأولياء والإدارة',
        text: 'رسائل مفيدة ودفعات ومتابعة الأطفال ونظرة شاملة للمديرة.',
        note: 'تواصل · دفعات · تقارير',
      },
    ],
    featureTag: 'كل ما يحتاجه اليوم',
    featureTitle: 'فضاء واحد للحظات الصغيرة التي تصنع يوماً كبيراً.',
    featureText:
      'التسجيل والحضور والأقسام والأنشطة والوجبات والأولياء والتسيير: تربط Rawdha+ المعلومات المفيدة دون تعقيد عمل الفريق.',
    featureAction: 'اكتشفي المنصة',
    featureItems: ['التسجيل والأطفال', 'الحضور والمغادرة', 'الأنشطة والوجبات', 'الأولياء والتواصل'],
    connectTag: 'Rawdha Connect',
    connectTitle: 'لأن المديرة لا ينبغي أن تتقدم وحدها.',
    connectText:
      'تبادلي الممارسات واكتشفي أفكاراً وابقَي على اتصال بمديرات يعشن اليوم نفسه.',
    connectAction: 'اكتشفي Rawdha Connect',
    connectItems: ['منشورات مهنية', 'رسائل بين المديرات', 'إعلانات مهمة'],
    trustTitle: 'الاختيار المناسب لحضانة تهتم بكل تفصيل.',
    trustItems: ['فضاء بسيط لفريقك', 'أولياء أكثر اطلاعاً', 'معلومات محمية'],
    securityTitle: 'حضانتك تحتفظ بفضائها، ببساطة وأمان.',
    securityText:
      'الدخول إلى فضائك مباشر، ومراجعة وثيقة الهوية اختيارية.',
    securityStatus: 'تم إنشاء الحساب',
    trialTag: 'ابدئي بهدوء',
    trialTitle: '15 يوماً لتتخيلي أياماً أكثر راحة في الحضانة.',
    trialText:
      'اكتشفي كل الوظائف مجاناً ودون بطاقة بنكية. بعد التجربة: 1900 د.ج / شهر شاملة كل المزايا، قابلة للإلغاء في أي وقت ودون رسوم خفية.',
    finalPrimary: 'بدء التجربة المجانية',
    finalSecondary: 'لدي حساب بالفعل',
    legalLinks: {
      privacy: 'الخصوصية',
      terms: 'شروط الاستخدام',
      refund: 'الاشتراك والاسترجاع',
      cookies: 'ملفات الارتباط والبيانات القانونية',
      deletion: 'حذف البيانات',
    },
  },
};

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const { language, setLanguage } = useLanguage();
  const isArabic = language === 'ar';
  const content = isArabic ? copy.ar : copy.fr;
  const Arrow = isArabic ? ArrowLeft : ArrowRight;
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
  const heroImages = [visuals.hero, visuals.heroActivity, visuals.heroTeam];
  useEffect(() => {
    if (heroPaused) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') setHeroIndex(index => (index + 1) % 3);
    }, 6500);
    return () => window.clearInterval(interval);
  }, [heroPaused]);
  const landingMainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const main = landingMainRef.current;
    if (!main || typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('rawdha-reveal-active');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.08 });
    main.querySelectorAll('.rawdha-reveal').forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);


  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="landing-typography min-h-screen overflow-x-clip bg-[#f3fafb] text-[#25434c]">
      <a href="#main-content" className="rawdha-skip-link">
        {content.skipToContent}
      </a>

      <style>{`
        .landing-photo { overflow: hidden; }
        .landing-photo img { transition: transform 700ms cubic-bezier(0.23, 1, 0.32, 1); }
        @media (hover: hover) and (prefers-reduced-motion: no-preference) { .landing-photo:hover img { transform: scale(1.025); } }
        .landing-paper::before, .landing-paper::after { content: ''; position: absolute; width: 150px; height: 6px; border-radius: 999px; background: #f26b4d; opacity: .8; transform: rotate(-28deg); }
        .landing-paper::before { left: -52px; top: 72px; } .landing-paper::after { right: -52px; bottom: 64px; background: #f1b62f; transform: rotate(28deg); }
        .landing-hero-caption { text-shadow: 0 2px 20px rgba(20, 42, 44, .32); }
        .landing-hero-slide { transition: opacity 900ms ease; }
        .landing-card { position: relative; overflow: hidden; transition: transform 350ms ease, box-shadow 350ms ease, border-color 350ms ease; }
        .landing-card::after { content: ''; position: absolute; inset-inline-end: -42px; top: -42px; width: 120px; height: 120px; border-radius: 50%; background: rgba(241, 182, 47, .09); pointer-events: none; }
        .landing-preview-card { transition: transform 400ms ease, box-shadow 400ms ease; }
        .landing-float-orb { position:absolute; border-radius:999px; pointer-events:none; }
        .landing-float-orb-one { width:120px; height:120px; left:7%; top:12%; background:rgba(241,182,47,.16); }
        .landing-float-orb-two { width:74px; height:74px; right:10%; bottom:12%; background:rgba(27,122,98,.10); }
        .landing-float-orb-three { width:25px; height:25px; right:22%; top:20%; background:rgba(201,75,48,.18); }
        .landing-card-icon { position:relative; z-index:1; }
        .landing-stack { position:relative; display:grid; gap:14px; }
        .landing-stack .landing-card { min-height:200px; }
        .landing-stack .landing-card:nth-child(1) { background:linear-gradient(145deg,#fffdf5,#fff1cd); }
        .landing-stack .landing-card:nth-child(2) { background:linear-gradient(145deg,#f6fffb,#ddf2e8); }
        .landing-stack .landing-card:nth-child(3) { background:linear-gradient(145deg,#f8f8ff,#e7e9fb); }
        .landing-reveal-side { overflow:hidden; }
        @keyframes landing-from-start { from { opacity:.15; transform:translateX(-55px) scale(.97); } to { opacity:1; transform:translateX(0) scale(1); } }
        @keyframes landing-from-end { from { opacity:.15; transform:translateX(55px) scale(.97); } to { opacity:1; transform:translateX(0) scale(1); } }
        @keyframes landing-orbit { 0%,100% { transform:translate3d(0,0,0) rotate(0deg); } 50% { transform:translate3d(8px,-18px,0) rotate(9deg); } }
        @keyframes landing-float { 0%,100% { transform:translateY(0) rotate(-2deg); } 50% { transform:translateY(-8px) rotate(3deg); } }
        @keyframes landing-hero-in { from { opacity:0; transform:translateY(18px) scale(.98); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes landing-card-appear { from { opacity: .5; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: no-preference) {
          .landing-float-orb { animation: landing-orbit 7s ease-in-out infinite; }
          .landing-float-orb-two { animation-duration: 8.5s; animation-delay: -3s; }
          .landing-float-orb-three { animation-duration: 6s; animation-delay: -1s; }
          .landing-card-icon, .landing-trust-icon { animation: landing-float 5s ease-in-out infinite; animation-delay: var(--card-delay, 0ms); }
          .landing-hero-copy { animation: landing-hero-in 650ms cubic-bezier(.22,1,.36,1) both; }
          .landing-stack .landing-card { position:sticky; top:calc(90px + var(--stack-offset, 0px)); z-index:var(--stack-order, 1); box-shadow:0 -4px 22px rgba(37,67,76,.08), 0 18px 45px rgba(37,67,76,.12); }
          .landing-reveal-side.rawdha-reveal-active .landing-slide-content { animation:landing-from-start 950ms cubic-bezier(.22,1,.36,1) both; }
          .landing-reveal-side.rawdha-reveal-active .landing-slide-image { animation:landing-from-end 1100ms cubic-bezier(.22,1,.36,1) both; }
          .landing-reveal-side:nth-of-type(even).rawdha-reveal-active .landing-slide-content { animation-name:landing-from-end; }
          .landing-reveal-side:nth-of-type(even).rawdha-reveal-active .landing-slide-image { animation-name:landing-from-start; }
          .rawdha-reveal-active .landing-card, .rawdha-reveal-active .landing-preview-card, .rawdha-reveal-active .landing-trust-card { animation: landing-card-appear 600ms cubic-bezier(.22,1,.36,1) both; animation-delay: var(--card-delay, 0ms); }
          @media (hover: hover) { .landing-card:hover, .landing-preview-card:hover { transform: translateY(-6px); box-shadow: 0 20px 45px rgba(37,67,76,.14); border-color: #b4d4c7; } }
        }
        @media (prefers-reduced-motion: reduce) { .landing-photo img, .landing-hero-slide, .landing-card, .landing-preview-card { transition: none; } }
      `}</style>

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex min-w-0 items-center gap-2.5 text-start cursor-pointer"
            aria-label="Rawdha+"
          >
            <img
              src="/rawdah-logo.png"
              alt={isArabic ? 'شعار روضة+' : 'Logo Rawdha+'}
              className="h-10 w-10 shrink-0 rounded-full object-contain"
            />
            <span className="min-w-0 leading-none">
              <span className="block text-sm font-black tracking-[-0.04em] text-[#25434c]">
                RAWDHA<span className="text-[#c94b30]">+</span>
              </span>
              <span
                className={`mt-1 hidden whitespace-nowrap font-bold text-slate-600 sm:block ${
                  isArabic ? 'text-[10px]' : 'text-[8px] uppercase tracking-[0.07em]'
                }`}
              >
                {content.footer}
              </span>
            </span>
          </button>

          <nav className="hidden items-center gap-7 lg:flex" aria-label={isArabic ? 'التنقل الرئيسي' : 'Navigation principale'}>
            <button
              type="button"
              onClick={() => scrollTo('plateforme')}
              className="text-sm font-medium text-slate-700 transition hover:text-[#c94b30] cursor-pointer"
            >
              {content.nav.platform}
            </button>
            <button
              type="button"
              onClick={() => scrollTo('modules')}
              className="text-sm font-medium text-slate-700 transition hover:text-[#c94b30] cursor-pointer"
            >
              {content.nav.modules}
            </button>
            <button
              type="button"
              onClick={() => scrollTo('connect')}
              className="text-sm font-medium text-slate-700 transition hover:text-[#c94b30] cursor-pointer"
            >
              {content.nav.network}
            </button>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <div className="flex rounded-full border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setLanguage('fr')}
                aria-pressed={!isArabic}
                className={`rounded-full px-2.5 py-1 text-[10px] font-black cursor-pointer ${
                  !isArabic ? 'bg-[#25434c] text-white' : 'text-slate-700'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ar')}
                aria-pressed={isArabic}
                className={`rounded-full px-2.5 py-1 text-[10px] font-black cursor-pointer ${
                  isArabic ? 'bg-[#25434c] text-white' : 'text-slate-700'
                }`}
              >
                ع
              </button>
            </div>
            <a href="/espace-parent" className="text-sm font-bold text-[#c94b30]">{isArabic ? 'فضاء الأولياء' : 'Espace Parent'}</a>
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="text-sm font-medium text-slate-700 transition hover:text-[#c94b30] cursor-pointer"
            >
              {content.nav.login}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('request')}
              className="inline-flex items-center gap-2 rounded-md bg-[#c94b30] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#b53f26] active:scale-[0.98] cursor-pointer"
            >
              {content.nav.request}
              <Arrow className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(value => !value)}
            aria-expanded={menuOpen}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-[#25434c] md:hidden cursor-pointer"
            aria-label={menuOpen ? content.close : content.menu}
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200 bg-white p-4 md:hidden">
            <div className="mx-auto max-w-7xl space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2">
                <span className="text-xs font-bold text-slate-700">
                  {isArabic ? 'لغة الواجهة' : 'Langue de l’interface'}
                </span>
                <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setLanguage('fr')}
                    className={`rounded-md px-3 py-1.5 text-xs font-bold cursor-pointer ${
                      !isArabic ? 'bg-[#25434c] text-white' : 'text-slate-700'
                    }`}
                  >
                    Français
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('ar')}
                    className={`rounded-md px-3 py-1.5 text-xs font-bold cursor-pointer ${
                      isArabic ? 'bg-[#25434c] text-white' : 'text-slate-700'
                    }`}
                  >
                    العربية
                  </button>
                </div>
              </div>
              {[
                ['plateforme', content.nav.platform],
                ['modules', content.nav.modules],
                ['connect', content.nav.network],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollTo(id)}
                  className="block w-full rounded-xl px-3 py-3 text-start text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {label}
                </button>
              ))}
              <a href="/espace-parent" className="block rounded-xl bg-orange-50 px-3 py-3 text-sm font-bold text-orange-800">{isArabic ? 'فضاء الأولياء' : 'Espace Parent'}</a>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('login')}
                  className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-bold text-slate-700 cursor-pointer"
                >
                  {content.nav.login}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('request')}
                  className="rounded-xl bg-[#c94b30] px-3 py-3 text-sm font-bold text-white cursor-pointer"
                >
                  {content.nav.request}
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main id="main-content" ref={landingMainRef} tabIndex={-1} className="outline-none">
        <section id="plateforme" className="relative isolate min-h-[520px] overflow-hidden bg-[#25434c] sm:min-h-[590px] lg:min-h-[650px]">
          {heroImages.map((src, index) => <img key={src} src={src} alt="" aria-hidden="true" loading={index === 0 ? 'eager' : 'lazy'} className={`landing-hero-slide absolute inset-0 h-full w-full object-cover object-center ${index === heroIndex ? 'opacity-100' : 'opacity-0'}`} />)}
          <div className="absolute inset-0 bg-[#182e35]/45" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#182e35]/35 via-[#182e35]/25 to-[#182e35]/60" />
          <div className="relative mx-auto flex min-h-[520px] max-w-7xl items-center justify-center px-4 pb-24 pt-20 text-center text-white sm:min-h-[590px] sm:px-6 lg:min-h-[650px] lg:px-8">
            <div className="landing-hero-caption rawdha-hero-enter max-w-3xl">
              <h1 key={`${language}-${heroIndex}`} className="landing-hero-copy mt-5 leading-[1.12] tracking-[-0.04em]" aria-live={heroPaused ? 'polite' : 'off'}>
                <span className="block text-[clamp(2.5rem,9vw,4.5rem)] font-extrabold">{content.heroSlides[heroIndex].title}</span>
                <span className="mt-2 block text-xl font-medium tracking-[-0.02em] sm:text-2xl lg:text-3xl">{content.heroSlides[heroIndex].subtitle}</span>
              </h1>
              <p className="mt-4 text-base font-bold text-[#fff0a9] sm:text-lg">{content.heroPrice}</p>
              <button type="button" onClick={() => onNavigate('request')} className="mt-8 inline-flex items-center justify-center gap-2 rounded-md bg-[#1b7a62] px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#15634f] active:scale-[0.98] cursor-pointer">{content.primary}<Arrow className="h-4 w-4" aria-hidden="true" /></button>
              <div className="mt-7 flex items-center justify-center gap-2" role="group" aria-label={isArabic ? 'صور العرض' : 'Photos de présentation'}>
                {heroImages.map((src, index) => <button key={src} type="button" onClick={() => setHeroIndex(index)} aria-label={`${content.slideLabel} ${index + 1}`} aria-pressed={heroIndex === index} className="grid h-9 w-9 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><span className={`block rounded-full transition-all ${heroIndex === index ? 'h-2.5 w-6 bg-white' : 'h-2.5 w-2.5 bg-white/60'}`} /></button>)}
              </div>
            </div>
          </div>
          <svg className="pointer-events-none absolute inset-x-0 bottom-0 block h-8 w-full sm:h-12" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true"><path fill="#f3fafb" d="M0 48V12C280 42 510 48 720 34S1170 0 1440 20V48Z" /></svg>
        </section>

        <section className="rawdha-reveal landing-paper relative overflow-hidden bg-[#f3fafb] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <span className="landing-float-orb landing-float-orb-one" aria-hidden="true" />
          <span className="landing-float-orb landing-float-orb-two" aria-hidden="true" />
          <span className="landing-float-orb landing-float-orb-three" aria-hidden="true" />
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold text-[#1b7a62]">{content.welcomeTag}</p>
            <h2 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.035em] text-[#25434c] sm:text-4xl">
              {content.welcomeTitle}
            </h2>
            <div className="mx-auto mt-5 h-1 w-16 rounded-full bg-[#f1b62f]" />
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-7 text-slate-700">{content.welcomeText}</p>
          </div>
        </section>

        <section className="rawdha-reveal bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="text-sm font-bold text-[#1b7a62]">{content.detailsTag}</p>
              <h2 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.035em] text-[#25434c] sm:text-4xl">
                {content.detailsTitle}
              </h2>
              <p className="mt-4 text-base font-medium leading-7 text-slate-700">{content.detailsText}</p>
            </div>
            <div className="landing-stack mt-9">
              {content.dailyDetails.map((detail, index) => (
                <article key={detail.title} style={{ '--card-delay': `${index * 100}ms`, '--stack-order': index + 1, '--stack-offset': `${index * 14}px` } as CSSProperties} className="landing-card rounded-3xl border border-[#dcebed] bg-gradient-to-br from-white to-[#f2faf5] p-6 shadow-[0_10px_30px_rgba(37,67,76,0.06)]">
                  <span className="landing-card-icon grid h-11 w-11 place-items-center rounded-2xl bg-[#fff0d1] text-sm font-black text-[#8f5e00]">
                    0{index + 1}
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-[#25434c]">{detail.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-6 text-slate-700">{detail.text}</p>
                  <p className="mt-5 border-t border-[#dcebed] pt-3 text-xs font-bold text-[#1b7a62]">{detail.note}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="modules" className="rawdha-reveal scroll-mt-16 bg-white">
          <div className="mx-auto grid max-w-[1440px] lg:grid-cols-2">
            <div className="flex min-h-[450px] flex-col justify-center bg-[#f3c24f] px-7 py-14 text-[#1d363e] sm:px-12 lg:px-16">
              <p className="text-sm font-bold text-[#1d363e]/85">{content.featureTag}</p>
              <h2 className="mt-4 max-w-xl text-3xl font-medium leading-tight tracking-[-0.035em] sm:text-4xl">
                {content.featureTitle}
              </h2>
              <p className="mt-5 max-w-lg text-base font-medium leading-7 text-[#1d363e]/90">{content.featureText}</p>
              <ul className="mt-7 grid max-w-lg gap-3 sm:grid-cols-2">
                {content.featureItems.map((item, index) => (
                  <li key={item} className="flex items-center gap-2 border-b border-[#1d363e]/20 pb-2 text-sm font-bold">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[#1d363e]/12 text-xs">
                      0{index + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => scrollTo('connect')}
                className="mt-8 inline-flex w-fit items-center gap-2 rounded-md bg-[#25434c] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1a3138] cursor-pointer"
              >
                {content.featureAction}
                <Arrow className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="landing-photo min-h-[360px] bg-[#d8c3a4] lg:min-h-[450px]">
              <img
                src={visuals.activity}
                alt={isArabic ? 'نشاط تعليمي في حضانة جزائرية' : 'Activité éducative dans une crèche algérienne'}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="platform-preview-title" className="rawdha-reveal bg-[#fbfcf9] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-16">
              <p className="text-xs font-bold uppercase tracking-widest text-[#1b7a62]">{isArabic ? 'المنصة بالصور' : 'La plateforme en images'}</p>
              <h2 id="platform-preview-title" className="mt-3 text-3xl font-medium leading-tight tracking-[-0.035em] text-[#25434c] sm:text-4xl">{isArabic ? 'كل ما تحتاجه حضانتك في مكان واحد' : 'Tout ce dont votre crèche a besoin, au même endroit'}</h2>
              <p className="mt-4 text-base leading-7 text-[#526a6d]">{isArabic ? 'نظرة على الأدوات التي تسهّل يومك.' : 'Un aperçu concret des outils qui simplifient votre quotidien.'}</p>
            </div>
            {[
              { image: 'bord', tag: isArabic ? 'نظرة عامة' : 'Vue d’ensemble', title: isArabic ? 'يومك في لمحة' : 'Votre journée en un coup d’œil', text: isArabic ? 'تابعي الحضور والنقاط التي تحتاج إلى مراجعة منذ البداية.' : 'Retrouvez les présences et les points à vérifier dès l’ouverture.' },
              { image: 'enfants', tag: isArabic ? 'الأطفال' : 'Enfants', title: isArabic ? 'ملفات منظمة' : 'Des dossiers bien organisés', text: isArabic ? 'اعثري بسرعة على الأطفال وأقسامهم وحالة ملفاتهم.' : 'Retrouvez rapidement les enfants, leurs classes et l’état de leurs dossiers.' },
              { image: 'presences', tag: isArabic ? 'الحضور' : 'Présences', title: isArabic ? 'تسجيل حضور أبسط' : 'L’appel, simplifié', text: isArabic ? 'تابعي الحضور حسب القسم والأطفال الذين لم يُسجّل حضورهم بعد.' : 'Suivez les présences par classe et repérez les enfants à pointer.' },
              { image: 'connect', tag: 'Rawdha Connect', title: isArabic ? 'شبكة للحضانات' : 'Un réseau pour les crèches', text: isArabic ? 'شاركي تجاربك وتواصلي مع مهنيين آخرين.' : 'Partagez vos expériences et échangez avec d’autres professionnels.' },
            ].map((item, index) => (
              <article key={item.image} className="landing-reveal-side rawdha-reveal grid items-center gap-5 border-t border-[#e0eae4] py-8 md:grid-cols-5 md:gap-12 md:py-10">
                <div className={`landing-slide-content md:col-span-2 ${index % 2 ? 'md:order-2' : ''}`}>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#1b7a62]">{item.tag}</p>
                  <h3 className="mt-3 text-2xl font-medium leading-tight tracking-tight text-[#25434c] sm:text-3xl">{item.title}</h3>
                  <p className="mt-3 text-base leading-7 text-[#526a6d]">{item.text}</p>
                </div>
                <div className={`landing-slide-image landing-preview-card min-w-0 rounded-2xl border border-[#dbe7e1] bg-[#eaf3ee] p-2 shadow-sm sm:rounded-3xl sm:p-3 md:col-span-3 ${index % 2 ? 'md:order-1' : ''}`}>
                  <img src={`/landing/apercu-${item.image}.webp`} alt={`${item.tag} — ${isArabic ? 'صورة من النسخة التجريبية باللغة الفرنسية' : 'capture de la version de démonstration'}`} loading="lazy" decoding="async" className="block h-auto w-full rounded-xl bg-white shadow-sm" />
                </div>
              </article>
            ))}
            <p className="pt-5 text-center text-xs text-[#607a75]">{isArabic ? 'صور توضيحية من النسخة التجريبية باللغة الفرنسية، ببيانات تجريبية.' : 'Captures de la version de démonstration, avec des données fictives.'}</p>
          </div>
        </section>

        <section id="connect" className="rawdha-reveal scroll-mt-16 bg-[#f3fafb]">
          <div className="mx-auto grid max-w-[1440px] lg:grid-cols-2">
            <div className="landing-photo min-h-[360px] bg-[#d8e7e7] lg:order-2 lg:min-h-[470px]">
              <img
                src={visuals.team}
                alt={
                  isArabic
                    ? 'صورة تعبيرية لمهنيات حضانة معاً'
                    : 'Image illustrative de professionnelles de crèche réunies'
                }
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex min-h-[400px] flex-col justify-center bg-[#1f6f5c] px-7 py-14 text-white sm:px-12 lg:order-1 lg:min-h-[470px] lg:px-16">
              <div className="inline-flex items-center gap-2 text-sm font-bold text-[#e6fff7]">
                <Network className="h-4 w-4" aria-hidden="true" />
                {content.connectTag}
              </div>
              <h2 className="mt-4 max-w-xl text-3xl font-medium leading-tight tracking-[-0.035em] sm:text-4xl">
                {content.connectTitle}
              </h2>
              <p className="mt-5 max-w-lg text-base font-medium leading-7 text-white/95">{content.connectText}</p>
              <div className="mt-7 grid gap-3">
                {content.connectItems.map((item, index) => (
                  <div key={item} className="flex items-center gap-3 border-b border-white/25 pb-3 text-sm font-bold">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20" aria-hidden="true">
                      {index === 0 ? (
                        <Network className="h-4 w-4" />
                      ) : index === 1 ? (
                        <MessageCircle className="h-4 w-4" />
                      ) : (
                        <Bell className="h-4 w-4" />
                      )}
                    </span>
                    {item}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="mt-8 inline-flex w-fit items-center gap-2 rounded-md border border-white/85 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-[#1f6f5c] cursor-pointer"
              >
                {content.connectAction}
                <Arrow className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <section className="rawdha-reveal bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-5xl text-center">
            <h2 className="text-3xl font-medium leading-tight tracking-[-0.035em] text-[#25434c] sm:text-4xl">
              {content.trustTitle}
            </h2>
            <div className="mx-auto mt-10 grid max-w-3xl gap-8 sm:grid-cols-3">
              {content.trustItems.map((item, index) => (
                <div key={item} style={{ '--card-delay': `${index * 100}ms` } as CSSProperties} className="landing-trust-card flex flex-col items-center rounded-3xl border border-[#e6eee9] bg-[#fbfefb] px-4 py-6 shadow-[0_8px_24px_rgba(37,67,76,0.04)]">
                  <span className="landing-trust-icon grid h-16 w-16 place-items-center rounded-full bg-[#fff3cd] text-[#8f5e00]" aria-hidden="true">
                    {index === 0 ? (
                      <Heart className="h-7 w-7" />
                    ) : index === 1 ? (
                      <CalendarCheck className="h-7 w-7" />
                    ) : (
                      <ShieldCheck className="h-7 w-7" />
                    )}
                  </span>
                  <p className="mt-4 text-sm font-bold leading-6 text-[#25434c]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rawdha-reveal bg-[#f7f2eb] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-8 rounded-2xl bg-white p-6 shadow-[0_15px_45px_rgba(37,67,76,0.08)] sm:p-10 lg:grid-cols-[1fr_0.68fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-bold text-[#c94b30]">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {isArabic ? 'إطار موثوق' : 'Un cadre de confiance'}
              </div>
              <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.035em] text-[#25434c] sm:text-4xl">
                {content.securityTitle}
              </h2>
              <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-700">{content.securityText}</p>
            </div>
            <div className="rounded-xl border border-[#f0dfc6] bg-[#fffaf2] p-6 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#fff0d1] text-[#8f5e00]" aria-hidden="true">
                <ShieldCheck className="h-7 w-7" />
              </span>
              <p className="mt-4 text-sm font-black text-[#25434c]">{content.securityStatus}</p>
              <p className="mt-2 text-xs font-bold text-emerald-800">
                {isArabic ? 'دخول مباشر' : 'Accès immédiat'}
              </p>
              <p className="mt-5 rounded-lg bg-white p-3 text-xs font-medium text-slate-700">
                {isArabic ? 'مراجعة الوثيقة اختيارية.' : 'Contrôle du document facultatif.'}
              </p>
            </div>
          </div>
        </section>

        <section className="rawdha-reveal bg-[#25434c] px-4 py-16 text-white sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-bold text-[#fff0a9]">{content.trialTag}</p>
            <h2 className="mt-4 text-3xl font-medium leading-tight tracking-[-0.035em] sm:text-5xl">
              {content.trialTitle}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-7 text-white/90">{content.trialText}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => onNavigate('request')}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#c94b30] px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#b53f26] active:scale-[0.98] cursor-pointer"
              >
                {content.finalPrimary}
                <Arrow className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="rounded-md border border-white/80 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white hover:text-[#25434c] cursor-pointer"
              >
                {content.finalSecondary}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-5 text-xs font-medium text-slate-600">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <img
                src="/rawdah-logo.png"
                alt={isArabic ? 'شعار روضة+' : 'Logo Rawdha+'}
                className="h-8 w-8 rounded-full object-contain"
              />
              <span className="font-black text-[#25434c]">
                RAWDHA<span className="text-[#c94b30]">+</span>
              </span>
              <span>· {content.footer}</span>
              <span>· {isArabic ? LEGAL_CONFIG.countryAr : LEGAL_CONFIG.countryFr}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-600">
                WhatsApp : <strong dir="ltr">{LEGAL_CONFIG.whatsappDisplay}</strong>
              </span>
              {LEGAL_CONFIG.officialEmail && (
                <a href={`mailto:${LEGAL_CONFIG.officialEmail}`} className="font-bold text-[#25434c] hover:underline">
                  {LEGAL_CONFIG.officialEmail}
                </a>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Globe2 className="h-4 w-4" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setLanguage(isArabic ? 'fr' : 'ar')}
                  className="font-bold text-[#25434c] hover:text-[#c94b30] cursor-pointer"
                >
                  {isArabic ? 'Français' : 'العربية'}
                </button>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <nav
              aria-label={isArabic ? 'الروابط القانونية' : 'Liens légaux'}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 font-semibold text-slate-700"
            >
              <a href={buildLegalHref('confidentialite')} className="hover:text-[#c94b30] hover:underline">
                {content.legalLinks.privacy}
              </a>
              <a href={buildLegalHref('cgu')} className="hover:text-[#c94b30] hover:underline">
                {content.legalLinks.terms}
              </a>
              <a href={buildLegalHref('remboursement')} className="hover:text-[#c94b30] hover:underline">
                {content.legalLinks.refund}
              </a>
              <a href={buildLegalHref('cookies')} className="hover:text-[#c94b30] hover:underline">
                {content.legalLinks.cookies}
              </a>
              <a href={buildLegalHref('suppression')} className="hover:text-[#c94b30] hover:underline">
                {content.legalLinks.deletion}
              </a>
            </nav>
            <p className="text-slate-500">© 2026 {LEGAL_CONFIG.brandName}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
