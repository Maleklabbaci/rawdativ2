import { financeErrorKind, financeErrorMessage } from '../utils/financeError';
import { plannedActivityMessage } from '../utils/automaticActivityPush';
import { offloadChildDocumentsToStorage } from '../utils/documentStorage';
import { useLanguage } from './LanguageContext';
import { attendanceErrorKind } from '../utils/attendanceError';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { ChildHealthEvent, ChildHealthDraft, PickupAuthorization, PickupAuthorizationDraft, Enfant, Presence, PresenceJournee, Paiement, PaiementPatch, InvoicePeriodReview, InvoiceReviewAction, InvoiceReviewEvent, Achat, Personnel, Classe, Activite, Repas, UserAccount, DiscussionMessage, Avis, AppNotification, DemandeDirecteur, Signalement, InscriptionLink, DemandeAdmission, CommunityPost, CommunityComment, CommunityReaction, CommunityFeature, CommunityFeatureKind, AdminAuditLog, AdminAuditAction, AdminAuditTargetType, AdminFollowup, AdminFollowupChannel, AdminFollowupStatus, CommercialStage } from '../types';
import { 
  getCollectionData,
  getCollectionDataStrict,
  addCollectionDocument, 
  updateCollectionDocument, 
  deleteCollectionDocument,
  setCollectionDocument,
  trackedBusinessRpc,
  callSupabaseRpc,
  callSupabaseRpcWithTimeout,
  supabase
} from '../supabase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const DEFAULT_CHILD_DOCUMENTS: Enfant['documentsRequis'] = {
  certificatMedical: false,
  carnetVaccination: false,
  justificatifDomicile: false,
  photoIdentite: false,
};

function normalizeDocumentsRequis(value: unknown): Enfant['documentsRequis'] {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  // Rebuild the object explicitly instead of spreading arbitrary JSON. This keeps
  // every child record total and prevents undefined.certificatMedical at runtime.
  return {
    certificatMedical: source.certificatMedical === true,
    carnetVaccination: source.carnetVaccination === true,
    justificatifDomicile: source.justificatifDomicile === true,
    photoIdentite: source.photoIdentite === true,
  };
}

function normalizeEnfantData(enfant: Partial<Enfant> | null | undefined): Enfant {
  const candidate = (enfant || {}) as Partial<Enfant>;
  const normalizeParent = (parent: any, index: number) => ({
    id: typeof parent?.id === 'string' ? parent.id : `parent_${index}`,
    nom: typeof parent?.nom === 'string' ? parent.nom : '',
    prenom: typeof parent?.prenom === 'string' ? parent.prenom : '',
    lien: parent?.lien === 'Père' || parent?.lien === 'Tuteur' ? parent.lien : 'Mère',
    telephone: typeof parent?.telephone === 'string' ? parent.telephone : '',
    email: typeof parent?.email === 'string' ? parent.email : undefined,
    adresse: typeof parent?.adresse === 'string' ? parent.adresse : undefined,
    profession: typeof parent?.profession === 'string' ? parent.profession : undefined,
  });
  const normalizeContact = (contact: any, index: number) => ({
    id: typeof contact?.id === 'string' ? contact.id : `contact_${index}`,
    nom: typeof contact?.nom === 'string' ? contact.nom : '',
    telephone: typeof contact?.telephone === 'string' ? contact.telephone : '',
    lien: contact?.lien === 'Père' || contact?.lien === 'Tuteur' ? contact.lien : 'Mère',
  });
  const parents = Array.isArray(candidate.parents)
    ? candidate.parents.filter(Boolean).map(normalizeParent)
    : [];
  const contactsUrgence = Array.isArray(candidate.contactsUrgence)
    ? candidate.contactsUrgence.filter(Boolean).map(normalizeContact)
    : [];
  const documentsFichiers = candidate.documentsFichiers && typeof candidate.documentsFichiers === 'object' && !Array.isArray(candidate.documentsFichiers)
    ? candidate.documentsFichiers
    : {};

  return {
    ...candidate,
    id: typeof candidate.id === 'string' ? candidate.id : `child_${Date.now()}`,
    nom: typeof candidate.nom === 'string' ? candidate.nom : '',
    prenom: typeof candidate.prenom === 'string' ? candidate.prenom : '',
    dateNaissance: typeof candidate.dateNaissance === 'string' ? candidate.dateNaissance : '',
    genre: candidate.genre === 'Fille' ? 'Fille' : 'Garçon',
    groupeAge: candidate.groupeAge === 'Moyens' || candidate.groupeAge === 'Grands' ? candidate.groupeAge : 'Bébés',
    dateInscription: typeof candidate.dateInscription === 'string' ? candidate.dateInscription : new Date().toISOString().split('T')[0],
    statut: candidate.statut === 'Inactif' ? 'Inactif' : 'Actif',
    parents,
    contactsUrgence,
    documentsRequis: normalizeDocumentsRequis(candidate.documentsRequis),
    documentsFichiers,
  } as Enfant;
}

const COMMUNITY_CATEGORIES: CommunityPost['categorie'][] = ['activite', 'materiel', 'vente_echange', 'recrutement', 'formation', 'partenariat'];

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

type CrecheSettingsContact = {
  id: string;
  phoneNumbers?: string;
};

// Le téléphone peut avoir été enregistré avant que les comptes Directrice ne
// reçoivent le champ `telephone`. Le Super Admin lit donc le contact du compte
// en priorité, puis utilise sans écrire le numéro déjà présent dans les
// Paramètres de la même crèche.
function hydrateAccountsWithCrechePhone(
  accounts: UserAccount[],
  settings: CrecheSettingsContact[],
): UserAccount[] {
  return accounts.map((account) => {
    if (optionalText(account.telephone)) return account;
    const settingsPhone = settings.find((item) => item.id === `creche_${account.id}`)?.phoneNumbers;
    const telephone = optionalText(settingsPhone);
    return telephone ? { ...account, telephone } : account;
  });
}

function normalizeCommunityPost(post: Partial<CommunityPost> | null | undefined, index = 0): CommunityPost {
  const candidate = (post || {}) as Record<string, unknown>;
  const authorId = typeof candidate.authorId === 'string' ? candidate.authorId : '';
  const authorName = typeof candidate.authorName === 'string' && candidate.authorName.trim() ? candidate.authorName : 'Directeur';
  const categorie = COMMUNITY_CATEGORIES.includes(candidate.categorie as CommunityPost['categorie'])
    ? candidate.categorie as CommunityPost['categorie']
    : 'activite';
  const prix = typeof candidate.prix === 'number' && Number.isFinite(candidate.prix) ? candidate.prix : undefined;
  const likesCount = typeof candidate.likesCount === 'number' && Number.isFinite(candidate.likesCount) ? Math.max(0, candidate.likesCount) : 0;
  const createdAt = typeof candidate.createdAt === 'string' && candidate.createdAt ? candidate.createdAt : new Date(0).toISOString();

  return {
    ...candidate,
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `community_post_unknown_${index}`,
    authorId,
    authorName,
    authorAvatarUrl: optionalText(candidate.authorAvatarUrl),
    authorLogoUrl: optionalText(candidate.authorLogoUrl),
    authorBio: optionalText(candidate.authorBio),
    authorVille: optionalText(candidate.authorVille),
    authorSiteWeb: optionalText(candidate.authorSiteWeb),
    authorEstCertifie: candidate.authorEstCertifie === true,
    authorCertificationEnfants: typeof candidate.authorCertificationEnfants === 'number' && Number.isFinite(candidate.authorCertificationEnfants)
      ? Math.max(0, candidate.authorCertificationEnfants)
      : undefined,
    crecheId: typeof candidate.crecheId === 'string' ? candidate.crecheId : authorId,
    nomCreche: typeof candidate.nomCreche === 'string' && candidate.nomCreche.trim() ? candidate.nomCreche : 'Crèche',
    categorie,
    titre: optionalText(candidate.titre),
    contenu: typeof candidate.contenu === 'string' ? candidate.contenu : '',
    ville: optionalText(candidate.ville),
    prix,
    contact: optionalText(candidate.contact),
    statut: candidate.statut === 'masquee' ? 'masquee' : 'publie',
    likesCount,
    createdAt,
    updatedAt: optionalText(candidate.updatedAt),
    originalPostId: optionalText(candidate.originalPostId),
    originalPost: candidate.originalPost && typeof candidate.originalPost === 'object' ? candidate.originalPost as CommunityPost['originalPost'] : undefined,
    repostComment: optionalText(candidate.repostComment),
  } as CommunityPost;
}

function normalizeCommunityComment(comment: Partial<CommunityComment> | null | undefined, index = 0): CommunityComment {
  const candidate = (comment || {}) as Record<string, unknown>;
  const authorId = typeof candidate.authorId === 'string' ? candidate.authorId : '';
  return {
    ...candidate,
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `community_comment_unknown_${index}`,
    postId: typeof candidate.postId === 'string' ? candidate.postId : '',
    authorId,
    authorName: typeof candidate.authorName === 'string' && candidate.authorName.trim() ? candidate.authorName : 'Directeur',
    authorAvatarUrl: optionalText(candidate.authorAvatarUrl),
    authorBio: optionalText(candidate.authorBio),
    crecheId: typeof candidate.crecheId === 'string' ? candidate.crecheId : authorId,
    nomCreche: typeof candidate.nomCreche === 'string' && candidate.nomCreche.trim() ? candidate.nomCreche : 'Crèche',
    contenu: typeof candidate.contenu === 'string' ? candidate.contenu : '',
    createdAt: typeof candidate.createdAt === 'string' && candidate.createdAt ? candidate.createdAt : new Date(0).toISOString(),
  } as CommunityComment;
}

function normalizeCommunityReaction(reaction: Partial<CommunityReaction> | null | undefined, index = 0): CommunityReaction {
  const candidate = (reaction || {}) as Record<string, unknown>;
  return {
    ...candidate,
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `community_reaction_unknown_${index}`,
    postId: typeof candidate.postId === 'string' ? candidate.postId : '',
    userId: typeof candidate.userId === 'string' ? candidate.userId : '',
    createdAt: typeof candidate.createdAt === 'string' && candidate.createdAt ? candidate.createdAt : new Date(0).toISOString(),
  } as CommunityReaction;
}

const COMMUNITY_FEATURE_KINDS = new Set<CommunityFeatureKind>([
  'follow', 'saved_post', 'social_notification', 'poll_vote', 'report', 'pin', 'profile_details', 'private_message', 'post_view',
]);

function normalizeCommunityFeature(feature: Partial<CommunityFeature> | null | undefined, index = 0): CommunityFeature | null {
  const candidate = (feature || {}) as Record<string, unknown>;
  const kind = typeof candidate.kind === 'string' && COMMUNITY_FEATURE_KINDS.has(candidate.kind as CommunityFeatureKind)
    ? candidate.kind as CommunityFeatureKind
    : null;
  const actorId = typeof candidate.actorId === 'string' ? candidate.actorId.trim() : '';
  const targetId = typeof candidate.targetId === 'string' && candidate.targetId.trim() ? candidate.targetId.trim() : undefined;
  const recipientId = typeof candidate.recipientId === 'string' && candidate.recipientId.trim() ? candidate.recipientId.trim() : undefined;
  const targetRequired = new Set<CommunityFeatureKind>(['follow', 'saved_post', 'poll_vote', 'report', 'pin', 'post_view']);
  if (!kind || !actorId || (targetRequired.has(kind) && !targetId) || (kind === 'social_notification' && !recipientId) || (kind === 'private_message' && !recipientId)) return null;
  const payload = candidate.payload && typeof candidate.payload === 'object' && !Array.isArray(candidate.payload)
    ? candidate.payload as Record<string, unknown>
    : undefined;
  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `community_feature_unknown_${index}`,
    kind,
    actorId,
    targetId,
    recipientId,
    visibility: candidate.visibility === 'public' ? 'public' : 'private',
    createdAt: typeof candidate.createdAt === 'string' && candidate.createdAt ? candidate.createdAt : new Date(0).toISOString(),
    updatedAt: typeof candidate.updatedAt === 'string' && candidate.updatedAt ? candidate.updatedAt : undefined,
    payload,
  };
}

