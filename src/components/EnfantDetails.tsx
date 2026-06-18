import { Enfant } from '../types';
import { 
  X, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  FileCheck, 
  Activity, 
  ShieldAlert, 
  Heart,
  School,
  Clock,
  Briefcase,
  CheckCircle,
  XCircle,
  CreditCard,
  ClipboardList
} from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useDb } from '../contexts/DbContext';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../utils/format';

export default function EnfantDetails({ enfant, onClose }: { enfant: Enfant, onClose: () => void }) {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  
  const { presences: dbPresences, paiements: dbPaiements } = useDb();
  
  // Filter data specifically linked to this child
  const childPresences = dbPresences.filter(p => p.enfantId === enfant.id);
  const childPaiements = dbPaiements.filter(p => p.enfantId === enfant.id);
  
  const [activeTab, setActiveTab] = useState<'info' | 'presences' | 'paiements'>('info');

  // Format date readable
  const birthDate = new Date(enfant.dateNaissance).toLocaleDateString(isArabic ? 'ar' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const enrollDate = new Date(enfant.dateInscription).toLocaleDateString(isArabic ? 'ar' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div 
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-center justify-center z-[999] p-4 font-sans cursor-pointer"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-2xl max-h-[85vh] mt-16 flex flex-col overflow-hidden cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Colorful header band based on gender with badge */}
        <div className={`p-6 text-white flex justify-between items-center flex-shrink-0 ${
          enfant.genre === 'Fille' 
            ? 'bg-gradient-to-r from-pink-500 via-pink-600 to-rose-600' 
            : 'bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-600'
        }`}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md text-white font-black text-2xl flex items-center justify-center shadow-lg border border-white/10">
              {enfant.prenom[0]}{enfant.nom[0]}
            </div>
            <div>
              <p className="text-xs text-white/80 font-bold uppercase tracking-widest leading-none mb-1">
                {isArabic ? 'ملف التلميذ' : 'Dossier Scolaire Individuel'}
              </p>
              <h2 className="text-2xl font-black tracking-tight">{enfant.prenom} {enfant.nom}</h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection Row */}
        <div className="flex border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-4 text-xs sm:text-sm font-black flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'info'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>{isArabic ? 'الملف الطبي والشخصي' : 'Fiche Personnelle & Médicale'}</span>
          </button>
          
          <button
            onClick={() => setActiveTab('presences')}
            className={`flex-1 py-4 text-xs sm:text-sm font-black flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'presences'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{isArabic ? 'متابعة الحضور' : 'Présences'}</span>
            {childPresences.length > 0 && (
              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full text-[10px]">
                {childPresences.length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('paiements')}
            className={`flex-1 py-4 text-xs sm:text-sm font-black flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'paiements'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{isArabic ? 'تقرير الدفع والاشتراك' : 'Invoices & Paiements'}</span>
            {childPaiements.length > 0 && (
              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full text-[10px]">
                {childPaiements.length}
              </span>
            )}
          </button>
        </div>

        {/* Core content scrollable */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {activeTab === 'info' && (
              <motion.div
                key="info-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Quick Vital Tags */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isArabic ? 'الفئة العمرية' : 'Section'}</span>
                    <p className="text-sm font-black text-slate-800 mt-1 flex items-center gap-1.5">
                      <School className="w-4 h-4 text-indigo-500" />
                      {enfant.groupeAge}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isArabic ? 'الجنس' : 'Famille'}</span>
                    <p className="text-sm font-black text-slate-800 mt-1">
                      {enfant.genre === 'Fille' ? (isArabic ? 'أنثى' : 'Fille') : (isArabic ? 'ذكر' : 'Garçon')}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl col-span-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isArabic ? 'تاريخ التسجيل بالروضة' : 'Date d\'Admission'}</span>
                    <p className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {enrollDate}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Health & Medical Information Block */}
                  <div className="p-5 bg-rose-50/20 border border-rose-100/50 rounded-2xl space-y-4">
                    <h3 className="text-xs font-black text-rose-700 uppercase tracking-widest flex items-center gap-2">
                      <Activity className="w-4 h-4 text-rose-500" />
                      {isArabic ? 'الصحة والمؤشرات الفسيولوجية' : 'Santé & Allergies'}
                    </h3>

                    <div className="space-y-3.5 text-xs font-semibold text-slate-600">
                      <div className="flex justify-between items-center py-1 border-b border-rose-100/20">
                        <span>{isArabic ? 'تاريخ الولادة:' : 'Naissance:'}</span>
                        <span className="text-slate-800 font-bold">{birthDate}</span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-rose-100/20">
                        <span>{isArabic ? 'فصيلة الدم:' : 'Groupe Sanguin:'}</span>
                        <span className="bg-rose-500 text-white font-black px-2 py-0.5 rounded text-[10px]">O+</span>
                      </div>

                      <div>
                        <span className="block text-slate-400 mb-1.5">{isArabic ? 'تحذير الحساسية:' : 'Allergies Majeures:'}</span>
                        {enfant.allergie ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-500/10 text-rose-700 rounded-xl font-bold border border-rose-200">
                            <ShieldAlert className="w-4 h-4 text-rose-600" />
                            {enfant.allergie}
                          </span>
                        ) : (
                          <span className="inline-block text-slate-400 italic">Aucune allergie critique rapportée.</span>
                        )}
                      </div>

                      {enfant.regimeAlimentaire && (
                        <div className="pt-2">
                          <span className="block text-slate-400 mb-1">{isArabic ? 'حمية غذائية مخصوصة:' : 'Régime Alimentaire Spécial:'}</span>
                          <span className="font-extrabold text-slate-800 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200/50 text-[11px] block">{enfant.regimeAlimentaire}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dossier progress checker */}
                  <div className="p-5 bg-indigo-50/20 border border-indigo-100/50 rounded-2xl space-y-4">
                    <h3 className="text-xs font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-indigo-500" />
                      {isArabic ? 'الملف الطبي والتراخيص' : 'Dossier Administratif'}
                    </h3>

                    <div className="space-y-3">
                      {[
                        { label: "Certificat d'Aptitude Médicale", icon: FileCheck, status: enfant.documentsRequis.certificatMedical },
                        { label: "Carnet de Vaccination Pédiatrique", icon: FileCheck, status: enfant.documentsRequis.carnetVaccination },
                        { label: "Justificatif d'Adresse Parentale", icon: FileCheck, status: enfant.documentsRequis.justificatifDomicile },
                        { label: "Fiches Photos d'Identité Admis", icon: FileCheck, status: enfant.documentsRequis.photoIdentite },
                      ].map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs font-semibold p-2.5 bg-white border border-slate-100 rounded-xl">
                          <span className="text-slate-700 truncate">{doc.label}</span>
                          <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider ${
                            doc.status 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50' 
                              : 'bg-rose-50 text-rose-700 border border-rose-100/50'
                          }`}>
                            {doc.status ? 'OK' : 'Manquant'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Parents / Emergency contact details */}
                <div className="border-t border-slate-150 pt-5">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                    <User className="text-indigo-500 w-4.5 h-4.5" />
                    {isArabic ? 'أولياء الأمور وجهات الاتصال' : 'Contacts d\'Urgence des Parents Rattachés'}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {enfant.parents.map((parent) => (
                      <div key={parent.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-black text-indigo-700 uppercase bg-indigo-50 px-2 py-0.5 rounded">
                              {parent.lien}
                            </span>
                            <h4 className="font-extrabold text-slate-900 mt-1">{parent.prenom} {parent.nom}</h4>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs font-semibold text-slate-600">
                          <a href={`tel:${parent.telephone}`} className="flex items-center gap-2 hover:text-indigo-600 transition">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span>{parent.telephone}</span>
                          </a>

                          {parent.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-slate-400" />
                              <span className="truncate">{parent.email}</span>
                            </div>
                          )}

                          {parent.profession && (
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-slate-400" />
                              <span>{parent.profession}</span>
                            </div>
                          )}

                          {parent.adresse && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              <span className="leading-tight">{parent.adresse}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'presences' && (
              <motion.div
                key="presences-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Stats cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-emerald-700 uppercase">{isArabic ? 'نسبة الحضور المتراكمة' : 'Taux d’Assiduité'}</p>
                    <p className="text-2xl font-black text-emerald-800 mt-1">
                      {childPresences.length > 0 
                        ? `${Math.round((childPresences.filter(p => p.statut === 'Présent').length / childPresences.length) * 100)}%`
                        : '100%'
                      }
                    </p>
                  </div>
                  <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-indigo-700 uppercase">{isArabic ? 'إجمالي الأيام المسجلة' : 'Total Jours Suivis'}</p>
                    <p className="text-2xl font-black text-indigo-800 mt-1">{childPresences.length}</p>
                  </div>
                  <div className="p-4 bg-rose-50/40 border border-rose-100 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-rose-700 uppercase">{isArabic ? 'الغيابات غير المبررة' : 'Absences non justifiées'}</p>
                    <p className="text-2xl font-black text-rose-800 mt-1">
                      {childPresences.filter(p => p.statut === 'Absent non justifié').length}
                    </p>
                  </div>
                </div>

                {/* Presence timeline */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                    {isArabic ? 'سجل الحضور والغياب المفصل' : 'Index Chronologique des Présences'}
                  </h4>

                  {childPresences.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 italic text-xs">
                      {isArabic ? 'لا توجد سجلات حضور مسجلة حالياً لهدا الطفل' : 'Aucun rapport d’assiduité n’a été enregistré pour cet élève dans la base de données.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-1">
                      {[...childPresences]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((p) => (
                          <div key={p.id} className="py-3 flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-700 flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-slate-450" />
                              {new Date(p.date).toLocaleDateString(isArabic ? 'ar' : 'fr-FR', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase ${
                              p.statut === 'Présent' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : p.statut === 'Absent justifié'
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {p.statut === 'Présent' ? (isArabic ? 'حاضر' : 'Présent') : (isArabic ? 'غائب مبرر' : 'Excuzé')}
                            </span>
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'paiements' && (
              <motion.div
                key="paiements-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Billing Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 bg-emerald-50/40 border border-emerald-100 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-white shadow-xs rounded-xl text-emerald-600">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-emerald-700 uppercase">{isArabic ? 'إجمالي المبالغ المدفوعة' : 'Total Frais Réglés'}</p>
                      <p className="text-xl font-black text-slate-800 mt-0.5">
                        {formatCurrency(childPaiements.filter(p => p.statut === 'Payé').reduce((sum, p) => sum + p.montant, 0))}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 bg-amber-50/40 border border-amber-100 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-white shadow-xs rounded-xl text-amber-600">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-amber-700 uppercase">{isArabic ? 'المستحقات غير المدفوعة' : 'Facturation en suspens'}</p>
                      <p className="text-xl font-black text-slate-800 mt-0.5">
                        {formatCurrency(childPaiements.filter(p => p.statut !== 'Payé').reduce((sum, p) => sum + p.montant, 0))}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Billing log list */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                    {isArabic ? 'سجل الفواتير والمدفوعات الشهري' : 'Historique Mensuel des Règlement Scolaires'}
                  </h4>

                  {childPaiements.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 italic text-xs">
                      {isArabic ? 'لا توجد فواتير أو سجلات دفع لهذا الطفل' : 'Aucune écriture comptable d’abonnement scolaire n’a été enregistrée pour cet élève.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-1">
                      {[...childPaiements]
                        .sort((a, b) => b.moisConcerne.localeCompare(a.moisConcerne))
                        .map((p) => (
                          <div key={p.id} className="py-3 flex justify-between items-center text-xs">
                            <div className="space-y-0.5">
                              <p className="font-extrabold text-slate-800">
                                {isArabic ? 'اشتراك شهر:' : 'Abonnement Mensuel de'} {p.moisConcerne}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold">
                                {isArabic ? 'رمز الدفع:' : 'ID Facture:'} {p.id.slice(0, 8)}...
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-black text-slate-900">{formatCurrency(p.montant)}</span>
                              <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase ${
                                p.statut === 'Payé'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : p.statut === 'En attente'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : 'bg-rose-50 text-rose-700 border border-rose-100'
                              }`}>
                                {p.statut === 'Payé' ? (isArabic ? 'مدفوع' : 'Payé') : p.statut === 'En attente' ? (isArabic ? 'قيد الانتظار' : 'Attente') : (isArabic ? 'متأخر' : 'Retard')}
                              </span>
                            </div>
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal close button footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end flex-shrink-0">
          <button 
            type="button"
            className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold rounded-xl transition cursor-pointer text-xs"
            onClick={onClose}
          >
            {isArabic ? 'إغلاق ملف التلميذ' : "Fermer le dossier de l'élève"}
          </button>
        </div>


      </motion.div>
    </div>
  );
}
