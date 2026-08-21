import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BriefcaseBusiness,
  Building2,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Globe2,
  Heart,
  Image as ImageIcon,
  Link2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
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
import { CommunityComment, CommunityPost, CommunityPostCategory, UserAccount } from '../types';

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
    enfants,
    comptes,
    addCommunityPost,
    repostCommunityPost,
    updateCommunityPost,
    deleteCommunityPost,
    addCommunityComment,
    deleteCommunityComment,
    toggleCommunityReaction,
  } = useDb();

  const isAr = language === 'ar';
  const ui = isAr ? uiCopy.ar : uiCopy.fr;
  const isAdmin = user?.role === 'admin';
  const registeredChildrenCount = enfants.length;
  const certificationChildrenCount = isAdmin ? 30 : Math.max(registeredChildrenCount, user?.certificationEnfants || 0);
  const isCurrentUserCertified = isAdmin || Boolean(user?.estCertifie) || certificationChildrenCount >= 30;
  const [activeCategory, setActiveCategory] = useState<CommunityPostCategory | 'tous'>('tous');
  const [activeView, setActiveView] = useState<'feed' | 'profile' | 'reposts'>('feed');
  const [search, setSearch] = useState('');
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
  const [postImageUrl, setPostImageUrl] = useState('');
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
  });

  useEffect(() => {
    if (!showComposer) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowComposer(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showComposer]);

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
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [communityPosts, activeCategory, activeView, search, selectedProfileId, user?.id, isAdmin]);

  if (!user || (!isAdmin && user.role !== 'directeur')) return null;

  const canManagePost = (post: CommunityPost) => isAdmin || post.authorId === user.id;
  const authorName = currentProfile.name;
  const crecheName = currentProfile.nomCreche || user.nomCreche || creche?.nom || (isAr ? 'روضة' : 'Crèche');

  const openComposer = () => {
    setOpenMenu(null);
    setShowComposer(true);
  };

  const handlePostImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPostImageError('');
    try {
      const dataUrl = await compressProfileImage(file, 1280);
      setPostImageUrl(dataUrl);
    } catch (error) {
      setPostImageError(error instanceof Error ? error.message : 'Impossible de charger cette image.');
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
      });
      setActiveView('profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSubmitPost = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.contenu.trim() || submitting) return;
    setSubmitting(true);
    try {
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
        imageUrls: postImageUrl ? [postImageUrl] : undefined,
        prix: form.prix.trim() ? Number(form.prix) : undefined,
        contact: form.contact.trim() || undefined,
        statut: 'publie',
        likesCount: 0,
        createdAt: new Date().toISOString(),
      });
      setForm(emptyForm);
      setPostImageUrl('');
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
    } finally {
      setSubmitting(false);
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
    return (
      <article key={post.id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
        {post.originalPostId && <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500"><Repeat2 className="h-4 w-4 text-indigo-600" />{post.authorName} {isAr ? 'أعاد النشر' : 'a republié une publication'}</div>}
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
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
                {isAdmin && <button type="button" onClick={() => { setOpenMenu(null); void updateCommunityPost(post.id, { statut: post.statut === 'masquee' ? 'publie' : 'masquee' }); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50"><ShieldCheck className="h-4 w-4" />{post.statut === 'masquee' ? ui.restore : ui.hide}</button>}
              </div>}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${category?.color || 'bg-slate-100 text-slate-700'}`}><Tag className="mr-1 inline h-3 w-3" />{categoryLabel(post.categorie, language)}</span>{post.statut === 'masquee' && <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-black text-rose-700">{ui.masked}</span>}</div>
          {post.titre && <h3 className="mt-3 text-lg font-black text-slate-900">{post.titre}</h3>}
          {post.contenu && <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{post.contenu}</p>}
          {post.imageUrls?.[0] && <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50"><img src={post.imageUrls[0]} alt={post.titre || (isAr ? 'صورة المنشور' : 'Image de la publication')} className="max-h-[520px] w-full object-cover" loading="lazy" /></div>}
          {post.contact && <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600"><span className="font-black text-slate-800">{ui.contact} </span>{post.contact}</div>}

          {original && <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex min-w-0 items-center gap-3"><Avatar profile={originalProfile!} size="sm" /><div><p className="text-xs font-black text-slate-800">{original.authorName || (isAr ? 'مدير' : 'Directeur')}</p><p className="text-[11px] font-semibold text-slate-500">{original.nomCreche || (isAr ? 'حضانة' : 'Crèche')}</p></div></div>
            {original.titre && <p className="mt-3 text-sm font-black text-slate-800">{original.titre}</p>}
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{original.contenu || ''}</p>
          </div>}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs font-bold text-slate-400"><span aria-live="polite">{reactionCount(post.id)} {ui.likes}</span><span>{comments.length} {comments.length > 1 ? ui.comments : ui.comment} · {communityPosts.filter(item => item.originalPostId === post.id).length} {communityPosts.filter(item => item.originalPostId === post.id).length > 1 ? ui.reposts : ui.repost}</span></div>
          <div className="mt-2 grid grid-cols-1 min-[420px]:grid-cols-3 gap-1 border-t border-slate-100 pt-2">
            <button type="button" aria-pressed={isLiked(post.id)} onClick={() => void toggleCommunityReaction(post.id)} className={`inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-black transition ${isLiked(post.id) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-700'}`}><ThumbsUp className={`h-4 w-4 ${isLiked(post.id) ? 'fill-current' : ''}`} />{ui.likes}</button>
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
      .filter(post => post.authorId === profile.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const repostCount = profilePosts.filter(post => Boolean(post.originalPostId)).length;
    const isOwnProfile = profile.id === user.id;
    const childCount = Math.min(profile.certificationEnfants || 0, 30);

    return (
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 space-y-5">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="h-32 bg-gradient-to-br from-slate-950 via-indigo-900 to-violet-700 md:h-44" />
          <div className="px-4 pb-5 sm:px-5 sm:pb-6 md:px-8">
            <div className="-mt-12 flex flex-col gap-4 md:-mt-14 md:flex-row md:items-end md:justify-between">
              <div className="flex items-end gap-4"><Avatar profile={profile} size="lg" /><div className="pb-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg sm:text-xl font-black text-slate-900">{profile.name}</h2>{profile.estCertifie ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700"><Check className="h-3 w-3" />{profile.isPlatform ? ui.officialAccount : (isAr ? 'حضانة موثّقة' : 'Crèche certifiée')}</span> : <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">{isAr ? 'التحقق قيد التقدم' : 'Certification en cours'}</span>}</div><p className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-sm font-semibold text-slate-500"><Building2 className="h-4 w-4 shrink-0" /><span className="break-words">{profile.nomCreche || (isAr ? 'حضانة' : 'Crèche')}{profile.ville ? ` · ${profile.ville}` : ''}</span></p></div></div>
              {isOwnProfile && !profile.isPlatform && <button type="button" onClick={() => setShowProfileEditor(true)} className="rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-50">{ui.myProfile}</button>}
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_220px]"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h3 className="text-sm font-black text-slate-900">{ui.about}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{profile.bio || ui.noProfilePresentation}</p><div className="mt-4 space-y-2 text-xs font-semibold text-slate-500">{profile.ville && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-500" />{profile.ville}</p>}{profile.telephone && <p className="flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-indigo-500" />{profile.telephone}</p>}{profile.siteWeb && <a href={profile.siteWeb} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline"><Globe2 className="h-4 w-4" />{profile.siteWeb}</a>}</div></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{profile.isPlatform ? ui.platformIdentity : ui.certification}</p><p className="mt-3 text-2xl font-black text-slate-900">{childCount} / 30</p><p className="text-xs font-semibold text-slate-500">{ui.registeredChildren}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className={`h-full rounded-full ${profile.estCertifie ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, (childCount / 30) * 100)}%` }} /></div><p className="mt-4 text-xs font-semibold text-slate-500">{profile.isPlatform ? ui.officialVerified : profile.estCertifie ? ui.verifiedBadge : (isAr ? `أضف ${Math.max(0, 30 - childCount)} طفلاً للحصول على الشارة` : `Encore ${Math.max(0, 30 - childCount)} enfant${30 - childCount > 1 ? 's' : ''} pour obtenir le badge`)}</p><p className="mt-4 text-2xl font-black text-slate-900">{profilePosts.length}</p><p className="text-xs font-semibold text-slate-500">{profilePosts.length} {isAr ? 'منشور' : `publication${profilePosts.length > 1 ? 's' : ''}`}</p><p className="mt-4 text-2xl font-black text-slate-900">{repostCount}</p><p className="text-xs font-semibold text-slate-500">{repostCount} {repostCount > 1 ? ui.reposts : ui.repost}</p></div></div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">{isAr ? `منشورات ${profile.name}` : `Publications de ${profile.name}`}</h2><p className="text-xs text-slate-500">{profilePosts.length} {isAr ? 'منشور' : `publication${profilePosts.length > 1 ? 's' : ''}`}</p></div><button type="button" onClick={() => { setSelectedProfileId(null); setActiveView('feed'); }} className="text-xs font-black text-indigo-600 hover:underline">{ui.backToFeed}</button></div>
        <div className="space-y-4">{profilePosts.length ? profilePosts.map(renderPost) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{ui.noProfilePosts}</div>}</div>
      </motion.section>
    );
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
        <div className="mobile-scroll-x sticky top-20 z-20 mb-5 flex gap-2 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-md shadow-slate-900/5 backdrop-blur-md"><button type="button" onClick={() => setActiveView('feed')} className={`rounded-xl px-4 py-2.5 text-sm font-black whitespace-nowrap ${activeView === 'feed' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{ui.home}</button><button type="button" onClick={() => { setActiveView('profile'); setSelectedProfileId(user.id); }} className={`rounded-xl px-4 py-2.5 text-sm font-black whitespace-nowrap ${activeView === 'profile' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{ui.myProfile}</button><button type="button" onClick={() => setActiveView('reposts')} className={`rounded-xl px-4 py-2.5 text-sm font-black whitespace-nowrap ${activeView === 'reposts' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{ui.myReposts}</button><div className="ml-auto hidden items-center gap-2 px-3 text-xs font-semibold text-slate-400 lg:flex"><Users className="h-4 w-4" />{profiles.length} {isAr ? 'ملف ظاهر' : `profil${profiles.length > 1 ? 's' : ''} visible${profiles.length > 1 ? 's' : ''}`}</div></div>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-wider text-violet-600">{ui.moments}</p><p className="mt-1 text-xs font-semibold text-slate-500">{ui.momentsSubtitle}</p></div><Sparkles className="h-5 w-5 text-orange-400" /></div><div className="mobile-scroll-x mt-4 flex gap-3 pb-1"><button type="button" onClick={() => { setSelectedProfileId(user.id); setActiveView('profile'); }} className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center"><div className="rounded-full bg-gradient-to-br from-orange-400 via-violet-600 to-indigo-700 p-0.5"><Avatar profile={currentProfile} size="md" /></div><span className="w-full truncate text-[11px] font-black text-slate-700">{ui.you}</span></button>{profiles.filter(profile => profile.id !== user.id).slice(0, 8).map(profile => <button type="button" key={profile.id} onClick={() => { setSelectedProfileId(profile.id); setActiveView('profile'); }} className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center"><div className={`rounded-full p-0.5 ${profile.isPlatform ? 'bg-gradient-to-br from-orange-400 to-rose-500' : 'bg-gradient-to-br from-violet-500 to-indigo-600'}`}><Avatar profile={profile} size="md" /></div><span className="w-full truncate text-[11px] font-black text-slate-700">{profile.name}</span></button>)}</div></div>

        {activeView === 'profile' && selectedProfile ? renderPublicProfile(selectedProfile) : (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[240px_minmax(0,640px)_280px] lg:items-start">
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="h-20 bg-gradient-to-br from-slate-950 via-indigo-900 to-violet-700" /><div className="px-4 pb-4"><div className="-mt-8"><Avatar profile={currentProfile} size="lg" /></div><h2 className="mt-3 flex min-w-0 flex-wrap items-center gap-2 break-words text-base font-black text-slate-900">{currentProfile.name}{currentProfile.estCertifie && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700"><Check className="h-3 w-3" />{currentProfile.isPlatform ? (isAr ? 'رسمي' : 'Officiel') : (isAr ? 'موثّقة' : 'Certifiée')}</span>}</h2><p className="mt-0.5 break-words text-xs font-semibold text-slate-500">{currentProfile.nomCreche}</p><p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-500">{currentProfile.bio || ui.addPresentation}</p>{!isAdmin && <button type="button" onClick={() => { setSelectedProfileId(user.id); setActiveView('profile'); setShowProfileEditor(true); }} className="mt-4 w-full rounded-xl border border-indigo-200 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-50">{ui.myProfile}</button>}</div></div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">{isAdmin ? (isAr ? 'حساب المنصة الرسمي' : 'Compte officiel de la plateforme') : (isAr ? 'شهادة Rawdha+' : 'Certification Rawdha+')}</p><p className="mt-1 text-sm font-black text-slate-900">{isAdmin ? (isAr ? 'Rawdha+ موثّق' : 'Rawdha+ certifié') : isCurrentUserCertified ? (isAr ? 'حساب موثّق' : 'Compte certifié') : `${Math.min(certificationChildrenCount, 30)} / 30 ${isAr ? 'طفلاً' : 'enfants'}`}</p></div><ShieldCheck className={`h-5 w-5 ${isCurrentUserCertified ? 'text-emerald-600' : 'text-slate-400'}`} /></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (certificationChildrenCount / 30) * 100)}%` }} /></div><p className="mt-2 text-[11px] font-semibold leading-4 text-emerald-800">{isAdmin ? (isAr ? 'يظهر شعار Rawdha+ وصورة المنصة الرسميان على منشوراتك.' : 'Le logo officiel et l’identité de la plateforme apparaissent sur vos publications.') : isCurrentUserCertified ? (isAr ? 'شارة التوثيق ظاهرة على منشوراتك.' : 'Votre badge vérifié est visible sur vos publications.') : (isAr ? `أضف ${Math.max(0, 30 - certificationChildrenCount)} طفلاً مسجلاً للحصول على الشارة.` : `Ajoutez encore ${Math.max(0, 30 - certificationChildrenCount)} enfant${30 - certificationChildrenCount > 1 ? 's' : ''} enregistré${30 - certificationChildrenCount > 1 ? 's' : ''} pour débloquer le badge.`)}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="px-2 pb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">{ui.explore}</p>{categories.map(category => <button type="button" key={category.value} onClick={() => { setActiveCategory(category.value); setActiveView('feed'); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-black transition ${activeCategory === category.value && activeView === 'feed' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${category.value === 'tous' ? 'bg-slate-400' : category.color.split(' ')[0].replace('bg-', 'bg-')}`} />{isAr ? category.ar : category.fr}</span><ChevronRight className="h-3.5 w-3.5 text-slate-300" /></button>)}</div>
          </aside>

          <main className="min-w-0 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex min-w-0 items-center gap-3"><Avatar profile={currentProfile} size="md" /><button type="button" onClick={openComposer} className="flex-1 rounded-xl bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-400 hover:bg-indigo-50 hover:text-indigo-600">{isAdmin ? ui.whatAdmin : ui.whatDirector}</button></div><div className="mt-3 grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={openComposer} className="inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"><ImageIcon className="h-4 w-4 text-emerald-500" />{ui.photoActivity}</button><button type="button" onClick={openComposer} className="inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"><BriefcaseBusiness className="h-4 w-4 text-indigo-500" />{ui.opportunity}</button><button type="button" onClick={openComposer} className="inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"><Tag className="h-4 w-4 text-amber-500" />{ui.announcement}</button></div></div>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">{activeView === 'reposts' ? ui.myReposts : activeView === 'profile' ? ui.myProfile : ui.feed}</h2><p className="text-xs text-slate-500">{filteredPosts.length} {isAr ? 'منشور' : `publication${filteredPosts.length > 1 ? 's' : ''}`}</p></div><label className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 focus-within:border-indigo-500"><Tag className="h-3.5 w-3.5 shrink-0 text-indigo-500" /><select value={activeCategory} onChange={event => setActiveCategory(event.target.value as CommunityPostCategory | 'tous')} aria-label={isAr ? 'تصفية حسب الفئة' : 'Filtrer par catégorie'} className="min-w-0 max-w-[190px] bg-transparent outline-none">{categories.map(category => <option key={category.value} value={category.value}>{isAr ? category.ar : category.fr}</option>)}</select></label></div>
            {filteredPosts.length ? filteredPosts.map(renderPost) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Sparkles className="mx-auto h-8 w-8 text-indigo-400" /><h3 className="mt-3 text-base font-black text-slate-800">{ui.noPosts}</h3><p className="mt-1 text-sm text-slate-500">{ui.noPostsDesc}</p><button type="button" onClick={openComposer} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white">{ui.createPost}</button></div>}
          </main>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-sm font-black text-slate-900">{ui.profilesDiscover}</h3><Users className="h-4 w-4 text-indigo-500" /></div><div className="mt-3 space-y-3">{profiles.filter(profile => profile.id !== user.id).slice(0, 4).map(profile => <button type="button" key={profile.id} onClick={() => { setSelectedProfileId(profile.id); setActiveView('profile'); }} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50"><Avatar profile={profile} size="sm" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-slate-800">{profile.name}</span><span className="block truncate text-[11px] font-semibold text-slate-500">{profile.nomCreche || 'Crèche'}</span></span><ChevronRight className="h-4 w-4 text-slate-300" /></button>)}{profiles.length <= 1 && <p className="text-xs leading-5 text-slate-500">{ui.profilesEmpty}</p>}</div></div>
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-5 text-white shadow-lg shadow-indigo-700/20"><ShieldCheck className="h-6 w-6" /><h3 className="mt-3 text-base font-black">{ui.verifiedNetwork}</h3><p className="mt-2 text-xs leading-5 text-indigo-100">{ui.verifiedNetworkDesc}</p></div>
          </aside>
        </div>)}
      </div>

      <AnimatePresence>
        {showComposer && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={event => { if (event.target === event.currentTarget) setShowComposer(false); }} role="dialog" aria-modal="true" aria-labelledby="community-composer-title" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-16 sm:pt-20"><motion.form initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onSubmit={handleSubmitPost} className="max-h-[calc(100vh-5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5 md:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-indigo-600">{ui.newPost}</p><h2 id="community-composer-title" className="mt-1 text-lg sm:text-xl font-black text-slate-900">{isAr ? 'شارك مع شبكتك' : 'Partager avec votre réseau'}</h2></div><button type="button" onClick={() => setShowComposer(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="mt-5 flex items-center gap-3 rounded-xl bg-slate-50 p-3"><Avatar profile={currentProfile} size="sm" /><div><p className="text-sm font-black text-slate-800">{authorName}</p><p className="text-xs font-semibold text-slate-500">{crecheName}</p></div></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs font-black text-slate-600">{isAr ? 'الفئة' : 'Catégorie'}<select value={form.categorie} onChange={event => setForm(current => ({ ...current, categorie: event.target.value as CommunityPostCategory }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500">{categories.filter(item => item.value !== 'tous').map(item => <option key={item.value} value={item.value}>{isAr ? item.ar : item.fr}</option>)}</select></label><label className="text-xs font-black text-slate-600">{isAr ? 'العنوان' : 'Titre'}<input value={form.titre} onChange={event => setForm(current => ({ ...current, titre: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder={isAr ? 'عنوان المنشور' : 'Titre de votre publication'} /></label><label className="text-xs font-black text-slate-600 md:col-span-2">{isAr ? 'رسالتك' : 'Votre message'}<textarea required rows={5} maxLength={3000} value={form.contenu} onChange={event => setForm(current => ({ ...current, contenu: event.target.value }))} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 outline-none focus:border-indigo-500" placeholder={isAr ? 'شارك فكرة أو نشاطاً أو فرصة...' : 'Partagez une idée, une activité, une opportunité...'} /></label>{postImageUrl && <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 md:col-span-2"><img src={postImageUrl} alt="Aperçu de la publication" className="max-h-64 w-full object-cover" /><button type="button" onClick={() => setPostImageUrl('')} className="absolute right-2 top-2 rounded-full bg-slate-950/75 p-2 text-white hover:bg-slate-950" aria-label="Supprimer l’image"><X className="h-4 w-4" /></button></div>}{postImageError && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 md:col-span-2" role="alert">{postImageError}</p>}<label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-black text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 md:col-span-2"><ImageIcon className="h-4 w-4 text-emerald-500" />{isAr ? 'إضافة صورة' : 'Ajouter une photo'}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => void handlePostImageUpload(event)} /></label><label className="text-xs font-black text-slate-600">{ui.city}<input value={form.ville} onChange={event => setForm(current => ({ ...current, ville: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder="Alger" /></label><label className="text-xs font-black text-slate-600">{ui.contact}<input value={form.contact} onChange={event => setForm(current => ({ ...current, contact: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder={isAr ? 'هاتف أو رابط' : 'Téléphone ou lien'} /></label></div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowComposer(false)} className="rounded-xl px-4 py-3 text-sm font-black text-slate-500 hover:bg-slate-100">{ui.cancel}</button><button type="submit" disabled={submitting || !form.contenu.trim()} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? (isAr ? 'جارٍ النشر...' : 'Publication...') : ui.publish}</button></div></motion.form></motion.div>}


      </AnimatePresence>
    </div>
  );
}
