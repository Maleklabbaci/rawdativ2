import React, { createContext, useContext, useState, useEffect } from 'react';
import { Enfant, Presence, Paiement, Personnel, Classe, Activite, Repas, UserAccount, DiscussionMessage } from '../types';
import { 
  getCollectionData, 
  addCollectionDocument, 
  updateCollectionDocument, 
  deleteCollectionDocument,
  setCollectionDocument
} from '../supabase';

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
  
  addMessage: (message: Omit<DiscussionMessage, 'id'>) => Promise<string>;
  updateMessage: (id: string, message: Partial<DiscussionMessage>) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;

  addCompte: (compte: Omit<UserAccount, 'id'>) => Promise<string>;
  updateCompte: (id: string, compte: Partial<UserAccount>) => Promise<void>;
  deleteCompte: (id: string) => Promise<void>;

  addEnfant: (enfant: Omit<Enfant, 'id'>) => Promise<string>;
  updateEnfant: (id: string, enfant: Partial<Enfant>) => Promise<void>;
  deleteEnfant: (id: string) => Promise<void>;

  addClasse: (classe: Omit<Classe, 'id'>) => Promise<string>;
  updateClasse: (id: string, classe: Partial<Classe>) => Promise<void>;
  deleteClasse: (id: string) => Promise<void>;

  addPresence: (presence: Omit<Presence, 'id'>) => Promise<string>;
  updatePresence: (id: string, presence: Partial<Presence>) => Promise<void>;
  deletePresence: (id: string) => Promise<void>;

  addPaiement: (paiement: Omit<Paiement, 'id'>) => Promise<string>;
  updatePaiement: (id: string, paiement: Partial<Paiement>) => Promise<void>;
  deletePaiement: (id: string) => Promise<void>;

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

const DbContext = createContext<DbContextType | null>(null);

