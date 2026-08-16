import React, { useState } from 'react';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { setCollectionDocument } from '../supabase';
import type { DemandeDirecteur } from '../types';
import { 
  Users, 
  UserPlus, 
  Search, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Shield, 
  ShieldAlert,
  User, 
  Sparkles, 
  ChevronRight, 
  AlertCircle,
  Plus,
  Mail,
  Lock,
  Baby,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Building,
  Clock,
  UserCheck,
  UserX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function formatLastActivity(value: string | undefined, language: 'fr' | 'ar'): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-DZ' : 'ar-DZ', {
    timeZone: 'Africa/Algiers',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export default function Comptes() {
  const { comptes, enfants, demandesDirecteur, addCompte, updateCompte, deleteCompte, approveDemandeDirecteur, deleteDemandeDirecteur, refreshAll, loading } = useDb();
  const { language, isFrench } = useLanguage();
  const { user: currentUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // ✅ Essai gratuit de 15 jours par défaut (le blocage auto existe déjà dans App.tsx :
  // dès que "dateFinAbonnement" est dépassée, le compte est bloqué automatiquement).
  const getDefaultDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  };

  // Form fields
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [nomCreche, setNomCreche] = useState('');
  const [telephoneCreche, setTelephoneCreche] = useState('');
  const [adresseCreche, setAdresseCreche] = useState('');
  const [tarifCreche, setTarifCreche] = useState('3500');
  const [siteWebCreche, setSiteWebCreche] = useState('');
  const [dateFinAbonnement, setDateFinAbonnement] = useState(getDefaultDate());
  const [abonnementActif, setAbonnementActif] = useState(true);
  const [enfantId, setEnfantId] = useState('');
  
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [selectedDemande, setSelectedDemande] = useState<DemandeDirecteur | null>(null);
  const [decisionError, setDecisionError] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);

  // Check user role
  const isAdmin = currentUser?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl shadow-sm text-slate-500 max-w-lg mx-auto mt-10">
        <ShieldAlert className="w-14 h-14 text-rose-500 mx-auto mb-4" />
        <h3 className="font-extrabold text-slate-900 text-xl">
          {isFrench ? 'Accès non autorisé' : 'غير مسموح بالدخول'}
        </h3>
        <p className="text-sm mt-2 text-slate-400 leading-relaxed">
          {isFrench 
            ? 'Seul l’administrateur de la plateforme Rawdha+ peut accéder à la gestion des comptes directeurs.' 
            : 'يُسمح فقط لمدير المنصة الشاملة بالولوج وإدارة حسابات واشتراكات مدراء الروضات.'}
        </p>
      </div>
    );
  }

  // Filter accounts based on logged-in user role and search query
  const filteredComptes = comptes.filter(c => {
    const term = searchTerm.toLowerCase();
    
    // Platform Super Admin only manages accounts that are directors or admin
    if (c.role !== 'directeur' && c.role !== 'admin') return false;

    // 2. Keyword search
    return (
      c.nom.toLowerCase().includes(term) ||
      c.prenom.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      (c.nomCreche && c.nomCreche.toLowerCase().includes(term))
    );
  });

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!nom || !prenom || !email || !motDePasse) {
      setFormError(isFrench ? 'Veuillez remplir tous les champs requis.' : 'يرجى ملء جميع الحقول المطلوبة.');
      return;
    }

    if (isAdmin && !nomCreche) {
      setFormError(isFrench ? 'Veuillez renseigner le nom de la crèche.' : 'يرجى إدخال اسم الروضة.');
      return;
    }

    // Check if email already exists
    const exists = comptes.some(c => c.email.toLowerCase() === email.toLowerCase().trim());
    if (exists) {
      setFormError(isFrench ? 'Cette adresse e-mail est déjà utilisée.' : 'البريد الإلكتروني مستخدم بالفعل.');
      return;
    }

    try {
      setSubmitLoading(true);
      
      const roleToSave = isAdmin ? 'directeur' : 'parent';

      const nouveauId = await addCompte({
        nom,
        prenom,
        email: email.trim().toLowerCase(),
        motDePasse,
        role: roleToSave,
        abonnementActif,
        ...(roleToSave === 'directeur' ? { nomCreche, dateFinAbonnement } : {}),
        ...(roleToSave === 'parent' && enfantId ? { enfantId } : {})
      });

      // ✅ Si admin a rempli les infos crèche (tel/adresse/tarif/site web), on les
      // enregistre tout de suite -> le directeur n'aura pas besoin de repasser par
      // l'onboarding (le doc "parametres/creche_{id}" existera déjà à son 1er login).
      if (roleToSave === 'directeur' && nouveauId) {
        await setCollectionDocument('parametres', `creche_${nouveauId}`, {
          id: `creche_${nouveauId}`,
          crecheName: nomCreche,
          principalEmail: email.trim().toLowerCase(),
          phoneNumbers: telephoneCreche,
          addressLine: adresseCreche,
          tuitionFeeRate: tarifCreche,
          siteWeb: siteWebCreche,
          logoUrl: '',
        });
      }

      setFormSuccess(isFrench ? 'Compte créé avec succès!' : 'تم إنشاء الحساب بنجاح!');
      
      // Reset form
      setNom('');
      setPrenom('');
      setEmail('');
      setMotDePasse('');
      setNomCreche('');
      setTelephoneCreche('');
      setAdresseCreche('');
      setTarifCreche('3500');
      setSiteWebCreche('');
      setDateFinAbonnement(getDefaultDate());
      setAbonnementActif(true);
      setEnfantId('');
      
      // Close form delay
      setTimeout(() => {
        setShowAddForm(false);
        setFormSuccess('');
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || 'Une erreur est survenue.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const pendingDemandes = demandesDirecteur.filter(demande => demande.statut === 'en_attente').sort((a, b) => new Date(b.dateDemande).getTime() - new Date(a.dateDemande).getTime());

  const handleAcceptDemande = async (demande: DemandeDirecteur) => {
    setDecisionError('');
    if (comptes.some(compte => compte.email.toLowerCase() === demande.email.toLowerCase())) {
      setDecisionError('Cette adresse e-mail possède déjà un compte Rawdha+.');
      return;
    }

    try {
      setDecisionLoading(true);
      await approveDemandeDirecteur(demande.id);
      setSelectedDemande(null);
      await refreshAll();
    } catch (err) {
      console.error('Erreur acceptation demande directeur:', err);
      setDecisionError(err instanceof Error ? err.message : 'Impossible d’accepter cette demande.');
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleRefuseDemande = async (demande: DemandeDirecteur) => {
    const confirmationText = isFrench
      ? `Refuser la demande de ${demande.prenom} ${demande.nom} et la supprimer définitivement de Rawdha+ et de la base de données ?`
      : `هل تريد رفض طلب ${demande.prenom} ${demande.nom} وحذفه نهائياً من Rawdha+ وقاعدة البيانات؟`;
    if (!window.confirm(confirmationText)) return;

    try {
      setDecisionLoading(true);
      await deleteDemandeDirecteur(demande.id);
      setSelectedDemande(null);
      await refreshAll();
    } catch (err) {
      console.error('Erreur suppression demande directeur:', err);
      setDecisionError(err instanceof Error ? err.message : 'Impossible de supprimer cette demande.');
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleToggleSubscription = async (id: string, currentStatus: boolean) => {
    try {
      await updateCompte(id, { abonnementActif: !currentStatus });
    } catch (err) {
      console.error('Error updating subscription status:', err);
      alert((isFrench ? 'Échec de la mise à jour : ' : 'فشل التحديث: ') + (err instanceof Error ? err.message : String(err)));
      await refreshAll(); // ré-affiche l'état réel de la base (annule la mise à jour optimiste ratée)
    }
  };

  const handleUpdateEndDate = async (id: string, dateValue: string) => {
    try {
      await updateCompte(id, { dateFinAbonnement: dateValue });
    } catch (err) {
      console.error('Error updating subscription end date:', err);
      alert((isFrench ? 'Échec de la mise à jour : ' : 'فشل التحديث: ') + (err instanceof Error ? err.message : String(err)));
      await refreshAll();
    }
  };

  const handleDeleteCompte = async (id: string, name: string) => {
    const confirmationText = isFrench
      ? `Êtes-vous sûr de vouloir supprimer le compte de ${name} ?`
      : `هل أنت متأكد من حذف حساب ${name}؟`;
      
    if (window.confirm(confirmationText)) {
      try {
        await deleteCompte(id);
      } catch (err) {
        console.error('Error deleting account:', err);
        // ✅ FIX: on affiche l'erreur au lieu de l'avaler en silence — sinon l'admin
        // croit que la suppression a marché alors qu'elle a échoué côté serveur.
        alert(
          (isFrench ? 'Échec de la suppression : ' : 'فشل الحذف: ') +
          (err instanceof Error ? err.message : String(err))
        );
      }
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Upper header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-8 h-8 text-indigo-600" />
            <span>
              {isAdmin 
                ? (isFrench ? 'Abonnés & Directeurs de Crèches' : 'المشتركون ومدراء الروضات')
                : (isFrench ? 'Gestion des comptes parents' : 'تسيير حسابات الأولياء')
              }
            </span>
          </h1>
          <p className="text-slate-500 mt-1">
            {isAdmin 
              ? (isFrench 
                  ? 'Gérez la liste de vos directeurs de crèches affiliés et déterminez dynamiquement la date d\'expiration de leur programme.' 
                  : 'أدر قائمة مدراء الروضات والمدارس الشريكة وحدد تواريخ انتهاء اشتراكاتهم وتفعيل حساباتهم.')
              : (isFrench 
                  ? 'Créez les identifiants d\'accès pour les parents et liez-les à leurs enfants.' 
                  : 'أنشئ حسابات الدخول للأولياء المتابعين لأطفالهم داخل الحضانة.')
            }
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshAll()}
            className="p-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:text-slate-950 transition flex items-center gap-2 text-sm font-bold shadow-sm cursor-pointer disabled:opacity-50"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{isFrench ? 'Actualiser' : 'تحديث'}</span>
          </button>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-100 transition duration-200 flex items-center gap-2 text-sm font-bold shadow-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>
              {isAdmin 
                ? (isFrench ? 'Ajouter un Directeur' : 'إضافة مدير روضة')
                : (isFrench ? 'Ajouter un Parent' : 'إضافة حساب لولي أمر')
              }
            </span>
          </button>
        </div>
      </div>

      <section className="bg-white border border-indigo-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-50 via-white to-violet-50 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm"><UserCheck className="w-5 h-5" /></div>
            <div>
              <h2 className="font-black text-slate-900 text-lg">Demandes de directeurs</h2>
              <p className="text-sm text-slate-500">Examinez les informations puis acceptez ou refusez la demande.</p>
            </div>
          </div>
          <span className="inline-flex items-center justify-center min-w-9 px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-sm font-black">{pendingDemandes.length} en attente</span>
        </div>
        {pendingDemandes.length === 0 ? (
          <div className="px-6 py-10 text-center text-slate-400">
            <Clock className="w-9 h-9 mx-auto mb-2 text-slate-300" />
            <p className="font-bold text-slate-600">Aucune demande en attente</p>
            <p className="text-sm mt-1">Les nouvelles demandes publiques apparaîtront ici automatiquement.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingDemandes.map((demande) => (
              <div key={demande.id} className="p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 hover:bg-slate-50/70 transition">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-slate-900">{demande.prenom} {demande.nom}</h3>
                    <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider">À examiner</span>
                  </div>
                  <div className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600">
                    <span><strong className="text-slate-800">Crèche :</strong> {demande.nomCreche}</span>
                    <span><strong className="text-slate-800">Téléphone :</strong> {demande.telephone}</span>
                    <span><strong className="text-slate-800">E-mail :</strong> {demande.email}</span>
                    <span><strong className="text-slate-800">Reçue le :</strong> {new Date(demande.dateDemande).toLocaleString('fr-FR')}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 truncate max-w-3xl"><strong className="text-slate-700">Adresse :</strong> {demande.adresse}{demande.siteWeb ? ` · ${demande.siteWeb}` : ''}</p>
                  {demande.message && <p className="text-xs text-indigo-700 mt-2 italic">“{demande.message}”</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button type="button" onClick={() => { setSelectedDemande(demande); setDecisionError(''); }} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-extrabold hover:bg-indigo-700 transition">
                    <UserCheck className="w-4 h-4" /> Accepter
                  </button>
                  <button type="button" onClick={() => handleRefuseDemande(demande)} disabled={decisionLoading} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-rose-200 text-rose-700 text-sm font-extrabold hover:bg-rose-50 transition disabled:opacity-50">
                    <UserX className="w-4 h-4" /> Refuser et supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {selectedDemande && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/40 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4">
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl space-y-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest font-black text-indigo-600">Validation admin</p>
                  <h3 className="mt-1 break-words text-lg font-black text-slate-900 sm:text-xl">Activer {selectedDemande.prenom} {selectedDemande.nom}</h3>
                  <p className="text-sm text-slate-500 mt-1">{selectedDemande.nomCreche} · {selectedDemande.email}</p>
                </div>
                <button type="button" onClick={() => setSelectedDemande(null)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"><XCircle className="w-5 h-5" /></button>
              </div>
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-sm text-indigo-900 leading-relaxed">
                Le directeur a déjà choisi son mot de passe lors de l’inscription. En acceptant, vous activez immédiatement son compte Rawdha+ ; aucun mot de passe ne vous est demandé ni transmis.
              </div>
              {decisionError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{decisionError}</div>}
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button type="button" onClick={() => handleRefuseDemande(selectedDemande)} disabled={decisionLoading} className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-rose-200 text-rose-700 font-extrabold hover:bg-rose-50 transition disabled:opacity-50"><UserX className="w-4 h-4" /> Refuser et supprimer la demande</button>
                <button type="button" onClick={() => handleAcceptDemande(selectedDemande)} disabled={decisionLoading} className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white font-extrabold hover:bg-indigo-700 transition disabled:opacity-50">{decisionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />} Accepter et activer</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add New Account Form drawer */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleCreateAccount} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-600" />
                  <span>
                    {isAdmin
                      ? (isFrench ? 'Nouveau Directeur de Crèche' : 'مدير روضة جديد')
                      : (isFrench ? 'Nouveau Parent d\'élève' : 'حساب ولي أمر جديد')
                    }
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase cursor-pointer"
                >
                  {isFrench ? 'Fermer' : 'إغلاق'}
                </button>
              </div>

              {formError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 flex-shrink-0" />
                  <p>{formError}</p>
                </div>
              )}

              {formSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-start gap-2.5 animate-pulse">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <p>{formSuccess}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Prenom */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {isFrench ? 'Prénom *' : 'الاسم الأول *'}
                  </label>
                  <input
                    type="text"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition font-medium text-slate-800"
                    placeholder={isFrench ? 'ex: Amira' : 'مثال: أميرة'}
                    required
                  />
                </div>

                {/* Nom */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {isFrench ? 'Nom *' : 'اللقب *'}
                  </label>
                  <input
                    type="text"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition font-medium text-slate-800"
                    placeholder={isFrench ? 'ex: Khellaf' : 'مثال: خلاف'}
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {isFrench ? 'Adresse Email *' : 'البريد الإلكتروني *'}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition font-medium text-slate-800"
                      placeholder="ex: directeur@rawdha.com"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {isFrench ? 'Mot de passe *' : 'كلمة المرور *'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={motDePasse}
                      onChange={(e) => setMotDePasse(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition font-medium text-slate-800"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                {/* CONDITIONAL FIELD FOR ADMINS (Creche Info) */}
                {isAdmin && (
                  <>
                    {/* Nom Creche */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        {isFrench ? 'Nom de la Crèche *' : 'اسم الروضة والمؤسسة *'}
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={nomCreche}
                          onChange={(e) => setNomCreche(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition font-medium text-slate-800"
                          placeholder={isFrench ? 'ex: Crèche Florale' : 'مثال: روضة الأزهار'}
                          required
                        />
                      </div>
                    </div>

                    {/* ✅ Infos crèche optionnelles — si remplies ici, le directeur n'aura
                        pas besoin de repasser par l'écran d'onboarding à son 1er login. */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                          {isFrench ? 'Téléphone crèche' : 'هاتف الحضانة'}
                        </label>
                        <input
                          type="text"
                          value={telephoneCreche}
                          onChange={(e) => setTelephoneCreche(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition text-sm"
                          placeholder="+213 ..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                          {isFrench ? 'Tarif mensuel (DA)' : 'الرسوم الشهرية'}
                        </label>
                        <input
                          type="number"
                          value={tarifCreche}
                          onChange={(e) => setTarifCreche(e.target.value)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        {isFrench ? 'Adresse crèche' : 'عنوان الحضانة'}
                      </label>
                      <input
                        type="text"
                        value={adresseCreche}
                        onChange={(e) => setAdresseCreche(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        {isFrench ? 'Site web (si dispo)' : 'الموقع الإلكتروني'}
                      </label>
                      <input
                        type="text"
                        value={siteWebCreche}
                        onChange={(e) => setSiteWebCreche(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition text-sm"
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        {isFrench ? 'Fin de la période (essai gratuit de 15 jours par défaut) *' : 'نهاية الفترة (تجربة مجانية لمدة 15 يوماً افتراضياً) *'}
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="date"
                          value={dateFinAbonnement}
                          onChange={(e) => setDateFinAbonnement(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition font-medium text-slate-800"
                          required
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        {isFrench ? 'Modifiable ici si tu veux offrir une durée différente.' : 'قابل للتعديل هنا إذا أردت تحديد مدة مختلفة.'}
                      </p>
                    </div>
                  </>
                )}

                {/* CONDITIONAL FIELD FOR DIRECTORS (Lier à l'enfant parent link) */}
                {!isAdmin && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      {isFrench ? 'Lier à l\'enfant (Optionnel)' : 'ربط الحساب بطفل (اختياري)'}
                    </label>
                    <select
                      value={enfantId}
                      onChange={(e) => setEnfantId(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 bg-white transition font-medium text-slate-850"
                    >
                      <option value="">-- {isFrench ? 'Aucun lien direct' : 'بدون ربط مباشر'} --</option>
                      {enfants.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nom} {item.prenom} ({item.groupeAge})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Monthly Subscription Status Toggle (For Admin viewing) */}
              {isAdmin && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-slate-900">
                      {isFrench ? 'Activer immédiatement l\'abonnement' : 'تفعيل الاشتراك والولوج فوراً'}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {isFrench 
                        ? 'Si décoché, le directeur sera instantanément bloqué.' 
                        : 'إذا تم تعطيله، سيتم حظر المدير تلقائياً ومباشرة.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAbonnementActif(!abonnementActif)}
                    className="text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                  >
                    {abonnementActif ? (
                      <ToggleRight className="w-12 h-12 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-12 h-12 text-slate-400" />
                    )}
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  {isFrench ? 'Annuler' : 'إلغاء'}
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {submitLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>{isFrench ? 'Créer le compte' : 'حفظ الحساب'}</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main listings card info */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Search header bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition bg-white font-medium text-slate-800"
              placeholder={
                isAdmin
                  ? (isFrench ? 'Rechercher un directeur par nom, email ou crèche...' : 'ابحث بالإيميل، اللقب، أو اسم الروضة الشريكة...')
                  : (isFrench ? 'Rechercher un parent par nom, prénom ou email...' : 'ابحث بالإيميل، اللقب أو الاسم الأول لولي الأمر...')
              }
            />
          </div>

          <div className="text-xs text-slate-500 font-bold flex items-center gap-1.5 self-end select-none">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>
              {isFrench 
                ? `${filteredComptes.length} comptes affichés` 
                : `تم العثور على ${filteredComptes.length} حسابات`}
            </span>
          </div>
        </div>

        {/* User accounts list table structure */}
        <div className="overflow-x-auto">
          {filteredComptes.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Users className="w-12 h-12 mx-auto text-slate-200" />
              <p className="font-bold text-lg">{isFrench ? 'Aucun compte trouvé' : 'لم يتم العثور على أي حسابات'}</p>
              <p className="text-xs">{isFrench ? 'Essayez avec un autre mot-clé ou créez un compte.' : 'جرب كلمات بحث مختلفة أو قم بإنشاء حساب جديد.'}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-150 text-slate-500 text-[11px] font-black tracking-wider uppercase bg-slate-100/30">
                  <th className="px-6 py-4">{isFrench ? 'Utilisateur' : 'المستفيد'}</th>
                  <th className="px-6 py-4">{isFrench ? 'Identifiants de Connexion' : 'خطوط الاتصال والسر'}</th>
                  {isAdmin ? (
                    <>
                      <th className="px-6 py-4">{isFrench ? 'Crèche' : 'اسم الروضة'}</th>
                      <th className="px-6 py-4">{isFrench ? 'Enfants' : 'عدد الأطفال'}</th>
                      <th className="px-6 py-4">{isFrench ? 'Dernière Activité' : 'آخر نشاط'}</th>
                      <th className="px-6 py-4">{isFrench ? 'Date Expiration' : 'تاريخ نهاية الاشتراك'}</th>
                      <th className="px-6 py-4">{isFrench ? 'Abonnement / Accès' : 'الاشتراك والولوج'}</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4">{isFrench ? 'Enfant lié' : 'الطفل المرتبط'}</th>
                    </>
                  )}
                  <th className="px-6 py-4 text-center">{isFrench ? 'Actions' : 'خيارات'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredComptes.map((c) => {
                  const mappedEnfant = c.enfantId ? enfants.find(enf => enf.id === c.enfantId) : null;
                  const enfantsDeLaCreche = enfants.filter(e => e.crecheId === c.id);
                  const nbEnfants = enfantsDeLaCreche.length;
                  const lastActivityLabel = formatLastActivity(c.lastActivityAt, language);
                  
                  // Evaluate if subscription has expired relative to the current local date
                  let isExpired = false;
                  if (c.role !== 'admin' && c.dateFinAbonnement) {
                    const todayStr = new Date().toISOString().split('T')[0];
                    if (todayStr > c.dateFinAbonnement) {
                      isExpired = true;
                    }
                  }

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition duration-150">
                      {/* Name card */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center text-sm shadow-sm ${
                            c.role === 'admin' 
                              ? 'bg-amber-100 text-amber-700' 
                              : c.role === 'directeur'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            <span>{`${c.prenom[0] || ''}${c.nom[0] || ''}`.toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                              {c.prenom} {c.nom}
                              {c.role === 'admin' && (
                                <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] uppercase font-bold rounded-full border border-amber-200">
                                  Admin
                                </span>
                              )}
                              {c.role === 'directeur' && (
                                <span className="inline-flex items-center px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] uppercase font-bold rounded-full border border-purple-200">
                                  Directeur
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-400 font-semibold">{c.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Login info */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <p className="text-xs text-slate-700 font-mono select-all bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 inline-block">
                            {c.email}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold">
                            {isFrench ? 'Mot de passe : ' : 'الرمز السري : '}
                            <strong className="text-slate-600 font-mono bg-slate-100/50 rounded px-1">••••••••••</strong>
                          </p>
                        </div>
                      </td>

                      {/* CONDITIONAL TABLE DATA */}
                      {isAdmin ? (
                        <>
                          {/* Creche Name */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-950">
                            {c.nomCreche || <span className="text-slate-400 italic">Non spécifié</span>}
                          </td>

                          {/* Nombre d'enfants */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {c.role === 'admin' ? (
                              <span className="text-slate-400 italic text-xs">--</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Baby className="w-4 h-4 text-rose-500" />
                                <span className="text-sm font-black text-slate-800">{nbEnfants}</span>
                              </div>
                            )}
                          </td>

                          {/* Dernière activité */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {c.role === 'admin' ? (
                              <span className="text-slate-400 italic text-xs">--</span>
                            ) : (
                              <div
                                className="flex items-start gap-2 text-xs font-bold text-slate-600"
                                title={c.lastActivityAt ? new Date(c.lastActivityAt).toISOString() : undefined}
                              >
                                <Clock className="w-3.5 h-3.5 mt-0.5 text-indigo-500 shrink-0" />
                                <span className="leading-5">
                                  {lastActivityLabel || (isFrench ? 'Jamais connecté' : 'لم يسجل الدخول بعد')}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Subscription Expiration End date input (Direct inline editing!) */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {c.role === 'admin' ? (
                              <span className="text-slate-400 italic text-xs">--</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  type="date"
                                  value={c.dateFinAbonnement || ''}
                                  onChange={(e) => handleUpdateEndDate(c.id, e.target.value)}
                                  className={`px-2 py-1.5 border rounded-lg text-xs font-black outline-none focus:ring-2 focus:ring-indigo-100 transition ${
                                    isExpired 
                                      ? 'border-rose-300 bg-rose-50/50 text-rose-700' 
                                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                                  }`}
                                />
                                {isExpired && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" title="Abonnement de ce Directeur expiré !" />
                                )}
                              </div>
                            )}
                          </td>

                          {/* Active subscription status */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {c.role === 'admin' ? (
                              <span className="text-xs font-semibold text-slate-400">Accès Permanent</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubscription(c.id, c.abonnementActif)}
                                  className="focus:outline-none cursor-pointer group"
                                >
                                  {c.abonnementActif && !isExpired ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 text-[10px] font-black uppercase">
                                      Actif
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 rounded-full border border-rose-200 text-[10px] font-black uppercase">
                                      {isExpired ? 'Expiré' : 'Suspendu'}
                                    </span>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleToggleSubscription(c.id, c.abonnementActif)}
                                  className="text-slate-400 hover:text-indigo-600 cursor-pointer transition flex items-center justify-center"
                                >
                                  {c.abonnementActif ? (
                                    <ToggleRight className="w-7 h-7 text-emerald-500" />
                                  ) : (
                                    <ToggleLeft className="w-7 h-7 text-slate-300" />
                                  )}
                                </button>
                              </div>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Parent role has child association badge */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {mappedEnfant ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-full border border-rose-100 shadow-sm">
                                <Baby className="w-3.5 h-3.5 text-rose-500" />
                                <span>{mappedEnfant.nom} {mappedEnfant.prenom}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Aucun élève lié</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Delete button */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {c.id === 'adm1' ? (
                          <span className="text-[10px] text-slate-400 font-bold uppercase select-none">
                            System
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDeleteCompte(c.id, `${c.prenom} ${c.nom}`)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title={isFrench ? 'Supprimer l\'utilisateur' : 'حذف الحساب'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
