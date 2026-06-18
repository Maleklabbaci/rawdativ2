import React, { createContext, useContext, useState, useEffect } from 'react';
import { Enfant, Presence, Paiement, Personnel, Classe, Activite, Repas, UserAccount, DiscussionMessage } from '../types';
import { 
  getCollectionData, 
  addCollectionDocument, 
  setCollectionDocument,
  updateCollectionDocument, 
  deleteCollectionDocument 
} from '../firebase';
import { 
  enfantsData as initialEnfants,
  presencesData as initialPresences,
  paiementsData as initialPaiements,
  personnelData as initialPersonnel,
  classesData as initialClasses,
  activitesData as initialActivites,
  repasData as initialRepas
} from '../data/mockData';

interface DbContextType {
  enfants: Enfant[];
  classes: Classe[];
  presences: Presence[];
  paiements: Paiement[];
  personnel: Personnel[];
  activites: Activite[];
  repas: Repas[];
  comptes: UserAccount[];
  messages: DiscussionMessage[];
  loading: boolean;
  refreshAll: () => Promise<void>;
  
  // Messages Actions
  addMessage: (message: Omit<DiscussionMessage, 'id'>) => Promise<string>;
  updateMessage: (id: string, message: Partial<DiscussionMessage>) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;

  // Comptes Actions
  addCompte: (compte: Omit<UserAccount, 'id'>) => Promise<string>;
  updateCompte: (id: string, compte: Partial<UserAccount>) => Promise<void>;
  deleteCompte: (id: string) => Promise<void>;

  // Enfants Actions
  addEnfant: (enfant: Omit<Enfant, 'id'>) => Promise<string>;
  updateEnfant: (id: string, enfant: Partial<Enfant>) => Promise<void>;
  deleteEnfant: (id: string) => Promise<void>;

  // Classes Actions
  addClasse: (classe: Omit<Classe, 'id'>) => Promise<string>;
  updateClasse: (id: string, classe: Partial<Classe>) => Promise<void>;
  deleteClasse: (id: string) => Promise<void>;

  // Presences Actions
  addPresence: (presence: Omit<Presence, 'id'>) => Promise<string>;
  updatePresence: (id: string, presence: Partial<Presence>) => Promise<void>;
  deletePresence: (id: string) => Promise<void>;

  // Paiements Actions
  addPaiement: (paiement: Omit<Paiement, 'id'>) => Promise<string>;
  updatePaiement: (id: string, paiement: Partial<Paiement>) => Promise<void>;
  deletePaiement: (id: string) => Promise<void>;

  // Personnel Actions
  addPersonnel: (staff: Omit<Personnel, 'id'>) => Promise<string>;
  updatePersonnel: (id: string, staff: Partial<Personnel>) => Promise<void>;
  deletePersonnel: (id: string) => Promise<void>;

  // Activites Actions
  addActivite: (activite: Omit<Activite, 'id'>) => Promise<string>;
  updateActivite: (id: string, activite: Partial<Activite>) => Promise<void>;
  deleteActivite: (id: string) => Promise<void>;

  // Repas Actions
  addRepas: (meal: Omit<Repas, 'id'>) => Promise<string>;
  updateRepas: (id: string, meal: Partial<Repas>) => Promise<void>;
  deleteRepas: (id: string) => Promise<void>;
}

const DbContext = createContext<DbContextType | null>(null);

