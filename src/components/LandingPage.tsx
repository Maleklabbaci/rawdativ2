/**
 * Style context — L’Atelier du Matin: vitrine éditoriale chaleureuse de Rawdha+.
 * Crème papier, bleu encre et Soleil Rawdha; mises en page asymétriques, images métier
 * et repères terre cuite. Cette page reste une porte d’entrée publique vers l’app existante.
 */
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BellRing,
  CalendarCheck2,
  Check,
  ChevronDown,
  ClipboardCheck,
  Globe2,
  LayoutDashboard,
  Menu,
  MessageCircleMore,
  Network,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

type LandingDestination = 'login' | 'request';

interface LandingPageProps {
  onNavigate: (destination: LandingDestination) => void;
}

const assets = {
  hero: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894126178/elDKpMPQRIEhHVnl.jpg',
  operations: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894126178/shXfZdhlKNDByDLH.jpg',
  connect: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894126178/oubOBARIZKJBcQcR.jpg',
  mark: 'https://files.manuscdn.com/user_upload_by_module/session_file/310519663894126178/rZmvoQPdCIVaysUS.png',
};

const copy = {
  fr: {
    nav: { product: 'La plateforme', routine: 'Votre quotidien', connect: 'Rawdha Connect', access: 'Se connecter', request: 'Demander un accès' },
    eyebrow: 'Le poste de pilotage des crèches d’aujourd’hui',
    heroTitle: <>Votre journée de crèche,<br /><em className="font-normal text-[#e5683f]">enfin lisible</em> d’un seul regard.</>,
    heroText: 'Rawdha+ réunit admissions, présences, équipe, activités, communication et facturation dans un espace bilingue pensé pour les Directrices de crèche.',
    heroPrimary: 'Demander un accès',
    heroSecondary: 'Voir comment ça marche',
    trusted: 'Accès vérifié · Données structurées · Support humain',
    visualNote: 'Pour les journées qui bougent vraiment.',
    featureIntro: 'Une seule plateforme. Les bons repères au bon moment.',
    featureText: 'Chaque module enlève une tâche répétitive du chemin pour vous rendre du temps avec les enfants, les familles et votre équipe.',
    features: [
      { tag: '01', title: 'Admissions claires', text: 'Recevez et suivez chaque demande de famille ou de Directeur sans perdre le fil.', icon: ClipboardCheck },
      { tag: '02', title: 'Présences sereines', text: 'Pointez, justifiez et consultez la journée en quelques gestes.', icon: CalendarCheck2 },
      { tag: '03', title: 'Équipe alignée', text: 'Gardez personnel, activités, repas et informations utiles au même endroit.', icon: UsersRound },
      { tag: '04', title: 'Gestion maîtrisée', text: 'Suivez paiements, documents et décisions quotidiennes avec des vues simples.', icon: ReceiptText },
    ],
    rhythmEyebrow: 'Le quotidien, remis dans l’ordre',
    rhythmTitle: 'Une crèche avance mieux quand chaque information trouve sa place.',
    rhythmText: 'Rawdha+ transforme les petites actions dispersées de la journée en repères simples : ce qui arrive, ce qui a été fait et ce qui attend votre validation.',
    steps: [
      ['01', 'Recevoir', 'Les demandes, informations et alertes importantes arrivent au bon endroit.'],
      ['02', 'Décider', 'Vous validez, organisez et communiquez sans changer d’outil.'],
      ['03', 'Avancer', 'Votre équipe garde une vision commune, chaque jour.'],
    ],
    connectEyebrow: 'Rawdha Connect',
    connectTitle: 'Le réseau professionnel qui reste connecté à votre gestion.',
    connectText: 'Partagez une activité, échangez avec d’autres Directrices, découvrez une opportunité ou consultez les annonces officielles — sans sortir de Rawdha+.',
    connectCta: 'Découvrir Rawdha Connect',
    connectTags: ['Publications métiers', 'Messages professionnels', 'Réseau de crèches'],
    proofTitle: 'Pensé pour les personnes qui font tenir une crèche au quotidien.',
    proofText: 'Une interface claire ne remplace pas votre expérience : elle vous donne simplement plus d’espace pour l’utiliser.',
    proofItems: ['Français et arabe, selon votre usage', 'Une demande Directeur validée avant accès complet', 'Une plateforme, de la première demande au suivi quotidien'],
    finalTitle: 'Votre prochaine journée peut commencer plus simplement.',
    finalText: 'Créez votre demande d’accès. L’équipe Rawdha+ examine votre dossier et active votre espace après validation.',
    finalPrimary: 'Créer ma demande Directeur',
    finalSecondary: 'J’ai déjà un compte',
    footer: 'Une plateforme conçue pour le travail concret des crèches.',
    menu: 'Ouvrir la navigation',
    close: 'Fermer la navigation',
  },
  ar: {
    nav: { product: 'المنصة', routine: 'يومك', connect: 'Rawdha Connect', access: 'تسجيل الدخول', request: 'اطلبي الولوج' },
    eyebrow: 'منصة تسيير الحضانات اليوم',
    heroTitle: <>يوم حضانتك،<br /><em className="font-normal text-[#e5683f]">واضح</em> بنظرة واحدة.</>,
    heroText: 'تجمع Rawdha+ طلبات التسجيل والحضور والفريق والأنشطة والتواصل والفوترة في فضاء ثنائي اللغة صُمّم لمديرات الحضانات.',
    heroPrimary: 'اطلبي الولوج',
    heroSecondary: 'اكتشفي كيف تعمل',
    trusted: 'ولوج موثّق · بيانات منظمة · دعم إنساني',
    visualNote: 'لأيام الحضانة الحقيقية المتحركة.',
    featureIntro: 'منصة واحدة. المعلومة الصحيحة في الوقت الصحيح.',
    featureText: 'كل وحدة تُزيل مهمة متكررة من يومك لتمنحك وقتاً أكثر للأطفال والأولياء وفريقك.',
    features: [
      { tag: '01', title: 'طلبات واضحة', text: 'استقبلي وتابعي كل طلب أسرة أو مديرة دون أن يضيع منك أي تفصيل.', icon: ClipboardCheck },
      { tag: '02', title: 'حضور مطمئن', text: 'سجلي الحضور والغياب وراجعي اليوم بخطوات بسيطة.', icon: CalendarCheck2 },
      { tag: '03', title: 'فريق منسجم', text: 'اجمعي الموظفين والأنشطة والوجبات والمعلومات المفيدة في مكان واحد.', icon: UsersRound },
      { tag: '04', title: 'تسيير متحكم فيه', text: 'تابعي الدفعات والوثائق والقرارات اليومية من خلال واجهات بسيطة.', icon: ReceiptText },
    ],
    rhythmEyebrow: 'يومك، مرتب من جديد',
    rhythmTitle: 'الحضانة تمشي أفضل عندما تجد كل معلومة مكانها.',
    rhythmText: 'تحوّل Rawdha+ التفاصيل الصغيرة المتفرقة إلى مؤشرات واضحة: ما وصل، ما تمّ، وما ينتظر قرارك.',
    steps: [
      ['01', 'استقبلي', 'تصل الطلبات والمعلومات والتنبيهات المهمة إلى المكان المناسب.'],
      ['02', 'قرّري', 'صادقي ونظمي وتواصلي دون تغيير الأداة.'],
      ['03', 'تقدّمي', 'يبقى فريقك على رؤية مشتركة، كل يوم.'],
    ],
    connectEyebrow: 'Rawdha Connect',
    connectTitle: 'شبكة مهنية تبقى مرتبطة بتسييرك.',
    connectText: 'شاركي نشاطاً وتبادلي الخبرات مع مديرات أخريات واكتشفي فرصة أو تابعي الإعلانات الرسمية دون مغادرة Rawdha+.',
    connectCta: 'اكتشفي Rawdha Connect',
    connectTags: ['منشورات مهنية', 'رسائل احترافية', 'شبكة الحضانات'],
    proofTitle: 'صُممت لمن تجعل الحضانة تسير كل يوم.',
    proofText: 'واجهة واضحة لا تعوّض خبرتك؛ بل تمنحك مساحة أكبر لاستعمالها.',
    proofItems: ['الفرنسية والعربية حسب استعمالك', 'طلب المديرة يُراجع قبل الولوج الكامل', 'منصة واحدة من أول طلب إلى المتابعة اليومية'],
    finalTitle: 'يمكن أن يبدأ يومك القادم بطريقة أبسط.',
    finalText: 'أنشئي طلب الولوج. يراجع فريق Rawdha+ ملفك ويفعّل فضاءك بعد المصادقة.',
    finalPrimary: 'إنشاء طلب مديرة',
    finalSecondary: 'لدي حساب بالفعل',
    footer: 'منصة مصممة للعمل الحقيقي داخل الحضانات.',
    menu: 'فتح التنقل',
    close: 'غلق التنقل',
  },
};

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const { language, setLanguage } = useLanguage();
  const isArabic = language === 'ar';
  const content = isArabic ? copy.ar : copy.fr;
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goTo = (target: string) => {
    setMenuOpen(false);
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const DirectionArrow = isArabic ? ArrowLeft : ArrowRight;

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="min-h-screen overflow-x-hidden bg-[#f9f6ef] font-landing text-[#13233a]">
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-200 ${scrolled ? 'border-b border-[#dfe1dd] bg-[#f9f6ef]/95 shadow-[0_8px_26px_rgba(19,35,58,0.06)] backdrop-blur-xl' : 'bg-transparent'}`}>
        <div className="mx-auto flex h-[78px] max-w-[1440px] items-center justify-between gap-3 px-5 sm:px-8 lg:px-12">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="group inline-flex items-center gap-3 text-left" aria-label="Rawdha+">
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#13233a] shadow-[0_8px_20px_rgba(19,35,58,0.16)] transition-transform duration-200 group-hover:-rotate-3">
              <img src={assets.mark} alt="" className="h-8 w-8 object-contain" />
            </span>
            <span className="leading-none">
              <span className="block font-landing-display text-[24px] tracking-[-0.06em] text-[#13233a]">Rawdha<span className="text-[#e5683f]">+</span></span>
              <span className="mt-1 block text-[9px] font-extrabold uppercase tracking-[0.19em] text-[#6c7786]">Crèche, au quotidien</span>
            </span>
          </button>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigation principale">
            <button type="button" onClick={() => goTo('plateforme')} className="text-[13px] font-extrabold text-[#425266] transition hover:text-[#e5683f]">{content.nav.product}</button>
            <button type="button" onClick={() => goTo('quotidien')} className="text-[13px] font-extrabold text-[#425266] transition hover:text-[#e5683f]">{content.nav.routine}</button>
            <button type="button" onClick={() => goTo('connect')} className="text-[13px] font-extrabold text-[#425266] transition hover:text-[#e5683f]">{content.nav.connect}</button>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <div className="flex rounded-full border border-[#d8ddd8] bg-white/80 p-1 shadow-sm">
              <button type="button" onClick={() => setLanguage('fr')} className={`rounded-full px-2.5 py-1 text-[10px] font-black transition ${!isArabic ? 'bg-[#13233a] text-white' : 'text-[#6c7786] hover:text-[#13233a]'}`}>FR</button>
              <button type="button" onClick={() => setLanguage('ar')} className={`rounded-full px-2.5 py-1 text-[10px] font-black transition ${isArabic ? 'bg-[#13233a] text-white' : 'text-[#6c7786] hover:text-[#13233a]'}`}>ع</button>
            </div>
            <button type="button" onClick={() => onNavigate('login')} className="px-3 py-2 text-[13px] font-extrabold text-[#13233a] transition hover:text-[#e5683f]">{content.nav.access}</button>
            <button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center gap-2 rounded-xl bg-[#e5683f] px-4 py-2.5 text-[12px] font-black text-white shadow-[0_10px_20px_rgba(229,104,63,0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#cd5633] active:scale-[0.97]">
              {content.nav.request} <DirectionArrow className="h-3.5 w-3.5" />
            </button>
          </div>

          <button type="button" onClick={() => setMenuOpen((open) => !open)} className="grid h-11 w-11 place-items-center rounded-xl border border-[#d8ddd8] bg-white text-[#13233a] md:hidden" aria-label={menuOpen ? content.close : content.menu}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-[#e3e5e0] bg-[#f9f6ef] px-5 py-5 shadow-xl md:hidden">
            <div className="flex flex-col gap-2">
              {[
                ['plateforme', content.nav.product],
                ['quotidien', content.nav.routine],
                ['connect', content.nav.connect],
              ].map(([target, label]) => <button key={target} type="button" onClick={() => goTo(target)} className="rounded-xl px-3 py-3 text-start text-sm font-black text-[#13233a] hover:bg-white">{label}</button>)}
              <div className="mt-2 flex items-center gap-2 border-t border-[#e3e5e0] pt-4">
                <button type="button" onClick={() => onNavigate('login')} className="flex-1 rounded-xl border border-[#cfd5cf] bg-white px-3 py-3 text-sm font-black text-[#13233a]">{content.nav.access}</button>
                <button type="button" onClick={() => onNavigate('request')} className="flex-1 rounded-xl bg-[#e5683f] px-3 py-3 text-sm font-black text-white">{content.nav.request}</button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="relative isolate overflow-hidden px-5 pb-16 pt-28 sm:px-8 sm:pb-24 sm:pt-32 lg:px-12 lg:pb-28 lg:pt-36">
          <div className="absolute inset-x-0 top-0 -z-10 h-[78%] bg-[radial-gradient(circle_at_78%_26%,rgba(245,192,129,0.24),transparent_28%),radial-gradient(circle_at_18%_10%,rgba(220,235,219,0.75),transparent_28%)]" />
          <div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-[minmax(0,0.94fr)_minmax(420px,0.86fr)] lg:items-end lg:gap-16">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }} className="max-w-3xl pt-8 lg:pb-7">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#d9ddd3] bg-white/70 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#4e6251] shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-[#e5683f]" /> {content.eyebrow}
              </div>
              <h1 className="max-w-[760px] font-landing-display text-[clamp(3rem,6.4vw,6.6rem)] leading-[0.91] tracking-[-0.065em] text-[#13233a]">
                {content.heroTitle}
              </h1>
              <p className="mt-8 max-w-xl text-[16px] font-medium leading-8 text-[#536271] sm:text-[18px]">{content.heroText}</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center justify-center gap-3 rounded-[14px] bg-[#13233a] px-5 py-4 text-sm font-black text-white shadow-[0_15px_28px_rgba(19,35,58,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#203a5e] active:scale-[0.97]">
                  {content.heroPrimary} <DirectionArrow className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => goTo('plateforme')} className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-black text-[#35506e] transition hover:text-[#e5683f]">
                  {content.heroSecondary} <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-7 flex items-center gap-2 text-[11px] font-extrabold tracking-[0.02em] text-[#6a7883]"><ShieldCheck className="h-4 w-4 text-[#6f8d68]" /> {content.trusted}</p>
            </motion.div>

            <motion.figure initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease: [0.23, 1, 0.32, 1] }} className="relative mx-auto w-full max-w-[660px] lg:ml-auto">
              <div className="absolute -left-5 top-12 h-28 w-28 rounded-full border border-[#e5683f]/30 bg-[#f8cdbb]/40 sm:-left-10 sm:h-40 sm:w-40" />
              <div className="relative overflow-hidden rounded-[32px_32px_8px_32px] border-[9px] border-white bg-[#e8d6ba] shadow-[0_30px_60px_rgba(19,35,58,0.16)]">
                <img src={assets.hero} alt={isArabic ? 'مديرة حضانة تتابع نشاطاً للأطفال' : 'Directrice de crèche suivant une activité avec les enfants'} className="aspect-[1.06/1] w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#13233a]/45 to-transparent" />
                <figcaption className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4 text-white">
                  <span className="max-w-[190px] font-landing-display text-xl leading-tight tracking-[-0.035em] sm:text-2xl">{content.visualNote}</span>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e5683f] text-white shadow-lg"><BadgeCheck className="h-5 w-5" /></span>
                </figcaption>
              </div>
              <div className={`absolute bottom-6 ${isArabic ? '-left-2 sm:-left-9' : '-right-2 sm:-right-9'} hidden max-w-[210px] rounded-[18px_18px_18px_4px] border border-[#e0e3dd] bg-[#fffdf8] p-4 shadow-xl sm:block`}>
                <span className="block text-[10px] font-black uppercase tracking-[0.13em] text-[#e5683f]">Rawdha+</span>
                <span className="mt-1 block text-sm font-extrabold leading-5 text-[#13233a]">{isArabic ? 'الإدارة قربك، لا فوق يومك.' : 'La gestion à vos côtés, pas au-dessus de votre journée.'}</span>
              </div>
            </motion.figure>
          </div>
        </section>

        <section id="plateforme" className="scroll-mt-24 bg-[#13233a] px-5 py-20 text-white sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#f7af91]">{content.featureIntro}</p>
              <h2 className="mt-5 max-w-md font-landing-display text-5xl leading-[0.94] tracking-[-0.055em] sm:text-6xl">{isArabic ? 'من أول طلب إلى آخر قرار.' : 'De la première demande à la dernière décision.'}</h2>
              <p className="mt-7 max-w-md text-[15px] font-medium leading-7 text-[#c6d1db]">{content.featureText}</p>
              <div className="mt-10 flex items-center gap-3 text-[12px] font-black text-[#f8c7b2]"><LayoutDashboard className="h-4 w-4" /> {isArabic ? 'إدارة موحدة، بدون تعقيد.' : 'Une gestion unifiée, sans ajouter de complexité.'}</div>
            </div>
            <div className="grid gap-px overflow-hidden rounded-[22px] border border-white/10 bg-white/10 sm:grid-cols-2">
              {content.features.map(({ tag, title, text, icon: Icon }) => (
                <article key={tag} className="group bg-[#13233a] p-7 transition duration-200 hover:bg-[#1b314f] sm:p-8">
                  <div className="flex items-start justify-between gap-4"><span className="font-landing-display text-3xl text-[#f29a78]">{tag}</span><Icon className="h-5 w-5 text-[#9db5a0]" /></div>
                  <h3 className="mt-10 text-xl font-black tracking-[-0.025em]">{title}</h3>
                  <p className="mt-3 max-w-xs text-sm font-medium leading-6 text-[#b9c6d1]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="quotidien" className="scroll-mt-24 bg-[#f2eee4] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
            <figure className="order-2 overflow-hidden rounded-[10px_34px_10px_34px] bg-[#d8d4c8] shadow-[0_24px_45px_rgba(19,35,58,0.11)] lg:order-1">
              <img src={assets.operations} alt={isArabic ? 'أدوات تسيير حضانة منظمة على مكتب' : 'Outils de gestion de crèche organisés sur un bureau'} className="aspect-[1.18/1] w-full object-cover" />
            </figure>
            <div className="order-1 lg:order-2">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#c95132]">{content.rhythmEyebrow}</p>
              <h2 className="mt-5 max-w-xl font-landing-display text-5xl leading-[0.95] tracking-[-0.055em] text-[#13233a] sm:text-6xl">{content.rhythmTitle}</h2>
              <p className="mt-7 max-w-xl text-[16px] font-medium leading-8 text-[#526373]">{content.rhythmText}</p>
              <ol className="mt-10 divide-y divide-[#d3d8d0] border-y border-[#d3d8d0]">
                {content.steps.map(([number, title, text]) => (
                  <li key={number} className="grid grid-cols-[48px_1fr] gap-4 py-5 sm:grid-cols-[68px_1fr] sm:gap-6">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e5683f] text-xs font-black text-white">{number}</span>
                    <div><h3 className="text-base font-black text-[#13233a]">{title}</h3><p className="mt-1 text-sm font-medium leading-6 text-[#607180]">{text}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="connect" className="scroll-mt-24 bg-[#dce9dc] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto grid max-w-[1440px] overflow-hidden rounded-[36px_10px_36px_10px] bg-[#f9f6ef] shadow-[0_24px_48px_rgba(19,35,58,0.09)] lg:grid-cols-[1fr_0.95fr]">
            <div className="p-8 sm:p-12 lg:p-16">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#e4efff] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#28577d]"><Network className="h-3.5 w-3.5" /> {content.connectEyebrow}</div>
              <h2 className="mt-7 max-w-xl font-landing-display text-5xl leading-[0.95] tracking-[-0.055em] text-[#13233a] sm:text-6xl">{content.connectTitle}</h2>
              <p className="mt-7 max-w-xl text-[16px] font-medium leading-8 text-[#536271]">{content.connectText}</p>
              <div className="mt-8 flex flex-wrap gap-2">{content.connectTags.map((tag) => <span key={tag} className="rounded-full border border-[#d8ddd5] bg-white px-3 py-2 text-[11px] font-black text-[#506373]">{tag}</span>)}</div>
              <button type="button" onClick={() => onNavigate('login')} className="mt-10 inline-flex items-center gap-2 border-b-2 border-[#e5683f] pb-2 text-sm font-black text-[#13233a] transition hover:text-[#e5683f]">{content.connectCta} <DirectionArrow className="h-4 w-4" /></button>
            </div>
            <figure className="relative min-h-[320px] overflow-hidden lg:min-h-full">
              <img src={assets.connect} alt={isArabic ? 'مديرات حضانات يتبادلن الأفكار في فضاء مهني' : 'Directrices de crèches échangeant des idées dans un espace professionnel'} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#13233a]/45 via-transparent to-transparent" />
              <span className="absolute bottom-7 left-7 right-7 max-w-[250px] font-landing-display text-3xl leading-none tracking-[-0.04em] text-white">{isArabic ? 'نتقدم معاً، كل واحدة في حضانتها.' : 'Avancer ensemble, chacune dans sa crèche.'}</span>
            </figure>
          </div>
        </section>

        <section className="bg-[#f9f6ef] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#e5683f]">{isArabic ? 'مصمم على الواقع' : 'Conçu dans le réel'}</p><h2 className="mt-5 max-w-md font-landing-display text-5xl leading-[0.95] tracking-[-0.055em] text-[#13233a] sm:text-6xl">{content.proofTitle}</h2></div>
            <div className="border-l-0 border-[#d9ddd5] pt-1 lg:border-l lg:pl-16 ltr:lg:border-l rtl:lg:border-r rtl:lg:border-l-0 rtl:lg:pl-0 rtl:lg:pr-16">
              <p className="max-w-2xl text-[18px] font-medium leading-8 text-[#526373]">{content.proofText}</p>
              <div className="mt-9 grid gap-4 sm:grid-cols-3">{content.proofItems.map((item) => <div key={item} className="border-t-2 border-[#e5683f] pt-4 text-sm font-black leading-6 text-[#13233a]"><Check className="mb-3 h-4 w-4 text-[#739268]" />{item}</div>)}</div>
            </div>
          </div>
        </section>

        <section className="bg-[#e5683f] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-3xl"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#ffe1d4]">Rawdha+ · {isArabic ? 'بداية بسيطة' : 'Un début simple'}</p><h2 className="mt-5 font-landing-display text-5xl leading-[0.93] tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">{content.finalTitle}</h2><p className="mt-7 max-w-xl text-[16px] font-semibold leading-7 text-[#fff0e8]">{content.finalText}</p></div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row lg:flex-col"><button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#13233a] px-5 py-4 text-sm font-black text-white shadow-[0_14px_25px_rgba(19,35,58,0.2)] transition hover:-translate-y-0.5 active:scale-[0.97]">{content.finalPrimary} <DirectionArrow className="h-4 w-4" /></button><button type="button" onClick={() => onNavigate('login')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/60 bg-transparent px-5 py-4 text-sm font-black text-white transition hover:bg-white/10">{content.finalSecondary}</button></div>
          </div>
        </section>
      </main>

      <footer className="bg-[#13233a] px-5 py-8 text-[#cbd6dd] sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-5 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><img src={assets.mark} alt="" className="h-8 w-8 object-contain" /><span className="font-landing-display text-xl tracking-[-0.05em] text-white">Rawdha<span className="text-[#f29a78]">+</span></span><span className="h-4 w-px bg-white/20" /><span className="text-[11px] font-bold">{content.footer}</span></div><div className="flex items-center gap-3 text-[11px] font-black"><Globe2 className="h-3.5 w-3.5" /><button type="button" onClick={() => setLanguage(isArabic ? 'fr' : 'ar')} className="transition hover:text-white">{isArabic ? 'Français' : 'العربية'}</button><span className="text-white/30">·</span><span>© 2026 RAWDHA+</span></div></div>
      </footer>
    </div>
  );
}
