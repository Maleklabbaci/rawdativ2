import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  AlertCircle,
  ArrowLeft,
  Baby,
  Building,
  Chrome,
  Globe2,
  MapPin,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Phone,
  Sparkles,
  UserRound,
} from 'lucide-react';

type AuthMethod = 'password' | 'email' | 'phone';

function formatAuthError(message: string | null, fallback: string): string {
  if (!message) return fallback;
  const normalized = message.toLowerCase();
  if (normalized.includes('provider is not enabled') || normalized.includes('unsupported provider')) return 'Cette méthode n’est pas encore activée dans Supabase Auth.';
  if (normalized.includes('invalid login credentials')) return 'Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe.';
  if (normalized.includes('already registered') || normalized.includes('user already registered')) return 'Cette adresse e-mail possède déjà un compte Rawdha+.';
  if (normalized.includes('password should be at least') || normalized.includes('password must')) return 'Le mot de passe doit respecter les exigences minimales de sécurité.';
  if (normalized.includes('email not confirmed')) return 'Votre adresse e-mail doit d’abord être confirmée.';
  if (normalized.includes('rate limit') || normalized.includes('too many')) return 'Trop de demandes. Patientez quelques instants avant de réessayer.';
  if (normalized.includes('user not found')) return 'Aucun compte Rawdha+ correspondant n’a été trouvé.';
  if (normalized.includes('profile rawdha')) return 'Votre authentification est valide, mais votre compte n’est pas encore rattaché à Rawdha+.';
  return message;
}