interface DbContextType {
  enfants: Enfant[];
  classes: Classe[];
  presences: Presence[];
  presenceJournees: PresenceJournee[];
  paiements: Paiement[];
  achats: Achat[];
  personnel: Personnel[];
  activites: Activite[];
  repas: Repas[];
  comptes: UserAccount[];
  demandesDirecteur: DemandeDirecteur[];
  messages: DiscussionMessage[];
  avis: Avis[];
  signalements: Signalement[];
  communityPosts: CommunityPost[];
  communityComments: CommunityComment[];
  communityReactions: CommunityReaction[];
  communityFeatures: CommunityFeature[];
  inscriptionLinks: InscriptionLink[];
  demandesAdmission: DemandeAdmission[];
  notifications: AppNotification[];
  adminAuditLogs: AdminAuditLog[];
  adminFollowups: AdminFollowup[];
  loading: boolean;
  financialDataReady: boolean;
  dataLoading?: boolean;
  dataErrors?: string[];
  refreshAll: () => Promise<void>;

  addNotification: (notif: Omit<AppNotification, 'id'>) => Promise<string>;
  markNotificationRead: (id: string, userId: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  
  addMessage: (message: Omit<DiscussionMessage, 'id'>) => Promise<string>;
  updateMessage: (id: string, message: Partial<DiscussionMessage>) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;

  addAvis: (avis: Omit<Avis, 'id'>) => Promise<string>;
  deleteAvis: (id: string) => Promise<void>;

  addSignalement: (signalement: Omit<Signalement, 'id'>) => Promise<string>;
  updateSignalement: (id: string, signalement: Partial<Signalement>) => Promise<void>;
  deleteSignalement: (id: string) => Promise<void>;

  addCommunityPost: (post: Omit<CommunityPost, 'id'>) => Promise<string>;
  repostCommunityPost: (post: CommunityPost, comment?: string) => Promise<string>;
  updateCommunityPost: (id: string, post: Partial<CommunityPost>) => Promise<void>;
  deleteCommunityPost: (id: string) => Promise<void>;
  addCommunityComment: (comment: Omit<CommunityComment, 'id'>) => Promise<string>;
  updateCommunityComment: (id: string, comment: Partial<CommunityComment>) => Promise<void>;
  deleteCommunityComment: (id: string) => Promise<void>;
  toggleCommunityReaction: (postId: string) => Promise<void>;
  addCommunityFeature: (feature: Omit<CommunityFeature, 'id'>) => Promise<string>;
  updateCommunityFeature: (id: string, feature: Partial<CommunityFeature>) => Promise<void>;
  markCommunityFeatureRead: (id: string) => Promise<void>;
  deleteCommunityFeature: (id: string) => Promise<void>;

  ensureInscriptionLink: () => Promise<(InscriptionLink & { token: string }) | null>;
  createInscriptionLink: (label?: string, expiresAt?: string | null) => Promise<InscriptionLink & { token: string }>;
  toggleInscriptionLink: (id: string, active: boolean) => Promise<void>;
  decideAdmission: (id: string, statut: 'acceptee' | 'refusee', motif?: string) => Promise<void>;

  addCompte: (compte: Omit<UserAccount, 'id'>) => Promise<string>;
  updateCompte: (id: string, compte: Partial<UserAccount>) => Promise<void>;
  deleteCompte: (id: string) => Promise<void>;
  updateDirectorSubscription: (id: string, patch: Pick<UserAccount, 'abonnementActif' | 'dateFinAbonnement'>, action: Extract<AdminAuditAction, 'subscription_suspended' | 'subscription_reactivated' | 'subscription_end_date_updated' | 'trial_extended'>) => Promise<UserAccount>;
  updateDirectorOperations: (id: string, patch: Partial<Pick<UserAccount, 'commercialStage' | 'commercialOwnerId' | 'nextFollowUpAt' | 'lastFollowUpAt' | 'commercialNote'>>, action: 'commercial_stage_updated' | 'commercial_owner_updated' | 'commercial_note_updated' | 'followup_scheduled' | 'followup_recorded') => Promise<UserAccount>;
  createAdminFollowup: (targetId: string, channel: AdminFollowupChannel, note?: string, dueAt?: string, status?: AdminFollowupStatus) => Promise<AdminFollowup>;
  publishAdminNotification: (payload: Omit<AppNotification, 'id' | 'recipientRole' | 'recipientIds' | 'senderName' | 'createdAt' | 'readBy'>, recipientIds?: string[]) => Promise<AppNotification>;
  logAdminAction: (action: AdminAuditAction, targetType: AdminAuditTargetType, targetId: string, targetLabel?: string, metadata?: Record<string, unknown>) => Promise<AdminAuditLog>;
  addDemandeDirecteur: (demande: Omit<DemandeDirecteur, 'id'>) => Promise<string>;
  approveDemandeDirecteur: (id: string) => Promise<string>;
  updateDemandeDirecteur: (id: string, demande: Partial<DemandeDirecteur>) => Promise<void>;
  deleteDemandeDirecteur: (id: string) => Promise<void>;

  addEnfant: (enfant: Omit<Enfant, 'id'>) => Promise<string>;
  updateEnfant: (id: string, enfant: Partial<Enfant>) => Promise<void>;
  deleteEnfant: (id: string) => Promise<void>;
  listChildHealthEvents: (childId: string) => Promise<ChildHealthEvent[]>;
  addChildHealthEvent: (childId: string, draft: ChildHealthDraft) => Promise<ChildHealthEvent>;
  listPickupAuthorizations: (childId: string) => Promise<PickupAuthorization[]>;
  createPickupAuthorization: (childId: string, draft: PickupAuthorizationDraft) => Promise<PickupAuthorization>;
  revokePickupAuthorization: (childId: string, id: string) => Promise<PickupAuthorization>;

  addClasse: (classe: Omit<Classe, 'id'>) => Promise<string>;
  updateClasse: (id: string, classe: Partial<Classe>) => Promise<void>;
  deleteClasse: (id: string) => Promise<void>;

  addPresence: (presence: Omit<Presence, 'id'>) => Promise<string>;
  updatePresence: (id: string, presence: Partial<Presence>, expected?: Presence) => Promise<void>;
  deletePresence: (id: string, expected?: Presence) => Promise<void>;
  confirmPickupDeparture: (presence: Presence, authorizationId: string, departureTime: string) => Promise<void>;
  savePresenceJournee: (journee: Omit<PresenceJournee, 'id'> & { id?: string }) => Promise<string>;

  addPaiement: (paiement: Omit<Paiement, 'id'> & { id?: string }) => Promise<string>;
  updatePaiement: (id: string, paiement: PaiementPatch, expected: Paiement) => Promise<void>;
  deletePaiement: (id: string) => Promise<void>;
  reviewInvoicePeriod: (expected: Paiement, key: string, reason: string) => Promise<Paiement>;
  getInvoicePeriodReview: (id: string) => Promise<InvoicePeriodReview | null>;
  invoiceReviewAction: (draft: InvoiceReviewAction) => Promise<Paiement>;
  listInvoiceReviewEvents: (id: string) => Promise<InvoiceReviewEvent[]>;
  checkInvoiceReminder: (invoice: Paiement, child: Enfant, phone?: string) => Promise<void>;

  addAchat: (achat: Omit<Achat, 'id' | 'crecheId' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateAchat: (id: string, achat: Partial<Achat>) => Promise<void>;
  deleteAchat: (id: string) => Promise<void>;

  addPersonnel: (staff: Omit<Personnel, 'id'>) => Promise<string>;
  updatePersonnel: (id: string, staff: Partial<Personnel>) => Promise<void>;
  deletePersonnel: (id: string) => Promise<void>;

  addActivite: (activite: Omit<Activite, 'id'>) => Promise<string>;
  updateActivite: (id: string, activite: Partial<Activite>) => Promise<void>;
  deleteActivite: (id: string) => Promise<void>;

  addRepas: (meal: Omit<Repas, 'id'>) => Promise<string>;
  updateRepas: (id: string, meal: Partial<Repas>) => Promise<void>;
  deleteRepas: (id: string) => Promise<void>;
}

export const DbContext = createContext<DbContextType | null>(null);

export const DbProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { language } = useLanguage();
  // ✅ FIX: message générique en cas d'échec d'écriture Supabase, pour ne plus jamais
  // avaler une erreur en silence (l'utilisateur croyait avoir sauvegardé pour rien).
  const notifyWriteError = (action: 'ajout' | 'modification' | 'suppression') => {
    showToast(
      action === 'ajout' ? "Échec de l'enregistrement, réessayez." :
      action === 'modification' ? "Échec de la modification, réessayez." :
      "Échec de la suppression, réessayez.",
      'error'
    );
  };

  const isPendingDirector = user?.role === 'directeur' && user.approvalStatus === 'pending';
  const assertWriteAccess = () => {
    if (!isPendingDirector) return;
    throw new Error('Votre compte est en attente de validation par l’administrateur. La plateforme est actuellement en lecture seule.');
  };
  
  const [enfants, setEnfants] = useState<Enfant[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [presenceJournees, setPresenceJournees] = useState<PresenceJournee[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [achats, setAchats] = useState<Achat[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [activites, setActivites] = useState<Activite[]>([]);
  const [repas, setRepas] = useState<Repas[]>([]);
  const [comptes, setComptes] = useState<UserAccount[]>([]);
  const [demandesDirecteur, setDemandesDirecteur] = useState<DemandeDirecteur[]>([]);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [avis, setAvis] = useState<Avis[]>([]);
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityComments, setCommunityComments] = useState<CommunityComment[]>([]);
  const [communityReactions, setCommunityReactions] = useState<CommunityReaction[]>([]);
  const [communityFeatures, setCommunityFeatures] = useState<CommunityFeature[]>([]);
  const [inscriptionLinks, setInscriptionLinks] = useState<InscriptionLink[]>([]);
  const [demandesAdmission, setDemandesAdmission] = useState<DemandeAdmission[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>([]);
  const [adminFollowups, setAdminFollowups] = useState<AdminFollowup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataErrors, setDataErrors] = useState<string[]>([]);
  const dataOwnerRef = React.useRef<string | undefined>(undefined);
  const [financialState, setFinancialState] = useState<{ owner: string | undefined; ready: boolean }>({ owner: undefined, ready: false });
  // A filtered/empty RLS response for an unapproved director is not a zero balance.
  const financialDataReady = !!user && (user.role !== 'directeur' || user.approvalStatus === 'approved') && financialState.owner === user.id && financialState.ready;
  const setFinancialDataReady = (ready: boolean) => setFinancialState({ owner: user?.id, ready });
  const refreshSequence = React.useRef(0);
  const financialWrites = React.useRef({ generation: 0, active: 0 });
  const financialReadyRef = React.useRef(financialDataReady);
  financialReadyRef.current = financialDataReady;
  const currentUserId = React.useRef(user?.id);
  currentUserId.current = user?.id;

  // ✅ FIX PERF (v2) : chargement en 2 vagues au lieu d'attendre les 10 tables d'un coup.
  //
  // VAGUE 1 (bloquante, mais courte) : uniquement ce qui est nécessaire pour afficher
  // le Dashboard tout de suite -> profil courant + enfants + présences + paiements + personnel.
  // L’admin reçoit sa liste complète de comptes ; un directeur ne charge jamais les profils
  // et les photos de toutes les crèches pendant le démarrage.
  //
  // VAGUE 2 (en arrière-plan, NE bloque plus rien) : classes, activites, repas,
  // messages, avis. Elles arrivent pendant que l'utilisateur est déjà en train de
  // regarder son dashboard, et se glissent dans l'appli dès qu'elles sont prêtes
  // (utile seulement s'il va sur les pages Classes / Activités / Repas / Messagerie).
  const refreshAll = async () => {
    const request = ++refreshSequence.current;
    const financialGeneration = financialWrites.current.generation;
    setFinancialDataReady(false);
    if (dataOwnerRef.current !== user?.id) {
      dataOwnerRef.current = user?.id;
      setDataLoading(true);
      setDataErrors([]);
    }
    // Ne lance jamais de requêtes RLS avec le rôle anon pendant l’écran de connexion.
    // Cela évite les 401 sur toutes les tables avant que Supabase Auth ait une session.
    if (!user) {
      setEnfants([]);
      setClasses([]);
      setPresences([]);
      setPresenceJournees([]);
      setPaiements([]);
      setAchats([]);
      setPersonnel([]);
      setActivites([]);
      setRepas([]);
      setComptes([]);
      setDemandesDirecteur([]);
      setMessages([]);
      setAvis([]);
      setSignalements([]);
      setCommunityPosts([]);
      setCommunityComments([]);
      setCommunityReactions([]);
      setCommunityFeatures([]);
      setDataLoading(false);
      setInscriptionLinks([]);
      setDemandesAdmission([]);
      setNotifications([]);
      setAdminAuditLogs([]);
      setAdminFollowups([]);
      setLoading(false);
      return;
    }

    try {
      // --- VAGUE 1 : critique pour le Dashboard, on attend ---
      const [dbComptes, dbEnfants, dbPresences, dbPresenceJournees, dbPaiements, dbPersonnel, dbDemandesDirecteur, dbCrecheSettings] = await Promise.all([
        user?.role === 'admin'
          ? getCollectionData<UserAccount>('comptes')
          : Promise.resolve([user] as UserAccount[]),
        getCollectionDataStrict<Enfant>('enfants').then(data => ({ data, ok: true as const })).catch(() => ({ data: [] as Enfant[], ok: false as const })),
        getCollectionDataStrict<Presence>('presences').then(data => ({ data, ok: true as const })).catch(() => ({ data: [] as Presence[], ok: false as const })),
        getCollectionDataStrict<PresenceJournee>('presence_journees').then(data => ({ data, ok: true as const })).catch(() => ({ data: [] as PresenceJournee[], ok: false as const })),
        getCollectionDataStrict<Paiement>('paiements').then(data => ({ data, ok: true as const })).catch(() => ({ data: [] as Paiement[], ok: false as const })),
        getCollectionDataStrict<Personnel>('personnel').then(data => ({ data, ok: true as const })).catch(() => ({ data: [] as Personnel[], ok: false as const })),
        user?.role === 'admin' ? getCollectionData<DemandeDirecteur>('demandes_directeur') : Promise.resolve([] as DemandeDirecteur[]),
        user?.role === 'admin' ? getCollectionData<CrecheSettingsContact>('parametres') : Promise.resolve([] as CrecheSettingsContact[]),
      ]);

      if (request !== refreshSequence.current) return;

      // ✅ FIX: Don't create hardcoded admin - security risk!
      if (user?.role === 'admin' && dbComptes.length === 0) {
        console.warn(
          '⚠️ NO ADMIN ACCOUNT FOUND\n' +
          'Please create an admin account manually in Supabase Dashboard:\n' +
          '1. Go to SQL Editor\n' +
          '2. Insert into "comptes" table with a strong password\n' +
          '3. Restart the application'
        );
      }

      setComptes(user?.role === 'admin' ? hydrateAccountsWithCrechePhone(dbComptes, dbCrecheSettings) : dbComptes);
      if (dbEnfants.ok) setEnfants(dbEnfants.data.filter(Boolean).map(normalizeEnfantData));
      if (dbPresences.ok) setPresences(dbPresences.data);
      if (dbPresenceJournees.ok) setPresenceJournees(dbPresenceJournees.data);
      // A refresh that overlaps a write is not a reliable financial snapshot.
      if (financialGeneration === financialWrites.current.generation && financialWrites.current.active === 0) {
        if (dbPaiements.ok) setPaiements(dbPaiements.data);
        setFinancialDataReady(dbEnfants.ok && dbPaiements.ok);
      } else {
        setFinancialDataReady(false);
      }
      if (dbPersonnel.ok) setPersonnel(dbPersonnel.data);
      setDemandesDirecteur(dbDemandesDirecteur);

      // On arrête l'écran de chargement ICI -> le Dashboard s'affiche déjà,
      // pendant que la vague 2 continue en silence derrière.
      setLoading(false);

      // Chaque lecture est indépendante : une panne ne masque pas les autres collections.
      // Une erreur n'est jamais interprétée comme une liste vide.
      const errors: string[] = [];
      if (!dbEnfants.ok) errors.push('enfants');
      if (!dbPaiements.ok) errors.push('paiements');
      if (!dbPresences.ok) errors.push('presences');
      if (!dbPresenceJournees.ok) errors.push('presence_journees');
      if (!dbPersonnel.ok) errors.push('personnel');
      const loadBackground = async <T,>(name: string, apply: (rows: T[]) => void) => {
        try {
          const rows = await getCollectionDataStrict<T>(name);
          if (request === refreshSequence.current) apply(rows);
        } catch (error) {
          console.error(`Erreur chargement ${name}:`, error);
          errors.push(name);
        }
      };
      void Promise.all([
        loadBackground<Classe>('classes', setClasses),
        loadBackground<Activite>('activites', setActivites),
        loadBackground<Repas>('repas', setRepas),
        loadBackground<Achat>('achats', setAchats),
        loadBackground<DiscussionMessage>('discussion_messages', setMessages),
        loadBackground<Avis>('avis', setAvis),
        loadBackground<Signalement>('signalements', setSignalements),
        loadBackground<CommunityPost>('community_posts', rows => setCommunityPosts(rows.filter(Boolean).map(normalizeCommunityPost))),
        loadBackground<CommunityComment>('community_comments', rows => setCommunityComments(rows.filter(Boolean).map(normalizeCommunityComment))),
        loadBackground<CommunityReaction>('community_reactions', rows => setCommunityReactions(rows.filter(Boolean).map(normalizeCommunityReaction))),
        loadBackground<CommunityFeature>('community_features', rows => setCommunityFeatures(rows.map((feature, index) => normalizeCommunityFeature(feature, index)).filter((feature): feature is CommunityFeature => feature !== null))),
        loadBackground<InscriptionLink>('inscription_liens', setInscriptionLinks),
        loadBackground<DemandeAdmission>('demandes_admission', setDemandesAdmission),
        loadBackground<AppNotification>('notifications', setNotifications),
        ...(user.role === 'admin' ? [
          loadBackground<AdminFollowup>('admin_followups', rows => setAdminFollowups(rows.filter(Boolean).sort((a, b) => (a.dueAt || a.createdAt).localeCompare(b.dueAt || b.createdAt)))),
        ] : []),
      ]).then(() => {
        if (request !== refreshSequence.current) return;
        setDataErrors(errors);
        setDataLoading(false);
      });
    } catch (err) {
      console.error('Erreur de connexion à Supabase:', err);
      if (request === refreshSequence.current) { setFinancialDataReady(false); setDataErrors(['initial']); setDataLoading(false); setLoading(false); }
    }
  };

  const refreshAdminAccounts = async () => {
    if (user?.role !== 'admin') return;
    const [freshAccounts, freshCrecheSettings] = await Promise.all([
      getCollectionData<UserAccount>('comptes'),
      getCollectionData<CrecheSettingsContact>('parametres'),
    ]);
    setComptes(hydrateAccountsWithCrechePhone(freshAccounts, freshCrecheSettings));
  };

  useEffect(() => {
    refreshAll();

    const refreshAdmissionData = async () => {
      if (user?.role !== 'directeur') return;
      let links = await getCollectionData<InscriptionLink>('inscription_liens');
      // Les nouveaux comptes reçoivent leur QR via le trigger SQL. Pour les anciens
      // comptes, on répare automatiquement une seule fois sans afficher de bouton de génération.
      if (user.approvalStatus !== 'pending' && !links.some(link => link.active && link.token)) {
        try {
          const provisioned = await ensureInscriptionLink();
          if (provisioned) links = [provisioned, ...links.filter(link => link.id !== provisioned.id)];
        } catch (error) {
          console.error('Impossible de provisionner automatiquement le QR de la crèche:', error);
        }
      }
      const demandes = await getCollectionData<DemandeAdmission>('demandes_admission');
      setInscriptionLinks(links);
      setDemandesAdmission(demandes);
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (user?.role === 'admin') void refreshAdminAccounts();
      if (user?.role === 'directeur') void refreshAdmissionData();
    };

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const adminAccountsChannel = user?.role === 'admin'
      ? supabase
        .channel('rawdha-admin-comptes-sync')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comptes' }, () => {
          void refreshAdminAccounts();
        })
        .subscribe()
      : null;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && user?.role === 'directeur') void refreshAdmissionData();
    }, 8 * 1000);

