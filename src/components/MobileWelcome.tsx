import { useEffect, useState } from 'react';
import { Baby, BadgeCheck, Download } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function MobileWelcome() {
  const { isFrench } = useLanguage();
  const [isLeaving, setIsLeaving] = useState(false);

  const copy = isFrench ? {
    subtitle: 'Premium Nursery Platform',
    badge: 'Gestion de crèche de nouvelle génération',
    title: 'L’excellence dans la gestion de votre crèche.',
    description: 'Présences, enfants, équipe, activités, repas et facturation réunis dans un espace clair et sécurisé.',
    continue: 'Accéder à la connexion',
    installAndroid: 'Installer l’application Android',
    installHint: 'Téléchargement direct de l’APK Android',
    footer: '© 2026 RAWDHA+. Tous droits réservés.',
  } : {
    subtitle: 'منصة احترافية لتسيير الحضانة',
    badge: 'تسيير عصري للحضانة',
    title: 'كل ما تحتاجه لتسيير حضانتك بسهولة.',
    description: 'الحضور، الأطفال، الفريق، الأنشطة، الوجبات والفواتير في فضاء واضح وآمن.',
    continue: 'الدخول إلى صفحة الاتصال',
    installAndroid: 'تثبيت تطبيق أندرويد',
    installHint: 'تحميل مباشر لملف أندرويد',
    footer: '© 2026 روضة+. جميع الحقوق محفوظة.',
  };

  const goToLogin = () => {
    if (isLeaving) return;
    setIsLeaving(true);
    window.setTimeout(() => {
      // Navigation interne SPA : compatible web et application Capacitor, sans recharger une URL distante.
      window.history.pushState({}, '', '/login/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, 650);
  };

  useEffect(() => {
    const timer = window.setTimeout(goToLogin, 3200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main
      dir={isFrench ? 'ltr' : 'rtl'}
      className={`min-h-[100dvh] overflow-hidden bg-[#f8fafc] transition-opacity duration-700 ease-out lg:hidden ${isLeaving ? 'opacity-0' : 'opacity-100'}`}
    >
      <section className="relative min-h-[100dvh] overflow-hidden bg-[url('/login-nursery-hero-a.jpg')] bg-cover bg-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#d93e34]/[0.93] via-[#eb6138]/[0.84] to-[#f4a033]/[0.78]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#9e2f32]/55 via-transparent to-white/10" />
        <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-amber-100/20 blur-3xl" />

        <div className="relative z-10 flex min-h-[100dvh] flex-col justify-between p-6 pt-28 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/30 bg-white/20 p-3 shadow-inner backdrop-blur-md">
              <Baby className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-wider drop-shadow-sm">RAWDHA+</h1>
              <p className="text-[10px] tracking-[0.14em] text-white/80">{copy.subtitle}</p>
            </div>
          </div>

          <div className="space-y-5 pb-10">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <BadgeCheck className="h-3.5 w-3.5 text-amber-200" />
              <span>{copy.badge}</span>
            </div>
            <h2 className="font-display text-4xl font-extrabold leading-[0.98] tracking-tight">{copy.title}</h2>
            <p className="max-w-sm text-sm leading-relaxed text-white/90">{copy.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={goToLogin}
                className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-5 py-3 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/80"
              >
                <span>{copy.continue}</span>
                <span aria-hidden="true">↓</span>
              </button>
              <a
                href="https://github.com/Maleklabbaci/rawdativ2/releases/download/android-v1.0.0/RawdhaPlus-v1.0.0-android.apk"
                className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-white px-4 py-3 text-sm font-bold text-[#d94b38] shadow-lg transition hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-white/80"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>{copy.installAndroid}</span>
              </a>
            </div>
            <p className="text-xs text-white/75">{copy.installHint}</p>
          </div>

          <p className="border-t border-white/25 pt-4 text-xs text-white/70">{copy.footer}</p>
        </div>
      </section>
    </main>
  );
}
