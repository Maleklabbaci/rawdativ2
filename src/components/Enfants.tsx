import { takeSetupTask } from '../utils/onboardingTask';
import { importBatches } from '../utils/importBatches';
import {
  buildChildrenImportTemplateCsv,
  isXlsxFile,
  parseDelimitedSpreadsheetText,
  parseXlsxRows,
} from '../utils/spreadsheetParser';
import { updatePrimaryParent } from '../utils/childProfile';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Baby, 
  Search, 
  Plus, 
  Filter, 
  X, 
  User, 
  Heart, 
  FileText, 
  ShieldAlert, 
  Phone, 
  Mail, 
  Calendar,
  Briefcase,
  MapPin,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  HeartCrack,
  Activity,
  Pencil,
  Trash2,
  List,
  LayoutGrid,
  LogOut,
  MessageCircle,
  RotateCcw,
  QrCode,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { Enfant, InscriptionLink } from '../types';
import EnfantDetails from './EnfantDetails';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { useWorkspaceProfile } from '../contexts/WorkspaceProfileContext';
import DocumentScannerSlot from './DocumentScannerSlot';
import type { StoredChildDocument } from '../utils/documentPdf';
import { motion, AnimatePresence } from 'motion/react';
import { normalizeTelHref, normalizeWhatsAppNumber, useIsMobileViewport } from '../hooks/useMobileViewport';
import * as QRCode from 'qrcode';

type DocumentKey = 'certificatMedical' | 'carnetVaccination' | 'justificatifDomicile' | 'photoIdentite';
type DocumentUpload = StoredChildDocument;

const DEFAULT_DOCUMENTS_REQUIS: Record<DocumentKey, boolean> = {
  certificatMedical: false,
  carnetVaccination: false,
  justificatifDomicile: false,
  photoIdentite: false,
};

type ImportChildDraft = {
  nom: string;
  prenom: string;
  dateNaissance: string;
  genre: 'Garçon' | 'Fille';
  groupeAge: 'Bébés' | 'Moyens' | 'Grands';
  parentNom: string;
  parentPrenom: string;
  parentTelephone: string;
  parentEmail: string;
};

type ImportPreviewRow = {
  rowNumber: number;
  draft: ImportChildDraft;
  missing: string[];
  warnings: string[];
  invalid: boolean;
};

type ImportPreview = {
  fileName: string;
  separator: string;
  totalRows: number;
  headers: string[];
  columnMap: string[];
  rows: ImportPreviewRow[];
};

type ImportResult = {
  fileName: string;
  imported: number;
  incomplete: number;
  skipped: number;
  rows: ImportPreviewRow[];
  failed: ImportPreviewRow[];
  notAttempted: number;
};

const normalizeImportHeader = (value: string) => value
  .replace(/^\uFEFF/, '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\u0600-\u06ff]/g, '');

const normalizeImportValue = (value: string) => value.replace(/^\uFEFF/, '').trim();

const normalizeImportDate = (value: string) => {
  const raw = normalizeImportValue(value);
  if (!raw) return '';
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }
  if (/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}$/.test(raw)) {
    const [first, second, year] = raw.split(/[\/.\-]/).map(Number);
    const day = second > 12 ? second : first;
    const month = second > 12 ? first : second;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }
  const serial = Number(raw.replace(',', '.'));
  if (Number.isFinite(serial) && serial > 20000 && serial < 70000) {
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};

const normalizeImportGender = (value: string): 'Garçon' | 'Fille' => {
  const normalized = normalizeImportHeader(value);
  return ['fille', 'female', 'girl', 'f', 'انثى', 'بنت'].some(token => normalized.includes(token)) ? 'Fille' : 'Garçon';
};

const normalizeImportGroup = (value: string): 'Bébés' | 'Moyens' | 'Grands' => {
  const normalized = normalizeImportHeader(value);
  if (['grand', 'grands', 'older', 'preschool', 'كبر'].some(token => normalized.includes(token))) return 'Grands';
  if (['moyen', 'moyens', 'middle', 'toddler', 'متوسط'].some(token => normalized.includes(token))) return 'Moyens';
  return 'Bébés';
};

