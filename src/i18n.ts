import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  fr: {
    translation: {
      dashboard: 'Tableau de bord',
      children: 'Enfants',
      classes: 'Classes',
      attendance: 'Présence',
      invoices: 'Factures',
      purchases: 'Achats',
      reports: 'Reports',
      staff: 'Personnel',
      activities: 'Activités',
      meals: 'Repas',
      settings: 'Paramètres',
      comptes: 'Comptes / Abonnés',
      welcome: 'Bienvenue sur RAWDHA+',
      'nav.logout': 'Déconnexion',
      'children.title': 'Gestion des enfants',
      'children.enrolled': 'enfants inscrits',
      'children.add': 'Ajouter un enfant',
      'children.search': 'Rechercher un enfant...',
      'children.all': 'Tous',
      'children.babies': 'Bébés (0-2 ans)',
      'children.middle': 'Moyens (2-4 ans)',
      'children.seniors': 'Grands (4-6 ans)',
      'children.born': 'Né(e) le',
      'children.enrolled.date': 'Inscrit le',
      'children.allergy': 'Allergie',
      'children.parents': 'Parents',
      'children.details': 'Détails',
      'children.paymentsTab': 'Factures & Paiements',
      'common.cancel': 'Annuler',
      'common.add': 'Ajouter',
      'common.save': 'Enregistrer',
      'common.delete': 'Supprimer',
      'common.edit': 'Modifier',
      'classes.add': 'Ajouter une classe',
      'attendance.add': 'Marquer présences',
      'invoices.add': 'Ajouter une facture',
      'staff.add': 'Ajouter un membre du personnel',
      'activities.add': 'Ajouter une activité',
      'meals.add': 'Ajouter un repas',
    }
  },
  ar: {
    translation: {
      dashboard: 'لوحة التحكم',
      children: 'الأطفال',
      classes: 'الأقسام',
      attendance: 'الحضور',
      invoices: 'الفواتير',
      purchases: 'المشتريات',
      reports: 'التقارير',
      staff: 'الموظفون',
      activities: 'الأنشطة',
      meals: 'الوجبات',
      settings: 'الإعدادات',
      comptes: 'الحسابات والاشتراكات',
      welcome: 'مرحبا بك في روضتي',
      'nav.logout': 'تسجيل الخروج',
      'children.title': 'تسيير الأطفال',
      'children.enrolled': 'طفل مسجل',
      'children.add': 'إضافة طفل',
      'children.search': 'ابحث عن طفل...',
      'children.all': 'الكل',
      'children.babies': 'رضع (0-2 سنوات)',
      'children.middle': 'متوسطين (2-4 سنوات)',
      'children.seniors': 'كبار (4-6 سنوات)',
      'children.born': 'تاريخ الميلاد',
      'children.enrolled.date': 'تاريخ التسجيل',
      'children.allergy': 'حساسية',
      'children.parents': 'أولياء الأمور',
      'children.details': 'تفاصيل',
      'children.paymentsTab': 'الفواتير والمدفوعات',
      'common.cancel': 'إلغاء',
      'common.add': 'إضافة',
      'common.save': 'حفظ',
      'common.delete': 'حذف',
      'common.edit': 'تعديل',
      'classes.add': 'إضافة قسم',
      'attendance.add': 'تسجيل الحضور',
      'invoices.add': 'إضافة فاتورة',
      'staff.add': 'إضافة موظف',
      'activities.add': 'إضافة نشاط',
      'meals.add': 'إضافة وجبة',
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'rawdha_language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
