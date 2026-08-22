// Style d’authentification Rawdha+ : interface claire, repères bilingues et actions de distribution explicitement non actives tant que les stores ne sont pas publiés.
import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Clock3,
  Apple,
  Globe2,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Play,
  Send,
  ShieldCheck,
  BadgeCheck,
  UserRound,
} from 'lucide-react';

function isValidAlgerianPhone(value: string): boolean {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('213')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.length === 9 && /^[5-7]\d{8}$/.test(digits);
}

function formatAuthError(message: string | null, fallback: string, isFrench: boolean): string {
  if (!message || message === '{}' || message === '[object Object]') return fallback;
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) {
    return isFrench ? 'Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe.' : 'بيانات الدخول غير صحيحة. تحققي من البريد الإلكتروني وكلمة المرور.';
  }
  if (normalized.includes('email not confirmed')) {
    return isFrench ? 'Votre accès n’est pas encore activé par l’administrateur.' : 'لم يتم تفعيل حسابك من طرف المسؤول بعد.';
  }
  if (normalized.includes('too many') || normalized.includes('rate limit')) {
    return isFrench ? 'Trop de demandes. Patientez quelques instants avant de réessayer.' : 'عدد المحاولات كبير جداً. انتظري قليلاً ثم حاولي من جديد.';
  }
  if (normalized.includes('user not found')) {
    return isFrench ? 'Aucun compte Rawdha+ correspondant n’a été trouvé.' : 'لم يتم العثور على حساب مطابق في روضة+.';
  }
  if (normalized.includes('profile rawdha')) {
    return isFrench ? 'Votre authentification est valide, mais votre compte n’est pas encore rattaché à Rawdha+.' : 'تم التحقق من هويتك، لكن حسابك غير مرتبط بمنصة روضة+ بعد.';
  }
  return message;
}

const inputClass = 'w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-base sm:text-sm text-slate-800 bg-white';
const iconInputClass = `${inputClass} pl-10 rtl:pl-4 rtl:pr-10`;

