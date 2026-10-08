export interface ContactUrgence {
  id: string;
  nom: string;
  telephone: string;
  lien: 'Mère' | 'Père' | 'Tuteur';
}

export interface Parent {
  id: string;
  nom: string;
  prenom: string;
  lien: 'Mère' | 'Père' | 'Tuteur';
  telephone: string;
  email?: string;
  adresse?: string;
  profession?: string;
}

/**
 * Personne habilitée à récupérer l'enfant. Le décret impose que seules les
 * personnes désignées par écrit par le tuteur légal puissent repartir avec
 * l'enfant ; la fiche de retrait doit pouvoir être contrôlée à tout moment.
 */
export interface PersonneAutorisee {
  id: string;
  nom: string;
  prenom?: string;
  /** Mère, Père, Tuteur, Grand-mère, Oncle, Chauffeur, Autre… */
  lien: string;
  telephone: string;
  /** Numéro de pièce d'identité présentée au moment du retrait. */
  pieceIdentite?: string;
  /** false = autorisation révoquée par le tuteur (conservée pour l'historique). */
  active?: boolean;
}

/** Dossier administratif et pièces obligatoires du dossier enfant. */
export interface DocumentsEnfant {
  certificatMedical: boolean;
  carnetVaccination: boolean;
  justificatifDomicile: boolean;
  photoIdentite: boolean;
  /** Numérisation du contrat d'accueil signé par le tuteur légal. */
  contratAccueil: boolean;
  /** Extrait de naissance (ou acte de naissance) de l'enfant. */
  extraitNaissance: boolean;
}

/** Pièce jointe stockée en base64 dans le document JSONB de l'enfant. */
export interface DocumentFichier {
  nom: string;
  type: string;
  taille: number;
  contenu: string;
  ajouteLe: string;
}

export type DocumentEnfantKey = keyof DocumentsEnfant;

export interface Enfant {
  id: string;
  crecheId?: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  genre: 'Garçon' | 'Fille';
  groupeAge: 'Bébés' | 'Moyens' | 'Grands';
  dateInscription: string;
  statut: 'Actif' | 'Inactif';
  allergie?: string;
  regimeAlimentaire?: string;
  groupeSanguin?: string;
  poidsKg?: number;
  medecinTraitant?: string;
  vaccinations?: string;
  notesMedicales?: string;
  contactsUrgence: ContactUrgence[];
  parents: Parent[];
  documentsRequis: DocumentsEnfant;
  // Pièces jointes d'admission réellement sélectionnées par la directrice.
  // Le format data URL est limité côté formulaire pour rester compatible avec le
  // stockage JSONB actuel; un bucket Storage pourra remplacer ce champ plus tard.
  documentsFichiers?: Partial<Record<DocumentEnfantKey, DocumentFichier>>;
  /**
   * Numéro d'ordre du registre matricule des enfants admis. Il est attribué à
   * l'admission et doit rester stable : c'est la référence contrôlée par la
   * Direction de l'Action Sociale (DAS) lors des inspections.
   */
  matricule?: number;
  /**
   * Personnes habilitées à récupérer l'enfant, désignées par le tuteur légal.
   * Seules ces personnes peuvent repartir avec l'enfant (voir Presences).
   */
  personnesAutorisees?: PersonneAutorisee[];
  /** Autorisation de sortie signée par le tuteur légal déposée au dossier. */
  autorisationSortieSignee?: boolean;
  /**
   * Section précise de l'enfant, plus fine que `groupeAge` : la réglementation
   * distingue nourrissons (3-12 mois), petite, moyenne et grande section.
   */
  section?: 'Nourrissons' | 'Petite section' | 'Moyenne section' | 'Grande section';
  // ✅ Jour du mois (1-31) où la facture mensuelle de cet enfant doit être générée
  // automatiquement + notification envoyée au directeur jusqu'au règlement.
  jourEcheanceMensuel?: number;
  // ✅ Suivi de départ : date de sortie + motif (fin d'année, déménagement, etc.)
  dateSortie?: string;
  motifSortie?: string;
}