export default function SignIn() {
  const { isFrench } = useLanguage();
  const {
    loginWithCredentials,
    signInWithGoogle,
    requestEmailOtp,
    verifyEmailOtp,
    requestPhoneOtp,
    verifyPhoneOtp,
    createDirectorAccount,
  } = useAuth();

  const [view, setView] = useState<'signin' | 'signup'>('signin');
  const [method, setMethod] = useState<AuthMethod>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [directorNom, setDirectorNom] = useState('');
  const [directorPrenom, setDirectorPrenom] = useState('');
  const [directorEmail, setDirectorEmail] = useState('');
  const [directorPassword, setDirectorPassword] = useState('');
  const [directorPasswordConfirmation, setDirectorPasswordConfirmation] = useState('');
  const [directorCreche, setDirectorCreche] = useState('');
  const [directorPhone, setDirectorPhone] = useState('');
  const [directorAddress, setDirectorAddress] = useState('');
  const [directorWebsite, setDirectorWebsite] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const changeMethod = (nextMethod: AuthMethod) => {
    setMethod(nextMethod);
    setOtpSent(false);
    setOtp('');
    setError('');
    setSuccess('');
  };

  const handleCreateDirector = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!directorNom || !directorPrenom || !directorEmail || !directorPassword || !directorCreche || !directorPhone || !directorAddress) {
      setError('Veuillez remplir tous les champs obligatoires du directeur et de la crèche.');
      return;
    }
    if (directorPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (directorPassword !== directorPasswordConfirmation) {
      setError('La confirmation du mot de passe ne correspond pas.');
      return;
    }

    setLoading(true);
    const result = await createDirectorAccount({
      nom: directorNom,
      prenom: directorPrenom,
      email: directorEmail,
      motDePasse: directorPassword,
      nomCreche: directorCreche,
      telephone: directorPhone,
      adresse: directorAddress,
      siteWeb: directorWebsite,
    });

    if (result.error) {
      setError(formatAuthError(result.error, 'Impossible de créer le compte directeur.'));
    } else if (result.requiresEmailConfirmation) {
      setView('signin');
      setMethod('password');
      setEmail(directorEmail.trim().toLowerCase());
      setPassword('');
      setSuccess('Compte créé. Consultez votre e-mail pour confirmer l’adresse avant de vous connecter.');
    } else {
      setSuccess('Compte directeur créé avec succès. Votre espace Rawdha+ est prêt.');
    }
    setLoading(false);
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setError(isFrench ? 'Veuillez remplir tous les champs.' : 'يرجى ملء جميع الحقول.');
      return;
    }
    setLoading(true);
    setError('');
    const matched = await loginWithCredentials(email, password);
    if (!matched) {
      setError(formatAuthError(null, isFrench
        ? 'Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe.'
        : 'بيانات الاعتماد غير صحيحة.'));
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const result = await signInWithGoogle();
    if (result.error) {
      setError(formatAuthError(result.error, 'La connexion avec Google n’a pas pu être lancée.'));
      setLoading(false);
    }
  };

  const handleRequestOtp = async (event: FormEvent) => {
    event.preventDefault();
    const value = method === 'email' ? email.trim() : phone.trim();
    if (!value) {
      setError(method === 'email' ? 'Saisissez votre adresse e-mail.' : 'Saisissez votre numéro de téléphone.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    const result = method === 'email'
      ? await requestEmailOtp(value)
      : await requestPhoneOtp(value);

    if (result.error) {
      setError(formatAuthError(result.error, 'Impossible d’envoyer le code de connexion.'));
    } else {
      setOtpSent(true);
      setSuccess(method === 'email'
        ? 'Un lien ou un code de connexion vient d’être envoyé à votre adresse e-mail.'
        : 'Un code de connexion à 6 chiffres vient d’être envoyé par SMS.');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Saisissez le code à 6 chiffres reçu.');
      return;
    }

    setLoading(true);
    setError('');
    const result = method === 'email'
      ? await verifyEmailOtp(email, otp)
      : await verifyPhoneOtp(phone, otp);
    if (result.error) {
      setError(formatAuthError(result.error, 'Le code est invalide ou expiré.'));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#fcfdff] flex flex-col lg:flex-row font-sans">
      <div className="lg:w-1/2 bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-500 relative overflow-hidden flex flex-col justify-between p-8 lg:p-16 text-white select-none">
        <div className="absolute -top-12 -left-12 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-white/15 rounded-full blur-3xl animate-pulse" />

        <div className="relative flex items-center gap-3">
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-inner">
            <Baby className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-wider font-display drop-shadow-sm">RAWDHA+</h2>
            <p className="text-xs text-white/80 uppercase tracking-widest">Premium Nursery Platform</p>
          </div>
        </div>

        <div className="relative my-auto space-y-4 max-w-md">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 backdrop-blur-md text-xs font-semibold rounded-full border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Gestion de Crèche de nouvelle génération</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-none font-display">
            L'excellence dans la gestion de votre crèche.
          </h1>
          <p className="text-white/90 text-lg leading-relaxed">
            Suivi en temps réel des présences, des activités, des repas et de la facturation avec une fluidité exceptionnelle.
          </p>
        </div>

        <div className="relative flex justify-between items-center border-t border-white/20 pt-6">
          <p className="text-sm text-white/70">© 2026 RAWDHA+. Tous droits réservés.</p>
          <div className="flex gap-4 text-xs font-mono">
            <span>v1.2.0</span>
            <span>Propulsé par iVISION</span>
          </div>
        </div>
      </div>

      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md space-y-7 animate-slide-up">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
              <Building className="w-4 h-4" />
              <span>ESPACE DIRECTEUR ET GESTION</span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {view === 'signin' ? 'Connectez-vous' : 'Créer votre espace directeur'}
            </h2>
            <p className="text-slate-500">
              {view === 'signin'
                ? 'Accédez à votre espace Rawdha+ avec votre méthode de connexion habituelle.'
                : 'Renseignez les informations de votre crèche. Votre accès de direction sera enregistré dans Rawdha+.'}
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
              <KeyRound className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p>{success}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button type="button" onClick={() => { setView('signin'); setError(''); setSuccess(''); }} className={`py-2.5 rounded-lg text-xs font-bold transition ${view === 'signin' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Se connecter
            </button>
            <button type="button" onClick={() => { setView('signup'); setError(''); setSuccess(''); }} className={`py-2.5 rounded-lg text-xs font-bold transition ${view === 'signup' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Inscription directeur
            </button>
          </div>

          {view === 'signin' ? (
            <>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:border-indigo-300 hover:shadow-md transition flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Chrome className="w-5 h-5 text-[#4285F4]" />
            <span>Continuer avec Google</span>
          </button>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px bg-slate-200 flex-1" />
            <span>ou avec vos identifiants</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
            <button type="button" onClick={() => changeMethod('password')} className={`py-2.5 rounded-lg text-xs font-bold transition ${method === 'password' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Mot de passe
            </button>
            <button type="button" onClick={() => changeMethod('email')} className={`py-2.5 rounded-lg text-xs font-bold transition ${method === 'email' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Code e-mail
            </button>
            <button type="button" onClick={() => changeMethod('phone')} className={`py-2.5 rounded-lg text-xs font-bold transition ${method === 'phone' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              SMS
            </button>
          </div>

          {method === 'password' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Adresse e-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-slate-800" placeholder="exemple@rawdha.dz" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-slate-800" placeholder="••••••••" required />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-100 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn className="w-5 h-5" /><span>Se connecter à RAWDHA+</span></>}
              </button>
            </form>
          )}

          {method !== 'password' && !otpSent && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  {method === 'email' ? 'Adresse e-mail' : 'Numéro de téléphone'}
                </label>
                <div className="relative">
                  {method === 'email' ? <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /> : <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />}
                  <input
                    type={method === 'email' ? 'email' : 'tel'}
                    value={method === 'email' ? email : phone}
                    onChange={(event) => method === 'email' ? setEmail(event.target.value) : setPhone(event.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-slate-800"
                    placeholder={method === 'email' ? 'direction@rawdha.dz' : '+213 5 55 55 55 55'}
                    required
                  />
                </div>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                {method === 'email' ? 'Un lien magique ou un code à usage unique sera envoyé. Aucun mot de passe n’est nécessaire.' : 'Utilisez le format international, par exemple +213 5 55 55 55 55.'}
              </p>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-100 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><KeyRound className="w-5 h-5" /><span>Recevoir le code</span></>}
              </button>
            </form>
          )}

          {method !== 'password' && otpSent && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Code de vérification</label>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full text-center tracking-[0.5em] text-2xl py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-bold text-slate-800" placeholder="000000" required />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-100 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn className="w-5 h-5" /><span>Valider la connexion</span></>}
              </button>
              <button type="button" onClick={() => { setOtpSent(false); setOtp(''); setSuccess(''); }} className="w-full py-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Modifier les coordonnées
              </button>
            </form>
          )}
            </>
          ) : (
            <form onSubmit={handleCreateDirector} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Prénom *</label>
                  <div className="relative">
                    <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={directorPrenom} onChange={(event) => setDirectorPrenom(event.target.value)} className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 text-slate-800" placeholder="Nadia" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Nom *</label>
                  <input value={directorNom} onChange={(event) => setDirectorNom(event.target.value)} className="w-full px-3 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 text-slate-800" placeholder="Benaissa" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">E-mail professionnel *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={directorEmail} onChange={(event) => setDirectorEmail(event.target.value)} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 text-slate-800" placeholder="direction@creche.dz" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Mot de passe *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="password" minLength={8} value={directorPassword} onChange={(event) => setDirectorPassword(event.target.value)} className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 text-slate-800" placeholder="8 caractères minimum" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Confirmation *</label>
                  <input type="password" minLength={8} value={directorPasswordConfirmation} onChange={(event) => setDirectorPasswordConfirmation(event.target.value)} className="w-full px-3 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 text-slate-800" placeholder="Répéter" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Nom de la crèche *</label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={directorCreche} onChange={(event) => setDirectorCreche(event.target.value)} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 text-slate-800" placeholder="Crèche Les Petits Pas" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Téléphone *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="tel" value={directorPhone} onChange={(event) => setDirectorPhone(event.target.value)} className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 text-slate-800" placeholder="+213..." required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Site web</label>
                  <div className="relative">
                    <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="url" value={directorWebsite} onChange={(event) => setDirectorWebsite(event.target.value)} className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 text-slate-800" placeholder="https://..." />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Adresse de la crèche *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                  <textarea value={directorAddress} onChange={(event) => setDirectorAddress(event.target.value)} rows={2} className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 text-slate-800 resize-none" placeholder="Adresse complète" required />
                </div>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">Après l’inscription, le compte directeur et les informations de la crèche seront enregistrés dans Supabase. Aucun espace parent n’est créé dans cette version.</p>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-100 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserRound className="w-5 h-5" /><span>Créer mon accès directeur</span></>}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-slate-400 leading-relaxed">
            L’espace parent sera ajouté séparément dans une prochaine version de Rawdha+.
          </p>
        </div>
      </div>
    </div>
  );
}
