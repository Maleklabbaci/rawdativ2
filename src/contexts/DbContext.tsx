import React, { createContext, useContext, useState, useEffect } from 'react';
import { Enfant, Presence, Paiement, Personnel, Classe, Activite, Repas, UserAccount, DiscussionMessage } from '../types';
import { 
  getCollectionData, 
  addCollectionDocument, 
  setCollectionDocument,
  updateCollectionDocument, 
  deleteCollectionDocument 
} from '../supabase';
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
    const tempId = (enfant as any).id || 'child_' + Date.now();
    const cleanEnfant = { ...enfant, id: tempId } as Enfant;
    setEnfants(prev => [...prev.filter(item => item.id !== tempId), cleanEnfant]);
    try {
      const freshId = await addCollectionDocument('enfants', enfant);
      setEnfants(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) {
      console.error('Firestore addEnfant failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updateEnfant = async (id: string, data: Partial<Enfant>) => {
    setEnfants(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Enfant>('enfants', id, data);
    } catch (err) {
      console.error('Firestore updateEnfant failed in background:', err);
    }
  };

  const deleteEnfant = async (id: string) => {
    setEnfants(prev => prev.filter(item => item.id !== id));
    setPresences(prev => prev.filter(item => item.enfantId !== id));
    setPaiements(prev => prev.filter(item => item.enfantId !== id));
    try {
      await deleteCollectionDocument('enfants', id);
      const relatedPresences = presences.filter(p => p.enfantId === id);
      for (const p of relatedPresences) {
        await deleteCollectionDocument('presences', p.id);
      }
      const relatedPaiements = paiements.filter(p => p.enfantId === id);
      for (const p of relatedPaiements) {
        await deleteCollectionDocument('paiements', p.id);
      }
    } catch (err) {
      console.error('Firestore deleteEnfant failed in background:', err);
    }
  };

  // --- CLASSES ---
  const addClasse = async (classe: Omit<Classe, 'id'>) => {
    const tempId = (classe as any).id || 'class_' + Date.now();
    const cleanClasse = { ...classe, id: tempId } as Classe;
    setClasses(prev => [...prev.filter(item => item.id !== tempId), cleanClasse]);
    try {
      const freshId = await addCollectionDocument('classes', classe);
      setClasses(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) {
      console.error('Firestore addClasse failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updateClasse = async (id: string, data: Partial<Classe>) => {
    setClasses(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Classe>('classes', id, data);
    } catch (err) {
      console.error('Firestore updateClasse failed in background:', err);
    }
  };

  const deleteClasse = async (id: string) => {
    setClasses(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('classes', id);
    } catch (err) {
      console.error('Firestore deleteClasse failed in background:', err);
    }
  };

  // --- PRESENCES ---
  const addPresence = async (presence: Omit<Presence, 'id'>) => {
    const tempId = (presence as any).id || 'pres_' + Date.now();
    const cleanPresence = { ...presence, id: tempId } as Presence;
    setPresences(prev => [...prev.filter(item => item.id !== tempId), cleanPresence]);
    try {
      const freshId = await addCollectionDocument('presences', presence);
      setPresences(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) {
      console.error('Firestore addPresence failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updatePresence = async (id: string, data: Partial<Presence>) => {
    setPresences(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Presence>('presences', id, data);
    } catch (err) {
      console.error('Firestore updatePresence failed in background:', err);
    }
  };

  const deletePresence = async (id: string) => {
    setPresences(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('presences', id);
    } catch (err) {
      console.error('Firestore deletePresence failed in background:', err);
    }
  };

  // --- PAIEMENTS ---
  const addPaiement = async (paiement: Omit<Paiement, 'id'>) => {
    const tempId = (paiement as any).id || 'pay_' + Date.now();
    const cleanPaiement = { ...paiement, id: tempId } as Paiement;
    setPaiements(prev => [...prev.filter(item => item.id !== tempId), cleanPaiement]);
    try {
      const freshId = await addCollectionDocument('paiements', paiement);
      setPaiements(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) {
      console.error('Firestore addPaiement failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updatePaiement = async (id: string, data: Partial<Paiement>) => {
    setPaiements(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Paiement>('paiements', id, data);
    } catch (err) {
      console.error('Firestore updatePaiement failed in background:', err);
    }
  };

  const deletePaiement = async (id: string) => {
    setPaiements(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('paiements', id);
    } catch (err) {
      console.error('Firestore deletePaiement failed in background:', err);
    }
  };

  // --- PERSONNEL ---
  const addPersonnel = async (staff: Omit<Personnel, 'id'>) => {
    const tempId = (staff as any).id || 'staff_' + Date.now();
    const cleanStaff = { ...staff, id: tempId } as Personnel;
    setPersonnel(prev => [...prev.filter(item => item.id !== tempId), cleanStaff]);
    try {
      const freshId = await addCollectionDocument('personnel', staff);
      setPersonnel(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) {
      console.error('Firestore addPersonnel failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updatePersonnel = async (id: string, data: Partial<Personnel>) => {
    setPersonnel(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Personnel>('personnel', id, data);
    } catch (err) {
      console.error('Firestore updatePersonnel failed in background:', err);
    }
  };

  const deletePersonnel = async (id: string) => {
    setPersonnel(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('personnel', id);
    } catch (err) {
      console.error('Firestore deletePersonnel failed in background:', err);
    }
  };

  // --- ACTIVITES ---
  const addActivite = async (activite: Omit<Activite, 'id'>) => {
    const tempId = (activite as any).id || 'act_' + Date.now();
    const cleanActivite = { ...activite, id: tempId } as Activite;
    setActivites(prev => [...prev.filter(item => item.id !== tempId), cleanActivite]);
    try {
      const freshId = await addCollectionDocument('activites', activite);
      setActivites(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) {
      console.error('Firestore addActivite failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updateActivite = async (id: string, data: Partial<Activite>) => {
    setActivites(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Activite>('activites', id, data);
    } catch (err) {
      console.error('Firestore updateActivite failed in background:', err);
    }
  };

  const deleteActivite = async (id: string) => {
    setActivites(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('activites', id);
    } catch (err) {
      console.error('Firestore deleteActivite failed in background:', err);
    }
  };

  // --- REPAS ---
  const addRepas = async (meal: Omit<Repas, 'id'>) => {
    const tempId = (meal as any).id || 'meal_' + Date.now();
    const cleanMeal = { ...meal, id: tempId } as Repas;
    setRepas(prev => [...prev.filter(item => item.id !== tempId), cleanMeal]);
    try {
      const freshId = await addCollectionDocument('repas', meal);
      setRepas(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) {
      console.error('Firestore addRepas failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updateRepas = async (id: string, data: Partial<Repas>) => {
    setRepas(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Repas>('repas', id, data);
    } catch (err) {
      console.error('Firestore updateRepas failed in background:', err);
    }
  };

  const deleteRepas = async (id: string) => {
    setRepas(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('repas', id);
    } catch (err) {
      console.error('Firestore deleteRepas failed in background:', err);
    }
  };

  // --- COMPTES ---
  const addCompte = async (compte: Omit<UserAccount, 'id'>) => {
    const tempId = (compte as any).id || 'acc_' + Date.now();
    const cleanCompte = { ...compte, id: tempId } as UserAccount;
    setComptes(prev => [...prev.filter(item => item.id !== tempId), cleanCompte]);
    try {
      const freshId = await addCollectionDocument('comptes', { ...compte });
      setComptes(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) {
      console.error('Firestore addCompte failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updateCompte = async (id: string, data: Partial<UserAccount>) => {
    setComptes(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<UserAccount>('comptes', id, data);
    } catch (err) {
      console.error('Firestore updateCompte failed in background:', err);
    }
  };

  const deleteCompte = async (id: string) => {
    setComptes(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('comptes', id);
    } catch (err) {
      console.error('Firestore deleteCompte failed in background:', err);
    }
  };

  // --- MESSAGES ---
  const addMessage = async (msg: Omit<DiscussionMessage, 'id'>) => {
    const tempId = (msg as any).id || 'msg_' + Date.now();
    const cleanMsg = { ...msg, id: tempId } as DiscussionMessage;
    setMessages(prev => [...prev.filter(item => item.id !== tempId), cleanMsg]);
    try {
      const freshId = await addCollectionDocument('discussion_messages', msg);
      setMessages(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) {
      console.error('Firestore addMessage failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updateMessage = async (id: string, data: Partial<DiscussionMessage>) => {
    setMessages(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<DiscussionMessage>('discussion_messages', id, data);
    } catch (err) {
      console.error('Firestore updateMessage failed in background:', err);
    }
  };

  const deleteMessage = async (id: string) => {
    setMessages(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('discussion_messages', id);
    } catch (err) {
      console.error('Firestore deleteMessage failed in background:', err);
    }
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
