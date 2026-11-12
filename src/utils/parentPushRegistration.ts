/** A browser subscription is not active until its server registration succeeds. */
export async function confirmParentPushRegistration(
  subscription: Record<string, unknown> | null,
  register: () => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<boolean> {
  if (!subscription || typeof subscription.endpoint !== 'string' || !subscription.endpoint) return false;
  try {
    const { data, error } = await register();
    return !error && !!data && typeof data === 'object' && (data as { ok?: unknown }).ok === true;
  } catch {
    return false;
  }
}
