import React, { createContext, useContext, useState } from 'react';
import { UserAccount } from '../types';
import { getCollectionData } from '../supabase';

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserAccount | null;
  creche: { nom: string; adresse: string };
  login: (user: UserAccount) => void;
  loginWithCredentials: (email: string, motDePasse: string) => Promise<UserAccount | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('rawdati_current_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // ✅ FIX: Remove password from stored user
        if (parsed.motDePasse) delete parsed.motDePasse;
        return parsed;
      } catch (e) {
        console.error('Failed to parse user:', e);
        return null;
      }
    }
    return null;
  });

  const isAuthenticated = !!user;

  const login = (newUser: UserAccount) => {
    // ✅ FIX: Create a copy without password
    const userToStore = { ...newUser };
    delete userToStore.motDePasse;
    
    setUser(userToStore);
    localStorage.setItem('rawdati_current_user', JSON.stringify(userToStore));
  };

  const loginWithCredentials = async (email: string, motDePasse: string): Promise<UserAccount | null> => {
    try {
      const allComptes = await getCollectionData<UserAccount>('comptes');
      const matchedUser = allComptes.find(
        (c) => c.email.toLowerCase().trim() === email.toLowerCase().trim() && c.motDePasse === motDePasse
      );

      if (matchedUser) {
        // ✅ FIX: Don't store password when logging in
        const userToStore = { ...matchedUser };
        delete userToStore.motDePasse;
        login(userToStore);
        return userToStore;
      }
      return null;
    } catch (error) {
      console.error("Erreur de connexion :", error);
      throw new Error("Erreur de communication avec le serveur.");
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('rawdati_current_user');
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      creche: { 
        nom: user?.role === 'directeur' && user.nomCreche ? user.nomCreche : 'RAWDATI', 
        adresse: 'Plateforme de Gestion | منصة التسيير' 
      },
      login,
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
