import { FormEvent, useEffect, useMemo, useState } from 'react';
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
import { CommunityPost, CommunityPostCategory, UserAccount } from '../types';

const categories: Array<{ value: CommunityPostCategory | 'tous'; fr: string; ar: string; color: string }> = [
  { value: 'tous', fr: 'Tout le fil', ar: 'كل المنشورات', color: 'bg-slate-100 text-slate-700' },
  { value: 'activite', fr: 'Activités & méthodes', ar: 'الأنشطة والأساليب', color: 'bg-indigo-50 text-indigo-700' },
  { value: 'materiel', fr: 'Matériel', ar: 'المعدات', color: 'bg-amber-50 text-amber-700' },
  { value: 'vente_echange', fr: 'Vente & échange', ar: 'البيع والتبادل', color: 'bg-emerald-50 text-emerald-700' },
  { value: 'recrutement', fr: 'Recrutement', ar: 'التوظيف', color: 'bg-rose-50 text-rose-700' },
  { value: 'formation', fr: 'Formations', ar: 'التكوين', color: 'bg-purple-50 text-purple-700' },
  { value: 'partenariat', fr: 'Partenariats', ar: 'الشراches', color: 'bg-cyan-50 text-cyan-700' },
];

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
  isCurrent?: boolean;
};