export interface Presence {
  id: string;
  enfantId: string;
  date: string;
  statut: 'Présent' | 'Absent justifié' | 'Absent non justifié';
  // Détails du pointage quotidien conservés dans la colonne JSONB de presences.
  heureArrivee?: string;
  heureDepart?: string;
  motifAbsence?: string;
  temperature?: string;
  repas?: string;
  humeur?: string;
  // Personne ayant récupéré l’enfant lors du départ quotidien.
  personneRecuperation?: string;
  /** Personne ayant déposé l'enfant le matin (registre d'appel légal). */
  deposePar?: string;
  /** Identifiant de la PersonneAutorisee ayant récupéré l'enfant, si tracé. */
  recupereParId?: string;
  /**
   * Résultat du contrôle d'autorisation au départ. `false` signale un retrait par
   * une personne non habilitée : l'incident doit rester visible dans le registre.
   */
  recuperationAutorisee?: boolean;
}

export interface PresenceJournee {
  id: string;
  crecheId: string;
  date: string;
  statut: 'ouverte' | 'validee';
  valideeLe?: string;
  valideePar?: string;
}

// --- Dossier médical & suivi de santé ---------------------------------------

export type SanteEvenementType =
  | 'medicament'
  | 'incident'
  | 'soin'
  | 'visite_medicale'
  | 'visite_psychologique'
  | 'rappel_medical';

export type SanteGravite = 'legere' | 'moyenne' | 'grave';

/**
 * Écriture du registre de santé d'un enfant. Un événement est immuable dans
 * l'esprit du décret : on corrige en le modifiant plutôt qu'en le supprimant,
 * afin de conserver une trace exploitable lors d'un contrôle.
 */
export interface SanteEvenement {
  id: string;
  enfantId: string;
  type: SanteEvenementType;
  /** Jour de l'événement, format YYYY-MM-DD. */
  date: string;
  /** Heure de l'événement, format HH:MM. */
  heure?: string;

  // --- Administration d'un médicament ---
  medicament?: string;
  dose?: string;
  /** true = administration couverte par une ordonnance déposée au dossier. */
  ordonnance?: boolean;
  administrePar?: string;

  // --- Incident et soins ---
  description?: string;
  gravite?: SanteGravite;
  /** Lieu de l'incident (cour, salle d'activité, réfectoire…). */
  localisation?: string;
  soinsDonnes?: string;
  /** true = les parents ont été prévenus ; la date est conservée séparément. */
  parentsAverti?: boolean;
  parentsAvertiLe?: string;

  // --- Visite d'un professionnel ou rappel ---
  praticien?: string;
  professionnelType?: 'medecin' | 'psychologue' | 'infirmier' | 'autre';
  conclusion?: string;
  /** Date à laquelle Rawdha+ doit rappeler l'échéance (YYYY-MM-DD). */
  prochainRappel?: string;

