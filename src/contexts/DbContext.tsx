import React, { createContext, useContext, useState, useEffect } from 'react';
import { Enfant, Presence, Paiement, Personnel, Classe, Activite, Repas, UserAccount, DiscussionMessage, Avis } from '../types';
import { 
  getCollectionData, 
  addCollectionDocument, 
  updateCollectionDocument, 
  deleteCollectionDocument,
  setCollectionDocument,
  supabase
} from '../supabase';
import { useAuth } from './AuthContext';

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
  avis: Avis[];
  loading: boolean;
  refreshAll: () => Promise<void>;
  
  addMessage: (message: Omit<DiscussionMessage, 'id'>) => Promise<string>;
  updateMessage: (id: string, message: Partial<DiscussionMessage>) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;

  addAvis: (avis: Omit<Avis, 'id'>) => Promise<string>;

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
  const { user } = useAuth(); // Récupère l'utilisateur connecté pour filtrer ses données
  
  const [enfants, setEnfants] = useState<Enfant[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [activites, setActivites] = useState<Activite[]>([]);
  const [repas, setRepas] = useState<Repas[]>([]);
  const [comptes, setComptes] = useState<UserAccount[]>([]);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [avis, setAvis] = useState<Avis[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ FIX PERF (v2) : chargement en 2 vagues au lieu d'attendre les 10 tables d'un coup.
  //
  // VAGUE 1 (bloquante, mais courte) : uniquement ce qui est nécessaire pour afficher
  // le Dashboard tout de suite -> comptes (vérif abonnement) + enfants + presences +
  // paiements + personnel. Dès que ça arrive, on coupe "loading" et l'utilisateur
  // voit son tableau de bord.
  //
  // VAGUE 2 (en arrière-plan, NE bloque plus rien) : classes, activites, repas,
  // messages, avis. Elles arrivent pendant que l'utilisateur est déjà en train de
  // regarder son dashboard, et se glissent dans l'appli dès qu'elles sont prêtes
  // (utile seulement s'il va sur les pages Classes / Activités / Repas / Messagerie).
  const refreshAll = async () => {
    try {
      // --- VAGUE 1 : critique pour le Dashboard, on attend ---
      const [dbComptes, dbEnfants, dbPresences, dbPaiements, dbPersonnel] = await Promise.all([
        getCollectionData<UserAccount>('comptes'),
        getCollectionData<Enfant>('enfants'),
        getCollectionData<Presence>('presences'),
        getCollectionData<Paiement>('paiements'),
        getCollectionData<Personnel>('personnel'),
      ]);

      // ✅ FIX: Don't create hardcoded admin - security risk!
      if (dbComptes.length === 0) {
        console.warn(
          '⚠️ NO ADMIN ACCOUNT FOUND\n' +
          'Please create an admin account manually in Supabase Dashboard:\n' +
          '1. Go to SQL Editor\n' +
          '2. Insert into "comptes" table with a strong password\n' +
          '3. Restart the application'
        );
      }

      setComptes(dbComptes);
      setEnfants(dbEnfants);
      setPresences(dbPresences);
      setPaiements(dbPaiements);
      setPersonnel(dbPersonnel);

      // On arrête l'écran de chargement ICI -> le Dashboard s'affiche déjà,
      // pendant que la vague 2 continue en silence derrière.
      setLoading(false);

      // --- VAGUE 2 : le reste, en arrière-plan, ne bloque plus rien ---
      Promise.all([
        getCollectionData<Classe>('classes'),
        getCollectionData<Activite>('activites'),
        getCollectionData<Repas>('repas'),
        getCollectionData<DiscussionMessage>('discussion_messages'),
        getCollectionData<Avis>('avis'),
      ])
        .then(([dbClasses, dbActivites, dbRepas, dbMessages, dbAvis]) => {
          setClasses(dbClasses);
          setActivites(dbActivites);
          setRepas(dbRepas);
          setMessages(dbMessages);
          setAvis(dbAvis);
        })
        .catch(err => {
          console.error('Erreur de connexion à Supabase (chargement arrière-plan):', err);
        });
    } catch (err) {
      console.error('Erreur de connexion à Supabase:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, [user?.id]);

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
  const scopedPaiements = user?.role === 'directeur' ? paiements.filter(p => validEnfantIds.has(p.enfantId)) : paiements;


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
      return tempId;
    }
  };

  const updateEnfant = async (id: string, data: Partial<Enfant>) => {
    setEnfants(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Enfant>('enfants', id, data);
    } catch (err) {}
  };

  const deleteEnfant = async (id: string) => {
    setEnfants(prev => prev.filter(item => item.id !== id));
    setPresences(prev => prev.filter(item => item.enfantId !== id));
    setPaiements(prev => prev.filter(item => item.enfantId !== id));
    try {
      await deleteCollectionDocument('enfants', id);
      const relatedPresences = presences.filter(p => p.enfantId === id);
      for (const p of relatedPresences) await deleteCollectionDocument('presences', p.id);
      const relatedPaiements = paiements.filter(p => p.enfantId === id);
      for (const p of relatedPaiements) await deleteCollectionDocument('paiements', p.id);
    } catch (err) {}
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
    } catch (err) { return tempId; }
  };

  const updateClasse = async (id: string, data: Partial<Classe>) => {
    setClasses(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<Classe>('classes', id, data); } catch (err) {}
  };

  const deleteClasse = async (id: string) => {
    setClasses(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('classes', id); } catch (err) {}
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
    } catch (err) { return tempId; }
  };

  const updatePresence = async (id: string, data: Partial<Presence>) => {
    setPresences(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<Presence>('presences', id, data); } catch (err) {}
  };

  const deletePresence = async (id: string) => {
    setPresences(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('presences', id); } catch (err) {}
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
    } catch (err) { return tempId; }
  };

  const updatePaiement = async (id: string, data: Partial<Paiement>) => {
    setPaiements(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<Paiement>('paiements', id, data); } catch (err) {}
  };

  const deletePaiement = async (id: string) => {
    setPaiements(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('paiements', id); } catch (err) {}
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
    } catch (err) { return tempId; }
  };

  const updatePersonnel = async (id: string, data: Partial<Personnel>) => {
    setPersonnel(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<Personnel>('personnel', id, data); } catch (err) {}
  };

  const deletePersonnel = async (id: string) => {
    setPersonnel(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('personnel', id); } catch (err) {}
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
    } catch (err) { return tempId; }
  };

  const updateActivite = async (id: string, data: Partial<Activite>) => {
    setActivites(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<Activite>('activites', id, data); } catch (err) {}
  };

  const deleteActivite = async (id: string) => {
    setActivites(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('activites', id); } catch (err) {}
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
    } catch (err) { return tempId; }
  };

  const updateRepas = async (id: string, data: Partial<Repas>) => {
    setRepas(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<Repas>('repas', id, data); } catch (err) {}
  };

  const deleteRepas = async (id: string) => {
    setRepas(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('repas', id); } catch (err) {}
  };

  // --- COMPTES ---
  // Passe par l'Edge Function "create-account" : elle crée le vrai utilisateur Supabase Auth
  // (mot de passe hashé côté serveur) ET la ligne profil, en une seule opération sécurisée.
  const addCompte = async (compte: Omit<UserAccount, 'id'>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('create-account', {
      body: compte,
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error || data?.error) {
      throw new Error(data?.error || error?.message || 'Erreur création compte');
    }
    await refreshAll(); // recharge depuis le serveur plutôt que de deviner l'état local
    return data.id as string;
  };

  const updateCompte = async (id: string, data: Partial<UserAccount>) => {
    setComptes(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<UserAccount>('comptes', id, data); } catch (err) {}
  };

  // ✅ FIX: appelle l'Edge Function "delete-account" qui supprime le VRAI utilisateur
  // Supabase Auth + la ligne profil. L'ancienne version ne supprimait que la ligne
  // "comptes", donc l'utilisateur Auth restait actif et le compte semblait "revenir".
  const deleteCompte = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: { id },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error || data?.error) {
      throw new Error(data?.error || error?.message || 'Erreur suppression compte');
    }
    setComptes(prev => prev.filter(item => item.id !== id));
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
    } catch (err) { return tempId; }
  };

  const updateMessage = async (id: string, data: Partial<DiscussionMessage>) => {
    setMessages(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<DiscussionMessage>('discussion_messages', id, data); } catch (err) {}
  };

  const deleteMessage = async (id: string) => {
    setMessages(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('discussion_messages', id); } catch (err) {}
  };

  // --- AVIS ---
  const addAvis = async (avisData: Omit<Avis, 'id'>) => {
    const tempId = (avisData as any).id || 'avis_' + Date.now();
    const cleanAvis = { ...avisData, id: tempId } as Avis;
    setAvis(prev => [...prev.filter(item => item.id !== tempId), cleanAvis]);
    try {
      const freshId = await addCollectionDocument('avis', avisData);
      setAvis(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) { return tempId; }
  };

  return (
    <DbContext.Provider value={{
      // On injecte ici les listes FILTRÉES et isolées pour chaque directeur
      enfants: scopedEnfants,
      classes: scopedClasses,
      presences: scopedPresences,
      paiements: scopedPaiements,
      personnel: scopedPersonnel,
      activites: scopedActivites,
      repas: scopedRepas,
      comptes,
      messages,
      avis,
      loading,
      refreshAll,
      addMessage,
      updateMessage,
      deleteMessage,
      addAvis,
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
