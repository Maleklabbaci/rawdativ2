import { IdentityDocumentRequest } from './IdentityDocumentReview';
import React, { useState, useEffect, lazy, Suspense } from 'react';
const IdentityOcrDemo = import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true' ? lazy(() => import('../demo/IdentityOcrDemo')) : null;
import {
  Settings,
  Building,
  MapPin,
  Mail,
  Phone,
  Bell,
  Clock,
  DollarSign,
  Save,
  ShieldCheck,
  Activity,
  HelpCircle,
  Database,
  Users,
  ShieldAlert,
  Server,
  FileCode,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Info,
  RefreshCw,
  Sliders,
  Smartphone,
  Lock,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { setCollectionDocument, getCollectionDocument } from '../supabase';
import { buildLegalHref, LEGAL_CONFIG } from '../config/legal';
import TeamAccessManager from './TeamAccessManager';
import SubscriptionRenewalModal from './SubscriptionRenewalModal';
import { loadSubscriptionRenewals, type SubscriptionRenewalRequest } from '../utils/subscriptionRenewal';
import { isNotificationSoundEnabled, setNotificationSoundEnabled, playNotificationChime } from '../utils/notificationSound';
import { useWorkspaceProfile } from '../contexts/WorkspaceProfileContext';
import { motion, AnimatePresence } from 'motion/react';

export default function Parametres({ onNavigate }: { onNavigate?: (page: string) => void } = {}) {
  const { t, language } = useLanguage();
  const { user, refreshCreche, updateProfile } = useAuth();
  const { hasPagePermission } = useWorkspaceProfile();
  const canManageSettings = hasPagePermission('parametres', 'manage');
  const { confirm } = useConfirmDialog();
  const isFrench = language === 'fr';
  const isArabic = language === 'ar';

  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [latestRenewal, setLatestRenewal] = useState<SubscriptionRenewalRequest | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => isNotificationSoundEnabled());

  useEffect(() => {
    if (!user?.id || user.role !== 'directeur') return;
    let active = true;
    const syncRenewal = () => {
      void loadSubscriptionRenewals(user.id).then(items => {
        if (!active) return;
        const mine = items.find(r => r.directorId === user.id) || null;
        setLatestRenewal(mine);
      });
    };
    syncRenewal();
    const onSoundPref = () => setSoundEnabled(isNotificationSoundEnabled());
    window.addEventListener('rawdha-subscription-renewals-updated', syncRenewal);
    window.addEventListener('rawdha:notification-sound-pref', onSoundPref);
    return () => {
      active = false;
      window.removeEventListener('rawdha-subscription-renewals-updated', syncRenewal);
      window.removeEventListener('rawdha:notification-sound-pref', onSoundPref);
    };
  }, [user?.id, user?.role]);

  // 1. Admin/Platform global state
  const [platformData, setPlatformData] = useState({
    platformName: 'Rawdha+ Platform',
    platformVersion: 'v2.5.0 Premium',
    baseLicensingFee: '5000',
    platformSupportEmail: 'support@rawdha.dz',
    platformSupportPhone: '+213 21 73 88 19',
    defaultGracePeriodDays: '30',
    maintenanceMode: false,
    allowSelfRegistration: true,
    requireContractApproval: false,
    automaticExpiryCheck: true,
  });

  // 2. Director's Creche state
  const [crecheData, setCrecheData] = useState({
    crecheName: user?.nomCreche || 'Ma crèche',
    licenseCode: '',
    principalEmail: user?.email || '',
    phoneNumbers: '+213 555 12 34 56',
    addressLine: '',
    workingHours: '07:30 - 17:30',
    tuitionFeeRate: '3500',
    mealPricePerDay: '250',
    currencyType: 'DA (Dinar Algérien)',
    sendSmsAlerts: true,
    weeklyFicheEmail: true,
    securityCheckRequired: true,
    mealsOrganicPriority: true,
    logoUrl: '' as string, // ✅ Logo PNG de la crèche, en base64 (affiché sidebar, header, factures, favicon)
  });

  const [logoError, setLogoError] = useState('');

  // ✅ Upload du logo : on exige un vrai fichier PNG (type MIME + extension), on
  // convertit en base64 pour le stocker directement dans le document "parametres"
  // (pas besoin d'un bucket de stockage séparé pour un simple logo).
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setLogoError('');
    if (!file) return;

    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    if (!isPng) {
      setLogoError(isFrench ? 'Le logo doit être un fichier PNG.' : 'يجب أن يكون الشعار بصيغة PNG.');
      e.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError(isFrench ? 'Le fichier ne doit pas dépasser 2 Mo.' : 'يجب ألا يتجاوز حجم الملف 2 ميغابايت.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCrecheData(prev => ({ ...prev, logoUrl: reader.result as string }));
    };
    reader.onerror = () => {
      setLogoError(isFrench ? 'Erreur de lecture du fichier.' : 'خطأ أثناء قراءة الملف.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setCrecheData(prev => ({ ...prev, logoUrl: '' }));
  };

  // 3. Parent's custom preferences state
  const [parentData, setParentData] = useState({
    allowChildPhotos: true,
    receiveDailyMenuEmail: true,
    receivePresenceSMSAlert: true,
    emergencyWhatsappContact: '',
  });

  // Load appropriate configuration from Firestore
  useEffect(() => {
    async function loadSettings() {
      if (!user) return;
      try {
        setLoading(true);
        setErrorMessage('');

        let docId = '';
        if (user.role === 'admin') {
          docId = 'platform_general';
        } else if (user.role === 'directeur') {
          docId = `creche_${user.id}`;
        } else {
          docId = `parent_${user.id}`;
        }

        if (import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true') {
          const raw = localStorage.getItem(`rawdha_demo_settings_${docId}`);
          const cached = raw ? JSON.parse(raw) : null;
          if (user.role === 'admin' && cached) {
            setPlatformData(prev => ({ ...prev, ...cached }));
          } else if (user.role === 'directeur') {
            setCrecheData(prev => ({
              ...prev,
              crecheName: user.nomCreche || prev.crecheName,
              licenseCode: prev.licenseCode || 'AGR-09-BLIDA-2024',
              principalEmail: user.email || 'direction@petitssoleils.dz',
              phoneNumbers: user.telephone || '0550 12 34 56',
              addressLocation: 'Boulevard Kritli Mokhtar, Blida 09000',
              tuitionFeeRate: 15000,
              ...(cached || {}),
            }));
          } else if (cached) {
            setParentData(prev => ({ ...prev, ...cached }));
          }
          return;
        }

        const cloudData = await getCollectionDocument<any>('parametres', docId);

        if (cloudData) {
          if (user.role === 'admin') {
            setPlatformData(prev => ({ ...prev, ...cloudData }));
          } else if (user.role === 'directeur') {
            setCrecheData(prev => ({ ...prev, ...cloudData }));
          } else {
            setParentData(prev => ({ ...prev, ...cloudData }));
          }
        } else {
          // Document doesn't exist, we will use default states and write them on first Save
          console.log('No settings record found in Firestore. Defaults will be used and saved.');
        }
      } catch (err: any) {
        console.error('Error loading config from Firestore:', err);
        setErrorMessage(isFrench ? 'Impossible de synchroniser les configurations.' : 'فشل تحميل الإعدادات من قاعدة البيانات.');
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [user, isFrench]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (user.role === 'directeur') {
      const phoneDigits = crecheData.phoneNumbers.replace(/\D/g, '');
      if (phoneDigits.length < 9) {
        setErrorMessage(isFrench ? 'Saisissez un numéro de téléphone valide (au moins 9 chiffres).' : 'يرجى إدخال رقم هاتف صحيح (9 أرقام على الأقل).');
        return;
      }
    }

    if (user.role === 'admin' || user.role === 'directeur') {
      const confirmed = await confirm({
        title: user.role === 'admin'
          ? (isFrench ? 'Confirmer les paramètres globaux' : 'تأكيد إعدادات المنصة العامة')
          : (isFrench ? 'Confirmer les paramètres de la crèche' : 'تأكيد إعدادات الحضانة'),
        message: user.role === 'admin'
          ? (isFrench
            ? 'Ces paramètres peuvent modifier l’accès, les abonnements et l’affichage de la plateforme pour tous les comptes.'
            : 'قد تؤثر هذه الإعدادات على الدخول والاشتراكات والعرض لجميع الحسابات.')
          : (isFrench
            ? 'Les coordonnées et informations saisies seront enregistrées. Les options indiquées comme indisponibles ne seront pas activées.'
            : 'سيتم حفظ المعلومات المدخلة. الخيارات غير المتاحة لن يتم تفعيلها.'),
        confirmLabel: isFrench ? 'Enregistrer' : 'حفظ',
      });
      if (!confirmed) return;
    }

    try {
      setSaveLoading(true);
      setErrorMessage('');
      setSavedSuccess(false);

      let docId = '';
      let dataToSave: { id: string; [key: string]: any } = { id: '' };

      if (user.role === 'admin') {
        docId = 'platform_general';
        dataToSave = { id: docId, ...platformData };
      } else if (user.role === 'directeur') {
        docId = `creche_${user.id}`;
        dataToSave = { id: docId, ...crecheData };

        // Le téléphone renseigné dans les Paramètres est aussi le contact de la
        // Directrice côté Super Admin. On garde les deux sources synchronisées :
        // les anciennes fiches restent lisibles grâce au repli Admin, et les
        // prochaines sauvegardes alimentent directement le compte.
        const telephone = crecheData.phoneNumbers.trim();
        if (telephone && user.telephone !== telephone) {
          await updateProfile({ telephone });
        }
      } else {
        docId = `parent_${user.id}`;
        dataToSave = { id: docId, ...parentData };
      }

      if (import.meta.env.DEV && import.meta.env.VITE_ARENA_DEMO === 'true') {
        localStorage.setItem(`rawdha_demo_settings_${docId}`, JSON.stringify(dataToSave));
      } else {
        await setCollectionDocument('parametres', docId, dataToSave);
      }

      // ✅ Propage immédiatement le nom / logo / tarif dans toute l'appli
      // (sidebar, header, factures) sans que le directeur ait besoin de se reconnecter.
      if (user.role === 'directeur') {
        await refreshCreche();
      }

      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
      }, 4000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setErrorMessage(isFrench ? 'Erreur lors de la sauvegarde.' : 'حدث خطأ أثناء حفظ الإعدادات.');
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-bold text-sm">
          {isFrench ? 'Chargement sécurisé des configurations...' : 'جاري تحميل وضبط الإعدادات بأمان...'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header and description banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {t('settings')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
            {user?.role === 'admin' && (
              isFrench
                ? 'Paramètres globaux de la plateforme et licences.'
                : 'الإعدادات العامة للمنصة وتراخيص المؤسسات.'
            )}
            {user?.role === 'directeur' && (
              isFrench
                ? `Établissement : ${crecheData.crecheName || user.nomCreche}`
                : `معلومات الحضانة والتعريفة: ${crecheData.crecheName}`
            )}
            {user?.role === 'parent' && (
              isFrench
                ? 'Autorisations parentales et préférences.'
                : 'الأذونات وتفضيلات التواصل.'
            )}
          </p>
        </div>
      </div>

      {user?.role === 'directeur' && (IdentityOcrDemo ? <Suspense fallback={null}><IdentityOcrDemo firstName={user.prenom || ''} lastName={user.nom || ''} isFrench={isFrench} /></Suspense> : <IdentityDocumentRequest userId={user.id} firstName={user.prenom || ''} lastName={user.nom || ''} isFrench={isFrench} />)}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-start gap-2.5">
          <ShieldAlert className="w-5 h-5 text-rose-500 mt-0.5" />
          <p className="font-bold">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">

        {/* ==================== A. PLATFORM ADMIN VIEW ==================== */}
        {user?.role === 'admin' && (
          <>
            {/* Core Institutional & Identity Settings */}
            <div className="lg:col-span-2 space-y-6">

              {/* Box 1: Platform identity & core defaults */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-601 text-indigo-600" />
                  <span>{isFrench ? '1. Identité de la Plateforme & Licences' : '1. هوية منصة روضتي الوطنية والاشتراكات'}</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                      {isFrench ? 'Nom du Service Platforme' : 'اسم المنصة العام المعروض'}
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                      value={platformData.platformName}
                      onChange={e => setPlatformData({...platformData, platformName: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                      {isFrench ? 'Version de l’Application' : 'نسخة برمجيات المنصة'}
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800"
                      value={platformData.platformVersion}
                      onChange={e => setPlatformData({...platformData, platformVersion: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                      {isFrench ? 'Email Support Administrateur' : 'بريد الدعم الفني المركزي للاستقبال'}
                    </label>
                    <div className="relative">
                      <Mail className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        className="w-full ps-10 pe-4 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                        value={platformData.platformSupportEmail}
                        onChange={e => setPlatformData({...platformData, platformSupportEmail: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                      {isFrench ? 'Téléphone Support Technique' : 'هاتف الدعم للمدراء والمؤسسات'}
                    </label>
                    <div className="relative">
                      <Phone className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        className="w-full ps-10 pe-4 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800"
                        value={platformData.platformSupportPhone}
                        onChange={e => setPlatformData({...platformData, platformSupportPhone: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Box 2: Platforms Business Rules */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-indigo-600" />
                  <span>{isFrench ? '2. Tarification Crèches par Défaut' : '2. الأسعار وفترة السماح المعتمدة للحسابات'}</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                      {isFrench ? 'Coût d’abonnement mensuel de base (DA)' : 'سعر الاشتراك الشهري الافتراضي للروضة المضافة'}
                    </label>
                    <input
                      type="number"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-black text-slate-800"
                      value={platformData.baseLicensingFee}
                      onChange={e => setPlatformData({...platformData, baseLicensingFee: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                      {isFrench ? 'Période d\'abonnement par défaut (Jours)' : 'مدة صلاحية التنشيط المبدئية عند الإضافة (أيام)'}
                    </label>
                    <input
                      type="number"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800"
                      value={platformData.defaultGracePeriodDays}
                      onChange={e => setPlatformData({...platformData, defaultGracePeriodDays: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Controls Panel */}
            <div className="space-y-6">
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="truncate">{isFrench ? 'Offre publique & encaissement' : 'العرض العام والتحصيل'}</span>
                </h2>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2 rounded-2xl bg-indigo-50/70 px-3.5 py-2.5">
                    <span className="font-bold text-slate-700 truncate">{isFrench ? 'Abonnement mensuel' : 'الاشتراك الشهري'}</span>
                    <span className="shrink-0 font-black text-indigo-700 tabular-nums">{LEGAL_CONFIG.monthlyPlanPriceDzd.toLocaleString('fr-FR')} {isFrench ? 'DA / mois' : 'د.ج / شهر'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3.5 py-2.5">
                    <span className="font-bold text-slate-600 truncate">{isFrench ? 'Paiement carte' : 'الدفع بالبطاقة'}</span>
                    <span className="shrink-0 text-[11px] font-black text-indigo-700">CIB / Edahabia</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3.5 py-2.5">
                    <span className="font-bold text-slate-600 truncate">{isFrench ? 'Activation directe' : 'تفعيل مباشر'}</span>
                    <span className="shrink-0 text-[11px] font-black text-emerald-700">WhatsApp</span>
                  </div>
                </div>
              </div>

              {/* Action and submit triggers */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl font-bold text-sm transition cursor-pointer disabled:opacity-50"
                >
                  {saveLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save size={16} className="stroke-[2.5]" />
                  )}
                  <span>{isFrench ? 'Enregistrer la plateforme' : 'حفظ التغييرات العامه للمنصة'}</span>
                </button>
                <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl text-[11px] text-slate-500 font-medium leading-relaxed">
                  <Info className="w-4 h-4 text-indigo-500 inline me-1 -mt-0.5" />
                  <span>
                    {isFrench
                      ? 'Ces réglages s’appliquent à tous les comptes. Vérifiez les valeurs avant de confirmer l’enregistrement.'
                      : 'تطبق هذه الإعدادات على جميع الحسابات. يرجى التحقق من القيم قبل تأكيد الحفظ.'}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}


        {/* ==================== B. CRECHE DIRECTOR VIEW ==================== */}
        {user?.role === 'directeur' && (
          <>
            <div className="lg:col-span-2 space-y-6">

              {/* Box 1: Creche Legal Info */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-600" />
                  <span>{isFrench ? '1. Identité & Registre Légal de l’Établissement' : '1. الهوية الرسمية وترخيص الروضة'}</span>
                </h2>

                {/* Logo Upload compact côte-à-côte sur mobile comme sur ordinateur */}
                <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
                  <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {crecheData.logoUrl ? (
                      <img src={crecheData.logoUrl} alt="Logo" className="w-full h-full object-contain p-1.5" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase truncate">
                      {isFrench ? 'Logo de la Crèche (PNG · 2 Mo max)' : 'شعار الروضة (PNG · 2 ميغابايت)'}
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="min-h-8! inline-flex items-center px-3.5 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition">
                        {isFrench ? 'Choisir un fichier PNG' : 'اختر ملف PNG'}
                        <input type="file" accept="image/png,.png" onChange={handleLogoUpload} className="hidden" />
                      </label>
                      {crecheData.logoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="min-h-8! px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold cursor-pointer transition inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {isFrench ? 'Retirer' : 'إزالة'}
                        </button>
                      )}
                    </div>
                    {logoError && (
                      <p className="text-[11px] text-rose-500 font-semibold">{logoError}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                      {isFrench ? 'Dénomination de la Crèche *' : 'اسم الروضة الرسمي *'}
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                      value={crecheData.crecheName}
                      onChange={e => setCrecheData({...crecheData, crecheName: e.target.value})}
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      {isFrench ? 'Se met à jour partout (menu, factures) dès l\'enregistrement.' : 'يتم تحديثه في كل مكان (القائمة، الفواتير) فور الحفظ.'}
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase mb-2">
                      <Lock className="w-3 h-3 text-slate-400" />
                      {isFrench ? 'Code de Licence d\'Agrément' : 'رقم رخصة الاعتماد المالي'}
                    </label>
                    <input
                      type="text"
                      disabled
                      title={isFrench ? 'Attribué par la plateforme, non modifiable. Contactez le support pour toute correction.' : 'يُحدَّد من طرف المنصة ولا يمكن تعديله. تواصل مع الدعم الفني لأي تصحيح.'}
                      className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl outline-none text-sm font-bold text-slate-500 cursor-not-allowed"
                      value={crecheData.licenseCode}
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      {isFrench ? 'Attribué par la plateforme — contactez le support pour le modifier.' : 'محدد من طرف المنصة — تواصل مع الدعم لتعديله.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase mb-2">
                      <Lock className="w-3 h-3 text-slate-400" />
                      {isFrench ? 'Email de Support Parents *' : 'بريد الاتصال واستقبال الأولياء *'}
                    </label>
                    <div className="relative">
                      <Mail className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        disabled
                        title={isFrench ? 'Attribué par la plateforme, non modifiable. Contactez le support pour toute correction.' : 'يُحدَّد من طرف المنصة ولا يمكن تعديله. تواصل مع الدعم الفني لأي تصحيح.'}
                        className="w-full ps-10 pe-4 p-3 bg-slate-100 border border-slate-200 rounded-xl outline-none text-sm font-semibold text-slate-500 cursor-not-allowed"
                        value={crecheData.principalEmail}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      {isFrench ? 'Attribué par la plateforme — contactez le support pour le modifier.' : 'محدد من طرف المنصة — تواصل مع الدعم لتعديله.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                      {isFrench ? 'Téléphone d\'urgence de la Crèche *' : 'رقم هاتف الاتصال السريع *'}
                    </label>
                    <div className="relative">
                      <Phone className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        inputMode="tel"
                        placeholder={isFrench ? 'Ex. : 0555 12 34 56' : 'مثال: 0555 12 34 56'}
                        className="w-full ps-10 pe-4 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800"
                        value={crecheData.phoneNumbers}
                        onChange={e => setCrecheData({...crecheData, phoneNumbers: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                    {isFrench ? 'Adresse Géographique Officielle' : 'العنوان البريدي والجغرافي الحالي'}
                  </label>
                  <div className="relative">
                    <MapPin className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      className="w-full ps-10 pe-4 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                      value={crecheData.addressLine}
                      onChange={e => setCrecheData({...crecheData, addressLine: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Box 2: Operating constraints */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>{isFrench ? '2. Tarifs & Horaires de Garde' : '2. أوقات العمل والأسعار التعليمية'}</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                      {isFrench ? 'Amplitude d\'Ouverture *' : 'ساعات ترحيب الأطفال يومياً *'}
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800"
                      value={crecheData.workingHours}
                      onChange={e => setCrecheData({...crecheData, workingHours: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                      {isFrench ? 'Frais Scolarité Mensuel de Base (DA)' : 'رسوم اشتراك الروضة الشهري لكل طفل (DA)'}
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                      <input
                        type="number"
                        className="w-full ps-10 pe-4 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-black text-slate-800"
                        value={crecheData.tuitionFeeRate}
                        onChange={e => setCrecheData({...crecheData, tuitionFeeRate: e.target.value})}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      {isFrench ? 'Ce montant devient le tarif par défaut proposé lors de la création d\'un nouveau paiement.' : 'يصبح هذا المبلغ التعرفة الافتراضية عند إنشاء دفعة جديدة.'}
                    </p>
                  </div>
                </div>


                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                      {isFrench ? 'Tarif Repas Cantine par Jour (DA)' : 'تعرفة الوجبة اليومية للطفل في المطعم'}
                    </label>
                    <input
                      type="number"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-850"
                      value={crecheData.mealPricePerDay}
                      onChange={e => setCrecheData({...crecheData, mealPricePerDay: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                      {isFrench ? 'Devise de facture' : 'العملة الرسمية'}
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-850"
                      value={crecheData.currencyType}
                      onChange={e => setCrecheData({...crecheData, currencyType: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Creche Safety Toggle Controls */}
            <div className="space-y-6">
              <section className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white"><HelpCircle className="h-5 w-5" /></span>
                  <div>
                    <p className="text-sm font-black text-slate-900">{isFrench ? 'Aide & démarrage' : 'الدليل وإعداد البداية'}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{isFrench ? 'Retrouvez le guide de gestion, puis reprenez la configuration initiale de votre crèche si nécessaire.' : 'ستجدون دليل التسيير، ثم يمكنكم مراجعة إعداد البداية عند الحاجة.'}</p>
                    <a href="/aide" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-indigo-700 shadow-sm ring-1 ring-indigo-100 transition hover:bg-indigo-100">
                      <HelpCircle className="h-3.5 w-3.5" />{isFrench ? 'Ouvrir le guide' : 'فتح الدليل'}
                    </a>
                  </div>
                </div>
              </section>
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="truncate">{isFrench ? '3. Mon abonnement Rawdha+' : '3. اشتراكي في Rawdha+'}</span>
                </h2>

                <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-100 truncate">
                      {isFrench ? 'Formule Complète' : 'الباقة الشاملة'}
                    </span>
                    <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-[10.5px] font-bold">
                      {user?.dateFinAbonnement
                        ? `${isFrench ? 'Jusqu’au' : 'إلى غاية'} ${user.dateFinAbonnement}`
                        : isFrench ? 'Essai 15j' : 'تجربة 15 يوم'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black tabular-nums">{LEGAL_CONFIG.monthlyPlanPriceDzd.toLocaleString('fr-FR')} {isFrench ? 'DA' : 'د.ج'}</span>
                    <span className="text-xs text-indigo-100">/ {isFrench ? 'mois' : 'شهر'}</span>
                  </div>
                  {latestRenewal?.status === 'pending' && (
                    <div className="rounded-xl bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white truncate">
                      {isFrench
                        ? `Reçu ${latestRenewal.paymentChannel} envoyé · validation en cours`
                        : `تم إرسال وصل ${latestRenewal.paymentChannel} · قيد التفعيل`}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigate) {
                        onNavigate('abonnement');
                      } else {
                        setShowRenewalModal(true);
                      }
                    }}
                    className="min-h-9! w-full rounded-xl bg-white px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-50 whitespace-nowrap truncate transition cursor-pointer"
                  >
                    {isFrench ? 'Gérer / Renouveler mon abonnement' : 'إدارة / تجديد اشتراكي'}
                  </button>
                </div>

                {/* Réglage sonore actif */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 block truncate">
                      {isFrench ? 'Sonnerie des notifications' : 'نغمة الإشعارات'}
                    </span>
                    <span className="text-[11px] text-slate-500 block truncate">
                      {isFrench ? 'Alerte sonore sur cet appareil' : 'تنبيه صوتي على هذا الجهاز'}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-pressed={soundEnabled}
                    onClick={() => {
                      const next = !soundEnabled;
                      setNotificationSoundEnabled(next);
                      setSoundEnabled(next);
                      if (next) void playNotificationChime({ force: true });
                    }}
                    className={`min-h-8! shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      soundEnabled
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    <Bell className="h-3.5 w-3.5 shrink-0" />
                    <span>{soundEnabled ? (isFrench ? 'Activé' : 'مفعّل') : (isFrench ? 'Muet' : 'صامت')}</span>
                  </button>
                </div>
              </div>

              {user && (
                <SubscriptionRenewalModal
                  isOpen={showRenewalModal}
                  onClose={() => setShowRenewalModal(false)}
                  isArabic={isArabic}
                  director={user}
                  onSubmitted={req => setLatestRenewal(req)}
                />
              )}

              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl font-bold text-sm transition cursor-pointer disabled:opacity-50"
                >
                  {saveLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save size={16} className="stroke-[2.5]" />
                  )}
                  <span>{isFrench ? 'Enregistrer les paramètres' : 'حفظ الإعدادات'}</span>
                </button>
              </div>
            </div>
          </>
        )}


        {/* ==================== C. PARENT VIEW ==================== */}
        {user?.role === 'parent' && (
          <>
            <div className="lg:col-span-2 space-y-6">

              {/* Box 1: Parent Authorization settings */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-101 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>{isFrench ? '1. Autorisations & Consentements d\'Image' : '1. الأذونات والموافقة على التصوير'}</span>
                </h2>

                <div className="space-y-4">
                  {/* Photo permission */}
                  <div className="flex items-start justify-between gap-2 flex-col sm:flex-row pb-4 border-b border-slate-100">
                    <div className="space-y-0.5 max-w-md">
                      <span className="text-xs font-bold text-slate-800 block">
                        {isFrench ? 'Autoriser la publication des photos scolaires' : 'الموافقة على تصوير الأنشطة التعليمية لولدي'}
                      </span>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        {isFrench
                          ? 'Permet à l\'enseignante d\'ajouter l\'enfant dans l\'album d\'activité pédagogique sécurisé et visible uniquement par vous.'
                          : 'يسمح للمشرفة بإدراج طفلك في ألبوم الصور المغلق والتوجيهي المحمي بقيم الأمان، للمتابعة الشخصية فقط.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setParentData({...parentData, allowChildPhotos: !parentData.allowChildPhotos})}
                      className="text-indigo-600 cursor-pointer self-start"
                    >
                      {parentData.allowChildPhotos ? (
                        <ToggleRight className="w-10 h-10 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-10 h-10 text-slate-300" />
                      )}
                    </button>
                  </div>

                  {/* Mail updates */}
                  <div className="flex items-start justify-between gap-2 flex-col sm:flex-row pb-4 border-b border-slate-100">
                    <div className="space-y-0.5 max-w-md">
                      <span className="text-xs font-bold text-slate-800 block">
                        {isFrench ? 'Recevoir le menu traiteur hebdomadaire' : 'استلام قائمة طعام الحضانة أسبوعياً'}
                      </span>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        {isFrench
                          ? 'Envoi automatique par courrier électronique de la liste des plats et des allergènes.'
                          : 'الحصول على المخطط الغذائي بالوجبات اليومية والمقادير مباشرة على البريد الإلكتروني.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setParentData({...parentData, receiveDailyMenuEmail: !parentData.receiveDailyMenuEmail})}
                      className="text-indigo-600 cursor-pointer self-start"
                    >
                      {parentData.receiveDailyMenuEmail ? (
                        <ToggleRight className="w-10 h-10 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-10 h-10 text-slate-300" />
                      )}
                    </button>
                  </div>

                  {/* SMS alerts on presence check-in/out */}
                  <div className="flex items-start justify-between gap-2 flex-col sm:flex-row">
                    <div className="space-y-0.5 max-w-md">
                      <span className="text-xs font-bold text-slate-800 block">
                        {isFrench ? 'Alerte SMS de confirmation de sortie' : 'رسالة إشعار فورية عند خروج الطفل'}
                      </span>
                      <p className="text-[11px] text-slate-500 leading-normal">
                        {isFrench
                          ? 'Recevez un SMS de sécurité gratuit dès que l\'enfant quitte l\'enceinte de l\'école.'
                          : 'استلام رسالة نصية قصيرة فور تسليم الطفل للولي المعتمد من قبل المربيات.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setParentData({...parentData, receivePresenceSMSAlert: !parentData.receivePresenceSMSAlert})}
                      className="text-indigo-600 cursor-pointer self-start"
                    >
                      {parentData.receivePresenceSMSAlert ? (
                        <ToggleRight className="w-10 h-10 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-10 h-10 text-slate-300" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Emergency WhatsApp box */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-101 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  <span>{isFrench ? '2. Relais Téléphonique Privilégié' : '2. رقم الطوارئ الرئيسي لأولياء الأمر'}</span>
                </h3>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                    {isFrench ? 'Numéro de Téléphone Urgent (WhatsApp)' : 'رقم الهاتف البديل لتنبيهات الواتساب العاجلة'}
                  </label>
                  <input
                    type="text"
                    value={parentData.emergencyWhatsappContact}
                    onChange={(e) => setParentData({...parentData, emergencyWhatsappContact: e.target.value})}
                    placeholder="+213 550 00 00 00"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-805"
                  />
                </div>
              </div>
            </div>

            {/* Sidebar support help contact */}
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                <HelpCircle className="w-5 h-5 text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-900">{isFrench ? 'Besoin d’assistance ?' : 'هل تحتاج لمساعدة؟'}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {isFrench
                    ? 'Contactez l’administration de votre crèche ou le support Rawdha+ en cas de besoin.'
                    : 'يمكنك التواصل مع إدارة الروضة أو دعم المنصة لمراجعة تفاصيل حسابك.'}
                </p>
              </div>

              <div className="space-y-3">
                {canManageSettings && (
                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl font-bold text-sm transition cursor-pointer"
                  >
                    {saveLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save size={16} className="stroke-[2.5]" />
                    )}
                    <span>{isFrench ? 'Sauvegarder mes préférences' : 'حفظ تفضيلاتي'}</span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}

      </form>

      {/* Gestion centralisée des profils d'équipe & permissions par page (réservée à l'Admin Crèche) */}
      <TeamAccessManager />

      {/* Abonnement, résiliation sans frais & droits sur les données (Points #18 & #20) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 max-w-2xl">
            <h2 className="text-sm font-bold text-slate-900">
              {isArabic
                ? 'الاشتراك، إلغاء التجديد وحقوق البيانات (القانون 18-07)'
                : 'Abonnement, résiliation & droits sur vos données (Loi 18-07)'}
            </h2>
            <p className="text-xs leading-5 text-slate-600">
              {isArabic
                ? 'لا يوجد أي تجديد إجباري أو رسوم خفية: يمكنكم طلب إيقاف تجديد الاشتراك الشهري أو طلب حذف حسابكم وبياناتكم الشخصية في أي وقت.'
                : 'Aucun renouvellement forcé ni frais caché : vous pouvez demander l’arrêt de votre abonnement mensuel ou la suppression de votre compte et de vos données à tout moment.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user?.role !== 'admin' && (
              <a
                href="/support?sujet=resiliation"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                {isArabic ? 'إلغاء تجديد الاشتراك' : 'Ne pas renouveler l’abonnement'}
              </a>
            )}
            <a
              href={buildLegalHref('suppression')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{isArabic ? 'طلب حذف البيانات' : 'Suppression des données'}</span>
            </a>
            <a
              href={buildLegalHref('confidentialite')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {isArabic ? 'المركز القانوني والشروط' : 'Centre légal & CGU'}
            </a>
          </div>
        </div>
      </section>

      {/* Save Confirmation Notification banner */}
      <AnimatePresence>
        {savedSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex max-w-md items-start gap-3 rounded-2xl border border-emerald-700 bg-emerald-600 p-4 text-white font-semibold shadow-xl sm:inset-x-auto sm:right-6 sm:bottom-6"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-100 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold">{isFrench ? 'Paramètres enregistrés' : 'تم حفظ الإعدادات'}</p>
              <p className="text-[11px] text-emerald-100/90 mt-0.5 leading-normal">
                {isFrench
                  ? 'Vos modifications ont bien été prises en compte.'
                  : 'تم تحديث إعداداتك بنجاح.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
