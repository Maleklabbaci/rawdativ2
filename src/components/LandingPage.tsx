/**
 * Style context — Vitrine officielle Rawdha+: sobriété SaaS, logo réel, sans art généré.
 * La page publique présente les modules existants de manière concrète et conserve les
 * accès de connexion/inscription déjà établis dans l’application.
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

const modules = {
  fr: [
    { icon: ClipboardList, title: 'Admissions', text: 'Centralisez les demandes et préparez les dossiers enfants sans perdre d’information.' },
    { icon: CalendarCheck, title: 'Présences', text: 'Suivez les arrivées, absences, sorties et récapitulatifs de chaque journée.' },
    { icon: Users, title: 'Équipe & activités', text: 'Organisez vos classes, votre personnel, les activités et les repas au même endroit.' },
    { icon: CreditCard, title: 'Paiements', text: 'Consultez les échéances, les règlements et les éléments à vérifier simplement.' },
  ],
  ar: [
    { icon: ClipboardList, title: 'طلبات التسجيل', text: 'اجمعي الطلبات وجهّزي ملفات الأطفال دون ضياع أي معلومة.' },
    { icon: CalendarCheck, title: 'الحضور', text: 'تابعي الوصول والغياب والخروج وملخص كل يوم.' },
    { icon: Users, title: 'الفريق والأنشطة', text: 'نظّمي الأقسام والموظفين والأنشطة والوجبات في مكان واحد.' },
    { icon: CreditCard, title: 'الدفعات', text: 'راجعي الاستحقاقات والتسديدات والعناصر التي تحتاج متابعة ببساطة.' },
  ],
};

const copy = {
  fr: {
    nav: { platform: 'Plateforme', modules: 'Fonctionnalités', network: 'Rawdha Connect', login: 'Se connecter', request: 'Demander un accès' },
    badge: 'Plateforme de gestion de crèche',
    title: 'Gérez votre crèche avec une vision claire de chaque journée.',
    text: 'Rawdha+ rassemble les admissions, présences, classes, activités, équipe, paiements et communication dans un seul espace bilingue.',
    primary: 'Demander un accès',
    secondary: 'Se connecter',
    assurance: ['Français & العربية', 'Accès Directeur validé', 'Données organisées'],
    previewLabel: 'Aperçu de la plateforme',
    previewTitle: 'Tableau de bord',
    previewToday: 'Aujourd’hui',
    previewItems: ['Présences à consulter', 'Demandes d’admission', 'Paiements à vérifier'],
    overview: 'Une plateforme faite pour le travail quotidien des crèches.',
    overviewText: 'Vous gardez les informations importantes au même endroit et vous passez moins de temps entre les listes, messages et documents.',
    modulesLabel: 'Les modules Rawdha+',
    connectLabel: 'Rawdha Connect',
    connectTitle: 'Le réseau professionnel des Directrices, directement dans Rawdha+.',
    connectText: 'Partagez une activité, échangez avec votre réseau, découvrez une annonce ou recevez une information officielle sans quitter la plateforme.',
    connectItems: ['Fil professionnel', 'Messagerie entre Directrices', 'Annonces et notifications'],
    connectAction: 'Accéder à Rawdha Connect',
    securityLabel: 'Un accès simple et maîtrisé',
    securityTitle: 'Chaque Directeur rejoint la plateforme après validation.',
    securityText: 'Une demande crée un accès en attente. L’administrateur garde le contrôle avant l’activation complète du compte.',
    finalTitle: 'Prêt à organiser votre crèche avec Rawdha+ ?',
    finalText: 'Envoyez votre demande d’accès. L’équipe Rawdha+ examine votre dossier puis active votre espace.',
    finalPrimary: 'Créer ma demande Directeur',
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
    primary: 'اطلبي الولوج',
    secondary: 'تسجيل الدخول',
    assurance: ['Français & العربية', 'ولوج المديرة بعد المصادقة', 'بيانات منظمة'],
    previewLabel: 'نظرة على المنصة',
    previewTitle: 'لوحة المتابعة',
    previewToday: 'اليوم',
    previewItems: ['حضور يحتاج مراجعة', 'طلبات تسجيل', 'دفعات تحتاج متابعة'],
    overview: 'منصة للعمل اليومي الحقيقي داخل الحضانات.',
    overviewText: 'تبقى المعلومات المهمة في مكان واحد وتقللين الوقت بين القوائم والرسائل والوثائق.',
    modulesLabel: 'وحدات Rawdha+',
    connectLabel: 'Rawdha Connect',
    connectTitle: 'شبكة مهنية للمديرات، داخل Rawdha+ مباشرة.',
    connectText: 'شاركي نشاطاً وتبادلي الخبرات مع شبكتك واكتشفي إعلاناً أو استقبلي معلومة رسمية دون مغادرة المنصة.',
    connectItems: ['منشورات مهنية', 'رسائل بين المديرات', 'إعلانات وإشعارات'],
    connectAction: 'الدخول إلى Rawdha Connect',
    securityLabel: 'ولوج بسيط ومتحكم فيه',
    securityTitle: 'كل مديرة تنضم إلى المنصة بعد المصادقة.',
    securityText: 'ينشئ الطلب ولوجاً في انتظار المراجعة. يبقى المسؤول متحكماً قبل التفعيل الكامل للحساب.',
    finalTitle: 'جاهزة لتنظيم حضانتك مع Rawdha+؟',
    finalText: 'أرسلي طلب الولوج. يراجع فريق Rawdha+ ملفك ثم يفعّل فضاءك.',
    finalPrimary: 'إنشاء طلب مديرة',
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
  const currentModules = isArabic ? modules.ar : modules.fr;
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
    <div dir={isArabic ? 'rtl' : 'ltr'} className="min-h-screen overflow-x-hidden bg-white font-sans text-slate-900">
      <header className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-200 ${scrolled ? 'border-slate-200 bg-white/95 shadow-sm backdrop-blur' : 'border-transparent bg-white/90 backdrop-blur sm:bg-transparent'}`}>
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5" aria-label="Rawdha+">
            <img src="/rawdah-logo.png" alt="Rawdha+" className="h-11 w-11 rounded-xl object-contain shadow-sm" />
            <span className="text-left leading-tight"><span className="block text-[17px] font-black tracking-tight text-slate-900">RAWDHA<span className="text-[#e85b2d]">+</span></span><span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{content.footer}</span></span>
          </button>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Navigation principale">
            <button type="button" onClick={() => scrollToSection('plateforme')} className="text-sm font-bold text-slate-600 transition hover:text-[#e85b2d]">{content.nav.platform}</button>
            <button type="button" onClick={() => scrollToSection('modules')} className="text-sm font-bold text-slate-600 transition hover:text-[#e85b2d]">{content.nav.modules}</button>
            <button type="button" onClick={() => scrollToSection('connect')} className="text-sm font-bold text-slate-600 transition hover:text-[#e85b2d]">{content.nav.network}</button>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"><button type="button" onClick={() => setLanguage('fr')} className={`rounded-md px-2 py-1 text-[10px] font-black ${!isArabic ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>FR</button><button type="button" onClick={() => setLanguage('ar')} className={`rounded-md px-2 py-1 text-[10px] font-black ${isArabic ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>ع</button></div>
            <button type="button" onClick={() => onNavigate('login')} className="px-2 text-sm font-bold text-slate-700 transition hover:text-[#e85b2d]">{content.nav.login}</button>
            <button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center gap-2 rounded-lg bg-[#e85b2d] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#d84d21] active:scale-[0.97]">{content.nav.request}<Arrow className="h-4 w-4" /></button>
          </div>

          <button type="button" onClick={() => setMenuOpen((value) => !value)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 md:hidden" aria-label={menuOpen ? content.close : content.menu}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {menuOpen && <div className="border-t border-slate-200 bg-white px-4 py-4 shadow-lg md:hidden"><div className="flex flex-col gap-1">{[['plateforme', content.nav.platform], ['modules', content.nav.modules], ['connect', content.nav.network]].map(([id, label]) => <button key={id} type="button" onClick={() => scrollToSection(id)} className="rounded-lg px-3 py-3 text-start text-sm font-bold text-slate-800 hover:bg-slate-50">{label}</button>)}<div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => onNavigate('login')} className="rounded-lg border border-slate-200 px-3 py-3 text-sm font-bold text-slate-800">{content.nav.login}</button><button type="button" onClick={() => onNavigate('request')} className="rounded-lg bg-[#e85b2d] px-3 py-3 text-sm font-bold text-white">{content.nav.request}</button></div></div></div>}
      </header>

      <main>
        <section id="plateforme" className="scroll-mt-20 border-b border-slate-100 bg-[linear-gradient(115deg,#fff7f2_0%,#ffffff_48%,#f4f8ff_100%)] px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:px-8 lg:pb-24">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-20">
            <div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-bold text-[#c94b24]"><ShieldCheck className="h-4 w-4" />{content.badge}</span><h1 className="mt-6 text-4xl font-black leading-[1.06] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">{content.title}</h1><p className="mt-6 max-w-xl text-base font-medium leading-7 text-slate-600 sm:text-lg">{content.text}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#e85b2d] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#d84d21] active:scale-[0.97]">{content.primary}<Arrow className="h-4 w-4" /></button><button type="button" onClick={() => onNavigate('login')} className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3.5 text-sm font-bold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50">{content.secondary}</button></div><div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-500">{content.assurance.map((item) => <span key={item} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{item}</span>)}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_20px_45px_rgba(15,23,42,0.10)] sm:p-4"><div className="overflow-hidden rounded-xl border border-slate-200"><div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><div className="flex items-center gap-2"><img src="/rawdah-logo.png" alt="" className="h-7 w-7 object-contain" /><div><p className="text-xs font-black text-slate-900">RAWDHA+</p><p className="text-[10px] font-medium text-slate-500">{content.previewLabel}</p></div></div><span className="text-[10px] font-bold text-slate-500">{content.previewToday}</span></div><div className="grid gap-3 p-4 sm:grid-cols-2"><div className="rounded-lg border border-slate-200 p-4 sm:col-span-2"><div className="flex items-center justify-between"><div><p className="text-sm font-black text-slate-900">{content.previewTitle}</p><p className="mt-1 text-xs text-slate-500">{isArabic ? 'ملخص بسيط لمتابعة العمل' : 'Un résumé simple pour suivre votre activité'}</p></div><LayoutDashboard className="h-5 w-5 stroke-[1.6] text-slate-500" /></div></div>{content.previewItems.map((item, index) => <div key={item} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white p-3">{index === 0 ? <CalendarCheck className="h-4 w-4 shrink-0 stroke-[1.6] text-slate-500" /> : index === 1 ? <ClipboardList className="h-4 w-4 shrink-0 stroke-[1.6] text-slate-500" /> : <CreditCard className="h-4 w-4 shrink-0 stroke-[1.6] text-slate-500" />}<span className="text-xs font-bold text-slate-700">{item}</span></div>)}</div></div></div>
          </div>
        </section>

        <section id="modules" className="scroll-mt-20 bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"><div className="mx-auto max-w-7xl"><div className="max-w-2xl"><p className="text-sm font-bold text-[#e85b2d]">{content.modulesLabel}</p><h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{content.overview}</h2><p className="mt-4 text-base leading-7 text-slate-600">{content.overviewText}</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{currentModules.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"><Icon aria-hidden="true" className="h-5 w-5 stroke-[1.6] text-slate-500" /><h3 className="mt-4 text-base font-black text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}</div></div></section>

        <section id="connect" className="scroll-mt-20 border-y border-slate-200 bg-slate-50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-20">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-500"><Network className="h-4 w-4 stroke-[1.6]" />{content.connectLabel}</div>
              <h2 className="mt-5 max-w-2xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{content.connectTitle}</h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">{content.connectText}</p>
              <div className="mt-7 space-y-3">{content.connectItems.map((item) => <p key={item} className="flex items-center gap-2 text-sm font-bold text-slate-700"><CheckCircle2 className="h-4 w-4 stroke-[1.6] text-slate-500" />{item}</p>)}</div>
              <button type="button" onClick={() => onNavigate('login')} className="mt-8 inline-flex items-center gap-2 text-sm font-black text-[#e85b2d] transition hover:text-[#c94b24]">{content.connectAction}<Arrow className="h-4 w-4" /></button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><Network className="h-5 w-5 stroke-[1.6] text-slate-500" /><div><p className="text-sm font-black text-slate-900">Rawdha Connect</p><p className="text-xs text-slate-500">{isArabic ? 'فضاء مهني للمديرات' : 'Espace professionnel des Directrices'}</p></div></div>
              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><img src="/rawdah-logo.png" alt="" className="h-9 w-9 rounded-lg object-contain" /><div><p className="text-sm font-black text-slate-900">Rawdha+</p><p className="text-[11px] text-slate-500">{isArabic ? 'منصة الحضانات' : 'Plateforme des crèches'}</p></div></div><span className="text-xs text-slate-400">{isArabic ? 'إعلان' : 'Annonce'}</span></div>
                <p className="mt-4 text-sm font-medium leading-6 text-slate-700">{isArabic ? 'تابعي أخبار المنصة وشاركي خبراتك المهنية مع شبكتك.' : 'Retrouvez les informations de la plateforme et partagez vos pratiques professionnelles avec votre réseau.'}</p>
                <div className="mt-4 flex gap-4 border-t border-slate-100 pt-3 text-xs font-bold text-slate-500"><span className="inline-flex items-center gap-1"><Bell className="h-3.5 w-3.5" />{isArabic ? 'إشعارات' : 'Notifications'}</span><span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{isArabic ? 'رسائل' : 'Messages'}</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"><div className="mx-auto grid max-w-7xl gap-10 rounded-2xl border border-slate-200 bg-[#fff8f4] p-7 sm:p-10 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:p-14"><div><p className="text-sm font-bold text-[#e85b2d]">{content.securityLabel}</p><h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{content.securityTitle}</h2><p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{content.securityText}</p></div><div className="rounded-xl border border-orange-200 bg-white p-5"><ShieldCheck className="h-7 w-7 text-[#e85b2d]" /><p className="mt-4 text-sm font-black text-slate-900">{isArabic ? 'حالة الوصول' : 'Statut d’accès'}</p><div className="mt-3 space-y-2 text-sm font-medium text-slate-600"><p className="flex items-center justify-between"><span>{isArabic ? 'الطلب' : 'Demande'}</span><span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-[#c94b24]">{isArabic ? 'في الانتظار' : 'En attente'}</span></p><p className="flex items-center justify-between"><span>{isArabic ? 'التفعيل' : 'Activation'}</span><span className="text-xs font-bold text-slate-500">{isArabic ? 'بعد المراجعة' : 'Après validation'}</span></p></div></div></div></section>

        <section className="bg-[#172b4d] px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8 lg:py-24"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 lg:flex-row lg:items-end"><div className="max-w-3xl"><h2 className="text-3xl font-black tracking-tight sm:text-5xl">{content.finalTitle}</h2><p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">{content.finalText}</p></div><div className="flex flex-col gap-3 sm:flex-row lg:flex-col"><button type="button" onClick={() => onNavigate('request')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#e85b2d] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#d84d21] active:scale-[0.97]">{content.finalPrimary}<Arrow className="h-4 w-4" /></button><button type="button" onClick={() => onNavigate('login')} className="rounded-lg border border-white/25 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">{content.finalSecondary}</button></div></div></section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-7 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><img src="/rawdah-logo.png" alt="Rawdha+" className="h-7 w-7 rounded-lg object-contain" /><span className="font-black text-slate-800">RAWDHA<span className="text-[#e85b2d]">+</span></span><span>{content.footer}</span></div><div className="flex items-center gap-3"><Globe2 className="h-4 w-4" /><button type="button" onClick={() => setLanguage(isArabic ? 'fr' : 'ar')} className="font-bold text-slate-700 hover:text-[#e85b2d]">{isArabic ? 'Français' : 'العربية'}</button><span>© 2026 RAWDHA+</span></div></div></footer>
    </div>
  );
}
