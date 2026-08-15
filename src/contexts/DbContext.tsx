import React, { createContext, useContext, useState, useEffect } from 'react';
import { Enfant, Presence, PresenceJournee, Paiement, Personnel, Classe, Activite, Repas, UserAccount, DiscussionMessage, Avis, AppNotification, DemandeDirecteur } from '../types';
import { 
  getCollectionData, 
  addCollectionDocument, 
  updateCollectionDocument, 
  deleteCollectionDocument,
  setCollectionDocument,
  supabase
} from '../supabase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface DbContextType {
  enfants: Enfant[];
  classes: Classe[];
  presences: Presence[];
  presenceJournees: PresenceJournee[];
  paiements: Paiement[];
  personnel: Personnel[];
  activites: Activite[];
  repas: Repas[];
  comptes: UserAccount[];
  demandesDirecteur: DemandeDirecteur[];
  messages: DiscussionMessage[];
  avis: Avis[];
  notifications: AppNotification[];
  loading: boolean;
  refreshAll: () => Promise<void>;

  addNotification: (notif: Omit<AppNotification, 'id'>) => Promise<string>;
  markNotificationRead: (id: string, userId: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  
  addMessage: (message: Omit<DiscussionMessage, 'id'>) => Promise<string>;
  updateMessage: (id: string, message: Partial<DiscussionMessage>) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;

  addAvis: (avis: Omit<Avis, 'id'>) => Promise<string>;

  addCompte: (compte: Omit<UserAccount, 'id'>) => Promise<string>;
  updateCompte: (id: string, compte: Partial<UserAccount>) => Promise<void>;
  deleteCompte: (id: string) => Promise<void>;
  addDemandeDirecteur: (demande: Omit<DemandeDirecteur, 'id'>) => Promise<string>;
  approveDemandeDirecteur: (id: string) => Promise<string>;
  updateDemandeDirecteur: (id: string, demande: Partial<DemandeDirecteur>) => Promise<void>;
  deleteDemandeDirecteur: (id: string) => Promise<void>;

  addEnfant: (enfant: Omit<Enfant, 'id'>) => Promise<string>;
  updateEnfant: (id: string, enfant: Partial<Enfant>) => Promise<void>;
  deleteEnfant: (id: string) => Promise<void>;

  addClasse: (classe: Omit<Classe, 'id'>) => Promise<string>;
  updateClasse: (id: string, classe: Partial<Classe>) => Promise<void>;
  deleteClasse: (id: string) => Promise<void>;

  addPresence: (presence: Omit<Presence, 'id'>) => Promise<string>;
  updatePresence: (id: string, presence: Partial<Presence>) => Promise<void>;
  deletePresence: (id: string) => Promise<void>;
  savePresenceJournee: (journee: Omit<PresenceJournee, 'id'> & { id?: string }) => Promise<string>;

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
  const { user, creche } = useAuth(); // Récupère l'utilisateur connecté + les paramètres de sa crèche (tarif, etc.)
  const { showToast } = useToast();
  // ✅ FIX: message générique en cas d'échec d'écriture Supabase, pour ne plus jamais
  // avaler une erreur en silence (l'utilisateur croyait avoir sauvegardé pour rien).
  const notifyWriteError = (action: 'ajout' | 'modification' | 'suppression') => {
    showToast(
      action === 'ajout' ? "Échec de l'enregistrement, réessayez." :
      action === 'modification' ? "Échec de la modification, réessayez." :
      "Échec de la suppression, réessayez.",
      'error'
    );
  };
  
  const [enfants, setEnfants] = useState<Enfant[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [presenceJournees, setPresenceJournees] = useState<PresenceJournee[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [activites, setActivites] = useState<Activite[]>([]);
  const [repas, setRepas] = useState<Repas[]>([]);
  const [comptes, setComptes] = useState<UserAccount[]>([]);
  const [demandesDirecteur, setDemandesDirecteur] = useState<DemandeDirecteur[]>([]);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [avis, setAvis] = useState<Avis[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const autoInvoiceRanRef = React.useRef(false); // évite de relancer la génération auto plusieurs fois par session

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
    // Ne lance jamais de requêtes RLS avec le rôle anon pendant l’écran de connexion.
    // Cela évite les 401 sur toutes les tables avant que Supabase Auth ait une session.
    if (!user) {
      setEnfants([]);
      setClasses([]);
      setPresences([]);
      setPresenceJournees([]);
      setPaiements([]);
      setPersonnel([]);
      setActivites([]);
      setRepas([]);
      setComptes([]);
      setDemandesDirecteur([]);
      setMessages([]);
      setAvis([]);
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      // --- VAGUE 1 : critique pour le Dashboard, on attend ---
      const [dbComptes, dbEnfants, dbPresences, dbPresenceJournees, dbPaiements, dbPersonnel, dbDemandesDirecteur] = await Promise.all([
        getCollectionData<UserAccount>('comptes'),
        getCollectionData<Enfant>('enfants'),
        getCollectionData<Presence>('presences'),
        getCollectionData<PresenceJournee>('presence_journees'),
        getCollectionData<Paiement>('paiements'),
        getCollectionData<Personnel>('personnel'),
        user?.role === 'admin' ? getCollectionData<DemandeDirecteur>('demandes_directeur') : Promise.resolve([] as DemandeDirecteur[]),
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
      setPresenceJournees(dbPresenceJournees);
      setPaiements(dbPaiements);
      setPersonnel(dbPersonnel);
      setDemandesDirecteur(dbDemandesDirecteur);

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
        getCollectionData<AppNotification>('notifications'),
      ])
        .then(([dbClasses, dbActivites, dbRepas, dbMessages, dbAvis, dbNotifications]) => {
          setClasses(dbClasses);
          setActivites(dbActivites);
          setRepas(dbRepas);
          setMessages(dbMessages);
          setAvis(dbAvis);
          setNotifications(dbNotifications);
        })
        .catch(err => {
          console.error('Erreur de connexion à Supabase (chargement arrière-plan):', err);
        });
    } catch (err) {
      console.error('Erreur de connexion à Supabase:', err);
      setLoading(false);
    }
  };

  const refreshAdminAccounts = async () => {
    if (user?.role !== 'admin') return;
    const freshAccounts = await getCollectionData<UserAccount>('comptes');
    setComptes(freshAccounts);
  };

  useEffect(() => {
    refreshAll();
    if (user?.role !== 'admin') return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshAdminAccounts();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const interval = window.setInterval(refreshWhenVisible, 10 * 1000);

    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(interval);
    };
  }, [user?.id, user?.role]);

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
  const scopedPresenceJournees = user?.role === 'directeur' ? presenceJournees.filter(j => j.crecheId === user.id) : presenceJournees;
  const scopedPaiements = user?.role === 'directeur' ? paiements.filter(p => validEnfantIds.has(p.enfantId)) : paiements;

  // ✅ FIX: avant, TOUS les comptes (tous les directeurs : nom, email, statut abonnement...) étaient
  // chargés en mémoire dans le navigateur de CHAQUE utilisateur connecté, même un simple directeur,
  // alors qu'il n'a besoin de voir que le sien. Seul l'admin a besoin de la liste complète.
  const scopedComptes = user?.role === 'admin' ? comptes : comptes.filter(c => c.id === user?.id);
  const scopedDemandesDirecteur = user?.role === 'admin' ? demandesDirecteur : [];


  // --- DEMANDES DIRECTEUR ---
  // L’insertion publique est utilisée uniquement par le formulaire de demande.
  // La lecture et les changements de statut restent protégés par RLS et réservés à l’admin.
  const addDemandeDirecteur = async (demande: Omit<DemandeDirecteur, 'id'>) => {
    const tempId = 'demande_' + Date.now();
    const optimistic = { ...demande, id: tempId } as DemandeDirecteur;
    if (user?.role === 'admin') setDemandesDirecteur(prev => [optimistic, ...prev]);
    try {
      const freshId = await addCollectionDocument('demandes_directeur', demande);
      if (user?.role === 'admin') {
        setDemandesDirecteur(prev => prev.map(item => item.id === tempId ? { ...optimistic, id: freshId } : item));
      }
      return freshId;
    } catch (err) {
      if (user?.role === 'admin') setDemandesDirecteur(prev => prev.filter(item => item.id !== tempId));
      throw err;
    }
  };

  const approveDemandeDirecteur = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke('approve-director-request', {
      body: { demandeId: id },
      headers: { Authorization: `Bearer ${session?.access_token || ''}` },
    });
    if (error || data?.error) {
      notifyWriteError('modification');
      throw new Error(data?.error || error?.message || 'Erreur activation compte');
    }
    await refreshAll();
    return data.id as string;
  };

  const updateDemandeDirecteur = async (id: string, data: Partial<DemandeDirecteur>) => {
    const previous = demandesDirecteur.find(item => item.id === id);
    setDemandesDirecteur(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<DemandeDirecteur>('demandes_directeur', id, data);
    } catch (err) {
      if (previous) setDemandesDirecteur(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
      throw err;
    }
  };

  const deleteDemandeDirecteur = async (id: string) => {
    const previous = demandesDirecteur.find(item => item.id === id);
    setDemandesDirecteur(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('demandes_directeur', id);
    } catch (err) {
      if (previous) setDemandesDirecteur(prev => [...prev, previous]);
      notifyWriteError('suppression');
      throw err;
    }
  };

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
      setEnfants(prev => prev.filter(item => item.id !== tempId)); // rollback: retire l'ajout optimiste
      notifyWriteError('ajout');
      return tempId;
    }
  };

  const updateEnfant = async (id: string, data: Partial<Enfant>) => {
    const previous = enfants.find(item => item.id === id);
    setEnfants(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<Enfant>('enfants', id, data);
    } catch (err) {
      if (previous) setEnfants(prev => prev.map(item => item.id === id ? previous : item)); // rollback
      notifyWriteError('modification');
    }
  };

  const deleteEnfant = async (id: string) => {
    const previous = enfants.find(item => item.id === id);
    setEnfants(prev => prev.filter(item => item.id !== id));
    setPresences(prev => prev.filter(item => item.enfantId !== id));
    setPaiements(prev => prev.filter(item => item.enfantId !== id));
    try {
      await deleteCollectionDocument('enfants', id);
      const relatedPresences = presences.filter(p => p.enfantId === id);
      for (const p of relatedPresences) await deleteCollectionDocument('presences', p.id);
      const relatedPaiements = paiements.filter(p => p.enfantId === id);
      for (const p of relatedPaiements) await deleteCollectionDocument('paiements', p.id);
    } catch (err) {
      if (previous) setEnfants(prev => [...prev, previous]); // rollback: on ne peut pas fiablement restaurer présences/paiements liés, mais on prévient
      notifyWriteError('suppression');
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
      setClasses(prev => prev.filter(item => item.id !== tempId));
      notifyWriteError('ajout');
      return tempId;
    }
  };

  const updateClasse = async (id: string, data: Partial<Classe>) => {
    const previous = classes.find(item => item.id === id);
    setClasses(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<Classe>('classes', id, data); } catch (err) {
      if (previous) setClasses(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
    }
  };

  const deleteClasse = async (id: string) => {
    const previous = classes.find(item => item.id === id);
    setClasses(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('classes', id); } catch (err) {
      if (previous) setClasses(prev => [...prev, previous]);
      notifyWriteError('suppression');
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
      setPresences(prev => prev.filter(item => item.id !== tempId));
      notifyWriteError('ajout');
      return tempId;
    }
  };

  const updatePresence = async (id: string, data: Partial<Presence>) => {
    const previous = presences.find(item => item.id === id);
    setPresences(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<Presence>('presences', id, data); } catch (err) {
      if (previous) setPresences(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
    }
  };

  const deletePresence = async (id: string) => {
    const previous = presences.find(item => item.id === id);
    setPresences(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('presences', id); } catch (err) {
      if (previous) setPresences(prev => [...prev, previous]);
      notifyWriteError('suppression');
    }
  };

  const savePresenceJournee = async (journee: Omit<PresenceJournee, 'id'> & { id?: string }) => {
    const id = journee.id || `presence_day_${journee.crecheId}_${journee.date}`;
    const record = { ...journee, id } as PresenceJournee;
    const previous = presenceJournees.find(item => item.id === id);
    setPresenceJournees(prev => [...prev.filter(item => item.id !== id), record]);
    try {
      await setCollectionDocument<PresenceJournee>('presence_journees', id, record);
      return id;
    } catch (err) {
      setPresenceJournees(prev => previous
        ? [...prev.filter(item => item.id !== id), previous]
        : prev.filter(item => item.id !== id));
      notifyWriteError('modification');
      return id;
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
      setPaiements(prev => prev.filter(item => item.id !== tempId));
      notifyWriteError('ajout');
      return tempId;
    }
  };

  const updatePaiement = async (id: string, data: Partial<Paiement>) => {
    const previous = paiements.find(item => item.id === id);
    setPaiements(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<Paiement>('paiements', id, data); } catch (err) {
      if (previous) setPaiements(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
    }
  };

  const deletePaiement = async (id: string) => {
    const previous = paiements.find(item => item.id === id);
    setPaiements(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('paiements', id); } catch (err) {
      if (previous) setPaiements(prev => [...prev, previous]);
      notifyWriteError('suppression');
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
      setPersonnel(prev => prev.filter(item => item.id !== tempId));
      notifyWriteError('ajout');
      return tempId;
    }
  };

  const updatePersonnel = async (id: string, data: Partial<Personnel>) => {
    const previous = personnel.find(item => item.id === id);
    setPersonnel(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<Personnel>('personnel', id, data); } catch (err) {
      if (previous) setPersonnel(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
    }
  };

  const deletePersonnel = async (id: string) => {
    const previous = personnel.find(item => item.id === id);
    setPersonnel(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('personnel', id); } catch (err) {
      if (previous) setPersonnel(prev => [...prev, previous]);
      notifyWriteError('suppression');
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
      setActivites(prev => prev.filter(item => item.id !== tempId));
      notifyWriteError('ajout');
      return tempId;
    }
  };

  const updateActivite = async (id: string, data: Partial<Activite>) => {
    const previous = activites.find(item => item.id === id);
    setActivites(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<Activite>('activites', id, data); } catch (err) {
      if (previous) setActivites(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
    }
  };

  const deleteActivite = async (id: string) => {
    const previous = activites.find(item => item.id === id);
    setActivites(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('activites', id); } catch (err) {
      if (previous) setActivites(prev => [...prev, previous]);
      notifyWriteError('suppression');
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
      setRepas(prev => prev.filter(item => item.id !== tempId));
      notifyWriteError('ajout');
      return tempId;
    }
  };

  const updateRepas = async (id: string, data: Partial<Repas>) => {
    const previous = repas.find(item => item.id === id);
    setRepas(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<Repas>('repas', id, data); } catch (err) {
      if (previous) setRepas(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
    }
  };

  const deleteRepas = async (id: string) => {
    const previous = repas.find(item => item.id === id);
    setRepas(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('repas', id); } catch (err) {
      if (previous) setRepas(prev => [...prev, previous]);
      notifyWriteError('suppression');
    }
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
      notifyWriteError('ajout');
      throw new Error(data?.error || error?.message || 'Erreur création compte');
    }
    await refreshAll(); // recharge depuis le serveur plutôt que de deviner l'état local
    return data.id as string;
  };

  // ✅ FIX: on ne cache plus l'erreur. Si la policy RLS bloque la modification
  // (ex: admin qui essaie de suspendre le compte d'un directeur), l'appelant
  // le sait maintenant au lieu de croire que ça a marché, et l'état local est restauré.
  const updateCompte = async (id: string, data: Partial<UserAccount>) => {
    const previous = comptes.find(item => item.id === id);
    setComptes(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try {
      await updateCollectionDocument<UserAccount>('comptes', id, data);
    } catch (err) {
      if (previous) setComptes(prev => prev.map(item => item.id === id ? previous : item));
      notifyWriteError('modification');
      throw err;
    }
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
      notifyWriteError('suppression');
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
    } catch (err) {
      setMessages(prev => prev.filter(item => item.id !== tempId));
      notifyWriteError('ajout');
      return tempId;
    }
  };

  const updateMessage = async (id: string, data: Partial<DiscussionMessage>) => {
    const previous = messages.find(item => item.id === id);
    setMessages(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    try { await updateCollectionDocument<DiscussionMessage>('discussion_messages', id, data); } catch (err) {
      if (previous) setMessages(prev => prev.map(item => item.id === id ? previous : item));
      // Pas de toast ici : c'est surtout utilisé pour marquer "lu" en tâche de fond, pas la peine d'interrompre l'utilisateur.
    }
  };

  const deleteMessage = async (id: string) => {
    const previous = messages.find(item => item.id === id);
    setMessages(prev => prev.filter(item => item.id !== id));
    try { await deleteCollectionDocument('discussion_messages', id); } catch (err) {
      if (previous) setMessages(prev => [...prev, previous]);
      notifyWriteError('suppression');
    }
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
    } catch (err) {
      setAvis(prev => prev.filter(item => item.id !== tempId));
      notifyWriteError('ajout');
      return tempId;
    }
  };

  const deleteAvis = async (id: string) => {
    const previous = avis.find(item => item.id === id);
    setAvis(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('avis', id);
    } catch (err) {
      if (previous) setAvis(prev => [...prev, previous]);
      notifyWriteError('suppression');
      throw err;
    }
  };

  // --- NOTIFICATIONS (annonces admin -> directeurs) ---
  const addNotification = async (notif: Omit<AppNotification, 'id'>) => {
    const tempId = 'notif_' + Date.now();
    const cleanNotif = { ...notif, id: tempId } as AppNotification;
    setNotifications(prev => [cleanNotif, ...prev]);
    try {
      const freshId = await addCollectionDocument('notifications', notif);
      setNotifications(prev => prev.map(item => item.id === tempId ? { ...item, id: freshId } : item));
      return freshId;
    } catch (err) {
      // ✅ FIX: avant, aucun try/catch ici -> une erreur faisait planter tout l'appelant sans rollback visuel.
      setNotifications(prev => prev.filter(item => item.id !== tempId));
      notifyWriteError('ajout');
      return tempId;
    }
  };

  const markNotificationRead = async (id: string, userId: string) => {
    const target = notifications.find(n => n.id === id);
    if (!target || target.readBy?.includes(userId)) return; // déjà lue, on ne réécrit pas pour rien
    const updatedReadBy = [...(target.readBy || []), userId];
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, readBy: updatedReadBy } : n));
    try {
      await updateCollectionDocument<AppNotification>('notifications', id, { readBy: updatedReadBy });
    } catch (err) {
      console.error('Erreur marquage notification comme lue:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    const previous = notifications.find(item => item.id === id);
    setNotifications(prev => prev.filter(item => item.id !== id));
    try {
      await deleteCollectionDocument('notifications', id);
    } catch (err) {
      if (previous) setNotifications(prev => [previous, ...prev]);
      notifyWriteError('suppression');
    }
  };

  // --- GÉNÉRATION AUTOMATIQUE DES FACTURES MENSUELLES ---
  // Pour chaque enfant ayant un "jourEcheanceMensuel" défini (Paramètres enfant),
  // dès que ce jour est atteint dans le mois en cours, on génère automatiquement
  // une facture "En attente" si elle n'existe pas déjà pour ce mois. La notification
  // de paiement correspondante reste visible (dans la cloche du directeur) tant que
  // le statut de cette facture n'est pas passé à "Payé" — pas besoin de la stocker
  // séparément, elle est directement dérivée de la liste des paiements.
  const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  useEffect(() => {
    if (autoInvoiceRanRef.current) return; // une seule fois par session, pour éviter les doublons
    if (user?.role !== 'directeur') return;
    if (enfants.length === 0) return; // attend que les enfants (Vague 1) soient chargés

    const today = new Date();
    const currentMoisConcerne = `${MOIS_FR[today.getMonth()]} ${today.getFullYear()}`;

    // ✅ FIX: nombre de jours du mois en cours, pour "capper" l'échéance des enfants dont le
    // jourEcheanceMensuel est 29/30/31. Avant ce fix, un enfant avec échéance = 31 ne déclenchait
    // JAMAIS la facture auto pendant les mois de moins de 31 jours (février, avril, juin...) car
    // today.getDate() n'atteint jamais 31 dans ces mois-là -> facture silencieusement jamais générée.
    const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    const enfantsDuDirecteur = enfants.filter(e => e.crecheId === user.id && e.statut === 'Actif');
    const aGenerer = enfantsDuDirecteur.filter(enfant => {
      if (!enfant.jourEcheanceMensuel) return false;
      const echeanceEffective = Math.min(enfant.jourEcheanceMensuel, daysInCurrentMonth);
      if (today.getDate() < echeanceEffective) return false; // échéance pas encore atteinte ce mois-ci
      const dejaExistant = paiements.some(p => p.enfantId === enfant.id && p.moisConcerne === currentMoisConcerne);
      return !dejaExistant;
    });

    if (aGenerer.length === 0) {
      autoInvoiceRanRef.current = true;
      return;
    }

    autoInvoiceRanRef.current = true; // on marque tout de suite pour ne pas relancer en double pendant les awaits
    (async () => {
      for (const enfant of aGenerer) {
        try {
          // ✅ FIX: même correctif que ci-dessus appliqué à la date d'échéance stockée sur la facture —
          // sinon "31" en avril (30 jours) débordait silencieusement sur le 1er mai.
          const echeanceEffective = Math.min(enfant.jourEcheanceMensuel!, daysInCurrentMonth);
          await addPaiement({
            enfantId: enfant.id,
            montant: creche?.tuitionFeeRate || 4500,
            statut: 'En attente',
            moisConcerne: currentMoisConcerne,
            dateEcheance: new Date(today.getFullYear(), today.getMonth(), echeanceEffective).toISOString().split('T')[0],
            autoGenere: true,
          });
        } catch (err) {
          console.error(`Erreur génération auto facture pour ${enfant.prenom} ${enfant.nom}:`, err);
        }
      }
    })();
  }, [enfants, paiements, user, creche]);

  return (
    <DbContext.Provider value={{
      // On injecte ici les listes FILTRÉES et isolées pour chaque directeur
      enfants: scopedEnfants,
      classes: scopedClasses,
      presences: scopedPresences,
      presenceJournees: scopedPresenceJournees,
      paiements: scopedPaiements,
      personnel: scopedPersonnel,
      activites: scopedActivites,
      repas: scopedRepas,
      comptes: scopedComptes,
      demandesDirecteur: scopedDemandesDirecteur,
      messages,
      avis,
      notifications,
      loading,
      refreshAll,
      addMessage,
      updateMessage,
      deleteMessage,
      addAvis,
      deleteAvis,
      addNotification,
      markNotificationRead,
      deleteNotification,
      addCompte,
      updateCompte,
      deleteCompte,
    addDemandeDirecteur,
    approveDemandeDirecteur,
    updateDemandeDirecteur,
      deleteDemandeDirecteur,
      addEnfant,
      updateEnfant,
      deleteEnfant,
      addClasse,
      updateClasse,
      deleteClasse,
      addPresence,
      updatePresence,
      deletePresence,
      savePresenceJournee,
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