export const DbProvider = ({ children }: { children: React.ReactNode }) => {
  const [enfants, setEnfants] = useState<Enfant[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [activites, setActivites] = useState<Activite[]>([]);
  const [repas, setRepas] = useState<Repas[]>([]);
  const [comptes, setComptes] = useState<UserAccount[]>([]);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshAll = async () => {
    try {
      const dbEnfants = await getCollectionData<Enfant>('enfants');
      const dbClasses = await getCollectionData<Classe>('classes');
      const dbPresences = await getCollectionData<Presence>('presences');
      const dbPaiements = await getCollectionData<Paiement>('paiements');
      const dbPersonnel = await getCollectionData<Personnel>('personnel');
      const dbActivites = await getCollectionData<Activite>('activites');
      const dbRepas = await getCollectionData<Repas>('repas');
      let dbComptes = await getCollectionData<UserAccount>('comptes');
      const dbMessages = await getCollectionData<DiscussionMessage>('discussion_messages');

      if (dbComptes.length === 0) {
        console.log('Création du compte administrateur par défaut...');
        const adminAccount: UserAccount = {
          id: 'adm1',
          nom: 'Admin',
          prenom: 'Rawdati',
          email: 'admin@rawdati.com',
          motDePasse: 'rawdati2001',
          role: 'admin',
          abonnementActif: true
        };
        await setCollectionDocument('comptes', adminAccount.id, adminAccount);
        dbComptes = await getCollectionData<UserAccount>('comptes');
      } else {
        const hasRequestedAdmin = dbComptes.some(c => c.email.toLowerCase() === 'admin@rawdati.com');
        if (!hasRequestedAdmin) {
          const freshAdmin: UserAccount = {
            id: 'adm1',
            nom: 'Admin',
            prenom: 'Rawdati',
            email: 'admin@rawdati.com',
            motDePasse: 'rawdati2001',
            role: 'admin',
            abonnementActif: true
          };
          await setCollectionDocument('comptes', freshAdmin.id, freshAdmin);
          dbComptes = await getCollectionData<UserAccount>('comptes');
        }
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
      console.error('Erreur de connexion à Supabase:', err);
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
      console.error('Supabase addEnfant failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updateEnfant = async (id: string, data: Partial<Enfant>) => {
    setEnfants(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Enfant>('enfants', id, data);
    } catch (err) {
      console.error('Supabase updateEnfant failed in background:', err);
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
      console.error('Supabase deleteEnfant failed in background:', err);
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
      console.error('Supabase addClasse failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updateClasse = async (id: string, data: Partial<Classe>) => {
    setClasses(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Classe>('classes', id, data);
    } catch (err) {
      console.error('Supabase updateClasse failed in background:', err);
    }
  };

  const deleteClasse = async (id: string) => {
    setClasses(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('classes', id);
    } catch (err) {
      console.error('Supabase deleteClasse failed in background:', err);
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
      console.error('Supabase addPresence failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updatePresence = async (id: string, data: Partial<Presence>) => {
    setPresences(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Presence>('presences', id, data);
    } catch (err) {
      console.error('Supabase updatePresence failed in background:', err);
    }
  };

  const deletePresence = async (id: string) => {
    setPresences(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('presences', id);
    } catch (err) {
      console.error('Supabase deletePresence failed in background:', err);
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
      console.error('Supabase addPaiement failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updatePaiement = async (id: string, data: Partial<Paiement>) => {
    setPaiements(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Paiement>('paiements', id, data);
    } catch (err) {
      console.error('Supabase updatePaiement failed in background:', err);
    }
  };

  const deletePaiement = async (id: string) => {
    setPaiements(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('paiements', id);
    } catch (err) {
      console.error('Supabase deletePaiement failed in background:', err);
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
      console.error('Supabase addPersonnel failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updatePersonnel = async (id: string, data: Partial<Personnel>) => {
    setPersonnel(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Personnel>('personnel', id, data);
    } catch (err) {
      console.error('Supabase updatePersonnel failed in background:', err);
    }
  };

  const deletePersonnel = async (id: string) => {
    setPersonnel(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('personnel', id);
    } catch (err) {
      console.error('Supabase deletePersonnel failed in background:', err);
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
      console.error('Supabase addActivite failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updateActivite = async (id: string, data: Partial<Activite>) => {
    setActivites(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Activite>('activites', id, data);
    } catch (err) {
      console.error('Supabase updateActivite failed in background:', err);
    }
  };

  const deleteActivite = async (id: string) => {
    setActivites(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('activites', id);
    } catch (err) {
      console.error('Supabase deleteActivite failed in background:', err);
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
      console.error('Supabase addRepas failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updateRepas = async (id: string, data: Partial<Repas>) => {
    setRepas(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Repas>('repas', id, data);
    } catch (err) {
      console.error('Supabase updateRepas failed in background:', err);
    }
  };

  const deleteRepas = async (id: string) => {
    setRepas(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('repas', id);
    } catch (err) {
      console.error('Supabase deleteRepas failed in background:', err);
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
      console.error('Supabase addCompte failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updateCompte = async (id: string, data: Partial<UserAccount>) => {
    setComptes(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<UserAccount>('comptes', id, data);
    } catch (err) {
      console.error('Supabase updateCompte failed in background:', err);
    }
  };

  const deleteCompte = async (id: string) => {
    setComptes(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('comptes', id);
    } catch (err) {
      console.error('Supabase deleteCompte failed in background:', err);
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
      console.error('Supabase addMessage failed, kept local tempId:', err);
      return tempId;
    }
  };

  const updateMessage = async (id: string, data: Partial<DiscussionMessage>) => {
    setMessages(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<DiscussionMessage>('discussion_messages', id, data);
    } catch (err) {
      console.error('Supabase updateMessage failed in background:', err);
    }
  };

  const deleteMessage = async (id: string) => {
    setMessages(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('discussion_messages', id);
    } catch (err) {
      console.error('Supabase deleteMessage failed in background:', err);
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
