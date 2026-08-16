import { createContext, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageContext = createContext<any>(null);

export const LanguageProvider = ({ children }: any) => {
  const { i18n, t } = useTranslation();
  const language = i18n.language?.toLowerCase().startsWith('ar') ? 'ar' : 'fr';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const setLanguage = (lang: 'fr' | 'ar') => {
    localStorage.setItem('rawdha_language', lang);
    void i18n.changeLanguage(lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
