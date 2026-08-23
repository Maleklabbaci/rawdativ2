import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { Enfant, InscriptionLink } from '../types';
import EnfantDetails from './EnfantDetails';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { useToast } from '../contexts/ToastContext';
import { motion, AnimatePresence } from 'motion/react';
import * as QRCode from 'qrcode';

type DocumentKey = 'certificatMedical' | 'carnetVaccination' | 'justificatifDomicile' | 'photoIdentite';
type DocumentUpload = { nom: string; type: string; taille: number; contenu: string; ajouteLe: string };

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

export default function Enfants() {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const { confirm } = useConfirmDialog();
  const { showToast } = useToast();

  const {
    enfants: allEnfants,
    addEnfant,
    deleteEnfant,
    updateEnfant,
    inscriptionLinks,
    demandesAdmission,
    decideAdmission,
  } = useDb();
  const { user } = useAuth();
  const isDirecteur = user?.role === 'directeur';
  const enfants = allEnfants
    .filter((e): e is Enfant => Boolean(e && e.id))
    .filter(e => !isDirecteur || e.crecheId === user?.id);

  const handleDeleteEnfant = async (enfant: Enfant) => {
    const confirmed = await confirm({
      title: isArabic ? 'تأكيد حذف ملف الطفل' : 'Confirmer la suppression du dossier',
      message: isArabic
        ? 'سيتم حذف الطفل وجميع سجلات الحضور والفواتير المرتبطة به. لا يمكن التراجع عن هذا الإجراء.'
        : 'L’enfant ainsi que ses présences et factures associées seront supprimés. Cette action est irréversible.',
      confirmLabel: isArabic ? 'حذف نهائياً' : 'Supprimer définitivement',
      cancelLabel: isArabic ? 'إلغاء' : 'Annuler',
      variant: 'danger',
    });
    if (confirmed) await deleteEnfant(enfant.id);
  };
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroupe, setFilterGroupe] = useState('Tous');
  const [showModal, setShowModal] = useState(false);
  const [showInactifs, setShowInactifs] = useState(false); // ✅ affiche aussi les enfants sortis
  const [sortieModalEnfant, setSortieModalEnfant] = useState<any | null>(null); // ✅ enfant en cours de "marquer comme sorti"
  const [sortieDate, setSortieDate] = useState(new Date().toISOString().split('T')[0]);
  const [sortieMotif, setSortieMotif] = useState('Fin d\'année scolaire');
  const [selectedEnfant, setSelectedEnfant] = useState<Enfant | null>(null);
  const [editingEnfantId, setEditingEnfantId] = useState<string | null>(null);
  const [quickUpdatingEnfantId, setQuickUpdatingEnfantId] = useState<string | null>(null);
  const isReadOnly = user?.role === 'directeur' && user.approvalStatus === 'pending';
  
  // خاصية جديدة: تغيير طريقة العرض بين شبكة (Grid) وقائمة (List)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showAdmissionQr, setShowAdmissionQr] = useState(false);
  const [newAdmissionLink, setNewAdmissionLink] = useState<(InscriptionLink & { token: string }) | null>(null);
  const [admissionQrDataUrl, setAdmissionQrDataUrl] = useState('');
  const [admissionLinkCopied, setAdmissionLinkCopied] = useState(false);
  const [admissionActionId, setAdmissionActionId] = useState<string | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    dateNaissance: '',
    genre: 'Garçon' as 'Garçon' | 'Fille',
    groupeAge: 'Bébés' as 'Bébés' | 'Moyens' | 'Grands',
    allergie: '',
    regimeAlimentaire: '',
    bloodGroup: 'O+',
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

  // Le token est conservé dans le lien permanent et le QR est reconstruit après chaque chargement.
  useEffect(() => {
    const persistedLink = inscriptionLinks.find(link => link.active && Boolean(link.token));
    if (!persistedLink?.token) {
      setNewAdmissionLink(null);
      setAdmissionQrDataUrl('');
      return;
    }
    const linkWithToken = persistedLink as InscriptionLink & { token: string };
    setNewAdmissionLink(linkWithToken);
    const url = `${window.location.origin}/admission?token=${encodeURIComponent(linkWithToken.token)}`;
    QRCode.toDataURL(url, {
      width: 440,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#172554', light: '#ffffff' },
    }).then(setAdmissionQrDataUrl).catch(error => console.error('Erreur de restauration du QR:', error));
  }, [inscriptionLinks]);


  const copyAdmissionLink = async () => {
    if (!admissionLinkUrl) return;
    await navigator.clipboard?.writeText(admissionLinkUrl);
    setAdmissionLinkCopied(true);
    window.setTimeout(() => setAdmissionLinkCopied(false), 1800);
  };

  const downloadAdmissionQr = () => {
    if (!admissionQrDataUrl) return;
    const anchor = document.createElement('a');
    anchor.href = admissionQrDataUrl;
    anchor.download = 'rawdha-admission-qr.png';
    anchor.click();
  };

  const filteredEnfants = enfants.filter(enfant => {
    const term = searchTerm.toLowerCase();
    const nameMatch = `${enfant.prenom} ${enfant.nom}`.toLowerCase().includes(term);
    const parentMatch = enfant.parents.some(p => `${p.prenom} ${p.nom}`.toLowerCase().includes(term));
    const matchesSearch = nameMatch || parentMatch;
    
    let matchesGroupe = true;
    if (filterGroupe !== 'Tous' && filterGroupe !== 'الكل') {
      const normalizedFilter = filterGroupe.includes('Bébés') || filterGroupe.includes('رضع') ? 'Bébés' :
                               filterGroupe.includes('Moyens') || filterGroupe.includes('متوسطين') ? 'Moyens' : 'Grands';
      matchesGroupe = enfant.groupeAge === normalizedFilter;
    }
    
    const matchesStatut = showInactifs ? true : enfant.statut === 'Actif';
    return matchesSearch && matchesGroupe && matchesStatut;
  });

  // ✅ Marque un enfant comme "sorti" : statut Inactif + date + motif de sortie
  const handleConfirmerSortie = () => {
    if (!sortieModalEnfant) return;
    updateEnfant(sortieModalEnfant.id, {
      statut: 'Inactif',
      dateSortie: sortieDate,
      motifSortie: sortieMotif,
    });
    setSortieModalEnfant(null);
    setSortieDate(new Date().toISOString().split('T')[0]);
    setSortieMotif('Fin d\'année scolaire');
  };

  // ✅ Réintègre un enfant marqué comme sorti par erreur
  const handleReintegrer = (enfant: any) => {
    updateEnfant(enfant.id, {
      statut: 'Actif',
      dateSortie: undefined,
      motifSortie: undefined,
    });
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

  // Les pièces sont limitées à 2 Mo pour rester compatibles avec le stockage
  // JSONB existant. Le fichier est réellement encodé et enregistré avec le dossier.
  const handleDocumentFile = (key: DocumentKey, file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast(
        isArabic ? 'الملف كبير جداً (الحد الأقصى 2 ميغابايت).' : 'Le fichier est trop volumineux (2 Mo maximum).',
        'error',
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const contenu = typeof reader.result === 'string' ? reader.result : '';
      if (!contenu) return;
      setFormData(prev => ({
        ...prev,
        [key === 'certificatMedical' ? 'docCertif' : key === 'carnetVaccination' ? 'docVaccin' : key === 'justificatifDomicile' ? 'docDomicile' : 'docPhoto']: true,
        docFiles: {
          ...prev.docFiles,
          [key]: { nom: file.name, type: file.type || 'application/octet-stream', taille: file.size, contenu, ajouteLe: new Date().toISOString() }
        }
      }));
    };
    reader.readAsDataURL(file);
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
    return headers.findIndex(header => normalizedAliases.some(alias => alias.length >= 4 && (header.includes(alias) || alias.includes(header))));
  };

  const buildImportPreview = (fileName: string, text: string): ImportPreview => {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('empty');
    if (lines.length > 10001) throw new Error('too_many_rows');
    const separator = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    const rawHeaders = parseCsvLine(lines[0], separator);
    const headers = rawHeaders.map(normalizeImportHeader);
    const columns = {
      nom: findImportColumn(headers, ['nom', 'lastname', 'surname', 'nomenfant', 'nomdelenfant']),
      prenom: findImportColumn(headers, ['prenom', 'firstname', 'givenname', 'prenomenfant', 'prenomenfant']),
      dateNaissance: findImportColumn(headers, ['datenaissance', 'datebirth', 'birthdate', 'naissance', 'ddn']),
      genre: findImportColumn(headers, ['genre', 'sexe', 'gender']),
      groupeAge: findImportColumn(headers, ['groupeage', 'groupe', 'section', 'classe', 'niveau']),
      parentNom: findImportColumn(headers, ['parentnom', 'nomparent', 'nompere', 'nommere', 'nomresponsable']),
      parentPrenom: findImportColumn(headers, ['parentprenom', 'prenomparent', 'prenomresponsable']),
      parentTelephone: findImportColumn(headers, ['parenttelephone', 'telephoneparent', 'telephone', 'tel', 'mobile', 'gsm']),
      parentEmail: findImportColumn(headers, ['parentemail', 'emailparent', 'email', 'courriel']),
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
    for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
      const row = parseCsvLine(lines[rowIndex], separator).map(normalizeImportValue);
      const valueAt = (index: number) => index >= 0 ? (row[index] || '') : '';
      const rawDate = valueAt(columns.dateNaissance);
      const dateNaissance = normalizeImportDate(rawDate);
      const nom = valueAt(columns.nom);
      const prenom = valueAt(columns.prenom);
      const parentNom = valueAt(columns.parentNom);
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
    return { fileName, separator, totalRows: rows.length, headers: rawHeaders, columnMap, rows };
  };

  const handleCsvImport = async (file?: File) => {
    if (!file) return;
    setImportingCsv(true);
    setImportResult(null);
    try {
      const text = (await file.text()).replace(/^\uFEFF/, '');
      setImportPreview(buildImportPreview(file.name, text));
    } catch (error) {
      const message = error instanceof Error && error.message === 'too_many_rows'
        ? (isArabic ? 'الملف يحتوي على أكثر من 10000 سطر.' : 'Le fichier dépasse la limite de 10 000 lignes.')
        : (isArabic ? 'تعذر قراءة الملف. استخدم CSV مفصولاً بفاصلة أو فاصلة منقوطة.' : 'Impossible de lire ce fichier. Utilisez un CSV séparé par une virgule ou un point-virgule.');
      showToast(message, 'error');
    } finally {
      setImportingCsv(false);
    }
  };

  const confirmCsvImport = async () => {
    if (!importPreview) return;
    setImportingCsv(true);
    try {
      const rowsToImport = importPreview.rows.filter(row => !row.invalid);
      let imported = 0;
      for (let start = 0; start < rowsToImport.length; start += 10) {
        const batch = rowsToImport.slice(start, start + 10);
        await Promise.all(batch.map(async row => {
          const draft = row.draft;
          const parentDisplayName = `${draft.parentPrenom} ${draft.parentNom}`.trim();
          const enfant = {
            id: createImportId('csv_child', row.rowNumber),
            crecheId: isDirecteur ? user?.id : undefined,
            nom: draft.nom,
            prenom: draft.prenom,
            dateNaissance: draft.dateNaissance,
            genre: draft.genre,
            groupeAge: draft.groupeAge,
            dateInscription: new Date().toISOString().split('T')[0],
            statut: 'Actif',
            contactsUrgence: [{ id: createImportId('csv_contact', row.rowNumber), nom: parentDisplayName, telephone: draft.parentTelephone, lien: 'Mère' }],
            parents: [{ id: createImportId('csv_parent', row.rowNumber), nom: draft.parentNom, prenom: draft.parentPrenom, lien: 'Mère', telephone: draft.parentTelephone, email: draft.parentEmail || undefined }],
            documentsRequis: { ...DEFAULT_DOCUMENTS_REQUIS },
          } as Omit<Enfant, 'id'>;
          await addEnfant(enfant);
        }));
        imported += batch.length;
      }
      const importResultData: ImportResult = {
        fileName: importPreview.fileName,
        imported,
        incomplete: rowsToImport.filter(row => row.missing.length > 0).length,
        skipped: importPreview.rows.filter(row => row.invalid).length,
        rows: rowsToImport,
      };
      setImportResult(importResultData);
      setImportPreview(null);
    } catch {
      showToast(
        isArabic ? 'تعذر حفظ بعض السجلات. يرجى المحاولة مرة أخرى.' : 'L’import a rencontré un problème. Vérifiez votre connexion puis réessayez.',
        'error',
      );
    } finally {
      setImportingCsv(false);
    }
  };

  const handleAjouter = () => {
    if (!formData.nom || !formData.prenom || !formData.dateNaissance || 
        !formData.parentNom || !formData.parentTelephone) {
      showToast(
        isArabic ? 'يرجى ملء جميع الحقول المطلوبة *' : 'Veuillez remplir tous les champs obligatoires *',
        'error',
      );
      return;
    }

    if (editingEnfantId) {
      const existing = enfants.find(item => item.id === editingEnfantId);
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
        contactsUrgence: [
          {
            id: existing?.contactsUrgence[0]?.id || `${Date.now()}-contact`,
            nom: `${formData.parentPrenom} ${formData.parentNom}`,
            telephone: formData.parentTelephone,
            lien: formData.parentLien
          }
        ],
        parents: [
          {
            id: existing?.parents[0]?.id || `${Date.now()}-parent`,
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
      updateEnfant(editingEnfantId, updatedEnfant);
      setEditingEnfantId(null);
    } else {
      const nouvelEnfant: Enfant = {
        id: `${Date.now()}`,
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
      addEnfant(nouvelEnfant);
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
      bloodGroup: 'O+',
      weightKg: '12',
      pediatricianName: 'Dr. Belkacem',
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

  return (
    <div className="space-y-4 sm:space-y-8 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Baby className="w-6 h-6 sm:w-8 sm:h-8 text-rose-500 animate-pulse" />
            {t('children.title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-bold">
            {filteredEnfants.length} {t('children.enrolled')}
          </p>
        </div>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 sm:w-auto">
          <FileSpreadsheet size={16} />
          <span>{importingCsv ? (isArabic ? 'جاري الاستيراد...' : 'Import...') : (isArabic ? 'استيراد CSV' : 'Importer CSV')}</span>
          <input type="file" accept=".csv,text/csv" className="hidden" disabled={importingCsv} onChange={event => { const file = event.target.files?.[0]; void handleCsvImport(file); event.currentTarget.value = ''; }} />
        </label>
        <button 
          onClick={() => {
            setEditingEnfantId(null);
            setFormData({
              nom: '',
              prenom: '',
              dateNaissance: '',
              genre: 'Garçon',
              groupeAge: 'Bébés',
              allergie: '',
              regimeAlimentaire: '',
              bloodGroup: 'O+',
              weightKg: '12',
              pediatricianName: 'Dr. Belkacem',
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
              docCertif: true,
              docVaccin: true,
              docDomicile: false,
              docPhoto: false,
              jourEcheanceMensuel: '5',
            });
            setShowModal(true);
          }}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-rose-500/10 hover:shadow-rose-500/20 transition-all cursor-pointer border border-transparent w-full sm:w-auto"
        >
          <Plus size={16} className="stroke-[3]" />
          <span>{t('children.add')}</span>
        </button>
      </div>

      {importResult && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-black">{isArabic ? 'اكتمل استيراد الأطفال' : 'Import terminé'}</p>
                <p className="mt-1 text-xs font-semibold text-emerald-800">
                  {isArabic ? `${importResult.imported} ملف مستورد` : `${importResult.imported} fiche(s) importée(s)`}
                  {importResult.incomplete > 0 && (isArabic ? ` • ${importResult.incomplete} تحتاج إلى استكمال` : ` • ${importResult.incomplete} avec des informations manquantes`)}
                  {importResult.skipped > 0 && (isArabic ? ` • ${importResult.skipped} سطر فارغ تم تجاهله` : ` • ${importResult.skipped} ligne(s) vide(s) ignorée(s)`)}
                </p>
                {importResult.incomplete > 0 && (
                  <p className="mt-2 text-xs font-bold text-amber-700">{isArabic ? 'تم حفظ السجلات الناقصة ويمكن استكمالها من قائمة الأطفال.' : 'Les fiches incomplètes sont enregistrées et peuvent être complétées depuis la liste des enfants.'}</p>
                )}
              </div>
            </div>
            <button type="button" onClick={() => setImportResult(null)} className="self-end rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 sm:self-start" aria-label={isArabic ? 'إغلاق' : 'Fermer'}><X className="h-4 w-4" /></button>
          </div>
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

      <section className="min-w-0 overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-800 p-4 text-white shadow-xl shadow-indigo-900/10 sm:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-2xl bg-white/10 p-3"><QrCode className="h-6 w-6 text-indigo-200" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">RAWDHA+ • {isArabic ? 'قبول الأطفال' : 'Admission enfant'}</p>
              <h2 className="mt-1 break-words text-lg sm:text-xl font-black">{isArabic ? 'رمز QR داخل صفحة الأطفال' : 'Admission par QR, directement dans Enfants'}</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-indigo-100/75">{isArabic ? 'رمز QR دائم يتم إنشاؤه تلقائياً لهذه الروضة. يمكن للأولياء فتحه لعرض استمارة التسجيل فقط، ولا يمنحهم أي وصول إلى بياناتكم الداخلية.' : 'Un seul QR permanent est créé automatiquement pour cette crèche. Il ouvre uniquement le formulaire public d’admission et ne donne aucun accès à vos données internes.'}</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowAdmissionQr(value => !value)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black text-indigo-800 shadow-lg transition hover:bg-indigo-50">
            {showAdmissionQr ? <X className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
            {showAdmissionQr ? (isArabic ? 'إغلاق' : 'Fermer') : (isArabic ? 'عرض QR الدائم' : 'Afficher mon QR permanent')}
          </button>
        </div>

        {showAdmissionQr && (
          <div className="mt-6 grid gap-5 border-t border-white/10 pt-5 xl:grid-cols-[1fr_auto]">
            <div>
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
                {isArabic ? 'هذا هو رمز الروضة الوحيد والدائم. شاركوه مع الأولياء لاستقبال الطلبات، ثم راجعوا كل ملف قبل الإضافة.' : 'Ce QR est le seul QR permanent de votre crèche. Partagez-le, puis vérifiez chaque dossier avant de l’ajouter à votre gestion.'}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-indigo-100/75">
                <span className="rounded-full bg-white/10 px-3 py-1.5">{inscriptionLinks.filter(link => link.active).length} {isArabic ? 'روابط نشطة' : 'lien(s) actif(s)'}</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">{demandesAdmission.filter(item => item.statut === 'en_attente').length} {isArabic ? 'طلبات معلقة' : 'demande(s) en attente'}</span>
              </div>
              {newAdmissionLink && admissionLinkUrl && (
                <div className="mt-4 rounded-2xl bg-white p-4 text-slate-900">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">{isArabic ? 'رمز QR الدائم لروضتك' : 'QR permanent de votre crèche'}</p>
                  <p className="mt-2 break-all rounded-xl bg-slate-50 p-3 text-[11px] font-semibold text-slate-600">{admissionLinkUrl}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={copyAdmissionLink} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100"><Copy className="h-3.5 w-3.5" />{admissionLinkCopied ? (isArabic ? 'تم النسخ' : 'Copié') : (isArabic ? 'نسخ' : 'Copier')}</button>
                    <button type="button" onClick={downloadAdmissionQr} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"><Download className="h-3.5 w-3.5" />{isArabic ? 'تحميل QR' : 'Télécharger QR'}</button>
                    <a href={admissionLinkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"><ExternalLink className="h-3.5 w-3.5" />{isArabic ? 'فتح الرابط' : 'Ouvrir le lien'}</a>
                  </div>
                </div>
              )}
            </div>
            {demandesAdmission.some(item => item.statut === 'en_attente') && (
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-white">{isArabic ? 'طلبات وصلت عبر هذا QR' : 'Demandes reçues via ce QR'}</p>
                  <span className="rounded-full bg-amber-300/20 px-2.5 py-1 text-[10px] font-black text-amber-100">{demandesAdmission.filter(item => item.statut === 'en_attente').length}</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {demandesAdmission.filter(item => item.statut === 'en_attente').map(demande => (
                    <div key={demande.id} className="rounded-xl bg-white p-3 text-slate-900">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-black">{demande.prenom} {demande.nom}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{demande.parentPrenom} {demande.parentNom} · {demande.parentTelephone}</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">{new Date(demande.dateDemande).toLocaleDateString(isArabic ? 'ar-DZ' : 'fr-DZ')}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" disabled={admissionActionId === demande.id} onClick={async () => { setAdmissionActionId(demande.id); try { await decideAdmission(demande.id, 'acceptee'); } finally { setAdmissionActionId(null); } }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-60">{isArabic ? 'قبول وإضافة' : 'Accepter et ajouter'}</button>
                        <button type="button" disabled={admissionActionId === demande.id} onClick={async () => { setAdmissionActionId(demande.id); try { await decideAdmission(demande.id, 'refusee'); } finally { setAdmissionActionId(null); } }} className="rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] font-black text-rose-700 disabled:opacity-60">{isArabic ? 'رفض' : 'Refuser'}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {admissionQrDataUrl && <img src={admissionQrDataUrl} alt={isArabic ? 'رمز قبول QR' : 'QR admission enfant'} className="mx-auto h-40 w-40 rounded-2xl border-4 border-white bg-white p-2 shadow-lg" />}
          </div>
        )}
      </section>

      <div className="min-w-0 bg-white p-3 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('children.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-rose-500 focus:bg-white transition-all text-xs sm:text-sm font-medium text-slate-800"
          />
        </div>

        <div className="mobile-scroll-x flex items-center gap-2 w-full md:w-auto pb-1 md:pb-0 scrollbar-none flex-nowrap shrink-0">
          {/* Toggle View Mode Buttons */}
          <div className="flex bg-slate-100 p-1 rounded-xl mr-2 rtl:ml-2">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`}
              title={isArabic ? 'عرض كقائمة' : 'Vue en liste'}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-700'}`}
              title={isArabic ? 'عرض كبطاقات' : 'Vue en grille'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {[
            { key: 'Tous', label: t('children.all') },
            { key: 'Bébés', label: t('children.babies') },
            { key: 'Moyens', label: t('children.middle') },
            { key: 'Grands', label: t('children.seniors') }
          ].map(grp => (
            <button
              key={grp.key}
              onClick={() => setFilterGroupe(grp.key)}
              className={`flex-grow sm:flex-none px-3.5 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 ${
                filterGroupe === grp.key
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-500 hover:text-slate-800'
              }`}
            >
              {grp.label}
            </button>
          ))}

          {/* ✅ Toggle : afficher aussi les enfants sortis */}
          <button
            onClick={() => setShowInactifs(prev => !prev)}
            className={`flex-grow sm:flex-none px-3.5 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              showInactifs
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-50 text-slate-500 hover:text-slate-800'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            {isArabic ? 'الأطفال المغادرون' : 'Enfants sortis'}
          </button>
        </div>
      </div>

      {filteredEnfants.length > 0 ? (
        viewMode === 'list' ? (
          /* ================= LIST VIEW ================= */
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-slide-up">
            <div className="mobile-scroll-x">
              <table className="min-w-[680px] w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="p-4">{isArabic ? 'الطفل' : 'Enfant'}</th>
                    <th className="p-4">{isArabic ? 'العمر' : 'Âge'}</th>
                    <th className="p-4">{isArabic ? 'القسم' : 'Classe'}</th>
                    <th className="p-4">{isArabic ? 'ولي الأمر' : 'Parents'}</th>
                    <th className="p-4 text-center">{isArabic ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                  {filteredEnfants.map((enfant) => (
                    <tr key={enfant.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl font-black text-white flex items-center justify-center shadow-xs ${
                            enfant.genre === 'Fille' ? 'bg-gradient-to-tr from-pink-500 to-rose-400' : 'bg-gradient-to-tr from-sky-500 to-indigo-400'
                          }`}>
                            {enfant.prenom[0]}{enfant.nom[0]}
                          </div>
                          <div>
                            <p className="text-slate-900 font-extrabold">{enfant.prenom} {enfant.nom}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">RAW-{enfant.id.slice(-4)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-slate-800 font-bold">{calculerAge(enfant.dateNaissance)}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{new Date(enfant.dateNaissance).toLocaleDateString(isArabic ? 'ar' : 'fr-FR')}</p>
                      </td>
                      <td className="p-4">
                        <select
                          value={enfant.groupeAge}
                          disabled={isReadOnly || quickUpdatingEnfantId !== null}
                          onChange={event => void handleQuickGroupChange(enfant, event.target.value as Enfant['groupeAge'])}
                          aria-label={isArabic ? 'تعديل قسم الطفل' : 'Modifier le groupe de l’enfant'}
                          className={`cursor-pointer rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          enfant.groupeAge === 'Bébés' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                          enfant.groupeAge === 'Moyens' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          <option value="Bébés">{isArabic ? 'رضع' : 'Bébés'}</option>
                          <option value="Moyens">{isArabic ? 'متوسطين' : 'Moyens'}</option>
                          <option value="Grands">{isArabic ? 'كبار' : 'Grands'}</option>
                        </select>
                      </td>
                      <td className="p-4">
                        {enfant.parents.slice(0, 1).map((parent) => (
                          <div key={parent.id}>
                            <p className="text-xs font-extrabold text-slate-800">{parent.prenom} {parent.nom} <span className="text-[9px] text-indigo-600 bg-indigo-50 px-1 rounded">{parent.lien}</span></p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{parent.telephone}</p>
                          </div>
                        ))}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setSelectedEnfant(enfant)}
                            className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition"
                            title={isArabic ? 'عرض الملف' : 'Ouvrir le dossier'}
                            aria-label={isArabic ? 'عرض ملف الطفل' : 'Ouvrir le dossier de l’enfant'}
                          >
                            <FileText size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              setEditingEnfantId(enfant.id);
                              setFormData({
                                nom: enfant.nom,
                                prenom: enfant.prenom,
                                dateNaissance: enfant.dateNaissance,
                                genre: enfant.genre,
                                groupeAge: enfant.groupeAge,
                                bloodGroup: enfant.groupeSanguin || 'O+',
                                weightKg: enfant.poidsKg ? String(enfant.poidsKg) : '',
                                                          pediatricianName: enfant.medecinTraitant || '',
                          vaccinations: enfant.vaccinations || '',
                                notesMedicales: enfant.notesMedicales || '',

                                parentNom: enfant.parents[0]?.nom || '',
                                parentPrenom: enfant.parents[0]?.prenom || '',
                                parentLien: enfant.parents[0]?.lien || 'Mère',
                                parentTelephone: enfant.parents[0]?.telephone || '',
                                parentEmail: enfant.parents[0]?.email || '',
                                parentProfession: enfant.parents[0]?.profession || '',
                                parentAdresse: enfant.parents[0]?.adresse || '',
                                docCertif: getDocumentsRequis(enfant)?.certificatMedical ?? false,
                                docVaccin: getDocumentsRequis(enfant)?.carnetVaccination ?? false,
                                docDomicile: getDocumentsRequis(enfant)?.justificatifDomicile ?? false,
                                docFiles: enfant.documentsFichiers || {},
                                jourEcheanceMensuel: String(enfant.jourEcheanceMensuel || 5),
                                docPhoto: getDocumentsRequis(enfant)?.photoIdentite ?? false,
                                allergie: enfant.allergie || '',
                                regimeAlimentaire: enfant.regimeAlimentaire || ''
                              });
                              setShowModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 transition"
                            title={isArabic ? 'تعديل ملف الطفل' : 'Modifier le dossier de l’enfant'}
                            aria-label={isArabic ? 'تعديل ملف الطفل' : 'Modifier le dossier de l’enfant'}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => enfant.statut === 'Actif'
                              ? setSortieModalEnfant(enfant)
                              : handleReintegrer(enfant)}
                            className={`p-1.5 rounded-lg transition ${
                              enfant.statut === 'Actif'
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={enfant.statut === 'Actif'
                              ? (isArabic ? 'تسجيل خروج' : 'Marquer comme sorti')
                              : (isArabic ? 'إعادة التسجيل' : 'Réintégrer')}
                            aria-label={enfant.statut === 'Actif'
                              ? (isArabic ? 'تسجيل خروج الطفل' : 'Marquer l’enfant comme sorti')
                              : (isArabic ? 'إعادة تسجيل الطفل' : 'Réintégrer l’enfant')}
                          >
                            {enfant.statut === 'Actif' ? <LogOut size={16} /> : <RotateCcw size={16} />}
                          </button>
                          <button 
                            aria-label={isArabic ? 'حذف ملف الطفل' : 'Supprimer le dossier de l’enfant'}
                            title={isArabic ? 'حذف ملف الطفل' : 'Supprimer le dossier de l’enfant'}
                            onClick={() => { void handleDeleteEnfant(enfant); }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ================= GRID VIEW ================= */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
            {filteredEnfants.map((enfant) => {
              const birthDate = new Date(enfant.dateNaissance).toLocaleDateString(isArabic ? 'ar' : 'fr-FR');
              
              return (
                <div 
                  key={enfant.id} 
                  className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl font-black text-white flex items-center justify-center shadow-md ${
                          enfant.genre === 'Fille' ? 'bg-gradient-to-tr from-pink-500 to-rose-400' : 'bg-gradient-to-tr from-sky-500 to-indigo-400'
                        }`}>
                          {enfant.prenom[0]}{enfant.nom[0]}
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900 leading-snug">{enfant.prenom} {enfant.nom}</h3>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-1">
                            Ref: RAW-{enfant.id.slice(-4)}
                          </span>
                        </div>
                      </div>

                      <select
                        value={enfant.groupeAge}
                        disabled={isReadOnly || quickUpdatingEnfantId !== null}
                        onChange={event => void handleQuickGroupChange(enfant, event.target.value as Enfant['groupeAge'])}
                        aria-label={isArabic ? 'تعديل قسم الطفل' : 'Modifier le groupe de l’enfant'}
                        className={`cursor-pointer rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        enfant.groupeAge === 'Bébés' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                        enfant.groupeAge === 'Moyens' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        <option value="Bébés">{isArabic ? 'رضع' : 'Bébés'}</option>
                        <option value="Moyens">{isArabic ? 'متوسطين' : 'Moyens'}</option>
                        <option value="Grands">{isArabic ? 'كبار' : 'Grands'}</option>
                      </select>
                    </div>

                    <div className="space-y-2 mt-4 text-xs font-semibold text-slate-500">
                      <div className="flex items-center gap-2 p-1 border-b border-dashed border-slate-50">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{t('children.born')}: <strong className="text-slate-800">{birthDate} ({calculerAge(enfant.dateNaissance)})</strong></span>
                      </div>

                      {enfant.allergie ? (
                        <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-2.5 py-1.5 border border-rose-100 rounded-xl">
                          <ShieldAlert className="w-4 h-4 text-rose-500" />
                          <span className="font-extrabold text-[11px] truncate">
                            {t('children.allergy')}: <strong className="font-black text-rose-800">{enfant.allergie}</strong>
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-400 italic px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-xl text-[11px]">
                          <span>Aucune allergie signalée</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 bg-slate-50/50 rounded-2xl p-3 border border-slate-100/50">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        {isArabic ? 'الملف الإداري والتراخيص' : 'Dossier administratif et autorisations'}
                      </p>
                      <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-slate-500">
                        <div className="space-y-1">
                          <div className={`mx-auto w-5 h-5 rounded-md flex items-center justify-center font-bold ${
                            getDocumentsRequis(enfant)?.certificatMedical ?? false ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                          }`}>
                            {getDocumentsRequis(enfant)?.certificatMedical ?? false ? '✓' : '✗'}
                          </div>
                          <span className="block text-[9px] truncate">Médic</span>
                        </div>
                        <div className="space-y-1">
                          <div className={`mx-auto w-5 h-5 rounded-md flex items-center justify-center font-bold ${
                            getDocumentsRequis(enfant)?.carnetVaccination ?? false ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                          }`}>
                            {getDocumentsRequis(enfant)?.carnetVaccination ?? false ? '✓' : '✗'}
                          </div>
                          <span className="block text-[9px] truncate">Vaccin</span>
                        </div>
                        <div className="space-y-1">
                          <div className={`mx-auto w-5 h-5 rounded-md flex items-center justify-center font-bold ${
                            getDocumentsRequis(enfant)?.justificatifDomicile ?? false ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                          }`}>
                            {getDocumentsRequis(enfant)?.justificatifDomicile ?? false ? '✓' : '✗'}
                          </div>
                          <span className="block text-[9px] truncate">Domi</span>
                        </div>
                        <div className="space-y-1">
                          <div className={`mx-auto w-5 h-5 rounded-md flex items-center justify-center font-bold ${
                            getDocumentsRequis(enfant)?.photoIdentite ?? false ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                          }`}>
                            {getDocumentsRequis(enfant)?.photoIdentite ?? false ? '✓' : '✗'}
                          </div>
                          <span className="block text-[9px] truncate pointer-events-none">Photo</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-slate-100 pt-3">
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">{t('children.parents')}:</p>
                      {enfant.parents.map((parent) => (
                        <div key={parent.id} className="text-xs text-slate-600 flex items-center gap-1.5 mb-1.5 last:mb-0">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-extrabold text-slate-800">{parent.prenom} {parent.nom}</span>
                          <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded leading-none">
                            {parent.lien}
                          </span>
                          <a href={`tel:${parent.telephone}`} className="text-slate-400 hover:text-indigo-600 ml-auto transition">
                            <Phone className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>

                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-50 flex gap-2">
                    <button 
                      onClick={() => setSelectedEnfant(enfant)}
                      className="flex-1 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl font-bold text-xs transition cursor-pointer"
                    >
                      {isArabic ? 'عرض الملف' : 'Dossier'}
                    </button>
                    <button 
                      onClick={() => {
                        setEditingEnfantId(enfant.id);
                        setFormData({
                          nom: enfant.nom,
                          prenom: enfant.prenom,
                          dateNaissance: enfant.dateNaissance,
                          genre: enfant.genre,
                          groupeAge: enfant.groupeAge,
                          bloodGroup: enfant.groupeSanguin || 'O+',
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
                          docCertif: getDocumentsRequis(enfant)?.certificatMedical ?? false,
                          docVaccin: getDocumentsRequis(enfant)?.carnetVaccination ?? false,
                          docDomicile: getDocumentsRequis(enfant).justificatifDomicile,
                          jourEcheanceMensuel: String(enfant.jourEcheanceMensuel || 5),
                          docPhoto: getDocumentsRequis(enfant).photoIdentite,
                          allergie: enfant.allergie || '',
                          regimeAlimentaire: enfant.regimeAlimentaire || ''
                        });
                        setShowModal(true);
                      }}
                      className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition cursor-pointer"
                      title={isArabic ? 'تعديل' : 'Modifier'}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => enfant.statut === 'Actif'
                        ? setSortieModalEnfant(enfant)
                        : handleReintegrer(enfant)}
                      className={`p-3 rounded-xl font-bold text-xs transition cursor-pointer ${
                        enfant.statut === 'Actif'
                          ? 'bg-slate-50 hover:bg-amber-100 text-slate-600 hover:text-amber-700'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                      }`}
                      title={enfant.statut === 'Actif'
                        ? (isArabic ? 'تسجيل خروج' : 'Marquer comme sorti')
                        : (isArabic ? 'إعادة التسجيل' : 'Réintégrer')}
                    >
                      {enfant.statut === 'Actif' ? <LogOut size={15} /> : <RotateCcw size={15} />}
                    </button>
                    <button 
                      onClick={() => { void handleDeleteEnfant(enfant); }}
                      className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition cursor-pointer"
                      title={isArabic ? 'حذف' : 'Supprimer'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="col-span-full p-12 bg-white rounded-2xl border border-slate-100 text-center text-slate-400">
          <HelpCircle className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5] mb-2" />
          <p className="font-extrabold">{isArabic ? 'لا توجد تطابقات للبحث' : 'Aucun dossier actif'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{isArabic ? 'تأكد من الحروف أو أضف طفلاً جديداً.' : 'Changez vos termes de recherche ou créez un premier enfant.'}</p>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-start justify-center p-2 sm:p-4 pt-2 sm:pt-24 font-sans overflow-y-auto"
            onClick={() => setShowModal(false)}
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
                  onClick={() => setShowModal(false)}
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
                        {isArabic ? 'فصيلة الدم *' : 'Groupe Sanguin *'}
                      </label>
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800"
                        value={formData.bloodGroup}
                        onChange={e => setFormData({...formData, bloodGroup: e.target.value})}
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 rounded-2xl p-4">
                    {([
                      ['certificatMedical', isArabic ? 'الشهادة الطبية' : 'Certificat médical', 'docCertif'],
                      ['carnetVaccination', isArabic ? 'دفتر التلقيح' : 'Carnet de vaccination', 'docVaccin'],
                      ['justificatifDomicile', isArabic ? 'إثبات الإقامة' : 'Justificatif de domicile', 'docDomicile'],
                      ['photoIdentite', isArabic ? 'صورة الهوية' : 'Photo d\'identité', 'docPhoto'],
                    ] as Array<[DocumentKey, string, 'docCertif' | 'docVaccin' | 'docDomicile' | 'docPhoto']>).map(([key, label, legacyFlag]) => {
                      const attached = formData.docFiles[key];
                      const legacyDeclared = formData[legacyFlag];
                      return (
                        <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
                          <label className="block text-xs font-bold text-slate-700 mb-2">{label}</label>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={e => handleDocumentFile(key, e.target.files?.[0])}
                            className="w-full text-[11px] text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-2.5 file:py-1.5 file:text-[11px] file:font-bold file:text-indigo-700 hover:file:bg-indigo-100"
                          />
                          {attached ? (
                            <p className="mt-2 text-[10px] font-bold text-emerald-700">✓ {attached.nom} ({Math.ceil(attached.taille / 1024)} Ko)</p>
                          ) : legacyDeclared ? (
                            <p className="mt-2 text-[10px] font-semibold text-amber-700">{isArabic ? 'حالة قديمة مسجلة، بدون ملف مرفق' : 'Statut historique déclaré, sans fichier joint'}</p>
                          ) : (
                            <p className="mt-2 text-[10px] font-semibold text-slate-400">{isArabic ? 'لم يتم إرفاق ملف' : 'Aucun fichier joint'}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] font-semibold text-slate-400">{isArabic ? 'الحد الأقصى للملف: 2 ميغابايت. الصيغ: PDF أو صورة.' : 'Un vrai fichier est enregistré avec le dossier. Limite : 2 Mo, PDF ou image.'}</p>
                </div>

              </div>

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
                  className="flex-1 p-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-bold rounded-xl transition cursor-pointer text-sm shadow-md"
                  onClick={handleAjouter}
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
                  onClick={() => setSortieModalEnfant(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition cursor-pointer"
                >
                  {isArabic ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  onClick={handleConfirmerSortie}
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

      {selectedEnfant && (
        <EnfantDetails
          enfant={selectedEnfant}
          onClose={() => setSelectedEnfant(null)}
        />
      )}
    </div>
  );
}
