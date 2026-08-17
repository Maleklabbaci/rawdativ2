import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import {
  AlertCircle,
  Baby,
  Building,
  CheckCircle2,
  Clock3,
  Globe2,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
  BadgeCheck,
  UserRound,
} from 'lucide-react';

function formatAuthError(message: string | null, fallback: string): string {
  if (!message || message === '{}' || message === '[object Object]') return fallback;
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe.';
  if (normalized.includes('email not confirmed')) return 'Votre accès n’est pas encore activé par l’administrateur.';
  if (normalized.includes('too many') || normalized.includes('rate limit')) return 'Trop de demandes. Patientez quelques instants avant de réessayer.';
  if (normalized.includes('user not found')) return 'Aucun compte Rawdha+ correspondant n’a été trouvé.';
  if (normalized.includes('profile rawdha')) return 'Votre authentification est valide, mais votre compte n’est pas encore rattaché à Rawdha+.';
  return message;
}

const inputClass = 'w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-base sm:text-sm text-slate-800 bg-white';
const iconInputClass = `${inputClass} pl-10`;

export default function SignIn({ mode = 'signin' }: { mode?: 'signin' | 'request' }) {
  const { isFrench } = useLanguage();
  const { loginWithCredentials } = useAuth();
  const view = mode;
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
      setError('Veuillez remplir tous les champs obligatoires, y compris le mot de passe.');
      return;
    }
    if (directorPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (directorPassword !== directorPasswordConfirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
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
      setSuccess('Votre demande a bien été envoyée. Après acceptation, ouvrez /signin/ pour vous connecter avec le mot de passe que vous venez de définir.');
    } catch (requestError) {
      console.error('Erreur envoi demande directeur:', requestError);
      const message = requestError instanceof Error ? requestError.message : '';
      if (message.toLowerCase().includes('already') || message.toLowerCase().includes('déjà') || message.toLowerCase().includes('existe')) {
        setError('Cette adresse e-mail possède déjà une demande ou un compte Rawdha+.');
      } else {
        setError(message || 'Impossible d’envoyer la demande pour le moment. Réessayez dans quelques instants.');
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
          : 'بيانات الاعتماد غير صحيحة.'));
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
    <div dir="ltr" className="min-h-[100dvh] w-full min-w-0 overflow-x-hidden bg-[#fcfdff] flex flex-col lg:flex-row font-sans">
      <div className="lg:w-[46%] bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-600 relative overflow-hidden flex flex-col justify-between p-5 sm:p-8 lg:p-16 text-white select-none">
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

        <div className="relative my-auto space-y-4 sm:space-y-6 max-w-md py-8 sm:py-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 backdrop-blur-md text-xs font-semibold rounded-full border border-white/20">
            <BadgeCheck className="w-3.5 h-3.5 text-amber-200" />
            <span>Gestion de crèche de nouvelle génération</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-none font-display">
            L’excellence dans la gestion de votre crèche.
          </h1>
          <p className="text-white/90 text-sm sm:text-lg leading-relaxed">
            Présences, enfants, équipe, activités, repas et facturation réunis dans un espace clair et sécurisé.
          </p>
          <div className="grid gap-3 text-sm text-white/90">
            <div className="flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-white" /> Accès validé par l’équipe Rawdha+</div>
            <div className="flex items-center gap-3"><Clock3 className="w-5 h-5 text-white" /> Activation rapide après examen de la demande</div>
            <div className="flex items-center gap-3"><MessageSquare className="w-5 h-5 text-white" /> Confirmation directe par WhatsApp</div>
          </div>
        </div>

        <div className="relative flex justify-between items-center border-t border-white/20 pt-6">
          <p className="text-sm text-white/70">© 2026 RAWDHA+. Tous droits réservés.</p>
          <span className="text-xs font-mono text-white/70">v1.3.0</span>
        </div>
      </div>

      <div className="lg:w-[54%] min-w-0 flex items-center justify-center p-4 sm:p-8 lg:p-16">
        <div className="w-full max-w-xl min-w-0 space-y-5 sm:space-y-7 animate-slide-up">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
              <Building className="w-4 h-4" />
              <span>ESPACE DIRECTEUR ET GESTION</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {view === 'signin' ? 'Connectez-vous' : 'Demander un accès Rawdha+'}
            </h2>
            <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
              {view === 'signin'
                ? 'Utilisez l’adresse e-mail et le mot de passe choisis lors de votre inscription.'
                : 'Créez vos identifiants dès maintenant. L’administrateur ne fera ensuite que valider ou refuser votre demande.'}
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
              {view === 'signin' ? 'Pas encore de compte ?' : 'Vous avez déjà un compte ?'}
            </span>
            <a
              href={view === 'signin' ? '/login/' : '/signin/'}
              className="font-bold text-indigo-700 hover:text-indigo-900 underline underline-offset-2"
            >
              {view === 'signin' ? 'Demander un accès' : 'Se connecter'}
            </a>
          </div>

          {view === 'signin' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Adresse e-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={iconInputClass} placeholder="direction@creche.dz" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={iconInputClass} placeholder="••••••••" required />
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-800 leading-relaxed">
                <KeyRound className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Après validation par l’administrateur, votre compte sera activé directement avec le mot de passe choisi à l’inscription.</span>
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-100 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn className="w-5 h-5" /><span>Se connecter à RAWDHA+</span></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Prénom *</label>
                  <div className="relative">
                    <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={directorPrenom} onChange={(event) => setDirectorPrenom(event.target.value)} className={iconInputClass} placeholder="Nadia" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Nom *</label>
                  <input value={directorNom} onChange={(event) => setDirectorNom(event.target.value)} className={inputClass} placeholder="Benaissa" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">E-mail professionnel *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={directorEmail} onChange={(event) => setDirectorEmail(event.target.value)} className={iconInputClass} placeholder="direction@creche.dz" required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Nom de la crèche *</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={directorCreche} onChange={(event) => setDirectorCreche(event.target.value)} className={iconInputClass} placeholder="Les Petits Pas" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Téléphone *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="tel" value={directorPhone} onChange={(event) => setDirectorPhone(event.target.value)} className={iconInputClass} placeholder="+213..." required />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Adresse de la crèche *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                  <textarea value={directorAddress} onChange={(event) => setDirectorAddress(event.target.value)} rows={2} className={`${inputClass} pl-10 resize-none`} placeholder="Adresse complète" required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Mot de passe *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="password" minLength={8} value={directorPassword} onChange={(event) => setDirectorPassword(event.target.value)} className={iconInputClass} placeholder="8 caractères minimum" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Confirmer le mot de passe *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="password" minLength={8} value={directorPasswordConfirmation} onChange={(event) => setDirectorPasswordConfirmation(event.target.value)} className={iconInputClass} placeholder="Répétez le mot de passe" required />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Site web</label>
                  <div className="relative">
                    <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="url" value={directorWebsite} onChange={(event) => setDirectorWebsite(event.target.value)} className={iconInputClass} placeholder="https://..." />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Message</label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={directorMessage} onChange={(event) => setDirectorMessage(event.target.value)} className={iconInputClass} placeholder="Votre besoin" />
                  </div>
                </div>
              </div>
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                Votre mot de passe est géré de façon sécurisée par Supabase et n’est jamais envoyé à l’administrateur. Après acceptation, vous pourrez vous connecter immédiatement avec vos identifiants.
              </div>
              <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-100 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-5 h-5" /><span>Envoyer ma demande</span></>}
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
