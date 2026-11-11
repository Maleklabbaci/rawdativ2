import type { UserAccount } from '../types';

type Item = { id: string; [key: string]: any };
type Store = Record<string, Item[]>;

const PRENOMS_FILLES = [
  'Lina', 'Yasmine', 'Amina', 'Inès', 'Meriem', 'Nour', 'Sarah', 'Malak', 'Rania', 'Kenza',
  'Hiba', 'Chiraz', 'Dalia', 'Farah', 'Aya', 'Selma', 'Bouchra', 'Zineb', 'Lamia', 'Nada',
  'Syrine', ' Asma', 'Maysa', 'Soundous', 'Ritaj', 'Jana', ' Tasnim', ' Manel', ' Kawthar', ' Nesrine',
].map(s => s.trim());

const PRENOMS_GARCONS = [
  'Amine', 'Adam', 'Rayan', 'Yacine', 'Mehdi', 'Ilyes', 'Anis', 'Hamza', 'Karim', 'Sami',
  'Walid', 'Zakaria', 'Tarek', 'Omar', 'Nassim', 'Bilal', 'Fares', 'Younes', 'Wassim', 'Adem',
  ' Ayoub', 'Ziyad', ' Khalil', ' Lokmane', ' Racim', ' Yanis', ' Imad', ' Sofiane', ' Malik', ' Badis',
].map(s => s.trim());

const NOMS_FAMILLE = [
  'Amrani', 'Benali', 'Cherif', 'Mansouri', 'Boudiaf', 'Touati', 'Belkacem', 'Zerrouki',
  'Saidi', 'Rahmani', 'Hadjadj', 'Ouali', 'Brahimi', 'Khelifi', 'Meziane', 'Bensalem',
  'Bouazza', ' Derradji', ' Hamidi', ' Lahlou',
].map(s => s.trim());

const PRENOMS_MERES = [
  'Nadia', 'Samira', 'Karima', 'Souad', 'Nawel', 'Leila', 'Sabrina', 'Dalila', 'Sihem', 'Fazia',
];

const PRENOMS_PERES = [
  'Mourad', 'Rachid', 'Farid', 'Nabil', 'Kamel', 'Sofiane', 'Tahar', 'Lotfi', ' Djamel', ' Hakim',
].map(s => s.trim());

const GROUPES_SANGUINS = ['O+', 'A+', 'B+', 'O+', 'A+', 'AB+', 'O-', 'A-'];
const PEDIATRES = ['Dr. Khelifi (Blida)', 'Dr. Bensalem (Joinville)', 'Dr. Meziane (Ouled Yaïch)'];

const ALLERGIES_REEL: Record<number, { allergie: string; regime: string }> = {
  3: { allergie: 'Protéines de lait de vache (PLV)', regime: 'Sans produits laitiers' },
  11: { allergie: 'Arachides et fruits à coque', regime: 'Éviction stricte arachide' },
  22: { allergie: 'Blanc d’œuf', regime: 'Sans œuf' },
  34: { allergie: 'Intolérance au gluten', regime: 'Sans gluten' },
  47: { allergie: 'Fraises et kiwi', regime: 'Éviction fruits rouges exotiques' },
  55: { allergie: 'Poisson blanc', regime: 'Menu alternatif volaille' },
};

