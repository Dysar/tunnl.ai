// Storage management for tunnl.ai Chrome Extension

import { STORAGE_KEYS, STORAGE_AREAS, STORAGE_CONFIG } from '../../shared/storage-keys.js';
import { cleanDataForStorage, STORAGE_LIMITS } from '../../shared/constants.js';

class StorageManager {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5000; // 5 seconds cache
    }

    /**
     * Get data from storage with caching
     * @param {string|Array} keys - Key(s) to retrieve
     * @param {string} area - Storage area ('local' or 'sync')
     * @returns {Promise<Object>} - Retrieved data
     */
    async get(keys, area = STORAGE_AREAS.LOCAL) {
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
     * @param {Object} data - Data to store
     * @param {string} area - Storage area ('local' or 'sync')
     * @returns {Promise<void>}
     */
    async set(data, area = STORAGE_AREAS.LOCAL) {
        try {
            // Clean data before storing
            const cleanedData = cleanDataForStorage(data, STORAGE_LIMITS);
            
            const storage = area === STORAGE_AREAS.LOCAL ? chrome.storage.local : chrome.storage.sync;
            await storage.set(cleanedData);
            
            // Clear related cache entries
            this.clearCacheForKeys(Object.keys(cleanedData), area);
            
            console.log(`✅ Data stored in ${area} storage:`, Object.keys(cleanedData));
        } catch (error) {
            if (error.message.includes('quota')) {
                console.warn('Storage quota exceeded, cleaning up data...');
                await this.cleanupStorage(area);
                // Retry with cleaned data
                const cleanedData = cleanDataForStorage(data, STORAGE_LIMITS);
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
     * @param {string|Array} keys - Key(s) to remove
     * @param {string} area - Storage area ('local' or 'sync')
     * @returns {Promise<void>}
     */
    async remove(keys, area = STORAGE_AREAS.LOCAL) {
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
     * @param {string} area - Storage area ('local' or 'sync')
     * @returns {Promise<void>}
     */
    async clear(area = STORAGE_AREAS.LOCAL) {
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
     * @param {string} area - Storage area ('local' or 'sync')
     * @returns {Promise<Object>} - All stored data
     */
    async getAll(area = STORAGE_AREAS.LOCAL) {
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
     * @returns {Promise<void>}
     */
    async migrateFromSyncToLocal() {
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
     * @param {string} area - Storage area to clean
     * @returns {Promise<void>}
     */
    async cleanupStorage(area = STORAGE_AREAS.LOCAL) {
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
     * @param {Array} keys - Keys to clear from cache
     * @param {string} area - Storage area
     */
    clearCacheForKeys(keys, area) {
        for (const [cacheKey] of this.cache) {
            if (cacheKey.startsWith(`${area}:`)) {
                const keyPart = cacheKey.split(':')[1];
                const cachedKeys = keyPart.split(',');
                if (keys.some(key => cachedKeys.includes(key))) {
                    this.cache.delete(cacheKey);
                }
            }
        }
    }

    /**
     * Clear all cache entries for a storage area
     * @param {string} area - Storage area
     */
    clearCacheForArea(area) {
        for (const [cacheKey] of this.cache) {
            if (cacheKey.startsWith(`${area}:`)) {
                this.cache.delete(cacheKey);
            }
        }
    }

    /**
     * Clear all cache
     */
    clearAllCache() {
        this.cache.clear();
    }

    /**
     * Get storage usage information
     * @returns {Promise<Object>} - Storage usage info
     */
    async getStorageInfo() {
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
