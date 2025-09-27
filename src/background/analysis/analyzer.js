// URL analysis logic for tunnl.ai Chrome Extension

import { openaiClient } from '../api/openai.js';
import { urlCache } from '../storage/cache.js';
import { generateCacheKey, isSystemUrl } from '../../shared/utils.js';
import { MESSAGE_TYPES } from '../../shared/message-types.js';

class URLAnalyzer {
    constructor() {
        this.recentUrls = [];
        this.maxRecentUrls = 5;
    }

    /**
     * Analyze URL and determine if it should be blocked
     * @param {string} url - URL to analyze
     * @param {string} currentTask - Current task text
     * @param {string} apiKey - OpenAI API key
     * @returns {Promise<Object>} - Analysis result
     */
    async analyzeUrl(url, currentTask, apiKey) {
        console.log('🔍 Starting URL analysis:', {
            url,
            currentTask: currentTask || 'No current task',
            recentUrls: this.recentUrls.length
        });

        // Skip system URLs
        if (isSystemUrl(url)) {
            console.log('🔒 Skipping system URL:', url);
            return {
                shouldBlock: false,
                reason: 'System URL',
                activityUnderstanding: 'System URL - always allowed',
                confidence: 1.0
            };
        }

        // Set API key for OpenAI client
        if (apiKey) {
            openaiClient.setApiKey(apiKey);
        }

        // Check cache first
        const cacheKey = generateCacheKey(url, currentTask, this.recentUrls);
        const cachedResult = urlCache.get(cacheKey);
        
        if (cachedResult) {
            console.log('✅ Cache hit:', {
                shouldBlock: cachedResult.shouldBlock,
                reason: cachedResult.reason,
                timestamp: new Date(cachedResult.timestamp).toISOString()
            });
            return cachedResult;
        }

        try {
            // Analyze with OpenAI
            console.log('🤖 Calling OpenAI API for analysis...');
            const analysis = await openaiClient.analyzeUrl(url, currentTask, this.recentUrls);
            
            console.log('🧠 AI Analysis result:', {
                shouldBlock: analysis.shouldBlock,
                reason: analysis.reason,
                activityUnderstanding: analysis.activityUnderstanding,
                confidence: analysis.confidence
            });

            // Cache the result
            urlCache.set(cacheKey, analysis);
            console.log('💾 Cached analysis result');

            return analysis;

        } catch (error) {
            console.error('Error analyzing URL:', error);
            return {
                shouldBlock: false,
                reason: `Error: ${error.message}`,
                activityUnderstanding: 'Error occurred during analysis',
                confidence: 0
            };
        }
    }

    /**
     * Add URL to recent URLs list
     * @param {string} url - URL to add
     */
    addToRecentUrls(url) {
        // Skip system URLs
        if (isSystemUrl(url)) {
            return;
        }
        
        const wasAlreadyTracked = this.recentUrls.includes(url);
        
        // Remove if already exists to avoid duplicates
        this.recentUrls = this.recentUrls.filter(u => u !== url);
        
        // Add to beginning of array
        this.recentUrls.unshift(url);
        
        // Keep only last N URLs
        if (this.recentUrls.length > this.maxRecentUrls) {
            this.recentUrls = this.recentUrls.slice(0, this.maxRecentUrls);
        }
        
        console.log(`📝 URL History ${wasAlreadyTracked ? 'updated' : 'added'}:`, {
            newUrl: url,
            totalUrls: this.recentUrls.length,
            recentUrls: this.recentUrls
        });
    }

    /**
     * Get recent URLs
     * @returns {Array} - Array of recent URLs
     */
    getRecentUrls() {
        return [...this.recentUrls];
    }

    /**
     * Clear recent URLs
     */
    clearRecentUrls() {
        this.recentUrls = [];
        console.log('🧹 Recent URLs cleared');
    }

    /**
     * Check if URL is allowlisted
     * @param {string} url - URL to check
     * @param {Array} allowlist - Array of allowlisted domains
     * @returns {boolean} - True if allowlisted
     */
    isAllowlisted(url, allowlist = []) {
        if (!url || !Array.isArray(allowlist)) return false;
        
        const coreSchemes = ['chrome://', 'chrome-extension://', 'devtools://'];
        try {
            const lowerUrl = url.toLowerCase();
            if (coreSchemes.some(s => lowerUrl.startsWith(s))) return true;

            return allowlist.some(entry => {
                let needle = (entry || '').toLowerCase().trim();
                if (!needle) return false;
                
                // Normalize entries like https://foo or *.bar.com
                try {
                    if (needle.includes('://')) needle = new URL(needle).hostname.toLowerCase();
                } catch { }
                needle = needle.replace(/^\*\.?/, '').replace(/^\./, '');
                return lowerUrl.includes(needle);
            });
        } catch (error) {
            return false;
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} - Cache statistics
     */
    getCacheStats() {
        return urlCache.getStats();
    }

    /**
     * Clear cache
     */
    clearCache() {
        urlCache.clear();
    }

    /**
     * Get cache entries for debugging
     * @param {number} limit - Maximum number of entries
     * @returns {Array} - Cache entries
     */
    getCacheEntries(limit = 10) {
        return urlCache.getEntries(limit);
    }

    /**
     * Search cache by URL pattern
     * @param {string} pattern - URL pattern to search
     * @returns {Array} - Matching cache entries
     */
    searchCache(pattern) {
        return urlCache.search(pattern);
    }
}

// Export singleton instance
export const urlAnalyzer = new URLAnalyzer();
export default urlAnalyzer;
