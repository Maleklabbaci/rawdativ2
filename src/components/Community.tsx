import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  BellRing,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Eye,
  Flag,
  Globe2,
  House,
  Hash,
  Heart,
  Image as ImageIcon,
  Link2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Pin,
  UserCheck,
  UserPlus,
  Plus,
  Repeat2,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  ThumbsUp,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { CommunityComment, CommunityFeature, CommunityPost, CommunityPostCategory, UserAccount } from '../types';

const categories: Array<{ value: CommunityPostCategory | 'tous'; fr: string; ar: string; color: string }> = [
  { value: 'tous', fr: 'Tout le fil', ar: 'كل المنشورات', color: 'bg-slate-100 text-slate-700' },
  { value: 'activite', fr: 'Activités & méthodes', ar: 'الأنشطة والأساليب', color: 'bg-indigo-50 text-indigo-700' },
  { value: 'materiel', fr: 'Matériel', ar: 'المعدات', color: 'bg-amber-50 text-amber-700' },
  { value: 'vente_echange', fr: 'Vente & échange', ar: 'البيع والتبادل', color: 'bg-emerald-50 text-emerald-700' },
  { value: 'recrutement', fr: 'Recrutement', ar: 'التوظيف', color: 'bg-rose-50 text-rose-700' },
  { value: 'formation', fr: 'Formations', ar: 'التكوين', color: 'bg-purple-50 text-purple-700' },
  { value: 'partenariat', fr: 'Partenariats', ar: 'الشراكات', color: 'bg-cyan-50 text-cyan-700' },
];

const uiCopy = {
  fr: {
    home: 'Accueil',
    myProfile: 'Mon profil',
    myReposts: 'Mes republications',
    moments: 'Moments du réseau',
    momentsSubtitle: 'Découvrez les Directeurs et les crèches de votre réseau.',
    you: 'Vous',
    newPost: 'Nouvelle publication',
    whatDirector: 'Quoi de neuf dans votre crèche ?',
    whatAdmin: 'Quoi de neuf avec Rawdha+ ?',
    photoActivity: 'Photo / activité',
    opportunity: 'Opportunité',
    announcement: 'Annonce',
    feed: 'Fil d’actualité',
    profilesDiscover: 'Profils à découvrir',
    profilesEmpty: 'Les profils apparaîtront ici au fur et à mesure des publications de votre réseau.',
    verifiedNetwork: 'Réseau vérifié',
    verifiedNetworkDesc: 'Les Directeurs peuvent présenter leur crèche, partager leurs pratiques et retrouver facilement les publications d’un auteur.',
    explore: 'Explorer',
    allPosts: 'Tout le fil',
    noPosts: 'Aucune publication ici',
    noPostsDesc: 'Commencez une conversation avec votre réseau professionnel.',
    createPost: 'Créer une publication',
    backToFeed: 'Retour au fil',
    about: 'À propos',
    platformIdentity: 'Identité de la plateforme',
    certification: 'Certification',
    registeredChildren: 'enfants enregistrés',
    officialAccount: 'Compte officiel Rawdha+',
    officialVerified: 'Compte officiel vérifié de Rawdha+',
    verifiedBadge: 'Badge vérifié actif',
    publish: 'Publier',
    cancel: 'Annuler',
    comments: 'commentaires',
    comment: 'commentaire',
    reposts: 'republications',
    repost: 'republication',
    likes: 'J’aime',
    commentAction: 'Commenter',
    repostAction: 'Republier',
    contact: 'Contact :',
    masked: 'Masquée',
    hide: 'Masquer',
    restore: 'Réafficher',
    writeComment: 'Écrire un commentaire...',
    publicProfile: 'Profil public',
    professionalIdentity: 'Construisez votre identité professionnelle',
    profileHelp: 'Modifiez directement les informations visibles lorsque quelqu’un ouvre votre profil depuis une publication.',
    collapseForm: 'Réduire le formulaire',
    firstName: 'Prénom',
    lastName: 'Nom',
    daycareName: 'Nom de la crèche',
    profilePhoto: 'Photo de profil',
    daycareLogo: 'Logo de la crèche',
    choosePhoto: 'Choisir une photo',
    chooseLogo: 'Choisir un logo',
    replace: 'Remplacer',
    remove: 'Supprimer',
    city: 'Ville',
    phone: 'Téléphone',
    website: 'Site web',
    presentation: 'Présentation',
    saveProfile: 'Enregistrer le profil',
    saving: 'Enregistrement...',
    loading: 'Chargement...',
    noProfilePresentation: 'Ce Directeur n’a pas encore ajouté de présentation.',
    addPresentation: 'Ajoutez une présentation professionnelle à votre profil.',
    noProfilePosts: 'Aucune publication pour le moment.',
    follow: 'Suivre',
    following: 'Abonné',
    notifications: 'Notifications',
    notificationsEmpty: 'Aucune notification pour le moment.',
    saved: 'Enregistrés',
    savedEmpty: 'Aucune publication enregistrée.',
    messages: 'Messages',
    messagePlaceholder: 'Écrire un message professionnel...',
    sendMessage: 'Envoyer',
    searchProfiles: 'Rechercher une crèche ou un Directeur',
    hashtags: 'Mots-clés',
    album: 'Album photo',
    poll: 'Sondage',
    pollQuestion: 'Votre question',
    pollOption: 'Option',
    addOption: 'Ajouter une option',
    vote: 'Voter',
    voted: 'Votre vote est enregistré',
    views: 'vues',
    reach: 'portée',
    pinned: 'Publication épinglée',
    pin: 'Épingler',
    unpin: 'Désépingler',
    report: 'Signaler',
    reportSent: 'Signalement envoyé',
    discover: 'Découvrir',
    specialties: 'Spécialités',
    hours: 'Horaires',
    services: 'Services',
    classes: 'classes',
  },
  ar: {
    home: 'الرئيسية',
    myProfile: 'ملفي الشخصي',
    myReposts: 'إعادة نشري',
    moments: 'لحظات من الشبكة',
    momentsSubtitle: 'اكتشف مدراء ودور الحضانة في شبكتك.',
    you: 'أنت',
    newPost: 'منشور جديد',
    whatDirector: 'ما الجديد في حضانتك؟',
    whatAdmin: 'ما الجديد مع Rawdha+؟',
    photoActivity: 'صورة / نشاط',
    opportunity: 'فرصة',
    announcement: 'إعلان',
    feed: 'آخر المنشورات',
    profilesDiscover: 'ملفات مقترحة',
    profilesEmpty: 'ستظهر الملفات هنا مع نشر المزيد من المنشورات في شبكتك.',
    verifiedNetwork: 'شبكة موثوقة',
    verifiedNetworkDesc: 'يمكن للمدراء تقديم حضاناتهم ومشاركة خبراتهم والعثور بسهولة على منشورات كل عضو.',
    explore: 'استكشف',
    allPosts: 'كل المنشورات',
    noPosts: 'لا توجد منشورات هنا',
    noPostsDesc: 'ابدأ محادثة مع شبكتك المهنية.',
    createPost: 'إنشاء منشور',
    backToFeed: 'العودة إلى المنشورات',
    about: 'نبذة',
    platformIdentity: 'هوية المنصة',
    certification: 'الشهادة',
    registeredChildren: 'أطفال مسجلون',
    officialAccount: 'الحساب الرسمي لـ Rawdha+',
    officialVerified: 'الحساب الرسمي الموثّق لـ Rawdha+',
    verifiedBadge: 'شارة التوثيق مفعّلة',
    publish: 'نشر',
    cancel: 'إلغاء',
    comments: 'تعليقات',
    comment: 'تعليق',
    reposts: 'إعادات نشر',
    repost: 'إعادة نشر',
    likes: 'إعجاب',
    commentAction: 'تعليق',
    repostAction: 'إعادة نشر',
    contact: 'للتواصل:',
    masked: 'مخفي',
    hide: 'إخفاء',
    restore: 'إظهار',
    writeComment: 'اكتب تعليقاً...',
    publicProfile: 'الملف العام',
    professionalIdentity: 'أنشئ هويتك المهنية',
    profileHelp: 'عدّل المعلومات التي تظهر عندما يفتح أحدهم ملفك من منشور.',
    collapseForm: 'تصغير النموذج',
    firstName: 'الاسم الأول',
    lastName: 'اللقب',
    daycareName: 'اسم الحضانة',
    profilePhoto: 'الصورة الشخصية',
    daycareLogo: 'شعار الحضانة',
    choosePhoto: 'اختيار صورة',
    chooseLogo: 'اختيار شعار',
    replace: 'استبدال',
    remove: 'حذف',
    city: 'المدينة',
    phone: 'الهاتف',
    website: 'الموقع الإلكتروني',
    presentation: 'نبذة تعريفية',
    saveProfile: 'حفظ الملف',
    saving: 'جارٍ الحفظ...',
    loading: 'جارٍ التحميل...',
    noProfilePresentation: 'لم يضف هذا المدير نبذة تعريفية بعد.',
    addPresentation: 'أضف نبذة مهنية إلى ملفك.',
    noProfilePosts: 'لا توجد منشورات حالياً.',
    follow: 'متابعة',
    following: 'متابَع',
    notifications: 'الإشعارات',
    notificationsEmpty: 'لا توجد إشعارات حالياً.',
    saved: 'المحفوظات',
    savedEmpty: 'لا توجد منشورات محفوظة.',
    messages: 'الرسائل',
    messagePlaceholder: 'اكتب رسالة مهنية...',
    sendMessage: 'إرسال',
    searchProfiles: 'ابحث عن حضانة أو مدير',
    hashtags: 'الكلمات المفتاحية',
    album: 'ألبوم صور',
    poll: 'استطلاع',
    pollQuestion: 'سؤالك',
    pollOption: 'خيار',
    addOption: 'إضافة خيار',
    vote: 'تصويت',
    voted: 'تم تسجيل تصويتك',
    views: 'مشاهدة',
    reach: 'الوصول',
    pinned: 'منشور مثبت',
    pin: 'تثبيت',
    unpin: 'إلغاء التثبيت',
    report: 'إبلاغ',
    reportSent: 'تم إرسال البلاغ',
    discover: 'اكتشف',
    specialties: 'التخصصات',
    hours: 'ساعات العمل',
    services: 'الخدمات',
    classes: 'أقسام',
  },
} as const;