function Avatar({ profile, size = 'md' }: { profile: PublicProfile; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-9 w-9 text-xs', md: 'h-12 w-12 text-sm', lg: 'h-24 w-24 text-2xl' };
  const initials = profile.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'R+';
  return (
    <div className={`${sizes[size]} relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 font-black text-white shadow-sm`}>
      {profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" /> : initials}
      {profile.logoUrl && <img src={profile.logoUrl} alt="Logo de la crèche" className="absolute bottom-0 right-0 h-5 w-5 rounded-md border-2 border-white bg-white object-contain" />}
    </div>
  );
}

export default function Community() {
  const { user, creche, updateProfile } = useAuth();
  const { language } = useLanguage();
  const {
    communityPosts,
    communityComments,
    communityReactions,
    addCommunityPost,
    repostCommunityPost,
    updateCommunityPost,
    deleteCommunityPost,
    addCommunityComment,
    deleteCommunityComment,
    toggleCommunityReaction,
  } = useDb();

  const isAr = language === 'ar';
  const isAdmin = user?.role === 'admin';
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

  const currentProfile: PublicProfile = useMemo(() => ({
    id: user?.id || '',
    name: fullName(user),
    avatarUrl: user?.avatarUrl,
    logoUrl: user?.logoUrl || creche?.logoUrl || undefined,
    bio: user?.bio,
    nomCreche: user?.nomCreche || creche?.nom,
    ville: user?.ville,
    siteWeb: user?.siteWeb,
    telephone: user?.telephone,
    isCurrent: true,
  }), [user, creche]);

  const profileFromPost = (post: CommunityPost): PublicProfile => {
    if (post.authorId === user?.id) return currentProfile;
    return {
      id: post.authorId,
      name: post.authorName || 'Directeur',
      avatarUrl: post.authorAvatarUrl,
      logoUrl: post.authorLogoUrl,
      bio: post.authorBio,
      nomCreche: post.nomCreche,
      ville: post.authorVille || post.ville,
      siteWeb: post.authorSiteWeb,
    };
  };

  const profiles = useMemo(() => {
    const map = new Map<string, PublicProfile>();
    if (user?.id) map.set(user.id, currentProfile);
    communityPosts.forEach(post => {
      if (!map.has(post.authorId)) map.set(post.authorId, profileFromPost(post));
    });
    return Array.from(map.values());
  }, [communityPosts, currentProfile, user?.id]);

  const selectedProfile = selectedProfileId ? profiles.find(profile => profile.id === selectedProfileId) || null : null;
  const selectedProfilePosts = selectedProfile ? communityPosts.filter(post => post.authorId === selectedProfile.id) : [];

  const filteredPosts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return [...communityPosts]
      .filter(post => activeCategory === 'tous' || post.categorie === activeCategory)
      .filter(post => activeView !== 'profile' || post.authorId === user?.id)
      .filter(post => activeView !== 'reposts' || Boolean(post.originalPostId))
      .filter(post => {
        if (!normalizedSearch) return true;
        return [post.authorName, post.nomCreche, post.titre, post.contenu, post.ville]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [communityPosts, activeCategory, activeView, search, user?.id]);

  if (!user || (!isAdmin && user.role !== 'directeur')) return null;

  const canManagePost = (post: CommunityPost) => isAdmin || post.authorId === user.id;
  const authorName = fullName(user);
  const crecheName = user.nomCreche || creche?.nom || (isAr ? 'روضة' : 'Crèche');

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
      setShowProfileEditor(false);
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
        authorAvatarUrl: user.avatarUrl || undefined,
        authorLogoUrl: user.logoUrl || creche.logoUrl || undefined,
        authorBio: user.bio || undefined,
        authorVille: user.ville || undefined,
        authorSiteWeb: user.siteWeb || undefined,
        crecheId: user.id,
        nomCreche: crecheName,
        categorie: form.categorie,
        titre: form.titre.trim() || undefined,
        contenu: form.contenu.trim(),
        ville: form.ville.trim() || user.ville || undefined,
        prix: form.prix.trim() ? Number(form.prix) : undefined,
        contact: form.contact.trim() || undefined,
        statut: 'publie',
        likesCount: 0,
        createdAt: new Date().toISOString(),
      });
      setForm(emptyForm);
      setShowComposer(false);
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
        authorAvatarUrl: user.avatarUrl || undefined,
        authorLogoUrl: user.logoUrl || creche.logoUrl || undefined,
        authorBio: user.bio || undefined,
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
    const category = categories.find(item => item.value === post.categorie);
    return (
      <article key={post.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
        {post.originalPostId && <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500"><Repeat2 className="h-4 w-4 text-indigo-600" />{post.authorName} {isAr ? 'أعاد النشر' : 'a republié une publication'}</div>}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <button type="button" onClick={() => setSelectedProfileId(profile.id)} className="flex min-w-0 items-center gap-3 text-left">
              <Avatar profile={profile} size="md" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 truncate text-sm font-black text-slate-900 hover:text-indigo-700">{profile.name}<Check className="h-4 w-4 shrink-0 rounded-full bg-indigo-600 p-0.5 text-white" /></span>
                <span className="mt-0.5 flex items-center gap-1 truncate text-xs font-semibold text-slate-500"><Building2 className="h-3.5 w-3.5" />{profile.nomCreche || 'Crèche'}{profile.ville ? ` · ${profile.ville}` : ''}</span>
                <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><Clock3 className="h-3 w-3" />{formatDate(post.createdAt, language)}</span>
              </span>
            </button>
            <div className="relative">
              <button type="button" onClick={() => setOpenMenu(openMenu === post.id ? null : post.id)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><MoreHorizontal className="h-5 w-5" /></button>
              {openMenu === post.id && <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {canManagePost(post) && <button type="button" onClick={() => { setOpenMenu(null); void deleteCommunityPost(post.id); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" />{isAr ? 'حذف' : 'Supprimer'}</button>}
                {isAdmin && <button type="button" onClick={() => { setOpenMenu(null); void updateCommunityPost(post.id, { statut: post.statut === 'masquee' ? 'publie' : 'masquee' }); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50"><ShieldCheck className="h-4 w-4" />{post.statut === 'masquee' ? 'Réafficher' : 'Masquer'}</button>}
              </div>}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${category?.color || 'bg-slate-100 text-slate-700'}`}><Tag className="mr-1 inline h-3 w-3" />{categoryLabel(post.categorie, language)}</span>{post.statut === 'masquee' && <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-black text-rose-700">Masquée</span>}</div>
          {post.titre && <h3 className="mt-3 text-lg font-black text-slate-900">{post.titre}</h3>}
          {post.contenu && <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{post.contenu}</p>}
          {post.contact && <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600"><span className="font-black text-slate-800">Contact : </span>{post.contact}</div>}

          {original && <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3"><Avatar profile={{ id: original.authorId || '', name: original.authorName || 'Directeur', avatarUrl: original.authorAvatarUrl, logoUrl: original.authorLogoUrl, nomCreche: original.nomCreche }} size="sm" /><div><p className="text-xs font-black text-slate-800">{original.authorName || 'Directeur'}</p><p className="text-[11px] font-semibold text-slate-500">{original.nomCreche || 'Crèche'}</p></div></div>
            {original.titre && <p className="mt-3 text-sm font-black text-slate-800">{original.titre}</p>}
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{original.contenu || ''}</p>
          </div>}

          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-slate-400"><span>{reactionCount(post.id)} J’aime</span><span>{comments.length} commentaire{comments.length > 1 ? 's' : ''} · {communityPosts.filter(item => item.originalPostId === post.id).length} republication{communityPosts.filter(item => item.originalPostId === post.id).length > 1 ? 's' : ''}</span></div>
          <div className="mt-2 grid grid-cols-3 gap-1 border-t border-slate-100 pt-2">
            <button type="button" onClick={() => void toggleCommunityReaction(post.id)} className={`inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-black transition ${isLiked(post.id) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-700'}`}><ThumbsUp className={`h-4 w-4 ${isLiked(post.id) ? 'fill-current' : ''}`} />J’aime</button>
            <button type="button" onClick={() => setExpandedComments(current => ({ ...current, [post.id]: !current[post.id] }))} className="inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-50 hover:text-indigo-700"><MessageCircle className="h-4 w-4" />Commenter</button>
            <button type="button" onClick={() => void handleRepost(post)} disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-50 hover:text-indigo-700 disabled:opacity-50"><Repeat2 className="h-4 w-4" />Republier</button>
          </div>
          <AnimatePresence initial={false}>{expandedComments[post.id] && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3">
            {comments.map(comment => <div key={comment.id} className="flex items-start gap-2 rounded-xl bg-white p-3"><Avatar profile={{ id: comment.authorId, name: comment.authorName, avatarUrl: comment.authorAvatarUrl, logoUrl: comment.authorLogoUrl, nomCreche: comment.nomCreche }} size="sm" /><div className="min-w-0 flex-1"><p className="text-xs font-black text-slate-800">{comment.authorName}<span className="ml-1 font-medium text-slate-400">· {comment.nomCreche}</span></p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{comment.contenu}</p><p className="mt-1 text-[10px] text-slate-400">{formatDate(comment.createdAt, language)}</p></div>{(isAdmin || comment.authorId === user.id) && <button type="button" onClick={() => void deleteCommunityComment(comment.id)} className="rounded-lg p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>}</div>)}
            <div className="flex items-end gap-2"><Avatar profile={currentProfile} size="sm" /><textarea value={commentDrafts[post.id] || ''} onChange={event => setCommentDrafts(current => ({ ...current, [post.id]: event.target.value }))} rows={1} maxLength={1000} className="min-h-[42px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-indigo-500" placeholder="Écrire un commentaire..." /><button type="button" onClick={() => void handleComment(post)} disabled={!commentDrafts[post.id]?.trim() || submitting} className="rounded-xl bg-indigo-600 p-3 text-white hover:bg-indigo-700 disabled:opacity-40"><Send className="h-4 w-4" /></button></div>
          </div></motion.div>}</AnimatePresence>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-full bg-slate-50 pb-14" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-600"><Sparkles className="h-4 w-4" />Rawdha Connect</div><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Votre réseau professionnel</h1><p className="mt-1 text-sm text-slate-500">Partagez, échangez et découvrez les crèches de la communauté.</p></div>
          <div className="flex items-center gap-2"><label className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm md:flex"><Search className="h-4 w-4 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher" className="w-44 bg-transparent text-sm outline-none" /></label><button type="button" onClick={() => setShowComposer(true)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700"><Plus className="h-4 w-4" />Nouvelle publication</button></div>
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"><button type="button" onClick={() => setActiveView('feed')} className={`rounded-xl px-4 py-2.5 text-sm font-black whitespace-nowrap ${activeView === 'feed' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Accueil</button><button type="button" onClick={() => { setActiveView('profile'); setSelectedProfileId(user.id); }} className={`rounded-xl px-4 py-2.5 text-sm font-black whitespace-nowrap ${activeView === 'profile' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Mon profil</button><button type="button" onClick={() => setActiveView('reposts')} className={`rounded-xl px-4 py-2.5 text-sm font-black whitespace-nowrap ${activeView === 'reposts' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Mes republications</button><div className="ml-auto hidden items-center gap-2 px-3 text-xs font-semibold text-slate-400 lg:flex"><Users className="h-4 w-4" />{profiles.length} profil{profiles.length > 1 ? 's' : ''} visible{profiles.length > 1 ? 's' : ''}</div></div>

        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
          <aside className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="h-20 bg-gradient-to-br from-slate-950 via-indigo-900 to-violet-700" /><div className="px-4 pb-4"><div className="-mt-8"><Avatar profile={currentProfile} size="lg" /></div><h2 className="mt-3 text-base font-black text-slate-900">{currentProfile.name}</h2><p className="mt-0.5 text-xs font-semibold text-slate-500">{currentProfile.nomCreche}</p><p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-500">{currentProfile.bio || 'Ajoutez une présentation professionnelle à votre profil.'}</p><button type="button" onClick={() => setShowProfileEditor(true)} className="mt-4 w-full rounded-xl border border-indigo-200 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-50">Modifier mon profil</button></div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="px-2 pb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">Explorer</p>{categories.map(category => <button type="button" key={category.value} onClick={() => { setActiveCategory(category.value); setActiveView('feed'); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-black transition ${activeCategory === category.value && activeView === 'feed' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${category.value === 'tous' ? 'bg-slate-400' : category.color.split(' ')[0].replace('bg-', 'bg-')}`} />{isAr ? category.ar : category.fr}</span><ChevronRight className="h-3.5 w-3.5 text-slate-300" /></button>)}</div>
          </aside>

          <main className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><Avatar profile={currentProfile} size="md" /><button type="button" onClick={() => setShowComposer(true)} className="flex-1 rounded-xl bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-400 hover:bg-indigo-50 hover:text-indigo-600">Quoi de neuf dans votre crèche ?</button></div><div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={() => setShowComposer(true)} className="inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"><ImageIcon className="h-4 w-4 text-emerald-500" />Photo / activité</button><button type="button" onClick={() => setShowComposer(true)} className="inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"><BriefcaseBusiness className="h-4 w-4 text-indigo-500" />Opportunité</button><button type="button" onClick={() => setShowComposer(true)} className="inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"><Tag className="h-4 w-4 text-amber-500" />Annonce</button></div></div>
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-black text-slate-900">{activeView === 'reposts' ? 'Mes republications' : activeView === 'profile' ? 'Mes publications' : 'Fil d’actualité'}</h2><p className="text-xs text-slate-500">{filteredPosts.length} publication{filteredPosts.length > 1 ? 's' : ''}</p></div><button type="button" onClick={() => setActiveCategory(activeCategory === 'tous' ? 'activite' : 'tous')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"><Tag className="h-3.5 w-3.5" />{categoryLabel(activeCategory === 'tous' ? 'activite' : activeCategory, language)}<ChevronDown className="h-3.5 w-3.5" /></button></div>
            {filteredPosts.length ? filteredPosts.map(renderPost) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Sparkles className="mx-auto h-8 w-8 text-indigo-400" /><h3 className="mt-3 text-base font-black text-slate-800">Aucune publication ici</h3><p className="mt-1 text-sm text-slate-500">Commencez une conversation avec votre réseau professionnel.</p><button type="button" onClick={() => setShowComposer(true)} className="mt-4 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white">Créer une publication</button></div>}
          </main>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-sm font-black text-slate-900">Profils à découvrir</h3><Users className="h-4 w-4 text-indigo-500" /></div><div className="mt-3 space-y-3">{profiles.filter(profile => profile.id !== user.id).slice(0, 4).map(profile => <button type="button" key={profile.id} onClick={() => setSelectedProfileId(profile.id)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50"><Avatar profile={profile} size="sm" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-slate-800">{profile.name}</span><span className="block truncate text-[11px] font-semibold text-slate-500">{profile.nomCreche || 'Crèche'}</span></span><ChevronRight className="h-4 w-4 text-slate-300" /></button>)}{profiles.length <= 1 && <p className="text-xs leading-5 text-slate-500">Les profils apparaîtront ici au fur et à mesure des publications de votre réseau.</p>}</div></div>
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-5 text-white shadow-lg shadow-indigo-700/20"><ShieldCheck className="h-6 w-6" /><h3 className="mt-3 text-base font-black">Réseau vérifié</h3><p className="mt-2 text-xs leading-5 text-indigo-100">Les directeurs peuvent présenter leur crèche, partager leurs pratiques et retrouver facilement les publications d’un auteur.</p></div>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {showComposer && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><motion.form initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onSubmit={handleSubmitPost} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl md:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-indigo-600">Nouvelle publication</p><h2 className="mt-1 text-xl font-black text-slate-900">Partager avec votre réseau</h2></div><button type="button" onClick={() => setShowComposer(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="mt-5 flex items-center gap-3 rounded-xl bg-slate-50 p-3"><Avatar profile={currentProfile} size="sm" /><div><p className="text-sm font-black text-slate-800">{authorName}</p><p className="text-xs font-semibold text-slate-500">{crecheName}</p></div></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs font-black text-slate-600">Catégorie<select value={form.categorie} onChange={event => setForm(current => ({ ...current, categorie: event.target.value as CommunityPostCategory }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500">{categories.filter(item => item.value !== 'tous').map(item => <option key={item.value} value={item.value}>{item.fr}</option>)}</select></label><label className="text-xs font-black text-slate-600">Titre<input value={form.titre} onChange={event => setForm(current => ({ ...current, titre: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder="Titre de votre publication" /></label><label className="text-xs font-black text-slate-600 md:col-span-2">Votre message<textarea required rows={5} maxLength={3000} value={form.contenu} onChange={event => setForm(current => ({ ...current, contenu: event.target.value }))} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 outline-none focus:border-indigo-500" placeholder="Partagez une idée, une activité, une opportunité..." /></label><label className="text-xs font-black text-slate-600">Ville<input value={form.ville} onChange={event => setForm(current => ({ ...current, ville: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder="Alger" /></label><label className="text-xs font-black text-slate-600">Contact<input value={form.contact} onChange={event => setForm(current => ({ ...current, contact: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder="Téléphone ou lien" /></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowComposer(false)} className="rounded-xl px-4 py-3 text-sm font-black text-slate-500 hover:bg-slate-100">Annuler</button><button type="submit" disabled={submitting || !form.contenu.trim()} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Publication...' : 'Publier'}</button></div></motion.form></motion.div>}

        {showProfileEditor && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSaveProfile} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl md:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-indigo-600">Profil public</p><h2 className="mt-1 text-2xl font-black text-slate-900">Construisez votre identité professionnelle</h2><p className="mt-2 text-sm leading-6 text-slate-500">Ces informations seront visibles lorsque quelqu’un ouvrira votre profil depuis une publication.</p></div><button type="button" onClick={() => setShowProfileEditor(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs font-black text-slate-600">Prénom<input required value={profileForm.prenom} onChange={event => setProfileForm(current => ({ ...current, prenom: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" /></label><label className="text-xs font-black text-slate-600">Nom<input required value={profileForm.nom} onChange={event => setProfileForm(current => ({ ...current, nom: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" /></label><label className="text-xs font-black text-slate-600 md:col-span-2">Nom de la crèche<input value={profileForm.nomCreche} onChange={event => setProfileForm(current => ({ ...current, nomCreche: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" /></label><label className="text-xs font-black text-slate-600">Photo de profil (URL)<input value={profileForm.avatarUrl} onChange={event => setProfileForm(current => ({ ...current, avatarUrl: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder="https://..." /></label><label className="text-xs font-black text-slate-600">Logo de la crèche (URL)<input value={profileForm.logoUrl} onChange={event => setProfileForm(current => ({ ...current, logoUrl: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder="https://..." /></label><label className="text-xs font-black text-slate-600">Ville<input value={profileForm.ville} onChange={event => setProfileForm(current => ({ ...current, ville: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" /></label><label className="text-xs font-black text-slate-600">Téléphone<input value={profileForm.telephone} onChange={event => setProfileForm(current => ({ ...current, telephone: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" /></label><label className="text-xs font-black text-slate-600 md:col-span-2">Site web<input value={profileForm.siteWeb} onChange={event => setProfileForm(current => ({ ...current, siteWeb: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder="https://..." /></label><label className="text-xs font-black text-slate-600 md:col-span-2">Présentation<textarea rows={4} maxLength={500} value={profileForm.bio} onChange={event => setProfileForm(current => ({ ...current, bio: event.target.value }))} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 outline-none focus:border-indigo-500" placeholder="Présentez votre parcours et votre crèche..." /></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowProfileEditor(false)} className="rounded-xl px-4 py-3 text-sm font-black text-slate-500 hover:bg-slate-100">Annuler</button><button type="submit" disabled={profileSaving} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50">{profileSaving ? 'Enregistrement...' : 'Enregistrer le profil'}</button></div></motion.form></motion.div>}

        {selectedProfile && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"><motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-slate-50 shadow-2xl"><div className="relative h-32 bg-gradient-to-br from-slate-950 via-indigo-900 to-violet-700 md:h-44"><button type="button" onClick={() => setSelectedProfileId(null)} className="absolute right-4 top-4 rounded-xl bg-white/15 p-2 text-white hover:bg-white/25"><X className="h-5 w-5" /></button></div><div className="px-5 pb-6 md:px-8"><div className="-mt-12 flex flex-col gap-4 md:-mt-14 md:flex-row md:items-end md:justify-between"><div className="flex items-end gap-4"><Avatar profile={selectedProfile} size="lg" /><div className="pb-1"><div className="flex items-center gap-2"><h2 className="text-xl font-black text-slate-900">{selectedProfile.name}</h2><span className="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-black text-indigo-700">Profil vérifié</span></div><p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-500"><Building2 className="h-4 w-4" />{selectedProfile.nomCreche || 'Crèche'}{selectedProfile.ville ? ` · ${selectedProfile.ville}` : ''}</p></div></div>{selectedProfile.isCurrent && <button type="button" onClick={() => { setSelectedProfileId(null); setShowProfileEditor(true); }} className="rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-50">Modifier mon profil</button>}</div><div className="mt-5 grid gap-4 md:grid-cols-[1fr_220px]"><div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-black text-slate-900">À propos</h3><p className="mt-2 text-sm leading-6 text-slate-600">{selectedProfile.bio || 'Ce directeur n’a pas encore ajouté de présentation.'}</p><div className="mt-4 space-y-2 text-xs font-semibold text-slate-500">{selectedProfile.ville && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-500" />{selectedProfile.ville}</p>}{selectedProfile.telephone && <p className="flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-indigo-500" />{selectedProfile.telephone}</p>}{selectedProfile.siteWeb && <a href={selectedProfile.siteWeb} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline"><Globe2 className="h-4 w-4" />{selectedProfile.siteWeb}</a>}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Activité</p><p className="mt-3 text-2xl font-black text-slate-900">{selectedProfilePosts.length}</p><p className="text-xs font-semibold text-slate-500">publication{selectedProfilePosts.length > 1 ? 's' : ''}</p><p className="mt-4 text-2xl font-black text-slate-900">{selectedProfilePosts.filter(post => post.originalPostId).length}</p><p className="text-xs font-semibold text-slate-500">republication{selectedProfilePosts.filter(post => post.originalPostId).length > 1 ? 's' : ''}</p></div></div><div className="mt-5 flex items-center justify-between"><h3 className="text-lg font-black text-slate-900">Publications de {selectedProfile.name}</h3><button type="button" onClick={() => setSelectedProfileId(null)} className="text-xs font-black text-indigo-600">Retour au fil</button></div><div className="mt-3 space-y-4">{selectedProfilePosts.length ? selectedProfilePosts.map(renderPost) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Aucune publication pour le moment.</div>}</div></div></motion.div></motion.div>}
      </AnimatePresence>
    </div>
  );
}
