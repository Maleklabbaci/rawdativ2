import { Clock, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  dateFinAbonnement?: string; // format 'YYYY-MM-DD'
  abonnementActif?: boolean;
  onClick?: () => void;
}

// ✅ Badge dans le header montrant au directeur combien de jours il lui reste
// (essai gratuit ou abonnement payant), ou la date de fin s'il reste plus de 7 jours.
export default function SubscriptionStatusBadge({ dateFinAbonnement, abonnementActif, onClick }: Props) {
  const { isFrench } = useLanguage();

  if (!abonnementActif || !dateFinAbonnement) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(dateFinAbonnement + 'T00:00:00');
  const joursRestants = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const dateFormatee = end.toLocaleDateString(isFrench ? 'fr-FR' : 'ar-DZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  // Déjà expiré : App.tsx affiche déjà l'écran de blocage dans ce cas, donc pas la peine d'afficher un badge ici.
  if (joursRestants < 0) return null;

  const urgent = joursRestants <= 7;

  const texte = joursRestants <= 7
    ? (isFrench
        ? `Il te reste ${joursRestants} jour${joursRestants > 1 ? 's' : ''}`
        : `تبقى لك ${joursRestants} يوم`)
    : (isFrench
        ? `Abonnement actif jusqu'au ${dateFormatee}`
        : `الاشتراك ساري حتى ${dateFormatee}`);

  const className = `min-h-8! flex min-w-0 max-w-full items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap overflow-hidden transition ${
    urgent ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100/80' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
  } ${onClick ? 'cursor-pointer' : ''}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={isFrench ? `Fin le ${dateFormatee} · Ouvrir la page de paiement` : `ينتهي في ${dateFormatee} · فتح صفحة الدفع`}
        className={className}
      >
        {urgent ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> : <Clock className="w-3.5 h-3.5 flex-shrink-0" />}
        <span className="min-w-0 truncate">{texte}</span>
      </button>
    );
  }

  return (
    <div
      title={isFrench ? `Fin le ${dateFormatee}` : `ينتهي في ${dateFormatee}`}
      className={className}
    >
      {urgent ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> : <Clock className="w-3.5 h-3.5 flex-shrink-0" />}
      <span className="min-w-0 truncate">{texte}</span>
    </div>
  );
}
