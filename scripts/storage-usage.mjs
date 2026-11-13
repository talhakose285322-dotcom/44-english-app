// Read-only, privacy-preserving storage estimates. No network requests or mutation.
export function localStorageBytes(storage) {
  if (!storage) return null;
  try {
    let bytes = 0;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      const value = storage.getItem(key);
      if (key !== null && value !== null) bytes += (key.length + value.length) * 2;
    }
    return bytes;
  } catch { return null; }
}

export async function estimateStorage({storage, navigatorObject, cacheStorage} = {}) {
  const localBytes = localStorageBytes(storage);
  let totalUsageBytes = null, quotaBytes = null, cacheCount = null;
  try {
    if (navigatorObject?.storage?.estimate) {
      const estimate = await navigatorObject.storage.estimate();
      if (Number.isFinite(estimate?.usage) && estimate.usage >= 0) totalUsageBytes = estimate.usage;
      if (Number.isFinite(estimate?.quota) && estimate.quota >= 0) quotaBytes = estimate.quota;
    }
  } catch { /* unsupported/private mode */ }
  try {
    if (cacheStorage?.keys) cacheCount = (await cacheStorage.keys()).length;
  } catch { /* unavailable */ }
  // Browser usage estimates may include IndexedDB and caches, and are not additive with localBytes.
  return {localBytes, totalUsageBytes, quotaBytes, cacheCount};
}
