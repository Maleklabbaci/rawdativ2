
import { Enfant, Presence, Paiement, Personnel, Classe, Activite, Repas } from '../types';

export const enfantsData: Enfant[] = [
  {
    id: '1',
    nom: 'Khellaf',
    prenom: 'Yanis',
    dateNaissance: '2023-05-15',
    genre: 'Garçon',
    groupeAge: 'Bébés',
    dateInscription: '2024-01-10',
    statut: 'Actif',
    contactsUrgence: [{ id: 'c1', nom: 'Amira Khellaf', telephone: '0555 123 456', lien: 'Mère' }],
    parents: [{ id: 'p1', nom: 'Khellaf', prenom: 'Amira', lien: 'Mère', telephone: '0555 123 456' }],
    documentsRequis: { certificatMedical: true, carnetVaccination: true, justificatifDomicile: true, photoIdentite: true }
  }
];

export const presencesData: Presence[] = [
  { id: '1', enfantId: '1', date: new Date().toISOString().split('T')[0], statut: 'Présent' }
];

export const paiementsData: Paiement[] = [
  { id: 'p1', enfantId: '1', montant: 15000, statut: 'Payé', moisConcerne: 'Avril 2026' }
];

export const personnelData: Personnel[] = [
  { id: 's1', nom: 'Labbaci', prenom: 'Abdelmalek', poste: 'Directeur', statut: 'Actif' }
];

export const classesData: Classe[] = [
  { id: 'cl1', nom: 'Classe des Poussins', niveau: 'Bébés', capacite: 10 }
];

export const activitesData: Activite[] = [
  { id: 'a1', titre: 'Atelier Peinture', date: new Date().toISOString().split('T')[0], groupe: 'Bébés' }
];

export const repasData: Repas[] = [
  { id: 'r1', type: 'Déjeuner', date: new Date().toISOString().split('T')[0], menu: 'Purée de légumes et poulet' }
];