    return () => {
      refreshSequence.current++;
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(interval);
      if (adminAccountsChannel) void supabase.removeChannel(adminAccountsChannel);
    };
  }, [user?.id, user?.role, user?.approvalStatus]);

  // --- FILTRE DE SÉCURITÉ GLOBAL ---
  // On s'assure que le directeur ne voit que les données rattachées à son propre ID (crecheId === user.id)
  const scopedEnfants = user?.role === 'directeur' ? enfants.filter(e => e.crecheId === user.id) : enfants;
  const scopedClasses = user?.role === 'directeur' ? classes.filter(c => c.crecheId === user.id) : classes;
  const scopedPersonnel = user?.role === 'directeur' ? personnel.filter(p => p.crecheId === user.id) : personnel;
  const scopedActivites = user?.role === 'directeur' ? activites.filter(a => a.crecheId === user.id) : activites;
  const scopedRepas = user?.role === 'directeur' ? repas.filter(r => r.crecheId === user.id) : repas;

  // Pour les présences et paiements, on filtre via les ID des enfants valides
  const validEnfantIds = new Set(scopedEnfants.map(e => e.id));
  const scopedPresences = user?.role === 'directeur' ? presences.filter(p => validEnfantIds.has(p.enfantId)) : presences;
  const scopedPresenceJournees = user?.role === 'directeur' ? presenceJournees.filter(j => j.crecheId === user.id) : presenceJournees;
  const scopedPaiements = user?.role === 'directeur' ? paiements.filter(p => validEnfantIds.has(p.enfantId)) : paiements;
  const scopedAchats = user?.role === 'directeur' ? achats.filter(achat => achat.crecheId === user.id) : achats;

  // ✅ FIX: avant, TOUS les comptes (tous les directeurs : nom, email, statut abonnement...) étaient
  // chargés en mémoire dans le navigateur de CHAQUE utilisateur connecté, même un simple directeur,
  // alors qu'il n'a besoin de voir que le sien. Seul l'admin a besoin de la liste complète.
  const scopedComptes = user?.role === 'admin' ? comptes : comptes.filter(c => c.id === user?.id);
  const scopedDemandesDirecteur = user?.role === 'admin' ? demandesDirecteur : [];
  const scopedInscriptionLinks = user?.role === 'directeur' ? inscriptionLinks.filter(link => link.crecheId === user.id) : inscriptionLinks;
  const scopedDemandesAdmission = user?.role === 'directeur' ? demandesAdmission.filter(demande => demande.crecheId === user.id) : demandesAdmission;
  const scopedCommunityPosts = user?.role === 'directeur' || user?.role === 'admin' ? communityPosts : [];
  const scopedCommunityComments = user?.role === 'directeur' || user?.role === 'admin' ? communityComments : [];
  const scopedCommunityReactions = user?.role === 'directeur' || user?.role === 'admin' ? communityReactions : [];
  const scopedCommunityFeatures = user?.role === 'directeur' || user?.role === 'admin' ? communityFeatures : [];


  // --- DEMANDES DIRECTEUR ---
  // L’insertion publique est utilisée uniquement par le formulaire de demande.
  // La lecture et les changements de statut restent protégés par RLS et réservés à l’admin.
  const addDemandeDirecteur = async (demande: Omit<DemandeDirecteur, 'id'>) => {
    const tempId = 'demande_' + Date.now();
    const optimistic = { ...demande, id: tempId } as DemandeDirecteur;
    if (user?.role === 'admin') setDemandesDirecteur(prev => [optimistic, ...prev]);
    try {
      const freshId = await addCollectionDocument('demandes_directeur', demande);
      if (user?.role === 'admin') {
        setDemandesDirecteur(prev => prev.map(item => item.id === tempId ? { ...optimistic, id: freshId } : item));
      }
      return freshId;
    } catch (err) {
      if (user?.role === 'admin') setDemandesDirecteur(prev => prev.filter(item => item.id !== tempId));
      throw err;
    }
  };

  const approveDemandeDirecteur = async (id: string) => {
    assertWriteAccess();
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('approve-director-request', {
      body: { demandeId: id },
      headers: { Authorization: `Bearer ${session?.access_token || ''}` },
    });
    if (error || data?.error) {
      notifyWriteError('modification');
      throw new Error(data?.error || error?.message || 'Erreur activation compte');
    }
    await refreshAll();
    return data.id as string;
  };

  const updateDemandeDirecteur = async (id: string, data: Partial<DemandeDirecteur>) => {
    assertWriteAccess();
    const previous = demandesDirecteur.find(item => item.id === id);
    setDemandesDirecteur(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<DemandeDirecteur>('demandes_directeur', id, data);
    } catch (err) {
      if (previous) setDemandesDirecteur(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
      throw err;
    }
  };

  const deleteDemandeDirecteur = async (id: string) => {
    assertWriteAccess();
    const previous = demandesDirecteur.find(item => item.id === id);
    setDemandesDirecteur(prev => prev.filter(item => item.id !== id));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('reject-director-request', {
        body: { demandeId: id },
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Erreur refus demande');
      }
    } catch (err) {
      if (previous) setDemandesDirecteur(prev => [...prev, previous]);
      notifyWriteError('suppression');
      throw err;
    }
  };

  // --- ENFANTS ---
  const addEnfant = async (enfant: Omit<Enfant, 'id'>) => {
    assertWriteAccess();
    const id = (enfant as Partial<Enfant>).id || `child_${crypto.randomUUID()}`;
    const documentsFichiers = enfant.documentsFichiers
      ? await offloadChildDocumentsToStorage(user?.id || 'creche', id, enfant.documentsFichiers)
      : enfant.documentsFichiers;
    const record = normalizeEnfantData({ ...enfant, documentsFichiers, id });
    const savedId = await addCollectionDocument('enfants', record);
    setEnfants(prev => [...prev.filter(item => item.id !== savedId), { ...record, id: savedId }]);
    return savedId;
  };

  const updateEnfant = async (id: string, data: Partial<Enfant>) => {
    try {
      assertWriteAccess();
      const payload: Partial<Enfant> = data.documentsFichiers
        ? {
            ...data,
            documentsFichiers: await offloadChildDocumentsToStorage(
              user?.id || 'creche',
              id,
              data.documentsFichiers,
            ),
          }
        : data;
      // Ne pas réécrire les parents, contacts et documents non demandés : une
      // copie locale périmée pourrait écraser des modifications d'un autre poste.
      await updateCollectionDocument<Enfant>('enfants', id, payload);
      setEnfants(prev => prev.map(item => item.id === id ? normalizeEnfantData({ ...item, ...payload, id }) : item));
    } catch (err) {
      notifyWriteError('modification');
      throw err;
    }
  };

  // Temporary fail-closed protection: the old multi-request deletion could delete
  // the child before related records and leave irrecoverable partial results.
  // Permanent erasure requires a separately reviewed, atomic server workflow.
  const deleteEnfant = async (_id: string) => {
    throw new Error('child_permanent_deletion_temporarily_unavailable');
  };

  // Fetch sensitive health entries only when the child's journal is opened.
  const listChildHealthEvents = async (childId: string): Promise<ChildHealthEvent[]> => {
    const { data, error } = await supabase.rpc('rawdha_list_child_health_events', { p_child_id: childId });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('invalid_health_response');
    return data as ChildHealthEvent[];
  };
  const addChildHealthEvent = async (childId: string, draft: ChildHealthDraft): Promise<ChildHealthEvent> => {
    assertWriteAccess();
    const { data, error } = await trackedBusinessRpc('rawdha_add_child_health_event', {
      p_id: draft.id, p_child_id: childId, p_type: draft.type, p_date: draft.date,
      p_time: draft.heure, p_details: draft.details, p_corrects_id: draft.correctsId,
    });
    if (error) throw error;
    return data as ChildHealthEvent;
  };

  // Dedicated RPCs deliberately surface missing migration, permission and network errors.
  const listPickupAuthorizations = async (childId: string): Promise<PickupAuthorization[]> => {
    const { data, error } = await supabase.rpc('rawdha_list_pickup_authorizations', { p_child_id: childId });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('invalid_pickup_response');
    return data as PickupAuthorization[];
  };
  const createPickupAuthorization = async (childId: string, draft: PickupAuthorizationDraft): Promise<PickupAuthorization> => {
    assertWriteAccess();
    const { data, error } = await trackedBusinessRpc('rawdha_write_pickup_authorization', {
      p_action: 'create', p_child_id: childId, p_id: draft.id, p_nom: draft.nom,
      p_lien: draft.lien, p_telephone: draft.telephone, p_reference: draft.referenceAutorisation,
    });
    if (error) throw error;
    return data as PickupAuthorization;
  };
  const revokePickupAuthorization = async (childId: string, id: string): Promise<PickupAuthorization> => {
    assertWriteAccess();
    const { data, error } = await trackedBusinessRpc('rawdha_write_pickup_authorization', { p_action: 'revoke', p_child_id: childId, p_id: id });
    if (error) throw error;
    return data as PickupAuthorization;
  };

  // --- CLASSES ---
  // La migration de classes doit être appliquée avant ce client : ne jamais
  // revenir aux écritures directes si le RPC est absent ou si l'accès est refusé.
  const writeClasse = async (action: 'create' | 'update' | 'delete', id: string, patch: Partial<Classe> = {}, expectedChildren: string[] | null = null) => {
    assertWriteAccess();
    const { data, error } = await trackedBusinessRpc('rawdha_write_classe', { p_action: action, p_id: id, p_patch: patch, p_expected_children: expectedChildren });
    if (error) throw error;
    return data as Classe;
  };
  const addClasse = async (classe: Omit<Classe, 'id'>) => {
    const id = `class_${crypto.randomUUID()}`;
    try {
      const saved = await writeClasse('create', id, classe);
      setClasses(prev => [...prev, saved]);
      return id;
    } catch (err) {
      notifyWriteError('ajout');
      throw err;
    }
  };
  const updateClasse = async (id: string, data: Partial<Classe>) => {
    try {
      const current = classes.find(item => item.id === id);
      if ('childrenIds' in data && !current) throw new Error('class_not_found');
      const expectedChildren = 'childrenIds' in data ? current?.childrenIds || [] : null;
      const saved = await writeClasse('update', id, data, expectedChildren);
      setClasses(prev => prev.map(item => item.id === id ? saved : item));
    } catch (err) {
      notifyWriteError('modification');
      throw err;
    }
  };
  const deleteClasse = async (id: string) => {
    try {
      await writeClasse('delete', id);
      setClasses(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      notifyWriteError('suppression');
      throw err;
    }
  };

  // --- PRESENCES ---
  // Ces RPC exigent la migration correspondante : aucun retour silencieux aux
  // écritures directes si elle est absente ou refuse la requête.
  const notifyAttendanceError = (err: unknown, action: 'ajout' | 'modification' | 'suppression') => {
    const kind = attendanceErrorKind(err);
    if (kind === 'stale') showToast('Le pointage a changé ailleurs. Actualisez les données avant de réessayer.', 'error');
    else if (kind === 'locked') showToast('La journée est validée. Rouvrez-la avant de modifier le pointage.', 'error');
    else if (kind === 'incomplete') showToast('Des enfants ne sont pas encore pointés. Actualisez puis vérifiez la journée.', 'error');
    else notifyWriteError(action);
  };
  const writePresence = async (action: 'create' | 'update' | 'delete', id: string, patch: Partial<Presence>, expected: Presence | null) => {
    assertWriteAccess();
    const { data, error } = await trackedBusinessRpc('rawdha_write_presence', { p_action: action, p_id: id, p_patch: patch, p_expected: expected });
    if (error) throw error;
    return data as Presence;
  };
  const addPresence = async (presence: Omit<Presence, 'id'>) => {
    try {
      const id = `pres_${crypto.randomUUID()}`;
      const saved = await writePresence('create', id, presence, null);
      setPresences(prev => [...prev.filter(item => item.id !== id), saved]);
      return id;
    } catch (err) {
      notifyAttendanceError(err, 'ajout');
      throw err;
    }
  };
  const updatePresence = async (id: string, data: Partial<Presence>, expected?: Presence) => {
    try {
      const current = expected || presences.find(item => item.id === id);
      if (!current || current.id !== id) throw new Error('attendance_not_found');
      const saved = await writePresence('update', id, data, current);
      setPresences(prev => prev.map(item => item.id === id ? saved : item));
    } catch (err) {
      notifyAttendanceError(err, 'modification');
      throw err;
    }
  };
  const confirmPickupDeparture = async (presence: Presence, authorizationId: string, departureTime: string) => {
    try {
      assertWriteAccess();
      const { data, error } = await trackedBusinessRpc('rawdha_confirm_pickup_departure', {
        p_presence_id: presence.id, p_expected: presence, p_authorization_id: authorizationId,
        p_departure_time: departureTime, p_identity_checked: true,
      });
      if (error) throw error;
      const saved = data as Presence;
      setPresences(prev => prev.map(item => item.id === presence.id ? saved : item));
    } catch (err) {
      const message = err && typeof err === 'object' && 'message' in err ? String(err.message) : '';
      if (message.includes('pickup_authorization_inactive')) showToast('Autorisation introuvable ou révoquée. Actualisez le registre et vérifiez avant la remise.', 'error');
      else if (message.includes('attendance_changed') || message.includes('attendance_not_found')) showToast('La présence a changé. Actualisez les données avant de réessayer.', 'error');
      else showToast('Départ non confirmé. Actualisez et vérifiez le registre et la présence avant de réessayer.', 'error');
      throw err;
    }
  };
  const deletePresence = async (id: string, expected?: Presence) => {
    try {
      const current = expected || presences.find(item => item.id === id);
      if (!current || current.id !== id) throw new Error('attendance_not_found');
      await writePresence('delete', id, {}, current);
      setPresences(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      notifyAttendanceError(err, 'suppression');
      throw err;
    }
  };
  const savePresenceJournee = async (journee: Omit<PresenceJournee, 'id'> & { id?: string }) => {
    try {
      assertWriteAccess();
      const expected = presenceJournees.find(item => item.crecheId === journee.crecheId && item.date === journee.date) || null;
      const { data, error } = await trackedBusinessRpc('rawdha_write_attendance_day', {
        p_creche_id: journee.crecheId, p_date: journee.date, p_status: journee.statut, p_expected: expected,
      });
      if (error) throw error;
      const saved = data as PresenceJournee;
      setPresenceJournees(prev => [...prev.filter(item => item.id !== saved.id), saved]);
      return saved.id;
    } catch (err) {
      notifyAttendanceError(err, 'modification');
      throw err;
    }
  };

  // Notifications are best effort after a confirmed invoice write. Failure never rolls back or repeats a payment.
  const notifyPaymentChange = (previous: Paiement | null, next: Paiement) => {
    if (user?.role !== 'directeur' || user.approvalStatus !== 'approved') return;
    const child = enfants.find(e => e.id === next.enfantId && e.crecheId === user.id);
    if (!child) return;
    void import('../utils/automaticPaymentPush').then(({ dispatchAutomaticPaymentPush }) => dispatchAutomaticPaymentPush({
      crecheId: user.id, crecheNom: user.nomCreche || 'Crèche', enfant: child, previous, next, isArabic: language === 'ar',
    })).then(result => {
      if (result && (result.pushStatus === 'unknown' || result.pushStatus === 'incomplete')) showToast(language === 'ar' ? 'تم حفظ الفاتورة، لكن إرسال الإشعار غير مؤكد.' : 'Facture enregistrée, mais l’envoi de la notification n’est pas confirmé.', 'info');
    }).catch(() => showToast(language === 'ar' ? 'تم حفظ الفاتورة، لكن تعذر تأكيد الإشعار.' : 'Facture enregistrée, mais la notification n’a pas pu être confirmée.', 'info'));
  };

  // --- PAIEMENTS ---
  // No fallback to direct writes: the matching staged migration is required.
  const addPaiement = async (paiement: Omit<Paiement, 'id'> & { id?: string }) => {
    let started = false;
    try {
      assertWriteAccess();
      if (!financialDataReady) throw new Error('financial_data_unavailable');
      started = true; financialWrites.current.active++; financialWrites.current.generation++;
      const id = paiement.id || `pay_${crypto.randomUUID()}`;
      const { id: _id, ...patch } = paiement;
      const { data, error } = await trackedBusinessRpc('rawdha_write_invoice', { p_action:'create', p_id:id, p_patch:patch, p_expected:null });
      if (error) throw error;
      if (!data || data.id !== id) throw new Error('finance_unconfirmed_response');
      if (currentUserId.current === user?.id) { setPaiements(prev => [...prev.filter(item => item.id !== id), data as Paiement]); notifyPaymentChange(null, data as Paiement); }
      return id;
    } catch (err) {
      if (financeErrorKind(err) === 'unknown' || financeErrorKind(err) === 'changed' || financeErrorKind(err) === 'blocked') setFinancialDataReady(false);
      showToast(financeErrorMessage(err, language === 'ar'), 'error');
      throw err;
    } finally { if (started) { financialWrites.current.active--; financialWrites.current.generation++; } }
  };
  const updatePaiement = async (id: string, patch: PaiementPatch, expected: Paiement) => {
    let started = false;
    try {
      assertWriteAccess();
      if (!financialDataReady || !expected || expected.id !== id) throw new Error('financial_data_unavailable');
      started = true; financialWrites.current.active++; financialWrites.current.generation++;
      const { data, error } = await trackedBusinessRpc('rawdha_write_invoice', { p_action:'update', p_id:id, p_patch:patch, p_expected:expected });
      if (error) throw error;
      if (!data || data.id !== id) throw new Error('finance_unconfirmed_response');
      if (currentUserId.current === user?.id) { setPaiements(prev => prev.map(item => item.id === id ? data as Paiement : item)); notifyPaymentChange(expected, data as Paiement); }
    } catch (err) {
      if (financeErrorKind(err) === 'unknown' || financeErrorKind(err) === 'changed' || financeErrorKind(err) === 'blocked') setFinancialDataReady(false);
      showToast(financeErrorMessage(err, language === 'ar'), 'error');
      throw err;
    } finally { if (started) { financialWrites.current.active--; financialWrites.current.generation++; } }
  };
  const deletePaiement = async (_id: string) => {
    throw new Error('finance_deletion_paused');
  };

  const reviewInvoicePeriod = async (expected: Paiement, key: string, reason: string) => {
    let started = false;
    try {
      assertWriteAccess();
      if (!financialDataReady || !expected?.id) throw new Error('financial_data_unavailable');
      started = true; financialWrites.current.active++; financialWrites.current.generation++;
      const { data, error } = await trackedBusinessRpc('rawdha_review_invoice_period', {
        p_invoice_id: expected.id, p_expected: expected, p_period_key: key, p_reason: reason.trim(), p_confirmed: true,
      });
      if (error) throw error;
      if (!data || data.id !== expected.id || data.periodeCle !== key) throw new Error('finance_unconfirmed_response');
      if (currentUserId.current === user?.id) setPaiements(prev => prev.map(item => item.id === expected.id ? data as Paiement : item));
      return data as Paiement;
    } catch (err) {
      if (financeErrorKind(err) === 'unknown' || financeErrorKind(err) === 'changed' || financeErrorKind(err) === 'blocked') { setFinancialDataReady(false); showToast(financeErrorMessage(err, language === 'ar'), 'error'); }
      throw err;
    } finally { if (started) { financialWrites.current.active--; financialWrites.current.generation++; } }
  };
  const getInvoicePeriodReview = async (id: string) => {
    const { data, error } = await callSupabaseRpc<InvoicePeriodReview>('rawdha_get_invoice_period_review', { p_invoice_id: id });
    if (error) throw error;
    return data;
  };

  const invoiceReviewAction = async (draft: InvoiceReviewAction) => {
    let started = false;
    try {
      assertWriteAccess();
      if (!financialDataReady || !draft.expected?.id) throw new Error('financial_data_unavailable');
      started = true; financialWrites.current.active++; financialWrites.current.generation++;
      const { data, error } = await trackedBusinessRpc('rawdha_invoice_review_action', {
        p_request_id: draft.requestId, p_action: draft.action, p_invoice_id: draft.expected.id, p_expected: draft.expected,
        p_period_key: draft.periodKey || null, p_target_invoice_id: draft.target?.id || null,
        p_target_expected: draft.target || null, p_reason: draft.reason.trim(), p_confirmed: true,
      });
      if (error) throw error;
      if (!data || data.id !== draft.expected.id) throw new Error('finance_unconfirmed_response');
      if (currentUserId.current === user?.id) setPaiements(prev => prev.map(item => item.id === draft.expected.id ? data as Paiement : item));
      return data as Paiement;
    } catch (err) {
      if (financeErrorKind(err) === 'unknown' || financeErrorKind(err) === 'changed' || financeErrorKind(err) === 'blocked') { setFinancialDataReady(false); showToast(financeErrorMessage(err, language === 'ar'), 'error'); }
      throw err;
    } finally { if (started) { financialWrites.current.active--; financialWrites.current.generation++; } }
  };
  const listInvoiceReviewEvents = async (id: string) => {
    const { data, error } = await callSupabaseRpc<InvoiceReviewEvent[]>('rawdha_list_invoice_review_events', { p_invoice_id: id });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('finance_invalid_history_response');
    return data;
  };

  // Point-in-time server check only. It cannot reserve the invoice or recall
  // a message after it leaves the app.
  const checkInvoiceReminder = async (invoice: Paiement, child: Enfant, phone?: string) => {
    const generation = financialWrites.current.generation;
    const refresh = refreshSequence.current;
    const owner = user?.id;
    try {
      if (!owner || !financialDataReady || financialWrites.current.active > 0 || !invoice?.id || invoice.enfantId !== child?.id) throw new Error('finance_changed');
      const { data, error } = await callSupabaseRpcWithTimeout<boolean>('rawdha_check_invoice_reminder', {
        p_invoice_id: invoice.id, p_expected_invoice: invoice, p_expected_first_name: child.prenom,
        p_expected_last_name: child.nom, p_expected_phone: phone || null,
      });
      if (error) throw error;
      if (data !== true || currentUserId.current !== owner || !financialReadyRef.current || refreshSequence.current !== refresh
        || financialWrites.current.active > 0 || financialWrites.current.generation !== generation) throw new Error('finance_changed');
    } catch (err) {
      if (currentUserId.current === owner) {
        setFinancialDataReady(false);
        showToast(language === 'ar' ? 'تعذر تأكيد بيانات التذكير. أعد التحميل وتحقق من الفاتورة والوثائق.' : 'Impossible de confirmer les données du rappel. Rechargez et vérifiez la facture et les justificatifs.', 'error');
      }
      throw err;
    }
  };

  // --- ACHATS ---
  // Les mutations passent exclusivement par RPC : la base impose la crèche et l'auteur
  // depuis la session, même si un navigateur tente d’envoyer un autre crecheId.
  const addAchat = async (achat: Omit<Achat, 'id' | 'crecheId' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
    assertWriteAccess();
    if (!user?.id) throw new Error('Session requise');
    const now = new Date().toISOString();
    const tempId = `achat_${Date.now()}`;
    const optimistic = {
      ...achat,
      id: tempId,
      crecheId: user.id,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    } as Achat;
    setAchats(prev => [optimistic, ...prev]);
    try {
      const { data: freshId, error } = await callSupabaseRpc<string>('rawdha_create_achat', { p_data: achat });
      if (error || !freshId) throw error || new Error('Achat refusé.');
      setAchats(prev => prev.map(item => item.id === tempId ? { ...optimistic, id: freshId } : item));
      return freshId;
    } catch (err) {
      setAchats(prev => prev.filter(item => item.id !== tempId));
      notifyWriteError('ajout');
      throw err;
    }
  };

  const updateAchat = async (id: string, data: Partial<Achat>) => {
    assertWriteAccess();
    const previous = achats.find(item => item.id === id);
    if (!previous) throw new Error('Achat introuvable.');
    setAchats(prev => prev.map(item => item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item));
    try {
      const { data: updated, error } = await callSupabaseRpc<boolean>('rawdha_update_achat', { p_id: id, p_patch: data });
      if (error || updated !== true) throw error || new Error('Achat non modifié.');
    } catch (err) {
      setAchats(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
      throw err;
    }
  };

  const deleteAchat = async (id: string) => {
    assertWriteAccess();
    const previous = achats.find(item => item.id === id);
    setAchats(prev => prev.filter(item => item.id !== id));
    try {
      const { data: deleted, error } = await callSupabaseRpc<boolean>('rawdha_delete_achat', { p_id: id });
      if (error || deleted !== true) throw error || new Error('Achat non supprimé.');
    } catch (err) {
      if (previous) setAchats(prev => [previous, ...prev]);
      notifyWriteError('suppression');
      throw err;
    }
  };

  // --- PERSONNEL ---
  const addPersonnel = async (staff: Omit<Personnel, 'id'>) => {
    assertWriteAccess();
    const tempId = (staff as any).id || 'staff_' + Date.now();
    const cleanStaff = { ...staff, id: tempId } as Personnel;
    setPersonnel(prev => [...prev.filter(item => item.id !== tempId), cleanStaff]);
    try {
      const freshId = await addCollectionDocument('personnel', staff);
      setPersonnel(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) {
      setPersonnel(prev => prev.filter(item => item.id !== tempId));
      notifyWriteError('ajout');
      throw err;
    }
  };

  const updatePersonnel = async (id: string, data: Partial<Personnel>) => {
    assertWriteAccess();
    const previous = personnel.find(item => item.id === id);
    setPersonnel(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<Personnel>('personnel', id, data); } catch (err) {
      if (previous) setPersonnel(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
    }
  };

  const deletePersonnel = async (id: string) => {
    assertWriteAccess();
    const previous = personnel.find(item => item.id === id);
    setPersonnel(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('personnel', id); } catch (err) {
      if (previous) setPersonnel(prev => [...prev, previous]);
      notifyWriteError('suppression');
    }
  };

  const notifyPlannedActivity = (activity: Activite) => {
    if (user?.role !== 'directeur' || user.approvalStatus !== 'approved') return;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const message = plannedActivityMessage(activity, user.id, today, language === 'ar');
    if (!message) return;
    const childScope = enfants.filter(child => child.crecheId === user.id);
    void import('../utils/parentPortal').then(({ publishParentAnnouncement }) => publishParentAnnouncement({ crecheId: user.id, crecheNom: user.nomCreche || 'Crèche', title: language === 'ar' ? 'نشاط مبرمج' : 'Activité prévue', message, category: 'evenement', targetScope: 'group', targetGroup: activity.groupe, enfants: childScope })).then(result => {
      if (result.pushStatus === 'unknown' || result.pushStatus === 'incomplete') showToast(language === 'ar' ? 'تم حفظ النشاط، لكن الإشعار غير مؤكد.' : 'Activité enregistrée, mais l’envoi de la notification n’est pas confirmé.', 'info');
    }).catch(() => showToast(language === 'ar' ? 'تم حفظ النشاط، لكن تعذر تأكيد الإشعار.' : 'Activité enregistrée, mais la notification n’a pas pu être confirmée.', 'info'));
  };

  // --- ACTIVITES ---
  const addActivite = async (activite: Omit<Activite, 'id'>) => {
    assertWriteAccess();
    const tempId = (activite as any).id || 'act_' + Date.now();
    const cleanActivite = { ...activite, id: tempId } as Activite;
    setActivites(prev => [...prev.filter(item => item.id !== tempId), cleanActivite]);
    try {
      const freshId = await addCollectionDocument('activites', activite);
      setActivites(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      if (currentUserId.current === user?.id) notifyPlannedActivity({ ...activite, id: freshId });
      return freshId;
    } catch (err) {
      setActivites(prev => prev.filter(item => item.id !== tempId));
      notifyWriteError('ajout');
      throw err;
    }
  };

  const updateActivite = async (id: string, data: Partial<Activite>) => {
    assertWriteAccess();
    const previous = activites.find(item => item.id === id);
    setActivites(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<Activite>('activites', id, data); } catch (err) {
      if (previous) setActivites(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
    }
  };

  const deleteActivite = async (id: string) => {
    assertWriteAccess();
    const previous = activites.find(item => item.id === id);
    setActivites(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('activites', id); } catch (err) {
      if (previous) setActivites(prev => [...prev, previous]);
      notifyWriteError('suppression');
    }
  };

  // --- REPAS ---
  const addRepas = async (meal: Omit<Repas, 'id'>) => {
    try {
      assertWriteAccess();
      const id = await addCollectionDocument('repas', meal);
      setRepas(prev => [...prev.filter(item => item.id !== id), { ...meal, id }]);
      return id;
    } catch (err) {
      showToast('Enregistrement non confirmé. Actualisez et vérifiez le menu avant de réessayer.', 'error');
      throw err;
    }
  };

  const updateRepas = async (id: string, data: Partial<Repas>) => {
    assertWriteAccess();
    const previous = repas.find(item => item.id === id);
    setRepas(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<Repas>('repas', id, data); } catch (err) {
      if (previous) setRepas(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
    }
  };

  const deleteRepas = async (id: string) => {
    assertWriteAccess();
    const previous = repas.find(item => item.id === id);
    setRepas(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('repas', id); } catch (err) {
      if (previous) setRepas(prev => [...prev, previous]);
      notifyWriteError('suppression');
    }
  };

  // --- COMPTES ---
  // Passe par l'Edge Function "create-account" : elle crée le vrai utilisateur Supabase Auth
  // (mot de passe hashé côté serveur) ET la ligne profil, en une seule opération sécurisée.
  const addCompte = async (compte: Omit<UserAccount, 'id'>) => {
    assertWriteAccess();
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('create-account', {
      body: compte,
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error || data?.error) {
      notifyWriteError('ajout');
      throw new Error(data?.error || error?.message || 'Erreur création compte');
    }
    await refreshAll(); // recharge depuis le serveur plutôt que de deviner l'état local
    return data.id as string;
  };

  // ✅ FIX: on ne cache plus l'erreur. Si la policy RLS bloque la modification
  // (ex: admin qui essaie de suspendre le compte d'un directeur), l'appelant
  // le sait maintenant au lieu de croire que ça a marché, et l'état local est restauré.
  const updateCompte = async (id: string, data: Partial<UserAccount>) => {
    assertWriteAccess();
    const previous = comptes.find(item => item.id === id);
    setComptes(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<UserAccount>('comptes', id, data);
    } catch (err) {
      if (previous) setComptes(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
      throw err;
    }
  };

  const logAdminAction = async (
    action: AdminAuditAction,
    targetType: AdminAuditTargetType,
    targetId: string,
    targetLabel?: string,
    metadata: Record<string, unknown> = {},
  ) => {
    if (user?.role !== 'admin') throw new Error('Accès administrateur requis.');
    const { data, error } = await supabase.rpc('rawdha_admin_log_action', {
      p_action: action,
      p_target_type: targetType,
      p_target_id: targetId,
      p_target_label: targetLabel || null,
      p_metadata: metadata,
    });
    if (error || !data) throw new Error(error?.message || 'Impossible d’enregistrer l’action administrateur.');
    const entry = data as AdminAuditLog;
    setAdminAuditLogs(previous => [entry, ...previous.filter(item => item.id !== entry.id)]);
    return entry;
  };

  const updateDirectorSubscription = async (
    id: string,
    patch: Pick<UserAccount, 'abonnementActif' | 'dateFinAbonnement'>,
    action: Extract<AdminAuditAction, 'subscription_suspended' | 'subscription_reactivated' | 'subscription_end_date_updated' | 'trial_extended'>,
  ) => {
    if (user?.role !== 'admin') throw new Error('Accès administrateur requis.');
    const cleanPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
    const { data, error } = await trackedBusinessRpc('rawdha_admin_update_director_account', {
      p_target_id: id,
      p_patch: cleanPatch,
      p_action: action,
    });
    if (error || !data) throw new Error(error?.message || 'Impossible de modifier l’abonnement.');
    const account = data as UserAccount;
    setComptes(previous => previous.map(item => item.id === id ? { ...item, ...account } : item));
    await refreshAll();
    return account;
  };

  const updateDirectorOperations = async (
    id: string,
    patch: Partial<Pick<UserAccount, 'commercialStage' | 'commercialOwnerId' | 'nextFollowUpAt' | 'lastFollowUpAt' | 'commercialNote'>>,
    action: 'commercial_stage_updated' | 'commercial_owner_updated' | 'commercial_note_updated' | 'followup_scheduled' | 'followup_recorded',
  ) => {
    if (user?.role !== 'admin') throw new Error('Accès administrateur requis.');
    const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    const { data, error } = await trackedBusinessRpc('rawdha_admin_update_director_operations', {
      p_target_id: id,
      p_patch: cleanPatch,
      p_action: action,
    });
    if (error || !data) throw new Error(error?.message || 'Impossible de mettre à jour le suivi commercial.');
    const account = data as UserAccount;
    setComptes(previous => previous.map(item => item.id === id ? { ...item, ...account } : item));
    await refreshAll();
    return account;
  };

  const createAdminFollowup = async (
    targetId: string,
    channel: AdminFollowupChannel,
    note?: string,
    dueAt?: string,
    status: AdminFollowupStatus = 'planned',
  ) => {
    if (user?.role !== 'admin') throw new Error('Accès administrateur requis.');
    const { data, error } = await trackedBusinessRpc('rawdha_admin_create_followup', {
      p_target_id: targetId,
      p_channel: channel,
      p_note: note?.trim() || null,
      p_due_at: dueAt || null,
      p_status: status,
    });
    if (error || !data) throw new Error(error?.message || 'Impossible d’enregistrer la relance.');
    const followup = data as AdminFollowup;
    setAdminFollowups(previous => [followup, ...previous.filter(item => item.id !== followup.id)]);
    await refreshAll();
    return followup;
  };

  const publishAdminNotification = async (
    payload: Omit<AppNotification, 'id' | 'recipientRole' | 'recipientIds' | 'senderName' | 'createdAt' | 'readBy'>,
    recipientIds?: string[],
  ) => {
    if (user?.role !== 'admin') throw new Error('Accès administrateur requis.');
    const { data, error } = await trackedBusinessRpc('rawdha_admin_publish_notification', {
      p_payload: payload,
      p_recipient_ids: recipientIds && recipientIds.length ? recipientIds : null,
    });
    if (error || !data) throw new Error(error?.message || 'Impossible de publier l’annonce.');
    const notification = data as AppNotification;
    setNotifications(previous => [notification, ...previous.filter(item => item.id !== notification.id)]);
    await refreshAll();
    return notification;
  };

  // ✅ FIX: appelle l'Edge Function "delete-account" qui supprime le VRAI utilisateur
  // Supabase Auth + la ligne profil. L'ancienne version ne supprimait que la ligne
  // "comptes", donc l'utilisateur Auth restait actif et le compte semblait "revenir".
  const deleteCompte = async (id: string) => {
    assertWriteAccess();
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: { id },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error || data?.error) {
      notifyWriteError('suppression');
      throw new Error(data?.error || error?.message || 'Erreur suppression compte');
    }
    setComptes(prev => prev.filter(item => item.id !== id));
  };

  // --- MESSAGES ---
  const addMessage = async (msg: Omit<DiscussionMessage, 'id'>) => {
    assertWriteAccess();
    const tempId = (msg as any).id || 'msg_' + Date.now();
    const cleanMsg = { ...msg, id: tempId } as DiscussionMessage;
    setMessages(prev => [...prev.filter(item => item.id !== tempId), cleanMsg]);
    try {
      const freshId = await addCollectionDocument('discussion_messages', msg);
      setMessages(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) {
      setMessages(prev => prev.filter(item => item.id !== tempId));
      throw err;
    }
  };

  const updateMessage = async (id: string, data: Partial<DiscussionMessage>) => {
    assertWriteAccess();
    const previous = messages.find(item => item.id === id);
    setMessages(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<DiscussionMessage>('discussion_messages', id, data); } catch (err) {
      if (previous) setMessages(prev => prev.map(item => item.id === id ? previous : item));
      // Pas de toast ici : c'est surtout utilisé pour marquer "lu" en tâche de fond, pas la peine d'interrompre l'utilisateur.
    }
  };

  const deleteMessage = async (id: string) => {
    assertWriteAccess();
    const previous = messages.find(item => item.id === id);
    setMessages(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('discussion_messages', id); } catch (err) {
      if (previous) setMessages(prev => [...prev, previous]);
      notifyWriteError('suppression');
    }
  };

  // --- AVIS ---
  const addAvis = async (avisData: Omit<Avis, 'id'>) => {
    assertWriteAccess();
    const tempId = (avisData as any).id || 'avis_' + Date.now();
    const cleanAvis = { ...avisData, id: tempId } as Avis;
    setAvis(prev => [...prev.filter(item => item.id !== tempId), cleanAvis]);
    try {
      const freshId = await addCollectionDocument('avis', avisData);
      setAvis(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) {
      setAvis(prev => prev.filter(item => item.id !== tempId));
      throw err;
    }
  };

  const deleteAvis = async (id: string) => {
    assertWriteAccess();
    const previous = avis.find(item => item.id === id);
    setAvis(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('avis', id);
    } catch (err) {
      if (previous) setAvis(prev => [...prev, previous]);
      notifyWriteError('suppression');
      throw err;
    }
  };

  // --- SIGNALEMENTS, BUGS ET SUGGESTIONS ---
  const addSignalement = async (signalementData: Omit<Signalement, 'id'>) => {
    assertWriteAccess();
    const tempId = 'signalement_' + Date.now();
    const optimistic = { ...signalementData, id: tempId } as Signalement;
    setSignalements(prev => [optimistic, ...prev]);
    try {
      const freshId = await addCollectionDocument('signalements', signalementData);
      setSignalements(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) {
      setSignalements(prev => prev.filter(item => item.id !== tempId));
      notifyWriteError('ajout');
      throw err;
    }
  };

  const updateSignalement = async (id: string, data: Partial<Signalement>) => {
    assertWriteAccess();
    const previous = signalements.find(item => item.id === id);
    setSignalements(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Signalement>('signalements', id, data);
    } catch (err) {
      if (previous) setSignalements(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
      throw err;
    }
  };

  const deleteSignalement = async (id: string) => {
    assertWriteAccess();
    const previous = signalements.find(item => item.id === id);
    setSignalements(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('signalements', id);
    } catch (err) {
      if (previous) setSignalements(prev => [...prev, previous]);
      notifyWriteError('suppression');
      throw err;
    }
  };

  // --- COMMUNAUTÉ PROFESSIONNELLE PRIVÉE ---
  const addCommunityPost = async (postData: Omit<CommunityPost, 'id'>) => {
    assertWriteAccess();
    const tempId = 'community_post_' + Date.now();
    const optimistic = normalizeCommunityPost({ ...postData, id: tempId });
    setCommunityPosts(prev => [optimistic, ...prev]);
    try {
      const freshId = await addCollectionDocument('community_posts', postData);
      setCommunityPosts(prev => prev.map(item => item.id === tempId ? normalizeCommunityPost({ ...item, id: freshId }) : item));
      return freshId;
    } catch (err) {
      setCommunityPosts(prev => prev.filter(item => item.id !== tempId));
      notifyWriteError('ajout');
      throw err;
    }
  };

  const repostCommunityPost = async (sourcePost: CommunityPost, comment?: string) => {
    if (!user) throw new Error('Session requise');
    const isPlatformAdmin = user.role === 'admin';
    const repostData: Omit<CommunityPost, 'id'> = {
      authorId: user.id,
      authorName: isPlatformAdmin ? 'Rawdha+' : `${user.prenom || ''} ${user.nom || ''}`.trim() || user.email,
      authorAvatarUrl: isPlatformAdmin ? '/rawdah-logo.png' : user.avatarUrl || undefined,
      authorLogoUrl: isPlatformAdmin ? '/rawdah-logo.png' : user.logoUrl || undefined,
      authorBio: isPlatformAdmin
        ? 'Le compte officiel de Rawdha+ pour accompagner les crèches et partager les meilleures pratiques.'
        : user.bio || undefined,
      authorVille: isPlatformAdmin ? 'Algérie' : user.ville || undefined,
      authorSiteWeb: user.siteWeb || undefined,
      authorEstCertifie: isPlatformAdmin || user.estCertifie === true,
      authorCertificationEnfants: isPlatformAdmin ? 30 : user.certificationEnfants || 0,
      crecheId: user.id,
      nomCreche: isPlatformAdmin ? 'Rawdha+ · Plateforme des crèches' : user.nomCreche || 'Crèche',
      categorie: sourcePost.categorie,
      contenu: comment?.trim() || `Je republie la publication de ${sourcePost.authorName}.`,
      statut: 'publie',
      likesCount: 0,
      createdAt: new Date().toISOString(),
      originalPostId: sourcePost.originalPostId || sourcePost.id,
      originalPost: {
        authorId: sourcePost.originalPost?.authorId || sourcePost.authorId,
        authorName: sourcePost.originalPost?.authorName || sourcePost.authorName,
        authorAvatarUrl: sourcePost.originalPost?.authorAvatarUrl || sourcePost.authorAvatarUrl,
        authorLogoUrl: sourcePost.originalPost?.authorLogoUrl || sourcePost.authorLogoUrl,
        authorVille: sourcePost.originalPost?.authorVille || sourcePost.authorVille,
        authorSiteWeb: sourcePost.originalPost?.authorSiteWeb || sourcePost.authorSiteWeb,
        authorEstCertifie: sourcePost.originalPost?.authorEstCertifie ?? sourcePost.authorEstCertifie,
        authorCertificationEnfants: sourcePost.originalPost?.authorCertificationEnfants ?? sourcePost.authorCertificationEnfants,
        nomCreche: sourcePost.originalPost?.nomCreche || sourcePost.nomCreche,
        categorie: sourcePost.originalPost?.categorie || sourcePost.categorie,
        titre: sourcePost.originalPost?.titre || sourcePost.titre,
        contenu: sourcePost.originalPost?.contenu || sourcePost.contenu,
        createdAt: sourcePost.originalPost?.createdAt || sourcePost.createdAt,
      },
      repostComment: comment?.trim() || undefined,
    };
    return addCommunityPost(repostData);
  };

  const updateCommunityPost = async (id: string, data: Partial<CommunityPost>) => {
    assertWriteAccess();
    const previous = communityPosts.find(item => item.id === id);
    setCommunityPosts(prev => prev.map(item => item.id === id ? normalizeCommunityPost({ ...item, ...data }) : item));
    try {
      await updateCollectionDocument<CommunityPost>('community_posts', id, data);
    } catch (err) {
      if (previous) setCommunityPosts(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
      throw err;
    }
  };

  const deleteCommunityPost = async (id: string) => {
    assertWriteAccess();
    const previous = communityPosts.find(item => item.id === id);
    setCommunityPosts(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('community_posts', id);
    } catch (err) {
      if (previous) setCommunityPosts(prev => [previous, ...prev]);
      notifyWriteError('suppression');
      throw err;
    }
  };

  const addCommunityComment = async (commentData: Omit<CommunityComment, 'id'>) => {
    assertWriteAccess();
    const tempId = 'community_comment_' + Date.now();
    const optimistic = normalizeCommunityComment({ ...commentData, id: tempId });
    setCommunityComments(prev => [...prev, optimistic]);
    try {
      const { data: freshId, error } = await callSupabaseRpc<string>('rawdha_create_community_comment', { p_data: commentData });
      if (error || !freshId) throw error || new Error('Commentaire refusé.');
      setCommunityComments(prev => prev.map(item => item.id === tempId ? normalizeCommunityComment({ ...item, id: freshId }) : item));
      return freshId;
    } catch (err) {
      setCommunityComments(prev => prev.filter(item => item.id !== tempId));
      throw err;
    }
  };

  const updateCommunityComment = async (id: string, data: Partial<CommunityComment>) => {
    assertWriteAccess();
    const previous = communityComments.find(item => item.id === id);
    setCommunityComments(prev => prev.map(item => item.id === id ? normalizeCommunityComment({ ...item, ...data }) : item));
    try {
      const { data: updated, error } = await callSupabaseRpc<boolean>('rawdha_update_community_comment', { p_id: id, p_patch: data });
      if (error || updated !== true) throw error || new Error('Commentaire non modifié.');
    } catch (err) {
      if (previous) setCommunityComments(prev => prev.map(item => item.id === id ? previous : item));
      throw err;
    }
  };

  const deleteCommunityComment = async (id: string) => {
    assertWriteAccess();
    const previous = communityComments.find(item => item.id === id);
    setCommunityComments(prev => prev.filter(item => item.id !== id));
    try {
      const { data: deleted, error } = await callSupabaseRpc<boolean>('rawdha_delete_community_comment', { p_id: id });
      if (error || deleted !== true) throw error || new Error('Commentaire non supprimé.');
    } catch (err) {
      if (previous) setCommunityComments(prev => [...prev, previous]);
      throw err;
    }
  };

  const toggleCommunityReaction = async (postId: string) => {
    assertWriteAccess();
    if (!user) throw new Error('Session requise');
    const previousReactions = communityReactions;
    const previousPosts = communityPosts;
    const existing = communityReactions.find(reaction => reaction.postId === postId && reaction.userId === user.id);
    if (existing) {
      setCommunityReactions(prev => prev.filter(reaction => reaction.id !== existing.id));
      setCommunityPosts(prev => prev.map(post => post.id === postId ? { ...post, likesCount: Math.max(0, post.likesCount - 1) } : post));
      try {
        const { data: deleted, error } = await callSupabaseRpc<boolean>('rawdha_delete_community_reaction', { p_post_id: postId });
        if (error || deleted !== true) throw error || new Error('Réaction non supprimée.');
      } catch (err) {
        setCommunityReactions(previousReactions);
        setCommunityPosts(previousPosts);
        throw err;
      }
      return;
    }

    const reactionData: Omit<CommunityReaction, 'id'> = {
      postId,
      userId: user.id,
      createdAt: new Date().toISOString(),
    };
    const tempId = 'community_reaction_' + Date.now();
    setCommunityReactions(prev => [...prev, normalizeCommunityReaction({ ...reactionData, id: tempId })]);
    setCommunityPosts(prev => prev.map(post => post.id === postId ? { ...post, likesCount: post.likesCount + 1 } : post));
    try {
      const { data: freshId, error } = await callSupabaseRpc<string>('rawdha_create_community_reaction', { p_post_id: postId });
      if (error || !freshId) throw error || new Error('Réaction refusée.');
      setCommunityReactions(prev => prev.map(reaction => reaction.id === tempId ? normalizeCommunityReaction({ ...reaction, id: freshId }) : reaction));
    } catch (err) {
      setCommunityReactions(previousReactions);
      setCommunityPosts(previousPosts);
      throw err;
    }
  };

  const addCommunityFeature = async (featureData: Omit<CommunityFeature, 'id'>) => {
    assertWriteAccess();
    const normalized = normalizeCommunityFeature({ ...featureData, id: 'pending' });
    if (!normalized) throw new Error('Fonctionnalité sociale invalide.');
    const { id: _normalizedId, ...cleanFeature } = normalized;
    const tempId = `community_feature_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimistic = { ...cleanFeature, id: tempId } as CommunityFeature;
    setCommunityFeatures(prev => [optimistic, ...prev]);
    try {
      const { data: freshId, error } = await callSupabaseRpc<string>('rawdha_create_community_feature', { p_data: cleanFeature });
      if (error || !freshId) throw error || new Error('Interaction sociale refusée.');
      setCommunityFeatures(prev => prev.map(item => item.id === tempId ? { ...optimistic, id: freshId } : item));
      return freshId;
    } catch (err) {
      setCommunityFeatures(prev => prev.filter(item => item.id !== tempId));
      throw err;
    }
  };

  const updateCommunityFeature = async (id: string, data: Partial<CommunityFeature>) => {
    assertWriteAccess();
    const previous = communityFeatures.find(item => item.id === id);
    setCommunityFeatures(prev => prev.map(item => item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item));
    try {
      const { data: updated, error } = await callSupabaseRpc<boolean>('rawdha_update_community_feature', { p_id: id, p_patch: data });
      if (error || updated !== true) throw error || new Error('Interaction sociale non modifiée.');
    } catch (err) {
      if (previous) setCommunityFeatures(prev => prev.map(item => item.id === id ? previous : item));
      throw err;
    }
  };

  const markCommunityFeatureRead = async (id: string) => {
    if (!user?.id) throw new Error('Session requise');
    if (user.role === 'directeur' && user.approvalStatus === 'pending') return;
    const target = communityFeatures.find(feature => feature.id === id);
    if (!target || target.recipientId !== user.id || !['private_message', 'social_notification'].includes(target.kind)) return;
    if (target.payload?.read === true) return;
    setCommunityFeatures(prev => prev.map(feature => feature.id === id ? { ...feature, payload: { ...feature.payload, read: true } } : feature));
    const { data, error } = await supabase.rpc('rawdha_mark_community_feature_read', { p_id: id });
    if (error || data !== true) {
      setCommunityFeatures(prev => prev.map(feature => feature.id === id ? target : feature));
      throw error || new Error('Impossible de marquer cet élément comme lu.');
    }
  };

  const deleteCommunityFeature = async (id: string) => {
    assertWriteAccess();
    const previous = communityFeatures.find(item => item.id === id);
    setCommunityFeatures(prev => prev.filter(item => item.id !== id));
    try {
      const { data: deleted, error } = await callSupabaseRpc<boolean>('rawdha_delete_community_feature', { p_id: id });
      if (error || deleted !== true) throw error || new Error('Interaction sociale non supprimée.');
    } catch (err) {
      if (previous) setCommunityFeatures(prev => [previous, ...prev]);
      throw err;
    }
  };

  // --- ADMISSIONS PAR LIEN PRIVÉ ---
  // Le QR est provisionné automatiquement par la base à la création d'une crèche.
  // Cette fonction idempotente sert uniquement de filet de sécurité pour les anciens comptes.
  const ensureInscriptionLink = async () => {
    assertWriteAccess();
    const { data, error } = await trackedBusinessRpc('rawdha_create_inscription_link', {
      p_label: 'QR permanent de la crèche',
      p_expires_at: null,
    });
    if (error || !data?.id || !data?.token) {
      throw new Error(error?.message || 'Impossible de provisionner le QR permanent');
    }
    const ensured = {
      id: data.id as string,
      crecheId: user?.id || '',
      token: data.token as string,
      label: 'QR permanent de la crèche',
      nomCreche: data.nomCreche as string | undefined,
      active: true,
      createdAt: new Date().toISOString(),
      expiresAt: null,
    } satisfies InscriptionLink & { token: string };
    setInscriptionLinks(prev => [ensured, ...prev.filter(link => link.id !== ensured.id)]);
    return ensured;
  };

  const createInscriptionLink = async (label?: string, expiresAt?: string | null) => {
    assertWriteAccess();
    const { data, error } = await trackedBusinessRpc('rawdha_create_inscription_link', {
      p_label: label?.trim() || null,
      p_expires_at: expiresAt || null,
    });
    if (error || !data?.id || !data?.token) {
      notifyWriteError('ajout');
      throw new Error(error?.message || 'Impossible de générer le lien d’admission');
    }
    const created = {
      id: data.id as string,
      crecheId: user?.id || '',
      token: data.token as string,
      label: label?.trim() || undefined,
      nomCreche: data.nomCreche as string | undefined,
      active: true,
      createdAt: new Date().toISOString(),
      expiresAt: (data.expiresAt as string | null | undefined) || null,
    } satisfies InscriptionLink & { token: string };
    setInscriptionLinks(prev => [created, ...prev.filter(link => link.id !== created.id)]);
    return created;
  };

  const toggleInscriptionLink = async (id: string, active: boolean) => {
    assertWriteAccess();
    const previous = inscriptionLinks.find(item => item.id === id);
    setInscriptionLinks(prev => prev.map(item => item.id === id ? { ...item, active } : item));
    try {
      await updateCollectionDocument<InscriptionLink>('inscription_liens', id, { active });
    } catch (err) {
      if (previous) setInscriptionLinks(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
      throw err;
    }
  };

  const decideAdmission = async (id: string, statut: 'acceptee' | 'refusee', motif?: string) => {
    assertWriteAccess();
    const previous = demandesAdmission.find(item => item.id === id);
    setDemandesAdmission(prev => prev.map(item => item.id === id ? {
      ...item,
      statut,
      motifRefus: statut === 'refusee' ? motif : undefined,
      traiteLe: new Date().toISOString(),
    } : item));
    try {
      const { data, error } = await trackedBusinessRpc('rawdha_decide_admission', {
        p_id: id,
        p_statut: statut,
        p_motif: motif?.trim() || null,
      });
      if (error || data?.error) throw new Error(error?.message || data?.error || 'Impossible de traiter la demande');
      await refreshAll();
    } catch (err) {
      if (previous) setDemandesAdmission(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
      throw err;
    }
  };

  // --- NOTIFICATIONS (annonces admin -> directeurs) ---
  const addNotification = async (notif: Omit<AppNotification, 'id'>) => {
    assertWriteAccess();
    const tempId = 'notif_' + Date.now();
    const cleanNotif = { ...notif, id: tempId } as AppNotification;
    setNotifications(prev => [cleanNotif, ...prev]);
    try {
      const freshId = await addCollectionDocument('notifications', notif);
      setNotifications(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) {
      // ✅ FIX: avant, aucun try/catch ici -> une erreur faisait planter tout l'appelant sans rollback visuel.
      setNotifications(prev => prev.filter(item => item.id !== tempId));
      notifyWriteError('ajout');
      return tempId;
    }
  };

  const markNotificationRead = async (id: string, userId: string) => {
    assertWriteAccess();
    const target = notifications.find(n => n.id === id);
    if (!target || target.readBy?.includes(userId)) return; // déjà lue, on ne réécrit pas pour rien
    const updatedReadBy = [...(target.readBy || []), userId];
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, readBy: updatedReadBy } : n));
    try {
      const { data, error } = await supabase.rpc('rawdha_mark_notification_read', { p_notification_id: id });
      if (error || !data) throw new Error(error?.message || 'Impossible de marquer l’annonce comme lue.');
      const updated = data as AppNotification;
      setNotifications(prev => prev.map(item => item.id === id ? { ...item, ...updated } : item));
    } catch (err) {
      setNotifications(prev => prev.map(n => n.id === id ? target : n));
      console.error('Erreur marquage notification comme lue:', err);
      showToast(language === 'ar' ? 'لم يتأكد تسجيل القراءة. تحقق من الإعلان قبل المحاولة مجدداً.' : 'Lecture non confirmée. Vérifiez cette annonce avant de réessayer.', 'error');
    }
  };

  const deleteNotification = async (id: string) => {
    assertWriteAccess();
    const previous = notifications.find(item => item.id === id);
    setNotifications(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('notifications', id);
    } catch (err) {
      if (previous) setNotifications(prev => [previous, ...prev]);
      throw err;
    }
  };

  // Automatic monthly invoices are paused locally: a browser-only existence
  // check cannot prevent duplicate invoices across devices or failed reads.

  return (
    <DbContext.Provider value={{
      // On injecte ici les listes FILTRÉES et isolées pour chaque directeur
      enfants: scopedEnfants,
      classes: scopedClasses,
      presences: scopedPresences,
      presenceJournees: scopedPresenceJournees,
      paiements: scopedPaiements,
      achats: scopedAchats,
      personnel: scopedPersonnel,
      activites: scopedActivites,
      repas: scopedRepas,
      comptes: scopedComptes,
      demandesDirecteur: scopedDemandesDirecteur,
      messages,
      avis,
      signalements,
      communityPosts: scopedCommunityPosts,
      communityComments: scopedCommunityComments,
      communityReactions: scopedCommunityReactions,
      communityFeatures: scopedCommunityFeatures,
      inscriptionLinks: scopedInscriptionLinks,
      demandesAdmission: scopedDemandesAdmission,
      notifications,
      adminAuditLogs,
      adminFollowups,
      loading,
      financialDataReady,
      dataLoading,
      dataErrors,
      refreshAll,
      addMessage,
      updateMessage,
      deleteMessage,
      addAvis,
      deleteAvis,
      addSignalement,
      updateSignalement,
      deleteSignalement,
      addCommunityPost,
      repostCommunityPost,
      updateCommunityPost,
      deleteCommunityPost,
      addCommunityComment,
      updateCommunityComment,
      deleteCommunityComment,
      toggleCommunityReaction,
      addCommunityFeature,
      updateCommunityFeature,
      markCommunityFeatureRead,
      deleteCommunityFeature,
      ensureInscriptionLink,
      createInscriptionLink,
      toggleInscriptionLink,
      decideAdmission,
      addNotification,
      markNotificationRead,
      deleteNotification,
      addCompte,
      updateCompte,
      updateDirectorSubscription,
      updateDirectorOperations,
      createAdminFollowup,
      publishAdminNotification,
      logAdminAction,
      deleteCompte,
    addDemandeDirecteur,
    approveDemandeDirecteur,
    updateDemandeDirecteur,
      deleteDemandeDirecteur,
      addEnfant,
      updateEnfant,
      deleteEnfant,
      listChildHealthEvents,
      addChildHealthEvent,
      listPickupAuthorizations,
      createPickupAuthorization,
      revokePickupAuthorization,
      addClasse,
      updateClasse,
      deleteClasse,
      addPresence,
      updatePresence,
      confirmPickupDeparture,
      deletePresence,
      savePresenceJournee,
      addPaiement,
      updatePaiement,
      deletePaiement,
      reviewInvoicePeriod,
      getInvoicePeriodReview,
      invoiceReviewAction,
      listInvoiceReviewEvents,
      checkInvoiceReminder,
      addAchat,
      updateAchat,
      deleteAchat,
      addPersonnel,
      updatePersonnel,
      deletePersonnel,
      addActivite,
      updateActivite,
      deleteActivite,
      addRepas,
      updateRepas,
      deleteRepas
    }}>
      {children}
    </DbContext.Provider>
  );
};

export const useDb = () => {
  const context = useContext(DbContext);
  if (!context) {
    throw new Error('useDb must be used within a DbProvider');
  }
  return context;
};
