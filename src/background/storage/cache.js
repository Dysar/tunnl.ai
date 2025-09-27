// URL cache management for tunnl.ai Chrome Extension

import { CACHE_CONFIG } from '../../shared/constants.js';

class URLCache {
    constructor() {
        this.cache = new Map();
        this.maxSize = 1000; // Maximum number of cached entries
        this.cleanupInterval = null;
        this.startCleanupTimer();
    }

    /**
     * Get cached analysis result
     * @param {string} cacheKey - Cache key
     * @returns {Object|null} - Cached result or null
     */
    get(cacheKey) {
        const entry = this.cache.get(cacheKey);
        
        if (!entry) {
            return null;
        }

        // Check if entry is expired
        if (Date.now() - entry.timestamp > CACHE_CONFIG.MAX_AGE) {
            this.cache.delete(cacheKey);
            return null;
        }

        return entry.data;
    }

    /**
     * Set cached analysis result
     * @param {string} cacheKey - Cache key
     * @param {Object} data - Analysis result data
     */
    set(cacheKey, data) {
        // Remove oldest entries if cache is full
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }

        this.cache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
        });

        console.log(`💾 Cached analysis result for key: ${cacheKey.substring(0, 50)}...`);
    }

    /**
     * Check if cache has entry for key
     * @param {string} cacheKey - Cache key
     * @returns {boolean} - True if cache has entry
     */
    has(cacheKey) {
        const entry = this.cache.get(cacheKey);
        if (!entry) return false;
        
        // Check if expired
        if (Date.now() - entry.timestamp > CACHE_CONFIG.MAX_AGE) {
            this.cache.delete(cacheKey);
            return false;
        }
        
        return true;
    }

    /**
     * Delete specific cache entry
     * @param {string} cacheKey - Cache key to delete
     */
    delete(cacheKey) {
        this.cache.delete(cacheKey);
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        console.log('🧹 URL cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object} - Cache statistics
     */
    getStats() {
        const now = Date.now();
        let expiredCount = 0;
        let totalAge = 0;

        for (const [key, entry] of this.cache) {
            const age = now - entry.timestamp;
            totalAge += age;
            
            if (age > CACHE_CONFIG.MAX_AGE) {
                expiredCount++;
            }
        }

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            expiredCount,
            averageAge: this.cache.size > 0 ? totalAge / this.cache.size : 0,
            maxAge: CACHE_CONFIG.MAX_AGE
        };
    }

    /**
     * Clean up expired entries
     * @returns {number} - Number of entries removed
     */
    cleanup() {
        const now = Date.now();
        let removedCount = 0;

        for (const [key, entry] of this.cache) {
            if (now - entry.timestamp > CACHE_CONFIG.MAX_AGE) {
                this.cache.delete(key);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            console.log(`🧹 Cache cleanup: removed ${removedCount} expired entries`);
        }

        return removedCount;
    }

    /**
     * Evict oldest entries when cache is full
     * @param {number} count - Number of entries to evict
     */
    evictOldest(count = 10) {
        const entries = Array.from(this.cache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp)
            .slice(0, count);

        for (const [key] of entries) {
            this.cache.delete(key);
        }

        console.log(`🗑️ Evicted ${entries.length} oldest cache entries`);
    }

    /**
     * Start automatic cleanup timer
     */
    startCleanupTimer() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, CACHE_CONFIG.CLEANUP_INTERVAL);

        console.log('⏰ Cache cleanup timer started');
    }

    /**
     * Stop automatic cleanup timer
     */
    stopCleanupTimer() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('⏹️ Cache cleanup timer stopped');
        }
    }

    /**
     * Get cache entries for debugging
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} - Array of cache entries
     */
    getEntries(limit = 10) {
        const entries = Array.from(this.cache.entries())
            .sort((a, b) => b[1].timestamp - a[1].timestamp)
            .slice(0, limit)
            .map(([key, entry]) => ({
                key: key.substring(0, 100) + (key.length > 100 ? '...' : ''),
                timestamp: new Date(entry.timestamp).toISOString(),
                age: Date.now() - entry.timestamp,
                data: {
                    shouldBlock: entry.data.shouldBlock,
                    reason: entry.data.reason?.substring(0, 50) + '...',
                    confidence: entry.data.confidence
                }
            }));

        return entries;
    }

    /**
     * Search cache entries by URL pattern
     * @param {string} pattern - URL pattern to search for
     * @returns {Array} - Matching cache entries
     */
    search(pattern) {
        const results = [];
        const regex = new RegExp(pattern, 'i');

        for (const [key, entry] of this.cache) {
            if (regex.test(key)) {
                results.push({
                    key: key.substring(0, 100) + (key.length > 100 ? '...' : ''),
                    timestamp: new Date(entry.timestamp).toISOString(),
                    data: entry.data
                });
            }
        }

        return results;
    }
}

// Export singleton instance
export const urlCache = new URLCache();
export default urlCache;
