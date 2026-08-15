import { createContext, useContext, useState, ReactNode } from 'react'

type Language = 'fr' | 'ar'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const translations: Record<Language, Record<string, string>> = {
  fr: {
    // Navigation
    dashboard: 'Dashboard',
    children: 'Enfants',
    staff: 'Personnel',
    attendance: 'Présence',
    payments: 'Paiements',
    reports: 'Rapports',
    logout: 'Déconnexion',
    darkMode: 'Mode sombre',
    lightMode: 'Mode clair',
    
    // General
    add: 'Ajouter',
    search: 'Rechercher...',
    welcome: 'Bonjour',
    loading: 'Chargement...',
    cancel: 'Annuler',
    save: 'Enregistrer',
    
    // Children
    addChild: 'Ajouter un enfant',
    childrenList: 'Liste des enfants',
    firstName: 'Prénom',
    lastName: 'Nom',
    group: 'Groupe',
    parentName: 'Nom du parent',
    parentPhone: 'Téléphone du parent',
    status: 'Statut',
    
    // Attendance
    markAttendance: 'Marquer les présences',
    present: 'Présent',
    absent: 'Absent',
    late: 'En retard',
    
    // Payments
    addPayment: 'Enregistrer un paiement',
    amount: 'Montant',
    method: 'Méthode',
    
    // Reports
    reportsTitle: 'Rapports & Statistiques',
  },
  ar: {
    // Navigation
    dashboard: 'لوحة التحكم',
    children: 'الأطفال',
    staff: 'الموظفون',
    attendance: 'الحضور',
    payments: 'المدفوعات',
    reports: 'التقارير',
    logout: 'تسجيل الخروج',
    darkMode: 'الوضع المظلم',
    lightMode: 'الوضع الفاتح',
    
    // General
    add: 'إضافة',
    search: 'بحث...',
    welcome: 'مرحبا',
    loading: 'جار التحميل...',
    cancel: 'إلغاء',
    save: 'حفظ',
    
    // Children
    addChild: 'إضافة طفل',
    childrenList: 'قائمة الأطفال',
    firstName: 'الاسم الأول',
    lastName: 'الاسم العائلي',
    group: 'المجموعة',
    parentName: 'اسم الوالد',
    parentPhone: 'هاتف الوالد',
    status: 'الحالة',
    
    // Attendance
    markAttendance: 'تسجيل الحضور',
    present: 'حاضر',
    absent: 'غائب',
    late: 'متأخر',
    
    // Payments
    addPayment: 'تسجيل دفعة',
    amount: 'المبلغ',
    method: 'طريقة الدفع',
    
    // Reports
    reportsTitle: 'التقارير والإحصائيات',
  }
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('fr')

  const t = (key: string): string => {
    return translations[language][key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}