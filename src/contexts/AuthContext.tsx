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

interface DirectorSignupDetails {
  nom: string;
  prenom: string;
  email: string;
  motDePasse: string;
  nomCreche: string;
  telephone: string;
  adresse: string;
  siteWeb?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserAccount | null;
  loading: boolean;
  creche: CrecheInfo;
  loginWithCredentials: (email: string, motDePasse: string) => Promise<UserAccount | null>;
  createDirectorAccount: (details: DirectorSignupDetails) => Promise<{ error: string | null; requiresEmailConfirmation: boolean }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  requestEmailOtp: (email: string) => Promise<{ error: string | null }>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  requestPhoneOtp: (phone: string) => Promise<{ error: string | null }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: string | null }>;
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
  // Si le trigger Supabase n’est pas encore installé, on tente de créer un profil
  // directeur minimal avec la session Auth afin de ne pas bloquer l’onboarding.
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
      const authUser = authUserSnapshot || (await supabase.auth.getUser()).data.user;
      if (!authUser || authUser.id !== userId) return null;

      const metadata = (authUser.user_metadata || {}) as Record<string, unknown>;
      const fullName = String(metadata.full_name || metadata.name || '').trim();
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      const fallbackProfile: UserAccount = {
        id: userId,
        nom: String(metadata.nom || nameParts.slice(1).join(' ') || '').trim(),
        prenom: String(metadata.prenom || nameParts[0] || '').trim(),
        email: authUser.email || '',
        motDePasse: '',
        role: 'directeur',
        abonnementActif: true,
        dateFinAbonnement: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        nomCreche: String(metadata.nomCreche || '').trim(),
      };

      const { id: _profileId, ...profileData } = fallbackProfile;
      const { error: createError } = await supabase.from('comptes').upsert({
        id: userId,
        data: profileData,
      });
      if (createError) {
        console.error('Impossible de créer le profil directeur de secours:', createError);
        return null;
      }
      return fallbackProfile;
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

  const loginWithCredentials = async (email: string, motDePasse: string): Promise<UserAccount | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: motDePasse,
    });

    if (error || !data.user) {
      console.error('Erreur de connexion:', error?.message);
      return null;
    }

    const profile = await loadProfile(data.user.id, data.user);
    setUser(profile);
    await loadCrecheSettings(profile);
    return profile;
  };

  const createDirectorAccount = async (details: DirectorSignupDetails): Promise<{ error: string | null; requiresEmailConfirmation: boolean }> => {
    const email = details.email.toLowerCase().trim();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: details.motDePasse,
      options: {
        data: {
          role: 'directeur',
          nom: details.nom.trim(),
          prenom: details.prenom.trim(),
          nomCreche: details.nomCreche.trim(),
          telephone: details.telephone.trim(),
          adresse: details.adresse.trim(),
          siteWeb: details.siteWeb?.trim() || '',
        },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error || !data.user) {
      return { error: error?.message || 'La création du compte directeur a échoué.', requiresEmailConfirmation: false };
    }

    // Lorsque la confirmation e-mail est désactivée, la session est créée immédiatement.
    // Sinon, le trigger Supabase crée le profil et la connexion se fera après confirmation.
    if (data.session) {
      const profile = await loadProfile(data.user.id, data.user);
      setUser(profile);
      await loadCrecheSettings(profile);
      if (!profile) {
        return { error: 'Le compte Auth est créé, mais le profil directeur est encore en préparation.', requiresEmailConfirmation: false };
      }
    }

    return { error: null, requiresEmailConfirmation: !data.session };
  };

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error: error?.message || null };
  };

  const requestEmailOtp = async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error?.message || null };
  };

  const verifyEmailOtp = async (email: string, token: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase().trim(),
      token: token.trim(),
      type: 'email',
    });
    if (!error && data.user) {
      const profile = await loadProfile(data.user.id, data.user);
      setUser(profile);
      await loadCrecheSettings(profile);
      if (!profile) return { error: 'Compte authentifié mais profil Rawdha+ introuvable.' };
    }
    return { error: error?.message || null };
  };

  const requestPhoneOtp = async (phone: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone.trim().replace(/\s+/g, ''),
      options: { shouldCreateUser: false },
    });
    return { error: error?.message || null };
  };

  const verifyPhoneOtp = async (phone: string, token: string): Promise<{ error: string | null }> => {
    const normalizedPhone = phone.trim().replace(/\s+/g, '');
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token: token.trim(),
      type: 'sms',
    });
    if (!error && data.user) {
      const profile = await loadProfile(data.user.id, data.user);
      setUser(profile);
      await loadCrecheSettings(profile);
      if (!profile) return { error: 'Compte authentifié mais profil Rawdha+ introuvable.' };
    }
    return { error: error?.message || null };
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
      createDirectorAccount,
      signInWithGoogle,
      requestEmailOtp,
      verifyEmailOtp,
      requestPhoneOtp,
      verifyPhoneOtp,
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
