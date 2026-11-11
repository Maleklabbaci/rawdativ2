export interface ImportBatchResult<T> {
  saved: T[];
  unconfirmed: T[];
  notAttempted: T[];
}

/** Wait for each started request, then stop before starting another batch on failure. */
export async function importBatches<T>(items: T[], save: (item: T) => Promise<unknown>, batchSize = 10): Promise<ImportBatchResult<T>> {
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('Invalid batch size');
  const saved: T[] = [];
  const unconfirmed: T[] = [];
  let attempted = 0;
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const results = await Promise.allSettled(batch.map(item => Promise.resolve().then(() => save(item))));
    attempted += batch.length;
    results.forEach((result, i) => (result.status === 'fulfilled' ? saved : unconfirmed).push(batch[i]));
    if (unconfirmed.length) break;
  }
  return { saved, unconfirmed, notAttempted: items.slice(attempted) };
}
