import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserAccount } from '../types';
import { supabase, getCollectionDocument } from '../supabase';

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
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_CRECHE: CrecheInfo = {
  nom: 'RAWDHA+',
  adresse: 'Plateforme de Gestion | منصة التسيير',
  logoUrl: null,
  tuitionFeeRate: 4500,
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [creche, setCreche] = useState<CrecheInfo>(DEFAULT_CRECHE);

  // Charge le profil (table "comptes") associé à la session Auth active.
  const loadProfile = async (userId: string, authUserSnapshot?: AuthUserSnapshot): Promise<UserAccount | null> => {
    const { data, error } = await supabase
      .from('comptes')
      .select('id, data')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erreur chargement profil:', error);
      return null;
    }

    if (!data) {
      // Un signup public possède déjà un utilisateur Auth, mais pas encore de profil
      // Rawdha+ : il doit rester bloqué jusqu’à l’acceptation par l’administrateur.
      return null;
    }

    const profile = { ...(data.data as object), id: data.id } as UserAccount;
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
      const settings = await getCollectionDocument<any>('parametres', `creche_${profile.id}`);
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
    // Vérifie s'il y a déjà une session active (persistée par Supabase automatiquement)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await loadProfile(session.user.id, session.user);
        setUser(profile);
        await loadCrecheSettings(profile);
      }
      setLoading(false);
    });

    // Écoute les changements de session (login/logout dans un autre onglet, expiration, etc.)
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await loadProfile(session.user.id, session.user);
        setUser(profile);
        await loadCrecheSettings(profile);
      } else {
        setUser(null);
        setCreche(DEFAULT_CRECHE);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadCrecheSettings]);

  const isAuthenticated = !!user;

  const loginWithCredentials = async (email: string, motDePasse: string): Promise<{ user: UserAccount | null; error: string | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: motDePasse,
    });

    if (error || !data.user) {
      console.error('Erreur de connexion:', error?.message);
      return {
        user: null,
        error: normalizeAuthError(error) || 'Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe.',
      };
    }

    const profile = await loadProfile(data.user.id, data.user);
    if (!profile) {
      return {
        user: null,
        error: 'Votre authentification est valide, mais votre compte n’est pas encore rattaché à Rawdha+.',
      };
    }
    setUser(profile);
    await loadCrecheSettings(profile);
    return { user: profile, error: null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCreche(DEFAULT_CRECHE);
  };

  const refreshCreche = async () => {
    await loadCrecheSettings(user);
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
