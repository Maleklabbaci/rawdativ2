export function financeErrorKind(error: unknown): 'legacy' | 'overlap' | 'changed' | 'invalid' | 'blocked' | 'unknown' {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
  if (message.includes('finance_duplicate_review_pending')) return 'blocked';
  if (message.includes('finance_review_request_conflict')) return 'changed';
  if (message.includes('finance_legacy_review_required')) return 'legacy';
  if (message.includes('finance_period_overlap') || message.includes('finance_request_id_conflict')) return 'overlap';
  if (message.includes('finance_changed') || message.includes('finance_review_already_classified')) return 'changed';
  if (/finance_invalid_|finance_child_inactive|finance_identity_immutable/.test(message)) return 'invalid';
  return 'unknown';
}
export function financeErrorMessage(error: unknown, ar: boolean): string {
  switch (financeErrorKind(error)) {
    case 'blocked': return ar ? 'توجد شبهة تكرار قيد المراجعة. لم تُلغَ أي فاتورة؛ أعد تحميل البيانات وراجع السجل.' : 'Un doublon suspect est en cours de vérification. Aucune facture n’a été annulée ; rechargez les données et consultez le suivi.';
    case 'legacy': return ar ? 'الفواتير القديمة لهذا الطفل تحتاج إلى مراجعة الفترات قبل إنشاء فاتورة جديدة. لم تُحذف أي بيانات.' : 'Les anciennes factures de cet enfant doivent être rapprochées avant une nouvelle création. Aucune donnée n’a été supprimée.';
    case 'overlap': return ar ? 'توجد فاتورة لهذه الفترة أو للسنة المتداخلة. تحقق من الفواتير المسجلة.' : 'Une facture existe déjà pour cette période ou une année qui la couvre. Vérifiez les factures enregistrées.';
    case 'changed': return ar ? 'تغيرت الفاتورة منذ فتحها. أعد تحميل البيانات وراجعها قبل التعديل.' : 'La facture a changé depuis son ouverture. Rechargez et vérifiez avant de modifier.';
    case 'invalid': return ar ? 'بيانات الفاتورة غير صالحة أو لا يمكن تغيير الطفل والفترة.' : 'Données invalides ou changement de l’enfant ou de la période interdit.';
    default: return ar ? 'النتيجة غير مؤكدة. أعد تحميل البيانات وتحقق من الفاتورة قبل إعادة المحاولة.' : 'Résultat non confirmé. Rechargez et vérifiez la facture avant de réessayer.';
  }
}
