
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
  crecheId?: string; // id du compte directeur propriétaire (pour cloisonner les crèches)
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
}

export interface Personnel {
  id: string;
  crecheId?: string;
  nom: string;
  prenom: string;
  poste: string;
  statut: 'Actif' | 'Inactif';
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
  dateFinAbonnement?: string; // subscription end date (YYYY-MM-DD or standard ISO date)
  nomCreche?: string;          // Name of the creche if they are a directeur
  enfantId?: string;           // Optional reference to an Enfant
}

export interface DiscussionMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string; // 'admin' or specific parent id
  parentId: string;    // Thread id (the parent's account id, since chats are 1-on-1 between parent and admin)
  text: string;
  timestamp: string;   // ISO format
  isRead: boolean;
}


