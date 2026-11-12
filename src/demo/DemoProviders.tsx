import { suspectedInvoiceIds, reminderContext, reminderBlockReason } from '../utils/financePeriod';
/** Isolated in-memory preview of the existing application. Never enabled in builds. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { DbContext } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { buildRealCrecheStore } from './realCrecheSeed';
import type { UserAccount } from '../types';

type Item = { id: string; [key: string]: any };
type Store = Record<string, Item[]>;
type DemoPersona = 'director' | 'admin' | 'pending' | 'expired' | 'guest';
const demoId = 'preview-director';
const directorUser: UserAccount = { id: demoId, nom: 'Démo', prenom: 'Directrice', email: 'demo@example.invalid', role: 'directeur', approvalStatus: 'approved', abonnementActif: true, nomCreche: 'Crèche Les Petits Soleils' };
const adminUser: UserAccount = { id: 'adm1', nom: 'Plateforme', prenom: 'Admin', email: 'admin@example.invalid', role: 'admin', abonnementActif: true, nomCreche: 'RAWDHA+' };

function readDemoPersona(): DemoPersona {
  if (typeof window === 'undefined') return 'director';
  if (import.meta.env.DEV && import.meta.env.VITE_DEMO_ADMIN === 'true') return 'admin';
  try {
    const raw = window.sessionStorage.getItem('rawdha_demo_persona');
    if (raw === 'admin' || raw === 'pending' || raw === 'expired' || raw === 'guest') return raw;
  } catch {}
  return 'director';
}

function resolveUser(persona: DemoPersona): UserAccount | null {
  if (persona === 'guest') return null;
  if (persona === 'admin') return adminUser;
  if (persona === 'pending') return { ...directorUser, approvalStatus: 'pending' };
  if (persona === 'expired') return { ...directorUser, abonnementActif: false, dateFinAbonnement: '2026-01-15' };
  return directorUser;
}

function shouldUseRealCrecheDataset(): boolean {
  let override: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      override = window.sessionStorage.getItem('rawdha_demo_dataset');
    } catch {}
  }
  if (override === 'minimal') return false;
  if (override === 'real60') return true;
  return Boolean(import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true');
}

function initialStore(persona: DemoPersona): Store {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const activeUser = resolveUser(persona) || directorUser;
  if (shouldUseRealCrecheDataset()) {
    const store = buildRealCrecheStore({ persona, demoId, directorUser, adminUser, activeUser });
    if (persona === 'admin') {
      const actions = ['subscription_reactivated', 'ticket_status_updated', 'identity_document_reviewed', 'community_post_hidden', 'notification_sent', 'followup_recorded', 'director_approved', 'trial_extended'];
      store.adminAuditLogs = Array.from({ length: 1248 }, (_, i) => ({ id: `demo-log-${String(i).padStart(5, '0')}`, actorId: 'adm1', action: actions[i % actions.length], targetType: 'director_account', targetId: `demo-target-${i % 72}`, targetLabel: `Crèche exemple ${String(i % 72 + 1).padStart(2, '0')}`, createdAt: new Date(now.getTime() - i * 43 * 60_000).toISOString() }));
    }
    return store;
  }
  const makeChild = (id: string, prenom: string, nom: string, groupeAge: string) => ({
    id, prenom, nom, crecheId: demoId, dateNaissance: '2023-05-15', dateInscription: date,
    statut: 'Actif', genre: 'Fille', groupeAge, parents: id === 'demo-child-1' ? [{ id: 'demo-parent-1', prenom: 'Nadia', nom: 'Exemple', lien: 'Mère', telephone: '' }] : [], contactsUrgence: [],
    documentsRequis: { certificatMedical: true, carnetVaccination: false, justificatifDomicile: false, photoIdentite: true },
  });
  return {
    enfants: [makeChild('demo-child-1', 'Lina', 'Exemple', 'Bébés'), makeChild('demo-child-2', 'Amine', 'Exemple', 'Moyens'), makeChild('demo-child-3', 'Yasmine', 'Exemple', 'Grands')],
    classes: [
      { id: 'demo-class-1', crecheId: demoId, nom: 'Les Poussins', niveau: 'Bébés', capacite: 10, childrenIds: ['demo-child-1'] },
      { id: 'demo-class-2', crecheId: demoId, nom: 'Les Papillons', niveau: 'Moyens', capacite: 12, childrenIds: ['demo-child-2'] },
    ],
    presences: [{ id: 'demo-presence-1', enfantId: 'demo-child-1', date, statut: 'Présent', heureArrivee: '08:30' }],
    paiements: [{ id: 'demo-payment-1', enfantId: 'demo-child-1', montant: 12000, statut: 'En attente', typeFacture: 'Mensuel', periodeCle: `M:${date.slice(0,7)}`, moisConcerne: date.slice(0,7), dateEcheance: date }, { id: 'demo-old-invoice', enfantId: 'demo-child-1', montant: 11000, statut: 'En attente', moisConcerne: 'février 2024 (exemple)' }],
    personnel: [{ id: 'demo-staff-1', crecheId: demoId, nom: 'Exemple', prenom: 'Sara', poste: 'Éducatrice', statut: 'Actif' }],
    repas: [{ id: 'demo-meal-1', crecheId: demoId, type: 'Déjeuner', date, menu: 'Poulet et légumes' }],
    activites: [{ id: 'demo-activity-1', crecheId: demoId, titre: 'Atelier dessin', date, groupe: 'Moyens' }],
    comptes: persona === 'admin'
      ? [adminUser, { ...directorUser, telephone: '0555123456', ville: 'Blida', dateFinAbonnement: date }, { id: 'demo-pending-dir', nom: 'Attente', prenom: 'Salma', email: 'salma@example.invalid', role: 'directeur', approvalStatus: 'pending', abonnementActif: false, nomCreche: 'Crèche Les Oliviers' }]
      : [activeUser],
    invoiceReviews: [], invoiceReviewEvents: [], pickupAuthorizations: [], healthEvents: [], presenceJournees: [], achats: [],
    demandesDirecteur: persona === 'admin' ? [{ id: 'demo-dir-req-1', statut: 'en_attente', dateDemande: now.toISOString(), nom: 'Exemple', prenom: 'Amel', email: 'amel@example.invalid', telephone: '0555112233', nomCreche: 'Crèche Les Jasmins', adresse: 'Blida Centre', message: 'Demande de démonstration.' }] : [],
    messages: persona === 'admin' ? [{ id: 'demo-msg-1', senderId: demoId, senderName: 'Directrice Démo', recipientId: 'admin', parentId: demoId, text: 'Bonjour, message fictif de support.', timestamp: now.toISOString(), isRead: false }] : [],
    avis: persona === 'admin' ? [{ id: 'demo-avis-1', userId: demoId, userName: 'Directrice Démo', nomCreche: directorUser.nomCreche, rating: 5, comment: 'Avis fictif de démonstration.', date: now.toISOString() }] : [],
    signalements: persona === 'admin' ? [{ id: 'demo-sig-1', userId: demoId, userName: 'Directrice Démo', nomCreche: directorUser.nomCreche, type: 'suggestion', statut: 'nouveau', priorite: 'haute', titre: 'Retour fictif sur les tableaux', description: 'Exemple de signalement pour le contrôle d’affichage.', date: now.toISOString() }] : [],
    communityPosts: persona === 'admin' ? [{ id: 'demo-post-1', authorId: demoId, authorName: 'Directrice Démo', crecheId: demoId, nomCreche: directorUser.nomCreche, categorie: 'activite', titre: 'Atelier peinture', contenu: 'Exemple de publication dans le réseau professionnel.', ville: 'Blida', statut: 'publie', likesCount: 1, createdAt: now.toISOString() }] : [],
    communityComments: [], communityReactions: [], communityFeatures: [], inscriptionLinks: [],
    demandesAdmission: [{ id: 'demo-admission-1', crecheId: demoId, nomCreche: directorUser.nomCreche, statut: 'en_attente', dateDemande: new Date().toISOString(), nom: 'Exemple', prenom: 'Sami', dateNaissance: '2023-04-15', genre: 'Garçon', groupeAge: 'Moyens', parentNom: 'Exemple', parentPrenom: 'Parent', parentTelephone: '', parentLien: 'Mère' }],
    notifications: persona === 'admin' ? [{ id: 'demo-notif-1', title: 'Annonce de démonstration', message: 'Contenu fictif pour vérifier la mise en page.', recipientRole: 'all_directeurs', createdAt: now.toISOString(), readBy: [] }] : [],
    adminAuditLogs: persona === 'admin' ? [{ id: 'demo-audit-1', actorId: 'adm1', action: 'subscription_reactivated', targetType: 'director', targetId: demoId, targetLabel: directorUser.nomCreche, createdAt: now.toISOString() }] : [],
    adminFollowups: persona === 'admin' ? [{ id: 'demo-follow-1', targetAccountId: demoId, channel: 'appel_manuel', status: 'planned', dueAt: date, note: 'Suivi fictif.', createdBy: 'adm1', createdAt: now.toISOString() }] : [],
  };
}

export function DemoProviders({ children }: { children: ReactNode }) {
  const persona = readDemoPersona();
  const baseUser = resolveUser(persona);
  const [subOverride, setSubOverride] = useState<{ abonnementActif: boolean; dateFinAbonnement: string } | null>(() => {
    if (typeof sessionStorage === 'undefined' || !baseUser) return null;
    try {
      const raw = sessionStorage.getItem(`rawdha_demo_sub_override_${persona}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const currentUser = baseUser && subOverride ? { ...baseUser, ...subOverride } : baseUser;
  const [data, setData] = useState<Store>(() => {
    const base = initialStore(persona);
    if (baseUser && subOverride) {
      return {
        ...base,
        comptes: base.comptes.map(c => (c.id === baseUser.id ? { ...c, ...subOverride } : c)),
      };
    }
    return base;
  });
  const pickupRef = useRef<Item[]>(data.pickupAuthorizations);
  const healthRef = useRef<Item[]>(data.healthEvents);
  const dataRef = useRef(data);
  dataRef.current = data;
  const { showToast } = useToast();
  const { isFrench } = useLanguage();

  useEffect(() => {
    const handleSubActivated = (evt: Event) => {
      const detail = (evt as CustomEvent<{ directorId?: string; newEndDate?: string }>).detail;
      if (!detail?.newEndDate) return;
      const patch = { abonnementActif: true, dateFinAbonnement: detail.newEndDate };
      if (baseUser && (!detail.directorId || detail.directorId === baseUser.id)) {
        setSubOverride(patch);
        try {
          sessionStorage.setItem(`rawdha_demo_sub_override_${persona}`, JSON.stringify(patch));
        } catch {
          // Ignore session storage errors
        }
      }
      if (detail.directorId) {
        setData(prev => ({
          ...prev,
          comptes: prev.comptes.map(c => (c.id === detail.directorId ? { ...c, ...patch } : c)),
        }));
      }
    };
    window.addEventListener('rawdha-subscription-activated', handleSubActivated);
    return () => window.removeEventListener('rawdha-subscription-activated', handleSubActivated);
  }, [persona, baseUser?.id]);

  useEffect(() => {
    const handleSimulateNotif = () => {
      const id = `demo-live-notif-${crypto.randomUUID()}`;
      const nowIso = new Date().toISOString();
      if (persona === 'admin') {
        setData(previous => ({
          ...previous,
          demandesDirecteur: [
            {
              id,
              statut: 'en_attente',
              dateDemande: nowIso,
              nom: 'Hamidi',
              prenom: 'Soraya',
              email: 'soraya@creche-alger.example',
              telephone: '0554332211',
              nomCreche: 'Crèche Les Colombes',
              adresse: 'Hydra, Alger',
              message: 'Nouvelle demande reçue en direct.',
            },
            ...previous.demandesDirecteur,
          ],
        }));
      } else {
        setData(previous => ({
          ...previous,
          demandesAdmission: [
            {
              id,
              crecheId: demoId,
              nomCreche: directorUser.nomCreche,
              statut: 'en_attente',
              dateDemande: nowIso,
              nom: 'Derradji',
              prenom: 'Maysa',
              dateNaissance: `${new Date().getFullYear() - 2}-05-11`,
              genre: 'Fille',
              groupeAge: 'Moyens',
              parentNom: 'Derradji',
              parentPrenom: 'Lotfi',
              parentTelephone: '0557884412',
              parentLien: 'Père',
              consentementDonnees: true,
            },
            ...previous.demandesAdmission,
          ],
        }));
      }
    };
    window.addEventListener('rawdha:demo-simulate-notification', handleSimulateNotif);
    return () => window.removeEventListener('rawdha:demo-simulate-notification', handleSimulateNotif);
  }, [persona]);
  const auth = {
    isAuthenticated: Boolean(currentUser), user: currentUser, loading: false,
    creche: currentUser ? { nom: currentUser.nomCreche || 'RAWDHA+', adresse: isFrench ? 'Blida · Données fictives' : 'البليدة · بيانات تجريبية', logoUrl: null, tuitionFeeRate: 12000 } : null,
    loginWithCredentials: async () => ({ user: null, error: isFrench ? 'Aperçu de démonstration sans connexion réelle.' : 'معاينة تجريبية دون تسجيل دخول حقيقي.' }),
    logout: () => showToast(isFrench ? 'Vous êtes dans un aperçu de démonstration.' : 'أنتم في وضع المعاينة التجريبية.', 'info'),
    refreshCreche: async () => {},
    updateProfile: async () => { throw new Error(isFrench ? 'Action indisponible dans cet aperçu.' : 'هذا الإجراء غير متاح في وضع المعاينة.'); },
  };
  const add = (key: string) => async (item: Omit<Item, 'id'> & { id?: string }) => {
    const id = item.id || `demo-${crypto.randomUUID()}`;
    const defaults = ['enfants', 'classes', 'personnel', 'activites', 'repas', 'achats'].includes(key) ? { crecheId: demoId } : {};
    setData(previous => ({ ...previous, [key]: [...previous[key], { ...defaults, ...item, id }] }));
    return id;
  };
  const update = (key: string) => async (id: string, patch: Partial<Item>) => {
    setData(previous => ({ ...previous, [key]: previous[key].map(item => item.id === id ? { ...item, ...patch } : item) }));
  };
  const remove = (key: string) => async (id: string) => {
    setData(previous => ({ ...previous, [key]: previous[key].filter(item => item.id !== id) }));
  };
  // In-memory demo events mirror the transactional audit without contacting Supabase.
  const demoAudit = (action: string, targetType: string, targetId: string) => ({ id:`demo-audit-${crypto.randomUUID()}`, actorId:adminUser.id, action, targetType, targetId, createdAt:new Date().toISOString() });
  const updateDemoTicket = async (id:string, patch:Partial<Item>) => {
    setData(previous => {
      const current=previous.signalements.find(item=>item.id===id); if(!current) throw new Error('Ticket introuvable');
      const actions:string[]=[];
      for(const [fields,action] of [[['statut'],'ticket_status_updated'],[['reponseAdmin'],'ticket_response_saved'],[['assigneeId','assigneeName'],'ticket_assigned'],[['priorite'],'ticket_priority_updated'],[['dueAt'],'ticket_due_date_updated']] as Array<[string[],string]>) {
        if(fields.some(field => field in patch && current[field] !== patch[field])) actions.push(action);
      }
      return {...previous,signalements:previous.signalements.map(item=>item.id===id?{...item,...patch}:item),adminAuditLogs:[...actions.map(action=>demoAudit(action,'ticket',id)),...previous.adminAuditLogs]};
    });
  };
  const unsupported = async () => {
    showToast('Cette action nécessite un service et n’est pas disponible dans cet aperçu.', 'error');
    throw new Error('Action indisponible dans la démonstration');
  };
  const db = new Proxy({
    ...data,
    loading: false,
    dataLoading: false,
    dataErrors: [],
    financialDataReady: true,
    refreshAll: async () => {},
    addEnfant: add('enfants'), updateEnfant: update('enfants'), deleteEnfant: async () => { throw new Error('child_permanent_deletion_temporarily_unavailable'); },
    listChildHealthEvents: async (childId: string) => healthRef.current.filter(item => item.enfantId === childId).slice().reverse(),
    addChildHealthEvent: async (childId: string, draft: Item) => {
      const existing = healthRef.current.find(item => item.id === draft.id);
      if (existing) {
        const previous = { id: existing.id, type: existing.type, date: existing.date, heure: existing.heure || '', details: existing.details, correctsId: existing.correctsId };
        if (existing.enfantId !== childId || JSON.stringify(previous) !== JSON.stringify(draft)) throw new Error('health_request_id_conflict');
        return existing;
      }
      if (draft.type === 'correction' && !healthRef.current.some(item => item.id === draft.correctsId && item.enfantId === childId)) throw new Error('health_invalid_correction');
      const entry = { ...draft, heure: draft.heure || null, enfantId: childId, createdBy: demoId, createdAt: new Date().toISOString() };
      healthRef.current = [...healthRef.current, entry];
      setData(previous => ({ ...previous, healthEvents: healthRef.current }));
      return entry;
    },
    listPickupAuthorizations: async (childId: string) => pickupRef.current.filter(item => item.enfantId === childId),
    createPickupAuthorization: async (childId: string, draft: Item) => {
      if (pickupRef.current.some(item => item.id === draft.id)) throw new Error('duplicate');
      const record = { ...draft, enfantId: childId, createdBy: demoId, createdAt: new Date().toISOString(), revokedBy: null, revokedAt: null };
      pickupRef.current = [...pickupRef.current, record];
      setData(previous => ({ ...previous, pickupAuthorizations: pickupRef.current }));
      return record;
    },
    revokePickupAuthorization: async (childId: string, id: string) => {
      const record = pickupRef.current.find(item => item.id === id && item.enfantId === childId && !item.revokedAt);
      if (!record) throw new Error('not_found_or_revoked');
      const revoked = { ...record, revokedBy: demoId, revokedAt: new Date().toISOString() };
      pickupRef.current = pickupRef.current.map(item => item.id === id ? revoked : item);
      setData(previous => ({ ...previous, pickupAuthorizations: pickupRef.current }));
      return revoked;
    },
    addClasse: add('classes'), updateClasse: update('classes'), deleteClasse: remove('classes'),
    addPresence: add('presences'), updatePresence: async (id: string, patch: Partial<Item>) => {
      if (patch.departVerifie === true || patch.departVerifiePar || patch.departVerifieLe) throw new Error('pickup_confirmation_requires_registry');
      setData(previous => ({ ...previous, presences: previous.presences.map(item => {
        if (item.id !== id) return item;
        const changed = ['statut','heureArrivee','heureDepart','personneRecuperation','personneRecuperationId'].some(key => key in patch && patch[key] !== item[key]);
        return { ...item, ...patch, ...(changed ? { departVerifie: false, departVerifiePar: '', departVerifieLe: '', personneRecuperationId: '' } : {}) };
      }) }));
    }, deletePresence: remove('presences'),
    confirmPickupDeparture: async (presence: Item, authorizationId: string, time: string) => {
      const current = dataRef.current.presences.find(item => item.id === presence.id);
      const entry = pickupRef.current.find(item => item.id === authorizationId && item.enfantId === presence.enfantId && !item.revokedAt);
      if (!current || JSON.stringify(current) !== JSON.stringify(presence) || !entry || current.statut !== 'Présent' || current.departVerifie || (current.personneRecuperation?.trim() && current.personneRecuperation.trim() !== entry.nom) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || time <= current.heureArrivee) throw new Error('pickup_unavailable');
      const saved = { ...current, heureDepart: time, personneRecuperation: entry.nom, personneRecuperationId: `registry-${entry.id}`, departVerifie: true, departVerifiePar: demoId, departVerifieLe: new Date().toISOString() };
      setData(previous => ({ ...previous, presences: previous.presences.map(item => item.id === presence.id ? saved : item) }));
    },
    savePresenceJournee: async (journee: Item) => {
      const id = journee.id || `demo-day-${journee.date}`;
      setData(previous => ({ ...previous, presenceJournees: [...previous.presenceJournees.filter(item => item.id !== id), { ...journee, id }] }));
      return id;
    },
    addPaiement: async (draft: Omit<Item, 'id'> & { id?: string }) => {
      const id = draft.id || `demo-${crypto.randomUUID()}`;
      const list = dataRef.current.paiements;
      const child = dataRef.current.enfants.find(item => item.id === draft.enfantId);
      if (!child || child.statut !== 'Actif') throw new Error('finance_child_inactive');
      if (suspectedInvoiceIds(list as any).size > 0 && list.some(item => item.enfantId === draft.enfantId && suspectedInvoiceIds(list as any).has(item.id))) throw new Error('finance_duplicate_review_pending');
      if (list.some(item => item.enfantId === draft.enfantId && item.statut !== 'Annulé' && !item.periodeCle)) throw new Error('finance_legacy_review_required');
      const key = draft.periodeCle as string;
      if (!key || !/^(M:\d{4}-(0[1-9]|1[0-2])|A:\d{4})$/.test(key)) throw new Error('finance_invalid_period');
      if (list.some(item => item.enfantId === draft.enfantId && item.statut !== 'Annulé' && (item.periodeCle === key || (item.periodeCle?.slice(2,6) === key.slice(2,6) && item.periodeCle?.slice(0,2) !== key.slice(0,2))))) throw new Error('finance_period_overlap');
      const next = [...list, {...draft,id}]; dataRef.current = {...dataRef.current,paiements:next};
      setData(previous => ({...previous,paiements:next})); return id;
    },
    updatePaiement: async (id: string, patch: Record<string, unknown>, expected: Item) => {
      const list = dataRef.current.paiements; const current = list.find(item => item.id === id);
      const equal = (a: Item,b: Item) => JSON.stringify(Object.keys(a).sort().map(k=>[k,a[k]])) === JSON.stringify(Object.keys(b).sort().map(k=>[k,b[k]]));
      if (!current || !expected || !equal(current, expected)) throw new Error('finance_changed');
      if (suspectedInvoiceIds(list as any).has(id)) throw new Error('finance_duplicate_review_pending');
      if (['enfantId','moisConcerne','typeFacture','periodeCle'].some(key => key in patch)) throw new Error('finance_identity_immutable');
      const changed = {...current}; for (const [key,value] of Object.entries(patch)) { if (value === null) delete changed[key]; else changed[key]=value; }
      const next = list.map(item => item.id === id ? changed : item); dataRef.current = {...dataRef.current,paiements:next};
      setData(previous => ({...previous,paiements:next}));
    },
    deletePaiement: async () => { throw new Error('finance_deletion_paused'); },
    reviewInvoicePeriod: async (expected: Item, periodKey: string, reason: string) => {
      const list=dataRef.current.paiements; const current=list.find(item=>item.id===expected.id);
      const equal=(a: Item,b: Item) => JSON.stringify(Object.keys(a).sort().map(k=>[k,a[k]]))===JSON.stringify(Object.keys(b).sort().map(k=>[k,b[k]]));
      const existing=dataRef.current.invoiceReviews.find(item=>item.id===expected.id);
      const { id: _reviewId, ...originalData } = expected;
      if (suspectedInvoiceIds(list as any).has(expected.id)) throw new Error('finance_duplicate_review_pending');
      if (current?.periodeCle) {
        if (existing && existing.periodKey===periodKey && existing.reason===reason.trim() && equal(existing.originalData,originalData as Item) && equal(current,{...expected,periodeCle:periodKey})) return current;
        throw new Error('finance_review_already_classified');
      }
      if (!current || !equal(current,expected)) throw new Error('finance_changed');
      if (!reason.trim() || reason.trim().length>500 || !/^(M:\d{4}-(0[1-9]|1[0-2])|A:\d{4})$/.test(periodKey) || periodKey.slice(2,6)==='0000') throw new Error('finance_invalid_review');
      if (list.some(item=>item.id!==expected.id && item.enfantId===current.enfantId && item.periodeCle && (item.periodeCle===periodKey || (item.periodeCle.slice(2,6)===periodKey.slice(2,6) && item.periodeCle.slice(0,2)!==periodKey.slice(0,2))))) throw new Error('finance_period_overlap');
      const saved={...current,periodeCle:periodKey}; const records=[...dataRef.current.invoiceReviews,{id:expected.id,invoiceId:expected.id,enfantId:current.enfantId,periodKey,reason:reason.trim(),originalData,reviewedBy:demoId,reviewedAt:new Date().toISOString()}];
      const next=list.map(item=>item.id===expected.id?saved:item); dataRef.current={...dataRef.current,paiements:next,invoiceReviews:records};
      setData(previous=>({...previous,paiements:next,invoiceReviews:records})); return saved;
    },
    getInvoicePeriodReview: async (id: string) => dataRef.current.invoiceReviews.find(item=>item.id===id) || null,
    invoiceReviewAction: async (draft: any) => {
      const list=dataRef.current.paiements; const current=list.find(item=>item.id===draft.expected.id);
      const equal=(a: any,b: any) => JSON.stringify(Object.keys(a||{}).sort().map(k=>[k,a[k]]))===JSON.stringify(Object.keys(b||{}).sort().map(k=>[k,b[k]]));
      const prior=dataRef.current.invoiceReviewEvents.find(item=>item.id===draft.requestId);
      if (prior) {
        if (prior.action===draft.action && prior.invoiceId===draft.expected.id && prior.periodKey===(draft.periodKey||null) && prior.targetInvoiceId===(draft.target?.id||null) && prior.reason===draft.reason.trim() && equal(prior.beforeData,draft.expected) && equal(prior.targetBefore,draft.target||null) && equal(prior.afterData,current)) return current;
        throw new Error('finance_review_request_conflict');
      }
      if (!current || !equal(current,draft.expected)) throw new Error('finance_changed');
      if (!draft.reason.trim() || draft.reason.trim().length>500) throw new Error('finance_invalid_review_action');
      const ids=suspectedInvoiceIds(list as any); let nextItem={...current}; let targetBefore=null;
      if (draft.action==='correct_period') {
        const key=draft.periodKey;
        if (ids.has(current.id) || current.statut==='Annulé') throw new Error('finance_duplicate_review_pending');
        if (!current.periodeCle || current.periodeCle===key || !/^(M:\d{4}-(0[1-9]|1[0-2])|A:\d{4})$/.test(key||'') || key.slice(2,6)==='0000') throw new Error('finance_invalid_review_action');
        if (list.some(item=>item.id!==current.id && item.statut!=='Annulé' && item.enfantId===current.enfantId && item.periodeCle && (item.periodeCle===key || (item.periodeCle.slice(2,6)===key.slice(2,6) && item.periodeCle.slice(0,2)!==key.slice(0,2))))) throw new Error('finance_period_overlap');
        nextItem.periodeCle=key;
      } else if (draft.action==='flag_duplicate') {
        const target=list.find(item=>item.id===draft.target?.id);
        if (!target || target.id===current.id || target.enfantId!==current.enfantId || current.statut==='Annulé' || target.statut==='Annulé') throw new Error('finance_invalid_duplicate_target');
        if (ids.has(current.id) || ids.has(target.id)) throw new Error('finance_duplicate_review_pending');
        if (!equal(target,draft.target)) throw new Error('finance_changed');
        targetBefore={...target}; nextItem.doublonSuspect={targetInvoiceId:target.id,eventId:draft.requestId};
      } else if (draft.action==='clear_suspicion' && current.doublonSuspect) delete nextItem.doublonSuspect;
      else if (draft.action==='cancel_invoice' && current.statut!=='Annulé') {
        nextItem.statut='Annulé';
        nextItem.motifAnnulation=draft.reason.trim();
        nextItem.dateAnnulation=new Date().toISOString().slice(0,10);
        delete nextItem.doublonSuspect;
      } else throw new Error('finance_invalid_review_action');
      const event={id:draft.requestId,requestId:draft.requestId,invoiceId:current.id,action:draft.action,periodKey:draft.periodKey||null,targetInvoiceId:draft.target?.id||null,reason:draft.reason.trim(),beforeData:{...current},afterData:{...nextItem},targetBefore,createdBy:demoId,createdAt:new Date().toISOString()};
      const records=[...dataRef.current.invoiceReviewEvents,event];const next=list.map(item=>item.id===current.id?nextItem:item);
      dataRef.current={...dataRef.current,paiements:next,invoiceReviewEvents:records}; setData(previous=>({...previous,paiements:next,invoiceReviewEvents:records})); return nextItem;
    },
    listInvoiceReviewEvents: async (id: string) => dataRef.current.invoiceReviewEvents.filter(item=>item.invoiceId===id),
    checkInvoiceReminder: async (expected: any, child: any, phone?: string) => {
      const list=dataRef.current.paiements; const current=list.find(p=>p.id===expected.id);
      const actualChild=dataRef.current.enfants.find(e=>e.id===child.id);
      const equal=(a: any,b: any) => JSON.stringify(Object.keys(a||{}).sort().map(k=>[k,a[k]]))===JSON.stringify(Object.keys(b||{}).sort().map(k=>[k,b[k]]));
      if (!current || !actualChild || current.enfantId!==actualChild.id || !equal(current,expected)
        || actualChild.nom!==child.nom || actualChild.prenom!==child.prenom || (phone && !actualChild.parents?.some((parent: any)=>parent.telephone===phone))
        || reminderBlockReason(current as any,reminderContext(list as any))!==null) throw new Error('finance_changed');
    },



    addAchat: add('achats'), updateAchat: update('achats'), deleteAchat: remove('achats'),
    addPersonnel: add('personnel'), updatePersonnel: update('personnel'), deletePersonnel: remove('personnel'),
    addActivite: add('activites'), updateActivite: update('activites'), deleteActivite: remove('activites'),
    addRepas: add('repas'), updateRepas: update('repas'), deleteRepas: remove('repas'),
    updateMessage: update('messages'),
    addMessage: add('messages'),
    markNotificationRead: async (id: string, userId: string) => {
      setData(previous => ({
        ...previous,
        notifications: previous.notifications.map(item =>
          item.id === id
            ? { ...item, readBy: Array.from(new Set([...(item.readBy || []), userId])) }
            : item,
        ),
      }));
    },
    publishAdminNotification: async (draft: Item) => {
      const created = {
        ...draft,
        id: draft.id || `demo-notif-${crypto.randomUUID()}`,
        createdAt: new Date().toISOString(),
        readBy: [],
      };
      setData(previous => ({
        ...previous,
        notifications: [created, ...previous.notifications],
      }));
      return created;
    },
    updateSignalement: updateDemoTicket,
    deleteSignalement: async (id:string) => setData(previous => ({...previous,signalements:previous.signalements.filter(item=>item.id!==id),adminAuditLogs:[demoAudit('ticket_deleted','ticket',id),...previous.adminAuditLogs]})),
    deleteNotification: async (id:string) => setData(previous => ({...previous,notifications:previous.notifications.filter(item=>item.id!==id),adminAuditLogs:[demoAudit('notification_deleted','notification',id),...previous.adminAuditLogs]})),
    markCommunityFeatureRead: async (id: string) => update('communityFeatures')(id, { payload: { read: true } }),
    ensureInscriptionLink: async () => ({
      id: 'demo-qr-link-1',
      crecheId: demoId,
      token: 'demo-petits-soleils-blida',
      label: 'Lien QR Permanent Admission',
      nomCreche: directorUser.nomCreche,
      active: true,
      createdAt: new Date().toISOString(),
      expiresAt: null,
    }),
    decideAdmission: async (id: string, statut: 'acceptee' | 'refusee', motif?: string) => {
      const request = data.demandesAdmission.find(item => item.id === id);
      if (!request || request.statut !== 'en_attente') throw new Error('Demande introuvable ou déjà traitée.');
      const enfantId = `demo-child-${crypto.randomUUID()}`;
      setData(previous => ({
        ...previous,
        demandesAdmission: previous.demandesAdmission.map(item => item.id === id ? { ...item, statut, motifRefus: motif || '', ...(statut === 'acceptee' ? { enfantId } : {}) } : item),
        enfants: statut === 'acceptee' ? [...previous.enfants, {
          id: enfantId, crecheId: demoId, nom: request.nom, prenom: request.prenom,
          dateNaissance: request.dateNaissance, genre: request.genre, groupeAge: request.groupeAge,
          dateInscription: new Date().toISOString().slice(0, 10), statut: 'Actif',
          allergie: request.allergie || undefined, regimeAlimentaire: request.regimeAlimentaire || undefined,
          groupeSanguin: request.bloodGroup || undefined, poidsKg: request.weightKg ? Number(request.weightKg) : undefined,
          medecinTraitant: request.pediatricianName || undefined, vaccinations: request.vaccinations || undefined, notesMedicales: request.notesMedicales || undefined,
          parents: [{ id: `demo-parent-${enfantId}`, nom: request.parentNom, prenom: request.parentPrenom, telephone: request.parentTelephone, lien: request.parentLien }],
          contactsUrgence: [], documentsRequis: { certificatMedical: false, carnetVaccination: false, justificatifDomicile: false, photoIdentite: false },
        }] : previous.enfants,
      }));
    },
  }, { get: (target, property) => property in target ? Reflect.get(target, property) : unsupported });

  return <AuthContext.Provider value={auth}><DbContext.Provider value={db as any}>{children}</DbContext.Provider></AuthContext.Provider>;
}