export default function SignIn({ mode = 'signin' }: { mode?: 'signin' | 'request' }) {
  const { isFrench, setLanguage } = useLanguage();
  const { loginWithCredentials } = useAuth();
  const view = mode;
  const copy = isFrench ? {
    brandSubtitle: 'Plateforme professionnelle de gestion de crèche',
    badge: 'Gestion de crèche de nouvelle génération',
    heroTitle: 'L’excellence dans la gestion de votre crèche.',
    heroDescription: 'Présences, enfants, équipe, activités, repas et facturation réunis dans un espace clair et sécurisé.',
    security: 'Accès validé par l’équipe Rawdha+',
    activation: 'Activation rapide après examen de la demande',
    whatsapp: 'Confirmation directe par WhatsApp',
    footer: '© 2026 RAWDHA+. Tous droits réservés.',
    space: 'ESPACE DIRECTEUR ET GESTION',
    signinTitle: 'Connectez-vous',
    signinDescription: 'Utilisez l’adresse e-mail et le mot de passe choisis lors de votre inscription.',
    requestTitle: 'Demander un accès Rawdha+',
    requestDescription: 'Créez vos identifiants dès maintenant. L’administrateur ne fera ensuite que valider ou refuser votre demande.',
    noAccount: 'Pas encore de compte ?',
    hasAccount: 'Vous avez déjà un compte ?',
    requestLink: 'Demander un accès',
    loginLink: 'Se connecter',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    loginNote: 'Après validation par l’administrateur, votre compte sera activé directement avec le mot de passe choisi à l’inscription.',
    loginButton: 'Se connecter à RAWDHA+',
    firstName: 'Prénom *',
    lastName: 'Nom *',
    professionalEmail: 'E-mail professionnel *',
    nurseryName: 'Nom de la crèche *',
    phone: 'Téléphone *',
    address: 'Adresse de la crèche *',
    confirmPassword: 'Confirmer le mot de passe *',
    website: 'Site web',
    message: 'Message',
    passwordHint: '8 caractères minimum',
    repeatPassword: 'Répétez le mot de passe',
    addressPlaceholder: 'Adresse complète',
    needPlaceholder: 'Votre besoin',
    requestNote: 'Votre mot de passe est géré de façon sécurisée par Supabase et n’est jamais envoyé à l’administrateur. Après acceptation, vous pourrez vous connecter immédiatement avec vos identifiants.',
    requestButton: 'Envoyer ma demande',
    parentNote: 'L’espace parent sera ajouté séparément dans une prochaine version de Rawdha+.',
    storesHeading: 'L’application mobile arrive bientôt',
    storesDescription: 'Les versions Google Play et App Store seront disponibles prochainement.',
    availableSoon: 'Prochainement',
    googlePlay: 'Google Play',
    appStore: 'App Store',
    requestSuccess: 'Votre demande a bien été envoyée. Après acceptation, ouvrez /login/ pour vous connecter avec le mot de passe que vous venez de définir.',
    requiredError: 'Veuillez remplir tous les champs obligatoires, y compris le mot de passe.',
    passwordLengthError: 'Le mot de passe doit contenir au moins 8 caractères.',
    passwordMismatchError: 'Les deux mots de passe ne correspondent pas.',
    requestError: 'Impossible d’envoyer la demande pour le moment. Réessayez dans quelques instants.',
    duplicateError: 'Cette adresse e-mail possède déjà une demande ou un compte Rawdha+.',
  } : {
    brandSubtitle: 'منصة احترافية لتسيير الحضانة',
    badge: 'تسيير عصري للحضانة',
    heroTitle: 'كل ما تحتاجه لتسيير حضانتك بسهولة.',
    heroDescription: 'الحضور، الأطفال، الفريق، الأنشطة، الوجبات والفواتير في فضاء واضح وآمن.',
    security: 'دخول مصادق عليه من فريق روضة+',
    activation: 'تفعيل سريع بعد دراسة الطلب',
    whatsapp: 'تأكيد مباشر عبر واتساب',
    footer: '© 2026 روضة+. جميع الحقوق محفوظة.',
    space: 'فضاء المديرة والتسيير',
    signinTitle: 'تسجيل الدخول',
    signinDescription: 'استعملي البريد الإلكتروني وكلمة المرور اللذين اخترتهما عند التسجيل.',
    requestTitle: 'طلب الوصول إلى روضة+',
    requestDescription: 'أنشئي معلومات الدخول الآن، وبعدها يقوم المسؤول بقبول طلبك أو رفضه.',
    noAccount: 'ما عندكش حساب؟',
    hasAccount: 'عندك حساب من قبل؟',
    requestLink: 'اطلبي الوصول',
    loginLink: 'تسجيل الدخول',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    loginNote: 'بعد موافقة المسؤول، يتم تفعيل حسابك وتستعملي نفس كلمة المرور التي اخترتها عند التسجيل.',
    loginButton: 'الدخول إلى روضة+',
    firstName: 'الاسم *',
    lastName: 'اللقب *',
    professionalEmail: 'البريد المهني *',
    nurseryName: 'اسم الحضانة *',
    phone: 'رقم الهاتف *',
    address: 'عنوان الحضانة *',
    confirmPassword: 'تأكيد كلمة المرور *',
    website: 'الموقع الإلكتروني',
    message: 'رسالة',
    passwordHint: '8 أحرف على الأقل',
    repeatPassword: 'أعيدي كتابة كلمة المرور',
    addressPlaceholder: 'العنوان الكامل',
    needPlaceholder: 'احتياجك',
    requestNote: 'كلمة المرور تاعك محمية بشكل آمن عبر Supabase وما تتبعثش للمسؤول. بعد قبول الطلب، تقدري تدخلي مباشرة بمعلوماتك.',
    requestButton: 'إرسال الطلب',
    parentNote: 'فضاء الأولياء راح نضيفوه بشكل منفصل في نسخة جاية من روضة+.',
    storesHeading: 'تطبيق الهاتف قريباً',
    storesDescription: 'نسخ Google Play وApp Store ستكون متوفرة قريباً.',
    availableSoon: 'قريباً',
    googlePlay: 'Google Play',
    appStore: 'App Store',
    requestSuccess: 'تم إرسال طلبك بنجاح. بعد القبول، افتحي /login/ وسجلي الدخول بكلمة المرور التي اخترتها.',
    requiredError: 'يرجى ملء جميع الخانات الإلزامية، بما فيها كلمة المرور.',
    passwordLengthError: 'لازم كلمة المرور تكون فيها 8 أحرف على الأقل.',
    passwordMismatchError: 'كلمتا المرور غير متطابقتين.',
    requestError: 'ما قدرناش نرسلوا الطلب حالياً. حاولي مرة أخرى بعد لحظات.',
    duplicateError: 'هذا البريد الإلكتروني عنده طلب أو حساب موجود في روضة+.',
  };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [directorNom, setDirectorNom] = useState('');
  const [directorPrenom, setDirectorPrenom] = useState('');
  const [directorEmail, setDirectorEmail] = useState('');
  const [directorCreche, setDirectorCreche] = useState('');
  const [directorPhone, setDirectorPhone] = useState('');
  const [directorAddress, setDirectorAddress] = useState('');
  const [directorPassword, setDirectorPassword] = useState('');
  const [directorPasswordConfirmation, setDirectorPasswordConfirmation] = useState('');
  const [directorWebsite, setDirectorWebsite] = useState('');
  const [directorMessage, setDirectorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const resetRequestForm = () => {
    setDirectorNom('');
    setDirectorPrenom('');
    setDirectorEmail('');
    setDirectorCreche('');
    setDirectorPhone('');
    setDirectorAddress('');
    setDirectorPassword('');
    setDirectorPasswordConfirmation('');
    setDirectorWebsite('');
    setDirectorMessage('');
  };

  const handleSubmitRequest = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!directorNom.trim() || !directorPrenom.trim() || !directorEmail.trim() || !directorCreche.trim() || !directorPhone.trim() || !directorAddress.trim() || !directorPassword) {
      setError(copy.requiredError);
      return;
    }
    if (!isValidAlgerianPhone(directorPhone)) {
      setError(isFrench ? 'Veuillez saisir un numéro de téléphone algérien valide.' : 'يرجى إدخال رقم هاتف جزائري صالح.');
      return;
    }
    if (directorPassword.length < 8) {
      setError(copy.passwordLengthError);
      return;
    }
    if (directorPassword !== directorPasswordConfirmation) {
      setError(copy.passwordMismatchError);
      return;
    }

    setLoading(true);
    try {
      const { data: registration, error: registrationError } = await supabase.functions.invoke('register-director-request', {
        body: {
          nom: directorNom.trim(),
          prenom: directorPrenom.trim(),
          email: directorEmail.trim().toLowerCase(),
          password: directorPassword,
          telephone: directorPhone.trim(),
          nomCreche: directorCreche.trim(),
          adresse: directorAddress.trim(),
          siteWeb: directorWebsite.trim(),
          message: directorMessage.trim(),
        },
      });

      let serverError = registrationError?.message || '';
      if (registrationError) {
        const context = (registrationError as { context?: unknown }).context;
        if (context instanceof Response) {
          const details = await context.clone().json().catch(() => null) as { error?: string } | null;
          serverError = details?.error || serverError;
        }
      }
      if (serverError || registration?.error) {
        throw new Error(serverError || registration.error);
      }

      resetRequestForm();
      setSuccess(copy.requestSuccess);
    } catch (requestError) {
      console.error('Erreur envoi demande directeur:', requestError);
      const message = requestError instanceof Error ? requestError.message : '';
      if (message.toLowerCase().includes('already') || message.toLowerCase().includes('déjà') || message.toLowerCase().includes('existe')) {
        setError(copy.duplicateError);
      } else {
        setError(message || copy.requestError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setError(isFrench ? 'Veuillez remplir tous les champs.' : 'يرجى ملء جميع الحقول.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await loginWithCredentials(email, password);
      if (result.error || !result.user) {
        setError(formatAuthError(result.error, isFrench
          ? 'Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe.'
          : 'بيانات الدخول غير صحيحة.', isFrench));
      }
    } catch (loginError) {
      console.error('Erreur inattendue dans le formulaire de connexion:', loginError);
      setError(isFrench
        ? 'La connexion a échoué. Réessayez dans quelques instants.'
        : 'تعذر تسجيل الدخول. حاول مرة أخرى بعد لحظات.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir={isFrench ? 'ltr' : 'rtl'} className="min-h-[100dvh] w-full min-w-0 overflow-x-hidden bg-[#fcfdff] flex flex-col lg:flex-row font-sans">
      <div className={`absolute top-4 z-30 flex items-center gap-1 rounded-full bg-white/90 p-1 shadow-sm border border-slate-200 ${isFrench ? 'right-4' : 'left-4'}`}>
        <button type="button" onClick={() => setLanguage('fr')} className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${isFrench ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-indigo-700'}`}>Français</button>
        <button type="button" onClick={() => setLanguage('ar')} className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${!isFrench ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-indigo-700'}`}>العربية</button>
      </div>

      <aside className="hidden lg:flex lg:w-1/2 relative min-h-[390px] lg:min-h-[100dvh] overflow-hidden flex-col justify-between p-5 sm:p-8 lg:p-16 text-white select-none bg-[url('/login-nursery-hero-a.jpg')] bg-cover bg-center">
        {/* La photo donne le contexte "crèche" ; le voile protège lisibilité et identité Rawdha+. */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#d93e34]/[0.92] via-[#eb6138]/[0.82] to-[#f4a033]/[0.78]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#9e2f32]/45 via-transparent to-white/10" />
        <div className="absolute -top-12 -left-12 w-64 h-64 bg-white/15 rounded-full blur-2xl" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-amber-100/20 rounded-full blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <img
            src="/rawdah-logo.png"
            alt="Logo Rawdha+"
            className="h-14 w-14 rounded-2xl border border-white/35 shadow-lg"
          />
          <div>
            <h2 className="text-2xl font-bold tracking-wider font-display drop-shadow-sm">RAWDHA+</h2>
            <p className="hidden sm:block text-xs text-white/80 tracking-widest">{copy.brandSubtitle}</p>
          </div>
        </div>

        <div className="relative z-10 my-auto space-y-4 sm:space-y-6 max-w-md py-8 sm:py-12 lg:py-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 backdrop-blur-md text-xs font-semibold rounded-full border border-white/20">
            <BadgeCheck className="w-3.5 h-3.5 text-amber-200" />
            <span>{copy.badge}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-none font-display">
            {copy.heroTitle}
          </h1>
          <p className="text-white/90 text-sm sm:text-lg leading-relaxed">
            {copy.heroDescription}
          </p>
          <div className="hidden sm:grid gap-3 text-sm text-white/90">
            <div className="flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-white" /> {copy.security}</div>
            <div className="flex items-center gap-3"><Clock3 className="w-5 h-5 text-white" /> {copy.activation}</div>
            <div className="flex items-center gap-3"><MessageSquare className="w-5 h-5 text-white" /> {copy.whatsapp}</div>
          </div>
        </div>

        <div className="relative z-10 hidden sm:flex justify-between items-center border-t border-white/25 pt-5 lg:pt-6">
          <p className="text-sm text-white/70">{copy.footer}</p>
          <span className="text-xs font-mono text-white/70">v1.3.0</span>
        </div>
      </aside>

      <main className="lg:w-1/2 min-w-0 flex items-center justify-center bg-[#fcfdff] p-4 pt-24 sm:p-8 sm:pt-24 lg:p-16">
        <div className="w-full max-w-xl min-w-0 space-y-5 sm:space-y-7 animate-slide-up">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
              <Building className="w-4 h-4" />
              <span>{copy.space}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {view === 'signin' ? copy.signinTitle : copy.requestTitle}
            </h2>
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
              {view === 'signin' ? copy.signinDescription : copy.requestDescription}
            </p>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2.5 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p>{success}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm">
            <span className="text-slate-500">
              {view === 'signin' ? copy.noAccount : copy.hasAccount}
            </span>
            <a
              href={view === 'signin' ? '/signin/' : '/login/'}
              className="font-bold text-indigo-700 hover:text-indigo-900 underline underline-offset-2"
            >
              {view === 'signin' ? copy.requestLink : copy.loginLink}
            </a>
          </div>

          {view === 'signin' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{copy.email}</label>
                <div className="relative">
                  <Mail className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={iconInputClass} placeholder="direction@creche.dz" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{copy.password}</label>
                <div className="relative">
                  <Lock className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={iconInputClass} placeholder="••••••••" required />
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-800 leading-relaxed">
                <KeyRound className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{copy.loginNote}</span>
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-100 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn className="w-5 h-5" /><span>{copy.loginButton}</span></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{copy.firstName}</label>
                  <div className="relative">
                    <UserRound className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={directorPrenom} onChange={(event) => setDirectorPrenom(event.target.value)} className={iconInputClass} placeholder="Nadia" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{copy.lastName}</label>
                  <input value={directorNom} onChange={(event) => setDirectorNom(event.target.value)} className={inputClass} placeholder="Benaissa" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{copy.professionalEmail}</label>
                <div className="relative">
                  <Mail className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={directorEmail} onChange={(event) => setDirectorEmail(event.target.value)} className={iconInputClass} placeholder="direction@creche.dz" required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{copy.nurseryName}</label>
                  <div className="relative">
                    <Building className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={directorCreche} onChange={(event) => setDirectorCreche(event.target.value)} className={iconInputClass} placeholder="Les Petits Pas" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{copy.phone}</label>
                  <div className="relative">
                    <Phone className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="tel" value={directorPhone} onChange={(event) => setDirectorPhone(event.target.value)} className={iconInputClass} placeholder="+213 5 55 12 34 56" required inputMode="tel" autoComplete="tel" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{copy.address}</label>
                <div className="relative">
                  <MapPin className="absolute left-3 rtl:left-auto rtl:right-3 top-3.5 w-4 h-4 text-slate-400" />
                  <textarea value={directorAddress} onChange={(event) => setDirectorAddress(event.target.value)} rows={2} className={`${inputClass} pl-10 rtl:pl-4 rtl:pr-10 resize-none`} placeholder={copy.addressPlaceholder} required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{copy.password} *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="password" minLength={8} value={directorPassword} onChange={(event) => setDirectorPassword(event.target.value)} className={iconInputClass} placeholder={copy.passwordHint} required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{copy.confirmPassword}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="password" minLength={8} value={directorPasswordConfirmation} onChange={(event) => setDirectorPasswordConfirmation(event.target.value)} className={iconInputClass} placeholder={copy.repeatPassword} required />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{copy.website}</label>
                  <div className="relative">
                    <Globe2 className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="url" value={directorWebsite} onChange={(event) => setDirectorWebsite(event.target.value)} className={iconInputClass} placeholder="https://..." />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{copy.message}</label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={directorMessage} onChange={(event) => setDirectorMessage(event.target.value)} className={iconInputClass} placeholder={copy.needPlaceholder} />
                  </div>
                </div>
              </div>
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                {copy.requestNote}
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-100 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-5 h-5" /><span>{copy.requestButton}</span></>}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-slate-400 leading-relaxed">
            {copy.parentNote}
          </p>

          <div className="flex items-center justify-center gap-3 pt-1 text-xs font-semibold">
            <a href="/confidentialite" className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
              {isFrench ? 'Politique de confidentialité' : 'سياسة الخصوصية'}
            </a>
          </div>

          <section className="pt-1" aria-labelledby="mobile-stores-title">
            <div className="mb-3 text-center">
              <h3 id="mobile-stores-title" className="text-xs font-bold text-slate-600">{copy.storesHeading}</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{copy.storesDescription}</p>
            </div>
            <div className="grid grid-cols-2 gap-3" role="group" aria-label={copy.storesHeading}>
              <div aria-disabled="true" className="relative min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                <div className="pointer-events-none flex items-center gap-2.5 opacity-55 blur-[1px] select-none" aria-hidden="true">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-slate-700 shadow-sm"><Play className="h-4 w-4 fill-current" /></span>
                  <span className="min-w-0"><span className="block text-[9px] font-medium text-slate-500">Disponible sur</span><span className="block truncate text-xs font-extrabold text-slate-700">{copy.googlePlay}</span></span>
                </div>
                <span className="absolute right-2 top-2 rounded-full bg-white/95 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-indigo-600 shadow-sm rtl:right-auto rtl:left-2">{copy.availableSoon}</span>
              </div>
              <div aria-disabled="true" className="relative min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                <div className="pointer-events-none flex items-center gap-2.5 opacity-55 blur-[1px] select-none" aria-hidden="true">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-slate-700 shadow-sm"><Apple className="h-4 w-4 fill-current" /></span>
                  <span className="min-w-0"><span className="block text-[9px] font-medium text-slate-500">Télécharger dans l’</span><span className="block truncate text-xs font-extrabold text-slate-700">{copy.appStore}</span></span>
                </div>
                <span className="absolute right-2 top-2 rounded-full bg-white/95 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-indigo-600 shadow-sm rtl:right-auto rtl:left-2">{copy.availableSoon}</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
