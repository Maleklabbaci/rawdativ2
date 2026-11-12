import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { DbContext } from './DbContext';
import { useToast } from './ToastContext';
import { useLanguage } from './LanguageContext';
import { setCollectionDocument, supabase } from '../supabase';

export type WorkspaceRolePreset = 'owner' | 'educatrice' | 'accueil' | 'cuisine' | 'custom';
export type ProfileAvatarColor = 'terracotta' | 'petrol' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';

export interface PagePermissionDef {
  id: string;
  fr: string;
  ar: string;
}

export interface PagePermissionModule {
  key: string;
  fr: string;
  ar: string;
  sensitive?: boolean;
  permissions: PagePermissionDef[];
}

export const PAGE_PERMISSION_CATALOG: PagePermissionModule[] = [
  {
    key: 'dashboard',
    fr: 'Tableau de bord',
    ar: 'لوحة القيادة',
    permissions: [
      { id: 'view', fr: 'Accéder à la page', ar: 'الدخول إلى الصفحة' },
      { id: 'view_das', fr: 'Voir le contrôle conformité DAS', ar: 'عرض جاهزية مراقبة DAS' },
      { id: 'view_finance_kpis', fr: 'Voir les chiffres financiers sur l’accueil', ar: 'عرض المؤشرات المالية في الرئيسية' },
    ],
  },
  {
    key: 'presences',
    fr: 'Présences & appel',
    ar: 'الحضور والنداء',
    permissions: [
      { id: 'view', fr: 'Consulter l’appel et l’historique', ar: 'عرض سجل الحضور والغيابات' },
      { id: 'point', fr: 'Pointer présent / absent et saisir les horaires', ar: 'تسجيل الحضور والغياب والأوقات' },
      { id: 'daily_report', fr: 'Envoyer le Carnet de liaison / WhatsApp parents', ar: 'إرسال دفتر المتابعة اليومي للأولياء' },
      { id: 'validate_day', fr: 'Valider ou rouvrir la journée d’appel', ar: 'اعتماد أو إعادة فتح يوم الحضور' },
    ],
  },
  {
    key: 'enfants',
    fr: 'Dossiers enfants',
    ar: 'ملفات الأطفال',
    permissions: [
      { id: 'view', fr: 'Consulter les fiches enfants', ar: 'عرض ملفات الأطفال' },
      { id: 'edit', fr: 'Ajouter ou modifier une fiche enfant', ar: 'إضافة أو تعديل ملف طفل' },
      { id: 'health_pickup', fr: 'Gérer le suivi santé & autorisations de retrait', ar: 'إدارة السجل الصحي وتراخيص الاستلام' },
      { id: 'archive', fr: 'Enregistrer le départ / sortie d’un enfant', ar: 'تسجيل مغادرة أو أرشفة طفل' },
    ],
  },
  {
    key: 'classes',
    fr: 'Classes',
    ar: 'الأقسام',
    permissions: [
      { id: 'view', fr: 'Consulter les classes et effectifs', ar: 'عرض الأقسام والأفواج' },
      { id: 'manage', fr: 'Créer, modifier une classe et affecter les enfants', ar: 'إنشاء وتعديل الأقسام وتوزيع الأطفال' },
    ],
  },
  {
    key: 'repas',
    fr: 'Repas & menus',
    ar: 'الوجبات والقوائم',
    permissions: [
      { id: 'view', fr: 'Consulter les menus de la semaine', ar: 'عرض قوائم الوجبات' },
      { id: 'manage', fr: 'Ajouter, modifier ou supprimer un repas', ar: 'إضافة أو تعديل أو حذف وجبة' },
    ],
  },
  {
    key: 'activites',
    fr: 'Activités pédagogiques',
    ar: 'الأنشطة التربوية',
    permissions: [
      { id: 'view', fr: 'Consulter le programme d’activités', ar: 'عرض برنامج الأنشطة' },
      { id: 'manage', fr: 'Ajouter, modifier ou supprimer une activité', ar: 'إضافة أو تعديل أو حذف نشاط' },
    ],
  },
  {
    key: 'admissions',
    fr: 'Admissions QR',
    ar: 'طلبات التسجيل',
    permissions: [
      { id: 'view', fr: 'Lire les demandes d’inscription reçues', ar: 'عرض طلبات التسجيل الواردة' },
      { id: 'decide', fr: 'Accepter ou refuser un dossier', ar: 'قبول أو رفض طلب تسجيل' },
      { id: 'links', fr: 'Créer ou désactiver les liens QR publics', ar: 'إنشاء أو تعطيل روابط التسجيل QR' },
    ],
  },
  {
    key: 'communication',
    fr: 'Communication familles',
    ar: 'مراسلة الأولياء',
    permissions: [
      { id: 'view', fr: 'Lire les messages et avis', ar: 'قراءة الرسائل والآراء' },
      { id: 'send', fr: 'Envoyer des messages et répondre', ar: 'إرسال الرسائل والرد عليها' },
    ],
  },
  {
    key: 'notifications',
    fr: 'Annonces officielles',
    ar: 'الإعلانات الرسمية',
    permissions: [
      { id: 'view', fr: 'Consulter les annonces reçues', ar: 'قراءة الإعلانات' },
    ],
  },
  {
    key: 'community',
    fr: 'Rawdha Connect',
    ar: 'Rawdha Connect',
    permissions: [
      { id: 'view', fr: 'Consulter le réseau entre crèches', ar: 'تصفح الشبكة المهنية' },
      { id: 'post', fr: 'Publier, commenter et envoyer des messages', ar: 'النشر والتعليق والمراسلة' },
    ],
  },
  {
    key: 'paiements',
    fr: 'Factures & encaissements',
    ar: 'الفواتير والتحصيل',
    sensitive: true,
    permissions: [
      { id: 'view', fr: 'Consulter les factures et états', ar: 'عرض الفواتير والوضعيات' },
      { id: 'installments', fr: 'Enregistrer un acompte / statut payé', ar: 'تسجيل تسبيق أو تأكيد الدفع' },
      { id: 'manage', fr: 'Créer ou modifier une facture', ar: 'إصدار أو تعديل فاتورة' },
      { id: 'remind', fr: 'Copier / envoyer les relances WhatsApp', ar: 'إرسال تذكيرات الدفع عبر واتساب' },
    ],
  },
  {
    key: 'achats',
    fr: 'Achats & dépenses',
    ar: 'المشتريات والمصاريف',
    sensitive: true,
    permissions: [
      { id: 'view', fr: 'Consulter les dépenses', ar: 'عرض المصاريف والمشتريات' },
      { id: 'manage', fr: 'Enregistrer, modifier ou supprimer un achat', ar: 'إضافة أو تعديل أو حذف مصروف' },
    ],
  },
  {
    key: 'personnel',
    fr: 'Équipe & RH',
    ar: 'الفريق والموارد البشرية',
    sensitive: true,
    permissions: [
      { id: 'view', fr: 'Consulter les fiches de l’équipe', ar: 'عرض قائمة الفريق' },
      { id: 'manage', fr: 'Ajouter ou supprimer un membre', ar: 'إضافة أو حذف موظف' },
      { id: 'hr_advances', fr: 'Gérer le pointage RH et les avances sur salaire', ar: 'تسيير حضور الفريق والتسبيقات على الأجر' },
    ],
  },
  {
    key: 'rapports',
    fr: 'Rapports & bilans',
    ar: 'التقارير والحصيلة',
    sensitive: true,
    permissions: [
      { id: 'view', fr: 'Consulter les statistiques et bilans', ar: 'عرض الإحصائيات والتقارير' },
      { id: 'export', fr: 'Exporter en CSV / imprimer', ar: 'تصدير CSV والطباعة' },
    ],
  },
  {
    key: 'parametres',
    fr: 'Paramètres de la crèche',
    ar: 'إعدادات الروضة',
    sensitive: true,
    permissions: [
      { id: 'view', fr: 'Consulter la fiche crèche', ar: 'عرض إعدادات الروضة' },
      { id: 'manage', fr: 'Modifier les horaires et informations crèche', ar: 'تعديل معلومات وأوقات الروضة' },
    ],
  },
];

