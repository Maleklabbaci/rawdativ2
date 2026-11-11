import {
  formatInvoiceStatusLabel,
  formatPaymentMethodLabel,
  hasInvalidFinanceDetails,
  invoicePeriod,
  localizeInvoicePeriodText,
  suspectedInvoiceIds,
} from '../utils/financePeriod';
import FinanceReviewWarning from './FinanceReviewWarning';
import FinanceUnavailable from './FinanceUnavailable';
import ChildHealthJournal from './ChildHealthJournal';
import PickupAuthorizations from './PickupAuthorizations';
import Facture from './Facture';
import { Enfant, Paiement } from '../types';
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
  School,
  Clock,
  Briefcase,
  CreditCard,
  ClipboardList,
  Printer,
  BookHeart,
  Download,
  Eye,
  Loader2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useToast } from '../contexts/ToastContext';
import { useWorkspaceProfile } from '../contexts/WorkspaceProfileContext';
import ParentDailyReportModal from './ParentDailyReportModal';
import DocumentScannerSlot from './DocumentScannerSlot';
import InAppPdfViewerModal, { type InAppPdfViewerSource } from './InAppPdfViewerModal';
import {
  buildCompleteChildDossierPdf,
  triggerDocumentDownload,
  type ChildDocumentKey,
  type StoredChildDocument,
} from '../utils/documentPdf';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../utils/format';

// ✅ Convertit un numéro algérien local (0555 12 34 56) au format international
// requis par WhatsApp (213555123456), sans + ni espaces.
const formatPhoneForWhatsapp = (phone: string) => {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.startsWith('213')) return digitsOnly;
  if (digitsOnly.startsWith('0')) return '213' + digitsOnly.slice(1);
  return '213' + digitsOnly;
};

