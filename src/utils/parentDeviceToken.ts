const TOKEN_KEY = 'rawdha_parent_device_token_v1';
const SAFE_TOKEN = /^ptok_[0-9a-f]{32}$/;

/** Never generate or silently replace a device credential with predictable data. */
export function secureParentDeviceToken(storage: Pick<Storage, 'getItem' | 'setItem'>, cryptoApi: Pick<Crypto, 'getRandomValues'> | undefined): string {
  try {
    const existing = storage.getItem(TOKEN_KEY);
    if (existing !== null) return SAFE_TOKEN.test(existing) ? existing : '';
    if (typeof cryptoApi?.getRandomValues !== 'function') return '';
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    const token = `ptok_${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
    storage.setItem(TOKEN_KEY, token);
    return storage.getItem(TOKEN_KEY) === token ? token : '';
  } catch {
    return '';
  }
}