export type PagePermissionsMap = Record<string, string[]>;

export function buildFullPagePermissions(): PagePermissionsMap {
  const map: PagePermissionsMap = {};
  for (const mod of PAGE_PERMISSION_CATALOG) {
    map[mod.key] = mod.permissions.map(p => p.id);
  }
  return map;
}

export const ROLE_PRESET_PERMISSIONS: Record<
  Exclude<WorkspaceRolePreset, 'owner'>,
  { pagePermissions: PagePermissionsMap; hideFinancials: boolean }
> = {
  educatrice: {
    pagePermissions: {
      presences: ['view', 'point', 'daily_report'],
      enfants: ['view', 'health_pickup'],
      classes: ['view'],
      repas: ['view'],
      activites: ['view', 'manage'],
    },
    hideFinancials: true,
  },
  accueil: {
    pagePermissions: {
      dashboard: ['view', 'view_das'],
      presences: ['view', 'point', 'daily_report', 'validate_day'],
      enfants: ['view', 'edit', 'health_pickup'],
      admissions: ['view', 'decide', 'links'],
      classes: ['view'],
      repas: ['view'],
      activites: ['view'],
      communication: ['view', 'send'],
    },
    hideFinancials: true,
  },
  cuisine: {
    pagePermissions: {
      repas: ['view', 'manage'],
      enfants: ['view'],
      presences: ['view'],
    },
    hideFinancials: true,
  },
  custom: {
    pagePermissions: {
      presences: ['view', 'point'],
      enfants: ['view'],
    },
    hideFinancials: true,
  },
};