const JOURS_SEMAINE_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function buildRealCrecheStore(params: {
  persona: 'director' | 'admin' | 'pending' | 'expired' | 'guest';
  demoId: string;
  directorUser: UserAccount;
  adminUser: UserAccount;
  activeUser: UserAccount;
}): Store {
  const { persona, demoId, directorUser, adminUser, activeUser } = params;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const today = `${yyyy}-${mm}-${dd}`;
  const monthKey = `${yyyy}-${mm}`;
  const todayDayName = JOURS_SEMAINE_FR[now.getDay()] || 'Dimanche';
  const activeWeekday = ['Vendredi', 'Samedi'].includes(todayDayName) ? 'Jeudi' : todayDayName;

  // 1. Génération déterministe de 60 enfants actifs + 2 enfants sortis (diplômés en maternelle)
  const enfants: Item[] = [];
  const poussinsIds: string[] = [];
  const papillonsIds: string[] = [];
  const abeillesIds: string[] = [];
  const aiglonsIds: string[] = [];

  for (let i = 1; i <= 60; i++) {
    const isGirl = i === 1 || i === 3 || (i > 3 && i % 2 === 1);
    const nom = NOMS_FAMILLE[(i - 1) % NOMS_FAMILLE.length];
    const prenom =
      i === 1
        ? 'Lina'
        : i === 2
          ? 'Amine'
          : i === 3
            ? 'Yasmine'
            : isGirl
              ? PRENOMS_FILLES[Math.floor((i - 1) / 2) % PRENOMS_FILLES.length]
              : PRENOMS_GARCONS[Math.floor((i - 1) / 2) % PRENOMS_GARCONS.length];

    let groupeAge: 'Bébés' | 'Moyens' | 'Grands';
    let birthYear: number;
    const id = `demo-child-${i}`;

    if (i <= 15) {
      groupeAge = 'Bébés';
      birthYear = yyyy - 1;
      poussinsIds.push(id);
    } else if (i <= 27) {
      groupeAge = 'Moyens';
      birthYear = yyyy - 2;
      papillonsIds.push(id);
    } else if (i <= 38) {
      groupeAge = 'Moyens';
      birthYear = yyyy - 3;
      abeillesIds.push(id);
    } else {
      groupeAge = 'Grands';
      birthYear = yyyy - 4;
      aiglonsIds.push(id);
    }

    const birthMonth = String(((i * 3) % 12) + 1).padStart(2, '0');
    const birthDay = String(((i * 5) % 27) + 1).padStart(2, '0');
    const merePrenom = PRENOMS_MERES[(i - 1) % PRENOMS_MERES.length];
    const perePrenom = PRENOMS_PERES[(i - 1) % PRENOMS_PERES.length];
    const telMere = `055${String(1204000 + i * 13417).slice(0, 7)}`;
    const telPere = `066${String(2408000 + i * 11933).slice(0, 7)}`;
    const allergyInfo = ALLERGIES_REEL[i];

    // 52 dossiers 100 % complets (4/4), 8 dossiers avec 1 pièce manquante pour suivi DAS réaliste
    const hasMissingDoc = i % 8 === 0;

    enfants.push({
      id,
      crecheId: demoId,
      prenom,
      nom,
      genre: isGirl ? 'Fille' : 'Garçon',
      groupeAge,
      dateNaissance: `${birthYear}-${birthMonth}-${birthDay}`,
      dateInscription: `${yyyy}-09-01`,
      statut: 'Actif',
      groupeSanguin: GROUPES_SANGUINS[i % GROUPES_SANGUINS.length],
      poidsKg: groupeAge === 'Bébés' ? 9 + (i % 4) : groupeAge === 'Moyens' ? 13 + (i % 4) : 16 + (i % 5),
      medecinTraitant: PEDIATRES[i % PEDIATRES.length],
      vaccinations: 'Calendrier national à jour (BCG, DTCaVPI-Hib, ROR)',
      allergie: allergyInfo?.allergie,
      regimeAlimentaire: allergyInfo?.regime,
      jourEcheanceMensuel: 5,
      parents: [
        {
          id: `parent-m-${i}`,
          prenom: merePrenom,
          nom,
          lien: 'Mère',
          telephone: telMere,
          email: `${merePrenom.toLowerCase()}.${nom.toLowerCase()}@famille-dz.example`,
          adresse: `Cité des Roses, Blida`,
          profession: i % 3 === 0 ? 'Enseignante' : i % 3 === 1 ? 'Pharmacienne' : 'Cadre administratif',
        },
        {
          id: `parent-p-${i}`,
          prenom: perePrenom,
          nom,
          lien: 'Père',
          telephone: telPere,
          adresse: `Cité des Roses, Blida`,
        },
      ],
      contactsUrgence: [
        {
          id: `urg-${i}`,
          nom: `${perePrenom} ${nom}`,
          telephone: telPere,
          lien: 'Père',
        },
      ],
      documentsRequis: {
        certificatMedical: true,
        carnetVaccination: !hasMissingDoc,
        justificatifDomicile: !(hasMissingDoc && i % 16 === 0),
        photoIdentite: true,
      },
    });
  }

  // 2 enfants sortis (passage à l'école primaire)
  enfants.push(
    {
      id: 'demo-child-out-1',
      crecheId: demoId,
      prenom: 'Yanis',
      nom: 'Hadjadj',
      genre: 'Garçon',
      groupeAge: 'Grands',
      dateNaissance: `${yyyy - 5}-03-12`,
      dateInscription: `${yyyy - 1}-09-03`,
      statut: 'Inactif',
      dateSortie: `${yyyy}-06-30`,
      motifSortie: 'Entrée en classe préparatoire (primaire)',
      parents: [{ id: 'parent-out-1', prenom: 'Karim', nom: 'Hadjadj', lien: 'Père', telephone: '0551998877' }],
      contactsUrgence: [],
      documentsRequis: { certificatMedical: true, carnetVaccination: true, justificatifDomicile: true, photoIdentite: true },
    },
    {
      id: 'demo-child-out-2',
      crecheId: demoId,
      prenom: 'camelia'.replace(/^c/, 'C'),
      nom: 'Meziane',
      genre: 'Fille',
      groupeAge: 'Grands',
      dateNaissance: `${yyyy - 5}-07-21`,
      dateInscription: `${yyyy - 1}-09-03`,
      statut: 'Inactif',
      dateSortie: `${yyyy}-07-15`,
      motifSortie: 'Déménagement familial à Alger',
      parents: [{ id: 'parent-out-2', prenom: 'Leila', nom: 'Meziane', lien: 'Mère', telephone: '0661445566' }],
      contactsUrgence: [],
      documentsRequis: { certificatMedical: true, carnetVaccination: true, justificatifDomicile: true, photoIdentite: true },
    },
  );

  // 2. 4 classes équilibrées couvrant les 60 enfants
  const classes: Item[] = [
    {
      id: 'demo-class-1',
      crecheId: demoId,
      nom: 'Les Poussins',
      niveau: 'Bébés',
      salleNom: 'Salle R01 · Éveil doux',
      educateurChef: 'Sara Boudiaf',
      couleurTheme: 'indigo',
      capacite: 16,
      childrenIds: poussinsIds,
    },
    {
      id: 'demo-class-2',
      crecheId: demoId,
      nom: 'Les Papillons',
      niveau: 'Moyens',
      salleNom: 'Salle R02 · Créativité',
      educateurChef: 'Meriem Touati',
      couleurTheme: 'amber',
      capacite: 14,
      childrenIds: papillonsIds,
    },
    {
      id: 'demo-class-3',
      crecheId: demoId,
      nom: 'Les Abeilles',
      niveau: 'Moyens',
      salleNom: 'Salle R03 · Découverte',
      educateurChef: 'Nadia Belkacem',
      couleurTheme: 'emerald',
      capacite: 14,
      childrenIds: abeillesIds,
    },
    {
      id: 'demo-class-4',
      crecheId: demoId,
      nom: 'Les Aiglons',
      niveau: 'Grands',
      salleNom: 'Salle E01 · Préscolaire',
      educateurChef: 'Imane Zerrouki',
      couleurTheme: 'rose',
      capacite: 24,
      childrenIds: aiglonsIds,
    },
  ];

  // 3. 10 membres du personnel réalistes (pédagogie, puériculture, cuisine, hygiène)
  const personnel: Item[] = [
    {
      id: 'demo-staff-1',
      crecheId: demoId,
      prenom: 'Sara',
      nom: 'Boudiaf',
      poste: 'Éducatrice Principale',
      statut: 'Actif',
      classeAssignee: 'Les Poussins',
      telephone: '0550412211',
      email: 'sara.boudiaf@petitssoleils.dz',
      dateEmbauche: `${yyyy - 2}-09-01`,
      groupeSanguin: 'O+',
      assuranceActive: true,
      numeroAssurance: 'CNAS-09-441820',
    },
    {
      id: 'demo-staff-2',
      crecheId: demoId,
      prenom: 'Meriem',
      nom: 'Touati',
      poste: 'Éducatrice Principale',
      statut: 'Actif',
      classeAssignee: 'Les Papillons',
      telephone: '0550823344',
      email: 'meriem.touati@petitssoleils.dz',
      dateEmbauche: `${yyyy - 2}-09-01`,
      groupeSanguin: 'A+',
      assuranceActive: true,
      numeroAssurance: 'CNAS-09-441821',
    },
    {
      id: 'demo-staff-3',
      crecheId: demoId,
      prenom: 'Nadia',
      nom: 'Belkacem',
      poste: 'Éducatrice Principale',
      statut: 'Actif',
      classeAssignee: 'Les Abeilles',
      telephone: '0661394455',
      email: 'nadia.belkacem@petitssoleils.dz',
      dateEmbauche: `${yyyy - 1}-09-01`,
      groupeSanguin: 'B+',
      assuranceActive: true,
      numeroAssurance: 'CNAS-09-519034',
    },
    {
      id: 'demo-staff-4',
      crecheId: demoId,
      prenom: 'Imane',
      nom: 'Zerrouki',
      poste: 'Éducatrice Préscolaire',
      statut: 'Actif',
      classeAssignee: 'Les Aiglons',
      telephone: '0770556677',
      email: 'imane.zerrouki@petitssoleils.dz',
      dateEmbauche: `${yyyy - 3}-09-01`,
      groupeSanguin: 'O+',
      assuranceActive: true,
      numeroAssurance: 'CNAS-09-388102',
    },
    {
      id: 'demo-staff-5',
      crecheId: demoId,
      prenom: 'Amina',
      nom: 'Saidi',
      poste: 'Auxiliaire de puériculture',
      statut: 'Actif',
      classeAssignee: 'Les Poussins',
      telephone: '0552667788',
      dateEmbauche: `${yyyy - 1}-10-01`,
      groupeSanguin: 'A+',
      assuranceActive: true,
      numeroAssurance: 'CNAS-09-520911',
    },
    {
      id: 'demo-staff-6',
      crecheId: demoId,
      prenom: 'Houria',
      nom: 'Rahmani',
      poste: 'Auxiliaire de puériculture',
      statut: 'Actif',
      classeAssignee: 'Les Aiglons',
      telephone: '0662113399',
      dateEmbauche: `${yyyy}-09-15`,
      groupeSanguin: 'AB+',
      assuranceActive: false, // Renouvellement CNAS en cours -> visible dans l’audit DAS
      numeroAssurance: '',
    },
    {
      id: 'demo-staff-7',
      crecheId: demoId,
      prenom: 'Fatima',
      nom: 'Hadjadj',
      poste: 'Chef Cuisinière',
      statut: 'Actif',
      telephone: '0554778899',
      dateEmbauche: `${yyyy - 3}-09-01`,
      groupeSanguin: 'O+',
      assuranceActive: true,
      numeroAssurance: 'CNAS-09-309415',
    },
    {
      id: 'demo-staff-8',
      crecheId: demoId,
      prenom: 'Samira',
      nom: 'Ouali',
      poste: 'Aide-Cuisinière & Biberonnerie',
      statut: 'Actif',
      telephone: '0771224466',
      dateEmbauche: `${yyyy - 1}-09-01`,
      groupeSanguin: 'A-',
      assuranceActive: true,
      numeroAssurance: 'CNAS-09-511208',
    },
    {
      id: 'demo-staff-9',
      crecheId: demoId,
      prenom: 'Khadidja',
      nom: 'Mansouri',
      poste: 'Coordinatrice Pédagogique & Psychologue',
      statut: 'Actif',
      telephone: '0551901122',
      email: 'khadidja.mansouri@petitssoleils.dz',
      dateEmbauche: `${yyyy - 2}-01-15`,
      groupeSanguin: 'B+',
      assuranceActive: true,
      numeroAssurance: 'CNAS-09-460190',
    },
    {
      id: 'demo-staff-10',
      crecheId: demoId,
      prenom: 'Kamel',
      nom: 'Brahimi',
      poste: 'Accueil, Sécurité & Maintenance',
      statut: 'Actif',
      telephone: '0660998811',
      dateEmbauche: `${yyyy - 2}-09-01`,
      groupeSanguin: 'O+',
      assuranceActive: true,
      numeroAssurance: 'CNAS-09-449003',
    },
  ];

  // 4. Programme complet des 10 repas hebdomadaires (Dimanche → Jeudi : Déjeuner + Goûter)
  const weeklyMeals: Array<{
    jour: string;
    dejeuner: string;
    allergenesDej: string;
    kcalDej: string;
    gouter: string;
    allergenesGou: string;
    kcalGou: string;
  }> = [
    {
      jour: 'Dimanche',
      dejeuner: 'Velouté de potiron, blanc de poulet fermier mijoté aux carottes & riz basmati, pomme douce',
      allergenesDej: 'Aucun allergène majeur (sans gluten, sans arachide)',
      kcalDej: '420 kcal',
      gouter: 'Semoule fine au lait tiède légèrement miellée & quartiers de clémentine',
      allergenesGou: 'Lactose, Gluten (alternative compote sans lait pour PLV)',
      kcalGou: '195 kcal',
    },
    {
      jour: 'Lundi',
      dejeuner: 'Chorba frik douce spécial enfants, boulettes de dinde vapeur, purée de courgettes & banane',
      allergenesDej: 'Gluten (blé vert concassé)',
      kcalDej: '445 kcal',
      gouter: 'Yaourt nature artisanal & biscuit sablé maison à l’avoine',
      allergenesGou: 'Lactose, Gluten, Œuf (alternative compote poire pour allergiques)',
      kcalGou: '185 kcal',
    },
    {
      jour: 'Mardi',
      dejeuner: 'Lentilles vertes mijotées aux petits légumes, omelette moelleuse aux fines herbes & poire',
      allergenesDej: 'Œuf (menu blanc de dinde prévu pour éviction œuf)',
      kcalDej: '430 kcal',
      gouter: 'Crème de riz vanillée maison & dés de pomme dorée',
      allergenesGou: 'Lactose (version lait végétal riz pour PLV)',
      kcalGou: '180 kcal',
    },
    {
      jour: 'Mercredi',
      dejeuner: 'Filet de merlu blanc sans arêtes au four, purée de pommes de terre à l’huile d’olive & épinards doux',
      allergenesDej: 'Poisson, Lactose (menu volaille prévu pour éviction poisson)',
      kcalDej: '410 kcal',
      gouter: 'Pain brioché artisanal, fromage frais pasteurisé & jus d’orange pressé',
      allergenesGou: 'Gluten, Lactose',
      kcalGou: '210 kcal',
    },
    {
      jour: 'Jeudi',
      dejeuner: 'Couscous fin roulé vapeur aux sept légumes du marché & suprême de poulet tendre, raisin sans pépins',
      allergenesDej: 'Gluten (semoule de blé dur)',
      kcalDej: '460 kcal',
      gouter: 'Compote maison pomme-coing sans sucre ajouté & galette de maïs dorée',
      allergenesGou: 'Aucun allergène majeur',
      kcalGou: '175 kcal',
    },
  ];

  const repas: Item[] = [];
  weeklyMeals.forEach((entry, idx) => {
    const isToday = entry.jour === activeWeekday;
    repas.push(
      {
        id: `demo-meal-dej-${idx + 1}`,
        crecheId: demoId,
        type: 'Déjeuner',
        jour: entry.jour,
        ...(isToday ? { date: today } : {}),
        menu: entry.dejeuner,
        allergenes: entry.allergenesDej,
        apportCalorique: entry.kcalDej,
        chefCuisine: 'Fatima Hadjadj',
        bioIngrediens: true,
        hydratationRappel: 'Eau minérale proposée à 10h00, 12h15 et 14h30',
      },
      {
        id: `demo-meal-gou-${idx + 1}`,
        crecheId: demoId,
        type: 'Goûter',
        jour: entry.jour,
        ...(isToday ? { date: today } : {}),
        menu: entry.gouter,
        allergenes: entry.allergenesGou,
        apportCalorique: entry.kcalGou,
        chefCuisine: 'Fatima Hadjadj',
        bioIngrediens: true,
        hydratationRappel: 'Eau tempérée après la sieste à 15h30',
      },
    );
  });

  // 5. 8 activités pédagogiques structurées par section
  const activites: Item[] = [
    {
      id: 'demo-activity-1',
      crecheId: demoId,
      titre: 'Parcours sensoriel & tapis d’éveil tactile',
      date: today,
      groupe: 'Bébés',
      competenceVisee: 'Motricité globale et coordination œil-main',
      heureDebut: '09:30',
      heureFin: '10:15',
      materielRequis: 'Tapis mousse, arches sonores, balles texturées hypoallergéniques',
      lieu: 'Salle d’éveil Les Poussins',
      educateurRef: 'Sara Boudiaf',
    },
    {
      id: 'demo-activity-2',
      crecheId: demoId,
      titre: 'Comptines bilingues (Arabe / Français) & marionnettes',
      date: today,
      groupe: 'Bébés',
      competenceVisee: 'Éveil auditif, rythme et premiers mots',
      heureDebut: '10:45',
      heureFin: '11:15',
      materielRequis: 'Marionnettes animaux en tissu, tambourin doux',
      lieu: 'Coin lecture Les Poussins',
      educateurRef: 'Amina Saidi',
    },
    {
      id: 'demo-activity-3',
      crecheId: demoId,
      titre: 'Atelier peinture végétale — Couleurs des quatre saisons',
      date: today,
      groupe: 'Moyens',
      competenceVisee: 'Expression plastique et reconnaissance des couleurs',
      heureDebut: '09:30',
      heureFin: '10:30',
      materielRequis: 'Gouache lavable non toxique, éponges naturelles, tabliers',
      lieu: 'Atelier créatif Les Papillons',
      educateurRef: 'Meriem Touati',
    },
    {
      id: 'demo-activity-4',
      crecheId: demoId,
      titre: 'Parcours psychomoteur : cerceaux, tunnel & équilibre',
      date: today,
      groupe: 'Moyens',
      competenceVisee: 'Équilibre corporel, repérage spatial et confiance en soi',
      heureDebut: '10:30',
      heureFin: '11:20',
      materielRequis: 'Cerceaux, poutre basse en mousse, tunnel souple',
      lieu: 'Cour intérieure sécurisée',
      educateurRef: 'Nadia Belkacem',
    },
    {
      id: 'demo-activity-5',
      crecheId: demoId,
      titre: 'Mon petit potager : semis de lentilles & arrosage',
      date: today,
      groupe: 'Moyens',
      competenceVisee: 'Découverte du vivant et patience',
      heureDebut: '15:45',
      heureFin: '16:20',
      materielRequis: 'Pots biodégradables, coton, graines, petits arrosoirs',
      lieu: 'Jardin pédagogique',
      educateurRef: 'Meriem Touati',
    },
    {
      id: 'demo-activity-6',
      crecheId: demoId,
      titre: 'Pré-écriture & graphisme ludique (Arabe / Français)',
      date: today,
      groupe: 'Grands',
      competenceVisee: 'Tenue fine du crayon, tracés boucles et lettres rugueuses',
      heureDebut: '09:15',
      heureFin: '10:15',
      materielRequis: 'Lettres rugueuses Montessori, ardoises effaçables, feutres ergonomiques',
      lieu: 'Classe préscolaire Les Aiglons',
      educateurRef: 'Imane Zerrouki',
    },
    {
      id: 'demo-activity-7',
      crecheId: demoId,
      titre: 'Logique & dénombrement Montessori (1 à 10)',
      date: today,
      groupe: 'Grands',
      competenceVisee: 'Association quantité-symbole et tri logique',
      heureDebut: '10:30',
      heureFin: '11:20',
      materielRequis: 'Barres numériques rouges et bleues, perles en bois',
      lieu: 'Classe préscolaire Les Aiglons',
      educateurRef: 'Imane Zerrouki',
    },
    {
      id: 'demo-activity-8',
      crecheId: demoId,
      titre: 'Cercle du conte & expression des émotions',
      date: today,
      groupe: 'Grands',
      competenceVisee: 'Langage oral, écoute active et vocabulaire émotionnel',
      heureDebut: '15:45',
      heureFin: '16:30',
      materielRequis: 'Albums illustrés, cartes des émotions',
      lieu: 'Bibliothèque enfantine',
      educateurRef: 'Khadidja Mansouri',
    },
  ];

  // 6. Autorisations de retrait vérifiées
  const pickupAuthorizations: Item[] = [];
  for (let i = 1; i <= 12; i++) {
    const child = enfants[i - 1];
    const parent = child.parents[0];
    pickupAuthorizations.push({
      id: `demo-pickup-${i}`,
      enfantId: child.id,
      nom: `${parent.prenom} ${parent.nom}`,
      lien: parent.lien,
      telephone: parent.telephone,
      referenceAutorisation: `AUT-${yyyy}-${String(i).padStart(3, '0')}`,
      createdBy: demoId,
      createdAt: `${yyyy}-09-02T08:30:00.000Z`,
      revokedBy: null,
      revokedAt: null,
    });
  }

  // 7. Présences du jour sur les 60 enfants :
  //    - 1..43 : Présents (4 déjà récupérés en fin de journée, 39 présents en crèche)
  //    - 44..46 : Absents justifiés
  //    - 47..48 : Absents non justifiés
  //    - 49..60 : 12 enfants restants "À pointer" pour tester l'appel en direct !
  const presences: Item[] = [];
  for (let i = 1; i <= 48; i++) {
    const childId = `demo-child-${i}`;
    if (i <= 43) {
      const hour = i % 3 === 0 ? '07' : '08';
      const min = String(10 + ((i * 7) % 45)).padStart(2, '0');
      const alreadyPickedUp = i <= 4;
      const auth = pickupAuthorizations[i - 1];
      presences.push({
        id: `demo-presence-${i}`,
        enfantId: childId,
        date: today,
        statut: 'Présent',
        heureArrivee: `${hour}:${min}`,
        temperature: `36.${6 + (i % 4)}`,
        humeur: i % 5 === 0 ? 'Calme' : 'Joyeux',
        repas: i % 4 === 0 ? 'Bon appétit (3/4)' : 'Tout mangé (4/4)',
        ...(alreadyPickedUp && auth
          ? {
              heureDepart: `16:${20 + i * 5}`,
              personneRecuperation: auth.nom,
              personneRecuperationId: `registry-${auth.id}`,
              departVerifie: true,
              departVerifiePar: demoId,
              departVerifieLe: `${today}T16:30:00.000Z`,
            }
          : {}),
      });
    } else if (i <= 46) {
      presences.push({
        id: `demo-presence-${i}`,
        enfantId: childId,
        date: today,
        statut: 'Absent justifié',
        motifAbsence: i === 44 ? 'Visite pédiatre programmée' : 'Rhinopharyngite saisonnière (certificat reçu)',
      });
    } else {
      presences.push({
        id: `demo-presence-${i}`,
        enfantId: childId,
        date: today,
        statut: 'Absent non justifié',
      });
    }
  }

  // 8. Facturation mensuelle réaliste sur 56 enfants (4 enfants sans facture ce mois pour tester "Préparer le mois")
  const paiements: Item[] = [];
  const moyens = ['Espèces', 'Virement', 'CIB / Edahabia', 'Chèque'];
  for (let i = 1; i <= 56; i++) {
    const childId = `demo-child-${i}`;
    const montant = i <= 15 ? 14000 : 12000; // Tarif Bébés 14 000 DA, Moyens/Grands 12 000 DA
    let statut: 'Payé' | 'En attente' | 'Retard';
    if (i <= 46) {
      statut = 'Payé';
    } else if (i <= 52) {
      statut = 'En attente';
    } else {
      statut = 'Retard';
    }
    paiements.push({
      id: `demo-payment-${i}`,
      enfantId: childId,
      montant,
      statut,
      typeFacture: 'Mensuel',
      periodeCle: `M:${monthKey}`,
      moisConcerne: monthKey,
      dateEcheance: `${monthKey}-05`,
      ...(statut === 'Payé' ? { moyenPaiement: moyens[i % moyens.length] } : {}),
    });
  }

  // 9. Dépenses d’intendance réalistes (Achats)
  const achats: Item[] = [
    {
      id: 'demo-achat-1',
      crecheId: demoId,
      createdBy: demoId,
      dateAchat: today,
      fournisseur: 'Marché Central & Volailles Mitidja',
      categorie: 'alimentation',
      libelle: 'Approvisionnement hebdomadaire légumes frais, fruits & volaille contrôlée (60 enfants)',
      montant: 38500,
      statut: 'payé',
      moyenPaiement: 'especes',
      numeroPiece: `BL-${yyyy}-114`,
      recurrent: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'demo-achat-2',
      crecheId: demoId,
      createdBy: demoId,
      dateAchat: `${monthKey}-03`,
      fournisseur: 'Distrimed Hygiène Pro',
      categorie: 'hygiene',
      libelle: 'Lot couches section Bébés, lingettes hypoallergéniques, savon doux & désinfectant surfaces',
      montant: 24800,
      statut: 'payé',
      moyenPaiement: 'virement',
      numeroPiece: `FAC-${yyyy}-892`,
      recurrent: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'demo-achat-3',
      crecheId: demoId,
      createdBy: demoId,
      dateAchat: `${monthKey}-05`,
      fournisseur: 'Papeterie & Éveil El Atlas',
      categorie: 'fournitures',
      libelle: 'Gouaches lavables, papier dessin A3, ardoises & matériel Montessori section Grands',
      montant: 16400,
      statut: 'payé',
      moyenPaiement: 'carte',
      numeroPiece: `FAC-${yyyy}-905`,
      recurrent: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'demo-achat-4',
      crecheId: demoId,
      createdBy: demoId,
      dateAchat: `${monthKey}-06`,
      fournisseur: 'Sonelgaz / SEAAL Blida',
      categorie: 'loyer_charges',
      libelle: 'Provision eau, électricité & chauffage central bâtiment crèche',
      montant: 21500,
      statut: 'à_payer',
      moyenPaiement: null,
      numeroPiece: `AVIS-${yyyy}-11`,
      recurrent: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  // 10. Événements du carnet de santé
  const healthEvents: Item[] = [
    {
      id: 'demo-health-1',
      enfantId: 'demo-child-3',
      type: 'rappel_medical',
      date: today,
      heure: '08:45',
      details: {
        resume: 'Protocole PLV vérifié en cuisine avec Fatima Hadjadj (menu sans produits laitiers servi à midi).',
      },
      correctsId: null,
      createdBy: demoId,
      createdAt: now.toISOString(),
    },
    {
      id: 'demo-health-2',
      enfantId: 'demo-child-1',
      type: 'visite_medicale',
      date: `${monthKey}-02`,
      heure: '10:15',
      details: {
        resume: 'Visite pédiatrique mensuelle Dr. Khelifi : croissance harmonieuse (9,8 kg), RAS.',
      },
      correctsId: null,
      createdBy: demoId,
      createdAt: now.toISOString(),
    },
  ];

  // 11. 2 demandes de pré-inscription QR envoyées par des parents + 2 annonces plateforme non lues
  const demandesAdmission: Item[] = [
    {
      id: 'demo-admission-1',
      crecheId: demoId,
      nomCreche: directorUser.nomCreche,
      statut: 'en_attente',
      dateDemande: new Date(now.getTime() - 2 * 3600_000).toISOString(),
      nom: 'Benkhedda',
      prenom: 'Sirine',
      dateNaissance: `${yyyy - 2}-04-18`,
      genre: 'Fille',
      groupeAge: 'Moyens',
      allergie: '',
      bloodGroup: 'A+',
      parentNom: 'Benkhedda',
      parentPrenom: 'Yacine',
      parentTelephone: '0556129087',
      parentEmail: 'yacine.benkhedda@famille-dz.example',
      parentLien: 'Père',
      consentementDonnees: true,
    },
    {
      id: 'demo-admission-2',
      crecheId: demoId,
      nomCreche: directorUser.nomCreche,
      statut: 'en_attente',
      dateDemande: new Date(now.getTime() - 45 * 60_000).toISOString(),
      nom: 'Larbi',
      prenom: 'Rayane',
      dateNaissance: `${yyyy - 1}-02-09`,
      genre: 'Garçon',
      groupeAge: 'Bébés',
      allergie: 'Aucune allergie signalée',
      bloodGroup: 'O+',
      parentNom: 'Larbi',
      parentPrenom: 'Asma',
      parentTelephone: '0663781245',
      parentEmail: 'asma.larbi@famille-dz.example',
      parentLien: 'Mère',
      consentementDonnees: true,
    },
  ];

  const notifications: Item[] = [
    {
      id: 'demo-notif-1',
      title: 'Campagne de contrôle sanitaire d’automne (DAS)',
      message:
        'Pensez à vérifier la complétude des carnets de vaccination et des attestations CNAS du personnel dans l’encart Conformité DAS du tableau de bord.',
      recipientRole: 'all_directeurs',
      senderName: 'Équipe Rawdha+',
      createdAt: new Date(now.getTime() - 3 * 3600_000).toISOString(),
      readBy: [],
      showAsPopup: false,
    },
    {
      id: 'demo-notif-2',
      title: 'Nouveauté : Scan multi-photos PDF & Visionneuse intégrée',
      message:
        'Vous pouvez désormais photographier plusieurs pages de documents (certificat médical, carnet de vaccin) en un seul PDF < 2 Mo consultable directement sans téléchargement.',
      recipientRole: 'all_directeurs',
      senderName: 'Équipe Rawdha+',
      createdAt: new Date(now.getTime() - 26 * 3600_000).toISOString(),
      readBy: [],
      showAsPopup: false,
    },
  ];

  return {
    enfants,
    classes,
    personnel,
    repas,
    activites,
    presences,
    paiements,
    achats,
    pickupAuthorizations,
    healthEvents,
    presenceJournees: [],
    invoiceReviews: [],
    invoiceReviewEvents: [],
    comptes:
      persona === 'admin'
        ? [
            adminUser,
            {
              ...directorUser,
              telephone: '0555123456',
              ville: 'Blida',
              dateFinAbonnement: `${yyyy + 1}-09-01`,
              estCertifie: true,
              certificationEnfants: 60,
            },
            {
              id: 'demo-pending-dir',
              nom: 'Attente',
              prenom: 'Salma',
              email: 'salma@example.invalid',
              role: 'directeur',
              approvalStatus: 'pending',
              abonnementActif: false,
              nomCreche: 'Crèche Les Oliviers',
            },
          ]
        : [
            activeUser.abonnementActif && !activeUser.dateFinAbonnement
              ? { ...activeUser, dateFinAbonnement: `${yyyy + 1}-09-01` }
              : activeUser,
          ],
    demandesDirecteur:
      persona === 'admin'
        ? [
            {
              id: 'demo-dir-req-1',
              statut: 'en_attente',
              dateDemande: now.toISOString(),
              nom: 'Bensalem',
              prenom: 'Amel',
              email: 'amel@example.invalid',
              telephone: '0555112233',
              nomCreche: 'Crèche Les Jasmins',
              adresse: 'Blida Centre',
              message: 'Ouverture prévue pour 45 enfants sur 3 sections.',
            },
          ]
        : [],
    messages:
      persona === 'admin'
        ? [
            {
              id: 'demo-msg-1',
              senderId: demoId,
              senderName: 'Crèche Les Petits Soleils',
              recipientId: 'admin',
              parentId: demoId,
              text: 'Bonjour, notre effectif vient de passer à 60 enfants actifs.',
              timestamp: now.toISOString(),
              isRead: false,
            },
          ]
        : [
            {
              id: 'demo-msg-dir-1',
              senderId: 'admin',
              senderName: 'Support Rawdha+',
              recipientId: demoId,
              parentId: demoId,
              text: 'Félicitations pour le badge Crèche Certifiée (60 enfants inscrits) ! Notre équipe reste disponible.',
              timestamp: new Date(now.getTime() - 5 * 3600_000).toISOString(),
              isRead: false,
            },
          ],
    avis:
      persona === 'admin'
        ? [
            {
              id: 'demo-avis-1',
              userId: demoId,
              userName: 'Directrice Démo',
              nomCreche: directorUser.nomCreche,
              rating: 5,
              comment: 'Gestion fluide au quotidien avec nos 60 enfants et 10 employées.',
              date: now.toISOString(),
            },
          ]
        : [],
    signalements:
      persona === 'admin'
        ? [
            {
              id: 'demo-sig-1',
              userId: demoId,
              userName: 'Directrice Démo',
              nomCreche: directorUser.nomCreche,
              type: 'suggestion',
              statut: 'nouveau',
              priorite: 'haute',
              titre: 'Question sur l’export mensuel comptable',
              description: 'Exemple de ticket support pour le pilotage administrateur.',
              date: now.toISOString(),
            },
          ]
        : [],
    communityPosts: [
      {
        id: 'demo-post-1',
        authorId: demoId,
        authorName: 'Crèche Les Petits Soleils',
        crecheId: demoId,
        nomCreche: directorUser.nomCreche,
        categorie: 'activite',
        titre: 'Atelier potager d’automne avec nos sections Moyens & Grands',
        contenu:
          'Retour très positif des 45 enfants des sections Moyens et Grands sur l’atelier semis de lentilles et éveil sensoriel cette semaine à Blida.',
        ville: 'Blida',
        statut: 'publie',
        likesCount: 8,
        createdAt: now.toISOString(),
      },
    ],
    communityComments: [],
    communityReactions: [],
    communityFeatures: [],
    inscriptionLinks: [
      {
        id: 'demo-qr-link-1',
        crecheId: demoId,
        token: 'petits-soleils-blida-2026',
        active: true,
        createdAt: now.toISOString(),
      },
    ],
    demandesAdmission,
    notifications,
    adminAuditLogs:
      persona === 'admin'
        ? [
            {
              id: 'demo-audit-1',
              actorId: 'adm1',
              action: 'subscription_reactivated',
              targetType: 'director',
              targetId: demoId,
              targetLabel: directorUser.nomCreche,
              createdAt: now.toISOString(),
            },
          ]
        : [],
    adminFollowups:
      persona === 'admin'
        ? [
            {
              id: 'demo-follow-1',
              targetAccountId: demoId,
              targetLabel: directorUser.nomCreche,
              channel: 'appel_manuel',
              status: 'planned',
              dueAt: today,
              note: 'Point trimestriel de satisfaction.',
              createdBy: 'adm1',
              createdAt: now.toISOString(),
            },
          ]
        : [],
  };
}
