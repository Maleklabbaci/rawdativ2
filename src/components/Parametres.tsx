import React, { useState, useEffect } from 'react';
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
import { motion, AnimatePresence } from 'motion/react';

export default function Parametres() {
  const { t, language } = useLanguage();
  const { user, refreshCreche } = useAuth();
  const { confirm } = useConfirmDialog();
  const isFrench = language === 'fr';
  const isArabic = language === 'ar';

  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
            ? 'Les horaires, tarifs et alertes seront mis à jour pour votre équipe.'
            : 'سيتم تحديث الأوقات والأسعار والتنبيهات لفريقكم.'),
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
      } else {
        docId = `parent_${user.id}`;
        dataToSave = { id: docId, ...parentData };
      }

      await setCollectionDocument('parametres', docId, dataToSave);

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
    <div className="space-y-6 sm:space-y-8 font-sans">
      {/* Header and description banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
            <span>{t('settings')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-bold">
            {user?.role === 'admin' && (
              isFrench 
                ? 'Super-administration de la plateforme globale Rawdha+, licences crèches et infrastructure.' 
                : 'التحكم الإداري الأعلى لمنصة روضتي الشاملة وتراخيص المؤسسات الشريكة.'
            )}
            {user?.role === 'directeur' && (
              isFrench 
                ? `Configuration de l'établissement : ${crecheData.crecheName || user.nomCreche}` 
                : `تخصيص معلومات الحضانة والبروتوكول التعليمي والتعرفة لـ: ${crecheData.crecheName}`
            )}
            {user?.role === 'parent' && (
              isFrench 
                ? 'Vos autorisations parentales, droits à l’image et relais de communication.' 
                : 'الأذونات الخاصة بولي الأمر، حقوق تصوير الطفل وتفضيلات استلام الرسائل.'
            )}
          </p>
        </div>
      </div>

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
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="email" 
                        className="w-full pl-10 pr-4 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
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
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        className="w-full pl-10 pr-4 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800" 
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
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-101 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <span>{isFrench ? 'Options d\'infrastructure' : 'أزرار تحكم المنصة الأساسية'}</span>
                </h2>

                <div className="space-y-4">
                  {/* Option 1: automatic expiry block */}
                  <label className="flex items-start gap-3 cursor-pointer justify-between group">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 block">
                        {isFrench ? 'Dépassement de date bloquant' : 'الإغلاق التلقائي للمنتهين'}
                      </span>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        {isFrench ? 'Bloque instantanément l\'établissement si la date fin est dépassée' : 'حظر الروضة فوراً بمجرد تجاوز تاريخ النهاية'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPlatformData({...platformData, automaticExpiryCheck: !platformData.automaticExpiryCheck})}
                      className="text-indigo-600 cursor-pointer"
                    >
                      {platformData.automaticExpiryCheck ? (
                        <ToggleRight className="w-9 h-9 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-9 h-9 text-slate-300" />
                      )}
                    </button>
                  </label>

                  {/* Option 2: Maintenance mode simulation */}
                  <label className="flex items-start gap-3 cursor-pointer justify-between group pt-3 border-t border-slate-100">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 block">
                        {isFrench ? 'Mode Maintenance Plateforme' : 'تفعيل وضع الصيانة العام'}
                      </span>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        {isFrench ? 'Affiche un bandeau pour signaler une indisponibilité temporaire' : 'إظهار شارة لإبلاغ المستخدمين بتوقف مؤقت للخدمة'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPlatformData({...platformData, maintenanceMode: !platformData.maintenanceMode})}
                      className="text-indigo-600 cursor-pointer"
                    >
                      {platformData.maintenanceMode ? (
                        <ToggleRight className="w-9 h-9 text-amber-500 animate-pulse" />
                      ) : (
                        <ToggleLeft className="w-9 h-9 text-slate-300" />
                      )}
                    </button>
                  </label>

                  {/* Option 3: Direct signup */}
                  <label className="flex items-start gap-3 cursor-pointer justify-between group pt-3 border-t border-slate-100">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 block">
                        {isFrench ? 'Inscriptions directes autorisées' : 'التسجيل الذاتي المباشر'}
                      </span>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        {isFrench ? 'Permet aux directeurs de candidater via le web' : 'السماح للروضات بالتقديم المبدئي المباشر'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPlatformData({...platformData, allowSelfRegistration: !platformData.allowSelfRegistration})}
                      className="text-indigo-600 cursor-pointer"
                    >
                      {platformData.allowSelfRegistration ? (
                        <ToggleRight className="w-9 h-9 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-9 h-9 text-slate-300" />
                      )}
                    </button>
                  </label>
                </div>
              </div>

              {/* Action and submit triggers */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-4 rounded-2xl font-black text-sm tracking-wide shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 transition cursor-pointer disabled:opacity-50"
                >
                  {saveLoading ? (
                    <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                  ) : (
                    <Save size={18} className="stroke-[3]" />
                  )}
                  <span>{isFrench ? 'Enregistrer la plateforme' : 'حفظ التغييرات العامه للمنصة'}</span>
                </button>
                <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl text-[11px] text-slate-500 font-medium leading-relaxed">
                  <Info className="w-4 h-4 text-indigo-500 inline mr-1 -mt-0.5" />
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

                {/* Logo Upload — apparaît dans la sidebar, le header, les factures et l'onglet du navigateur */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                  <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {crecheData.logoUrl ? (
                      <img src={crecheData.logoUrl} alt="Logo" className="w-full h-full object-contain p-1.5" />
                    ) : (
                      <ImageIcon className="w-7 h-7 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase">
                      {isFrench ? 'Logo de la Crèche (PNG uniquement)' : 'شعار الروضة (بصيغة PNG فقط)'}
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold cursor-pointer transition">
                        {isFrench ? 'Choisir un fichier PNG' : 'اختر ملف PNG'}
                        <input type="file" accept="image/png,.png" onChange={handleLogoUpload} className="hidden" />
                      </label>
                      {crecheData.logoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {isFrench ? 'Retirer' : 'إزالة'}
                        </button>
                      )}
                    </div>
                    {logoError ? (
                      <p className="text-[11px] text-rose-500 font-semibold">{logoError}</p>
                    ) : (
                      <p className="text-[10px] text-slate-400">
                        {isFrench ? 'Remplace le logo par défaut partout : menu, factures, onglet du navigateur. 2 Mo max.' : 'يستبدل الشعار الافتراضي في كل مكان: القائمة، الفواتير، تبويب المتصفح. 2 ميغابايت كحد أقصى.'}
                      </p>
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
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="email" 
                        disabled
                        title={isFrench ? 'Attribué par la plateforme, non modifiable. Contactez le support pour toute correction.' : 'يُحدَّد من طرف المنصة ولا يمكن تعديله. تواصل مع الدعم الفني لأي تصحيح.'}
                        className="w-full pl-10 pr-4 p-3 bg-slate-100 border border-slate-200 rounded-xl outline-none text-sm font-semibold text-slate-500 cursor-not-allowed" 
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
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="tel"
                        inputMode="tel"
                        placeholder={isFrench ? 'Ex. : 0555 12 34 56' : 'مثال: 0555 12 34 56'}
                        className="w-full pl-10 pr-4 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-bold text-slate-800" 
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
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-semibold text-slate-800" 
                      value={crecheData.addressLine}
                      onChange={e => setCrecheData({...crecheData, addressLine: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Box 2: Operating constraints */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-101 flex items-center gap-2">
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
                      <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                      <input 
                        type="number" 
                        className="w-full pl-10 pr-4 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm font-black text-slate-800" 
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
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h2 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-600" />
                  <span>{isFrench ? '3. Notifications & Alertes' : '3. الإشعارات والبروتوكول'}</span>
                </h2>

                <div className="space-y-4">
                  {/* SMS Presence */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 block">{isFrench ? 'SMS des absences à 09 h 00' : 'رسائل الغياب على الساعة 09:00'}</span>
                      <p className="text-[10px] text-slate-400 leading-normal">{isFrench ? 'Alerte les parents si le pointage de leur enfant n’est pas enregistré.' : 'تنبيه الأولياء إذا لم يتم تسجيل حضور طفلهم.'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCrecheData({...crecheData, sendSmsAlerts: !crecheData.sendSmsAlerts})}
                      className="text-indigo-600 cursor-pointer"
                    >
                      {crecheData.sendSmsAlerts ? (
                        <ToggleRight className="w-9 h-9 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-9 h-9 text-slate-300" />
                      )}
                    </button>
                  </div>

                  {/* Mail Weekly */}
                  <div className="flex items-start justify-between gap-2.5 pt-3 border-t border-slate-100">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 block">{isFrench ? 'Rapport hebdomadaire par e-mail' : 'التقرير الأسبوعي عبر البريد الإلكتروني'}</span>
                      <p className="text-[10px] text-slate-400 leading-normal">{isFrench ? 'Envoie chaque samedi le bilan des activités et des photos.' : 'إرسال حصيلة الأنشطة والصور كل يوم سبت.'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCrecheData({...crecheData, weeklyFicheEmail: !crecheData.weeklyFicheEmail})}
                      className="text-indigo-600 cursor-pointer"
                    >
                      {crecheData.weeklyFicheEmail ? (
                        <ToggleRight className="w-9 h-9 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-9 h-9 text-slate-300" />
                      )}
                    </button>
                  </div>

                  {/* Security check */}
                  <div className="flex items-start justify-between gap-2.5 pt-3 border-t border-slate-100">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 block">{isFrench ? 'Vérification d’identité à la sortie' : 'التحقق من الهوية عند المغادرة'}</span>
                      <p className="text-[10px] text-slate-400 leading-normal">{isFrench ? 'Exige deux pièces d’identité autorisées pour remettre l’enfant.' : 'يشترط وثيقتي هوية معتمدتين لتسليم الطفل.'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCrecheData({...crecheData, securityCheckRequired: !crecheData.securityCheckRequired})}
                      className="text-indigo-600 cursor-pointer"
                    >
                      {crecheData.securityCheckRequired ? (
                        <ToggleRight className="w-9 h-9 text-rose-500" />
                      ) : (
                        <ToggleLeft className="w-9 h-9 text-slate-300" />
                      )}
                    </button>
                  </div>

                  {/* Bio Foods */}
                  <div className="flex items-start justify-between gap-2.5 pt-3 border-t border-slate-100">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 block">{isFrench ? 'Mettre en avant les ingrédients bio' : 'إبراز المكونات العضوية'}</span>
                      <p className="text-[10px] text-slate-400 leading-normal">{isFrench ? 'Affiche le label bio lorsque la fiche repas le permet.' : 'إظهار علامة العضوي عندما تسمح بطاقة الوجبة بذلك.'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCrecheData({...crecheData, mealsOrganicPriority: !crecheData.mealsOrganicPriority})}
                      className="text-indigo-600 cursor-pointer"
                    >
                      {crecheData.mealsOrganicPriority ? (
                        <ToggleRight className="w-9 h-9 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-9 h-9 text-slate-300" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-rose-500 to-indigo-600 text-white p-4 rounded-2xl font-black text-sm tracking-wide shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 transition cursor-pointer disabled:opacity-50"
                >
                  {saveLoading ? (
                    <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                  ) : (
                    <Save size={18} className="stroke-[3]" />
                  )}
                  <span>{isFrench ? 'Mettre à jour ma Crèche' : 'تحديث إعدادات كراسة الروضة'}</span>
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
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 p-6 rounded-3xl border border-indigo-950 text-white shadow-md space-y-4">
                <HelpCircle className="w-8 h-8 text-amber-400" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold">{isFrench ? 'Besoin d\'assistance technique ?' : 'هل تحتاج لمساعدة تقنية؟'}</h4>
                  <p className="text-[11px] text-indigo-200 font-semibold leading-relaxed">
                    {isFrench 
                      ? 'N\'hésitez pas à contacter le support centralisé Rawdha+ ou l\'administration de votre crèche pour tout problème de licence.' 
                      : 'يمكنك التواصل مباشرة مع إدارة الروضة أو الدعم البرمجي لشركة روضتي لمراجعة تفاصيل حسابك وربط طفلك.'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white p-4 rounded-2xl font-black text-sm tracking-wide shadow-lg hover:shadow-indigo-605/20 transition cursor-pointer"
                >
                  {saveLoading ? (
                    <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                  ) : (
                    <Save size={18} className="stroke-[3]" />
                  )}
                  <span>{isFrench ? 'Sauvegarder mes Préférences' : 'حفظ تفضيلاتي الشخصية'}</span>
                </button>
              </div>
            </div>
          </>
        )}

      </form>

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
              <p className="text-xs font-black">{isFrench ? 'Paramètres sauvegardés avec succès !' : 'تم حفظ وتوثيق الإعدادات بنجاح!'}</p>
              <p className="text-[10.5px] text-emerald-100/90 mt-1 leading-normal">
                {isFrench 
                  ? 'Vos données ont été enregistrées en toute sécurité dans votre espace cloud Firestore.' 
                  : 'لقد تم تدوين خياراتك وتحديثها مباشرة على قواعد بيانات السحاب الآمنة.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
