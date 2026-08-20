import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserAccount } from '../types';
import { supabase, getCollectionDocument, updateCollectionDocument } from '../supabase';

interface CrecheInfo {
  nom: string;
  adresse: string;
  logoUrl: string | null;
  tuitionFeeRate: number;
}

interface AuthUserSnapshot {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

function normalizeAuthError(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'string') return error.trim() || null;
  if (error instanceof Error) return error.message?.trim() || null;
  if (typeof error === 'object') {
    const candidate = error as Record<string, unknown>;
    const directMessage = [candidate.message, candidate.error_description, candidate.msg]
      .find((value) => typeof value === 'string' && value.trim());
    if (typeof directMessage === 'string') return directMessage.trim();
    const serialized = JSON.stringify(error);
    return serialized && serialized !== '{}' ? serialized : null;
  }
  return String(error);
}

/**
 * Les appels réseau ne doivent jamais laisser l’écran de connexion tourner sans fin.
 * La course est uniquement un garde-fou UI : Supabase continue sa requête en arrière-plan,
 * mais l’application récupère toujours la main et affiche une erreur exploitable.
 */
function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: number | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  });
}

const AUTH_TIMEOUT_MS = 12_000;

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserAccount | null;
  loading: boolean;
  creche: CrecheInfo;
  loginWithCredentials: (email: string, motDePasse: string) => Promise<{ user: UserAccount | null; error: string | null }>;
  logout: () => void;
  // ✅ À appeler après une sauvegarde réussie dans Paramètres pour que le nom / logo /
  // tarif se mettent à jour PARTOUT dans l'appli (sidebar, header, factures) sans recharger la page.
  refreshCreche: () => Promise<void>;
  updateProfile: (changes: Partial<UserAccount>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_CRECHE: CrecheInfo = {
  nom: 'RAWDHA+',
  adresse: 'Plateforme de Gestion | منصة التسيير',
  logoUrl: null,
  tuitionFeeRate: 3500,
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [creche, setCreche] = useState<CrecheInfo>(DEFAULT_CRECHE);
  const lastActivityWriteRef = React.useRef(0);

  // Enregistre la dernière activité authentifiée en UTC ISO. La limitation d’une
  // minute évite de multiplier les écritures tout en gardant une donnée exploitable.
  const recordLastActivity = useCallback(async (userId: string) => {
    const now = Date.now();
    if (now - lastActivityWriteRef.current < 60_000) return;
    lastActivityWriteRef.current = now;
    const lastActivityAt = new Date(now).toISOString();
    try {
      await updateCollectionDocument<UserAccount>('comptes', userId, { lastActivityAt });
      setUser((current) => current?.id === userId ? { ...current, lastActivityAt } : current);
    } catch (error) {
      // L’activité ne doit jamais bloquer l’ouverture de session si une policy est
      // temporairement indisponible ; la prochaine activité réessaiera l’écriture.
      lastActivityWriteRef.current = 0;
      console.warn('Impossible d’enregistrer la dernière activité:', error);
    }
  }, []);

  // Charge le profil (table "comptes") associé à la session Auth active.
  const loadProfile = async (userId: string, authUserSnapshot?: AuthUserSnapshot): Promise<UserAccount | null> => {
    const { data, error } = await withTimeout(
      supabase
        .from('comptes')
        .select('id, data')
        .eq('id', userId)
        .maybeSingle(),
      AUTH_TIMEOUT_MS,
      'Le chargement du profil Rawdha+ a dépassé le délai prévu.',
    );

    if (error) {
      console.error('Erreur chargement profil:', error);
      return null;
    }

    if (!data) {
      // Un signup public possède déjà un utilisateur Auth, mais pas encore de profil
      // Rawdha+ : il doit rester bloqué jusqu’à l’acceptation par l’administrateur.
      return null;
    }

    const rawProfile = { ...(data.data as object), id: data.id } as UserAccount;
    // Compatibilité avec les anciens comptes : le flag Auth reste la source de vérité
    // tant que le profil n’a pas encore reçu approvalStatus explicitement.
    const approvalStatus = rawProfile.role === 'directeur'
      ? (rawProfile.approvalStatus === 'pending'
        ? 'pending'
        : rawProfile.approvalStatus === 'approved'
          ? 'approved'
          : authUserSnapshot?.user_metadata?.pendingDirector === true ? 'pending' : 'approved')
      : undefined;
    const profile = { ...rawProfile, ...(approvalStatus ? { approvalStatus } : {}) } as UserAccount;
    // Rawdha+ ne propose pas encore d’espace parent : seuls admin et directeur
    // peuvent ouvrir une session de gestion dans cette version.
    if (profile.role !== 'admin' && profile.role !== 'directeur') {
      console.warn('Profil authentifié sans rôle de gestion autorisé. Accès refusé.');
      return null;
    }
    return profile;
  };

  // ✅ Charge les paramètres de la crèche (nom officiel, logo, tarif) depuis la table
  // "parametres" -> c'est LA MÊME source que la page Paramètres, donc tout ce que le
  // directeur enregistre là-bas se reflète ici automatiquement.
  const loadCrecheSettings = useCallback(async (profile: UserAccount | null) => {
    if (!profile || profile.role !== 'directeur') {
      setCreche(DEFAULT_CRECHE);
      return;
    }
    try {
      const settings = await withTimeout(
        getCollectionDocument<any>('parametres', `creche_${profile.id}`),
        AUTH_TIMEOUT_MS,
        'Le chargement des paramètres de la crèche a dépassé le délai prévu.',
      );
      setCreche({
        nom: settings?.crecheName || profile.nomCreche || DEFAULT_CRECHE.nom,
        adresse: settings?.addressLine || DEFAULT_CRECHE.adresse,
        logoUrl: settings?.logoUrl || null,
        tuitionFeeRate: settings?.tuitionFeeRate ? Number(settings.tuitionFeeRate) : DEFAULT_CRECHE.tuitionFeeRate,
      });
    } catch (err) {
      console.error('Erreur chargement des paramètres de la crèche:', err);
      setCreche({ ...DEFAULT_CRECHE, nom: profile.nomCreche || DEFAULT_CRECHE.nom });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateSession = async (session: { user?: AuthUserSnapshot } | null) => {
      if (!session?.user) {
        if (!cancelled) {
          setUser(null);
          setCreche(DEFAULT_CRECHE);
        }
        return;
      }

      try {
        const profile = await loadProfile(session.user.id, session.user);
        if (cancelled) return;
        setUser(profile);
        if (profile) {
          void loadCrecheSettings(profile).catch((error) => {
            console.error('Chargement différé des paramètres de crèche:', error);
          });
          if (profile.approvalStatus !== 'pending') void recordLastActivity(profile.id);
        }
      } catch (error) {
        console.error('Erreur d’initialisation de la session Rawdha+:', error);
        if (!cancelled) {
          setUser(null);
          setCreche(DEFAULT_CRECHE);
        }
      }
    };

    // Le premier écran ne doit jamais rester bloqué si la session Supabase est lente.
    void withTimeout(
      supabase.auth.getSession(),
      AUTH_TIMEOUT_MS,
      'La vérification de session a dépassé le délai prévu.',
    )
      .then(({ data: { session } }) => hydrateSession(session))
      .catch((error) => {
        console.error('Erreur vérification de session:', error);
        if (!cancelled) {
          setUser(null);
          setCreche(DEFAULT_CRECHE);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Écoute les changements de session (login/logout dans un autre onglet, expiration, etc.).
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateSession(session);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [loadCrecheSettings, recordLastActivity]);

  // Une activité de session est actualisée au retour dans l’onglet et toutes les
  // cinq minutes tant que Rawdha+ reste ouvert.
  useEffect(() => {
    if (!user?.id || (user.role === 'directeur' && user.approvalStatus === 'pending')) return;
    const touchActivity = () => {
      if (document.visibilityState === 'visible') void recordLastActivity(user.id);
    };
    window.addEventListener('focus', touchActivity);
    document.addEventListener('visibilitychange', touchActivity);
    const interval = window.setInterval(touchActivity, 5 * 60 * 1000);
    return () => {
      window.removeEventListener('focus', touchActivity);
      document.removeEventListener('visibilitychange', touchActivity);
      window.clearInterval(interval);
    };
  }, [user?.id, user?.role, user?.approvalStatus, recordLastActivity]);

  // Une session pending reste ouverte, mais vérifie périodiquement si l’admin vient
  // d’approuver le compte depuis un autre navigateur. Le profil serveur approved
  // prime alors sur un ancien token Auth encore marqué pendingDirector.
  useEffect(() => {
    if (!user?.id || user.role !== 'directeur' || user.approvalStatus !== 'pending') return;
    let cancelled = false;
    const checkApproval = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser || authUser.id !== user.id) return;
        const profile = await loadProfile(user.id, authUser);
        if (!cancelled && profile && profile.approvalStatus !== 'pending') {
          setUser(profile);
          void loadCrecheSettings(profile);
        }
      } catch (error) {
        console.warn('Vérification différée de l’approbation impossible:', error);
      }
    };
    void checkApproval();
    const interval = window.setInterval(checkApproval, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user?.id, user?.role, user?.approvalStatus, loadCrecheSettings]);

  const isAuthenticated = !!user;

  const loginWithCredentials = async (email: string, motDePasse: string): Promise<{ user: UserAccount | null; error: string | null }> => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password: motDePasse,
        }),
        AUTH_TIMEOUT_MS,
        'La connexion prend trop de temps. Vérifiez votre connexion Internet puis réessayez.',
      );

      if (error || !data.user) {
        console.error('Erreur de connexion:', error?.message);
        return {
          user: null,
          error: normalizeAuthError(error) || 'Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe.',
        };
      }

      const profile = await loadProfile(data.user.id, data.user);
      if (!profile) {
        await supabase.auth.signOut().catch(() => undefined);
        return {
          user: null,
          error: 'Votre compte n’est pas encore initialisé dans Rawdha+ ou n’est plus actif.',
        };
      }
      setUser(profile);
      void loadCrecheSettings(profile).catch((error) => {
        console.error('Chargement différé des paramètres de crèche:', error);
      });
      if (profile.approvalStatus !== 'pending') void recordLastActivity(profile.id);
      return { user: profile, error: null };
    } catch (error) {
      console.error('Erreur de connexion Rawdha+:', error);
      return {
        user: null,
        error: normalizeAuthError(error) || 'La connexion a dépassé le délai prévu. Réessayez dans quelques instants.',
      };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCreche(DEFAULT_CRECHE);
  };

  const refreshCreche = async () => {
    await loadCrecheSettings(user);
  };

  const updateProfile = async (changes: Partial<UserAccount>) => {
    if (!user?.id) throw new Error('Utilisateur non connecté');
    if (user.role === 'directeur' && user.approvalStatus === 'pending') {
      throw new Error('Votre compte est en attente de validation par l’administrateur.');
    }
    const safeChanges = { ...changes };
    delete (safeChanges as Partial<UserAccount>).id;
    delete (safeChanges as Partial<UserAccount>).role;
    delete (safeChanges as Partial<UserAccount>).email;
    delete (safeChanges as Partial<UserAccount>).motDePasse;
    await updateCollectionDocument<UserAccount>('comptes', user.id, safeChanges);
    const nextUser = { ...user, ...safeChanges } as UserAccount;
    setUser(nextUser);
    await loadCrecheSettings(nextUser);
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      loading,
      creche,
      loginWithCredentials,
      logout,
      refreshCreche,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
