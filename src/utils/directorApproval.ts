/** UI must not treat a missing/unknown status or editable Auth metadata as approval. */
export function directorApprovalStatus(value: unknown): 'approved' | 'pending' {
  return value === 'approved' ? 'approved' : 'pending';
}