export default function EnfantDetails({ enfant: initialEnfant, onClose }: { enfant: Enfant, onClose: () => void }) {
  const { language, t } = useLanguage();
  const isArabic = language === 'ar';
  const { user, creche } = useAuth();
  const { showToast } = useToast();
  const { activeProfile, hasPagePermission } = useWorkspaceProfile();
  const hideFinancials = Boolean(activeProfile?.hideFinancials);
  const canEditDossier =
    hasPagePermission('enfants', 'edit') &&
    !(user?.role === 'directeur' && user.approvalStatus === 'pending');

  const {
    enfants: dbEnfants = [],
    updateEnfant,
    presences: dbPresences,
    paiements: dbPaiements,
    repas: dbRepas = [],
    activites: dbActivites = [],
    financialDataReady,
  } = useDb();

  const enfant = dbEnfants.find(e => e.id === initialEnfant.id) || initialEnfant;

  const childPresences = dbPresences.filter(p => p.enfantId === enfant.id);
  const childPaiements = dbPaiements.filter(p => p.enfantId === enfant.id);
  const invalidFinanceCount = childPaiements.filter(hasInvalidFinanceDetails).length;

  const [activeTab, setActiveTab] = useState<'info' | 'presences' | 'paiements' | 'retrait' | 'sante'>('info');
  const [invoiceToPrint, setInvoiceToPrint] = useState<Paiement | null>(null);
  const [showDailyReport, setShowDailyReport] = useState(false);
  const [exportingDossier, setExportingDossier] = useState(false);
  const [dossierPdfPreview, setDossierPdfPreview] = useState<InAppPdfViewerSource | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (invoiceToPrint) setInvoiceToPrint(null);
      else onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [invoiceToPrint, onClose]);
  const documentsRequis = {
    certificatMedical: false,
    carnetVaccination: false,
    justificatifDomicile: false,
    photoIdentite: false,
    ...(enfant.documentsRequis || {}),
  };
  const documentsFichiers = enfant.documentsFichiers || {};

  const handleUpdateChildDocument = async (
    key: ChildDocumentKey,
    nextDoc: StoredChildDocument | undefined
  ) => {
    if (!canEditDossier || typeof updateEnfant !== 'function') return;
    const nextFiles = { ...documentsFichiers };
    if (nextDoc) {
      nextFiles[key] = nextDoc;
    } else {
      delete nextFiles[key];
    }
    const nextRequis = {
      ...documentsRequis,
      [key]: Boolean(nextDoc),
    };
    try {
      await updateEnfant(enfant.id, {
        documentsRequis: nextRequis,
        documentsFichiers: nextFiles,
      });
      showToast(
        isArabic
          ? nextDoc
            ? 'تم حفظ الوثيقة بصيغة PDF في ملف الطفل.'
            : 'تمت إزالة الوثيقة من الملف.'
          : nextDoc
            ? 'Pièce convertie en PDF et enregistrée dans le dossier.'
            : 'Pièce retirée du dossier.',
        'success'
      );
    } catch {
      showToast(
        isArabic
          ? 'تعذر حفظ الوثيقة في ملف الطفل.'
          : 'Impossible d’enregistrer cette pièce sur le serveur.',
        'error'
      );
    }
  };

  const handleExportCompleteDossier = async (mode: 'preview' | 'download' = 'preview') => {
    if (exportingDossier) return;
    setExportingDossier(true);
    try {
      const { bytes, fileName, pageCount } = await buildCompleteChildDossierPdf(enfant, {
        crecheNom: creche?.nom || user?.nomCreche,
      });
      if (mode === 'download') {
        triggerDocumentDownload(bytes, fileName);
        showToast(
          isArabic
            ? 'تم تصدير الملف الإداري الكامل بصيغة PDF.'
            : 'Dossier administratif complet téléchargé en PDF.',
          'success'
        );
      } else {
        setDossierPdfPreview({
          title: isArabic
            ? `الملف الإداري الكامل — ${enfant.prenom} ${enfant.nom}`
            : `Dossier administratif complet (DAS) — ${enfant.prenom} ${enfant.nom}`,
          fileName,
          mimeType: 'application/pdf',
          bytes,
          pageCount,
        });
      }
    } catch {
      showToast(
        isArabic
          ? 'تعذر إنشاء ملف PDF الكامل.'
          : 'Impossible de générer le PDF complet du dossier.',
        'error'
      );
    } finally {
      setExportingDossier(false);
    }
  };

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

  const calculerAge = (dateString: string) => {
    if (!dateString) return '';
    const birth = new Date(dateString);
    const now = new Date();
    let ans = now.getFullYear() - birth.getFullYear();
    let mois = now.getMonth() - birth.getMonth();
    
    if (mois < 0 || (mois === 0 && now.getDate() < birth.getDate())) {
      ans--;
      mois += 12;
    }
    
    if (ans <= 0) return isArabic ? `${mois} شهر` : `${mois} mois`;
    return isArabic ? `${ans} سنة و ${mois} شهر` : `${ans} an(s) et ${mois} mois`;
  };

  return (
    <div 
      className="fixed inset-0 z-[999] flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/70 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-lg sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl cursor-default sm:mt-16 sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-4 text-white flex justify-between items-start gap-3 flex-shrink-0 sm:p-6 ${
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
              <h2 className="break-words text-xl font-black tracking-tight sm:text-2xl">{enfant.prenom} {enfant.nom}</h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {enfant.statut === 'Inactif' && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2.5 flex-shrink-0">
            <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs font-bold text-amber-700">
              {isArabic
                ? `تم تسجيل خروجه بتاريخ ${enfant.dateSortie || '—'}${enfant.motifSortie ? ' — السبب: ' + enfant.motifSortie : ''}`
                : `Sorti(e) le ${enfant.dateSortie || '—'}${enfant.motifSortie ? ' — Motif : ' + enfant.motifSortie : ''}`}
            </p>
          </div>
        )}

        <div
          className={`grid flex-shrink-0 gap-1 border-b border-slate-100 bg-slate-50/90 p-1.5 sm:flex sm:flex-wrap ${
            hideFinancials ? 'grid-cols-2' : 'grid-cols-3'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`min-h-9! rounded-xl px-2 sm:px-3.5 py-2 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer sm:flex-1 ${
              activeTab === 'info'
                ? 'bg-white text-indigo-700 shadow-2xs ring-1 ring-inset ring-slate-200/80'
                : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate sm:hidden">{isArabic ? 'الملف' : 'Fiche'}</span>
            <span className="hidden sm:inline">{isArabic ? 'الملف الطبي والشخصي' : 'Fiche Personnelle & Médicale'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sante')}
            className={`min-h-9! rounded-xl px-2 sm:px-3.5 py-2 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer sm:flex-1 ${
              activeTab === 'sante'
                ? 'bg-white text-indigo-700 shadow-2xs ring-1 ring-inset ring-slate-200/80'
                : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isArabic ? 'سجل الصحة' : 'Suivi santé'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('retrait')}
            className={`min-h-9! rounded-xl px-2 sm:px-3.5 py-2 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer sm:flex-1 ${
              activeTab === 'retrait'
                ? 'bg-white text-indigo-700 shadow-2xs ring-1 ring-inset ring-slate-200/80'
                : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isArabic ? 'الاستلام' : 'Retrait'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('presences')}
            className={`min-h-9! rounded-xl px-2 sm:px-3.5 py-2 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer sm:flex-1 ${
              activeTab === 'presences'
                ? 'bg-white text-indigo-700 shadow-2xs ring-1 ring-inset ring-slate-200/80'
                : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isArabic ? 'متابعة الحضور' : 'Présences'}</span>
            {childPresences.length > 0 && (
              <span className="shrink-0 bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px] tabular-nums">
                {childPresences.length}
              </span>
            )}
          </button>

          {!hideFinancials && (
            <button
              type="button"
              onClick={() => setActiveTab('paiements')}
              className={`min-h-9! col-span-2 sm:col-span-1 rounded-xl px-2 sm:px-3.5 py-2 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer sm:flex-1 ${
                activeTab === 'paiements'
                  ? 'bg-white text-indigo-700 shadow-2xs ring-1 ring-inset ring-slate-200/80'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t('children.paymentsTab')}</span>
              {childPaiements.length > 0 && (
                <span className="shrink-0 bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px] tabular-nums">
                  {childPaiements.length}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {activeTab === 'retrait' && <motion.div key="retrait-tab"><PickupAuthorizations childId={enfant.id} /></motion.div>}
            {activeTab === 'sante' && <motion.div key="sante-tab"><ChildHealthJournal childId={enfant.id} /></motion.div>}
            {activeTab === 'info' && (
              <motion.div
                key="info-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
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

                <div className="space-y-5">
                  <div className="p-5 bg-rose-50/20 border border-rose-100/50 rounded-2xl space-y-4">
                    <h3 className="text-xs font-black text-rose-700 uppercase tracking-widest flex items-center gap-2">
                      <Activity className="w-4 h-4 text-rose-500" />
                      {isArabic ? 'الصحة والمؤشرات الفسيولوجية' : 'Santé & Allergies'}
                    </h3>

                    <div className="space-y-3.5 text-xs font-semibold text-slate-600">
                      <div className="flex justify-between items-center py-1 border-b border-rose-100/20">
                        <span>{isArabic ? 'تاريخ الولادة:' : 'Naissance:'}</span>
                        <span className="text-slate-800 font-bold">{birthDate} ({calculerAge(enfant.dateNaissance)})</span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-rose-100/20">
                        <span>{isArabic ? 'فصيلة الدم:' : 'Groupe Sanguin:'}</span>
                        <span className="bg-rose-500 text-white font-black px-2 py-0.5 rounded text-[10px]">{enfant.groupeSanguin || 'Non renseigné'}</span>
                      </div>

                      <div>
                        <span className="block text-slate-400 mb-1.5">{isArabic ? 'تحذير الحساسية:' : 'Allergies Majeures:'}</span>
                        {enfant.allergie?.trim() ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-500/10 text-rose-700 rounded-xl font-bold border border-rose-200">
                            <ShieldAlert className="w-4 h-4 text-rose-600" />
                            {enfant.allergie}
                          </span>
                        ) : (
                          <span className="inline-block text-slate-400 italic">{isArabic ? 'الحساسية غير مسجلة — تحقق قبل تقديم الطعام.' : 'Allergies non renseignées — à vérifier avant le repas.'}</span>
                        )}
                      </div>

                      {enfant.regimeAlimentaire && (
                        <div className="pt-2">
                          <span className="block text-slate-400 mb-1">{isArabic ? 'حمية غذائية مخصوصة:' : 'Régime Alimentaire Spécial:'}</span>
                          <span className="font-extrabold text-slate-800 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200/50 text-[11px] block">{enfant.regimeAlimentaire}</span>
                        </div>
                      )}

                      {(enfant.medecinTraitant || enfant.poidsKg || enfant.vaccinations || enfant.notesMedicales) && (
                        <div className="pt-2 space-y-2">
                          {enfant.medecinTraitant && (
                            <div className="flex justify-between gap-3"><span className="text-slate-400">{isArabic ? 'الطبيب المعالج:' : 'Médecin traitant :'}</span><span className="text-slate-800 font-bold text-end">{enfant.medecinTraitant}</span></div>
                          )}
                          {enfant.poidsKg && (
                            <div className="flex justify-between gap-3"><span className="text-slate-400">{isArabic ? 'الوزن:' : 'Poids :'}</span><span className="text-slate-800 font-bold">{enfant.poidsKg} {isArabic ? 'كلغ' : 'kg'}</span></div>
                          )}
                          {enfant.vaccinations && (
                            <div><span className="block text-slate-400 mb-1">{isArabic ? 'التلقيحات:' : 'Vaccinations :'}</span><span className="block text-slate-800 font-bold bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-100/50">{enfant.vaccinations}</span></div>
                          )}
                          {enfant.notesMedicales && (
                            <div><span className="block text-slate-400 mb-1">{isArabic ? 'ملاحظات طبية:' : 'Notes médicales :'}</span><span className="block text-slate-800 font-semibold bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-100/50">{enfant.notesMedicales}</span></div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 bg-indigo-50/20 border border-indigo-100/50 rounded-2xl space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                        <FileCheck className="w-4 h-4 shrink-0 text-indigo-500" />
                        <span>{isArabic ? 'الملف الإداري والوثائق (PDF)' : 'Dossier Administratif (PDF)'}</span>
                      </h3>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={exportingDossier}
                          onClick={() => void handleExportCompleteDossier('preview')}
                          className="inline-flex min-h-0 items-center gap-1.5 rounded-xl bg-[#25434c] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#1c343b] disabled:opacity-50 cursor-pointer"
                        >
                          {exportingDossier ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                          <span>{isArabic ? 'معاينة الملف الكامل PDF' : 'Voir le dossier PDF'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={exportingDossier}
                          onClick={() => void handleExportCompleteDossier('download')}
                          title={isArabic ? 'تحميل الملف الكامل PDF' : 'Télécharger le dossier complet PDF'}
                          aria-label={isArabic ? 'تحميل الملف الكامل PDF' : 'Télécharger le dossier complet PDF'}
                          className="inline-flex min-h-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 text-[#25434c] hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {([
                        ['certificatMedical', isArabic ? 'شهادة الكفاءة الطبية' : 'Certificat médical'],
                        ['carnetVaccination', isArabic ? 'دفتر التلقيحات للأطفال' : 'Carnet de vaccination'],
                        ['justificatifDomicile', isArabic ? 'إثبات إقامة الأولياء' : 'Justificatif de domicile'],
                        ['photoIdentite', isArabic ? 'صور شمسية للهوية' : "Photo d'identité"],
                      ] as Array<[ChildDocumentKey, string]>).map(([docKey, docLabel]) => (
                        <DocumentScannerSlot
                          key={docKey}
                          docKey={docKey}
                          label={docLabel}
                          isArabic={isArabic}
                          childName={`${enfant.prenom} ${enfant.nom}`.trim()}
                          value={documentsFichiers[docKey]}
                          declaredWithoutFile={Boolean(documentsRequis[docKey] && !documentsFichiers[docKey])}
                          readOnly={!canEditDossier}
                          onError={msg => showToast(msg, 'error')}
                          onChange={
                            canEditDossier
                              ? nextDoc => {
                                  void handleUpdateChildDocument(docKey, nextDoc);
                                }
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>

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
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-2 font-bold text-slate-700">
                              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                              <span>{parent.telephone}</span>
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {parent.telephone && (
                                <a
                                  href={`tel:${parent.telephone}`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[11px] transition flex-shrink-0"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                  {isArabic ? 'اتصال' : 'Appeler'}
                                </a>
                              )}
                              <a
                                href={`https://wa.me/${formatPhoneForWhatsapp(parent.telephone)}?text=${encodeURIComponent(
                                  isArabic
                                    ? `مرحباً ${parent.prenom}، هذه رسالة من ${creche?.nom || 'الروضة'} بخصوص ${enfant.prenom}.`
                                    : `Bonjour ${parent.prenom}, ceci est un message de ${creche?.nom || 'la crèche'} concernant ${enfant.prenom}.`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg font-bold text-[11px] transition flex-shrink-0"
                                title={isArabic ? 'إرسال رسالة واتساب' : 'Envoyer un message WhatsApp'}
                              >
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                                </svg>
                                {isArabic ? 'واتساب' : 'WhatsApp'}
                              </a>
                            </div>
                          </div>

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

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                    {isArabic ? 'سجل الحضور والغياب المفصل' : 'Index Chronologique des Présences'}
                  </h4>

                  {childPresences.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 italic text-xs">
                      {isArabic ? 'لا توجد سجلات حضور مسجلة حالياً لهذا الطفل' : 'Aucun rapport d’assiduité n’a été enregistré pour cet élève dans la base de données.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pe-1">
                      {[...childPresences]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((p) => (
                          <div key={p.id} className="py-3 flex justify-between items-center gap-2 text-xs">
                            <span className="font-bold text-slate-700 flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {new Date(p.date).toLocaleDateString(isArabic ? 'ar' : 'fr-FR', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase shrink-0 ${
                              p.statut === 'Présent' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : p.statut === 'Absent justifié'
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {p.statut === 'Présent'
                                ? (isArabic ? 'حاضر' : 'Présent')
                                : p.statut === 'Absent justifié'
                                ? (isArabic ? 'غائب مبرر' : 'Absent justifié')
                                : (isArabic ? 'غائب غير مبرر' : 'Absent non justifié')}
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
                {!financialDataReady ? <FinanceUnavailable /> : <>
                <FinanceReviewWarning count={childPaiements.filter(p => !p.periodeCle).length} suspected={suspectedInvoiceIds(childPaiements).size} invalid={invalidFinanceCount} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 bg-emerald-50/40 border border-emerald-100 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-white shadow-xs rounded-xl text-emerald-600 shrink-0">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-emerald-700 uppercase">{isArabic ? 'إجمالي الفواتير المسجلة مدفوعة' : 'Total des factures marquées payées'}</p>
                      <p className="text-xl font-black text-slate-800 mt-0.5 break-words">
                        {invalidFinanceCount ? '—' : formatCurrency(childPaiements.filter(p => p.statut === 'Payé').reduce((sum, p) => sum + p.montant, 0))}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 bg-amber-50/40 border border-amber-100 rounded-2xl flex items-center gap-4">
                    <div className="p-3 bg-white shadow-xs rounded-xl text-amber-600 shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-amber-700 uppercase">{isArabic ? 'المستحقات غير المدفوعة' : 'Facturation en suspens'}</p>
                      <p className="text-xl font-black text-slate-800 mt-0.5 break-words">
                        {invalidFinanceCount ? '—' : formatCurrency(childPaiements.filter(p => p.statut !== 'Payé').reduce((sum, p) => sum + p.montant, 0))}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                    {isArabic ? 'سجل الفواتير والمدفوعات' : 'Historique des factures enregistrées'}
                  </h4>
                  <p className="text-[11px] font-semibold text-amber-800 mb-4">
                    {isArabic ? 'الحالات المسجلة تصريحية ولا تُعد وصل قبض.' : 'Les statuts enregistrés sont déclaratifs et ne constituent pas un reçu d’encaissement.'}
                  </p>

                  {childPaiements.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 italic text-xs">
                      {isArabic ? 'لا توجد فواتير أو سجلات دفع لهذا الطفل' : 'Aucune écriture de facturation n’a été enregistrée pour cet élève.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pe-1">
                      {[...childPaiements]
                        .sort((a, b) => (b.periodeCle || b.moisConcerne || '').localeCompare(a.periodeCle || a.moisConcerne || ''))
                        .map((p: any) => (
                          <div key={p.id} className="py-3 flex flex-wrap justify-between items-center gap-3 text-xs">
                            <div className="space-y-0.5 min-w-0">
                              <p className="font-extrabold text-slate-800">
                                {isArabic ? 'الفترة:' : 'Période :'} {localizeInvoicePeriodText(invoicePeriod(p), isArabic)}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold break-all">
                                {isArabic ? 'المعرّف:' : 'Réf. :'} {p.id.slice(0, 12)}
                                {p.statut === 'Payé' && p.moyenPaiement ? ` · ${formatPaymentMethodLabel(p.moyenPaiement, isArabic)}` : ''}
                                {p.statut !== 'Payé' && p.dateEcheance ? ` · ${isArabic ? 'الاستحقاق' : 'Échéance'} ${p.dateEcheance}` : ''}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <span className="font-black text-slate-900">{typeof p.montant === 'number' && Number.isFinite(p.montant) ? formatCurrency(p.montant) : '—'}</span>
                              <span className={`px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase ${
                                p.statut === 'Payé'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : p.statut === 'En attente'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : 'bg-rose-50 text-rose-700 border border-rose-100'
                              }`}>
                                {formatInvoiceStatusLabel(p.statut, isArabic)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setInvoiceToPrint(p)}
                                aria-label={isArabic ? 'طباعة الفاتورة أو تصديرها' : 'Imprimer ou exporter la facture'}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5 text-indigo-600" />
                                {isArabic ? 'طباعة' : 'PDF'}
                              </button>
                            </div>
                          </div>
                      ))}
                    </div>
                  )}
                </div>
                </>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-3.5 sm:p-5 border-t border-slate-100 bg-slate-50 grid grid-cols-2 sm:flex sm:items-center sm:justify-between gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowDailyReport(true)}
            className="min-h-10! inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold rounded-xl transition cursor-pointer text-xs min-w-0"
          >
            <BookHeart className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate sm:hidden">{isArabic ? 'دفتر اليوم' : 'Carnet du jour'}</span>
            <span className="hidden sm:inline">{isArabic ? 'دفتر اليوم للأولياء' : 'Carnet de liaison du jour'}</span>
          </button>
          <button
            type="button"
            className="min-h-10! inline-flex items-center justify-center px-3 sm:px-6 py-2.5 bg-slate-200/90 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer text-xs min-w-0"
            onClick={onClose}
          >
            <span className="truncate sm:hidden">{isArabic ? 'إغلاق' : 'Fermer'}</span>
            <span className="hidden sm:inline">{isArabic ? 'إغلاق ملف التلميذ' : "Fermer le dossier de l'élève"}</span>
          </button>
        </div>
      </motion.div>
      {invoiceToPrint && (
        <Facture
          paiement={invoiceToPrint}
          enfant={enfant}
          onClose={() => setInvoiceToPrint(null)}
        />
      )}
      {showDailyReport && (() => {
        const now = new Date();
        const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const latestPresence =
          childPresences.find(p => p.date === todayIso) ||
          [...childPresences].sort((a, b) => b.date.localeCompare(a.date))[0] ||
          null;
        return (
          <ParentDailyReportModal
            enfant={enfant}
            date={latestPresence?.date || todayIso}
            presence={latestPresence}
            repasList={dbRepas}
            activitesList={dbActivites}
            creche={creche}
            isArabic={isArabic}
            onClose={() => setShowDailyReport(false)}
          />
        );
      })()}
      {dossierPdfPreview && (
        <InAppPdfViewerModal
          documentSource={dossierPdfPreview}
          isArabic={isArabic}
          onClose={() => setDossierPdfPreview(null)}
        />
      )}
    </div>
  );
}