const createImportId = (prefix: string, rowNumber: number) => {
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${rowNumber}_${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}_${randomId}`;
};

function getDocumentsRequis(enfant?: Partial<Enfant> | null): Record<DocumentKey, boolean> {
  const documents = enfant?.documentsRequis;
  const source = documents && typeof documents === 'object' && !Array.isArray(documents)
    ? documents as Partial<Record<DocumentKey, unknown>>
    : {};
  return {
    certificatMedical: source.certificatMedical === true,
    carnetVaccination: source.carnetVaccination === true,
    justificatifDomicile: source.justificatifDomicile === true,
    photoIdentite: source.photoIdentite === true,
  };
}

const DIRECTORY_PAGE_STEP = 50;
const DOCUMENT_KEYS: DocumentKey[] = [
  'certificatMedical',
  'carnetVaccination',
  'justificatifDomicile',
  'photoIdentite',
];

function getCompletedDocsCount(enfant: Enfant): number {
  const req = getDocumentsRequis(enfant);
  const files = enfant.documentsFichiers || {};
  return DOCUMENT_KEYS.reduce(
    (acc, key) => acc + (req[key] || Boolean(files[key]?.contenu) ? 1 : 0),
    0,
  );
}

export default function Enfants() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();

  const {
    enfants: allEnfants,
    addEnfant,
    updateEnfant,
    inscriptionLinks,
    demandesAdmission,
    decideAdmission,
  } = useDb();
  const { user } = useAuth();
  const { hasPagePermission } = useWorkspaceProfile();
  const canEditChildren = hasPagePermission('enfants', 'edit');
  const canManageAdmissions = hasPagePermission('admissions', 'links') || hasPagePermission('admissions', 'decide');
  const isDirecteur = user?.role === 'directeur';
  const enfants = useMemo(
    () =>
      allEnfants
        .filter((e): e is Enfant => Boolean(e && e.id))
        .filter(e => !isDirecteur || e.crecheId === user?.id),
    [allEnfants, isDirecteur, user?.id]
  );

  const handleDeleteEnfant = () => {
    showToast(isArabic
      ? 'الحذف النهائي متوقف مؤقتاً لحماية السجلات. يمكنك تسجيل خروج الطفل والاحتفاظ بالتاريخ.'
      : 'La suppression définitive est temporairement désactivée pour protéger les dossiers. Vous pouvez marquer l’enfant comme sorti et conserver son historique.', 'info', 7000);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [filterGroupe, setFilterGroupe] = useState('Tous');
  const [showModal, setShowModal] = useState(false);
  const [isSavingChild, setIsSavingChild] = useState(false);
  const childSaveInFlight = useRef(false);
  const childCreationId = useRef<string | null>(null);
  const [savingExit, setSavingExit] = useState(false);
  const exitInFlight = useRef(false);
  const [showInactifs, setShowInactifs] = useState(false); // ✅ affiche aussi les enfants sortis
  const [sortieModalEnfant, setSortieModalEnfant] = useState<any | null>(null); // ✅ enfant en cours de "marquer comme sorti"
  const [sortieDate, setSortieDate] = useState(new Date().toISOString().split('T')[0]);
  const [sortieMotif, setSortieMotif] = useState('');
  const [selectedEnfant, setSelectedEnfant] = useState<Enfant | null>(null);
  const [editingEnfantId, setEditingEnfantId] = useState<string | null>(null);
  const [quickUpdatingEnfantId, setQuickUpdatingEnfantId] = useState<string | null>(null);
  const isAccountPending = user?.role === 'directeur' && user.approvalStatus === 'pending';
  const isReadOnly = isAccountPending || !canEditChildren;
  const isMobileViewport = useIsMobileViewport(767);

  // Vue en liste minimaliste par défaut sur téléphone comme sur PC (adaptée à 100+ enfants)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [quickFilter, setQuickFilter] = useState<'all' | 'incomplete_docs' | 'allergy'>('all');
  const [visibleCount, setVisibleCount] = useState(DIRECTORY_PAGE_STEP);
  const [actionSheetEnfantId, setActionSheetEnfantId] = useState<string | null>(null);
  const [showAdmissionQr, setShowAdmissionQr] = useState(false);
  const [newAdmissionLink, setNewAdmissionLink] = useState<(InscriptionLink & { token: string }) | null>(null);
  const [admissionQrDataUrl, setAdmissionQrDataUrl] = useState('');
  const [admissionLinkCopied, setAdmissionLinkCopied] = useState(false);
  const [admissionActionId, setAdmissionActionId] = useState<string | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const importInFlight = useRef(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);
  useEffect(() => { if (!isReadOnly && takeSetupTask(user?.id, 'enfants')) setShowImportWizard(true); }, [user?.id, isReadOnly]);
  const [pasteImportText, setPasteImportText] = useState('');

  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    dateNaissance: '',
    genre: 'Garçon' as 'Garçon' | 'Fille',
    groupeAge: 'Bébés' as 'Bébés' | 'Moyens' | 'Grands',
    allergie: '',
    regimeAlimentaire: '',
    bloodGroup: '',
    weightKg: '',
    pediatricianName: '',
    vaccinations: '',
    notesMedicales: '',
    parentNom: '',
    parentPrenom: '',
    parentTelephone: '',
    parentEmail: '',
    parentAdresse: '',
    parentProfession: '',
    parentLien: 'Mère' as 'Mère' | 'Père' | 'Tuteur',
    docCertif: false,
    docVaccin: false,
    docDomicile: false,
    docPhoto: false,
    docFiles: {} as Partial<Record<DocumentKey, DocumentUpload>>,
    jourEcheanceMensuel: '5', // ✅ jour du mois (1-31) pour la facture auto + notification de paiement
  });

  const admissionLinkUrl = newAdmissionLink?.token
    ? `${window.location.origin}/admission?token=${encodeURIComponent(newAdmissionLink.token)}`
    : '';

  // Ignore a late QR generation for an older link.
  useEffect(() => {
    let current = true;
    const persistedLink = inscriptionLinks.find(link => link.active && Boolean(link.token));
    setAdmissionQrDataUrl('');
    setAdmissionLinkCopied(false);
    if (!persistedLink?.token) {
      setNewAdmissionLink(null);
      return () => { current = false; };
    }
    const linkWithToken = persistedLink as InscriptionLink & { token: string };
    setNewAdmissionLink(linkWithToken);
    const url = `${window.location.origin}/admission?token=${encodeURIComponent(linkWithToken.token)}`;
    QRCode.toDataURL(url, {
      width: 440, margin: 2, errorCorrectionLevel: 'M',
      color: { dark: '#172554', light: '#ffffff' },
    }).then(value => { if (current) setAdmissionQrDataUrl(value); })
      .catch(() => { if (current) showToast(isArabic ? 'تعذر عرض رمز التسجيل.' : 'Impossible d’afficher le QR d’admission.', 'error'); });
    return () => { current = false; };
  }, [inscriptionLinks, isArabic, showToast]);

  const handleAdmissionDecision = async (id: string, name: string, decision: 'acceptee' | 'refusee') => {
    if (admissionActionId) return;
    const ok = await confirm({
      title: decision === 'acceptee' ? (isArabic ? 'قبول وإضافة الطفل؟' : 'Accepter et ajouter cet enfant ?') : (isArabic ? 'رفض طلب التسجيل؟' : 'Refuser cette demande ?'),
      message: decision === 'acceptee'
        ? (isArabic ? `سيتم إنشاء ملف للطفل ${name}. تحقق من الطلب قبل التأكيد.` : `Un dossier sera créé pour ${name}. Vérifiez la demande avant de confirmer.`)
        : (isArabic ? `تأكيد رفض طلب ${name}؟` : `Confirmer le refus de la demande de ${name} ?`),
      confirmLabel: isArabic ? 'تأكيد' : 'Confirmer',
      variant: decision === 'refusee' ? 'danger' : 'primary',
    });
    if (!ok) return;
    setAdmissionActionId(id);
    try { await decideAdmission(id, decision); }
    catch { showToast(isArabic ? 'تعذر معالجة الطلب. تحقق من الحالة قبل المحاولة مجدداً.' : 'Impossible de traiter la demande. Vérifiez son état avant de réessayer.', 'error', 7000); }
    finally { setAdmissionActionId(null); }
  };


  const copyAdmissionLink = async () => {
    if (!admissionLinkUrl) return;
    setAdmissionLinkCopied(false);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(admissionLinkUrl);
      setAdmissionLinkCopied(true);
      window.setTimeout(() => setAdmissionLinkCopied(false), 1800);
    } catch {
      showToast(isArabic ? 'تعذر النسخ. انسخ الرابط المعروض يدوياً.' : 'Copie impossible. Copiez le lien affiché manuellement.', 'error');
    }
  };

  const downloadAdmissionQr = () => {
    if (!admissionQrDataUrl) return;
    const anchor = document.createElement('a');
    anchor.href = admissionQrDataUrl;
    anchor.download = 'rawdha-admission-qr.png';
    anchor.click();
  };

  const statusFilteredEnfants = useMemo(
    () => enfants.filter(enfant => (showInactifs ? true : enfant.statut === 'Actif')),
    [enfants, showInactifs],
  );

  const directoryStats = useMemo(() => {
    let bebes = 0;
    let moyens = 0;
    let grands = 0;
    let incompleteDocs = 0;
    let allergies = 0;
    for (const enfant of statusFilteredEnfants) {
      if (enfant.groupeAge === 'Bébés') bebes += 1;
      else if (enfant.groupeAge === 'Moyens') moyens += 1;
      else if (enfant.groupeAge === 'Grands') grands += 1;
      if (getCompletedDocsCount(enfant) < 4) incompleteDocs += 1;
      if (enfant.allergie?.trim()) allergies += 1;
    }
    return { total: statusFilteredEnfants.length, bebes, moyens, grands, incompleteDocs, allergies };
  }, [statusFilteredEnfants]);

  const baseFilteredEnfants = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();
    const digitsTerm = term.replace(/\D/g, '');
    const locale = isArabic ? 'ar' : 'fr';

    return statusFilteredEnfants
      .filter(enfant => {
        const fullName = `${enfant.prenom} ${enfant.nom}`.toLowerCase();
        const reverseName = `${enfant.nom} ${enfant.prenom}`.toLowerCase();
        const refCode = `raw-${enfant.id.slice(-4)}`.toLowerCase();
        const matchesSearch =
          !term ||
          fullName.includes(term) ||
          reverseName.includes(term) ||
          refCode.includes(term) ||
          enfant.parents.some(p => {
            const pName = `${p.prenom} ${p.nom}`.toLowerCase();
            const rawTel = (p.telephone || '').toLowerCase();
            const cleanTel = rawTel.replace(/\D/g, '');
            return (
              pName.includes(term) ||
              rawTel.includes(term) ||
              (digitsTerm.length >= 2 && cleanTel.includes(digitsTerm))
            );
          });

        let matchesGroupe = true;
        if (filterGroupe !== 'Tous' && filterGroupe !== 'الكل') {
          const normalizedFilter =
            filterGroupe.includes('Bébés') || filterGroupe.includes('رضع')
              ? 'Bébés'
              : filterGroupe.includes('Moyens') || filterGroupe.includes('متوسطين')
                ? 'Moyens'
                : 'Grands';
          matchesGroupe = enfant.groupeAge === normalizedFilter;
        }

        const matchesQuick =
          quickFilter === 'all'
            ? true
            : quickFilter === 'incomplete_docs'
              ? getCompletedDocsCount(enfant) < 4
              : Boolean(enfant.allergie?.trim());

        return matchesSearch && matchesGroupe && matchesQuick;
      })
      .sort((a, b) => {
        const nameA = `${a.prenom} ${a.nom}`.trim();
        const nameB = `${b.prenom} ${b.nom}`.trim();
        return nameA.localeCompare(nameB, locale, { sensitivity: 'base' });
      });
  }, [deferredSearchTerm, filterGroupe, isArabic, quickFilter, statusFilteredEnfants]);

  const filteredEnfants = baseFilteredEnfants;

  useEffect(() => {
    setVisibleCount(DIRECTORY_PAGE_STEP);
  }, [deferredSearchTerm, filterGroupe, quickFilter, showInactifs]);

  const displayedEnfants = useMemo(
    () => filteredEnfants.slice(0, visibleCount),
    [filteredEnfants, visibleCount],
  );

  const actionSheetEnfant = useMemo(
    () => (actionSheetEnfantId ? enfants.find(e => e.id === actionSheetEnfantId) || null : null),
    [actionSheetEnfantId, enfants],
  );

  useEffect(() => {
    if (!actionSheetEnfant) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActionSheetEnfantId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actionSheetEnfant]);

  const openEditModalForChild = (enfant: Enfant) => {
    const req = getDocumentsRequis(enfant);
    setEditingEnfantId(enfant.id);
    setFormData({
      nom: enfant.nom,
      prenom: enfant.prenom,
      dateNaissance: enfant.dateNaissance,
      genre: enfant.genre,
      groupeAge: enfant.groupeAge,
      bloodGroup: enfant.groupeSanguin || '',
      weightKg: enfant.poidsKg ? String(enfant.poidsKg) : '',
      pediatricianName: enfant.medecinTraitant || '',
      vaccinations: enfant.vaccinations || '',
      notesMedicales: enfant.notesMedicales || '',
      docFiles: enfant.documentsFichiers || {},
      parentNom: enfant.parents[0]?.nom || '',
      parentPrenom: enfant.parents[0]?.prenom || '',
      parentLien: enfant.parents[0]?.lien || 'Mère',
      parentTelephone: enfant.parents[0]?.telephone || '',
      parentEmail: enfant.parents[0]?.email || '',
      parentProfession: enfant.parents[0]?.profession || '',
      parentAdresse: enfant.parents[0]?.adresse || '',
      docCertif: req.certificatMedical,
      docVaccin: req.carnetVaccination,
      docDomicile: req.justificatifDomicile,
      docPhoto: req.photoIdentite,
      jourEcheanceMensuel: String(enfant.jourEcheanceMensuel || 5),
      allergie: enfant.allergie || '',
      regimeAlimentaire: enfant.regimeAlimentaire || '',
    });
    setShowModal(true);
  };

  // ✅ Marque un enfant comme "sorti" : statut Inactif + date + motif de sortie
  const handleConfirmerSortie = async () => {
    if (!sortieModalEnfant || exitInFlight.current) return;
    if (!sortieDate) {
      showToast(isArabic ? 'يرجى إدخال تاريخ الخروج.' : 'Veuillez saisir la date de sortie.', 'error');
      return;
    }
    exitInFlight.current = true;
    setSavingExit(true);
    try {
      await updateEnfant(sortieModalEnfant.id, {
        statut: 'Inactif', dateSortie: sortieDate, motifSortie: sortieMotif || undefined,
      });
      setSortieModalEnfant(null);
      setSortieDate(new Date().toISOString().split('T')[0]);
      setSortieMotif('');
    } catch {
      // Le formulaire reste ouvert et le contexte affiche l'erreur.
    } finally {
      exitInFlight.current = false;
      setSavingExit(false);
    }
  };

  const handleReintegrer = async (enfant: Enfant) => {
    try {
      await updateEnfant(enfant.id, { statut: 'Actif', dateSortie: undefined, motifSortie: undefined });
    } catch {
      // Le contexte affiche l'erreur ; ne pas afficher un statut réintégré fictif.
    }
  };

  const handleQuickGroupChange = async (enfant: Enfant, groupeAge: Enfant['groupeAge']) => {
    if (isReadOnly || quickUpdatingEnfantId || enfant.groupeAge === groupeAge) return;
    setQuickUpdatingEnfantId(enfant.id);
    try {
      await updateEnfant(enfant.id, { groupeAge });
    } catch (error) {
      console.error('Modification rapide du groupe enfant:', error);
      showToast(isArabic ? 'تعذر تحديث قسم الطفل.' : 'Le groupe de l’enfant n’a pas pu être mis à jour.', 'error');
    } finally {
      setQuickUpdatingEnfantId(null);
    }
  };

  const parseCsvLine = (line: string, separator: string) => {
    const values: string[] = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === separator && !quoted) {
        values.push(value.trim());
        value = '';
      } else {
        value += character;
      }
    }
    values.push(value.trim());
    return values;
  };

  const findImportColumn = (headers: string[], aliases: string[]) => {
    const normalizedAliases = aliases.map(normalizeImportHeader);
    const exactIndex = headers.findIndex(header => normalizedAliases.includes(header));
    if (exactIndex >= 0) return exactIndex;
    return headers.findIndex(header => normalizedAliases.some(alias => alias.length >= 3 && (header.includes(alias) || alias.includes(header))));
  };

  const buildImportPreviewFromRows = (fileName: string, separatorLabel: string, matrix: string[][]): ImportPreview => {
    const nonEmptyRows = matrix.filter(r => r.some(cell => normalizeImportValue(cell).length > 0));
    if (nonEmptyRows.length < 2) throw new Error('empty');
    if (nonEmptyRows.length > 10001) throw new Error('too_many_rows');
    const rawHeaders = nonEmptyRows[0].map(cell => cell.trim());
    const headers = rawHeaders.map(normalizeImportHeader);
    const columns = {
      nom: findImportColumn(headers, ['nom', 'lastname', 'surname', 'nomenfant', 'nomdelenfant', 'اللقب', 'لقبالطفل', 'عائلة']),
      prenom: findImportColumn(headers, ['prenom', 'firstname', 'givenname', 'prenomenfant', 'الاسم', 'اسمالطفل']),
      dateNaissance: findImportColumn(headers, ['datenaissance', 'datebirth', 'birthdate', 'naissance', 'ddn', 'تاريخالميلاد', 'الميلاد', 'تاريخالازدياد']),
      genre: findImportColumn(headers, ['genre', 'sexe', 'gender', 'الجنس']),
      groupeAge: findImportColumn(headers, ['groupeage', 'groupe', 'section', 'classe', 'niveau', 'الفئة', 'القسم', 'الفوج']),
      parentNom: findImportColumn(headers, ['parentnom', 'nomparent', 'nompere', 'nommere', 'nomresponsable', 'لقبالولي', 'الولي']),
      parentPrenom: findImportColumn(headers, ['parentprenom', 'prenomparent', 'prenomresponsable', 'اسمالولي']),
      parentTelephone: findImportColumn(headers, ['parenttelephone', 'telephoneparent', 'telephone', 'tel', 'mobile', 'gsm', 'الهاتف', 'رقمالولي', 'رقمهاتف']),
      parentEmail: findImportColumn(headers, ['parentemail', 'emailparent', 'email', 'courriel', 'البريدالالكتروني', 'البريد', 'ايميل']),
    };
    const labelByField: Record<string, string> = {
      nom: 'Nom',
      prenom: 'Prénom',
      dateNaissance: 'Date de naissance',
      genre: 'Genre',
      groupeAge: 'Groupe / classe',
      parentNom: 'Nom du parent',
      parentPrenom: 'Prénom du parent',
      parentTelephone: 'Téléphone du parent',
      parentEmail: 'E-mail du parent',
    };
    const columnMap = Object.entries(columns).map(([field, index]) => `${labelByField[field]} : ${index >= 0 ? rawHeaders[index] : 'colonne absente'}`);
    const rows: ImportPreviewRow[] = [];
    for (let rowIndex = 1; rowIndex < nonEmptyRows.length; rowIndex += 1) {
      const row = nonEmptyRows[rowIndex].map(normalizeImportValue);
      const valueAt = (index: number) => (index >= 0 ? (row[index] || '') : '');
      const rawDate = valueAt(columns.dateNaissance);
      const dateNaissance = normalizeImportDate(rawDate);
      const nom = valueAt(columns.nom);
      const prenom = valueAt(columns.prenom);
      const parentNom = valueAt(columns.parentNom) || nom;
      const parentPrenom = valueAt(columns.parentPrenom);
      const parentTelephone = valueAt(columns.parentTelephone);
      const parentEmail = valueAt(columns.parentEmail);
      const missing: string[] = [];
      if (!nom) missing.push('Nom');
      if (!prenom) missing.push('Prénom');
      if (!dateNaissance) missing.push(rawDate ? 'Date de naissance non reconnue' : 'Date de naissance');
      if (!valueAt(columns.genre)) missing.push('Genre');
      if (!valueAt(columns.groupeAge)) missing.push('Groupe / classe');
      if (!parentNom) missing.push('Nom du parent');
      if (!parentPrenom) missing.push('Prénom du parent');
      if (!parentTelephone) missing.push('Téléphone du parent');
      const warnings: string[] = [];
      if (rawDate && !dateNaissance) warnings.push('Date à vérifier');
      if (parentEmail && !parentEmail.includes('@')) warnings.push('E-mail à vérifier');
      const hasData = row.some(Boolean);
      const invalid = !hasData;
      const draft: ImportChildDraft = {
        nom: nom || 'À compléter',
        prenom: prenom || 'À compléter',
        dateNaissance,
        genre: normalizeImportGender(valueAt(columns.genre)),
        groupeAge: normalizeImportGroup(valueAt(columns.groupeAge)),
        parentNom: parentNom || 'À compléter',
        parentPrenom: parentPrenom || 'À compléter',
        parentTelephone,
        parentEmail: parentEmail && parentEmail.includes('@') ? parentEmail : '',
      };
      rows.push({ rowNumber: rowIndex + 1, draft, missing, warnings, invalid });
    }
    return { fileName, separator: separatorLabel, totalRows: rows.length, headers: rawHeaders, columnMap, rows };
  };

  const handleCsvImport = async (file?: File) => {
    if (!file) return;
    setImportingCsv(true);
    setImportResult(null);
    try {
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);
      if (isXlsxFile(file, bytes)) {
        const xlsxRows = await parseXlsxRows(bytes);
        setShowImportWizard(false);
        setImportPreview(buildImportPreviewFromRows(file.name, 'Excel (.xlsx)', xlsxRows));
      } else {
        const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
        const parsed = parseDelimitedSpreadsheetText(text);
        setShowImportWizard(false);
        setImportPreview(
          buildImportPreviewFromRows(
            file.name,
            parsed.separator === '\t' ? 'Tabulation' : parsed.separator,
            parsed.rows,
          ),
        );
      }
    } catch (error) {
      const message = error instanceof Error && error.message === 'too_many_rows'
        ? (isArabic ? 'الملف يحتوي على أكثر من 10000 سطر.' : 'Le fichier dépasse la limite de 10 000 lignes.')
        : (isArabic ? 'تعذر قراءة الملف. استخدم ملف Excel (.xlsx) أو CSV.' : 'Impossible de lire ce fichier. Utilisez un fichier Excel (.xlsx) ou CSV.');
      showToast(message, 'error');
    } finally {
      setImportingCsv(false);
    }
  };

  const handlePasteSpreadsheetImport = () => {
    if (!pasteImportText.trim()) return;
    try {
      const parsed = parseDelimitedSpreadsheetText(pasteImportText);
      const preview = buildImportPreviewFromRows(
        isArabic ? 'نسخ من Excel' : 'Collage Excel',
        parsed.separator === '\t' ? 'Excel (Tab)' : parsed.separator,
        parsed.rows,
      );
      setShowImportWizard(false);
      setPasteImportText('');
      setImportPreview(preview);
    } catch {
      showToast(
        isArabic
          ? 'تأكد من نسخ سطر العناوين مع سطر طفل واحد على الأقل.'
          : 'Copiez la ligne des titres avec au moins un enfant.',
        'error',
      );
    }
  };

  const handleDownloadImportTemplate = () => {
    const csv = buildChildrenImportTemplateCsv(isArabic);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = isArabic ? 'modele-enfants-rawdha-ar.csv' : 'modele-enfants-rawdha.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const confirmCsvImport = async () => {
    if (!importPreview || importInFlight.current) return;
    importInFlight.current = true;
    setImportingCsv(true);
    try {
      const rowsToImport = importPreview.rows.filter(row => !row.invalid);
      const { saved, unconfirmed: failed, notAttempted } = await importBatches<ImportPreviewRow>(rowsToImport, async row => {
          const draft = row.draft;
          const parentDisplayName = `${draft.parentPrenom} ${draft.parentNom}`.trim();
          const enfant = {
            id: createImportId('csv_child', row.rowNumber), crecheId: isDirecteur ? user?.id : undefined,
            nom: draft.nom, prenom: draft.prenom, dateNaissance: draft.dateNaissance,
            genre: draft.genre, groupeAge: draft.groupeAge,
            dateInscription: new Date().toISOString().split('T')[0], statut: 'Actif',
            contactsUrgence: [{ id: createImportId('csv_contact', row.rowNumber), nom: parentDisplayName, telephone: draft.parentTelephone, lien: 'Mère' }],
            parents: [{ id: createImportId('csv_parent', row.rowNumber), nom: draft.parentNom, prenom: draft.parentPrenom, lien: 'Mère', telephone: draft.parentTelephone, email: draft.parentEmail || undefined }],
            documentsRequis: { ...DEFAULT_DOCUMENTS_REQUIS },
          } as Omit<Enfant, 'id'>;
          await addEnfant(enfant);
      });
      setImportResult({ fileName: importPreview.fileName, imported: saved.length,
        incomplete: saved.filter(row => row.missing.length > 0).length,
        skipped: importPreview.rows.filter(row => row.invalid).length,
        rows: saved, failed, notAttempted: notAttempted.length });
      setImportPreview(null);
      if (failed.length) showToast(isArabic ? 'توقف الاستيراد. تحقق من الملفات المحفوظة قبل إعادة المحاولة لتجنب التكرار.' : 'Import interrompu. Vérifiez les dossiers enregistrés avant de réessayer pour éviter les doublons.', 'error', 8000);
    } catch {
      showToast(isArabic ? 'تعذر إكمال الاستيراد. تحقق من الملفات قبل إعادة المحاولة.' : 'Import interrompu. Vérifiez les dossiers avant de réessayer.', 'error');
    } finally {
      importInFlight.current = false;
      setImportingCsv(false);
    }
  };

  const handleAjouter = async () => {
    if (childSaveInFlight.current) return;
    if (!formData.nom || !formData.prenom || !formData.dateNaissance || 
        !formData.parentNom || !formData.parentTelephone) {
      showToast(
        isArabic ? 'يرجى ملء جميع الحقول المطلوبة *' : 'Veuillez remplir tous les champs obligatoires *',
        'error',
      );
      return;
    }

    childSaveInFlight.current = true;
    setIsSavingChild(true);
    try {
    if (editingEnfantId) {
      const existing = enfants.find(item => item.id === editingEnfantId);
      if (!existing) {
        showToast(isArabic ? 'ملف الطفل غير متاح. أعد تحميل البيانات قبل التعديل.' : 'Le dossier enfant n’est plus disponible. Rechargez les données avant de le modifier.', 'error');
        return;
      }
      const updatedEnfant: Partial<Enfant> = {
        nom: formData.nom,
        prenom: formData.prenom,
        dateNaissance: formData.dateNaissance,
        genre: formData.genre,
        groupeAge: formData.groupeAge,
        allergie: formData.allergie || undefined,
        regimeAlimentaire: formData.regimeAlimentaire || undefined,
        groupeSanguin: formData.bloodGroup || undefined,
        poidsKg: formData.weightKg ? Number(formData.weightKg) : undefined,
        medecinTraitant: formData.pediatricianName || undefined,
        vaccinations: formData.vaccinations || undefined,
        notesMedicales: formData.notesMedicales || undefined,
        // Ce formulaire ne modifie que le parent principal ; les autres
        // parents et les contacts d'urgence ne doivent jamais être écrasés.
        parents: updatePrimaryParent(existing?.parents || [], {
          ...existing?.parents[0],
          id: existing?.parents[0]?.id || `${Date.now()}-parent`,
          nom: formData.parentNom,
          prenom: formData.parentPrenom,
          lien: formData.parentLien,
          telephone: formData.parentTelephone,
          email: formData.parentEmail || undefined,
          adresse: formData.parentAdresse || undefined,
          profession: formData.parentProfession || undefined,
        }),
        documentsRequis: {
          certificatMedical: formData.docCertif,
          carnetVaccination: formData.docVaccin,
          justificatifDomicile: formData.docDomicile,
          photoIdentite: formData.docPhoto
        },
        documentsFichiers: formData.docFiles,
        jourEcheanceMensuel: formData.jourEcheanceMensuel ? Number(formData.jourEcheanceMensuel) : undefined
      };
      await updateEnfant(editingEnfantId, updatedEnfant);
      setEditingEnfantId(null);
    } else {
      const nouvelEnfant: Enfant = {
        id: childCreationId.current || (childCreationId.current = `child_${crypto.randomUUID()}`),
        crecheId: isDirecteur ? user!.id : undefined,
        nom: formData.nom,
        prenom: formData.prenom,
        dateNaissance: formData.dateNaissance,
        genre: formData.genre,
        groupeAge: formData.groupeAge,
        dateInscription: new Date().toISOString().split('T')[0],
        statut: 'Actif',
        allergie: formData.allergie || undefined,
        regimeAlimentaire: formData.regimeAlimentaire || undefined,
        groupeSanguin: formData.bloodGroup || undefined,
        poidsKg: formData.weightKg ? Number(formData.weightKg) : undefined,
        medecinTraitant: formData.pediatricianName || undefined,
        vaccinations: formData.vaccinations || undefined,
        notesMedicales: formData.notesMedicales || undefined,
        contactsUrgence: [
          {
            id: `${Date.now()}-contact`,
            nom: `${formData.parentPrenom} ${formData.parentNom}`,
            telephone: formData.parentTelephone,
            lien: formData.parentLien
          }
        ],
        parents: [
          {
            id: `${Date.now()}-parent`,
            nom: formData.parentNom,
            prenom: formData.parentPrenom,
            lien: formData.parentLien,
            telephone: formData.parentTelephone,
            email: formData.parentEmail || undefined,
            adresse: formData.parentAdresse || undefined,
            profession: formData.parentProfession || undefined
          }
        ],
        documentsRequis: {
          certificatMedical: formData.docCertif,
          carnetVaccination: formData.docVaccin,
          justificatifDomicile: formData.docDomicile,
          photoIdentite: formData.docPhoto
        },
        documentsFichiers: formData.docFiles,
        jourEcheanceMensuel: formData.jourEcheanceMensuel ? Number(formData.jourEcheanceMensuel) : undefined
      };
      await addEnfant(nouvelEnfant);
      childCreationId.current = null;
    }

    setShowModal(false);
    setFormData({
      nom: '',
      prenom: '',
      dateNaissance: '',
      genre: 'Garçon',
      groupeAge: 'Bébés',
      allergie: '',
      regimeAlimentaire: '',
      bloodGroup: '',
      weightKg: '',
      pediatricianName: '',
      vaccinations: '',
      notesMedicales: '',
      parentNom: '',
      parentPrenom: '',
      parentTelephone: '',
      parentEmail: '',
      parentAdresse: '',
      parentProfession: '',
      parentLien: 'Mère',
      docCertif: false,
      docVaccin: false,
      docDomicile: false,
      docPhoto: false,
      docFiles: {},
      jourEcheanceMensuel: '5',
    });
    } catch {
      showToast(isArabic ? 'تعذر حفظ الملف. تحقق من البيانات المحفوظة قبل إعادة المحاولة.' : 'Le dossier n’a pas pu être confirmé. Vérifiez les données enregistrées avant de réessayer.', 'error');
    } finally {
      childSaveInFlight.current = false;
      setIsSavingChild(false);
    }
  };

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

  const calculerAgeCourt = (dateString: string) => {
    if (!dateString) return '—';
    const birth = new Date(dateString);
    if (Number.isNaN(birth.getTime())) return '—';
    const now = new Date();
    let ans = now.getFullYear() - birth.getFullYear();
    let mois = now.getMonth() - birth.getMonth();
    if (mois < 0 || (mois === 0 && now.getDate() < birth.getDate())) {
      ans--;
      mois += 12;
    }
    if (ans <= 0) return isArabic ? `${Math.max(0, mois)} ش` : `${Math.max(0, mois)} mois`;
    if (mois === 0) return isArabic ? `${ans} س` : `${ans} ${ans > 1 ? 'ans' : 'an'}`;
    return isArabic ? `${ans} س و${mois} ش` : `${ans} ${ans > 1 ? 'ans' : 'an'} ${mois} m.`;
  };

  const pendingAdmissionCount = demandesAdmission.filter(item => item.statut === 'en_attente').length;
  const hasActiveDirectoryFilter =
    Boolean(deferredSearchTerm.trim()) ||
    (filterGroupe !== 'Tous' && filterGroupe !== 'الكل') ||
    quickFilter !== 'all';

  return (
    <div className="space-y-3 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                {t('children.title')}
              </h1>
              <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 tabular-nums">
                {hasActiveDirectoryFilter
                  ? `${filteredEnfants.length} / ${directoryStats.total}`
                  : directoryStats.total}
              </span>
            </div>
            <p
              className={`text-xs text-slate-500 mt-0.5 font-medium tabular-nums ${
                hasActiveDirectoryFilter ? 'block' : 'hidden sm:block'
              }`}
            >
              {hasActiveDirectoryFilter
                ? isArabic
                  ? `${filteredEnfants.length} نتيجة مطابقة من أصل ${directoryStats.total}`
                  : `${filteredEnfants.length} résultat(s) sur ${directoryStats.total} ${t('children.enrolled')}`
                : `${directoryStats.total} ${t('children.enrolled')}`}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-2">
          {canEditChildren && (
            <button
              disabled={isReadOnly}
              onClick={() => {
                setEditingEnfantId(null);
                childCreationId.current = null;
                setFormData({
                  nom: '',
                  prenom: '',
                  dateNaissance: '',
                  genre: 'Garçon',
                  groupeAge: 'Bébés',
                  allergie: '',
                  regimeAlimentaire: '',
                  bloodGroup: '',
                  weightKg: '',
                  pediatricianName: '',
                  vaccinations: '',
                  notesMedicales: '',
                  docFiles: {},
                  parentNom: '',
                  parentPrenom: '',
                  parentTelephone: '',
                  parentEmail: '',
                  parentAdresse: '',
                  parentProfession: '',
                  parentLien: 'Mère',
                  docCertif: false,
                  docVaccin: false,
                  docDomicile: false,
                  docPhoto: false,
                  jourEcheanceMensuel: '5',
                });
                setShowModal(true);
              }}
              className="min-h-9! w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus size={15} className="stroke-[2.5]" />
              <span>{t('children.add')}</span>
            </button>
          )}

          {(canManageAdmissions || canEditChildren) && (
            <div
              className={`grid gap-1.5 sm:flex sm:items-center sm:gap-2 ${
                canManageAdmissions && canEditChildren ? 'grid-cols-2' : 'grid-cols-1'
              }`}
            >
              {canManageAdmissions && (
                <button
                  type="button"
                  onClick={() => setShowAdmissionQr(value => !value)}
                  className="min-h-9! inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                >
                  {showAdmissionQr ? (
                    <X className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  ) : (
                    <QrCode className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                  )}
                  <span className="truncate">
                    {showAdmissionQr
                      ? isArabic
                        ? 'إغلاق QR'
                        : 'Fermer QR'
                      : isArabic
                        ? 'عرض QR الدائم'
                        : 'Afficher mon QR'}
                  </span>
                  {pendingAdmissionCount > 0 && (
                    <span className="shrink-0 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums">
                      {pendingAdmissionCount}
                    </span>
                  )}
                </button>
              )}
              {canEditChildren && (
                <button
                  type="button"
                  disabled={importingCsv || isReadOnly}
                  onClick={() => setShowImportWizard(true)}
                  className="min-h-9! inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 whitespace-nowrap transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <FileSpreadsheet size={14} className="shrink-0 text-emerald-600" />
                  <span className="truncate">
                    {importingCsv
                      ? isArabic
                        ? 'جاري الاستيراد...'
                        : 'Import...'
                      : isArabic
                        ? 'استيراد Excel / CSV'
                        : 'Importer Excel'}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {importResult && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-black">{importResult.failed.length ? (isArabic ? 'توقف الاستيراد جزئياً' : 'Import partiellement interrompu') : (isArabic ? 'اكتمل استيراد الأطفال' : 'Import terminé')}</p>
                <p className="mt-1 text-xs font-semibold text-emerald-800">
                  {isArabic ? `${importResult.imported} ملف مستورد` : `${importResult.imported} fiche(s) importée(s)`}
                  {importResult.incomplete > 0 && (isArabic ? ` • ${importResult.incomplete} تحتاج إلى استكمال` : ` • ${importResult.incomplete} avec des informations manquantes`)}
                  {importResult.skipped > 0 && (isArabic ? ` • ${importResult.skipped} سطر فارغ تم تجاهله` : ` • ${importResult.skipped} ligne(s) vide(s) ignorée(s)`)}
                  {importResult.failed.length > 0 && (isArabic ? ` • ${importResult.failed.length} تعذر تأكيدها • ${importResult.notAttempted} لم تُرسل` : ` • ${importResult.failed.length} non confirmée(s) • ${importResult.notAttempted} non tentée(s)`)}
                </p>
                {importResult.incomplete > 0 && (
                  <p className="mt-2 text-xs font-bold text-amber-700">{isArabic ? 'تم حفظ السجلات الناقصة ويمكن استكمالها من قائمة الأطفال.' : 'Les fiches incomplètes sont enregistrées et peuvent être complétées depuis la liste des enfants.'}</p>
                )}
              </div>
            </div>
            <button type="button" onClick={() => setImportResult(null)} className="self-end rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 sm:self-start" aria-label={isArabic ? 'إغلاق' : 'Fermer'}><X className="h-4 w-4" /></button>
          </div>
          {importResult.failed.length > 0 && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
            <p>{isArabic ? 'تحقق من الملفات قبل إعادة الاستيراد؛ قد يكون الرد فُقد بعد الحفظ.' : 'Vérifiez les dossiers avant de réimporter : une réponse peut avoir été perdue après enregistrement.'}</p>
            <p>{isArabic ? 'الأسطر غير المؤكدة:' : 'Lignes non confirmées :'} {importResult.failed.map(row => row.rowNumber).join(', ')}</p>
          </div>}
          {importResult.incomplete > 0 && (
            <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 p-3">
              {importResult.rows.filter(row => row.missing.length > 0).slice(0, 30).map(row => (
                <p key={row.rowNumber} className="text-[11px] font-semibold text-amber-900"><span className="font-black">Ligne {row.rowNumber} — {row.draft.prenom} {row.draft.nom} :</span> {row.missing.join(', ')}</p>
              ))}
              {importResult.incomplete > 30 && <p className="text-[11px] font-bold text-amber-700">+ {importResult.incomplete - 30} autre(s) ligne(s) incomplète(s)</p>}
            </div>
          )}
        </section>
      )}

      {showAdmissionQr && (
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {isArabic ? 'رمز QR الدائم لقبول الأطفال' : 'QR permanent d’admission'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {isArabic
                  ? 'شاركوا هذا الرابط أو رمز QR مع الأولياء لملء استمارة التسجيل، ثم راجعوا كل طلب قبل الإضافة.'
                  : 'Partagez ce lien ou ce QR avec les parents pour recevoir leurs pré-inscriptions.'}
              </p>
              {newAdmissionLink && admissionLinkUrl && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="break-all text-[11px] font-medium text-slate-600">{admissionLinkUrl}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button type="button" onClick={copyAdmissionLink} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"><Copy className="h-3.5 w-3.5" />{admissionLinkCopied ? (isArabic ? 'تم النسخ' : 'Copié') : (isArabic ? 'نسخ' : 'Copier')}</button>
                    <button type="button" disabled={!admissionQrDataUrl} onClick={downloadAdmissionQr} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"><Download className="h-3.5 w-3.5" />{isArabic ? 'تحميل QR' : 'Télécharger QR'}</button>
                    <a href={admissionLinkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink className="h-3.5 w-3.5" />{isArabic ? 'فتح الرابط' : 'Ouvrir le lien'}</a>
                  </div>
                </div>
              )}
            </div>
            {demandesAdmission.some(item => item.statut === 'en_attente') && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-slate-900">{isArabic ? 'طلبات وصلت عبر هذا QR' : 'Demandes reçues via ce QR'}</p>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">{pendingAdmissionCount}</span>
                </div>
                <div className="mt-2.5 grid gap-2">
                  {demandesAdmission.filter(item => item.statut === 'en_attente').map(demande => (
                    <div key={demande.id} className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold">{demande.prenom} {demande.nom}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{demande.parentPrenom} {demande.parentNom} · {demande.parentTelephone}</p>
                        </div>
                        <span className="text-[10px] font-medium text-slate-400">{new Date(demande.dateDemande).toLocaleDateString(isArabic ? 'ar-DZ' : 'fr-DZ')}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" disabled={!!admissionActionId} onClick={() => void handleAdmissionDecision(demande.id, `${demande.prenom} ${demande.nom}`, 'acceptee')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60 cursor-pointer">{isArabic ? 'قبول وإضافة' : 'Accepter et ajouter'}</button>
                        <button type="button" disabled={!!admissionActionId} onClick={() => void handleAdmissionDecision(demande.id, `${demande.prenom} ${demande.nom}`, 'refusee')} className="rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 disabled:opacity-60 cursor-pointer">{isArabic ? 'رفض' : 'Refuser'}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {admissionQrDataUrl && <img src={admissionQrDataUrl} alt={isArabic ? 'رمز قبول QR' : 'QR admission enfant'} className="mx-auto h-36 w-36 rounded-xl border border-slate-200 bg-white p-2" />}
          </div>
        </section>
      )}

      <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-3.5 shadow-2xs space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={t('children.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full ps-8.5 pe-8 py-1.5 sm:py-2 bg-slate-50/90 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:bg-white transition-all text-xs sm:text-sm font-medium text-slate-800"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label={isArabic ? 'مسح البحث' : 'Effacer la recherche'}
                className="min-h-6! absolute end-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Bascule Liste minimaliste / Cartes disponible sur téléphone et ordinateur */}
          <div
            className="flex shrink-0 rounded-xl bg-slate-100 p-0.5 border border-slate-200/70"
            role="group"
            aria-label={isArabic ? 'طريقة العرض' : 'Mode d’affichage'}
          >
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              className={`min-h-7! inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title={isArabic ? 'عرض كقائمة' : 'Vue en liste compacte'}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isArabic ? 'قائمة' : 'Liste'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`min-h-7! inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title={isArabic ? 'عرض كبطاقات' : 'Vue en cartes détaillées'}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isArabic ? 'بطاقات' : 'Cartes'}</span>
            </button>
          </div>
        </div>

        {/* Barre de sections symétrique (4 colonnes fixes sur mobile, zéro slide horizontal) */}
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100/90 p-1 sm:inline-flex sm:w-auto sm:flex-wrap">
          {[
            { key: 'Tous', short: isArabic ? 'الكل' : 'Tous', full: t('children.all'), count: directoryStats.total },
            { key: 'Bébés', short: isArabic ? 'رضع' : 'Bébés', full: t('children.babies'), count: directoryStats.bebes },
            { key: 'Moyens', short: isArabic ? 'متوسطون' : 'Moyens', full: t('children.middle'), count: directoryStats.moyens },
            { key: 'Grands', short: isArabic ? 'كبار' : 'Grands', full: t('children.seniors'), count: directoryStats.grands },
          ].map(grp => {
            const active = filterGroupe === grp.key;
            return (
              <button
                key={grp.key}
                type="button"
                onClick={() => setFilterGroupe(grp.key)}
                className={`min-h-8! inline-flex items-center justify-center gap-1 px-1.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition cursor-pointer min-w-0 ${
                  active
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="truncate sm:hidden">{grp.short}</span>
                <span className="hidden sm:inline">{grp.full}</span>
                {directoryStats.total >= 6 && (
                  <span
                    className={`hidden sm:inline-block shrink-0 rounded px-1.5 py-0.2 text-[10px] font-extrabold tabular-nums ${
                      active ? 'bg-slate-900 text-white' : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {grp.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filtres rapides compacts sur 1 seule ligne sans troncature */}
        <div className="flex items-center gap-1.5 sm:flex-wrap">
          <button
            type="button"
            onClick={() => setQuickFilter(prev => (prev === 'incomplete_docs' ? 'all' : 'incomplete_docs'))}
            aria-pressed={quickFilter === 'incomplete_docs'}
            className={`min-h-8! flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap transition cursor-pointer min-w-0 ${
              quickFilter === 'incomplete_docs'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200/80 hover:bg-amber-50 hover:text-amber-800'
            }`}
          >
            <FileText className="w-3 h-3 shrink-0" />
            <span className="truncate">{isArabic ? 'ملف ناقص' : 'À compléter'}</span>
            {directoryStats.incompleteDocs > 0 && (
              <span
                className={`shrink-0 rounded px-1 py-0.2 text-[10px] font-extrabold tabular-nums ${
                  quickFilter === 'incomplete_docs' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {directoryStats.incompleteDocs}
              </span>
            )}
          </button>

          {directoryStats.allergies > 0 && (
            <button
              type="button"
              onClick={() => setQuickFilter(prev => (prev === 'allergy' ? 'all' : 'allergy'))}
              aria-pressed={quickFilter === 'allergy'}
              className={`min-h-8! shrink-0 inline-flex items-center justify-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap transition cursor-pointer ${
                quickFilter === 'allergy'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200/80 hover:bg-rose-50 hover:text-rose-800'
              }`}
            >
              <ShieldAlert className="w-3 h-3 shrink-0" />
              <span>{isArabic ? 'حساسية' : 'Allergies'}</span>
              <span
                className={`shrink-0 rounded px-1 py-0.2 text-[10px] font-extrabold tabular-nums ${
                  quickFilter === 'allergy' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {directoryStats.allergies}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowInactifs(prev => !prev)}
            aria-label={isArabic ? 'الأطفال المغادرون' : 'Enfants sortis'}
            className={`min-h-8! shrink-0 px-2.5 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap transition inline-flex items-center justify-center gap-1 cursor-pointer ${
              showInactifs
                ? 'bg-slate-800 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200/80 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <LogOut className="w-3 h-3 shrink-0" />
            <span className="sm:hidden">{isArabic ? 'مغادرون' : 'Sortis'}</span>
            <span className="hidden sm:inline">{isArabic ? 'الأطفال المغادرون' : 'Enfants sortis'}</span>
          </button>
        </div>
      </div>

      {filteredEnfants.length > 0 ? (
        <div className="space-y-3">
          {viewMode === 'list' ? (
            isMobileViewport ? (
              /* ================= VERSION PHONE : LISTE MINIMALISTE HAUTE DENSITÉ (100+ ENFANTS) ================= */
              <div
                data-directory-mode="mobile-minimal-list"
                className="overflow-hidden rounded-2xl border border-slate-200/85 bg-white shadow-2xs"
              >
                <ul className="divide-y divide-slate-100">
                  {displayedEnfants.map(enfant => {
                        const primaryParent = enfant.parents[0];
                        const telHref = normalizeTelHref(primaryParent?.telephone);
                        const docsCount = getCompletedDocsCount(enfant);
                        const isInactive = enfant.statut !== 'Actif';
                        const hasAllergy = Boolean(enfant.allergie?.trim());
                        const sectionDot =
                          enfant.groupeAge === 'Bébés'
                            ? 'bg-indigo-500'
                            : enfant.groupeAge === 'Moyens'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500';
                        const sectionLabel =
                          enfant.groupeAge === 'Bébés'
                            ? isArabic
                              ? 'رضع'
                              : 'Bébés'
                            : enfant.groupeAge === 'Moyens'
                              ? isArabic
                                ? 'متوسطون'
                                : 'Moyens'
                              : isArabic
                                ? 'كبار'
                                : 'Grands';

                        return (
                          <li
                            key={enfant.id}
                            data-mobile-child-row={enfant.id}
                            className={`flex items-center gap-2 px-3 transition hover:bg-slate-50/80 active:bg-slate-50 ${
                              isInactive ? 'opacity-65' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedEnfant(enfant)}
                              aria-label={isArabic ? 'عرض ملف الطفل' : 'Ouvrir le dossier de l’enfant'}
                              className="min-h-0! flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden py-2 text-start cursor-pointer"
                            >
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold tracking-tight ring-1 ring-inset ${
                                  isInactive
                                    ? 'bg-slate-100 text-slate-500 ring-slate-200'
                                    : enfant.genre === 'Fille'
                                      ? 'bg-rose-50 text-rose-700 ring-rose-200/75'
                                      : 'bg-sky-50 text-sky-700 ring-sky-200/75'
                                }`}
                              >
                                {(enfant.prenom?.[0] || '').toUpperCase()}
                                {(enfant.nom?.[0] || '').toUpperCase()}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="truncate text-[13.5px] font-bold text-slate-900">
                                    {enfant.prenom} {enfant.nom}
                                  </span>
                                  {hasAllergy && (
                                    <span
                                      title={enfant.allergie}
                                      className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-700 ring-1 ring-inset ring-rose-200/80"
                                    >
                                      <ShieldAlert className="h-2.5 w-2.5" />
                                      <span className="hidden min-[370px]:inline">
                                        {isArabic ? 'حساسية' : 'Allergie'}
                                      </span>
                                    </span>
                                  )}
                                  {isInactive && (
                                    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                      {isArabic ? 'مغادر' : 'Sorti'}
                                    </span>
                                  )}
                                </div>

                                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 min-w-0">
                                  <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-slate-700">
                                    <span className={`h-1.5 w-1.5 rounded-full ${sectionDot}`} />
                                    {sectionLabel}
                                  </span>
                                  <span className="text-slate-300" aria-hidden="true">·</span>
                                  <span className="shrink-0 tabular-nums">{calculerAgeCourt(enfant.dateNaissance)}</span>
                                  {primaryParent?.prenom && (
                                    <>
                                      <span className="text-slate-300" aria-hidden="true">·</span>
                                      <span className="truncate">{primaryParent.prenom}</span>
                                    </>
                                  )}
                                  <span
                                    className={`ms-auto shrink-0 rounded px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                                      docsCount === 4
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-amber-50 text-amber-700'
                                    }`}
                                    title={isArabic ? 'الوثائق الإدارية' : 'Pièces du dossier'}
                                  >
                                    {docsCount}/4
                                  </span>
                                </div>
                              </div>
                            </button>

                            <div className="flex shrink-0 items-center gap-1">
                              {telHref && (
                                <a
                                  href={telHref}
                                  aria-label={isArabic ? 'اتصال بالولي' : 'Appeler le parent'}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => setActionSheetEnfantId(enfant.id)}
                                aria-label={
                                  isArabic
                                    ? `إجراءات ${enfant.prenom} ${enfant.nom}`
                                    : `Actions pour ${enfant.prenom} ${enfant.nom}`
                                }
                                className="min-h-8! inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                </ul>
              </div>
            ) : (
              /* ================= VERSION TABLETTE & PC : TABLEAU DE GESTION STRUCTURÉ ================= */
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <p className="px-4 pt-3 text-xs text-slate-500 xl:hidden">
                  {isArabic
                    ? 'مرر الجدول أفقياً لرؤية كل الأعمدة.'
                    : 'Faites défiler le tableau horizontalement pour voir toutes les colonnes.'}
                </p>
                <div
                  className="mobile-scroll-x focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
                  role="region"
                  tabIndex={0}
                  aria-label={isArabic ? 'جدول الأطفال' : 'Tableau des enfants'}
                >
                  <table className="min-w-[680px] w-full text-start border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-4">{isArabic ? 'الطفل' : 'Enfant'}</th>
                        <th className="py-3 px-4">{isArabic ? 'العمر' : 'Âge'}</th>
                        <th className="py-3 px-4">{isArabic ? 'القسم' : 'Classe'}</th>
                        <th className="py-3 px-4">{isArabic ? 'ولي الأمر' : 'Parents'}</th>
                        <th className="py-3 px-4">{isArabic ? 'الملف' : 'Dossier'}</th>
                        <th className="py-3 px-4 text-center">{isArabic ? 'إجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                      {displayedEnfants.map(enfant => {
                        const docsCount = getCompletedDocsCount(enfant);
                        return (
                          <tr key={enfant.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-xl text-xs font-extrabold flex items-center justify-center ring-1 ring-inset ${
                                    enfant.genre === 'Fille'
                                      ? 'bg-rose-50 text-rose-700 ring-rose-200/80'
                                      : 'bg-sky-50 text-sky-700 ring-sky-200/80'
                                  }`}
                                >
                                  {(enfant.prenom?.[0] || '').toUpperCase()}
                                  {(enfant.nom?.[0] || '').toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedEnfant(enfant)}
                                      className="text-slate-900 font-bold hover:text-indigo-600 transition text-start cursor-pointer"
                                    >
                                      {enfant.prenom} {enfant.nom}
                                    </button>
                                    {enfant.allergie?.trim() && (
                                      <span
                                        title={enfant.allergie}
                                        className="inline-flex items-center gap-0.5 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200/80"
                                      >
                                        <ShieldAlert className="h-3 w-3" />
                                        {isArabic ? 'حساسية' : 'Allergie'}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-semibold uppercase tabular-nums">
                                    RAW-{enfant.id.slice(-4)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-slate-800 font-semibold text-xs">{calculerAge(enfant.dateNaissance)}</p>
                              <p className="text-[10px] text-slate-400 font-medium tabular-nums">
                                {new Date(enfant.dateNaissance).toLocaleDateString(isArabic ? 'ar' : 'fr-FR')}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={enfant.groupeAge}
                                disabled={isReadOnly || quickUpdatingEnfantId !== null}
                                onChange={event =>
                                  void handleQuickGroupChange(enfant, event.target.value as Enfant['groupeAge'])
                                }
                                aria-label={isArabic ? 'تعديل قسم الطفل' : 'Modifier le groupe de l’enfant'}
                                className={`cursor-pointer rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  enfant.groupeAge === 'Bébés'
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                    : enfant.groupeAge === 'Moyens'
                                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                }`}
                              >
                                <option value="Bébés">{isArabic ? 'رضع' : 'Bébés'}</option>
                                <option value="Moyens">{isArabic ? 'متوسطين' : 'Moyens'}</option>
                                <option value="Grands">{isArabic ? 'كبار' : 'Grands'}</option>
                              </select>
                            </td>
                            <td className="py-3 px-4">
                              {enfant.parents.slice(0, 1).map(parent => (
                                <div key={parent.id}>
                                  <p className="text-xs font-bold text-slate-800">
                                    {parent.prenom} {parent.nom}{' '}
                                    <span className="text-[9px] text-indigo-600 bg-indigo-50 px-1 rounded">
                                      {parent.lien}
                                    </span>
                                  </p>
                                  <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">{parent.telephone || '—'}</p>
                                </div>
                              ))}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                                  docsCount === 4
                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70'
                                    : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/70'
                                }`}
                              >
                                {docsCount}/4
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedEnfant(enfant)}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  title={isArabic ? 'عرض الملف' : 'Ouvrir le dossier'}
                                  aria-label={isArabic ? 'عرض ملف الطفل' : 'Ouvrir le dossier de l’enfant'}
                                >
                                  <FileText size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditModalForChild(enfant)}
                                  className="inline-flex items-center gap-1.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition cursor-pointer"
                                  title={isArabic ? 'تعديل ملف الطفل' : 'Modifier le dossier de l’enfant'}
                                  aria-label={isArabic ? 'تعديل ملف الطفل' : 'Modifier le dossier de l’enfant'}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    enfant.statut === 'Actif' ? setSortieModalEnfant(enfant) : handleReintegrer(enfant)
                                  }
                                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                                    enfant.statut === 'Actif'
                                      ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                      : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                  title={
                                    enfant.statut === 'Actif'
                                      ? isArabic
                                        ? 'تسجيل خروج'
                                        : 'Marquer comme sorti'
                                      : isArabic
                                        ? 'إعادة التسجيل'
                                        : 'Réintégrer'
                                  }
                                  aria-label={
                                    enfant.statut === 'Actif'
                                      ? isArabic
                                        ? 'تسجيل خروج الطفل'
                                        : 'Marquer l’enfant comme sorti'
                                      : isArabic
                                        ? 'إعادة تسجيل الطفل'
                                        : 'Réintégrer l’enfant'
                                  }
                                >
                                  {enfant.statut === 'Actif' ? <LogOut size={16} /> : <RotateCcw size={16} />}
                                </button>
                                <button
                                  type="button"
                                  aria-label={
                                    isArabic ? 'معلومات عن الحذف النهائي' : 'Information sur la suppression définitive'
                                  }
                                  title={
                                    isArabic
                                      ? 'الحذف النهائي متوقف مؤقتاً'
                                      : 'Suppression définitive temporairement désactivée'
                                  }
                                  onClick={() => {
                                    handleDeleteEnfant();
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            /* ================= GRID VIEW (CARTES DÉTAILLÉES SUR DEMANDE) ================= */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {displayedEnfants.map(enfant => {
                const birthDate = new Date(enfant.dateNaissance).toLocaleDateString(isArabic ? 'ar' : 'fr-FR');
                const req = getDocumentsRequis(enfant);
                const files = enfant.documentsFichiers || {};

                return (
                  <div
                    key={enfant.id}
                    className="rawdha-card-modern bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 shrink-0 rounded-xl text-sm font-extrabold flex items-center justify-center ring-1 ring-inset ${
                              enfant.genre === 'Fille'
                                ? 'bg-rose-50 text-rose-700 ring-rose-200/80'
                                : 'bg-sky-50 text-sky-700 ring-sky-200/80'
                            }`}
                          >
                            {(enfant.prenom?.[0] || '').toUpperCase()}
                            {(enfant.nom?.[0] || '').toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug truncate">
                              {enfant.prenom} {enfant.nom}
                            </h3>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mt-0.5 tabular-nums">
                              Ref: RAW-{enfant.id.slice(-4)}
                            </span>
                          </div>
                        </div>

                        <select
                          value={enfant.groupeAge}
                          disabled={isReadOnly || quickUpdatingEnfantId !== null}
                          onChange={event =>
                            void handleQuickGroupChange(enfant, event.target.value as Enfant['groupeAge'])
                          }
                          aria-label={isArabic ? 'تعديل قسم الطفل' : 'Modifier le groupe de l’enfant'}
                          className={`cursor-pointer rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            enfant.groupeAge === 'Bébés'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              : enfant.groupeAge === 'Moyens'
                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          }`}
                        >
                          <option value="Bébés">{isArabic ? 'رضع' : 'Bébés'}</option>
                          <option value="Moyens">{isArabic ? 'متوسطين' : 'Moyens'}</option>
                          <option value="Grands">{isArabic ? 'كبار' : 'Grands'}</option>
                        </select>
                      </div>

                      <div className="space-y-2 mt-3 text-xs font-semibold text-slate-500">
                        <div className="flex items-center gap-2 p-1 border-b border-dashed border-slate-100">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {t('children.born')}:{' '}
                            <strong className="text-slate-800">
                              {birthDate} ({calculerAge(enfant.dateNaissance)})
                            </strong>
                          </span>
                        </div>

                        {enfant.allergie?.trim() ? (
                          <div className="flex items-center gap-2 text-rose-700 bg-rose-50 px-2.5 py-1.5 border border-rose-100 rounded-xl">
                            <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                            <span className="font-bold text-[11px] truncate">
                              {t('children.allergy')}: <strong className="font-extrabold text-rose-900">{enfant.allergie}</strong>
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-400 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-xl text-[11px]">
                            <span>
                              {isArabic
                                ? 'الحساسية غير مسجلة — تحقق قبل تقديم الطعام'
                                : 'Allergies non renseignées — à vérifier avant le repas'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 bg-slate-50/60 rounded-xl p-2.5 border border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          {isArabic ? 'الملف الإداري والتراخيص' : 'Dossier administratif et autorisations'}
                        </p>
                        <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-slate-500">
                          {[
                            { k: 'certificatMedical' as DocumentKey, lbl: isArabic ? 'طبي' : 'Médic' },
                            { k: 'carnetVaccination' as DocumentKey, lbl: isArabic ? 'لقاح' : 'Vaccin' },
                            { k: 'justificatifDomicile' as DocumentKey, lbl: isArabic ? 'سكن' : 'Domi' },
                            { k: 'photoIdentite' as DocumentKey, lbl: isArabic ? 'صورة' : 'Photo' },
                          ].map(item => {
                            const ok = req[item.k] || Boolean(files[item.k]?.contenu);
                            return (
                              <div key={item.k} className="space-y-1">
                                <div
                                  className={`mx-auto w-5 h-5 rounded-md flex items-center justify-center font-bold ${
                                    ok ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                                  }`}
                                >
                                  {ok ? '✓' : '✗'}
                                </div>
                                <span className="block text-[9px] truncate">{item.lbl}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          {t('children.parents')}:
                        </p>
                        {enfant.parents.map(parent => {
                          const waNum = normalizeWhatsAppNumber(parent.telephone);
                          return (
                            <div key={parent.id} className="text-xs text-slate-600 flex items-center gap-1.5 mb-2 last:mb-0">
                              <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                              <span className="truncate font-bold text-slate-800">
                                {parent.prenom} {parent.nom}
                              </span>
                              <span className="shrink-0 text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded leading-none">
                                {parent.lien}
                              </span>
                              <div className="ms-auto flex shrink-0 items-center gap-1.5">
                                {parent.telephone && (
                                  <a
                                    href={`tel:${parent.telephone}`}
                                    aria-label={isArabic ? 'اتصال بالولي' : 'Appeler le parent'}
                                    className="rounded-lg bg-indigo-50 p-1.5 text-indigo-600 hover:bg-indigo-100 transition"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {waNum && (
                                  <a
                                    href={`https://wa.me/${waNum}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={isArabic ? 'واتساب الولي' : 'WhatsApp du parent'}
                                    className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition"
                                  >
                                    WA
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                      <button
                        type="button"
                        aria-label={isArabic ? 'عرض ملف الطفل' : 'Ouvrir le dossier de l’enfant'}
                        onClick={() => setSelectedEnfant(enfant)}
                        className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl font-bold text-xs transition cursor-pointer"
                      >
                        {isArabic ? 'عرض الملف' : 'Dossier'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModalForChild(enfant)}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition cursor-pointer"
                        title={isArabic ? 'تعديل' : 'Modifier'}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          enfant.statut === 'Actif' ? setSortieModalEnfant(enfant) : handleReintegrer(enfant)
                        }
                        className={`p-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                          enfant.statut === 'Actif'
                            ? 'bg-slate-50 hover:bg-amber-100 text-slate-600 hover:text-amber-700'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                        }`}
                        title={
                          enfant.statut === 'Actif'
                            ? isArabic
                              ? 'تسجيل خروج'
                              : 'Marquer comme sorti'
                            : isArabic
                              ? 'إعادة التسجيل'
                              : 'Réintégrer'
                        }
                      >
                        {enfant.statut === 'Actif' ? <LogOut size={15} /> : <RotateCcw size={15} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleDeleteEnfant();
                        }}
                        className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition cursor-pointer"
                        title={
                          isArabic
                            ? 'الحذف النهائي متوقف مؤقتاً'
                            : 'Suppression définitive temporairement désactivée'
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination progressive fluide pour 100 à 500+ enfants */}
          {filteredEnfants.length > displayedEnfants.length && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-2xs">
              <p className="text-xs font-semibold text-slate-500 tabular-nums">
                {isArabic
                  ? `عرض ${displayedEnfants.length} من أصل ${filteredEnfants.length} طفل`
                  : `${displayedEnfants.length} sur ${filteredEnfants.length} enfants affichés`}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount(prev => Math.min(filteredEnfants.length, prev + DIRECTORY_PAGE_STEP))
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800 cursor-pointer"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span>
                    {isArabic
                      ? `عرض ${Math.min(DIRECTORY_PAGE_STEP, filteredEnfants.length - displayedEnfants.length)} إضافي`
                      : `Afficher ${Math.min(DIRECTORY_PAGE_STEP, filteredEnfants.length - displayedEnfants.length)} de plus`}
                  </span>
                </button>
                {filteredEnfants.length - displayedEnfants.length > DIRECTORY_PAGE_STEP && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount(filteredEnfants.length)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 cursor-pointer"
                  >
                    {isArabic ? `عرض الكل (${filteredEnfants.length})` : `Tout afficher (${filteredEnfants.length})`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="col-span-full p-10 sm:p-12 bg-white rounded-2xl border border-slate-200/80 text-center text-slate-400">
          <HelpCircle className="w-9 h-9 mx-auto text-slate-300 stroke-[1.5] mb-2" />
          <p className="font-bold text-slate-700 text-sm">
            {isArabic ? 'لا توجد تطابقات للبحث' : 'Aucun dossier correspondant'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {isArabic
              ? 'جرّب تعديل الفلاتر أو البحث، أو أضف طفلاً جديداً.'
              : 'Ajustez vos filtres ou votre recherche, ou créez un nouveau dossier enfant.'}
          </p>
          {hasActiveDirectoryFilter && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setFilterGroupe('Tous');
                setQuickFilter('all');
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{isArabic ? 'إعادة ضبط الفلاتر' : 'Réinitialiser les filtres'}</span>
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-start justify-center p-2 sm:p-4 pt-2 sm:pt-24 font-sans overflow-y-auto"
            onClick={() => { if (!isSavingChild) setShowModal(false); }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="mobile-safe-modal bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-3xl max-h-[calc(100dvh-1rem)] flex flex-col overflow-hidden font-sans cursor-default mb-2 sm:mb-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex justify-between items-center gap-3 flex-shrink-0">
                <div>
                  <h3 className="text-base sm:text-xl font-black">
                    {editingEnfantId 
                      ? (isArabic ? 'تعديل ملف التلميذ' : 'Modifier le Dossier de l\'Élève') 
                      : (isArabic ? 'تسجيل طفل جديد وتكوين الملف' : 'Dossier d\'Admission Enfant')}
                  </h3>
                  <p className="text-xs text-indigo-100 mt-0.5">
                    {editingEnfantId 
                      ? (isArabic ? 'تحديث المعلومات الطبية، العائلية وتراخيص الملف الإداري' : 'Mise à jour des indicateurs et contacts du tuteur légal') 
                      : (isArabic ? 'يرجى تعبئة جميع المعلومات الطبية والعائلية والمستندات الإدارية الملحقة بدقة' : 'Saisie exhaustive d\'indicateurs physiologiques, pédiatriques et tuteur légal')}
                  </p>
                </div>
                <button 
                  onClick={() => { if (!isSavingChild) setShowModal(false); }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
                
                <div>
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3.5 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                    <Baby className="w-4 h-4" />
                    {isArabic ? 'أولاً: هوية الطفل ومواصفاته الصحية' : '1. Identité et Paramètres Physiologiques du Nourrisson'}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'الاسم الأول *' : 'Prénom *'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={isArabic ? 'مثال: أمين' : 'Ex: Amine'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.prenom}
                        onChange={e => setFormData({...formData, prenom: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'اللقب *' : 'Nom *'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={isArabic ? 'مثال: بلالي' : 'Ex: Belali'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.nom}
                        onChange={e => setFormData({...formData, nom: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'تاريخ الميلاد *' : 'Date de Naissance *'}
                      </label>
                      <input 
                        type="date"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800" 
                        value={formData.dateNaissance}
                        onChange={e => setFormData({...formData, dateNaissance: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'الجنس *' : 'Genre *'}
                      </label>
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                        value={formData.genre}
                        onChange={e => setFormData({...formData, genre: e.target.value as any})}
                      >
                        <option value="Garçon">{isArabic ? 'ذكر' : 'Garçon'}</option>
                        <option value="Fille">{isArabic ? 'أنثى' : 'Fille'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'القسم *' : 'Groupe Scolaire *'}
                      </label>
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                        value={formData.groupeAge}
                        onChange={e => setFormData({...formData, groupeAge: e.target.value as any})}
                      >
                        <option value="Bébés">{isArabic ? 'رضع (0-2 سنوات)' : 'Bébés (0-2 ans)'}</option>
                        <option value="Moyens">{isArabic ? 'متوسطين (2-4 سنوات)' : 'Moyens (2-4 ans)'}</option>
                        <option value="Grands">{isArabic ? 'كبار (4-6 سنوات)' : 'Grands (4-6 ans)'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'فصيلة الدم (اختياري)' : 'Groupe sanguin (facultatif)'}
                      </label>
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                        value={formData.bloodGroup}
                        onChange={e => setFormData({...formData, bloodGroup: e.target.value})}
                      >
                        <option value="">{isArabic ? 'غير مسجل' : 'Non renseigné'}</option>
                        <option value="O+">O+</option>
                        <option value="A+">A+</option>
                        <option value="B+">B+</option>
                        <option value="AB+">AB+</option>
                        <option value="O-">O-</option>
                        <option value="A-">A-</option>
                        <option value="B-">B-</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'حساسية أو عدم تحمل (⚠️)' : 'Allergie ou intolérance (⚠️)'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={isArabic ? 'مثال: لاكتوز، فول سوداني (فارغ إن لم يوجد)' : 'Ex: Lactose, Arachides (Vide si néant)'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.allergie}
                        onChange={e => setFormData({...formData, allergie: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'حمية غذائية خاصة' : 'Régime Alimentaire Spécial'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={isArabic ? 'مثال: خالي من الغلوتين، نباتي...' : 'Ex: Sans gluten, Halal, Végétarien...'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.regimeAlimentaire}
                        onChange={e => setFormData({...formData, regimeAlimentaire: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'يوم استحقاق الدفع الشهري' : 'Jour d\'échéance de paiement mensuel'}
                      </label>
                      <select
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                        value={formData.jourEcheanceMensuel}
                        onChange={e => setFormData({...formData, jourEcheanceMensuel: e.target.value})}
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(jour => (
                          <option key={jour} value={jour}>{jour}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        {isArabic
                          ? 'كل شهر، في هذا اليوم، يتم إنشاء فاتورة تلقائياً وتبقى الإشعارات ظاهرة حتى يتم الدفع.'
                          : 'Chaque mois, à ce jour, une facture est générée automatiquement et une notification reste active jusqu\'au règlement.'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'الطبيب المعالج' : 'Médecin traitant'}
                      </label>
                      <input
                        type="text"
                        placeholder={isArabic ? 'مثال: د. بن علي' : 'Ex : Dr. Benali'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                        value={formData.pediatricianName}
                        onChange={e => setFormData({...formData, pediatricianName: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'الوزن الحالي (كغ)' : 'Poids actuel (kg)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="Ex : 12,5"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                        value={formData.weightKg}
                        onChange={e => setFormData({...formData, weightKg: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'حالة اللقاحات' : 'Vaccinations'}
                      </label>
                      <input
                        type="text"
                        placeholder={isArabic ? 'مثال: محدثة — آخر جرعة: 05/2026' : 'Ex : À jour — dernier rappel : 05/2026'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                        value={formData.vaccinations}
                        onChange={e => setFormData({...formData, vaccinations: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'ملاحظات طبية' : 'Notes médicales'}
                      </label>
                      <textarea
                        rows={2}
                        placeholder={isArabic ? 'تعليمات أو معلومات مهمة للفريق...' : 'Instructions ou informations importantes pour l’équipe...'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800 resize-none"
                        value={formData.notesMedicales}
                        onChange={e => setFormData({...formData, notesMedicales: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3.5 pb-1 border-b border-slate-100 flex items-center gap-1.5 pt-2">
                    <User className="w-4 h-4" />
                    {isArabic ? 'ثانياً: معلومات الاتصال وولي الأمر' : '2. Coordonnées et Profil du Représentant Légal / Parent'}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'صلة القرابة *' : 'Lien tuteur *'}
                      </label>
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                        value={formData.parentLien}
                        onChange={e => setFormData({...formData, parentLien: e.target.value as any})}
                      >
                        <option value="Mère">{isArabic ? 'الأم' : 'Mère'}</option>
                        <option value="Père">{isArabic ? 'الأب' : 'Père'}</option>
                        <option value="Tuteur">{isArabic ? 'وصي قانوني' : 'Tuteur'}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'اسم الولي *' : 'Prénom Parent *'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={isArabic ? 'مثال: كريمة' : 'Ex: Karima'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.parentPrenom}
                        onChange={e => setFormData({...formData, parentPrenom: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'لقب الولي *' : 'Nom Parent *'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={isArabic ? 'مثال: بلالي' : 'Ex: Belali'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.parentNom}
                        onChange={e => setFormData({...formData, parentNom: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'رقم الهاتف *' : 'Téléphone principal *'}
                      </label>
                      <input 
                        type="tel" 
                        placeholder="0555 12 89 90"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800" 
                        value={formData.parentTelephone}
                        onChange={e => setFormData({...formData, parentTelephone: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'البريد الإلكتروني' : 'Adresse Email'}
                      </label>
                      <input 
                        type="email" 
                        placeholder="karima.b@exemple.dz"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.parentEmail}
                        onChange={e => setFormData({...formData, parentEmail: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                        {isArabic ? 'المهنة' : 'Profession'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={isArabic ? 'مثال: مهندس' : 'Ex: Architecte'}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                        value={formData.parentProfession}
                        onChange={e => setFormData({...formData, parentProfession: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                      {isArabic ? 'العنوان' : 'Adresse de Résidence'}
                    </label>
                    <input 
                      type="text" 
                      placeholder={isArabic ? 'الجزائر العاصمة' : 'Ex: 12 Rue Didouche Mourad, Alger'}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                      value={formData.parentAdresse}
                      onChange={e => setFormData({...formData, parentAdresse: e.target.value})} 
                    />
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3.5 pb-1 border-b border-slate-100 flex items-center gap-1.5 pt-2">
                    <FileText className="w-4 h-4" />
                    {isArabic ? 'ثالثاً: الملف الإداري والتصاريح' : '3. Liste des documents remis à l\'admission'}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 rounded-2xl p-3.5 sm:p-4">
                    {([
                      ['certificatMedical', isArabic ? 'الشهادة الطبية' : 'Certificat médical', 'docCertif'],
                      ['carnetVaccination', isArabic ? 'دفتر التلقيح' : 'Carnet de vaccination', 'docVaccin'],
                      ['justificatifDomicile', isArabic ? 'إثبات الإقامة' : 'Justificatif de domicile', 'docDomicile'],
                      ['photoIdentite', isArabic ? 'صورة الهوية' : 'Photo d\'identité', 'docPhoto'],
                    ] as Array<[DocumentKey, string, 'docCertif' | 'docVaccin' | 'docDomicile' | 'docPhoto']>).map(([key, label, legacyFlag]) => {
                      const attached = formData.docFiles[key];
                      const legacyDeclared = formData[legacyFlag];
                      return (
                        <DocumentScannerSlot
                          key={key}
                          docKey={key}
                          label={label}
                          isArabic={isArabic}
                          childName={`${formData.prenom} ${formData.nom}`.trim()}
                          value={attached}
                          declaredWithoutFile={Boolean(legacyDeclared && !attached)}
                          onError={msg => showToast(msg, 'error')}
                          onChange={nextDoc => {
                            setFormData(prev => {
                              const nextFiles = { ...prev.docFiles };
                              if (nextDoc) {
                                nextFiles[key] = nextDoc;
                              } else {
                                delete nextFiles[key];
                              }
                              return {
                                ...prev,
                                [legacyFlag]: Boolean(nextDoc),
                                docFiles: nextFiles,
                              };
                            });
                          }}
                        />
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] font-semibold text-slate-500">
                    {isArabic
                      ? 'تحويل محلي تلقائي للصور (صفحة أو عدة صفحات مثل دفتر التلقيح) إلى ملف PDF مضغوط وأقل من 2 ميغابايت.'
                      : 'Conversion locale automatique de vos photos (1 ou plusieurs pages pour le carnet de vaccination) en PDF propre < 2 Mo.'}
                  </p>
                </div>

              </div>

              <div className="p-6 pt-4 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-slate-50/50">
                <button 
                  type="button"
                  className="flex-1 p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-sm"
                  onClick={() => { if (!isSavingChild) setShowModal(false); }}
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="button"
                  className="flex-1 p-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-bold rounded-xl transition cursor-pointer text-sm shadow-md"
                  disabled={isSavingChild}
                  onClick={() => void handleAjouter()}
                >
                  {t('common.save')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ✅ Mini-modal : confirmer la sortie d'un enfant (date + motif) */}
      <AnimatePresence>
        {sortieModalEnfant && (
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            >
              <div className="flex items-center gap-2.5 mb-1">
                <LogOut className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-slate-900">
                  {isArabic ? 'تسجيل خروج الطفل' : 'Marquer comme sorti(e)'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                {isArabic ? sortieModalEnfant.prenom + ' ' + sortieModalEnfant.nom : `${sortieModalEnfant.prenom} ${sortieModalEnfant.nom}`}
              </p>

              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                {isArabic ? 'تاريخ الخروج' : 'Date de sortie'}
              </label>
              <input
                type="date"
                value={sortieDate}
                onChange={e => setSortieDate(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 text-sm font-semibold text-slate-800 mb-4"
              />

              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                {isArabic ? 'سبب الخروج' : 'Motif de sortie'}
              </label>
              <select
                value={sortieMotif}
                onChange={e => setSortieMotif(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 text-sm font-semibold text-slate-800 mb-6"
              >
                <option value="">{isArabic ? 'غير مسجل' : 'Non renseigné'}</option>
                {[
                  { fr: 'Fin d\'année scolaire', ar: 'نهاية السنة الدراسية' },
                  { fr: 'Déménagement', ar: 'انتقال / تغيير السكن' },
                  { fr: 'Changement de crèche', ar: 'تغيير الروضة' },
                  { fr: 'Problème de paiement', ar: 'مشكل في الدفع' },
                  { fr: 'Insatisfaction des parents', ar: 'عدم رضا الأولياء' },
                  { fr: 'Autre', ar: 'سبب آخر' },
                ].map(m => (
                  <option key={m.fr} value={m.fr}>{isArabic ? m.ar : m.fr}</option>
                ))}
              </select>

              <div className="flex gap-2.5">
                <button
                  disabled={savingExit}
                  onClick={() => setSortieModalEnfant(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition cursor-pointer"
                >
                  {isArabic ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  disabled={savingExit}
                  onClick={() => void handleConfirmerSortie()}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition cursor-pointer"
                >
                  {isArabic ? 'تأكيد' : 'Confirmer'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showImportWizard && (
          <div
            className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={isArabic ? 'استيراد قائمة الأطفال' : 'Importer une liste Excel / CSV'}
            onClick={() => !importingCsv && setShowImportWizard(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              onClick={e => e.stopPropagation()}
              className="flex max-h-[90dvh] w-full sm:max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5 shrink-0">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    <FileSpreadsheet className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm sm:text-base font-black text-slate-900">
                      {isArabic ? 'استيراد قائمة الأطفال' : 'Importer ma liste Excel'}
                    </h2>
                    <p className="truncate text-[11px] text-slate-500">
                      {isArabic ? 'ملف Excel (.xlsx) أو CSV أو لصق مباشر' : 'Fichier .xlsx, .csv ou collage direct'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImportWizard(false)}
                  aria-label={isArabic ? 'إغلاق' : 'Fermer'}
                  className="min-h-8! grid h-8 w-8 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="min-h-10! inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2.5 text-xs font-black text-white whitespace-nowrap transition">
                    <FileSpreadsheet className="h-4 w-4 shrink-0" />
                    <span className="truncate">{isArabic ? 'اختيار ملف Excel / CSV' : 'Choisir un fichier .xlsx / .csv'}</span>
                    <input
                      type="file"
                      accept=".xlsx,.csv,.tsv,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="hidden"
                      disabled={importingCsv || isReadOnly}
                      onChange={event => {
                        const file = event.target.files?.[0];
                        void handleCsvImport(file);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleDownloadImportTemplate}
                    className="min-h-10! inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3.5 py-2.5 text-xs font-bold text-slate-700 whitespace-nowrap transition cursor-pointer"
                  >
                    <Download className="h-4 w-4 shrink-0 text-indigo-600" />
                    <span className="truncate">{isArabic ? 'تحميل نموذج Excel' : 'Télécharger le modèle'}</span>
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    {isArabic ? 'أو الصق الجدول مباشرة من Excel :' : 'Ou collez directement vos lignes depuis Excel :'}
                    <textarea
                      rows={4}
                      value={pasteImportText}
                      onChange={e => setPasteImportText(e.target.value)}
                      placeholder={
                        isArabic
                          ? 'اللقب\tالاسم\tتاريخ الميلاد\tالجنس\tالفئة\tالهاتف\nبن عيسى\tآدم\t15/03/2023\tذكر\tمتوسطون\t0555123456'
                          : 'Nom\tPrénom\tDate de naissance\tGenre\tGroupe\tTéléphone\nBenaissa\tAdam\t15/03/2023\tGarçon\tMoyens\t0555123456'
                      }
                      className="mt-1.5 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </label>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!pasteImportText.trim()}
                      onClick={handlePasteSpreadsheetImport}
                      className="min-h-9! inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-black text-white whitespace-nowrap transition disabled:opacity-40 cursor-pointer"
                    >
                      <span>{isArabic ? 'معاينة الجدول الملصق' : 'Analyser le collage'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {importPreview && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6" onClick={() => !importingCsv && setImportPreview(null)}>
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              onClick={event => event.stopPropagation()}
              className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-indigo-700"><FileSpreadsheet className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-wider">{isArabic ? 'استيراد الأطفال' : 'Import des enfants'}</span></div>
                  <h2 className="mt-1 truncate text-lg font-black text-slate-900 sm:text-xl">{isArabic ? 'مراجعة الملف قبل الحفظ' : 'Vérifier le fichier avant l’enregistrement'}</h2>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">{importPreview.fileName} • séparateur « {importPreview.separator} »</p>
                </div>
                <button type="button" disabled={importingCsv} onClick={() => setImportPreview(null)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40" aria-label={isArabic ? 'إغلاق' : 'Fermer'}><X className="h-5 w-5" /></button>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-4 sm:gap-3 sm:p-5">
                <div className="rounded-2xl bg-white p-3 shadow-sm"><p className="text-[10px] font-black uppercase text-slate-400">Lignes</p><p className="mt-1 text-xl font-black text-slate-900">{importPreview.totalRows}</p></div>
                <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-[10px] font-black uppercase text-emerald-600">À importer</p><p className="mt-1 text-xl font-black text-emerald-700">{importPreview.rows.filter(row => !row.invalid).length}</p></div>
                <div className="rounded-2xl bg-amber-50 p-3"><p className="text-[10px] font-black uppercase text-amber-600">À compléter</p><p className="mt-1 text-xl font-black text-amber-700">{importPreview.rows.filter(row => !row.invalid && row.missing.length > 0).length}</p></div>
                <div className="rounded-2xl bg-slate-100 p-3"><p className="text-[10px] font-black uppercase text-slate-500">Lignes vides</p><p className="mt-1 text-xl font-black text-slate-700">{importPreview.rows.filter(row => row.invalid).length}</p></div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-xs font-semibold leading-5 text-indigo-900">
                  {isArabic ? 'سيتم حفظ الأسطر حتى لو كانت ناقصة. سيتم وضع علامة على المعلومات الناقصة ويمكنك إكمالها لاحقاً من قائمة الأطفال.' : 'Les lignes seront enregistrées même si certaines informations manquent. Les champs incomplets sont signalés et pourront être complétés plus tard depuis la liste des enfants.'}
                </div>
                <div className="mb-5 flex flex-wrap gap-2">
                  {importPreview.columnMap.map(mapping => <span key={mapping} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">{mapping}</span>)}
                </div>
                <div className="space-y-2">
                  {importPreview.rows.slice(0, 200).map(row => (
                    <div key={row.rowNumber} className={`rounded-2xl border p-3 ${row.invalid ? 'border-slate-200 bg-slate-50 opacity-60' : row.missing.length > 0 ? 'border-amber-200 bg-amber-50/70' : 'border-emerald-200 bg-emerald-50/50'}`}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800"><span className="text-slate-400">Ligne {row.rowNumber}</span> · {row.draft.prenom} {row.draft.nom}</p>
                          <p className="mt-1 text-[11px] font-semibold text-slate-600">{row.draft.dateNaissance || 'Date de naissance non renseignée'} · {row.draft.parentTelephone || 'Téléphone parent non renseigné'}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${row.invalid ? 'bg-slate-200 text-slate-600' : row.missing.length > 0 ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'}`}>
                          {row.invalid ? 'Ligne vide ignorée' : row.missing.length > 0 ? 'Sera importée · à compléter' : 'Prête à importer'}
                        </span>
                      </div>
                      {!row.invalid && row.missing.length > 0 && <p className="mt-2 text-[11px] font-bold text-amber-800">Manquants : {row.missing.join(', ')}</p>}
                      {!row.invalid && row.warnings.length > 0 && <p className="mt-1 text-[11px] font-bold text-orange-700">À vérifier : {row.warnings.join(', ')}</p>}
                    </div>
                  ))}
                  {importPreview.rows.length > 200 && <p className="pt-3 text-center text-[11px] font-bold text-slate-500">+ {importPreview.rows.length - 200} autres lignes seront importées après confirmation</p>}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-white p-4 sm:flex-row sm:justify-end sm:p-5">
                <button type="button" disabled={importingCsv} onClick={() => setImportPreview(null)} className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:opacity-50">{isArabic ? 'إلغاء' : 'Annuler'}</button>
                <button type="button" disabled={importingCsv || importPreview.rows.every(row => row.invalid)} onClick={() => void confirmCsvImport()} className="rounded-xl bg-indigo-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {importingCsv ? (isArabic ? 'جاري الحفظ...' : 'Enregistrement...') : `Importer ${importPreview.rows.filter(row => !row.invalid).length} fiche(s)`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {actionSheetEnfant && (() => {
        const sheetParent = actionSheetEnfant.parents[0];
        const sheetTel = normalizeTelHref(sheetParent?.telephone);
        const sheetWa = normalizeWhatsAppNumber(sheetParent?.telephone);
        const sheetDocs = getCompletedDocsCount(actionSheetEnfant);
        return (
          <div
            className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-slate-950/45 p-0 sm:p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label={
              isArabic
                ? `إجراءات ${actionSheetEnfant.prenom} ${actionSheetEnfant.nom}`
                : `Gestion rapide — ${actionSheetEnfant.prenom} ${actionSheetEnfant.nom}`
            }
            onClick={() => setActionSheetEnfantId(null)}
          >
            <div
              className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl space-y-3.5"
              onClick={e => e.stopPropagation()}
            >
              <div className="mx-auto h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold ring-1 ring-inset ${
                      actionSheetEnfant.genre === 'Fille'
                        ? 'bg-rose-50 text-rose-700 ring-rose-200/80'
                        : 'bg-sky-50 text-sky-700 ring-sky-200/80'
                    }`}
                  >
                    {(actionSheetEnfant.prenom?.[0] || '').toUpperCase()}
                    {(actionSheetEnfant.nom?.[0] || '').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-slate-900">
                      {actionSheetEnfant.prenom} {actionSheetEnfant.nom}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                      {calculerAge(actionSheetEnfant.dateNaissance)} ·{' '}
                      <span className={sheetDocs === 4 ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>
                        {isArabic ? `الملف ${sheetDocs}/4` : `Dossier ${sheetDocs}/4`}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActionSheetEnfantId(null)}
                  aria-label={isArabic ? 'إغلاق' : 'Fermer'}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {actionSheetEnfant.allergie?.trim() && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
                  <span className="truncate">
                    {isArabic ? 'حساسية مسجلة:' : 'Allergie :'}{' '}
                    <strong className="font-bold">{actionSheetEnfant.allergie}</strong>
                  </span>
                </div>
              )}

              {(sheetTel || sheetWa) && (
                <div className="grid grid-cols-2 gap-2">
                  {sheetTel ? (
                    <a
                      href={sheetTel}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-100"
                    >
                      <Phone className="h-3.5 w-3.5 text-indigo-600" />
                      <span className="truncate">
                        {isArabic ? 'اتصال بالولي' : `Appeler ${sheetParent?.prenom || 'parent'}`}
                      </span>
                    </a>
                  ) : (
                    <div />
                  )}
                  {sheetWa && (
                    <a
                      href={`https://wa.me/${sheetWa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              )}

              {!isReadOnly && (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-2.5">
                  <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {isArabic ? 'تغيير القسم سريعاً' : 'Section / Groupe'}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { key: 'Bébés', label: isArabic ? 'رضع' : 'Bébés' },
                        { key: 'Moyens', label: isArabic ? 'متوسطون' : 'Moyens' },
                        { key: 'Grands', label: isArabic ? 'كبار' : 'Grands' },
                      ] as const
                    ).map(sec => {
                      const active = actionSheetEnfant.groupeAge === sec.key;
                      return (
                        <button
                          key={sec.key}
                          type="button"
                          disabled={quickUpdatingEnfantId !== null}
                          onClick={() => void handleQuickGroupChange(actionSheetEnfant, sec.key)}
                          className={`min-h-9 rounded-xl px-2 py-1.5 text-xs font-bold transition cursor-pointer disabled:opacity-60 ${
                            active
                              ? 'bg-slate-900 text-white shadow-2xs'
                              : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {sec.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    const target = actionSheetEnfant;
                    setActionSheetEnfantId(null);
                    setSelectedEnfant(target);
                  }}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-xs font-bold text-slate-800 transition hover:bg-slate-50 cursor-pointer"
                >
                  <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
                  <span>{isArabic ? 'فتح الملف الكامل والوثائق PDF' : 'Ouvrir le dossier complet & pièces PDF'}</span>
                </button>

                {!isReadOnly && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const target = actionSheetEnfant;
                        setActionSheetEnfantId(null);
                        openEditModalForChild(target);
                      }}
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-xs font-bold text-slate-800 transition hover:bg-slate-50 cursor-pointer"
                    >
                      <Pencil className="h-4 w-4 shrink-0 text-slate-500" />
                      <span>{isArabic ? 'تعديل معلومات الطفل' : 'Modifier la fiche de l’enfant'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const target = actionSheetEnfant;
                        setActionSheetEnfantId(null);
                        if (target.statut === 'Actif') {
                          setSortieModalEnfant(target);
                        } else {
                          void handleReintegrer(target);
                        }
                      }}
                      className={`flex w-full items-center gap-3 px-3.5 py-3 text-xs font-bold transition hover:bg-slate-50 cursor-pointer ${
                        actionSheetEnfant.statut === 'Actif' ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {actionSheetEnfant.statut === 'Actif' ? (
                        <LogOut className="h-4 w-4 shrink-0" />
                      ) : (
                        <RotateCcw className="h-4 w-4 shrink-0" />
                      )}
                      <span>
                        {actionSheetEnfant.statut === 'Actif'
                          ? isArabic
                            ? 'تسجيل خروج الطفل من الروضة'
                            : 'Marquer l’enfant comme sorti'
                          : isArabic
                            ? 'إعادة تسجيل الطفل'
                            : 'Réintégrer l’enfant'}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {selectedEnfant && (
        <EnfantDetails
          enfant={enfants.find(e => e.id === selectedEnfant.id) || selectedEnfant}
          onClose={() => setSelectedEnfant(null)}
        />
      )}
    </div>
  );
}