const emptyForm = {
  categorie: 'activite' as CommunityPostCategory,
  titre: '',
  contenu: '',
  ville: '',
  prix: '',
  contact: '',
};

function formatDate(value: string, language: 'fr' | 'ar') {
  try {
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-DZ' : 'fr-DZ', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function categoryLabel(value: CommunityPostCategory, language: 'fr' | 'ar') {
  const item = categories.find(category => category.value === value);
  return language === 'ar' ? item?.ar || value : item?.fr || value;
}

function fullName(user?: Pick<UserAccount, 'prenom' | 'nom' | 'email'> | null) {
  if (!user) return 'Directeur';
  return `${user.prenom || ''} ${user.nom || ''}`.trim() || user.email || 'Directeur';
}

function compressProfileImage(file: File, maxSide = 720): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Choisissez une image JPG, PNG ou WEBP.'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('L’image doit faire moins de 8 Mo.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire cette image.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Cette image ne peut pas être utilisée.'));
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Votre navigateur ne permet pas de préparer cette image.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

type PublicProfile = {
  id: string;
  name: string;
  avatarUrl?: string;
  logoUrl?: string;
  bio?: string;
  nomCreche?: string;
  ville?: string;
  siteWeb?: string;
  telephone?: string;
  specialites?: string[];
  horaires?: string;
  services?: string[];
  classesCount?: number;
  estCertifie?: boolean;
  certificationEnfants?: number;
  isCurrent?: boolean;
  isPlatform?: boolean;
};

function createPlatformProfile(id: string, language: 'fr' | 'ar'): PublicProfile {
  return {
    id,
    name: 'Rawdha+',
    avatarUrl: '/rawdah-logo.png',
    logoUrl: '/rawdah-logo.png',
    bio: language === 'ar'
      ? 'الحساب الرسمي لمنصة Rawdha+ لمرافقة دور الحضانة وتبادل أفضل الممارسات.'
      : 'Le compte officiel de Rawdha+ pour accompagner les crèches et partager les meilleures pratiques.',
    nomCreche: language === 'ar' ? 'Rawdha+ · منصة دور الحضانة' : 'Rawdha+ · Plateforme des crèches',
    ville: language === 'ar' ? 'الجزائر' : 'Algérie',
    estCertifie: true,
    certificationEnfants: 30,
    isCurrent: true,
    isPlatform: true,
  };
}

function Avatar({ profile, size = 'md' }: { profile: PublicProfile; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-9 w-9 text-xs', md: 'h-12 w-12 text-sm', lg: 'h-24 w-24 text-2xl' };
  const initials = profile.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'R+';
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);

  useEffect(() => {
    setAvatarBroken(false);
    setLogoBroken(false);
  }, [profile.avatarUrl, profile.logoUrl]);

  return (
    <div className={`${sizes[size]} relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 font-black text-white shadow-sm`}>
      {profile.avatarUrl && !avatarBroken ? <img src={profile.avatarUrl} alt={profile.name} onError={() => setAvatarBroken(true)} className="h-full w-full object-cover" /> : initials}
      {profile.logoUrl && profile.logoUrl !== profile.avatarUrl && !profile.isPlatform && !logoBroken && <img src={profile.logoUrl} alt="Logo de la crèche" onError={() => setLogoBroken(true)} className="absolute bottom-0 right-0 h-5 w-5 rounded-full border-2 border-white bg-white object-contain" />}
    </div>
  );
}

export default function Community() {
  const { user, creche, updateProfile } = useAuth();
  const { language } = useLanguage();
  const { confirm } = useConfirmDialog();
  const {
    communityPosts,
    communityComments,
    communityReactions,
    communityFeatures,
    enfants,
    comptes,
    addCommunityPost,
    repostCommunityPost,
    updateCommunityPost,
    deleteCommunityPost,
    addCommunityComment,
    deleteCommunityComment,
    toggleCommunityReaction,
    addCommunityFeature,
    updateCommunityFeature,
    deleteCommunityFeature,
  } = useDb();

  const isAr = language === 'ar';
  const ui = isAr ? uiCopy.ar : uiCopy.fr;
  const isAdmin = user?.role === 'admin';
  const registeredChildrenCount = enfants.length;
  const certificationChildrenCount = isAdmin ? 30 : Math.max(registeredChildrenCount, user?.certificationEnfants || 0);
  const isCurrentUserCertified = isAdmin || Boolean(user?.estCertifie) || certificationChildrenCount >= 30;
  const [activeCategory, setActiveCategory] = useState<CommunityPostCategory | 'tous'>('tous');
  const [activeView, setActiveView] = useState<'feed' | 'profile' | 'reposts' | 'saved' | 'notifications' | 'messages'>('feed');
  const [search, setSearch] = useState('');
  const [profileSearch, setProfileSearch] = useState('');
  const [composerMode, setComposerMode] = useState<'post' | 'album' | 'poll'>('post');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [messageDraft, setMessageDraft] = useState('');
  const [messageRecipientId, setMessageRecipientId] = useState<string | null>(null);
  const viewedPostIdsRef = useRef(new Set<string>());
  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileImageUploading, setProfileImageUploading] = useState<'avatar' | 'logo' | null>(null);
  const [profileImageError, setProfileImageError] = useState('');
  const [postImageUrls, setPostImageUrls] = useState<string[]>([]);
  const [postImageError, setPostImageError] = useState('');
  const [profileForm, setProfileForm] = useState({
    prenom: user?.prenom || '',
    nom: user?.nom || '',
    nomCreche: user?.nomCreche || creche?.nom || '',
    telephone: user?.telephone || '',
    ville: user?.ville || '',
    bio: user?.bio || '',
    avatarUrl: user?.avatarUrl || '',
    logoUrl: user?.logoUrl || creche?.logoUrl || '',
    siteWeb: user?.siteWeb || '',
    specialites: user?.specialites?.join(', ') || '',
    horaires: user?.horaires || '',
    services: user?.services?.join(', ') || '',
    classesCount: user?.classesCount ? String(user.classesCount) : '',
  });

  useEffect(() => {
    if (!openMenu) return undefined;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-community-menu]')) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openMenu]);

  useEffect(() => {
    setProfileForm({
      prenom: user?.prenom || '',
      nom: user?.nom || '',
      nomCreche: user?.nomCreche || creche?.nom || '',
      telephone: user?.telephone || '',
      ville: user?.ville || '',
      bio: user?.bio || '',
      avatarUrl: user?.avatarUrl || '',
      logoUrl: user?.logoUrl || creche?.logoUrl || '',
      siteWeb: user?.siteWeb || '',
      specialites: user?.specialites?.join(', ') || '',
      horaires: user?.horaires || '',
      services: user?.services?.join(', ') || '',
      classesCount: user?.classesCount ? String(user.classesCount) : '',
    });
  }, [user, creche?.nom, creche?.logoUrl]);

  const currentProfile: PublicProfile = useMemo(() => {
    if (isAdmin) return createPlatformProfile(user?.id || '', language);
    return {
      id: user?.id || '',
      name: fullName(user),
      avatarUrl: user?.avatarUrl,
      logoUrl: user?.logoUrl || creche?.logoUrl || undefined,
      bio: user?.bio,
      nomCreche: user?.nomCreche || creche?.nom,
      ville: user?.ville,
      siteWeb: user?.siteWeb,
      telephone: user?.telephone,
      specialites: user?.specialites,
      horaires: user?.horaires,
      services: user?.services,
      classesCount: user?.classesCount,
      estCertifie: isCurrentUserCertified,
      certificationEnfants: certificationChildrenCount,
      isCurrent: true,
    };
  }, [user, creche, isAdmin, language, isCurrentUserCertified, certificationChildrenCount]);

  const profileFromAccount = (account: UserAccount, fallback?: CommunityPost): PublicProfile => {
    if (account.role === 'admin') {
      return { ...createPlatformProfile(account.id, language), isCurrent: account.id === user?.id, isPlatform: true };
    }
    return {
      id: account.id,
      name: fullName(account),
      avatarUrl: account.avatarUrl,
      logoUrl: account.logoUrl,
      bio: account.bio,
      nomCreche: account.nomCreche || fallback?.nomCreche,
      ville: account.ville || fallback?.authorVille || fallback?.ville,
      siteWeb: account.siteWeb,
      telephone: account.telephone,
      specialites: account.specialites,
      horaires: account.horaires,
      services: account.services,
      classesCount: account.classesCount,
      estCertifie: Boolean(account.estCertifie) || (account.certificationEnfants || 0) >= 30,
      certificationEnfants: Math.max(account.certificationEnfants || 0, fallback?.authorCertificationEnfants || 0),
    };
  };

  const profileFromPost = (post: CommunityPost): PublicProfile => {
    if (post.authorId === user?.id) return currentProfile;
    const account = comptes.find(item => item.id === post.authorId);
    if (account) return profileFromAccount(account, post);
    return {
      id: post.authorId,
      name: post.authorName || 'Directeur',
      avatarUrl: post.authorAvatarUrl,
      logoUrl: post.authorLogoUrl,
      bio: post.authorBio,
      nomCreche: post.nomCreche,
      ville: post.authorVille || post.ville,
      siteWeb: post.authorSiteWeb,
      estCertifie: post.authorEstCertifie,
      certificationEnfants: post.authorCertificationEnfants,
      isPlatform: account?.role === 'admin' || post.authorName === 'Rawdha+' || post.authorLogoUrl === '/rawdah-logo.png',
    };
  };

  const profiles = useMemo(() => {
    const map = new Map<string, PublicProfile>();
    comptes.filter(account => account.role === 'directeur').forEach(account => {
      map.set(account.id, account.id === user?.id ? currentProfile : profileFromAccount(account));
    });
    if (user?.id) map.set(user.id, currentProfile);
    communityPosts.forEach(post => {
      if (!map.has(post.authorId)) map.set(post.authorId, profileFromPost(post));
    });
    return Array.from(map.values());
  }, [comptes, communityPosts, currentProfile, user?.id, language]);

  const selectedProfile = selectedProfileId ? profiles.find(profile => profile.id === selectedProfileId) || null : null;
  const selectedProfilePosts = selectedProfile ? communityPosts.filter(post => post.authorId === selectedProfile.id) : [];
  const followingIds = useMemo(() => new Set(communityFeatures.filter(feature => feature.kind === 'follow' && feature.actorId === user?.id).map(feature => feature.targetId).filter(Boolean)), [communityFeatures, user?.id]);
  const savedPostIds = useMemo(() => new Set(communityFeatures.filter(feature => feature.kind === 'saved_post' && feature.actorId === user?.id).map(feature => feature.targetId).filter(Boolean)), [communityFeatures, user?.id]);
  const pinnedPostIds = useMemo(() => new Set(communityFeatures.filter(feature => feature.kind === 'pin').map(feature => feature.targetId).filter(Boolean)), [communityFeatures]);
  const unreadSocialNotifications = useMemo(() => communityFeatures.filter(feature => feature.kind === 'social_notification' && feature.recipientId === user?.id && feature.payload?.read !== true), [communityFeatures, user?.id]);
  const featureFor = (kind: CommunityFeature['kind'], targetId: string, actorId = user?.id) => communityFeatures.find(feature => feature.kind === kind && feature.targetId === targetId && feature.actorId === actorId);
  const featuresFor = (kind: CommunityFeature['kind'], targetId: string) => communityFeatures.filter(feature => feature.kind === kind && feature.targetId === targetId);

  const filteredProfiles = useMemo(() => {
    const normalized = profileSearch.trim().toLowerCase();
    return profiles.filter(profile => {
      if (!normalized) return true;
      return [profile.name, profile.nomCreche, profile.ville, profile.bio].filter(Boolean).some(value => String(value).toLowerCase().includes(normalized));
    });
  }, [profiles, profileSearch]);

  const filteredPosts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return [...communityPosts]
      .filter(post => isAdmin || post.statut !== 'masquee')
      .filter(post => activeCategory === 'tous' || post.categorie === activeCategory)
      .filter(post => activeView !== 'profile' || post.authorId === (selectedProfileId || user?.id))
      .filter(post => activeView !== 'reposts' || (Boolean(post.originalPostId) && post.authorId === user?.id))
      .filter(post => {
        if (!normalizedSearch) return true;
        return [post.authorName, post.nomCreche, post.titre, post.contenu, post.ville]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => Number(pinnedPostIds.has(b.id)) - Number(pinnedPostIds.has(a.id)) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [communityPosts, activeCategory, activeView, search, selectedProfileId, user?.id, isAdmin, pinnedPostIds]);

  useEffect(() => {
    if (!user || (!isAdmin && user.role !== 'directeur') || activeView !== 'feed') return;
    filteredPosts.slice(0, 8).forEach(post => {
      if (post.authorId === user.id || viewedPostIdsRef.current.has(post.id)) return;
      viewedPostIdsRef.current.add(post.id);
      void addCommunityFeature({ kind: 'post_view', actorId: user.id, targetId: post.id, visibility: 'public', createdAt: new Date().toISOString() }).catch(() => viewedPostIdsRef.current.delete(post.id));
    });
  }, [activeView, addCommunityFeature, filteredPosts, isAdmin, user]);

  useEffect(() => {
    if (!user || activeView !== 'messages' || !messageRecipientId) return;
    const unreadConversationMessages = communityFeatures.filter(feature => feature.kind === 'private_message' && feature.recipientId === user.id && feature.actorId === messageRecipientId && feature.payload?.read !== true);
    unreadConversationMessages.forEach(feature => {
      void updateCommunityFeature(feature.id, { payload: { ...feature.payload, read: true } });
    });
  }, [activeView, communityFeatures, messageRecipientId, updateCommunityFeature, user]);

  if (!user || (!isAdmin && user.role !== 'directeur')) return null;

  const canManagePost = (post: CommunityPost) => isAdmin || post.authorId === user.id;
  const authorName = currentProfile.name;
  const crecheName = currentProfile.nomCreche || user.nomCreche || creche?.nom || (isAr ? 'روضة' : 'Crèche');

  const openComposer = () => {
    setOpenMenu(null);
    setShowComposer(true);
    window.requestAnimationFrame(() => document.getElementById('community-inline-composer')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const handlePostImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files: File[] = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';
    if (!files.length) return;
    setPostImageError('');
    const remainingSlots = Math.max(0, 6 - postImageUrls.length);
    if (!remainingSlots) {
      setPostImageError(isAr ? 'يمكنك إضافة 6 صور كحد أقصى.' : 'Vous pouvez ajouter 6 photos maximum.');
      return;
    }
    try {
      const selectedFiles = files.slice(0, remainingSlots);
      const dataUrls = await Promise.all(selectedFiles.map(file => compressProfileImage(file, 1280)));
      setPostImageUrls(current => [...current, ...dataUrls].slice(0, 6));
      if (files.length > selectedFiles.length) setPostImageError(isAr ? 'تم الاحتفاظ بأول 6 صور فقط.' : 'Seules les 6 premières photos ont été conservées.');
    } catch (error) {
      setPostImageError(error instanceof Error ? error.message : (isAr ? 'تعذر تحميل هذه الصورة.' : 'Impossible de charger cette image.'));
    }
  };

  const handleProfileImageUpload = async (event: ChangeEvent<HTMLInputElement>, field: 'avatarUrl' | 'logoUrl') => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProfileImageError('');
    setProfileImageUploading(field === 'avatarUrl' ? 'avatar' : 'logo');
    try {
      const dataUrl = await compressProfileImage(file, field === 'avatarUrl' ? 720 : 640);
      setProfileForm(current => ({ ...current, [field]: dataUrl }));
    } catch (error) {
      setProfileImageError(error instanceof Error ? error.message : 'Impossible de charger cette image.');
    } finally {
      setProfileImageUploading(null);
    }
  };

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (profileSaving) return;
    setProfileSaving(true);
    try {
      await updateProfile({
        prenom: profileForm.prenom.trim(),
        nom: profileForm.nom.trim(),
        nomCreche: profileForm.nomCreche.trim() || undefined,
        telephone: profileForm.telephone.trim() || undefined,
        ville: profileForm.ville.trim() || undefined,
        bio: profileForm.bio.trim() || undefined,
        avatarUrl: profileForm.avatarUrl.trim() || undefined,
        logoUrl: profileForm.logoUrl.trim() || undefined,
        siteWeb: profileForm.siteWeb.trim() || undefined,
        specialites: profileForm.specialites.split(',').map(item => item.trim()).filter(Boolean),
        horaires: profileForm.horaires.trim() || undefined,
        services: profileForm.services.split(',').map(item => item.trim()).filter(Boolean),
        classesCount: profileForm.classesCount.trim() ? Number(profileForm.classesCount) : undefined,
      });
      setActiveView('profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSubmitPost = async (event: FormEvent) => {
    event.preventDefault();
    const validPollOptions = pollOptions.map(option => option.trim()).filter(Boolean);
    if (!form.contenu.trim() || submitting) return;
    if (composerMode === 'poll' && (!pollQuestion.trim() || validPollOptions.length < 2)) {
      setPostImageError(isAr ? 'أضف السؤال وخيارين على الأقل.' : 'Ajoutez une question et au moins deux options.');
      return;
    }
    setSubmitting(true);
    try {
      const hashtags = Array.from(new Set(form.contenu.match(/#[\\p{L}\\p{N}_-]+/gu) || [])).slice(0, 8);
      await addCommunityPost({
        authorId: user.id,
        authorName,
        authorAvatarUrl: currentProfile.avatarUrl,
        authorLogoUrl: currentProfile.logoUrl,
        authorBio: currentProfile.bio,
        authorVille: currentProfile.ville,
        authorSiteWeb: currentProfile.siteWeb,
        authorEstCertifie: currentProfile.estCertifie,
        authorCertificationEnfants: currentProfile.certificationEnfants,
        crecheId: user.id,
        nomCreche: crecheName,
        categorie: form.categorie,
        titre: form.titre.trim() || undefined,
        contenu: form.contenu.trim(),
        ville: form.ville.trim() || user.ville || undefined,
        imageUrls: postImageUrls.length ? postImageUrls : undefined,
        hashtags: hashtags.length ? hashtags : undefined,
        poll: composerMode === 'poll' ? { question: pollQuestion.trim(), options: validPollOptions, votes: {}, voterIds: [] } : undefined,
        prix: form.prix.trim() ? Number(form.prix) : undefined,
        contact: form.contact.trim() || undefined,
        statut: 'publie',
        likesCount: 0,
        createdAt: new Date().toISOString(),
      });
      setForm(emptyForm);
      setPostImageUrls([]);
      setPollQuestion('');
      setPollOptions(['', '']);
      setComposerMode('post');
      setPostImageError('');
      setShowComposer(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async (post: CommunityPost) => {
    const accepted = await confirm({
      title: isAr ? 'حذف المنشور' : 'Supprimer la publication',
      message: isAr ? 'هل تريد حذف هذا المنشور نهائياً؟' : 'Voulez-vous supprimer définitivement cette publication ?',
      confirmLabel: isAr ? 'حذف' : 'Supprimer',
      cancelLabel: ui.cancel,
      variant: 'danger',
    });
    if (!accepted || submitting) return;
    setSubmitting(true);
    try {
      await deleteCommunityPost(post.id);
      setOpenMenu(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (comment: CommunityComment) => {
    const accepted = await confirm({
      title: isAr ? 'حذف التعليق' : 'Supprimer le commentaire',
      message: isAr ? 'هل تريد حذف هذا التعليق نهائياً؟' : 'Voulez-vous supprimer définitivement ce commentaire ?',
      confirmLabel: isAr ? 'حذف' : 'Supprimer',
      cancelLabel: ui.cancel,
      variant: 'danger',
    });
    if (!accepted || submitting) return;
    setSubmitting(true);
    try {
      await deleteCommunityComment(comment.id);
    } finally {
      setSubmitting(false);
    }
  };

  const handleComment = async (post: CommunityPost) => {
    const content = (commentDrafts[post.id] || '').trim();
    if (!content || submitting) return;
    setSubmitting(true);
    try {
      await addCommunityComment({
        postId: post.id,
        authorId: user.id,
        authorName,
        authorAvatarUrl: currentProfile.avatarUrl,
        authorLogoUrl: currentProfile.logoUrl,
        authorBio: currentProfile.bio,
        crecheId: user.id,
        nomCreche: crecheName,
        contenu: content,
        createdAt: new Date().toISOString(),
      });
      if (post.authorId !== user.id) {
        void addCommunityFeature({ kind: 'social_notification', actorId: user.id, recipientId: post.authorId, visibility: 'private', targetId: post.id, createdAt: new Date().toISOString(), payload: { type: 'comment', actorName: authorName, message: isAr ? 'علّق على منشورك' : 'a commenté votre publication' } }).catch(() => undefined);
      }
      setCommentDrafts(current => ({ ...current, [post.id]: '' }));
      setExpandedComments(current => ({ ...current, [post.id]: true }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRepost = async (post: CommunityPost) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await repostCommunityPost(post);
      if (post.authorId !== user.id) {
        void addCommunityFeature({ kind: 'social_notification', actorId: user.id, recipientId: post.authorId, visibility: 'private', targetId: post.id, createdAt: new Date().toISOString(), payload: { type: 'repost', actorName: authorName, message: isAr ? 'أعاد نشر منشورك' : 'a republié votre publication' } }).catch(() => undefined);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleFollow = async (profile: PublicProfile) => {
    if (profile.id === user.id || profile.isPlatform && isAdmin) return;
    const existing = featureFor('follow', profile.id);
    if (existing) await deleteCommunityFeature(existing.id);
    else {
      await addCommunityFeature({ kind: 'follow', actorId: user.id, targetId: profile.id, visibility: 'private', createdAt: new Date().toISOString() });
      void addCommunityFeature({ kind: 'social_notification', actorId: user.id, recipientId: profile.id, visibility: 'private', targetId: profile.id, createdAt: new Date().toISOString(), payload: { type: 'follow', actorName: authorName, message: isAr ? 'يتابع ملفك' : 'vous suit maintenant' } }).catch(() => undefined);
    }
  };

  const handleToggleSave = async (post: CommunityPost) => {
    const existing = featureFor('saved_post', post.id);
    if (existing) await deleteCommunityFeature(existing.id);
    else await addCommunityFeature({ kind: 'saved_post', actorId: user.id, targetId: post.id, visibility: 'private', createdAt: new Date().toISOString() });
  };

  const handlePin = async (post: CommunityPost) => {
    if (!isAdmin) return;
    const existing = communityFeatures.find(feature => feature.kind === 'pin' && feature.targetId === post.id);
    if (existing) await deleteCommunityFeature(existing.id);
    else await addCommunityFeature({ kind: 'pin', actorId: user.id, targetId: post.id, visibility: 'public', createdAt: new Date().toISOString() });
    setOpenMenu(null);
  };

  const handleReport = async (post: CommunityPost) => {
    if (featureFor('report', post.id)) return;
    await addCommunityFeature({ kind: 'report', actorId: user.id, targetId: post.id, visibility: 'private', createdAt: new Date().toISOString(), payload: { reason: isAr ? 'محتوى يحتاج إلى مراجعة' : 'Contenu à examiner' } });
    setOpenMenu(null);
  };

  const handlePollVote = async (post: CommunityPost, optionIndex: number) => {
    if (!post.poll || featureFor('poll_vote', post.id)) return;
    await addCommunityFeature({ kind: 'poll_vote', actorId: user.id, targetId: post.id, visibility: 'public', createdAt: new Date().toISOString(), payload: { optionIndex } });
  };

  const handleSendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const content = messageDraft.trim();
    if (!content || !messageRecipientId || submitting) return;
    setSubmitting(true);
    try {
      await addCommunityFeature({ kind: 'private_message', actorId: user.id, recipientId: messageRecipientId, visibility: 'private', createdAt: new Date().toISOString(), payload: { content, read: false } });
      setMessageDraft('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReaction = async (post: CommunityPost) => {
    const wasLiked = isLiked(post.id);
    await toggleCommunityReaction(post.id);
    if (!wasLiked && post.authorId !== user.id) {
      void addCommunityFeature({ kind: 'social_notification', actorId: user.id, recipientId: post.authorId, visibility: 'private', targetId: post.id, createdAt: new Date().toISOString(), payload: { type: 'reaction', actorName: authorName, message: isAr ? 'أعجب بمنشورك' : 'a aimé votre publication' } }).catch(() => undefined);
    }
  };

  const getPostComments = (postId: string) => communityComments
    .filter(comment => comment.postId === postId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const isLiked = (postId: string) => communityReactions.some(reaction => reaction.postId === postId && reaction.userId === user.id);
  const reactionCount = (postId: string) => communityReactions.filter(reaction => reaction.postId === postId).length;

  const renderPost = (post: CommunityPost) => {
    const profile = profileFromPost(post);
    const comments = getPostComments(post.id);
    const original = post.originalPost;
    const originalProfile: PublicProfile | null = original
      ? profiles.find(profile => profile.id === original.authorId) || {
          id: original.authorId || '',
          name: original.authorName || 'Directeur',
          avatarUrl: original.authorAvatarUrl,
          logoUrl: original.authorLogoUrl,
          nomCreche: original.nomCreche,
          isPlatform: original.authorName === 'Rawdha+' || original.authorLogoUrl === '/rawdah-logo.png',
          estCertifie: original.authorEstCertifie,
          certificationEnfants: original.authorCertificationEnfants,
        }
      : null;
    const category = categories.find(item => item.value === post.categorie);
    const pollVoteFeatures = featuresFor('poll_vote', post.id);
    const pollVoteCounts = post.poll?.options.map((_, optionIndex) => pollVoteFeatures.filter(feature => Number(feature.payload?.optionIndex) === optionIndex).length) || [];
    const hasVoted = Boolean(featureFor('poll_vote', post.id));
    const postViewCount = featuresFor('post_view', post.id).length;
    return (
      <article key={post.id} className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
        {pinnedPostIds.has(post.id) && <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-2.5 text-xs font-black text-amber-700"><Pin className="h-3.5 w-3.5" />{ui.pinned}</div>}
        {post.originalPostId && <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500"><Repeat2 className="h-4 w-4 text-indigo-600" />{post.authorName} {isAr ? 'أعاد النشر' : 'a republié une publication'}</div>}
        <div className="p-4 sm:p-5">
          <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
            <button type="button" onClick={() => { setSelectedProfileId(profile.id); setActiveView('profile'); }} className="flex min-w-0 items-center gap-3 text-left">
              <Avatar profile={profile} size="md" />
              <span className="min-w-0">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5 break-words text-sm font-black text-slate-900 hover:text-indigo-700">{profile.name}{profile.estCertifie ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-700"><Check className="h-3 w-3" />{profile.isPlatform ? ui.officialAccount : ui.verifiedBadge}</span> : <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-500">{isAr ? 'قيد التحقق' : 'En cours'}</span>}</span>
                <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1 text-xs font-semibold text-slate-500"><Building2 className="h-3.5 w-3.5 shrink-0" /><span className="break-words">{profile.nomCreche || (isAr ? 'حضانة' : 'Crèche')}{profile.ville ? ` · ${profile.ville}` : ''}</span></span>
                <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-[11px] text-slate-400"><Clock3 className="h-3 w-3 shrink-0" />{formatDate(post.createdAt, language)}</span>
              </span>
            </button>
            <div className="relative" data-community-menu>
              <button type="button" onClick={() => setOpenMenu(openMenu === post.id ? null : post.id)} aria-haspopup="menu" aria-expanded={openMenu === post.id} aria-label={isAr ? 'خيارات المنشور' : 'Options de la publication'} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><MoreHorizontal className="h-5 w-5" /></button>
              {openMenu === post.id && <div role="menu" aria-label={isAr ? 'خيارات المنشور' : 'Options de la publication'} className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {canManagePost(post) && <button type="button" onClick={() => { void handleDeletePost(post); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" />{isAr ? 'حذف' : 'Supprimer'}</button>}
                <button type="button" onClick={() => { void handleToggleSave(post); setOpenMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50"><Bookmark className={`h-4 w-4 ${savedPostIds.has(post.id) ? 'fill-current text-indigo-600' : ''}`} />{savedPostIds.has(post.id) ? ui.saved : (isAr ? 'حفظ المنشور' : 'Enregistrer')}</button>
                {isAdmin && <button type="button" onClick={() => { void handlePin(post); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50"><Pin className="h-4 w-4" />{pinnedPostIds.has(post.id) ? ui.unpin : ui.pin}</button>}
                {!isAdmin && post.authorId !== user.id && <button type="button" onClick={() => { void handleReport(post); }} disabled={Boolean(featureFor('report', post.id))} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><Flag className="h-4 w-4" />{featureFor('report', post.id) ? ui.reportSent : ui.report}</button>}
                {isAdmin && <button type="button" onClick={() => { setOpenMenu(null); void updateCommunityPost(post.id, { statut: post.statut === 'masquee' ? 'publie' : 'masquee' }); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50"><ShieldCheck className="h-4 w-4" />{post.statut === 'masquee' ? ui.restore : ui.hide}</button>}
              </div>}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${category?.color || 'bg-slate-100 text-slate-700'}`}><Tag className="mr-1 inline h-3 w-3" />{categoryLabel(post.categorie, language)}</span>{post.statut === 'masquee' && <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-black text-rose-700">{ui.masked}</span>}</div>
          {post.titre && <h3 className="mt-3 break-words text-lg font-black text-slate-900">{post.titre}</h3>}
          {post.contenu && <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-7 text-slate-700">{post.contenu}</p>}
          {post.hashtags?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{post.hashtags.map(tag => <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-black text-indigo-700"><Hash className="h-3 w-3" />{tag}</span>)}</div> : null}
          {post.imageUrls?.length ? <div className={`mt-4 grid gap-2 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-1 ${post.imageUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>{post.imageUrls.slice(0, 6).map((url, index) => <img key={`${url.slice(0, 24)}-${index}`} src={url} alt={`${post.titre || (isAr ? 'صورة المنشور' : 'Image de la publication')} ${index + 1}`} className={`w-full object-cover ${post.imageUrls && post.imageUrls.length === 1 ? 'max-h-[520px]' : 'h-48'}`} loading="lazy" />)}</div> : null}
          {post.poll && <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4"><div className="flex items-center gap-2 text-xs font-black text-indigo-700"><BarChart3 className="h-4 w-4" />{ui.poll}</div><p className="mt-2 text-sm font-black text-slate-800">{post.poll.question}</p><div className="mt-3 space-y-2">{post.poll.options.map((option, optionIndex) => { const votes = pollVoteCounts[optionIndex] || 0; const totalVotes = pollVoteCounts.reduce((sum, count) => sum + count, 0); const percentage = totalVotes ? Math.round((votes / totalVotes) * 100) : 0; return <button key={`${post.id}-poll-${optionIndex}`} type="button" disabled={hasVoted} onClick={() => void handlePollVote(post, optionIndex)} className="relative w-full overflow-hidden rounded-xl border border-indigo-100 bg-white px-3 py-2.5 text-left text-xs font-black text-slate-700 disabled:cursor-default"><span className="absolute inset-y-0 left-0 bg-indigo-100/70 transition-all" style={{ width: `${percentage}%` }} /><span className="relative flex items-center justify-between gap-2"><span>{option}</span><span className="text-indigo-700">{percentage}%</span></span></button>; })}</div>{hasVoted && <p className="mt-3 text-[11px] font-bold text-indigo-700">{ui.voted}</p>}</div>}
          {post.contact && <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600"><span className="font-black text-slate-800">{ui.contact} </span>{post.contact}</div>}

          {original && <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex min-w-0 items-center gap-3"><Avatar profile={originalProfile!} size="sm" /><div><p className="text-xs font-black text-slate-800">{original.authorName || (isAr ? 'مدير' : 'Directeur')}</p><p className="text-[11px] font-semibold text-slate-500">{original.nomCreche || (isAr ? 'حضانة' : 'Crèche')}</p></div></div>
            {original.titre && <p className="mt-3 break-words text-sm font-black text-slate-800">{original.titre}</p>}
            <p className="mt-1 break-words whitespace-pre-wrap text-sm leading-6 text-slate-600">{original.contenu || ''}</p>
          </div>}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs font-bold text-slate-400"><span aria-live="polite">{reactionCount(post.id)} {ui.likes}</span><span>{comments.length} {comments.length > 1 ? ui.comments : ui.comment} · {communityPosts.filter(item => item.originalPostId === post.id).length} {communityPosts.filter(item => item.originalPostId === post.id).length > 1 ? ui.reposts : ui.repost}{(isAdmin || post.authorId === user.id) && <span className="ml-1 inline-flex items-center gap-1"><Eye className="h-3 w-3" />{postViewCount} {ui.views}</span>}</span></div>
          <div className="mt-2 grid grid-cols-1 min-[420px]:grid-cols-3 gap-1 border-t border-slate-100 pt-2">
            <button type="button" aria-pressed={isLiked(post.id)} onClick={() => void handleReaction(post)} className={`inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-black transition ${isLiked(post.id) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-700'}`}><ThumbsUp className={`h-4 w-4 ${isLiked(post.id) ? 'fill-current' : ''}`} />{ui.likes}</button>
            <button type="button" onClick={() => setExpandedComments(current => ({ ...current, [post.id]: !current[post.id] }))} className="inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-50 hover:text-indigo-700"><MessageCircle className="h-4 w-4" />{ui.commentAction}</button>
            <button type="button" onClick={() => void handleRepost(post)} disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-50 hover:text-indigo-700 disabled:opacity-50"><Repeat2 className="h-4 w-4" />{ui.repostAction}</button>
          </div>
          <AnimatePresence initial={false}>{expandedComments[post.id] && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3">
            {comments.map(comment => <div key={comment.id} className="flex items-start gap-2 rounded-xl bg-white p-3"><Avatar profile={{ id: comment.authorId, name: comment.authorName, avatarUrl: comment.authorAvatarUrl, logoUrl: comment.authorLogoUrl, nomCreche: comment.nomCreche }} size="sm" /><div className="min-w-0 flex-1"><p className="text-xs font-black text-slate-800">{comment.authorName}<span className="ml-1 font-medium text-slate-400">· {comment.nomCreche}</span></p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{comment.contenu}</p><p className="mt-1 text-[10px] text-slate-400">{formatDate(comment.createdAt, language)}</p></div>{(isAdmin || comment.authorId === user.id) && <button type="button" onClick={() => void handleDeleteComment(comment)} className="rounded-lg p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>}</div>)}
            <div className="flex items-end gap-2"><Avatar profile={currentProfile} size="sm" /><textarea value={commentDrafts[post.id] || ''} onChange={event => setCommentDrafts(current => ({ ...current, [post.id]: event.target.value }))} rows={1} maxLength={1000} className="min-h-[42px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-indigo-500" placeholder={ui.writeComment} /><button type="button" onClick={() => void handleComment(post)} disabled={!commentDrafts[post.id]?.trim() || submitting} className="rounded-xl bg-indigo-600 p-3 text-white hover:bg-indigo-700 disabled:opacity-40"><Send className="h-4 w-4" /></button></div>
          </div></motion.div>}</AnimatePresence>
        </div>
      </article>
    );
  };
  const renderComposer = () => (
    <motion.section
      id="community-inline-composer"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm sm:p-5"
    >
      <form onSubmit={handleSubmitPost}>
        <div className="flex items-start gap-3">
          <Avatar profile={currentProfile} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-indigo-600">{ui.newPost}</p>
                <h2 className="mt-1 text-base font-black text-slate-900">{isAr ? 'شارك مع شبكتك' : 'Partager avec votre réseau'}</h2>
              </div>
              <button type="button" onClick={() => setShowComposer(false)} className="rounded-xl px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-100">{isAr ? 'إلغاء' : 'Fermer'}</button>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">{crecheName}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-y border-slate-100 py-3" role="tablist" aria-label={isAr ? 'نوع المنشور' : 'Type de publication'}>
          {([['post', isAr ? 'منشور' : 'Publication'], ['album', ui.album], ['poll', ui.poll]] as const).map(([mode, label]) => <button key={mode} type="button" role="tab" aria-selected={composerMode === mode} onClick={() => setComposerMode(mode)} className={`rounded-xl px-3 py-2 text-xs font-black transition ${composerMode === mode ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>{mode === 'album' ? <ImageIcon className="mr-1 inline h-3.5 w-3.5" /> : mode === 'poll' ? <BarChart3 className="mr-1 inline h-3.5 w-3.5" /> : <MessageCircle className="mr-1 inline h-3.5 w-3.5" />}{label}</button>)}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-black text-slate-600">{isAr ? 'الفئة' : 'Catégorie'}
            <select value={form.categorie} onChange={event => setForm(current => ({ ...current, categorie: event.target.value as CommunityPostCategory }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500">
              {categories.filter(item => item.value !== 'tous').map(item => <option key={item.value} value={item.value}>{isAr ? item.ar : item.fr}</option>)}
            </select>
          </label>
          <label className="text-xs font-black text-slate-600">{isAr ? 'العنوان' : 'Titre'}
            <input value={form.titre} onChange={event => setForm(current => ({ ...current, titre: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder={isAr ? 'عنوان المنشور' : 'Titre de votre publication'} />
          </label>
          <label className="text-xs font-black text-slate-600 md:col-span-2">{isAr ? 'رسالتك' : 'Votre message'}
            <textarea required rows={5} maxLength={3000} value={form.contenu} onChange={event => setForm(current => ({ ...current, contenu: event.target.value }))} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 outline-none focus:border-indigo-500" placeholder={isAr ? 'شارك فكرة أو نشاطاً أو فرصة...' : 'Partagez une idée, une activité, une opportunité...'} />
          </label>
          {composerMode === 'poll' && <div className="grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 md:col-span-2"><label className="text-xs font-black text-slate-600">{ui.pollQuestion}<input required value={pollQuestion} onChange={event => setPollQuestion(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder={isAr ? 'مثلاً: ما النشاط المفضل للأطفال؟' : 'Ex. : Quelle activité préfèrent les enfants ?'} /></label>{pollOptions.map((option, index) => <label key={`poll-option-${index}`} className="text-xs font-black text-slate-600">{ui.pollOption} {index + 1}<input required value={option} onChange={event => setPollOptions(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder={`${ui.pollOption} ${index + 1}`} /></label>)}<button type="button" onClick={() => setPollOptions(current => current.length < 4 ? [...current, ''] : current)} disabled={pollOptions.length >= 4} className="justify-self-start rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-black text-indigo-700 disabled:opacity-40">+ {ui.addOption}</button></div>}
          {postImageUrls.length > 0 && <div className="grid grid-cols-2 gap-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2 md:col-span-2">{postImageUrls.map((url, index) => <div key={`${url.slice(0, 24)}-${index}`} className="group relative overflow-hidden rounded-xl"><img src={url} alt={`${isAr ? 'صورة' : 'Photo'} ${index + 1}`} className="h-32 w-full object-cover" /><button type="button" onClick={() => setPostImageUrls(current => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-2 top-2 rounded-full bg-slate-950/75 p-2 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100" aria-label={isAr ? 'حذف الصورة' : 'Supprimer la photo'}><X className="h-4 w-4" /></button></div>)}</div>}
          {postImageError && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 md:col-span-2" role="alert">{postImageError}</p>}
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-black text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 md:col-span-2"><ImageIcon className="h-4 w-4 text-emerald-500" />{composerMode === 'album' ? ui.album : (isAr ? 'إضافة صورة' : 'Ajouter une photo')}<input type="file" accept="image/png,image/jpeg,image/webp" multiple={composerMode === 'album'} className="sr-only" onChange={event => void handlePostImageUpload(event)} /></label>
          <label className="text-xs font-black text-slate-600">{ui.city}<input value={form.ville} onChange={event => setForm(current => ({ ...current, ville: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder="Alger" /></label>
          <label className="text-xs font-black text-slate-600">{ui.contact}<input value={form.contact} onChange={event => setForm(current => ({ ...current, contact: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder={isAr ? 'هاتف أو رابط' : 'Téléphone ou lien'} /></label>
        </div>
        <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setShowComposer(false)} className="rounded-xl px-4 py-3 text-sm font-black text-slate-500 hover:bg-slate-100">{ui.cancel}</button>
          <button type="submit" disabled={submitting || !form.contenu.trim()} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? (isAr ? 'جارٍ النشر...' : 'Publication...') : ui.publish}</button>
        </div>
      </form>
    </motion.section>
  );

  const renderProfileEditor = () => (
    <motion.section
      initial={{ opacity: 0, height: 0, y: -12 }}
      animate={{ opacity: 1, height: 'auto', y: 0 }}
      exit={{ opacity: 0, height: 0, y: -12 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="mb-5 min-w-0 overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm"
    >
      <form onSubmit={handleSaveProfile} className="p-4 sm:p-5 md:p-7">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-indigo-600">{ui.publicProfile}</p>
            <h2 className="mt-1 text-xl sm:text-2xl font-black text-slate-900">{ui.professionalIdentity}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{ui.profileHelp}</p>
          </div>
          <button type="button" onClick={() => setShowProfileEditor(false)} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
            <ChevronDown className="h-4 w-4 rotate-180" />
            {ui.collapseForm}
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-xs font-black text-slate-600">{ui.firstName}<input required value={profileForm.prenom} onChange={event => setProfileForm(current => ({ ...current, prenom: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" /></label>
          <label className="text-xs font-black text-slate-600">{ui.lastName}<input required value={profileForm.nom} onChange={event => setProfileForm(current => ({ ...current, nom: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" /></label>
          <label className="text-xs font-black text-slate-600 md:col-span-2">{ui.daycareName}<input value={profileForm.nomCreche} onChange={event => setProfileForm(current => ({ ...current, nomCreche: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" /></label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-16 w-16 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 text-center text-xl font-black leading-[4rem] text-white">{profileForm.avatarUrl ? <img src={profileForm.avatarUrl} alt="Aperçu de la photo de profil" className="h-full w-full object-cover" /> : `${profileForm.prenom?.[0] || ''}${profileForm.nom?.[0] || ''}`.toUpperCase() || 'R+'}</div>
              <div className="min-w-0 flex-1"><p className="text-xs font-black text-slate-700">{ui.profilePhoto}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">JPG, PNG ou WEBP. L’image est optimisée automatiquement.</p><div className="mt-2 flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-black text-white hover:bg-indigo-700"><ImageIcon className="h-3.5 w-3.5" />{profileImageUploading === 'avatar' ? ui.loading : profileForm.avatarUrl ? ui.replace : ui.choosePhoto}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => void handleProfileImageUpload(event, 'avatarUrl')} disabled={profileImageUploading !== null} /></label>{profileForm.avatarUrl && <button type="button" onClick={() => setProfileForm(current => ({ ...current, avatarUrl: '' }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 hover:bg-slate-100">{ui.remove}</button>}</div></div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-white shadow-sm">{profileForm.logoUrl ? <img src={profileForm.logoUrl} alt="Aperçu du logo de la crèche" className="h-full w-full object-contain" /> : <Building2 className="h-7 w-7 text-slate-300" />}</div>
              <div className="min-w-0 flex-1"><p className="text-xs font-black text-slate-700">{ui.daycareLogo}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">Ajoutez le logo visible sur votre profil et vos publications.</p><div className="mt-2 flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[11px] font-black text-white hover:bg-violet-700"><Building2 className="h-3.5 w-3.5" />{profileImageUploading === 'logo' ? ui.loading : profileForm.logoUrl ? ui.replace : ui.chooseLogo}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => void handleProfileImageUpload(event, 'logoUrl')} disabled={profileImageUploading !== null} /></label>{profileForm.logoUrl && <button type="button" onClick={() => setProfileForm(current => ({ ...current, logoUrl: '' }))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 hover:bg-slate-100">{ui.remove}</button>}</div></div>
            </div>
          </div>

          {profileImageError && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 md:col-span-2" role="alert">{profileImageError}</p>}
          <label className="text-xs font-black text-slate-600">{ui.city}<input value={profileForm.ville} onChange={event => setProfileForm(current => ({ ...current, ville: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" /></label>
          <label className="text-xs font-black text-slate-600">{ui.phone}<input value={profileForm.telephone} onChange={event => setProfileForm(current => ({ ...current, telephone: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" /></label>
          <label className="text-xs font-black text-slate-600 md:col-span-2">{ui.website}<input value={profileForm.siteWeb} onChange={event => setProfileForm(current => ({ ...current, siteWeb: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder="https://..." /></label>
          <label className="text-xs font-black text-slate-600">{ui.specialties}<input value={profileForm.specialites} onChange={event => setProfileForm(current => ({ ...current, specialites: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder={isAr ? 'مونتيسوري، لغة، فنون' : 'Montessori, langage, arts'} /></label>
          <label className="text-xs font-black text-slate-600">{ui.hours}<input value={profileForm.horaires} onChange={event => setProfileForm(current => ({ ...current, horaires: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder={isAr ? 'الأحد - الخميس، 08:00 - 17:00' : 'Dimanche - jeudi, 08:00 - 17:00'} /></label>
          <label className="text-xs font-black text-slate-600">{ui.services}<input value={profileForm.services} onChange={event => setProfileForm(current => ({ ...current, services: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder={isAr ? 'نقل، وجبات، أنشطة' : 'Transport, repas, activités'} /></label>
          <label className="text-xs font-black text-slate-600">{isAr ? 'عدد الأقسام' : 'Nombre de classes'}<input type="number" min="0" max="99" value={profileForm.classesCount} onChange={event => setProfileForm(current => ({ ...current, classesCount: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder="4" /></label>
          <label className="text-xs font-black text-slate-600 md:col-span-2">{ui.presentation}<textarea rows={4} maxLength={500} value={profileForm.bio} onChange={event => setProfileForm(current => ({ ...current, bio: event.target.value }))} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 outline-none focus:border-indigo-500" placeholder="Présentez votre parcours et votre crèche..." /></label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setShowProfileEditor(false)} className="rounded-xl px-4 py-3 text-sm font-black text-slate-500 hover:bg-slate-100">{ui.cancel}</button>
          <button type="submit" disabled={profileSaving} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50">{profileSaving ? ui.saving : ui.saveProfile}</button>
        </div>
      </form>
    </motion.section>
  );

  const renderPublicProfile = (profile: PublicProfile) => {
    const profilePosts = communityPosts
      .filter(post => post.authorId === profile.id && (isAdmin || post.statut !== 'masquee'))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const repostCount = profilePosts.filter(post => Boolean(post.originalPostId)).length;
    const isOwnProfile = profile.id === user.id;
    const childCount = Math.min(profile.certificationEnfants || 0, 30);

    return (
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 space-y-5">
        <div className="overflow-hidden rounded-3xl border border-slate-200 border-t-4 border-t-indigo-600 bg-white shadow-sm">
          <div className="px-4 pb-5 pt-6 sm:px-5 sm:pb-6 md:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4"><div className="shrink-0 rounded-full bg-white p-1 shadow-lg ring-2 ring-indigo-100"><Avatar profile={profile} size="lg" /></div><div className="min-w-0 flex-1 pt-1"><div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center"><h2 className="min-w-0 break-words text-lg leading-tight sm:text-xl font-black text-slate-900">{profile.name}</h2>{profile.estCertifie ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700"><Check className="h-3 w-3" />{profile.isPlatform ? ui.officialAccount : (isAr ? 'حضانة موثّقة' : 'Crèche certifiée')}</span> : <span className="inline-flex shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">{isAr ? 'التحقق قيد التقدم' : 'Certification en cours'}</span>}</div><p className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-sm font-semibold text-slate-500"><Building2 className="h-4 w-4 shrink-0" /><span className="break-words">{profile.nomCreche || (isAr ? 'حضانة' : 'Crèche')}{profile.ville ? ` · ${profile.ville}` : ''}</span></p></div></div>
              <div className="flex flex-wrap gap-2">
                {!isOwnProfile && !profile.isPlatform && <button type="button" onClick={() => void handleToggleFollow(profile)} className={`rounded-xl px-4 py-2.5 text-xs font-black ${followingIds.has(profile.id) ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>{followingIds.has(profile.id) ? <><UserCheck className="mr-1 inline h-3.5 w-3.5" />{ui.following}</> : <><UserPlus className="mr-1 inline h-3.5 w-3.5" />{ui.follow}</>}</button>}
                {isOwnProfile && !profile.isPlatform && <button type="button" onClick={() => setShowProfileEditor(true)} className="self-stretch rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-50 sm:self-auto">{ui.myProfile}</button>}
              </div>
            </div>
            <div className="mt-5 grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_260px]"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h3 className="text-sm font-black text-slate-900">{ui.about}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{profile.bio || ui.noProfilePresentation}</p><div className="mt-4 space-y-2 text-xs font-semibold text-slate-500">{profile.ville && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-500" />{profile.ville}</p>}{profile.telephone && <p className="flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-indigo-500" />{profile.telephone}</p>}{profile.siteWeb && <a href={profile.siteWeb} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline"><Globe2 className="h-4 w-4" />{profile.siteWeb}</a>}{profile.horaires && <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-indigo-500" />{profile.horaires}</p>}{profile.classesCount !== undefined && <p className="flex items-center gap-2"><Building2 className="h-4 w-4 text-indigo-500" />{profile.classesCount} {ui.classes}</p>}{profile.specialites?.length ? <div><p className="mb-1 font-black text-slate-600">{ui.specialties}</p><div className="flex flex-wrap gap-1.5">{profile.specialites.map(item => <span key={item} className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-black text-indigo-700">{item}</span>)}</div></div> : null}{profile.services?.length ? <div><p className="mb-1 font-black text-slate-600">{ui.services}</p><div className="flex flex-wrap gap-1.5">{profile.services.map(item => <span key={item} className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">{item}</span>)}</div></div> : null}</div></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{profile.isPlatform ? ui.platformIdentity : ui.certification}</p><p className="mt-3 text-2xl font-black text-slate-900">{childCount} / 30</p><p className="text-xs font-semibold text-slate-500">{ui.registeredChildren}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className={`h-full rounded-full ${profile.estCertifie ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, (childCount / 30) * 100)}%` }} /></div><p className="mt-4 text-xs font-semibold text-slate-500">{profile.isPlatform ? ui.officialVerified : profile.estCertifie ? ui.verifiedBadge : (isAr ? `أضف ${Math.max(0, 30 - childCount)} طفلاً للحصول على الشارة` : `Encore ${Math.max(0, 30 - childCount)} enfant${30 - childCount > 1 ? 's' : ''} pour obtenir le badge`)}</p><p className="mt-4 text-2xl font-black text-slate-900">{profilePosts.length}</p><p className="text-xs font-semibold text-slate-500">{profilePosts.length} {isAr ? 'منشور' : `publication${profilePosts.length > 1 ? 's' : ''}`}</p><p className="mt-4 text-2xl font-black text-slate-900">{repostCount}</p><p className="text-xs font-semibold text-slate-500">{repostCount} {repostCount > 1 ? ui.reposts : ui.repost}</p></div></div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">{isAr ? `منشورات ${profile.name}` : `Publications de ${profile.name}`}</h2><p className="text-xs text-slate-500">{profilePosts.length} {isAr ? 'منشور' : `publication${profilePosts.length > 1 ? 's' : ''}`}</p></div><button type="button" onClick={() => { setSelectedProfileId(null); setActiveView('feed'); }} className="text-xs font-black text-indigo-600 hover:underline">{ui.backToFeed}</button></div>
        <div className="space-y-4">{profilePosts.length ? profilePosts.map(renderPost) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{ui.noProfilePosts}</div>}</div>
      </motion.section>
    );
  };

  const renderSocialUtilityView = () => {
    if (activeView === 'saved') {
      const savedPosts = communityPosts.filter(post => savedPostIds.has(post.id));
      return <section className="min-w-0 space-y-4"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><Bookmark className="h-5 w-5 text-indigo-600" /><div><h2 className="text-lg font-black text-slate-900">{ui.saved}</h2><p className="text-xs font-semibold text-slate-500">{savedPosts.length} {isAr ? 'منشور محفوظ' : `publication${savedPosts.length > 1 ? 's' : ''} enregistrée${savedPosts.length > 1 ? 's' : ''}`}</p></div></div></div>{savedPosts.length ? savedPosts.map(renderPost) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{ui.savedEmpty}</div>}</section>;
    }
    if (activeView === 'notifications') {
      const notifications = communityFeatures.filter(feature => feature.kind === 'social_notification' && feature.recipientId === user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return <section className="min-w-0 space-y-4"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><BellRing className="h-5 w-5 text-indigo-600" /><div><h2 className="text-lg font-black text-slate-900">{ui.notifications}</h2><p className="text-xs font-semibold text-slate-500">{unreadSocialNotifications.length} {isAr ? 'غير مقروء' : 'non lue(s)'}</p></div></div></div>{notifications.length ? notifications.map(notification => <button type="button" key={notification.id} onClick={() => notification.payload?.read !== true && void updateCommunityFeature(notification.id, { payload: { ...notification.payload, read: true } })} className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left shadow-sm transition ${notification.payload?.read === true ? 'border-slate-200 bg-white' : 'border-indigo-100 bg-indigo-50/50'}`}><BellRing className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" /><span className="min-w-0 flex-1"><span className="block text-sm font-black text-slate-800">{String(notification.payload?.actorName || (isAr ? 'عضو في الشبكة' : 'Un membre du réseau'))} {String(notification.payload?.message || '')}</span><span className="mt-1 block text-[11px] font-semibold text-slate-500">{formatDate(notification.createdAt, language)}</span></span>{notification.payload?.read !== true && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-600" />}</button>) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{ui.notificationsEmpty}</div>}</section>;
    }
    if (activeView === 'messages') {
      const recipient = messageRecipientId ? profiles.find(profile => profile.id === messageRecipientId) : null;
      const conversation = recipient ? communityFeatures.filter(feature => feature.kind === 'private_message' && ((feature.actorId === user.id && feature.recipientId === recipient.id) || (feature.actorId === recipient.id && feature.recipientId === user.id))).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) : [];
      return <section className="min-w-0 space-y-4"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><MessageCircle className="h-5 w-5 text-indigo-600" /><div><h2 className="text-lg font-black text-slate-900">{ui.messages}</h2><p className="text-xs font-semibold text-slate-500">{isAr ? 'تواصل مهنياً مع مدراء الشبكة.' : 'Échangez professionnellement avec les Directeurs du réseau.'}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{profiles.filter(profile => profile.id !== user.id).map(profile => <button type="button" key={profile.id} onClick={() => setMessageRecipientId(profile.id)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${messageRecipientId === profile.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-indigo-50'}`}><Avatar profile={profile} size="sm" />{profile.name}</button>)}</div></div>{recipient ? <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3 border-b border-slate-100 pb-3"><Avatar profile={recipient} size="sm" /><div><p className="text-sm font-black text-slate-800">{recipient.name}</p><p className="text-xs font-semibold text-slate-500">{recipient.nomCreche || (isAr ? 'حضانة' : 'Crèche')}</p></div></div><div className="my-4 max-h-80 space-y-2 overflow-y-auto">{conversation.length ? conversation.map(message => <div key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-5 ${message.actorId === user.id ? 'ml-auto bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{String(message.payload?.content || '')}<p className={`mt-1 text-[10px] ${message.actorId === user.id ? 'text-indigo-100' : 'text-slate-400'}`}>{formatDate(message.createdAt, language)}</p></div>) : <p className="py-8 text-center text-xs text-slate-400">{isAr ? 'ابدأ المحادثة المهنية.' : 'Commencez la conversation professionnelle.'}</p>}</div><form onSubmit={handleSendMessage} className="flex items-end gap-2"><textarea value={messageDraft} onChange={event => setMessageDraft(event.target.value)} rows={2} maxLength={1000} placeholder={ui.messagePlaceholder} className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-indigo-500" /><button type="submit" disabled={!messageDraft.trim() || submitting} className="rounded-xl bg-indigo-600 p-3 text-white disabled:opacity-40" aria-label={ui.sendMessage}><Send className="h-4 w-4" /></button></form></div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{isAr ? 'اختر مديراً لبدء محادثة.' : 'Choisissez un Directeur pour commencer.'}</div>}</section>;
    }
    return null;
  };

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden bg-slate-50 pb-14" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="mx-auto min-w-0 max-w-7xl px-3 py-4 sm:px-4 sm:py-5 md:px-6">
        <section className="relative mb-5 overflow-hidden rounded-3xl bg-slate-950 px-4 py-5 text-white shadow-xl shadow-indigo-950/10 sm:px-6 sm:py-6">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-orange-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-violet-300"><Sparkles className="h-4 w-4" />Rawdha Connect</div>
              <h1 className="mt-2 max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">{isAr ? 'شبكة دور الحضانة التي تتقدم معاً' : 'Le réseau des crèches qui avance ensemble'}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{isAr ? 'شارك أفكارك، اكتشف الأنشطة وتواصل مع مدراء دور الحضانة الموثوقة.' : 'Partagez vos idées, découvrez des activités et échangez avec les Directeurs de crèches vérifiées.'}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-slate-200"><span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5">{communityPosts.length} {isAr ? 'منشور' : 'publications'}</span><span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5">{profiles.length} {isAr ? 'ملف' : 'profils'}</span><span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5">{categories.length - 1} {isAr ? 'مواضيع' : 'thèmes'}</span></div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:flex-col"><label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-slate-200 backdrop-blur-sm"><Search className="h-4 w-4 shrink-0 text-slate-300" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={isAr ? 'ابحث في الشبكة' : 'Rechercher dans le réseau'} className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 sm:w-56" /></label><button type="button" onClick={openComposer} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-indigo-700 shadow-lg shadow-black/10 transition hover:bg-violet-50 active:scale-[0.98] sm:w-auto"><Plus className="h-4 w-4" />{isAr ? 'منشور جديد' : 'Nouvelle publication'}</button></div>
          </div>
        </section>

        <AnimatePresence initial={false}>{showProfileEditor && renderProfileEditor()}</AnimatePresence>
        <div className="sticky top-20 z-20 mb-5 grid grid-cols-6 gap-1.5 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-md shadow-slate-900/5 backdrop-blur-md lg:flex lg:gap-2">
          <button type="button" onClick={() => setActiveView('feed')} aria-label={ui.home} title={ui.home} className={`relative inline-flex min-w-0 items-center justify-center rounded-xl p-2.5 text-xs font-black ${activeView === 'feed' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'} lg:gap-2 lg:px-4 lg:py-2.5 lg:text-sm lg:whitespace-nowrap`}>
            <House className="h-4 w-4 shrink-0" /><span className="hidden lg:inline">{ui.home}</span>
          </button>
          <button type="button" onClick={() => { setActiveView('profile'); setSelectedProfileId(user.id); }} aria-label={ui.myProfile} title={ui.myProfile} className={`relative inline-flex min-w-0 items-center justify-center rounded-xl p-2.5 text-xs font-black ${activeView === 'profile' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'} lg:gap-2 lg:px-4 lg:py-2.5 lg:text-sm lg:whitespace-nowrap`}>
            <UserRound className="h-4 w-4 shrink-0" /><span className="hidden lg:inline">{ui.myProfile}</span>
          </button>
          <button type="button" onClick={() => setActiveView('reposts')} aria-label={ui.myReposts} title={ui.myReposts} className={`relative inline-flex min-w-0 items-center justify-center rounded-xl p-2.5 text-xs font-black ${activeView === 'reposts' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'} lg:gap-2 lg:px-4 lg:py-2.5 lg:text-sm lg:whitespace-nowrap`}>
            <Repeat2 className="h-4 w-4 shrink-0" /><span className="hidden lg:inline">{ui.myReposts}</span>
          </button>
          <button type="button" onClick={() => setActiveView('saved')} aria-label={ui.saved} title={ui.saved} className={`relative inline-flex min-w-0 items-center justify-center rounded-xl p-2.5 text-xs font-black ${activeView === 'saved' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'} lg:gap-2 lg:px-4 lg:py-2.5 lg:text-sm lg:whitespace-nowrap`}>
            <Bookmark className="h-4 w-4 shrink-0" /><span className="hidden lg:inline">{ui.saved}</span>
          </button>
          <button type="button" onClick={() => setActiveView('notifications')} aria-label={ui.notifications} title={ui.notifications} className={`relative inline-flex min-w-0 items-center justify-center rounded-xl p-2.5 text-xs font-black ${activeView === 'notifications' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'} lg:gap-2 lg:px-4 lg:py-2.5 lg:text-sm lg:whitespace-nowrap`}>
            <BellRing className="h-4 w-4 shrink-0" /><span className="hidden lg:inline">{ui.notifications}</span>{unreadSocialNotifications.length > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[9px] font-black leading-4 text-white lg:static lg:min-w-0 lg:px-1.5 lg:text-[10px]">{unreadSocialNotifications.length}</span>}
          </button>
          <button type="button" onClick={() => setActiveView('messages')} aria-label={ui.messages} title={ui.messages} className={`relative inline-flex min-w-0 items-center justify-center rounded-xl p-2.5 text-xs font-black ${activeView === 'messages' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'} lg:gap-2 lg:px-4 lg:py-2.5 lg:text-sm lg:whitespace-nowrap`}>
            <MessageCircle className="h-4 w-4 shrink-0" /><span className="hidden lg:inline">{ui.messages}</span>{communityFeatures.filter(feature => feature.kind === 'private_message' && feature.recipientId === user.id && feature.payload?.read !== true).length > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[9px] font-black leading-4 text-white lg:static lg:min-w-0 lg:px-1.5 lg:text-[10px]">{Math.min(99, communityFeatures.filter(feature => feature.kind === 'private_message' && feature.recipientId === user.id && feature.payload?.read !== true).length)}</span>}
          </button>
          <div className="ml-auto hidden items-center gap-2 px-3 text-xs font-semibold text-slate-400 lg:flex"><Users className="h-4 w-4" />{profiles.length} {isAr ? 'ملف ظاهر' : `profil${profiles.length > 1 ? 's' : ''} visibles`}</div>
        </div>
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-wider text-violet-600">{ui.moments}</p><p className="mt-1 text-xs font-semibold text-slate-500">{ui.momentsSubtitle}</p></div><Sparkles className="h-5 w-5 text-orange-400" /></div><div className="mobile-scroll-x mt-4 flex gap-1.5 pb-1 sm:gap-3"><button type="button" onClick={() => { setSelectedProfileId(user.id); setActiveView('profile'); }} className="flex w-14 shrink-0 flex-col items-center gap-1.5 text-center sm:w-20"><div className="rounded-full bg-gradient-to-br from-orange-400 via-violet-600 to-indigo-700 p-0.5"><Avatar profile={currentProfile} size="md" /></div><span className="w-full truncate text-[11px] font-black text-slate-700">{ui.you}</span></button>{profiles.filter(profile => profile.id !== user.id).slice(0, 8).map(profile => <button type="button" key={profile.id} onClick={() => { setSelectedProfileId(profile.id); setActiveView('profile'); }} className="flex w-14 shrink-0 flex-col items-center gap-1.5 text-center sm:w-20"><div className={`rounded-full p-0.5 ${profile.isPlatform ? 'bg-gradient-to-br from-orange-400 to-rose-500' : 'bg-gradient-to-br from-violet-500 to-indigo-600'}`}><Avatar profile={profile} size="md" /></div><span className="w-full truncate text-[11px] font-black text-slate-700">{profile.name}</span></button>)}</div></div>

        {activeView === 'profile' && selectedProfile ? renderPublicProfile(selectedProfile) : activeView === 'saved' || activeView === 'notifications' || activeView === 'messages' ? renderSocialUtilityView() : (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[240px_minmax(0,640px)_280px] lg:items-start">
          <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="h-20 bg-gradient-to-br from-slate-950 via-indigo-900 to-violet-700" /><div className="px-4 pb-4"><div className="-mt-8"><Avatar profile={currentProfile} size="lg" /></div><h2 className="mt-3 flex min-w-0 flex-wrap items-center gap-2 break-words text-base font-black text-slate-900">{currentProfile.name}{currentProfile.estCertifie && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700"><Check className="h-3 w-3" />{currentProfile.isPlatform ? (isAr ? 'رسمي' : 'Officiel') : (isAr ? 'موثّقة' : 'Certifiée')}</span>}</h2><p className="mt-0.5 break-words text-xs font-semibold text-slate-500">{currentProfile.nomCreche}</p><p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-500">{currentProfile.bio || ui.addPresentation}</p>{!isAdmin && <button type="button" onClick={() => { setSelectedProfileId(user.id); setActiveView('profile'); setShowProfileEditor(true); }} className="mt-4 w-full rounded-xl border border-indigo-200 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-50">{ui.myProfile}</button>}</div></div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm"><div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3"><div><p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">{isAdmin ? (isAr ? 'حساب المنصة الرسمي' : 'Compte officiel de la plateforme') : (isAr ? 'شهادة Rawdha+' : 'Certification Rawdha+')}</p><p className="mt-1 text-sm font-black text-slate-900">{isAdmin ? (isAr ? 'Rawdha+ موثّق' : 'Rawdha+ certifié') : isCurrentUserCertified ? (isAr ? 'حساب موثّق' : 'Compte certifié') : `${Math.min(certificationChildrenCount, 30)} / 30 ${isAr ? 'طفلاً' : 'enfants'}`}</p></div><ShieldCheck className={`h-5 w-5 ${isCurrentUserCertified ? 'text-emerald-600' : 'text-slate-400'}`} /></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (certificationChildrenCount / 30) * 100)}%` }} /></div><p className="mt-2 text-[11px] font-semibold leading-4 text-emerald-800">{isAdmin ? (isAr ? 'يظهر شعار Rawdha+ وصورة المنصة الرسميان على منشوراتك.' : 'Le logo officiel et l’identité de la plateforme apparaissent sur vos publications.') : isCurrentUserCertified ? (isAr ? 'شارة التوثيق ظاهرة على منشوراتك.' : 'Votre badge vérifié est visible sur vos publications.') : (isAr ? `أضف ${Math.max(0, 30 - certificationChildrenCount)} طفلاً مسجلاً للحصول على الشارة.` : `Ajoutez encore ${Math.max(0, 30 - certificationChildrenCount)} enfant${30 - certificationChildrenCount > 1 ? 's' : ''} enregistré${30 - certificationChildrenCount > 1 ? 's' : ''} pour débloquer le badge.`)}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="px-2 pb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">{ui.explore}</p>{categories.map(category => <button type="button" key={category.value} onClick={() => { setActiveCategory(category.value); setActiveView('feed'); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-black transition ${activeCategory === category.value && activeView === 'feed' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${category.value === 'tous' ? 'bg-slate-400' : category.color.split(' ')[0].replace('bg-', 'bg-')}`} />{isAr ? category.ar : category.fr}</span><ChevronRight className="h-3.5 w-3.5 text-slate-300" /></button>)}</div>
          </aside>

          <main className="order-first min-w-0 space-y-5 lg:order-none">
            {showComposer ? renderComposer() : <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex min-w-0 items-center gap-3"><Avatar profile={currentProfile} size="md" /><button type="button" onClick={openComposer} className="flex-1 rounded-xl bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-400 hover:bg-indigo-50 hover:text-indigo-600">{isAdmin ? ui.whatAdmin : ui.whatDirector}</button></div><div className="mt-3 grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={openComposer} className="inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"><ImageIcon className="h-4 w-4 text-emerald-500" />{ui.photoActivity}</button><button type="button" onClick={openComposer} className="inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"><BriefcaseBusiness className="h-4 w-4 text-indigo-500" />{ui.opportunity}</button><button type="button" onClick={openComposer} className="inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"><Tag className="h-4 w-4 text-amber-500" />{ui.announcement}</button></div></div>}
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">{activeView === 'reposts' ? ui.myReposts : activeView === 'profile' ? ui.myProfile : ui.feed}</h2><p className="text-xs text-slate-500">{filteredPosts.length} {isAr ? 'منشور' : `publication${filteredPosts.length > 1 ? 's' : ''}`}</p></div><label className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 focus-within:border-indigo-500"><Tag className="h-3.5 w-3.5 shrink-0 text-indigo-500" /><select value={activeCategory} onChange={event => setActiveCategory(event.target.value as CommunityPostCategory | 'tous')} aria-label={isAr ? 'تصفية حسب الفئة' : 'Filtrer par catégorie'} className="min-w-0 max-w-[190px] bg-transparent outline-none">{categories.map(category => <option key={category.value} value={category.value}>{isAr ? category.ar : category.fr}</option>)}</select></label></div>
            {filteredPosts.length ? filteredPosts.map(renderPost) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Sparkles className="mx-auto h-8 w-8 text-indigo-400" /><h3 className="mt-3 text-base font-black text-slate-800">{ui.noPosts}</h3><p className="mt-1 text-sm text-slate-500">{ui.noPostsDesc}</p><button type="button" onClick={openComposer} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white">{ui.createPost}</button></div>}
          </main>

          <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-black text-slate-900">{ui.discover}</h3><Users className="h-4 w-4 text-indigo-500" /></div><label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><Search className="h-3.5 w-3.5 shrink-0 text-slate-400" /><input value={profileSearch} onChange={event => setProfileSearch(event.target.value)} placeholder={ui.searchProfiles} className="min-w-0 w-full bg-transparent text-xs outline-none placeholder:text-slate-400" /></label><div className="mt-3 space-y-3">{filteredProfiles.filter(profile => profile.id !== user.id).slice(0, 6).map(profile => <div key={profile.id} className="flex min-w-0 items-center gap-2 rounded-xl p-2 hover:bg-slate-50"><button type="button" onClick={() => { setSelectedProfileId(profile.id); setActiveView('profile'); }} className="flex min-w-0 flex-1 items-center gap-3 text-left"><Avatar profile={profile} size="sm" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-slate-800">{profile.name}</span><span className="block truncate text-[11px] font-semibold text-slate-500">{profile.nomCreche || (isAr ? 'حضانة' : 'Crèche')}</span></span></button><button type="button" onClick={() => void handleToggleFollow(profile)} className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black ${followingIds.has(profile.id) ? 'bg-indigo-50 text-indigo-700' : 'border border-slate-200 text-slate-600 hover:bg-indigo-50'}`} aria-label={`${followingIds.has(profile.id) ? ui.following : ui.follow} ${profile.name}`}>{followingIds.has(profile.id) ? <UserCheck className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}{followingIds.has(profile.id) ? ui.following : ui.follow}</button></div>)}{filteredProfiles.filter(profile => profile.id !== user.id).length === 0 && <p className="text-xs leading-5 text-slate-500">{ui.profilesEmpty}</p>}</div></div>
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-5 text-white shadow-lg shadow-indigo-700/20"><ShieldCheck className="h-6 w-6" /><h3 className="mt-3 text-base font-black">{ui.verifiedNetwork}</h3><p className="mt-2 text-xs leading-5 text-indigo-100">{ui.verifiedNetworkDesc}</p></div>
          </aside>
        </div>)}
      </div>

    </div>
  );
}
