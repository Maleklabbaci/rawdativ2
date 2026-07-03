import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Baby, LogIn, Sparkles, Building, Lock, Mail, AlertCircle } from 'lucide-react';

export default function SignIn() {
  const { isFrench } = useLanguage();
  const { loginWithCredentials } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError(isFrench ? 'Veuillez remplir tous les champs.' : 'يرجى ملء جميع الحقول.');
      return;
    }
    setLoading(true);
    setError('');

    const matched = await loginWithCredentials(email, password);

    if (!matched) {
      setError(
        isFrench
          ? 'Identifiants incorrects. Veuillez vérifier votre adresse e-mail et votre mot de passe.'
          : 'بيانات الاعتماد غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.'
      );
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#fcfdff] flex flex-col lg:flex-row font-sans">
      {/* Visual illustration side (Warm & playful, ultra professional) */}
      <div className="lg:w-1/2 bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-500 relative overflow-hidden flex flex-col justify-between p-8 lg:p-16 text-white select-none">
        {/* Background decorative blobs */}
        <div className="absolute -top-12 -left-12 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-white/15 rounded-full blur-3xl animate-pulse" />
        
        {/* Header logo marker */}
        <div className="relative flex items-center gap-3">
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-inner">
            <Baby className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-wider font-display drop-shadow-sm">RAWDATI</h2>
            <p className="text-xs text-white/80 uppercase tracking-widest">Premium Nursery Platform</p>
          </div>
        </div>

        {/* Catchy welcome statement */}
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

        {/* Footer info and stats */}
        <div className="relative flex justify-between items-center border-t border-white/20 pt-6">
          <p className="text-sm text-white/70">© 2026 RAWDATI. Tous droits réservés.</p>
          <div className="flex gap-4 text-xs font-mono">
            <span>v1.2.0</span>
            <span>Propulsé par iVISION</span>
          </div>
        </div>
      </div>

      {/* Form login side */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md space-y-8 animate-slide-up">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
              <Building className="w-4 h-4" />
              <span>ESPACE DE GESTION</span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Connectez-vous</h2>
            <p className="text-slate-500">
              Saisissez vos identifiants pour accéder au portail d'administration de RAWDATI.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2.5 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Adresse Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-slate-800"
                  placeholder="exemple@rawdati.com"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Mot de passe
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-slate-800"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-100 transition duration-250 flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Se connecter à RAWDATI</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
