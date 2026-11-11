/** Wait for every started write and return items that failed, including partial batches. */
export async function runInBatches<T>(items: T[], worker: (item: T) => Promise<void>, batchSize = 10): Promise<T[]> {
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error('Invalid batch size');
  const failed: T[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const results = await Promise.allSettled(batch.map(item => Promise.resolve().then(() => worker(item))));
    results.forEach((result, i) => { if (result.status === 'rejected') failed.push(batch[i]); });
  }
  return failed;
}
