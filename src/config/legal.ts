export type LegalTab = 'confidentialite' | 'cgu' | 'remboursement' | 'cookies' | 'suppression';

export const LEGAL_TABS: readonly LegalTab[] = [
  'confidentialite',
  'cgu',
  'remboursement',
  'cookies',
  'suppression',
] as const;

export const LEGAL_PATHS: Record<string, LegalTab> = {
  '/confidentialite': 'confidentialite',
  '/privacy': 'confidentialite',
  '/cgu': 'cgu',
  '/remboursement': 'remboursement',
  '/cookies': 'cookies',
  '/suppression-donnees': 'suppression',
};

export function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

export function isLegalPathname(pathname: string): boolean {
  return normalizePathname(pathname) in LEGAL_PATHS;
}

export function resolveInitialLegalTab(pathname: string, search: string): LegalTab {
  const params = new URLSearchParams(search);
  const tabParam = params.get('tab') as LegalTab | null;
  if (tabParam && (LEGAL_TABS as readonly string[]).includes(tabParam)) {
    return tabParam;
  }
  const normalized = normalizePathname(pathname);
  return LEGAL_PATHS[normalized] || 'confidentialite';
}

export function buildLegalHref(tab: LegalTab = 'confidentialite'): string {
  return tab === 'confidentialite' ? '/confidentialite' : `/confidentialite?tab=${tab}`;
}

/**
 * Coordonnées et paramètres légaux centralisés de Rawdha+.
 * Dès qu'une adresse e-mail officielle ou un numéro d'immatriculation est disponible,
 * renseignez `officialEmail` / `registrationReference` ici : toutes les pages légales
 * et pieds de page se mettront à jour automatiquement, sans donnée inventée.
 */
const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

export const LEGAL_CONFIG = {
  brandName: 'Rawdha+',
  countryFr: 'Algérie',
  countryAr: 'الجزائر',
  applicableLawFr:
    'Loi algérienne n° 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère personnel',
  applicableLawAr:
    'القانون الجزائري رقم 18-07 المؤرخ في 10 يونيو 2018 المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي',
  whatsappNumber: (env.VITE_WHATSAPP_NUMBER || '213697660969').trim(),
  whatsappDisplay: (env.VITE_WHATSAPP_DISPLAY || '+213 697 66 09 69').trim(),
  officialEmail: (env.VITE_OFFICIAL_EMAIL || '').trim(),
  registrationReference: (env.VITE_REGISTRATION_REFERENCE || '').trim(),
  baridiMobRip: (env.VITE_BARIDIMOB_RIP || '00799999002485193241').trim(),
  ccpAccount: (env.VITE_CCP_ACCOUNT || '0024851932 Clé 41').trim(),
  ccpHolder: (env.VITE_CCP_HOLDER || 'Rawdha+ Algérie').trim(),
  trialDays: 15,
  monthlyPlanPriceDzd: 1900,
  quarterlyPlanPriceDzd: 5700,
  annualPlanPriceDzd: 19000,
  cookieNoticeStorageKey: 'rawdha_cookie_notice_v1',
  lastUpdatedFr: '8 novembre 2026',
  lastUpdatedAr: '8 نوفمبر 2026',
} as const;

export function buildOfficialWhatsappHref(message: string): string {
  return `https://wa.me/${LEGAL_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