export const DbProvider = ({ children }: { children: React.ReactNode }) => {
  const [enfants, setEnfants] = useState<Enfant[]>(initialEnfants);
  const [classes, setClasses] = useState<Classe[]>(initialClasses);
  const [presences, setPresences] = useState<Presence[]>(initialPresences);
  const [paiements, setPaiements] = useState<Paiement[]>(initialPaiements);
  const [personnel, setPersonnel] = useState<Personnel[]>(initialPersonnel);
  const [activites, setActivites] = useState<Activite[]>(initialActivites);
  const [repas, setRepas] = useState<Repas[]>(initialRepas);
  const [comptes, setComptes] = useState<UserAccount[]>([]);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshAll = async () => {
    try {
      // Load data from Firestore in the background silenty without changing loading = true
      let dbEnfants = await getCollectionData<Enfant>('enfants');
      let dbClasses = await getCollectionData<Classe>('classes');
      let dbPresences = await getCollectionData<Presence>('presences');
      let dbPaiements = await getCollectionData<Paiement>('paiements');
      let dbPersonnel = await getCollectionData<Personnel>('personnel');
      let dbActivites = await getCollectionData<Activite>('activites');
      let dbRepas = await getCollectionData<Repas>('repas');
      let dbComptes = await getCollectionData<UserAccount>('comptes');
      let dbMessages = await getCollectionData<DiscussionMessage>('discussion_messages');

      // Auto-Seed Firestore if empty to keep demo beautifully alive
      if (dbEnfants.length === 0) {
        console.log('Seeding enfants to Firestore...');
        for (const item of initialEnfants) {
          await setCollectionDocument('enfants', item.id, item);
        }
        dbEnfants = await getCollectionData<Enfant>('enfants');
      }

      if (dbClasses.length === 0) {
        console.log('Seeding classes to Firestore...');
        for (const item of initialClasses) {
          await setCollectionDocument('classes', item.id, item);
        }
        dbClasses = await getCollectionData<Classe>('classes');
      }

      if (dbPresences.length === 0) {
        console.log('Seeding presences to Firestore...');
        for (const item of initialPresences) {
          await setCollectionDocument('presences', item.id, item);
        }
        dbPresences = await getCollectionData<Presence>('presences');
      }

      if (dbPaiements.length === 0) {
        console.log('Seeding paiements to Firestore...');
        for (const item of initialPaiements) {
          await setCollectionDocument('paiements', item.id, item);
        }
        dbPaiements = await getCollectionData<Paiement>('paiements');
      }

      if (dbPersonnel.length === 0) {
        console.log('Seeding personnel to Firestore...');
        for (const item of initialPersonnel) {
          await setCollectionDocument('personnel', item.id, item);
        }
        dbPersonnel = await getCollectionData<Personnel>('personnel');
      }

      if (dbActivites.length === 0) {
        console.log('Seeding activites to Firestore...');
        for (const item of initialActivites) {
          await setCollectionDocument('activites', item.id, item);
        }
        dbActivites = await getCollectionData<Activite>('activites');
      }

      if (dbRepas.length === 0) {
        console.log('Seeding repas to Firestore...');
        for (const item of initialRepas) {
          await setCollectionDocument('repas', item.id, item);
        }
        dbRepas = await getCollectionData<Repas>('repas');
      }

      // Seeding initial admin, director, and parent accounts
      if (dbComptes.length === 0) {
        console.log('Seeding default accounts to Firestore...');
        const initialAccounts: UserAccount[] = [
          {
            id: 'adm1',
            nom: 'Labbaci',
            prenom: 'Abdelmalek',
            email: 'admin@rawdati.com',
            motDePasse: 'rawdati2001',
            role: 'admin',
            abonnementActif: true
          },
          {
            id: 'dir_seed_1',
            nom: 'Benali',
            prenom: 'Amira',
            email: 'directeur@rawdati.com',
            motDePasse: 'demo123',
            role: 'directeur',
            nomCreche: 'Crèche les Marguerites',
            abonnementActif: true,
            dateFinAbonnement: '2026-08-30'
          },
          {
            id: 'dir_seed_2',
            nom: 'Meziane',
            prenom: 'Farid',
            email: 'expired@rawdati.com',
            motDePasse: 'demo123',
            role: 'directeur',
            nomCreche: 'Crèche El Yasmin',
            abonnementActif: true,
            dateFinAbonnement: '2026-06-10' // expired relative to 2026-06-18
          },
          {
            id: 'demo-parent',
            nom: 'Khellaf',
            prenom: 'Amira',
            email: 'parent@rawdati.com',
            motDePasse: 'parent123',
            role: 'parent',
            abonnementActif: true,
            enfantId: '1' // linked to Yanis
          }
        ];
        for (const acc of initialAccounts) {
          await setCollectionDocument('comptes', acc.id, acc);
        }
        dbComptes = await getCollectionData<UserAccount>('comptes');
      } else {
        // Enforce presence of current requested admin credentials in existing collection
        const hasRequestedAdmin = dbComptes.some(c => c.email.toLowerCase() === 'admin@rawdati.com');
        if (!hasRequestedAdmin) {
          const freshAdmin: UserAccount = {
            id: 'adm1',
            nom: 'Labbaci',
            prenom: 'Abdelmalek',
            email: 'admin@rawdati.com',
            motDePasse: 'rawdati2001',
            role: 'admin',
            abonnementActif: true
          };
          await setCollectionDocument('comptes', freshAdmin.id, freshAdmin);
          dbComptes = await getCollectionData<UserAccount>('comptes');
        } else {
          // Update credentials for existing admin with that email to be absolutely sure password matches
          const existingAdmin = dbComptes.find(c => c.email.toLowerCase() === 'admin@rawdati.com');
          if (existingAdmin && existingAdmin.motDePasse !== 'rawdati2001') {
            await updateCollectionDocument<UserAccount>('comptes', existingAdmin.id, { motDePasse: 'rawdati2001' });
            dbComptes = await getCollectionData<UserAccount>('comptes');
          }
        }

        // Also ensure directors exist for premium demo flows if they got deleted somehow
        const hasActiveDirector = dbComptes.some(c => c.email.toLowerCase() === 'directeur@rawdati.com');
        if (!hasActiveDirector) {
          const freshDir: UserAccount = {
            id: 'dir_seed_1',
            nom: 'Benali',
            prenom: 'Amira',
            email: 'directeur@rawdati.com',
            motDePasse: 'demo123',
            role: 'directeur',
            nomCreche: 'Crèche les Marguerites',
            abonnementActif: true,
            dateFinAbonnement: '2026-08-30'
          };
          await setCollectionDocument('comptes', freshDir.id, freshDir);
          dbComptes = await getCollectionData<UserAccount>('comptes');
        }
      }

      // Seeding initial discussion messages if empty
      if (dbMessages.length === 0) {
        console.log('Seeding initial discussion messages...');
        const initialMessages: DiscussionMessage[] = [
          {
            id: 'msg_seed_1',
            senderId: 'demo-parent',
            senderName: 'Amira Khellaf',
            recipientId: 'admin',
            parentId: 'demo-parent',
            text: "Bonjour ! Comment fonctionne le renouvellement de l'abonnement mensuel ?",
            timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
            isRead: true
          },
          {
            id: 'msg_seed_2',
            senderId: 'adm1',
            senderName: 'Abdelmalek Labbaci',
            recipientId: 'demo-parent',
            parentId: 'demo-parent',
            text: "Bonjour Amira ! Le renouvellement s'effectue au bureau de la crèche au début de chaque mois. Vous pouvez également nous poser des questions ici.",
            timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            isRead: true
          }
        ];
        for (const msg of initialMessages) {
          await setCollectionDocument('discussion_messages', msg.id, msg);
        }
        dbMessages = await getCollectionData<DiscussionMessage>('discussion_messages');
      }

      setEnfants(dbEnfants);
      setClasses(dbClasses);
      setPresences(dbPresences);
      setPaiements(dbPaiements);
      setPersonnel(dbPersonnel);
      setActivites(dbActivites);
      setRepas(dbRepas);
      setComptes(dbComptes);
      setMessages(dbMessages);
    } catch (err) {
      console.error('Error fetching/seeding data with Firestore:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  // --- ENFANTS ---
  const addEnfant = async (enfant: Omit<Enfant, 'id'>) => {
    const freshId = await addCollectionDocument('enfants', enfant);
    setEnfants(prev => [...prev, { ...enfant, id: freshId }]);
    return freshId;
  };

  const updateEnfant = async (id: string, data: Partial<Enfant>) => {
    await updateCollectionDocument<Enfant>('enfants', id, data);
    setEnfants(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  };

  const deleteEnfant = async (id: string) => {
    // 1. Delete enfant document
    await deleteCollectionDocument('enfants', id);
    
    // 2. Cascade delete linked presences from DB & state
    const relatedPresences = presences.filter(p => p.enfantId === id);
    for (const p of relatedPresences) {
      await deleteCollectionDocument('presences', p.id);
    }
    setPresences(prev => prev.filter(item => item.enfantId !== id));

    // 3. Cascade delete linked paiements from DB & state
    const relatedPaiements = paiements.filter(p => p.enfantId === id);
    for (const p of relatedPaiements) {
      await deleteCollectionDocument('paiements', p.id);
    }
    setPaiements(prev => prev.filter(item => item.enfantId !== id));

    // 4. Update the local state for enfant
    setEnfants(prev => prev.filter(item => item.id !== id));
  };

  // --- CLASSES ---
  const addClasse = async (classe: Omit<Classe, 'id'>) => {
    const freshId = await addCollectionDocument('classes', classe);
    setClasses(prev => [...prev, { ...classe, id: freshId }]);
    return freshId;
  };

  const updateClasse = async (id: string, data: Partial<Classe>) => {
    await updateCollectionDocument<Classe>('classes', id, data);
    setClasses(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  };

  const deleteClasse = async (id: string) => {
    await deleteCollectionDocument('classes', id);
    setClasses(prev => prev.filter(item => item.id !== id));
  };

  // --- PRESENCES ---
  const addPresence = async (presence: Omit<Presence, 'id'>) => {
    const freshId = await addCollectionDocument('presences', presence);
    setPresences(prev => [...prev, { ...presence, id: freshId }]);
    return freshId;
  };

  const updatePresence = async (id: string, data: Partial<Presence>) => {
    await updateCollectionDocument<Presence>('presences', id, data);
    setPresences(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  };

  const deletePresence = async (id: string) => {
    await deleteCollectionDocument('presences', id);
    setPresences(prev => prev.filter(item => item.id !== id));
  };

  // --- PAIEMENTS ---
  const addPaiement = async (paiement: Omit<Paiement, 'id'>) => {
    const freshId = await addCollectionDocument('paiements', paiement);
    setPaiements(prev => [...prev, { ...paiement, id: freshId }]);
    return freshId;
  };

  const updatePaiement = async (id: string, data: Partial<Paiement>) => {
    await updateCollectionDocument<Paiement>('paiements', id, data);
    setPaiements(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  };

  const deletePaiement = async (id: string) => {
    await deleteCollectionDocument('paiements', id);
    setPaiements(prev => prev.filter(item => item.id !== id));
  };

  // --- PERSONNEL ---
  const addPersonnel = async (staff: Omit<Personnel, 'id'>) => {
    const freshId = await addCollectionDocument('personnel', staff);
    setPersonnel(prev => [...prev, { ...staff, id: freshId }]);
    return freshId;
  };

  const updatePersonnel = async (id: string, data: Partial<Personnel>) => {
    await updateCollectionDocument<Personnel>('personnel', id, data);
    setPersonnel(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  };

  const deletePersonnel = async (id: string) => {
    await deleteCollectionDocument('personnel', id);
    setPersonnel(prev => prev.filter(item => item.id !== id));
  };

  // --- ACTIVITES ---
  const addActivite = async (activite: Omit<Activite, 'id'>) => {
    const freshId = await addCollectionDocument('activites', activite);
    setActivites(prev => [...prev, { ...activite, id: freshId }]);
    return freshId;
  };

  const updateActivite = async (id: string, data: Partial<Activite>) => {
    await updateCollectionDocument<Activite>('activites', id, data);
    setActivites(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  };

  const deleteActivite = async (id: string) => {
    await deleteCollectionDocument('activites', id);
    setActivites(prev => prev.filter(item => item.id !== id));
  };

  // --- REPAS ---
  const addRepas = async (meal: Omit<Repas, 'id'>) => {
    const freshId = await addCollectionDocument('repas', meal);
    setRepas(prev => [...prev, { ...meal, id: freshId }]);
    return freshId;
  };

  const updateRepas = async (id: string, data: Partial<Repas>) => {
    await updateCollectionDocument<Repas>('repas', id, data);
    setRepas(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  };

  const deleteRepas = async (id: string) => {
    await deleteCollectionDocument('repas', id);
    setRepas(prev => prev.filter(item => item.id !== id));
  };

  // --- COMPTES ---
  const addCompte = async (compte: Omit<UserAccount, 'id'>) => {
    const freshId = await addCollectionDocument('comptes', { ...compte });
    setComptes(prev => [...prev, { ...compte, id: freshId }]);
    return freshId;
  };

  const updateCompte = async (id: string, data: Partial<UserAccount>) => {
    await updateCollectionDocument<UserAccount>('comptes', id, data);
    setComptes(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  };

  const deleteCompte = async (id: string) => {
    await deleteCollectionDocument('comptes', id);
    setComptes(prev => prev.filter(item => item.id !== id));
  };

  // --- MESSAGES ---
  const addMessage = async (msg: Omit<DiscussionMessage, 'id'>) => {
    const freshId = await addCollectionDocument('discussion_messages', msg);
    setMessages(prev => [...prev, { ...msg, id: freshId }]);
    return freshId;
  };

  const updateMessage = async (id: string, data: Partial<DiscussionMessage>) => {
    await updateCollectionDocument<DiscussionMessage>('discussion_messages', id, data);
    setMessages(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
  };

  const deleteMessage = async (id: string) => {
    await deleteCollectionDocument('discussion_messages', id);
    setMessages(prev => prev.filter(item => item.id !== id));
  };

  return (
    <DbContext.Provider value={{
      enfants,
      classes,
      presences,
      paiements,
      personnel,
      activites,
      repas,
      comptes,
      messages,
      loading,
      refreshAll,
      addMessage,
      updateMessage,
      deleteMessage,
      addCompte,
      updateCompte,
      deleteCompte,
      addEnfant,
      updateEnfant,
      deleteEnfant,
      addClasse,
      updateClasse,
      deleteClasse,
      addPresence,
      updatePresence,
      deletePresence,
      addPaiement,
      updatePaiement,
      deletePaiement,
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
