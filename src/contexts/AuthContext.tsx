import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserAccount } from '../types';

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserAccount | null;
  creche: { nom: string; adresse: string };
  login: (user: UserAccount) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const defaultAdmin: UserAccount = {
  id: 'adm1',
  nom: 'Labbaci',
  prenom: 'Abdelmalek',
  email: 'admin@rawdati.com',
  motDePasse: 'rawdati2001',
  role: 'admin',
  abonnementActif: true
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('rawdati_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return defaultAdmin;
      }
    }
    return defaultAdmin; // Default to admin for seamless first load
  });

  const isAuthenticated = !!user;

  const login = (newUser: UserAccount) => {
    setUser(newUser);
    localStorage.setItem('rawdati_current_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('rawdati_current_user');
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      creche: { nom: 'روضتي', adresse: 'نهج الصنوبر، الجزائر العاصمة | Rue des Glycines, Alger' },
      login,
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