export interface WorkspaceSubProfile {
  id: string;
  name: string;
  roleLabel: string;
  preset: WorkspaceRolePreset;
  color: ProfileAvatarColor;
  isOwner: boolean;
  passwordSalt: string;
  passwordHash: string;
  allowedPages: string[];
  pagePermissions?: PagePermissionsMap;
  allowedClassIds: string[] | null;
  hideFinancials: boolean;
  createdAt: string;
}

export interface CreateSubProfileInput {
  id?: string;
  name: string;
  roleLabel: string;
  preset: WorkspaceRolePreset;
  color: ProfileAvatarColor;
  password?: string;
  allowedPages?: string[];
  pagePermissions?: PagePermissionsMap;
  allowedClassIds: string[] | null;
  hideFinancials: boolean;
}

export const ALL_DIRECTOR_PAGES = [
  'dashboard',
  'presences',
  'enfants',
  'classes',
  'repas',
  'activites',
  'admissions',
  'paiements',
  'achats',
  'personnel',
  'rapports',
  'communication',
  'notifications',
  'community',
  'parametres',
  'demarrage',
  'aide',
  'support',
] as const;

// Rétrocompatibilité avec les anciens imports éventuels
export const ROLE_PRESET_PAGES: Record<Exclude<WorkspaceRolePreset, 'owner'>, { pages: string[]; hideFinancials: boolean }> = {
  educatrice: {
    pages: [...Object.keys(ROLE_PRESET_PERMISSIONS.educatrice.pagePermissions), 'aide'],
    hideFinancials: true,
  },
  accueil: {
    pages: [...Object.keys(ROLE_PRESET_PERMISSIONS.accueil.pagePermissions), 'aide'],
    hideFinancials: true,
  },
  cuisine: {
    pages: [...Object.keys(ROLE_PRESET_PERMISSIONS.cuisine.pagePermissions), 'aide'],
    hideFinancials: true,
  },
  custom: {
    pages: [...Object.keys(ROLE_PRESET_PERMISSIONS.custom.pagePermissions), 'aide'],
    hideFinancials: true,
  },
};

export function normalizeProfilePermissions(profile: WorkspaceSubProfile): PagePermissionsMap {
  if (profile.isOwner) return buildFullPagePermissions();
  if (profile.pagePermissions && typeof profile.pagePermissions === 'object') {
    const cleaned: PagePermissionsMap = {};
    for (const [pageKey, perms] of Object.entries(profile.pagePermissions)) {
      if (Array.isArray(perms) && perms.length > 0) {
        cleaned[pageKey] = perms.includes('view') ? perms : ['view', ...perms];
      }
    }
    return cleaned;
  }
  // Migration transparente d'un profil qui n'avait que `allowedPages`
  const migrated: PagePermissionsMap = {};
  const fallbackPreset =
    profile.preset !== 'owner' && ROLE_PRESET_PERMISSIONS[profile.preset]
      ? ROLE_PRESET_PERMISSIONS[profile.preset].pagePermissions
      : {};
  for (const pageKey of profile.allowedPages || []) {
    const mod = PAGE_PERMISSION_CATALOG.find(m => m.key === pageKey);
    if (!mod) continue;
    migrated[pageKey] = fallbackPreset[pageKey] ? [...fallbackPreset[pageKey]] : mod.permissions.map(p => p.id);
  }
  return migrated;
}

export function deriveAllowedPagesFromPermissions(pagePermissions: PagePermissionsMap): string[] {
  const pages = Object.entries(pagePermissions)
    .filter(([, perms]) => Array.isArray(perms) && perms.includes('view'))
    .map(([key]) => key);
  if (!pages.includes('aide')) pages.push('aide');
  return pages;
}

function simpleDeterministicHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `v1:${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

export async function hashProfilePassword(salt: string, password: string): Promise<string> {
  const normalized = `${salt}::${password.trim()}`;
  try {
    if (typeof globalThis.crypto?.subtle?.digest === 'function' && typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(normalized);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      const hex = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      return `sha256:${hex}`;
    }
  } catch {
    // Fallback synchrone
  }
  return simpleDeterministicHash(normalized);
}

function generateSalt(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `salt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface WorkspaceProfileContextValue {
  requiresProfileSelection: boolean;
  loadingProfiles: boolean;
  profiles: WorkspaceSubProfile[];
  activeProfile: WorkspaceSubProfile | null;
  isOwnerProfile: boolean;
  canAccessPage: (page: string) => boolean;
  hasPagePermission: (page: string, permissionId?: string) => boolean;
  unlockProfile: (profileId: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  setupOwnerPasswordAndUnlock: (password: string) => Promise<{ ok: boolean; error?: string }>;
  verifyOwnerPassword: (password: string) => Promise<boolean>;
  saveSubProfile: (input: CreateSubProfileInput) => Promise<{ ok: boolean; error?: string }>;
  deleteSubProfile: (profileId: string) => Promise<void>;
  lockProfile: () => void;
}

const DEFAULT_FALLBACK_OWNER: WorkspaceSubProfile = {
  id: 'owner-admin',
  name: 'Direction',
  roleLabel: 'Direction / Admin',
  preset: 'owner',
  color: 'terracotta',
  isOwner: true,
  passwordSalt: 'default',
  passwordHash: '',
  allowedPages: [...ALL_DIRECTOR_PAGES],
  pagePermissions: buildFullPagePermissions(),
  allowedClassIds: null,
  hideFinancials: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const DEFAULT_CONTEXT_VALUE: WorkspaceProfileContextValue = {
  requiresProfileSelection: false,
  loadingProfiles: false,
  profiles: [DEFAULT_FALLBACK_OWNER],
  activeProfile: DEFAULT_FALLBACK_OWNER,
  isOwnerProfile: true,
  canAccessPage: () => true,
  hasPagePermission: () => true,
  unlockProfile: async () => ({ ok: true }),
  setupOwnerPasswordAndUnlock: async () => ({ ok: true }),
  verifyOwnerPassword: async () => true,
  saveSubProfile: async () => ({ ok: true }),
  deleteSubProfile: async () => {},
  lockProfile: () => {},
};

export const WorkspaceProfileContext = createContext<WorkspaceProfileContextValue | null>(null);

export function useWorkspaceProfile(): WorkspaceProfileContextValue {
  return useContext(WorkspaceProfileContext) ?? DEFAULT_CONTEXT_VALUE;
}

function getSessionKey(userId: string) {
  return `rawdha_active_subprofile_${userId}`;
}

function getLocalCacheKey(userId: string) {
  return `rawdha_profiles_cache_${userId}`;
}

async function buildInitialDemoProfiles(directorName: string): Promise<WorkspaceSubProfile[]> {
  const ownerSalt = 'demo-owner-salt';
  const staffSalt = 'demo-staff-salt';
  const [ownerHash, staffHash] = await Promise.all([
    hashProfilePassword(ownerSalt, '1234'),
    hashProfilePassword(staffSalt, '1111'),
  ]);
  const staffPerms = ROLE_PRESET_PERMISSIONS.educatrice.pagePermissions;
  return [
    {
      id: 'owner-admin',
      name: directorName || 'Direction',
      roleLabel: 'Administrateur Crèche',
      preset: 'owner',
      color: 'terracotta',
      isOwner: true,
      passwordSalt: ownerSalt,
      passwordHash: ownerHash,
      allowedPages: [...ALL_DIRECTOR_PAGES],
      pagePermissions: buildFullPagePermissions(),
      allowedClassIds: null,
      hideFinancials: false,
      createdAt: '2026-01-01T08:00:00.000Z',
    },
    {
      id: 'demo-educatrice-poussins',
      name: 'Sara',
      roleLabel: 'Éducatrice · Les Poussins',
      preset: 'educatrice',
      color: 'emerald',
      isOwner: false,
      passwordSalt: staffSalt,
      passwordHash: staffHash,
      allowedPages: deriveAllowedPagesFromPermissions(staffPerms),
      pagePermissions: staffPerms,
      allowedClassIds: ['demo-class-1'],
      hideFinancials: true,
      createdAt: '2026-01-01T08:05:00.000Z',
    },
  ];
}

export function WorkspaceProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const isDemo = Boolean(import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true');
  const isApprovedDirector = Boolean(
    isAuthenticated && user?.role === 'directeur' && user.approvalStatus !== 'pending'
  );

  const [profiles, setProfiles] = useState<WorkspaceSubProfile[]>([]);
  const profilesRef = useRef<WorkspaceSubProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState<boolean>(isApprovedDirector);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() => {
    if (typeof window === 'undefined' || !user?.id) return null;
    try {
      return (
        window.sessionStorage.getItem(getSessionKey(user.id)) ||
        window.sessionStorage.getItem('rawdha_active_subprofile')
      );
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let cancelled = false;

    if (!isApprovedDirector || !user?.id) {
      profilesRef.current = [];
      setProfiles([]);
      setActiveProfileId(null);
      setLoadingProfiles(false);
      return;
    }

    const load = async () => {
      setLoadingProfiles(true);
      const directorDisplayName = [user.prenom, user.nom].filter(Boolean).join(' ').trim() || 'Direction';

      let loaded: WorkspaceSubProfile[] | null = null;
      let cloudReadSucceeded = isDemo;
      try {
        const rawCache = window.localStorage.getItem(getLocalCacheKey(user.id));
        if (rawCache) {
          const parsed = JSON.parse(rawCache);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loaded = parsed;
          }
        }
      } catch {
        // Ignore
      }

      if (!isDemo && typeof (supabase as any)?.from === 'function') {
        try {
          const { data, error } = await supabase.from('parametres').select('data').eq('id', `profils_equipe_${user.id}`).maybeSingle();
          if (error) throw error;
          cloudReadSucceeded = true;
          const cloudDoc = data?.data as { profiles?: WorkspaceSubProfile[] } | undefined;
          if (cloudDoc && Array.isArray(cloudDoc.profiles) && cloudDoc.profiles.length > 0) {
            loaded = cloudDoc.profiles;
            try {
              window.localStorage.setItem(getLocalCacheKey(user.id), JSON.stringify(loaded));
            } catch {
              // Ignore
            }
          }
        } catch {
          // Fallback local
        }
      }

      if (!loaded) {
        if (isDemo) {
          loaded = await buildInitialDemoProfiles(directorDisplayName);
        } else {
          loaded = [
            {
              id: 'owner-admin',
              name: directorDisplayName,
              roleLabel: 'Direction / Admin',
              preset: 'owner',
              color: 'terracotta',
              isOwner: true,
              passwordSalt: `salt-${user.id}`,
              passwordHash: '',
              allowedPages: [...ALL_DIRECTOR_PAGES],
              pagePermissions: buildFullPagePermissions(),
              allowedClassIds: null,
              hideFinancials: false,
              createdAt: new Date().toISOString(),
            },
          ];
        }
      } else {
        loaded = loaded.map(p => {
          const normalizedPerms = normalizeProfilePermissions(p);
          return {
            ...p,
            pagePermissions: normalizedPerms,
            allowedPages: p.isOwner ? [...ALL_DIRECTOR_PAGES] : deriveAllowedPagesFromPermissions(normalizedPerms),
          };
        });
      }

      if (cancelled) return;
      profilesRef.current = loaded;
      setProfiles(loaded);

      try {
        const storedActive =
          window.sessionStorage.getItem(getSessionKey(user.id)) ||
          window.sessionStorage.getItem('rawdha_active_subprofile');
        if (storedActive && loaded.some(p => p.id === storedActive)) {
          setActiveProfileId(storedActive);
        } else if (cloudReadSucceeded && loaded.length === 1 && loaded[0].isOwner && !loaded[0].passwordHash) {
          // Un compte Auth déjà connecté, sans autre profil ni code Direction configuré.
          setActiveProfileId(loaded[0].id);
        } else {
          setActiveProfileId(null);
        }
      } catch {
        if (cloudReadSucceeded && loaded.length === 1 && loaded[0].isOwner && !loaded[0].passwordHash) {
          setActiveProfileId(loaded[0].id);
        } else {
          setActiveProfileId(null);
        }
      }
      setLoadingProfiles(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isApprovedDirector, isDemo, user?.id, user?.nom, user?.prenom]);

  const persistProfiles = useCallback(
    async (nextProfiles: WorkspaceSubProfile[]) => {
      if (!user?.id) throw new Error('missing_user');
      if (!isDemo && typeof (supabase as any)?.from === 'function') {
        await setCollectionDocument('parametres', `profils_equipe_${user.id}`, {
          id: `profils_equipe_${user.id}`,
          profiles: nextProfiles,
          updatedAt: new Date().toISOString(),
        });
      }
      profilesRef.current = nextProfiles;
      setProfiles(nextProfiles);
      try {
        window.localStorage.setItem(getLocalCacheKey(user.id), JSON.stringify(nextProfiles));
      } catch {
        // Ignore
      }
    },
    [isDemo, user?.id]
  );

  const activeProfile = useMemo(() => {
    if (!isApprovedDirector) return DEFAULT_FALLBACK_OWNER;
    if (!activeProfileId) return null;
    return profiles.find(p => p.id === activeProfileId) || null;
  }, [activeProfileId, isApprovedDirector, profiles]);

  const markUnlocked = useCallback(
    (profileId: string) => {
      setActiveProfileId(profileId);
      if (!user?.id) return;
      try {
        window.sessionStorage.setItem(getSessionKey(user.id), profileId);
      } catch {
        // Ignore
      }
    },
    [user?.id]
  );

  const lockProfile = useCallback(() => {
    setActiveProfileId(null);
    if (!user?.id) return;
    try {
      window.sessionStorage.removeItem(getSessionKey(user.id));
      window.sessionStorage.removeItem('rawdha_active_subprofile');
    } catch {
      // Ignore
    }
  }, [user?.id]);

  const setupOwnerPasswordAndUnlock = useCallback(
    async (password: string): Promise<{ ok: boolean; error?: string }> => {
      const clean = password.trim();
      if (clean.length < 4) {
        return { ok: false, error: 'short_password' };
      }
      const currentProfiles = profilesRef.current;
      const owner = currentProfiles.find(p => p.isOwner);
      if (!owner) return { ok: false, error: 'missing_owner' };
      const salt = owner.passwordSalt || generateSalt();
      const hash = await hashProfilePassword(salt, clean);
      const next = currentProfiles.map(p =>
        p.isOwner ? { ...p, passwordSalt: salt, passwordHash: hash } : p
      );
      await persistProfiles(next);
      markUnlocked(owner.id);
      return { ok: true };
    },
    [markUnlocked, persistProfiles]
  );

  const unlockProfile = useCallback(
    async (profileId: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      const target = profilesRef.current.find(p => p.id === profileId);
      if (!target) return { ok: false, error: 'not_found' };
      if (!target.passwordHash) {
        return { ok: false, error: 'needs_setup' };
      }
      const candidateHash = await hashProfilePassword(target.passwordSalt, password);
      if (candidateHash !== target.passwordHash) {
        return { ok: false, error: 'wrong_password' };
      }
      markUnlocked(target.id);
      return { ok: true };
    },
    [markUnlocked]
  );

  const verifyOwnerPassword = useCallback(
    async (password: string): Promise<boolean> => {
      const owner = profilesRef.current.find(p => p.isOwner);
      if (!owner) return false;
      if (!owner.passwordHash) return true;
      const candidateHash = await hashProfilePassword(owner.passwordSalt, password);
      return candidateHash === owner.passwordHash;
    },
    []
  );

  const saveSubProfile = useCallback(
    async (input: CreateSubProfileInput): Promise<{ ok: boolean; error?: string }> => {
      const cleanName = input.name.trim();
      if (!cleanName) return { ok: false, error: 'missing_name' };

      const currentProfiles = profilesRef.current;
      const existing = input.id ? currentProfiles.find(p => p.id === input.id) : undefined;
      if (!existing && !currentProfiles.find(p => p.isOwner)?.passwordHash) {
        return { ok: false, error: 'owner_password_required' };
      }
      if (!existing && (!input.password || input.password.trim().length < 4)) {
        return { ok: false, error: 'short_password' };
      }

      const salt = existing?.passwordSalt || generateSalt();
      let passwordHash = existing?.passwordHash || '';
      if (input.password && input.password.trim().length > 0) {
        if (input.password.trim().length < 4) {
          return { ok: false, error: 'short_password' };
        }
        passwordHash = await hashProfilePassword(salt, input.password);
      }

      const isOwner = Boolean(existing?.isOwner);
      let nextPagePerms: PagePermissionsMap;
      if (isOwner) {
        nextPagePerms = buildFullPagePermissions();
      } else if (input.pagePermissions && Object.keys(input.pagePermissions).length > 0) {
        nextPagePerms = {};
        for (const [k, arr] of Object.entries(input.pagePermissions)) {
          if (Array.isArray(arr) && arr.length > 0) {
            nextPagePerms[k] = arr.includes('view') ? [...arr] : ['view', ...arr];
          }
        }
      } else if (Array.isArray(input.allowedPages) && input.allowedPages.length > 0) {
        nextPagePerms = {};
        for (const k of input.allowedPages) {
          const mod = PAGE_PERMISSION_CATALOG.find(m => m.key === k);
          if (mod) nextPagePerms[k] = mod.permissions.map(p => p.id);
        }
      } else {
        nextPagePerms = { presences: ['view'] };
      }

      const derivedPages = isOwner
        ? [...ALL_DIRECTOR_PAGES]
        : deriveAllowedPagesFromPermissions(nextPagePerms);

      const hasFinanceAccess = Boolean(nextPagePerms.paiements?.includes('view') || nextPagePerms.achats?.includes('view'));

      const updated: WorkspaceSubProfile = {
        id: existing?.id || `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        roleLabel: input.roleLabel.trim() || (isOwner ? 'Direction / Admin' : 'Équipe'),
        preset: isOwner ? 'owner' : input.preset,
        color: input.color,
        isOwner,
        passwordSalt: salt,
        passwordHash,
        allowedPages: derivedPages,
        pagePermissions: nextPagePerms,
        allowedClassIds: isOwner
          ? null
          : input.allowedClassIds && input.allowedClassIds.length > 0
            ? input.allowedClassIds
            : null,
        hideFinancials: isOwner ? false : hasFinanceAccess ? Boolean(input.hideFinancials) : true,
        createdAt: existing?.createdAt || new Date().toISOString(),
      };

      const latestProfiles = profilesRef.current;
      const nextList = existing
        ? latestProfiles.map(p => (p.id === existing.id ? updated : p))
        : [...latestProfiles, updated];

      await persistProfiles(nextList);
      return { ok: true };
    },
    [persistProfiles]
  );

  const deleteSubProfile = useCallback(
    async (profileId: string) => {
      const latestProfiles = profilesRef.current;
      const target = latestProfiles.find(p => p.id === profileId);
      if (!target || target.isOwner) return;
      const next = latestProfiles.filter(p => p.id !== profileId);
      await persistProfiles(next);
      if (activeProfileId === profileId) {
        lockProfile();
      }
    },
    [activeProfileId, lockProfile, persistProfiles]
  );

  const hasPagePermission = useCallback(
    (page: string, permissionId = 'view'): boolean => {
      if (!isApprovedDirector) return true;
      if (!activeProfile) return false;
      if (activeProfile.isOwner) return true;
      const targetPage = page === 'abonnement' ? 'parametres' : page;
      if ((targetPage === 'aide' || targetPage === 'support') && permissionId === 'view') {
        return activeProfile.allowedPages.includes(targetPage) || targetPage === 'aide';
      }
      const normalized = normalizeProfilePermissions(activeProfile);
      const perms = normalized[targetPage];
      if (!Array.isArray(perms) || !perms.includes('view')) return false;
      return perms.includes(permissionId);
    },
    [activeProfile, isApprovedDirector]
  );

  const canAccessPage = useCallback(
    (page: string): boolean => hasPagePermission(page, 'view'),
    [hasPagePermission]
  );

  const value = useMemo<WorkspaceProfileContextValue>(
    () => ({
      requiresProfileSelection: isApprovedDirector && !loadingProfiles && !activeProfile,
      loadingProfiles,
      profiles,
      activeProfile,
      isOwnerProfile: !isApprovedDirector || Boolean(activeProfile?.isOwner),
      canAccessPage,
      hasPagePermission,
      unlockProfile,
      setupOwnerPasswordAndUnlock,
      verifyOwnerPassword,
      saveSubProfile,
      deleteSubProfile,
      lockProfile,
    }),
    [
      activeProfile,
      canAccessPage,
      deleteSubProfile,
      hasPagePermission,
      isApprovedDirector,
      loadingProfiles,
      lockProfile,
      profiles,
      saveSubProfile,
      setupOwnerPasswordAndUnlock,
      unlockProfile,
      verifyOwnerPassword,
    ]
  );

  return (
    <WorkspaceProfileContext.Provider value={value}>
      <ScopedDbByProfile
        activeProfile={isApprovedDirector ? activeProfile : null}
        hasPagePermission={hasPagePermission}
      >
        {children}
      </ScopedDbByProfile>
    </WorkspaceProfileContext.Provider>
  );
}

/**
 * Applique automatiquement les limites du profil actif :
 * - classes autorisées,
 * - masquage des données financières,
 * - permissions fines d’écriture par page.
 */
function ScopedDbByProfile({
  activeProfile,
  hasPagePermission,
  children,
}: {
  activeProfile: WorkspaceSubProfile | null;
  hasPagePermission: (page: string, permissionId?: string) => boolean;
  children: React.ReactNode;
}) {
  const parentDb = useContext(DbContext);
  const { showToast } = useToast();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const scopedDb = useMemo(() => {
    if (!parentDb || !activeProfile || activeProfile.isOwner) {
      return parentDb;
    }

    const hasClassRestriction =
      Array.isArray(activeProfile.allowedClassIds) && activeProfile.allowedClassIds.length > 0;
    const allowedClassSet = hasClassRestriction ? new Set(activeProfile.allowedClassIds) : null;

    const filteredClasses = allowedClassSet
      ? (parentDb.classes || []).filter(cls => allowedClassSet.has(cls.id))
      : parentDb.classes;

    const allowedChildIds = allowedClassSet
      ? new Set(
          filteredClasses.flatMap(cls => (Array.isArray(cls.childrenIds) ? cls.childrenIds : []))
        )
      : null;

    const filteredEnfants = allowedChildIds
      ? (parentDb.enfants || []).filter(enfant => allowedChildIds.has(enfant.id))
      : parentDb.enfants;

    const canSeePaiements = !activeProfile.hideFinancials && hasPagePermission('paiements', 'view');
    const canSeeAchats = !activeProfile.hideFinancials && hasPagePermission('achats', 'view');

    const methodPermissionMap: Record<string, [string, string][]> = {
      addPresence: [['presences', 'point']],
      updatePresence: [['presences', 'point']],
      deletePresence: [['presences', 'point']],
      savePresenceJournee: [['presences', 'validate_day']],
      addEnfant: [['enfants', 'edit']],
      updateEnfant: [['enfants', 'edit'], ['enfants', 'archive']],
      deleteEnfant: [['enfants', 'archive']],
      addClasse: [['classes', 'manage']],
      updateClasse: [['classes', 'manage']],
      deleteClasse: [['classes', 'manage']],
      addRepas: [['repas', 'manage']],
      updateRepas: [['repas', 'manage']],
      deleteRepas: [['repas', 'manage']],
      addActivite: [['activites', 'manage']],
      updateActivite: [['activites', 'manage']],
      deleteActivite: [['activites', 'manage']],
      decideAdmission: [['admissions', 'decide']],
      ensureInscriptionLink: [['admissions', 'links']],
      addPaiement: [['paiements', 'manage']],
      updatePaiement: [['paiements', 'manage'], ['paiements', 'installments']],
      addAchat: [['achats', 'manage']],
      updateAchat: [['achats', 'manage']],
      deleteAchat: [['achats', 'manage']],
      addPersonnel: [['personnel', 'manage']],
      deletePersonnel: [['personnel', 'manage']],
      addCommunityPost: [['community', 'post']],
      addCommunityComment: [['community', 'post']],
      sendCommunityMessage: [['community', 'post']],
    };

    return new Proxy(parentDb, {
      get(target, prop, receiver) {
        if (prop === 'classes') return filteredClasses;
        if (prop === 'enfants') return filteredEnfants;
        if (prop === 'paiements') return canSeePaiements ? target.paiements : [];
        if (prop === 'achats') return canSeeAchats ? target.achats : [];

        if (typeof prop === 'string' && prop in methodPermissionMap) {
          const rules = methodPermissionMap[prop];
          const allowed = rules.some(([pageKey, permId]) => hasPagePermission(pageKey, permId));
          if (!allowed) {
            return async () => {
              const msg = isAr
                ? 'ليس لديك صلاحية للقيام بهذا الإجراء على هذه الصفحة.'
                : 'Vous n’avez pas la permission d’effectuer cette action sur cette page.';
              showToast(msg, 'error');
              throw new Error('permission_denied_by_subprofile');
            };
          }
        }

        return Reflect.get(target, prop, receiver);
      },
    });
  }, [activeProfile, hasPagePermission, isAr, parentDb, showToast]);

  if (!parentDb || !scopedDb) return <>{children}</>;
  return <DbContext.Provider value={scopedDb}>{children}</DbContext.Provider>;
}
