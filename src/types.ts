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
