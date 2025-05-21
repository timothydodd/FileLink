import { CACHE_KEY_PREFIX, CacheEntry, CacheKey, IAuthCache, WrappedCacheEntry } from './auth-cache.localstorage';

const DEFAULT_EXPIRY_ADJUSTMENT_SECONDS = 0;

export class AuthCacheManager {
  constructor(private cache: IAuthCache) {}

  get(cacheKey: CacheKey, expiryAdjustmentSeconds = DEFAULT_EXPIRY_ADJUSTMENT_SECONDS) {
    let wrappedEntry = this.cache.get<WrappedCacheEntry>(cacheKey.toKey());

    if (!wrappedEntry) {
      const keys = this.getCacheKeys();

      if (!keys) return;

      const matchedKey = this.matchExistingCacheKey(cacheKey, keys);

      if (matchedKey) {
        wrappedEntry = this.cache.get<WrappedCacheEntry>(matchedKey);
      }
    }

    // If we still don't have an entry, exit.
    if (!wrappedEntry) {
      return;
    }

    const now = Date.now();

    const nowSeconds = Math.floor(now / 1000);

    if (wrappedEntry.expiresAt - expiryAdjustmentSeconds < nowSeconds) {
      if (wrappedEntry.body.refresh_token) {
        if (wrappedEntry.body.access_token) {
          wrappedEntry.body.expired_access_token = wrappedEntry.body.access_token;
        }
        wrappedEntry.body = {
          expired_access_token: wrappedEntry.body.expired_access_token,
          refresh_token: wrappedEntry.body.refresh_token,
        };

        this.cache.set(cacheKey.toKey(), wrappedEntry);
        return wrappedEntry.body;
      }

      this.cache.remove(cacheKey.toKey());
      return;
    }

    return wrappedEntry.body;
  }

  set(entry: CacheEntry): void {
    const cacheKey = new CacheKey({
      client_id: entry.client_id,
      audience: entry.audience,
    });

    const wrappedEntry = this.wrapCacheEntry(entry);

    this.cache.set(cacheKey.toKey(), wrappedEntry);
  }

  private wrapCacheEntry(entry: CacheEntry): WrappedCacheEntry {
    const now = Date.now();
    const expirySeconds = Math.floor(now / 1000) + +entry.expires_in;

    return {
      body: entry,
      expiresAt: expirySeconds,
    };
  }

  private getCacheKeys(): string[] {
    const keys = this.cache.allKeys ? this.cache.allKeys() : [];
    return keys;
  }

  /**
   * Finds the corresponding key in the cache based on the provided cache key.
   * The keys inside the cache are in the format {prefix}::{client_id}::{audience}::{scope}.
   * The first key in the cache that satisfies the following conditions is returned
   *  - `prefix` is strict equal to filelink's internally configured `keyPrefix`
   *  - `client_id` is strict equal to the `cacheKey.client_id`
   *  - `audience` is strict equal to the `cacheKey.audience`
   *  - `scope` contains at least all the `cacheKey.scope` values
   *  *
   * @param keyToMatch The provided cache key
   * @param allKeys A list of existing cache keys
   */
  private matchExistingCacheKey(keyToMatch: CacheKey, allKeys: Array<string>) {
    return allKeys.filter((key) => {
      const cacheKey = CacheKey.fromKey(key);

      return (
        cacheKey.prefix === CACHE_KEY_PREFIX &&
        cacheKey.client_id === keyToMatch.client_id &&
        cacheKey.audience === keyToMatch.audience
      );
    })[0];
  }
}
