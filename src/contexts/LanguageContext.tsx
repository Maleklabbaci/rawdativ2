
import { createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageContext = createContext<any>(null);

export const LanguageProvider = ({children}: any) => {
    const { i18n, t } = useTranslation();
    const setLanguage = (lang: string) => i18n.changeLanguage(lang);
    return <LanguageContext.Provider value={{language: i18n.language, setLanguage, t}}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