  // --- Traçabilité ---
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Paiement {
  id: string;
  enfantId: string;
  montant: number;
  statut: 'Payé' | 'En attente' | 'Retard';
  moisConcerne: string;
  dateEcheance?: string;
  moyenPaiement?: string;
  typeFacture?: string;
  reductionCode?: string;
  notes?: string;
  // ✅ Marque une facture créée automatiquement à l'échéance (vs. créée manuellement)
  autoGenere?: boolean;
}

export type AchatCategorie = 'alimentation' | 'hygiene' | 'fournitures' | 'materiel' | 'services' | 'loyer_charges' | 'maintenance' | 'transport' | 'autre';
export type AchatStatut = 'payé' | 'à_payer';
export type AchatMoyenPaiement = 'especes' | 'virement' | 'cheque' | 'carte' | 'autre';

/** Dépense interne d’une crèche, isolée en base par `crecheId`. */
export interface Achat {
  id: string;
  crecheId: string;
  createdBy: string;
  dateAchat: string;
  fournisseur?: string;
  categorie: AchatCategorie;
  libelle: string;
  montant: number;
  tauxTVA?: number;
  statut: AchatStatut;
  moyenPaiement?: AchatMoyenPaiement;
  numeroPiece?: string;
  notes?: string;
  recurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

// ✅ Notification envoyée par l'admin à un ou tous les directeurs (annonce), ou
// notification système (rappel de paiement). "readBy" liste les ids des comptes
// qui l'ont déjà vue/fermée. Les champs de style permettent à l'admin de
// personnaliser entièrement l'apparence du popup (couleurs, icône, bouton).
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  // 'all_directeurs' = diffusée à tous les directeurs, sinon l'id exact d'un compte
  recipientRole: string;
  /** Liste figée des Directrices ciblées lorsque l’audience est segmentée. */
  recipientIds?: string[];
  /** Libellé professionnel de l’audience au moment de la publication. */
  audienceLabel?: string;
  senderName?: string;
  createdAt: string;
  readBy: string[];
  // --- Personnalisation visuelle du popup (définie par l'admin à l'envoi) ---
  bgColor?: string;       // couleur de fond du popup (ex: '#4f46e5')
  textColor?: string;     // couleur du texte (ex: '#ffffff')
  buttonColor?: string;   // couleur du bouton "Fermer/OK"
  icon?: string;          // emoji affiché en haut du popup (ex: '🎉')
  showAsPopup?: boolean;  // true = s'affiche en popup plein écran, false = juste dans la cloche
  // --- Bouton d'action optionnel dans le popup ---
  ctaLabel?: string;                  // texte du bouton (ex: "Payer maintenant"). Vide = pas de bouton.
  ctaType?: 'link' | 'page';          // 'link' = ouvre une URL externe, 'page' = navigue dans l'app
  ctaUrl?: string;                    // utilisé si ctaType === 'link'
  ctaPage?: string;                   // utilisé si ctaType === 'page' (ex: 'paiements')
  // --- Répétition forcée du popup (pour les annonces importantes) ---
  repeatCount?: number;               // combien de fois reforcer l'affichage après fermeture (0 = jamais)
  repeatIntervalSeconds?: number;     // délai entre chaque réaffichage forcé
}

export interface Personnel {
  id: string;
  crecheId?: string;
  nom: string;
  prenom: string;
  poste: string;
  statut: 'Actif' | 'Inactif';
  // ✅ Assurance de l'éducatrice/employé + référence (numéro de police, etc.)
  assuranceActive?: boolean;
  numeroAssurance?: string;
  // --- Dossier RH exigé lors des contrôles ---
  /** Diplômes et qualifications déclarés (ex. « Éducatrice agréée », « CAP petite enfance »). */
  diplomes?: string[];
  /** Référence du ou des diplômes (numéro, organisme délivreur). */
  referencesDiplomes?: string;
  /** Certificat médical d'aptitude professionnelle déposé au dossier. */
  certificatMedicalAptitude?: boolean;
  /** Extrait de casier judiciaire (bulletin n°3) déposé au dossier. */
  casierJudiciaire?: boolean;
  dateEmbauche?: string;
  /** Rôle utilisé pour le calcul du ratio d'encadrement (see Parametres). */
  roleEncadrement?: boolean;
  /** Registre des gardes et permanences assurées par cet employé. */
  gardes?: GardePeriode[];
}

/**
 * Une garde ou permanence assurée par un membre du personnel.
 * Le registre est tenu par personne (voir Personnel) et agrégé par jour pour
 * l'affichage et l'impression du registre mensuel exigé lors des contrôles.
 */
export interface GardePeriode {
  /** Identifiant unique de la ligne, pour pouvoir la retirer individuellement. */
  id: string;
  /** Date de la garde au format AAAA-MM-JJ. */
  date: string;
  type: 'Week-end' | 'Jour férié' | 'Permanence';
  personnelId: string;
  horaire?: string;
  note?: string;
}

export interface Classe {
  id: string;
  crecheId?: string;
  nom: string;
  niveau: 'Bébés' | 'Moyens' | 'Grands';
  capacite: number;
}

/**
 * Domaines d'éveil et de stimulation prévus par le programme pédagogique.
 * Le rattachement de chaque atelier à un domaine est ce qui rend le planning
 * lisible lors d'un contrôle pédagogique.
 */
export type ActiviteDomaine =
  | 'Éveil sensoriel'
  | 'Psychomotricité'
  | 'Langage & comptines'
  | 'Motricité fine'
  | 'Arts plastiques'
  | 'Vie pratique & autonomie'
  | 'Jeux libres';

export interface Activite {
  id: string;
  crecheId?: string;
  titre: string;
  date: string;
  groupe: 'Bébés' | 'Moyens' | 'Grands';
  /** Domaine d'éveil travaillé par l'atelier (facultatif : les anciens ateliers n'en ont pas). */
  domaine?: ActiviteDomaine;
  /** Compétence précise visée par l'atelier. */
  competenceVisee?: string;
  heureDebut?: string;
  heureFin?: string;
  materielRequis?: string;
  lieu?: string;
  educateurRef?: string;
}

export interface Repas {
  id: string;
  crecheId?: string;
  type: 'Déjeuner' | 'Goûter';
  date: string;
  menu: string;
}

export type DemandeDirecteurStatut = 'en_attente' | 'acceptee' | 'refusee';

export interface DemandeDirecteur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  /** Utilisateur Supabase Auth créé lors du signup, sans mot de passe en base. */
  authUserId?: string;
  telephone: string;
  nomCreche: string;
  adresse: string;
  siteWeb?: string;
  message?: string;
  dateDemande: string;
  statut: DemandeDirecteurStatut;
  traiteLe?: string;
  traitePar?: string;
  compteId?: string;
  motifRefus?: string;
}

