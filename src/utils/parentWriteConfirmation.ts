export async function requireConfirmedParentWrite(
  operation: PromiseLike<{ data: { id?: unknown } | null; error: unknown }>,
): Promise<void> {
  const { data, error } = await operation;
  if (error || !data || typeof data.id !== 'string' || !data.id) {
    throw new Error('Enregistrement non confirmé. Vérifiez la connexion et actualisez avant de réessayer.');
  }
}
