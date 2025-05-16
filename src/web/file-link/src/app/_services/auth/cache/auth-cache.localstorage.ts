import { Dictionary } from "../../../_helpers/dictionary";

export class LocalStorageCache implements IAuthCache {
    public set<T = WrappedCacheEntry>(key: string, entry: T) {
        localStorage.setItem(key, JSON.stringify(entry));
    }

    public get<T = WrappedCacheEntry>(key: string) {
        const json = window.localStorage.getItem(key);
        if (!json) return null;

        try {
            const payload = JSON.parse(json) as T;
            return payload;
        } catch (e) {
            return null;
        }
    }

    public remove(key: string) {
        localStorage.removeItem(key);
    }

    public allKeys() {
        return Object.keys(window.localStorage).filter(key =>
            key.startsWith(CACHE_KEY_PREFIX)
        );
    }
    public clear() {
        var keys = this.allKeys();
        keys.forEach(key => {
            this.remove(key);
        });
    }
}


export class InMemoryCache {

    public enclosedCache: IAuthCache;
    constructor() {

        const cache = new Dictionary<WrappedCacheEntry>();

        this.enclosedCache = {
            set<T = WrappedCacheEntry>(key: string, entry: T) {
                cache.set(key, entry as WrappedCacheEntry);
            },

            get<T = WrappedCacheEntry>(key: string) {
                const cacheEntry = cache.get(key) as T;

                if (!cacheEntry) {
                    return null;
                }

                return cacheEntry;
            },

            remove(key: string) {
                cache.remove(key);
            },

            allKeys(): string[] {
                return cache.keys();
            },
            clear() {
                cache.clear();
            }
        };
    }

}

export const CACHE_KEY_PREFIX = '@@filelinkjwt@@';

export type CacheKeyData = {
    audience: string;
    client_id: string;
};

export class CacheKey {
    public client_id: string;
    public audience: string;

    constructor(data: CacheKeyData, public prefix: string = CACHE_KEY_PREFIX) {
        this.client_id = data.client_id;
        this.audience = data.audience;
    }

    /**
   * Converts this `CacheKey` instance into a string for use in a cache
   * @returns A string representation of the key
   */
    toKey(): string {
        return `${this.prefix}::${this.client_id}::${this.audience}`;
    }

    /**
     * Converts a cache key string into a `CacheKey` instance.
     * @param key The key to convert
     * @returns An instance of `CacheKey`
     */
    static fromKey(key: string): CacheKey {
        const [prefix, client_id, audience] = key.split('::');

        return new CacheKey({ client_id, audience }, prefix);
    }
}

export type CacheEntry = {
    access_token: string;
    expires_in: number;
    audience: string;
    scope: string | null;
    client_id: string;
    refresh_token: string | null;
    oauthTokenScope: string | null;
};

export type WrappedCacheEntry = {
    body: Partial<CacheEntry>;
    expiresAt: number;
};

export interface IAuthCache {
    set<T = WrappedCacheEntry>(key: string, entry: T): void;
    get<T = WrappedCacheEntry>(key: string): T | null;
    remove(key: string): void;
    allKeys(): string[];
    clear(): void;
}
