import "./firstRunOnboarding.css";
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, FileSpreadsheet, Layers3, UsersRound } from 'lucide-react';

export type OnboardingStep = 'welcome' | 'language' | 'children' | 'classes' | 'team' | 'done';
export type OnboardingPage = 'enfants' | 'classes' | 'personnel';
export interface OnboardingProgress { account_id: string; step: OnboardingStep; language: 'fr' | 'ar' | null; task_page: OnboardingPage | null }

type Props = { firstName: string; progress: OnboardingProgress; language: 'fr' | 'ar'; onChangeLanguage: (lang: 'fr' | 'ar') => void; onSave: (patch: Partial<OnboardingProgress>) => Promise<void>; onOpenTask: (page: OnboardingPage) => Promise<void>; onLogout: () => void };

export default function FirstRunOnboarding({ firstName, progress, language, onChangeLanguage, onSave, onOpenTask, onLogout }: Props) {
  const isAr = language === 'ar';
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const name = firstName.trim();
  const t = (fr: string, ar: string) => isAr ? ar : fr;
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await action(); }
    catch { setError(t('Impossible de sauvegarder. Vérifiez votre connexion et réessayez.', 'تعذر الحفظ. تحققي من الاتصال وحاولي مجدداً.')); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const advanceFromWelcome = () => run(() => onSave({ step: 'language' }));
  const advanceRef = useRef(advanceFromWelcome);
  advanceRef.current = advanceFromWelcome;
  useEffect(() => {
    if (progress.step !== 'welcome') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => { void advanceRef.current(); }, reduced ? 0 : 4200);
    return () => window.clearTimeout(timer);
  }, [progress.step]);

  if (progress.step === 'welcome') return <main className="setup-splash" aria-label="Rawdha+">
    <div className="setup-splash-content"><img src="/onboarding/logo-white.png" alt="Rawdha+" className="setup-splash-logo"/><h1 className="setup-splash-title">{name ? `Bonjour, ${name}.` : 'Bienvenue.'}</h1><p className="setup-splash-ar" lang="ar" dir="rtl">{name ? <>مرحباً، <bdi>{name}</bdi></> : 'مرحباً بك'}</p></div>
    <button type="button" onClick={() => void advanceFromWelcome()} disabled={busy} className="setup-skip">{t('Passer', 'تخطي')} ›</button>
    {error && <p role="alert" className="setup-splash-error">{error}</p>}
  </main>;

  if (progress.step === 'language') return <main className="setup-language" dir="ltr"><div className="setup-language-card">
    <img src="/rawdah-logo.png" alt="Rawdha+" className="setup-brand"/><h1>Choisissez votre langue</h1><p lang="ar" dir="rtl">اختاري لغتك المفضلة</p>
    <div className="setup-language-options"><button type="button" disabled={busy} onClick={() => void run(async () => { await onSave({ step: 'children', language: 'fr' }); onChangeLanguage('fr'); })}><strong>Français</strong><span>Continuer en français →</span></button><button type="button" lang="ar" dir="rtl" disabled={busy} onClick={() => void run(async () => { await onSave({ step: 'children', language: 'ar' }); onChangeLanguage('ar'); })}><strong>العربية</strong><span>المتابعة بالعربية ←</span></button></div>
    {error && <p role="alert" className="setup-error">{error}</p>}
  </div></main>;

  const steps = [
    { key: 'children' as const, label: t('Enfants', 'الأطفال'), title: t('Une liste d’enfants ?', 'لديك قائمة أطفال؟'), description: t('Importez votre liste d’enfants pour éviter de tout ressaisir.', 'استوردي قائمتك لتجنب إعادة الإدخال.'), note: t('Fichier Excel (.xlsx) ou CSV. Vous vérifierez les données avant l’import.', 'Excel (.xlsx) أو CSV · مراجعة قبل الاستيراد.'), action: t('Ouvrir l’import', 'فتح الاستيراد'), page: 'enfants' as const, Icon: FileSpreadsheet, next: 'classes' as const },
    { key: 'classes' as const, label: t('Classes', 'الأقسام'), title: t('Votre première classe', 'قسمك الأول'), description: t('Organisez les enfants en groupes pour faciliter votre quotidien.', 'نظّمي الأطفال في أقسام لتسهيل يومك.'), note: t('Vous pourrez ajouter d’autres classes plus tard.', 'يمكنك إضافة أقسام أخرى لاحقاً.'), action: t('Créer une classe', 'إضافة قسم'), page: 'classes' as const, Icon: Layers3, next: 'team' as const },
    { key: 'team' as const, label: t('Équipe', 'الفريق'), title: t('Vous travaillez en équipe ?', 'هل تعملين مع فريق؟'), description: t('Configurez un accès et les permissions de votre équipe.', 'أعدّي وصول الفريق وصلاحياته.'), note: t('Vous pourrez configurer les accès plus tard dans Personnel.', 'يمكنك إعداد صلاحيات الفريق لاحقاً من قسم الموظفين.'), action: t('Configurer les accès', 'إعداد الصلاحيات'), page: 'personnel' as const, Icon: UsersRound, next: 'done' as const },
  ];
  const index = Math.max(0, steps.findIndex(item => item.key === progress.step));
  const step = steps[index];
  const Icon = step.Icon;
  return <main className="setup-shell" dir={isAr ? 'rtl' : 'ltr'}><div className="setup-container">
    <header className="setup-heading"><p className="setup-kicker">Rawdha+</p><h1>{name ? <>{t('Bonjour, ', 'مرحباً، ')}<bdi dir="auto">{name}</bdi></> : t('Bienvenue', 'مرحباً بك')}</h1><p>{t('Préparons votre espace, à votre rythme.', 'لنُجهّز فضاءك، على مهل.')}</p></header>
    <div className="setup-layout"><nav className="setup-steps" aria-label={t('Étapes de démarrage', 'مراحل البدء')}>{steps.map((item, i) => <div key={item.key} className={`setup-step ${i === index ? 'is-current' : ''} ${i < index ? 'is-done' : ''}`} aria-current={i === index ? 'step' : undefined}><span className="setup-step-number">{i + 1}</span><span>{item.label}</span></div>)}</nav>
      <section className="setup-card" aria-labelledby="setup-step-title"><div className="setup-card-header"><span className="setup-icon"><Icon size={21}/></span><div><p className="setup-kicker">{t(`Étape ${index + 1} sur 3`, `المرحلة ${index + 1} من 3`)}</p><h2 id="setup-step-title">{step.title}</h2></div></div>
        <p className="setup-description">{step.description}</p><div className="setup-action-box"><Icon size={25} aria-hidden="true"/><p>{step.note}</p><button type="button" disabled={busy} onClick={() => void run(() => onOpenTask(step.page))} className="setup-action">{step.action}</button></div>
        {error && <p role="alert" className="setup-error">{error}</p>}
        <div className="setup-controls"><button type="button" disabled={busy} onClick={() => void run(() => onSave({ step: index ? steps[index - 1].key : 'language' }))} className="setup-secondary">{isAr ? <ArrowRight size={15}/> : <ArrowLeft size={15}/>} {t('Retour', 'رجوع')}</button><div className="setup-controls-end"><button type="button" disabled={busy} onClick={() => void run(() => onSave({ step: step.next }))} className="setup-secondary">{t('Plus tard', 'لاحقاً')}</button><button type="button" disabled={busy} onClick={() => void run(() => onSave({ step: step.next }))} className="setup-primary">{index === 2 ? t('Terminer', 'إنهاء') : t('Continuer', 'متابعة')} {isAr ? <ArrowLeft size={15}/> : <ArrowRight size={15}/>}</button></div></div>
      </section></div><div className="setup-footer"><button type="button" disabled={busy} onClick={() => void run(() => onSave({ step: 'done' }))}>{t('Accéder à mon espace', 'الدخول إلى فضائي')}</button><button type="button" onClick={onLogout}>{t('Déconnexion', 'تسجيل الخروج')}</button></div>
  </div></main>;
}
