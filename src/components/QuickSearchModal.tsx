import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Baby,
  CalendarCheck,
  CreditCard,
  FileText,
  MessageCircle,
  Phone,
  School,
  Search,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDb } from '../contexts/DbContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Enfant } from '../types';
import { normalizeTelHref, normalizeWhatsAppNumber } from '../hooks/useMobileViewport';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
  onOpenChildDossier: (enfant: Enfant) => void;
}

export default function QuickSearchModal({
  isOpen,
  onClose,
  onNavigate,
  onOpenChildDossier,
}: QuickSearchModalProps) {
  const { user } = useAuth();
  const { enfants, classes, paiements, comptes } = useDb();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const isAdmin = user?.role === 'admin';
  const visibleChildren = useMemo(
    () => (user?.role === 'directeur' ? enfants.filter(child => child.crecheId === user.id) : enfants),
    [enfants, user]
  );

  const quickShortcuts = useMemo(
    () =>
      isAdmin
        ? [
            { page: 'admin', fr: 'Centre Administrateur', ar: 'مركز الإدارة' },
            { page: 'comptes', fr: 'Directeurs de crèches', ar: 'مدراء الروضات' },
            { page: 'communication', fr: 'Messages & Avis', ar: 'الرسائل والتقييمات' },
            { page: 'notifications', fr: 'Annonces officielles', ar: 'الإعلانات الرسمية' },
            { page: 'parametres', fr: 'Paramètres', ar: 'الإعدادات' },
          ]
        : [
            { page: 'presences', fr: 'Appel & Présences du jour', ar: 'تسجيل حضور اليوم' },
            { page: 'enfants', fr: 'Dossiers enfants', ar: 'ملفات الأطفال' },
            { page: 'paiements', fr: 'Factures & règlements', ar: 'الفواتير والمدفوعات' },
            { page: 'admissions', fr: 'Demandes d’admission QR', ar: 'طلبات التسجيل' },
            { page: 'classes', fr: 'Classes & groupes', ar: 'الأقسام والأفواج' },
            { page: 'repas', fr: 'Menus & repas', ar: 'الوجبات والقوائم' },
            { page: 'achats', fr: 'Achats & dépenses', ar: 'المشتريات والمصاريف' },
            { page: 'rapports', fr: 'Rapports mensuels', ar: 'التقارير الشهرية' },
          ],
    [isAdmin]
  );

  const normalized = query.trim().toLowerCase();
  const queryDigits = query.replace(/\D/g, '');

  const matchingChildren = useMemo(() => {
    if (isAdmin) return [];
    if (!normalized) return visibleChildren.filter(child => child.statut === 'Actif').slice(0, 5);
    return visibleChildren
      .filter(child => {
        const fullName = `${child.prenom} ${child.nom} ${child.nom} ${child.prenom}`.toLowerCase();
        if (fullName.includes(normalized)) return true;
        return (child.parents || []).some(parent => {
          const parentName = (parent.nom || '').toLowerCase();
          const parentDigits = (parent.telephone || '').replace(/\D/g, '');
          return parentName.includes(normalized) || (queryDigits.length >= 3 && parentDigits.includes(queryDigits));
        });
      })
      .slice(0, 8);
  }, [isAdmin, normalized, queryDigits, visibleChildren]);

  const matchingAccounts = useMemo(() => {
    if (!isAdmin) return [];
    const directors = comptes.filter(account => account.role === 'directeur');
    if (!normalized) return directors.slice(0, 6);
    return directors
      .filter(account => {
        const text = `${account.prenom || ''} ${account.nom || ''} ${account.nomCreche || ''} ${account.email || ''}`.toLowerCase();
        const phoneDigits = (account.telephone || '').replace(/\D/g, '');
        return text.includes(normalized) || (queryDigits.length >= 3 && phoneDigits.includes(queryDigits));
      })
      .slice(0, 8);
  }, [comptes, isAdmin, normalized, queryDigits]);

  const matchingClasses = useMemo(() => {
    if (isAdmin || !normalized) return [];
    return classes
      .filter(cls => (user?.role === 'directeur' ? !cls.crecheId || cls.crecheId === user.id : true))
      .filter(cls => `${cls.nom} ${cls.niveau || ''}`.toLowerCase().includes(normalized))
      .slice(0, 4);
  }, [classes, isAdmin, normalized, user]);

  const matchingShortcuts = useMemo(() => {
    if (!normalized) return quickShortcuts;
    return quickShortcuts.filter(item => `${item.fr} ${item.ar}`.toLowerCase().includes(normalized));
  }, [normalized, quickShortcuts]);

  if (!isOpen) return null;

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-label={isArabic ? 'البحث السريع' : 'Recherche rapide'}
      className="fixed inset-0 z-[1100] flex items-start justify-center bg-slate-950/65 p-2 pt-3 backdrop-blur-xs sm:p-4 sm:pt-12"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-indigo-600" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={
              isAdmin
                ? isArabic
                  ? 'ابحث عن روضة، مدير، هاتف أو أداة...'
                  : 'Chercher une crèche, un directeur, un téléphone…'
                : isArabic
                ? 'ابحث عن طفل، ولي أمر، رقم هاتف أو صفحة...'
                : 'Enfant, parent, téléphone (ex: 0550…) ou page…'
            }
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm font-bold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={isArabic ? 'مسح البحث' : 'Effacer la saisie'}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-extrabold text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            {isArabic ? 'إغلاق' : 'Fermer'}
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
          {!isAdmin && matchingChildren.length > 0 && (
            <section className="space-y-2">
              <p className="px-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
                {normalized
                  ? isArabic
                    ? `الأطفال وأولياء الأمور (${matchingChildren.length})`
                    : `Enfants & parents (${matchingChildren.length})`
                  : isArabic
                  ? 'وصول سريع لملفات الأطفال'
                  : 'Accès rapide aux enfants'}
              </p>
              <div className="space-y-2">
                {matchingChildren.map(child => {
                  const primaryParent = child.parents?.[0];
                  const telHref = normalizeTelHref(primaryParent?.telephone);
                  const waNum = normalizeWhatsAppNumber(primaryParent?.telephone);
                  const unpaidCount = paiements.filter(
                    inv => inv.enfantId === child.id && (inv.statut === 'En attente' || inv.statut === 'Retard')
                  ).length;

                  return (
                    <div
                      key={child.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenChildDossier(child);
                            onClose();
                          }}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-start cursor-pointer"
                        >
                          <span
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-black text-white ${
                              child.genre === 'Fille' ? 'bg-pink-500' : 'bg-sky-500'
                            }`}
                          >
                            {(child.prenom?.[0] || '') + (child.nom?.[0] || '')}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">
                              {child.prenom} {child.nom}
                            </p>
                            <p className="truncate text-xs font-semibold text-slate-500">
                              {primaryParent
                                ? `${primaryParent.nom}${primaryParent.telephone ? ` · ${primaryParent.telephone}` : ''}`
                                : isArabic
                                ? 'لا يوجد ولي مسجل'
                                : 'Parent non renseigné'}
                            </p>
                          </div>
                        </button>
                        {unpaidCount > 0 && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                            {isArabic ? `${unpaidCount} غير مسددة` : `${unpaidCount} en attente`}
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenChildDossier(child);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {isArabic ? 'الملف' : 'Dossier'}
                        </button>
                        {telHref && (
                          <a
                            href={telHref}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                          >
                            <Phone className="h-3.5 w-3.5 text-indigo-600" />
                            {isArabic ? 'اتصال' : 'Appeler'}
                          </a>
                        )}
                        {waNum && (
                          <a
                            href={`https://wa.me/${waNum}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WhatsApp
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            onNavigate('presences');
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />
                          {isArabic ? 'الحضور' : 'Présence'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onNavigate('paiements');
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          <CreditCard className="h-3.5 w-3.5 text-cyan-600" />
                          {isArabic ? 'الفواتير' : 'Factures'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {isAdmin && matchingAccounts.length > 0 && (
            <section className="space-y-2">
              <p className="px-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
                {isArabic ? 'الروضات والمدراء' : 'Crèches & directeurs'}
              </p>
              <div className="space-y-1.5">
                {matchingAccounts.map(account => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => {
                      onNavigate('comptes');
                      onClose();
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-start hover:border-indigo-200 hover:bg-indigo-50/40 cursor-pointer"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
                        <User className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-slate-900">
                          {account.nomCreche || `${account.prenom || ''} ${account.nom || ''}`}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {account.prenom} {account.nom} {account.telephone ? `· ${account.telephone}` : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {matchingClasses.length > 0 && (
            <section className="space-y-2">
              <p className="px-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
                {isArabic ? 'الأقسام' : 'Classes'}
              </p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {matchingClasses.map(cls => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => {
                      onNavigate('classes');
                      onClose();
                    }}
                    className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-start hover:border-amber-200 hover:bg-amber-50/40 cursor-pointer"
                  >
                    <School className="h-4 w-4 shrink-0 text-amber-600" />
                    <span className="truncate text-xs font-extrabold text-slate-800">{cls.nom}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {matchingShortcuts.length > 0 && (
            <section className="space-y-2">
              <p className="px-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
                {isArabic ? 'الانتقال السريع' : 'Aller directement à'}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {matchingShortcuts.map(item => (
                  <button
                    key={item.page}
                    type="button"
                    onClick={() => {
                      onNavigate(item.page);
                      onClose();
                    }}
                    className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-start text-xs font-bold text-slate-700 shadow-2xs transition hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    <span className="truncate">{isArabic ? item.ar : item.fr}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {normalized &&
            matchingChildren.length === 0 &&
            matchingAccounts.length === 0 &&
            matchingClasses.length === 0 &&
            matchingShortcuts.length === 0 && (
              <div className="py-8 text-center">
                <Baby className="mx-auto h-9 w-9 text-slate-300" />
                <p className="mt-2 text-sm font-extrabold text-slate-600">
                  {isArabic ? 'لا توجد نتائج مطابقة' : 'Aucun résultat pour cette recherche'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {isArabic
                    ? 'جرّبي اسم الطفل، اسم الولي أو جزءاً من رقم الهاتف.'
                    : 'Essayez un prénom d’enfant, un nom de parent ou quelques chiffres du téléphone.'}
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
