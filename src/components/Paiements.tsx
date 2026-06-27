import { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  X, 
  CreditCard, 
  Search, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Calendar,
  HelpCircle,
  FileText,
  Edit
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { Paiement } from '../types';
import { formatCurrency } from '../utils/format';
import { motion, AnimatePresence } from 'motion/react';
import Facture from './Facture';

interface RichPaiement extends Paiement {
  moyenPaiement?: 'Espèces' | 'Chèque' | 'Virement' | 'Carte';
  dateEcheance?: string;
  reductionCode?: string;
  notes?: string;
  typeFacture?: 'Mensuel' | 'Annuel';
}

export default function Paiements() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  const { 
    paiements: allDbPaiements, 
    enfants: allEnfantsData, 
    addPaiement, 
    deletePaiement,
    updatePaiement // Utilisation de l'update depuis le DbContext
  } = useDb();
  
  const { user } = useAuth();
  const isDirecteur = user?.role === 'directeur';
  const enfantsData = isDirecteur ? allEnfantsData.filter(e => e.crecheId === user!.id) : allEnfantsData;
  const enfantIdsVisibles = new Set(enfantsData.map(e => e.id));
  const dbPaiements = isDirecteur ? allDbPaiements.filter(p => enfantIdsVisibles.has(p.enfantId)) : allDbPaiements;

  const paiements: RichPaiement[] = dbPaiements.map((p: any) => ({
    ...p,
    moyenPaiement: p.moyenPaiement || (p.statut === 'Payé' ? 'Espèces' : undefined),
    dateEcheance: p.dateEcheance || (p.statut !== 'Payé' ? '2026-07-05' : undefined),
    reductionCode: p.reductionCode || 'Aucun',
    typeFacture: p.typeFacture || 'Mensuel'
  }));

  const [showModal, setShowModal] = useState(false);
  const [editingPaiementId, setEditingPaiementId] = useState<string | null>(null);
  const [selectedPaiement, setSelectedPaiement] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState('Tous');
  const [showFacture, setShowFacture] = useState(false);
  const [selectedFacturePaiement, setSelectedFacturePaiement] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    enfantId: enfantsData[0]?.id || '',
    montant: 12000,
    statut: 'En attente' as 'Payé' | 'En attente' | 'Retard',
    typeFacture: 'Mensuel' as 'Mensuel' | 'Annuel',
    moisConcerne: 'Mai 2026',
    moyenPaiement: 'Espèces' as 'Espèces' | 'Chèque' | 'Virement' | 'Carte',
    dateEcheance: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
    reductionCode: 'Aucun',
    notes: ''
  });

  // Déclenche l'édition d'une facture existante
  const handleEditClick = (p: RichPaiement) => {
    setEditingPaiementId(p.id);
    setFormData({
      enfantId: p.enfantId,
      montant: p.montant,
      statut: p.statut,
      typeFacture: p.typeFacture || 'Mensuel',
      moisConcerne: p.moisConcerne,
      moyenPaiement: p.moyenPaiement || 'Espèces',
      dateEcheance: p.dateEcheance || new Date().toISOString().split('T')[0],
      reductionCode: p.reductionCode || 'Aucun',
      notes: p.notes || ''
    });
    setShowModal(true);
  };

  const handleAjouterOuModifier = () => {
    if (!formData.enfantId || formData.montant <= 0 || !formData.moisConcerne) return;

    if (editingPaiementId) {
      // Modification
      updatePaiement(editingPaiementId, formData);
    } else {
      // Ajout standard
      addPaiement(formData);
    }

    setShowModal(false);
    setEditingPaiementId(null);
    // Reset state
    setFormData({
      enfantId: enfantsData[0]?.id || '',
      montant: 12000,
      statut: 'En attente',
      typeFacture: 'Mensuel',
      moisConcerne: 'Mai 2026',
      moyenPaiement: 'Espèces',
      dateEcheance: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
      reductionCode: 'Aucun',
      notes: ''
    });
  };

  // Mathématiques de synthèse financière
  const totalPaid = paiements.filter(p => p.statut === 'Payé').reduce((sum, p) => sum + p.montant, 0);
  const totalPending = paiements.filter(p => p.statut === 'En attente').reduce((sum, p) => sum + p.montant, 0);
  const totalLate = paiements.filter(p => p.statut === 'Retard').reduce((sum, p) => sum + p.montant, 0);
  const recoveryRate = Math.round((totalPaid / (totalPaid + totalPending + totalLate)) * 100) || 0;

  const filteredPaiements = paiements.filter(p => {
    const enfant = enfantsData.find(e => e.id === p.enfantId);
    const matchesSearch = enfant
      ? `${enfant.prenom} ${enfant.nom}`.toLowerCase().includes(searchTerm.toLowerCase())
      : false;
    const matchesStatut = filterStatut === 'Tous' || p.statut === filterStatut;

    return matchesSearch && matchesStatut;
  });

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Statistiques financières */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-2.5 sm:gap-4 hover:shadow-md transition">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">{isArabic ? 'المداخيل المحصلة' : 'Revenus Perçus'}</p>
            <p className="text-sm sm:text-xl font-black text-emerald-600 mt-0.5 truncate">{formatCurrency(totalPaid)}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-2.5 sm:gap-4 hover:shadow-md transition">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">{isArabic ? 'في الانتظار' : 'En attente'}</p>
            <p className="text-sm sm:text-xl font-black text-amber-600 mt-0.5 truncate">{formatCurrency(totalPending)}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-2.5 sm:gap-4 hover:shadow-md transition">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">{isArabic ? 'متأخرات الدفع' : 'Créances (En Retard)'}</p>
            <p className="text-sm sm:text-xl font-black text-rose-600 mt-0.5 truncate">{formatCurrency(totalLate)}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-2.5 sm:gap-4 hover:shadow-md transition">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">{isArabic ? 'نسبة الاسترداد' : 'Taux'}</p>
            <p className="text-sm sm:text-xl font-black text-indigo-600 mt-0.5 truncate">{recoveryRate}%</p>
          </div>
        </div>
      </div>

      {/* Titre & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
            {isArabic ? 'تسيير الفواتير والمدفوعات' : 'Facturation & Échéances'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-tight">
            {isArabic 
              ? 'توليد ومتابعة فواتير التمدرس الشهرية، السنوية والخصومات العائلية' 
              : 'Générez et suivez les cotisations mensuelles/annuelles, remises, règlements et retards.'}
          </p>
        </div>
        <button 
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer w-full sm:w-auto" 
          onClick={() => {
            setEditingPaiementId(null);
            setShowModal(true);
          }}
        >
          <Plus size={16} className="stroke-[3]" />
          <span>{isArabic ? 'إصدار فاتورة جديدة' : 'Créer une facture'}</span>
        </button>
      </div>

      {/* Barre de Recherche et Filtres */}
      <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={isArabic ? 'ابحث عن طفل...' : 'Rechercher un enfant...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs sm:text-sm font-medium text-slate-800"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-nowrap shrink-0">
          {[
            { key: 'Tous', label: isArabic ? 'الكل' : 'Tous', color: 'text-slate-500 hover:text-slate-800' },
            { key: 'Payé', label: isArabic ? 'مدفوعة' : 'Payées', color: 'text-slate-500 hover:text-emerald-600' },
            { key: 'En attente', label: isArabic ? 'في الانتظار' : 'En attente', color: 'text-slate-500 hover:text-amber-600' },
            { key: 'Retard', label: isArabic ? 'متأخرة' : 'En retard', color: 'text-slate-500 hover:text-rose-600' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterStatut(tab.key)}
              className={`flex-grow sm:flex-none px-3.5 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 ${
                filterStatut === tab.key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : `bg-slate-50 ${tab.color}`
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau des factures */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-400">
                <th className="p-5">{isArabic ? 'الطفل' : 'Enfant'}</th>
                <th className="p-5">{isArabic ? 'النوع والفترة' : 'Type / Période'}</th>
                <th className="p-5">{isArabic ? 'القيمة' : 'Montant'}</th>
                <th className="p-5">{isArabic ? 'التفاصيل' : 'Mode / Échéance'}</th>
                <th className="p-5">{isArabic ? 'الوضعية' : 'Statut'}</th>
                <th className="p-5 text-center">{isArabic ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
              {filteredPaiements.length > 0 ? (
                filteredPaiements.map((p) => {
                  const enfant = enfantsData.find(e => e.id === p.enfantId);
                  
                  return (
                    <tr 
                      key={p.id} 
                      className="hover:bg-slate-50/50 transition cursor-pointer"
                      onClick={() => setSelectedPaiement(p)}
                    >
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                            {enfant ? `${enfant.prenom[0]}${enfant.nom[0]}` : '??'}
                          </div>
                          <div>
                            <p className="text-slate-900 font-extrabold">{enfant ? `${enfant.prenom} ${enfant.nom}` : t('children.all')}</p>
                            <p className="text-xs text-slate-400 font-semibold">{enfant?.groupeAge || 'N/A'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-5 whitespace-nowrap text-slate-600 font-bold">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-slate-900 leading-none">{p.moisConcerne}</p>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {p.typeFacture === 'Annuel' ? (isArabic ? 'سنوي' : 'Annuel') : (isArabic ? 'شهري' : 'Mensuel')}
                            </span>
                          </div>
                        </span>
                      </td>

                      <td className="p-5 whitespace-nowrap">
                        <p className="text-slate-950 font-black">{formatCurrency(p.montant)}</p>
                        {p.reductionCode !== 'Aucun' && (
                          <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded leading-none">
                            {p.reductionCode}
                          </span>
                        )}
                      </td>

                      <td className="p-5">
                        {p.statut === 'Payé' ? (
                          <div>
                            <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{p.moyenPaiement || 'Espèces'}</span>
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-rose-500 font-bold bg-rose-50/50 border border-rose-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-rose-500" />
                            <span>{isArabic ? 'الاستحقاق' : 'Échéance'}: {p.dateEcheance || 'Immédiat'}</span>
                          </p>
                        )}
                      </td>

                      <td className="p-5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold leading-none ${
                          p.statut === 'Payé'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : p.statut === 'En attente'
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            p.statut === 'Payé' ? 'bg-emerald-500' : p.statut === 'En attente' ? 'bg-amber-500' : 'bg-rose-500'
                          }`} />
                          {p.statut}
                        </span>
                      </td>

                      <td className="p-5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer" 
                            onClick={() => {
                              setSelectedFacturePaiement(p);
                              setShowFacture(true);
                            }}
                            title={isArabic ? 'عرض الفاتورة الرسمية' : 'Voir la facture'}
                          >
                            <FileText size={16} />
                          </button>
                          
                          {/* BOUTON MODIFIER */}
                          <button 
                            className="p-1.5 text-amber-500 hover:text-amber-750 hover:bg-amber-50 rounded-lg transition cursor-pointer" 
                            onClick={() => handleEditClick(p)}
                            title={isArabic ? 'تعديل الفاتورة' : 'Modifier la facture'}
                          >
                            <Edit size={16} />
                          </button>

                          <button 
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer" 
                            onClick={() => {
                              const confirmationMsg = isArabic
                                ? 'هل أنت متأكد من حذف هذه الفاتورة؟'
                                : 'Êtes-vous sûr de vouloir supprimer cette facture ?';
                              if (window.confirm(confirmationMsg)) {
                                deletePaiement(p.id);
                              }
                            }}
                            title={isArabic ? 'حذف' : 'Supprimer'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    <HelpCircle className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
                    <p className="font-extrabold">{isArabic ? 'لا توجد فواتير' : 'Aucun état de facturation disponible'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{isArabic ? 'اضغط على إصدار فاتورة للبدء.' : 'Engagez une nouvelle facturation en cliquant sur le bouton d\'émission.'}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajout & Edition */}
      <AnimatePresence>
        {showModal && (
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-center justify-center z-[999] p-4 cursor-pointer"
            onClick={() => {
              setShowModal(false);
              setEditingPaiementId(null);
            }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-xl max-h-[85vh] mt-16 flex flex-col overflow-hidden font-sans cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-xl font-black">
                    {editingPaiementId 
                      ? (isArabic ? 'تعديل تفاصيل الفاتورة' : 'Modifier la Facture') 
                      : (isArabic ? 'إصدار فاتورة جديدة' : 'Création de Facture')
                    }
                  </h3>
                  <p className="text-xs text-indigo-100 mt-0.5">
                    {isArabic 
                      ? 'إعداد فواتير المدارس والخدمات مع حساب الخصومات والمدفوعات' 
                      : 'Fiche d\'appel de fonds, remises scolarité fratrie & règlement'}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setShowModal(false);
                    setEditingPaiementId(null);
                  }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Type de Facturation (Mensuel / Annuel) */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'نوع الفاتورة *' : 'Type de Facturation *'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'Mensuel', label: isArabic ? 'شهري' : 'Mensuelle' },
                      { key: 'Annuel', label: isArabic ? 'سنوي' : 'Annuelle' }
                    ].map(type => (
                      <button
                        key={type.key}
                        type="button"
                        onClick={() => {
                          const isAnnuel = type.key === 'Annuel';
                          setFormData({
                            ...formData, 
                            typeFacture: type.key as any,
                            montant: isAnnuel ? 120000 : 12000, // Ajuste le montant par défaut
                            moisConcerne: isAnnuel ? 'Année Scolaire 2026/2027' : 'Mai 2026'
                          });
                        }}
                        className={`p-3 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                          formData.typeFacture === type.key 
                            ? 'bg-indigo-600 text-white border-transparent' 
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Choix de l'enfant */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'الطفل المستفيد *' : 'Sélectionner l\'Enfant Récepteur *'}
                  </label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800" 
                    value={formData.enfantId} 
                    onChange={e => setFormData({...formData, enfantId: e.target.value})}
                  >
                    {enfantsData.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
                  </select>
                </div>

                {/* Montant & Période */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'مبلغ الفاتورة (دج) *' : 'Montant Principal (DZD) *'}
                    </label>
                    <input 
                      type="number" 
                      placeholder="Ex: 12000"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-bold text-slate-800" 
                      value={formData.montant || ''} 
                      onChange={e => setFormData({...formData, montant: parseInt(e.target.value) || 0})} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {formData.typeFacture === 'Annuel' 
                        ? (isArabic ? 'السنة الدراسية المعنية *' : 'Année Scolaire *')
                        : (isArabic ? 'الشهر المعني *' : 'Période Facturée (Mois) *')
                      }
                    </label>
                    {formData.typeFacture === 'Annuel' ? (
                      <select
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800"
                        value={formData.moisConcerne}
                        onChange={e => setFormData({...formData, moisConcerne: e.target.value})}
                      >
                        <option value="Année Scolaire 2025/2026">Année Scolaire 2025/2026</option>
                        <option value="Année Scolaire 2026/2027">Année Scolaire 2026/2027</option>
                        <option value="Année Scolaire 2027/2028">Année Scolaire 2027/2028</option>
                      </select>
                    ) : (
                      <select
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800"
                        value={formData.moisConcerne}
                        onChange={e => setFormData({...formData, moisConcerne: e.target.value})}
                      >
                        <option value="Janvier 2026">Janvier 2026</option>
                        <option value="Février 2026">Février 2026</option>
                        <option value="Mars 2026">Mars 2026</option>
                        <option value="Avril 2026">Avril 2026</option>
                        <option value="Mai 2026">Mai 2026</option>
                        <option value="Juin 2026">Juin 2026</option>
                        <option value="Juillet 2026">Juillet 2026</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* Remise & Mode de règlement */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'معدل الخصم / الاتفاقية *' : 'Remise pour convention / Fratrie *'}
                    </label>
                    <select 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800"
                      value={formData.reductionCode}
                      onChange={e => setFormData({...formData, reductionCode: e.target.value})}
                    >
                      <option value="Aucun">Aucune remise (Tarif Plein)</option>
                      <option value="Fratrie -10%">Fratrie (-10%)</option>
                      <option value="Scolarité Réduite">Rentrée décalée (-15%)</option>
                      <option value="Partenaire Social">Tarif Partenaire Social</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {isArabic ? 'وسيلة الدفع المفضلة *' : 'Type de Règlement *'}
                    </label>
                    <select 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-semibold text-slate-800"
                      value={formData.moyenPaiement}
                      onChange={e => setFormData({...formData, moyenPaiement: e.target.value as any})}
                    >
                      <option value="Espèces">Espèces</option>
                      <option value="Chèque">Chèque Bancaire</option>
                      <option value="Virement">Virement Postaux / CCP</option>
                      <option value="Carte">Carte Bancaire / CIB</option>
                    </select>
                  </div>
                </div>

                {/* Choix du statut */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {isArabic ? 'حالة الفاتورة والتحصيل *' : 'Statut d\'Émission *'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'Payé', label: isArabic ? 'تم الدفع بالكامل' : 'Déjà Réglé', activeBg: 'bg-emerald-600 text-white border-transparent' },
                      { key: 'En attente', label: isArabic ? 'قيد الانتظار' : 'En attente', activeBg: 'bg-amber-500 text-white border-transparent' },
                      { key: 'Retard', label: isArabic ? 'متأخر في الدفع' : 'En Retard', activeBg: 'bg-rose-600 text-white border-transparent' }
                    ].map(status => (
                      <button
                        key={status.key}
                        type="button"
                        onClick={() => setFormData({...formData, statut: status.key as any})}
                        className={`p-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                          formData.statut === status.key 
                            ? status.activeBg 
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date d'échéance & Notes */}
                <div className="grid grid-cols-1 gap-2 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      {isArabic ? 'تاريخ استحقاق الفاتورة' : 'Date limite de paiement'}
                    </label>
                    <input 
                      type="date"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800"
                      value={formData.dateEcheance}
                      onChange={e => setFormData({...formData, dateEcheance: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      {isArabic ? 'ملاحظات إضافية' : 'Notes administratives'}
                    </label>
                    <input 
                      type="text" 
                      placeholder="Commentaires ou informations du chèque..."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                      value={formData.notes} 
                      onChange={e => setFormData({...formData, notes: e.target.value})} 
                    />
                  </div>
                </div>

              </div>

              {/* Pied de page actions */}
              <div className="p-6 pt-4 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-slate-50/50">
                <button 
                  type="button"
                  className="flex-1 p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-sm"
                  onClick={() => {
                    setShowModal(false);
                    setEditingPaiementId(null);
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="button"
                  className="flex-1 p-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl transition cursor-pointer text-sm shadow-md"
                  onClick={handleAjouterOuModifier}
                >
                  {editingPaiementId ? (isArabic ? 'حفظ التعديلات' : 'Enregistrer les modifications') : t('common.save')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reçu détaillé (au clic sur une ligne) */}
      <AnimatePresence>
        {selectedPaiement && (() => {
          const enfant = enfantsData.find(e => e.id === selectedPaiement.enfantId);
          const originPrice = selectedPaiement.montant;
          const reductionStr = selectedPaiement.reductionCode !== 'Aucun' ? selectedPaiement.reductionCode : null;
          
          return (
            <div 
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-center justify-center z-[999] p-4 cursor-pointer"
              onClick={() => setSelectedPaiement(null)}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md max-h-[85vh] mt-16 flex flex-col overflow-hidden font-sans cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 bg-slate-50 border-b border-dashed border-slate-200 text-slate-800 relative flex-shrink-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">{isArabic ? 'تفاصيل السداد الرسمية' : 'REÇU DE FACTURATION'}</span>
                      <h4 className="text-lg font-black text-slate-900 mt-1">N° #{selectedPaiement.id?.slice(0, 8).toUpperCase() || '2938173'}</h4>
                    </div>
                    <button 
                      onClick={() => setSelectedPaiement(null)}
                      className="p-1.5 rounded-lg bg-slate-200/50 hover:bg-slate-200/80 text-slate-500 transition cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-slate-950 rounded-full" />
                  <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-slate-950 rounded-full" />
                </div>

                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block mb-2">{isArabic ? 'المستلم والمعلومات العائلية' : 'Bénéficiaire / Élève'}</span>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold flex items-center justify-center text-xs">
                        {enfant ? `${enfant.prenom[0]}${enfant.nom[0]}` : 'E'}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 leading-none">{enfant ? `${enfant.prenom} ${enfant.nom}` : 'Enfant Inscrit'}</p>
                        <p className="text-[11px] text-slate-500 font-bold mt-1">{isArabic ? 'قسم:' : 'Groupe Age'}: {enfant?.groupeAge || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-b border-slate-100 py-4 text-xs font-bold text-slate-500">
                    <div className="flex justify-between">
                      <span>{isArabic ? 'النوع والتاريخ' : 'Type de facturation'}:</span>
                      <span className="text-slate-800 font-extrabold">
                        {selectedPaiement.typeFacture === 'Annuel' ? (isArabic ? 'سنوي' : 'Annuel') : (isArabic ? 'شهري' : 'Mensuel')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isArabic ? 'الفترة المعنية' : 'Période administrative'}:</span>
                      <span className="text-slate-800 font-extrabold">{selectedPaiement.moisConcerne}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isArabic ? 'المبلغ الأصلي' : 'Prix initial scolarité'}:</span>
                      <span className="text-slate-800">{formatCurrency(originPrice)}</span>
                    </div>
                    {reductionStr && (
                      <div className="flex justify-between text-indigo-600">
                        <span>Convention / Remise ({reductionStr}):</span>
                        <span>-{isArabic ? 'خصم مسجل' : 'Appliqué'}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-800 text-sm font-black pt-3 border-t border-dashed border-slate-200">
                      <span>{isArabic ? 'المبلغ المستحق' : 'Net à payer'} (DZD):</span>
                      <span className="text-indigo-600 text-base">{formatCurrency(selectedPaiement.montant)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider mb-1">{isArabic ? 'وسيلة الدفع' : 'Mode de versement'}</span>
                      <span className="font-extrabold text-slate-800">{selectedPaiement.moyenPaiement || 'Espèces'}</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider mb-1">{isArabic ? 'تاريخ الاستحقاق' : 'Date de limite'}</span>
                      <span className="font-extrabold text-slate-800">{selectedPaiement.dateEcheance || 'Complété'}</span>
                    </div>
                  </div>

                  <div className="flex justify-center pt-2">
                    <span className={`inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest leading-none border shadow-xs ${
                      selectedPaiement.statut === 'Payé'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : selectedPaiement.statut === 'En attente'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        selectedPaiement.statut === 'Payé' ? 'bg-emerald-500' : selectedPaiement.statut === 'En attente' ? 'bg-amber-500' : 'bg-rose-500'
                      }`} />
                      {selectedPaiement.statut === 'Payé' ? (isArabic ? 'خالصة الدفع' : 'COMPLÈTEMENT RÉGLÉ') : selectedPaiement.statut}
                    </span>
                  </div>

                  {selectedPaiement.notes && (
                    <div className="p-3 bg-slate-50 rounded-xl text-[11px] font-bold text-slate-400 italic text-center">
                      "{selectedPaiement.notes}"
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Modal d'Affichage & Impression de la Facture PDF */}
      {showFacture && selectedFacturePaiement && (
        <Facture 
          paiement={selectedFacturePaiement}
          enfant={enfantsData.find(e => e.id === selectedFacturePaiement.enfantId)!}
          onClose={() => {
            setShowFacture(false);
            setSelectedFacturePaiement(null);
          }}
        />
      )}
    </div>
  );
}
