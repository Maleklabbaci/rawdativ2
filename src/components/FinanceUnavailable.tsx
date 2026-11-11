import { AlertCircle, RefreshCw } from 'lucide-react';
import { useDb } from '../contexts/DbContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

/** A failed or pending read is never presented as a zero balance. */
export default function FinanceUnavailable() {
  const { refreshAll } = useDb();
  const { user } = useAuth();
  const unapproved = user?.role === 'directeur' && user.approvalStatus !== 'approved';
  const { language } = useLanguage();
  const ar = language === 'ar';
  return <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
    <div className="flex items-start gap-2.5">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
      <p>{unapproved ? (ar ? 'البيانات المالية غير متاحة إلى أن يوافق المسؤول على الحساب. لا يعني ذلك عدم وجود فواتير.' : 'Données financières indisponibles tant que le compte n’est pas approuvé. Cela ne signifie pas qu’il n’existe aucune facture.') : (ar ? 'تعذر تأكيد تحميل ملفات الأطفال أو الفواتير. لا تعتمد على الأرصدة حتى يتم تحديث البيانات.' : 'Chargement des enfants ou des factures non confirmé. Ne vous fiez pas aux soldes avant actualisation.')}</p>
    </div>
    {!unapproved && <button type="button" onClick={() => void refreshAll()} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-900 px-3.5 py-2 text-xs font-black text-white transition hover:bg-amber-950"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />{ar ? 'إعادة تحميل البيانات' : 'Recharger les données'}</button>}
  </div>;
}
