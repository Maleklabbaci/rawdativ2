import { FormEvent, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Archive,
  Building2,
  Check,
  ChevronDown,
  Clock3,
  Filter,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  ShieldCheck,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { CommunityPost, CommunityPostCategory } from '../types';

const categories: Array<{ value: CommunityPostCategory | 'tous'; fr: string; ar: string; color: string }> = [
  { value: 'tous', fr: 'Tout le fil', ar: 'كل المنشورات', color: 'bg-slate-100 text-slate-700' },
  { value: 'activite', fr: 'Activités & méthodes', ar: 'الأنشطة والأساليب', color: 'bg-indigo-50 text-indigo-700' },
  { value: 'materiel', fr: 'Matériel', ar: 'المعدات', color: 'bg-amber-50 text-amber-700' },
  { value: 'vente_echange', fr: 'Vente & échange', ar: 'البيع والتبادل', color: 'bg-emerald-50 text-emerald-700' },
  { value: 'recrutement', fr: 'Recrutement', ar: 'التوظيف', color: 'bg-rose-50 text-rose-700' },
  { value: 'formation', fr: 'Formations', ar: 'التكوين', color: 'bg-purple-50 text-purple-700' },
  { value: 'partenariat', fr: 'Partenariats', ar: 'الشراكات', color: 'bg-cyan-50 text-cyan-700' },
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

export default function Community() {
  const { user, creche } = useAuth();
  const { language } = useLanguage();
  const {
    communityPosts,
    communityComments,
    communityReactions,
    addCommunityPost,
    updateCommunityPost,
    deleteCommunityPost,
    addCommunityComment,
    deleteCommunityComment,
    toggleCommunityReaction,
  } = useDb();

  const isAr = language === 'ar';
  const isAdmin = user?.role === 'admin';
  const isDirector = user?.role === 'directeur';
  const [activeCategory, setActiveCategory] = useState<CommunityPostCategory | 'tous'>('tous');
  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filteredPosts = useMemo(() => {
    return [...communityPosts]
      .filter(post => activeCategory === 'tous' || post.categorie === activeCategory)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [communityPosts, activeCategory]);

  if (!user || (!isAdmin && !isDirector)) {
    return null;
  }

  const canManagePost = (post: CommunityPost) => isAdmin || post.authorId === user.id;
  const authorName = `${user.prenom || ''} ${user.nom || ''}`.trim() || user.email;
  const crecheName = creche?.nom || user.nomCreche || (isAr ? 'روضة' : 'Crèche');

  const handleSubmitPost = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.contenu.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addCommunityPost({
        authorId: user.id,
        authorName,
        crecheId: user.id,
        nomCreche: crecheName,
        categorie: form.categorie,
        titre: form.titre.trim() || undefined,
        contenu: form.contenu.trim(),
        ville: form.ville.trim() || undefined,
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

  const handleDeletePost = async (post: CommunityPost) => {
    if (!canManagePost(post)) return;
    const confirmed = window.confirm(isAr ? 'هل تريد حذف هذا المنشور نهائياً؟' : 'Supprimer définitivement cette publication ?');
    if (!confirmed) return;
    await deleteCommunityPost(post.id);
    setOpenMenu(null);
  };

  const handleHidePost = async (post: CommunityPost) => {
    if (!isAdmin) return;
    await updateCommunityPost(post.id, {
      statut: post.statut === 'masquee' ? 'publie' : 'masquee',
      updatedAt: new Date().toISOString(),
    });
    setOpenMenu(null);
  };

  const getPostComments = (postId: string) => communityComments
    .filter(comment => comment.postId === postId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const isLiked = (postId: string) => communityReactions.some(reaction => reaction.postId === postId && reaction.userId === user.id);
  const reactionCount = (postId: string) => communityReactions.filter(reaction => reaction.postId === postId).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12" dir={isAr ? 'rtl' : 'ltr'}>
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-6 py-8 text-white shadow-2xl shadow-indigo-900/20 md:px-9">
        <div className="absolute -top-20 right-0 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-fuchsia-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-indigo-100">
              <ShieldCheck className="h-4 w-4" />
              {isAr ? 'مجتمع مهني خاص بالروضات' : 'Communauté professionnelle privée'}
            </div>
                          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              {isAr ? 'Rawdha Connect' : 'Rawdha Connect'}
              </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100/80 md:text-base">
              {isAr
                ? 'تبادلوا الخبرات والأنشطة والمعدات والفرص بين الروضات الموثوقة فقط.'
                : 'Le fil social des professionnels de la petite enfance : publiez, réagissez, commentez et échangez entre crèches vérifiées.'}
            </p>
          </div>
          {isDirector && (
            <button
              type="button"
              onClick={() => setShowComposer(value => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-indigo-800 shadow-lg shadow-black/10 transition hover:bg-indigo-50"
            >
              {showComposer ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showComposer ? (isAr ? 'إغلاق' : 'Fermer') : (isAr ? 'منشور جديد' : 'Nouvelle publication')}
            </button>
          )}
        </div>
        <div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 md:grid-cols-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-100"><Building2 className="h-4 w-4 text-indigo-300" />{isAr ? 'روضات موثوقة' : 'Crèches vérifiées'}</div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-100"><Users className="h-4 w-4 text-indigo-300" />{isAr ? 'تبادل مهني' : 'Échanges professionnels'}</div>
          <div className="hidden items-center gap-2 text-xs font-semibold text-indigo-100 md:flex"><ShieldCheck className="h-4 w-4 text-indigo-300" />{isAr ? 'إشراف الإدارة' : 'Modération admin'}</div>
        </div>
      </section>

      <AnimatePresence initial={false}>
        {showComposer && isDirector && (
          <motion.form
            initial={{ opacity: 0, y: -12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -12, height: 0 }}
            onSubmit={handleSubmitPost}
            className="overflow-hidden rounded-3xl border border-indigo-100 bg-white p-5 shadow-xl shadow-indigo-100/40 md:p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-900">{isAr ? 'شارك مع مجتمع الروضات' : 'Publier dans la communauté'}</p>
                <p className="mt-1 text-xs text-slate-500">{isAr ? 'تجنب مشاركة بيانات الأطفال أو الأولياء.' : 'Ne partagez jamais de données d’enfants ou de parents.'}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Send className="h-5 w-5" /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">
                {isAr ? 'الفئة' : 'Catégorie'}
                <select value={form.categorie} onChange={event => setForm({ ...form, categorie: event.target.value as CommunityPostCategory })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500">
                  {categories.filter(item => item.value !== 'tous').map(item => <option key={item.value} value={item.value}>{isAr ? item.ar : item.fr}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">
                {isAr ? 'العنوان (اختياري)' : 'Titre (facultatif)'}
                <input value={form.titre} onChange={event => setForm({ ...form, titre: event.target.value })} maxLength={120} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder={isAr ? 'مثلاً: ألعاب تربوية للبيع' : 'Ex. : Jeux pédagogiques à vendre'} />
              </label>
              <label className="text-sm font-bold text-slate-700 md:col-span-2">
                {isAr ? 'المحتوى' : 'Contenu'}
                <textarea required value={form.contenu} onChange={event => setForm({ ...form, contenu: event.target.value })} maxLength={4000} rows={5} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 outline-none focus:border-indigo-500" placeholder={isAr ? 'اكتب منشورك المهني هنا...' : 'Décrivez votre publication professionnelle...'} />
              </label>
              <label className="text-sm font-bold text-slate-700">
                {isAr ? 'المدينة (اختياري)' : 'Ville (facultatif)'}
                <input value={form.ville} onChange={event => setForm({ ...form, ville: event.target.value })} maxLength={80} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder={isAr ? 'الجزائر' : 'Alger'} />
              </label>
              <label className="text-sm font-bold text-slate-700">
                {isAr ? 'السعر بالدينار (اختياري)' : 'Prix en DA (facultatif)'}
                <input type="number" min="0" value={form.prix} onChange={event => setForm({ ...form, prix: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder="0" />
              </label>
              <label className="text-sm font-bold text-slate-700 md:col-span-2">
                {isAr ? 'وسيلة تواصل مهنية (اختياري)' : 'Contact professionnel (facultatif)'}
                <input value={form.contact} onChange={event => setForm({ ...form, contact: event.target.value })} maxLength={120} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" placeholder={isAr ? 'رقم الهاتف أو البريد المهني' : 'Téléphone ou e-mail professionnel'} />
              </label>
            </div>
            <div className="mt-5 flex justify-end">
              <button type="submit" disabled={submitting || !form.contenu.trim()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Send className="h-4 w-4" />{isAr ? 'نشر' : 'Publier'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">{isAr ? 'آخر المنشورات' : 'Fil Rawdha Connect'}</h2>
          <p className="mt-1 text-sm text-slate-500">{isAr ? 'مساحة مغلقة بين مهنيي الطفولة.' : 'Un espace fermé entre professionnels de la petite enfance.'}</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="h-4 w-4 shrink-0 text-slate-400" />
          {categories.map(category => (
            <button key={category.value} type="button" onClick={() => setActiveCategory(category.value)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold transition ${activeCategory === category.value ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-700'}`}>
              {isAr ? category.ar : category.fr}
            </button>
          ))}
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <Building2 className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-4 text-base font-black text-slate-700">{isAr ? 'لا توجد منشورات بعد' : 'Aucune publication pour le moment'}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{isAr ? 'كن أول روضة تشارك نشاطاً أو إعلاناً مهنياً.' : 'Soyez la première crèche à partager une activité ou une annonce professionnelle.'}</p>
        </div>
      ) : (
        <div className="grid gap-5">
          {filteredPosts.map(post => {
            const comments = getPostComments(post.id);
            const liked = isLiked(post.id);
            const category = categories.find(item => item.value === post.categorie);
            return (
              <motion.article layout key={post.id} className={`rounded-3xl border bg-white p-5 shadow-sm transition hover:shadow-lg md:p-6 ${post.statut === 'masquee' ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-black text-white">{post.nomCreche.slice(0, 2).toUpperCase()}</div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-slate-900">{post.nomCreche}</p>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700"><Check className="h-3 w-3" />{isAr ? 'موثقة' : 'Vérifiée'}</span>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-400"><Clock3 className="h-3 w-3" />{formatDate(post.createdAt, language)} · {post.authorName}</p>
                    </div>
                  </div>
                  {(canManagePost(post) || isAdmin) && (
                    <div className="relative">
                      <button type="button" onClick={() => setOpenMenu(openMenu === post.id ? null : post.id)} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><MoreHorizontal className="h-5 w-5" /></button>
                      {openMenu === post.id && (
                        <div className={`absolute top-10 z-20 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ${isAr ? 'left-0' : 'right-0'}`}>
                          {isAdmin && <button type="button" onClick={() => void handleHidePost(post)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-xs font-bold text-slate-600 hover:bg-slate-50"><Archive className="h-4 w-4" />{post.statut === 'masquee' ? (isAr ? 'إظهار' : 'Réafficher') : (isAr ? 'إخفاء' : 'Masquer')}</button>}
                          <button type="button" onClick={() => void handleDeletePost(post)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-xs font-bold text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" />{isAr ? 'حذف نهائي' : 'Supprimer définitivement'}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-black ${category?.color || 'bg-slate-100 text-slate-700'}`}><Tag className="h-3 w-3" />{categoryLabel(post.categorie, language)}</span>
                    {post.ville && <span className="text-xs font-semibold text-slate-400">{post.ville}</span>}
                    {post.prix !== undefined && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700">{post.prix.toLocaleString('fr-DZ')} DA</span>}
                    {post.statut === 'masquee' && <span className="rounded-full bg-rose-100 px-3 py-1.5 text-[11px] font-black text-rose-700">{isAr ? 'مخفية' : 'Masquée par l’admin'}</span>}
                  </div>
                  {post.titre && <h3 className="text-lg font-black text-slate-900">{post.titre}</h3>}
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{post.contenu}</p>
                  {post.contact && <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600"><span className="font-black text-slate-800">{isAr ? 'تواصل: ' : 'Contact : '}</span>{post.contact}</div>}
                </div>

                <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
                  <ReactionButton postId={post.id} liked={liked} count={reactionCount(post.id)} onToggle={() => toggleCommunityReaction(post.id)} isAr={isAr} />
                  <button type="button" onClick={() => setExpandedComments(current => ({ ...current, [post.id]: !current[post.id] }))} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-slate-50 hover:text-indigo-600"><MessageCircle className="h-4 w-4" />{comments.length} {isAr ? 'تعليق' : 'commentaires'}</button>
                </div>

                <AnimatePresence initial={false}>
                  {expandedComments[post.id] && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
                        {comments.map(comment => (
                          <div key={comment.id} className="flex items-start justify-between gap-3 rounded-xl bg-white p-3">
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-800">{comment.nomCreche} <span className="font-medium text-slate-400">· {comment.authorName}</span></p>
                              <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{comment.contenu}</p>
                              <p className="mt-1 text-[10px] text-slate-400">{formatDate(comment.createdAt, language)}</p>
                            </div>
                            {(isAdmin || comment.authorId === user.id) && <button type="button" onClick={() => void deleteCommunityComment(comment.id)} className="shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>}
                          </div>
                        ))}
                        <div className="flex items-end gap-2">
                          <textarea value={commentDrafts[post.id] || ''} onChange={event => setCommentDrafts(current => ({ ...current, [post.id]: event.target.value }))} rows={2} maxLength={1000} className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-500" placeholder={isAr ? 'أضف تعليقاً مهنياً...' : 'Ajouter un commentaire professionnel...'} />
                          <button type="button" onClick={() => void handleComment(post)} disabled={!commentDrafts[post.id]?.trim() || submitting} className="rounded-xl bg-indigo-600 p-3 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReactionButton({ postId, liked, count, onToggle, isAr }: { postId: string; liked: boolean; count: number; onToggle: () => Promise<void>; isAr: boolean }) {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onToggle();
    } finally {
      setLoading(false);
    }
  };
  return (
    <button type="button" onClick={() => void handleClick()} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${liked ? 'bg-rose-50 text-rose-600' : 'text-slate-500 hover:bg-rose-50 hover:text-rose-600'} ${loading ? 'opacity-60' : ''}`}>
      <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />{count} {isAr ? 'إعجاب' : 'J’aime'}
    </button>
  );
}
