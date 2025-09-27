// Storage management for tunnl.ai Chrome Extension

import { STORAGE_KEYS, STORAGE_AREAS, STORAGE_CONFIG, type StorageKey, type StorageArea, type StorageInfo } from '../../shared/storage-keys.js';
import { STORAGE_LIMITS, type TunnlSettings } from '../../shared/constants.js';
import { cleanDataForStorage } from '../../shared/utils.js';

class StorageManager {
    private cache = new Map<string, { data: any; timestamp: number }>();
    private cacheTimeout = 5000; // 5 seconds cache

    /**
     * Get data from storage with caching
     */
    async get(keys: string | string[], area: StorageArea = STORAGE_AREAS.LOCAL): Promise<Record<string, any>> {
        const cacheKey = `${area}:${Array.isArray(keys) ? keys.join(',') : keys}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            const storage = area === STORAGE_AREAS.LOCAL ? chrome.storage.local : chrome.storage.sync;
            const result = await storage.get(keys);
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            return result;
        } catch (error) {
            console.error('Storage get error:', error);
            throw error;
        }
    }

    /**
     * Set data in storage
     */
    async set(data: Record<string, any>, area: StorageArea = STORAGE_AREAS.LOCAL): Promise<void> {
        try {
            // Clean data before storing
            const cleanedData = cleanDataForStorage(data as TunnlSettings, STORAGE_LIMITS);
            
            const storage = area === STORAGE_AREAS.LOCAL ? chrome.storage.local : chrome.storage.sync;
            await storage.set(cleanedData);
            
            // Clear related cache entries
            this.clearCacheForKeys(Object.keys(cleanedData), area);
            
            console.log(`✅ Data stored in ${area} storage:`, Object.keys(cleanedData));
        } catch (error: any) {
            if (error.message.includes('quota')) {
                console.warn('Storage quota exceeded, cleaning up data...');
                await this.cleanupStorage(area);
                // Retry with cleaned data
                const cleanedData = cleanDataForStorage(data as TunnlSettings, STORAGE_LIMITS);
                const storage = area === STORAGE_AREAS.LOCAL ? chrome.storage.local : chrome.storage.sync;
                await storage.set(cleanedData);
                this.clearCacheForKeys(Object.keys(cleanedData), area);
            } else {
                throw error;
            }
        }
    }

    /**
     * Remove data from storage
     */
    async remove(keys: string | string[], area: StorageArea = STORAGE_AREAS.LOCAL): Promise<void> {
        try {
            const storage = area === STORAGE_AREAS.LOCAL ? chrome.storage.local : chrome.storage.sync;
            await storage.remove(keys);
            
            // Clear related cache entries
            const keysArray = Array.isArray(keys) ? keys : [keys];
            this.clearCacheForKeys(keysArray, area);
            
            console.log(`🗑️ Data removed from ${area} storage:`, keysArray);
        } catch (error) {
            console.error('Storage remove error:', error);
            throw error;
        }
    }

    /**
     * Clear all data from storage
     */
    async clear(area: StorageArea = STORAGE_AREAS.LOCAL): Promise<void> {
        try {
            const storage = area === STORAGE_AREAS.LOCAL ? chrome.storage.local : chrome.storage.sync;
            await storage.clear();
            
            // Clear all cache entries for this area
            this.clearCacheForArea(area);
            
            console.log(`🧹 ${area} storage cleared`);
        } catch (error) {
            console.error('Storage clear error:', error);
            throw error;
        }
    }

    /**
     * Get all data from storage
     */
    async getAll(area: StorageArea = STORAGE_AREAS.LOCAL): Promise<Record<string, any>> {
        try {
            const storage = area === STORAGE_AREAS.LOCAL ? chrome.storage.local : chrome.storage.sync;
            return await storage.get(null);
        } catch (error) {
            console.error('Storage getAll error:', error);
            throw error;
        }
    }

    /**
     * Migrate data from sync to local storage
     */
    async migrateFromSyncToLocal(): Promise<void> {
        try {
            const syncData = await this.getAll(STORAGE_AREAS.SYNC);
            const localData = await this.getAll(STORAGE_AREAS.LOCAL);
            
            // Check if sync has data but local doesn't
            const syncHasData = Object.keys(syncData).length > 0;
            const localHasData = Object.keys(localData).length > 0;
            
            if (syncHasData && !localHasData) {
                console.log('🔄 Migrating data from sync to local storage...');
                await this.set(syncData, STORAGE_AREAS.LOCAL);
                await this.clear(STORAGE_AREAS.SYNC);
                console.log('✅ Migration completed');
            }
        } catch (error) {
            console.error('Migration error:', error);
        }
    }

    /**
     * Clean up storage when quota is exceeded
     */
    async cleanupStorage(area: StorageArea = STORAGE_AREAS.LOCAL): Promise<void> {
        try {
            const data = await this.getAll(area);
            const dataSize = JSON.stringify(data).length;
            const limit = area === STORAGE_AREAS.LOCAL ? STORAGE_LIMITS.LOCAL_MAX_SIZE : STORAGE_LIMITS.SYNC_MAX_SIZE;
            
            if (dataSize > limit) {
                console.log(`🧹 Cleaning up ${area} storage (${dataSize} bytes > ${limit} bytes)`);
                
                // Clean up large arrays
                const cleanedData = { ...data };
                
                // Limit blocked sites
                if (cleanedData[STORAGE_KEYS.BLOCKED_SITES]?.length > STORAGE_LIMITS.MAX_BLOCKED_SITES) {
                    cleanedData[STORAGE_KEYS.BLOCKED_SITES] = cleanedData[STORAGE_KEYS.BLOCKED_SITES]
                        .slice(-STORAGE_LIMITS.MAX_BLOCKED_SITES);
                }
                
                // Limit feedback
                if (cleanedData[STORAGE_KEYS.FEEDBACK]?.length > STORAGE_LIMITS.MAX_FEEDBACK) {
                    cleanedData[STORAGE_KEYS.FEEDBACK] = cleanedData[STORAGE_KEYS.FEEDBACK]
                        .slice(-STORAGE_LIMITS.MAX_FEEDBACK);
                }
                
                await this.set(cleanedData, area);
                console.log(`✅ ${area} storage cleaned up`);
            }
        } catch (error) {
            console.error('Storage cleanup error:', error);
        }
    }

    /**
     * Clear cache entries for specific keys
     */
    private clearCacheForKeys(keys: string[], area: StorageArea): void {
        for (const [cacheKey] of this.cache) {
            if (cacheKey.startsWith(`${area}:`)) {
                const keyPart = cacheKey.split(':')[1];
                if (keyPart) {
                    const cachedKeys = keyPart.split(',');
                    if (keys.some(key => cachedKeys.includes(key))) {
                        this.cache.delete(cacheKey);
                    }
                }
            }
        }
    }

    /**
     * Clear all cache entries for a storage area
     */
    private clearCacheForArea(area: StorageArea): void {
        for (const [cacheKey] of this.cache) {
            if (cacheKey.startsWith(`${area}:`)) {
                this.cache.delete(cacheKey);
            }
        }
    }

    /**
     * Clear all cache
     */
    clearAllCache(): void {
        this.cache.clear();
    }

    /**
     * Get storage usage information
     */
    async getStorageInfo(): Promise<StorageInfo | null> {
        try {
            const localData = await this.getAll(STORAGE_AREAS.LOCAL);
            const syncData = await this.getAll(STORAGE_AREAS.SYNC);
            
            return {
                local: {
                    size: JSON.stringify(localData).length,
                    keys: Object.keys(localData).length,
                    limit: STORAGE_LIMITS.LOCAL_MAX_SIZE
                },
                sync: {
                    size: JSON.stringify(syncData).length,
                    keys: Object.keys(syncData).length,
                    limit: STORAGE_LIMITS.SYNC_MAX_SIZE
                }
            };
        } catch (error) {
            console.error('Storage info error:', error);
            return null;
        }
    }
}

// Export singleton instance
export const storageManager = new StorageManager();
export default storageManager;