export type DemandeAdmissionStatut = 'en_attente' | 'acceptee' | 'refusee';

export interface InscriptionLink {
  id: string;
  crecheId: string;
  token?: string;
  label?: string;
  nomCreche?: string;
  active: boolean;
  createdAt: string;
  expiresAt?: string | null;
}

export interface DemandeAdmission {
  id: string;
  crecheId: string;
  nomCreche: string;
  lienId?: string;
  statut: DemandeAdmissionStatut;
  dateDemande: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  genre: 'Garçon' | 'Fille';
  groupeAge: 'Bébés' | 'Moyens' | 'Grands';
  allergie?: string;
  regimeAlimentaire?: string;
  bloodGroup?: string;
  weightKg?: string;
  pediatricianName?: string;
  vaccinations?: string;
  notesMedicales?: string;
  parentNom: string;
  parentPrenom: string;
  parentTelephone: string;
  parentEmail?: string;
  parentAdresse?: string;
  parentProfession?: string;
  parentLien: 'Mère' | 'Père' | 'Tuteur';
  consentementDonnees?: boolean;
  consentementDate?: string;
  privacyVersion?: string;
  documentsRequis?: Enfant['documentsRequis'];
  documentsFichiers?: Enfant['documentsFichiers'];
  motifRefus?: string;
  traiteLe?: string;
  traitePar?: string;
  enfantId?: string;
}

export interface UserAccount {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  /** Jamais renseigné pour les profils Auth ; conservé seulement pour compatibilité des anciens formulaires. */
  motDePasse?: string;
  role: 'admin' | 'directeur' | 'parent';
  /** Statut serveur : un directeur public reste en lecture seule tant qu’il est pending. */
  approvalStatus?: 'pending' | 'approved';
  abonnementActif: boolean;
  /** Dernière activité authentifiée de l’utilisateur, stockée en UTC ISO. */
  lastActivityAt?: string;
  dateFinAbonnement?: string;
  nomCreche?: string;
  telephone?: string;
  ville?: string;
  bio?: string;
  avatarUrl?: string;
  /** Logo public de la crèche affiché dans Rawdha Connect. */
  logoUrl?: string;
  /** Certification automatique accordée à partir de 30 enfants actifs. */
  estCertifie?: boolean;
  dateCertification?: string;
  /** Nombre d’enfants actifs rattachés, utilisé pour le badge public. */
  certificationEnfants?: number;
  siteWeb?: string;
  specialites?: string[];
  horaires?: string;
  services?: string[];
  classesCount?: number;
  /** Métadonnées de pilotage réservées aux Administrateurs. */
  commercialStage?: CommercialStage;
  commercialOwnerId?: string;
  nextFollowUpAt?: string;
  lastFollowUpAt?: string;
  commercialNote?: string;
  /** Profil interne préparatoire, sans effet sur les règles RLS tant qu’il n’est pas délégué explicitement. */
  internalAdminRole?: AdminInternalRole;
  enfantId?: string;
}

export type CommercialStage = 'nouveau' | 'essai' | 'relance' | 'interesse' | 'abonne' | 'suspendu';
/** Profil organisationnel futur d’un Administrateur ; il ne remplace pas le rôle de sécurité `admin`. */
export type AdminInternalRole = 'super_admin' | 'support' | 'commercial';

export type AdminFollowupChannel = 'whatsapp_manual' | 'appel_manuel' | 'notification_interne' | 'email' | 'autre';
export type AdminFollowupStatus = 'planned' | 'done' | 'cancelled';

/** Relance interne créée par un Administrateur ; elle ne déclenche aucun envoi automatique. */
export interface AdminFollowup {
  id: string;
  targetAccountId: string;
  targetLabel: string;
  channel: AdminFollowupChannel;
  note?: string;
  dueAt?: string;
  status: AdminFollowupStatus;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
}

