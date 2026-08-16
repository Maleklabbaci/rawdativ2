import { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  X, 
  UserCheck, 
  Search, 
  Phone, 
  Mail, 
  Calendar, 
  Award, 
  Bookmark, 
  Activity, 
  MapPin,
  Heart,
  HelpCircle,
  Clock
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { Personnel as PersonnelType } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface RichPersonnel extends PersonnelType {
  telephone?: string;
  email?: string;
  dateEmbauche?: string;
  classeAssignee?: string;
  groupeSanguin?: string;
}

export default function Personnel() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  const { personnel: allDbPersonnel, classes: allDbClasses, addPersonnel, deletePersonnel } = useDb();
  const { user } = useAuth();
  const isDirecteur = user?.role === 'directeur';
  const dbPersonnel = isDirecteur ? allDbPersonnel.filter((p: any) => p.crecheId === user!.id) : allDbPersonnel;
  const classes = (isDirecteur ? allDbClasses.filter((c: any) => c.crecheId === user!.id) : allDbClasses) as any[];
  const classNames = classes.map(classe => String(classe.nom || '').trim()).filter(Boolean);
  const normaliseEmail = (email?: string) => (email || '').replace(/@rawdati(?:\.com|\.dz)$/i, '@rawdha.dz');

  const personnel: RichPersonnel[] = dbPersonnel.map((p) => ({
    ...p,
    // Ne pas inventer de téléphone, date d'embauche ou groupe sanguin pour remplir l'écran.
    telephone: p.telephone || '',
    email: normaliseEmail(p.email),
    dateEmbauche: p.dateEmbauche || '',
    classeAssignee: p.classeAssignee || 'Toutes les classes',
    groupeSanguin: p.groupeSanguin || '',
  }));

  const [showModal, setShowModal] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    poste: 'Éducatrice Principale',
    statut: 'Actif' as 'Actif' | 'Inactif',
    telephone: '0555 90 23 45',
    email: '',
    dateEmbauche: new Date().toISOString().split('T')[0],
    classeAssignee: 'Toutes les classes',
    groupeSanguin: 'O+',
    assuranceActive: false, // ✅ assurance de l'employé(e)
    numeroAssurance: '', // ✅ numéro de police / référence CNAS
  });

  const handleAjouter = () => {
    if (!formData.nom || !formData.prenom || !formData.poste) return;
    
    // Auto populate email if blank
    const calculatedEmail = formData.email || `${formData.prenom.toLowerCase()}.${formData.nom.toLowerCase()}@rawdha.dz`;

    addPersonnel({
      ...formData,
      email: calculatedEmail,
      crecheId: isDirecteur ? user!.id : undefined
    } as any);
    setShowModal(false);
    // Reset form
    setFormData({
      nom: '',
      prenom: '',
      poste: 'Éducatrice Principale',
      statut: 'Actif',
      telephone: '0555 90 23 45',
      email: '',
      dateEmbauche: new Date().toISOString().split('T')[0],
      classeAssignee: 'Toutes les classes',
      groupeSanguin: 'O+',
      assuranceActive: false,
      numeroAssurance: '',
    });
  };

  const filteredPersonnel = personnel.filter(p => {
    const term = searchTerm.toLowerCase();
    return (
      p.nom.toLowerCase().includes(term) ||
      p.prenom.toLowerCase().includes(term) ||
      p.poste.toLowerCase().includes(term)
    );
  });

  const activeCount = personnel.filter(p => p.statut === 'Actif').length;
  const inactiveCount = personnel.filter(p => p.statut !== 'Actif').length;

  return (
    <div className="space-y-8 font-sans">
      {/* Analytics Summary blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isArabic ? 'إجمالي الطاقم' : 'Équipe Educative'}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{personnel.length} {isArabic ? 'موظفين' : 'membres'}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isArabic ? 'النشطون اليوم' : 'Présents & Actifs'}
            </p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">{activeCount} {isArabic ? 'نشط' : 'en poste'}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 hover:shadow-md transition">
          <div className="w-12 h-12 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isArabic ? 'رعاية صحية وتغطية' : 'Taux d\'Encadrement'}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">1 : 5 {isArabic ? 'أطفال' : 'enfants'}</p>
          </div>
        </div>
      </div>

      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
            {t('staff')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-tight">
            {isArabic 
              ? 'إدارة الفريق التربوي، المربيات، الممرضات، ومعلومات الاتصال والمناصب الخاصة بهم' 
              : 'Gerez les profils de vos éducatrices, puéricultrices, pédiatres et équipe de restauration.'}
          </p>
        </div>
        <button 
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer w-full sm:w-auto" 
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} className="stroke-[3]" />
          <span>{t('staff.add')}</span>
        </button>
      </div>

      {/* Search Input bar */}
      <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={isArabic ? 'ابحث عن مربية أو منصب...' : 'Rechercher un membre ou un poste...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs sm:text-sm font-medium text-slate-800"
          />
        </div>
      </div>

      {/* Personnel Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 animate-slide-up">
        {filteredPersonnel.length > 0 ? (
          filteredPersonnel.map((p) => {
            const initials = `${p.prenom[0]}${p.nom[0]}`;
            
            return (
              <div 
                key={p.id} 
                className={`bg-white rounded-2xl border border-slate-100 p-6 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between cursor-pointer`}
                onClick={() => setSelectedPersonnel(p)}
              >
                <div>
                  {/* Card top details with avatar */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white font-extrabold text-base flex items-center justify-center shadow-md">
                        {initials}
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 leading-snug">{p.prenom} {p.nom}</h3>
                        <span className="inline-flex items-center gap-1.5 mt-1 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                          <Award className="w-3 h-3" />
                          {p.poste}
                        </span>
                      </div>
                    </div>

                    {/* Active/Inactive Badge with green pulse */}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest leading-none ${
                      p.statut === 'Actif' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {p.statut === 'Actif' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
                      {p.statut}
                    </span>
                  </div>

                  {/* Core Information stats */}
                  <div className="mt-4 space-y-2 text-xs font-semibold text-slate-500">
                    <div className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg transition duration-150">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <a href={`tel:${p.telephone}`} className="text-slate-700 hover:text-indigo-600 font-bold">{p.telephone}</a>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg transition duration-150 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-700 truncate">{p.email}</span>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg transition duration-150">
                      <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{isArabic ? 'القسم المسؤول:' : 'Section'}: <strong className="text-slate-800">{p.classeAssignee}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Footer specs / Embauche & Groupe Sanguin */}
                <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Inscrit: {p.dateEmbauche}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.assuranceActive && (
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-black border border-emerald-100/30" title={p.numeroAssurance || ''}>
                        {isArabic ? 'مؤمَّن' : 'Assuré(e)'}
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded font-black border border-rose-100/30">
                      Group: {p.groupeSanguin}
                    </span>
                    <button 
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        const confirmationMsg = isArabic
                          ? 'هل أنت متأكد من حذف هذا الموظف؟'
                          : 'Êtes-vous sûr de vouloir supprimer ce membre du personnel ?';
                        if (window.confirm(confirmationMsg)) {
                          deletePersonnel(p.id);
                        }
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full p-12 bg-white rounded-2xl border border-slate-100 text-center text-slate-400">
            <HelpCircle className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
            <p className="font-extrabold">{isArabic ? 'لا توجد نتائج مطابقة' : 'Aucun membre d\'équipe trouvé'}</p>
            <p className="text-xs text-slate-400 mt-0.5">{isArabic ? 'يرجى مراجعة معيار البحث الخاص بك.' : 'Faites une autre recherche ou ajoutez un nouveau membre.'}</p>
          </div>
        )}
      </div>

      {/* Adding Rich Staff Modal ("PLEINE DE FORMATION") */}
      <AnimatePresence>
        {showModal && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-start sm:items-center justify-center z-[999] p-2 sm:p-4 overflow-y-auto cursor-pointer"
            onClick={() => setShowModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[85vh] mt-2 sm:mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black">{isArabic ? 'إضافة عضو جديد وتعيينه' : 'Nouveau Dossier Personnel'}</h3>
                  <p className="text-xs text-indigo-100 mt-0.5">{isArabic ? 'تعبئة معلومات الحساب، بطاقة الاتصال، المسؤولية والبيانات الصحية للموظف' : 'Fiche d\'embauche, coordonnées, poste et groupe sanguin'}</p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                
                {/* Last Name & First Name (Row 1) */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'اللقب *' : 'Nom de famille *'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: Benali"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                      value={formData.nom} 
                      onChange={e => setFormData({...formData, nom: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'الاسم الشخصي *' : 'Prénom *'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: Nassima"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                      value={formData.prenom} 
                      onChange={e => setFormData({...formData, prenom: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Job Title & Contact (Row 2) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'الوظيفة / التخصص *' : 'Poste occupé *'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800"
                      value={formData.poste}
                      onChange={e => setFormData({...formData, poste: e.target.value})}
                    >
                      <option value="Éducatrice Principale">Éducatrice Principale</option>
                      <option value="Puéricultrice">Puéricultrice</option>
                      <option value="Pédiatre Référent">Pédiatre Référent</option>
                      <option value="Psychologue Infantile">Psychologue Infantile</option>
                      <option value="Cuisinière Chef">Cuisinière Chef</option>
                      <option value="Agent de sécurité">Agent de sécurité / Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'رقم الهاتف المباشر *' : 'Téléphone Direct *'}
                    </label>
                    <input 
                      type="tel" 
                      placeholder="Ex: 0555 12 34 56"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-bold text-slate-800" 
                      value={formData.telephone} 
                      onChange={e => setFormData({...formData, telephone: e.target.value})} 
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'البريد الإلكتروني' : 'Adresse Email Professionnelle (Optionnel)'}
                  </label>
                  <input 
                    type="email" 
                    placeholder="Ex: nassima.b@rawdha.dz"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                  />
                </div>

                {/* Section assigned & blood type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'القسم / الصف المسند إليها *' : 'Classe / Section affectée *'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800"
                      value={formData.classeAssignee}
                      onChange={e => setFormData({...formData, classeAssignee: e.target.value})}
                    >
                      {classNames.map(className => (
                        <option key={className} value={className}>{className}</option>
                      ))}
                      <option value="Toutes les classes">{isArabic ? 'كل الأقسام / متعدد' : 'Toutes les classes / Polyvalente'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'الفصيلة الدموية *' : 'Groupe Sanguin *'}
                    </label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-bold text-slate-800"
                      value={formData.groupeSanguin}
                      onChange={e => setFormData({...formData, groupeSanguin: e.target.value})}
                    >
                      <option value="O+">O+</option>
                      <option value="A+">A+</option>
                      <option value="B+">B+</option>
                      <option value="AB+">AB+</option>
                      <option value="O-">O-</option>
                      <option value="A-">A-</option>
                    </select>
                  </div>
                </div>

                {/* Hire Date & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'تاريخ التعيين' : 'Date de prise de service'}
                    </label>
                    <input 
                      type="date"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800"
                      value={formData.dateEmbauche}
                      onChange={e => setFormData({...formData, dateEmbauche: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'الوضعية اليوم *' : 'Statut de Disponibilité *'}
                    </label>
                    <select 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                      value={formData.statut} 
                      onChange={e => setFormData({...formData, statut: e.target.value as any})}
                    >
                      <option value="Actif">Actif (En poste)</option>
                      <option value="Inactif">Inactif / Congé</option>
                    </select>
                  </div>
                </div>

                {/* ✅ Assurance de l'employé(e) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <input
                      type="checkbox"
                      id="assuranceActive"
                      checked={formData.assuranceActive}
                      onChange={e => setFormData({...formData, assuranceActive: e.target.checked})}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                    <label htmlFor="assuranceActive" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                      {isArabic ? 'مؤمَّن(ة) اجتماعياً' : 'Assuré(e) socialement'}
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'رقم التأمين (CNAS)' : 'N° Assurance (CNAS)'}
                    </label>
                    <input
                      type="text"
                      disabled={!formData.assuranceActive}
                      placeholder={isArabic ? 'مثال: 123456789012' : 'Ex: 123456789012'}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      value={formData.numeroAssurance}
                      onChange={e => setFormData({...formData, numeroAssurance: e.target.value})}
                    />
                  </div>
                </div>

              </div>

              {/* Buttons */}
              <div className="p-6 pt-4 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-slate-50/50">
                <button 
                  type="button"
                  className="flex-1 p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-sm"
                  onClick={() => setShowModal(false)}
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="button"
                  className="flex-1 p-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-750 text-white font-bold rounded-xl transition cursor-pointer text-sm shadow-md"
                  onClick={handleAjouter}
                >
                  {t('common.save')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Personnel Profile Detail Modal */}
      <AnimatePresence>
        {selectedPersonnel && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-start sm:items-center justify-center z-[999] p-2 sm:p-4 overflow-y-auto cursor-pointer"
            onClick={() => setSelectedPersonnel(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md max-h-[85vh] mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Colorful gradient headers */}
              <div className="p-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 text-white font-black text-lg flex items-center justify-center shadow-inner">
                    {selectedPersonnel.prenom[0]}{selectedPersonnel.nom[0]}
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{selectedPersonnel.prenom} {selectedPersonnel.nom}</h3>
                    <p className="text-xs text-indigo-100 mt-0.5">{selectedPersonnel.poste}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPersonnel(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* Contact Coordinates */}
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block mb-2">{isArabic ? 'معلومات الاتصال المباشرة' : 'Coordonnées de l\'employé'}</span>
                  <div className="space-y-2 text-sm font-semibold">
                    <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <Phone className="w-4 h-4 text-slate-450" />
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{isArabic ? 'الهاتف المحمول' : 'Téléphone direct'}</span>
                        <a href={`tel:${selectedPersonnel.telephone}`} className="text-indigo-600 font-extrabold">{selectedPersonnel.telephone}</a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <Mail className="w-4 h-4 text-slate-450" />
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{isArabic ? 'البريد الإلكتروني' : 'Messagerie'}</span>
                        <span className="text-slate-800 font-bold">{selectedPersonnel.email}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assignment & Health specs */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider mb-1">{isArabic ? 'القسم المسؤول' : 'Classe Affectée'}</span>
                    <span className="font-extrabold text-slate-800 text-xs">{selectedPersonnel.classeAssignee}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider mb-1">{isArabic ? 'الفصيلة الدموية' : 'Groupe Sanguin'}</span>
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded font-black border border-rose-100/30 text-xs inline-block">
                      Group {selectedPersonnel.groupeSanguin}
                    </span>
                  </div>
                </div>

                {/* Hire details */}
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[9px] font-bold text-slate-405 uppercase tracking-wider block mb-0.5">{isArabic ? 'تاريخ التوظيف' : 'Date d\'embauche'}</span>
                    <span className="font-extrabold text-slate-805">{selectedPersonnel.dateEmbauche}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-405 uppercase tracking-wider block text-right mb-1">{isArabic ? 'حالة الحساب' : 'Disponibilité'}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest leading-none ${
                      selectedPersonnel.statut === 'Actif' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {selectedPersonnel.statut}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
