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
  contactsUrgence: ContactUrgence[];
  parents: Parent[];
  documentsRequis: {
    certificatMedical: boolean;
    carnetVaccination: boolean;
    justificatifDomicile: boolean;
    photoIdentite: boolean;
  };
  // Pièces jointes d'admission réellement sélectionnées par la directrice.
  // Le format data URL est limité côté formulaire pour rester compatible avec le
  // stockage JSONB actuel; un bucket Storage pourra remplacer ce champ plus tard.
  documentsFichiers?: Partial<Record<'certificatMedical' | 'carnetVaccination' | 'justificatifDomicile' | 'photoIdentite', {
    nom: string;
    type: string;
    taille: number;
    contenu: string;
    ajouteLe: string;
  }>>;
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
}

export interface Classe {
  id: string;
  crecheId?: string;
  nom: string;
  niveau: 'Bébés' | 'Moyens' | 'Grands';
  capacite: number;
}

export interface Activite {
  id: string;
  crecheId?: string;
  titre: string;
  date: string;
  groupe: 'Bébés' | 'Moyens' | 'Grands';
}

export interface Repas {
  id: string;
  crecheId?: string;
  type: 'Déjeuner' | 'Goûter';
  date: string;
  menu: string;
}

export interface UserAccount {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  motDePasse: string;
  role: 'admin' | 'directeur' | 'parent';
  abonnementActif: boolean;
  dateFinAbonnement?: string;
  nomCreche?: string;
  enfantId?: string;
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