export type AdminAuditAction =
  | 'director_approved'
  | 'director_request_rejected'
  | 'subscription_suspended'
  | 'subscription_reactivated'
  | 'subscription_end_date_updated'
  | 'trial_extended'
  | 'ticket_status_updated'
  | 'ticket_response_saved'
  | 'ticket_assigned'
  | 'ticket_priority_updated'
  | 'ticket_due_date_updated'
  | 'community_post_hidden'
  | 'community_post_restored'
  | 'community_post_pinned'
  | 'community_post_unpinned'
  | 'notification_sent';

export type AdminOperationalAction =
  | 'commercial_stage_updated'
  | 'commercial_owner_updated'
  | 'commercial_note_updated'
  | 'followup_scheduled'
  | 'followup_recorded';

export type AdminAuditTargetType = 'director_account' | 'director_request' | 'ticket' | 'community_post' | 'notification' | 'followup';

/** Entrée immuable d’une action sensible effectuée dans le centre Administrateur. */
export interface AdminAuditLog {
  id: string;
  actorId: string;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: string;
  targetLabel?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface DiscussionMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  parentId: string;
  text: string;
  timestamp: string;
  isRead: boolean;
}

export interface Avis {
  id: string;
  userId: string;
  userName: string;
  nomCreche: string;
  rating: number;
  comment: string;
  date: string;
}

export type CommunityPostCategory = 'activite' | 'materiel' | 'recrutement' | 'formation' | 'partenariat' | 'vente_echange';
export type CommunityPostStatus = 'publie' | 'masquee';

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  authorLogoUrl?: string;
  authorBio?: string;
  authorVille?: string;
  authorSiteWeb?: string;
  authorEstCertifie?: boolean;
  authorCertificationEnfants?: number;
  crecheId: string;
  nomCreche: string;
  categorie: CommunityPostCategory;
  titre?: string;
  contenu: string;
  ville?: string;
  prix?: number;
  contact?: string;
  imageUrls?: string[];
  hashtags?: string[];
  poll?: {
    question: string;
    options: string[];
    votes?: Record<string, number>;
    voterIds?: string[];
  };
  /** Identifiant du post d’origine lorsqu’il s’agit d’une republication. */
  originalPostId?: string;
  /** Instantané minimal du post source pour garder une republication lisible. */
  originalPost?: {
    authorId?: string;
    authorName?: string;
        authorAvatarUrl?: string;
        authorLogoUrl?: string;
        authorVille?: string;
        authorSiteWeb?: string;
        authorEstCertifie?: boolean;
        authorCertificationEnfants?: number;
        nomCreche?: string;
    categorie?: CommunityPostCategory;
    titre?: string;
    contenu?: string;
    createdAt?: string;
  };
  repostComment?: string;
  statut: CommunityPostStatus;
  likesCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  authorLogoUrl?: string;
  authorBio?: string;
  crecheId: string;
  nomCreche: string;
  contenu: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CommunityReaction {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
}

export type CommunityFeatureKind =
  | 'follow'
  | 'saved_post'
  | 'social_notification'
  | 'poll_vote'
  | 'report'
  | 'pin'
  | 'profile_details'
  | 'private_message'
  | 'post_view';

/** Extension sociale persistante ; les champs métier additionnels sont regroupés dans payload. */
export interface CommunityFeature {
  id: string;
  kind: CommunityFeatureKind;
  actorId: string;
  targetId?: string;
  recipientId?: string;
  visibility?: 'public' | 'private';
  createdAt: string;
  updatedAt?: string;
  payload?: Record<string, unknown>;
}

export type SignalementType = 'bug' | 'probleme' | 'suggestion' | 'amelioration';
export type SignalementStatut = 'nouveau' | 'en_cours' | 'resolu' | 'rejete';
export type SignalementPriorite = 'basse' | 'normale' | 'haute' | 'urgente';

export interface Signalement {
  id: string;
  userId: string;
  userName: string;
  nomCreche: string;
  type: SignalementType;
  titre: string;
  description: string;
  statut: SignalementStatut;
  date: string;
  reponseAdmin?: string;
  priorite?: SignalementPriorite;
  assigneeId?: string;
  assigneeName?: string;
  dueAt?: string;
  tags?: string[];
}
