import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserAccount } from '../types';
import { supabase } from '../supabase';

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserAccount | null;
  loading: boolean;
  creche: { nom: string; adresse: string };
  loginWithCredentials: (email: string, motDePasse: string) => Promise<UserAccount | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);

  // Charge le profil (table "comptes") associé à la session Auth active
  const loadProfile = async (userId: string): Promise<UserAccount | null> => {
    const { data, error } = await supabase
      .from('comptes')
      .select('id, data')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      console.error('Erreur chargement profil:', error);
      return null;
    }
    return { ...(data.data as object), id: data.id } as UserAccount;
  };

  useEffect(() => {
    // Vérifie s'il y a déjà une session active (persistée par Supabase automatiquement)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await loadProfile(session.user.id);
        setUser(profile);
      }
      setLoading(false);
    });

    // Écoute les changements de session (login/logout dans un autre onglet, expiration, etc.)
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await loadProfile(session.user.id);
        setUser(profile);
      } else {
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

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

    const profile = await loadProfile(data.user.id);
    setUser(profile);
    return profile;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      loading,
      creche: {
        nom: user?.role === 'directeur' && user.nomCreche ? user.nomCreche : 'RAWDHA+',
        adresse: 'Plateforme de Gestion | منصة التسيير'
      },
      loginWithCredentials,
      logout
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
