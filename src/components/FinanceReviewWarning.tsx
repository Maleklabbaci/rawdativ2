import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function FinanceReviewWarning({ count, suspected = 0, invalid = 0 }: { count: number; suspected?: number; invalid?: number }) {
  const { language } = useLanguage();
  if (!count && !suspected && !invalid) return null;
  return <div role="status" className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-semibold leading-5 text-amber-900">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
    <div className="min-w-0 space-y-1">
      {count > 0 && <p>{language === 'ar' ? `${count} فاتورة قديمة دون فترة مراجَعة.` : `${count} facture(s) historique(s) sans période revue.`}</p>}
      {suspected > 0 && <p>{language === 'ar' ? `${suspected} فاتورة مرتبطة باشتباه تكرار؛ لم تُلغَ وهي ما زالت ضمن الإجماليات.` : `${suspected} facture(s) liée(s) à un soupçon de doublon ; elles ne sont pas annulées et restent dans les totaux.`}</p>}
      {invalid > 0 && <p>{language === 'ar' ? `${invalid} فاتورة بمبلغ أو حالة تحتاج للتحقق؛ حجبت مؤشرات المبالغ.` : `${invalid} facture(s) avec montant ou statut à vérifier ; les indicateurs de montants sont masqués.`}</p>}
      <p className="text-amber-800">{language === 'ar' ? 'قد تتضمن الأرصدة فواتير مكررة؛ تحقق منها قبل الاعتماد على الأرقام.' : 'Les totaux peuvent inclure des doublons ; vérifiez-les avant de vous y fier.'}</p>
    </div>
  </div>;
}
