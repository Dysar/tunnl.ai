// Shared utility functions for tunnl.ai Chrome Extension

import { SYSTEM_URLS, TIMING_CONFIG } from './constants.js';

/**
 * Check if a URL is a system URL that should be skipped
 * @param {string} url - The URL to check
 * @returns {boolean} - True if it's a system URL
 */
export function isSystemUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return SYSTEM_URLS.some(systemUrl => url.toLowerCase().startsWith(systemUrl));
}

/**
 * Escape HTML characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
export function escapeHtml(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/[&<>"]/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;'
    }[c]));
}

/**
 * Format timestamp to human-readable format
 * @param {number} timestamp - Unix timestamp
 * @returns {string} - Formatted time string
 */
export function formatTime(timestamp) {
    if (!timestamp || typeof timestamp !== 'number') return 'Unknown';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

/**
 * Format duration in milliseconds to human-readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Formatted duration string
 */
export function formatDuration(ms) {
    if (!ms || typeof ms !== 'number') return '0m';
    
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }
    
    return `${minutes}m`;
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Promise that resolves with function result
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await fn();
            if (attempt > 1) {
                console.log(`✅ Request succeeded on attempt ${attempt}`);
            }
            return result;
        } catch (error) {
            lastError = error;
            console.log(`❌ Attempt ${attempt} failed:`, error.message);
            
            // Don't retry on certain errors
            if (error.message.includes('401') || 
                error.message.includes('403') || 
                error.message.includes('429')) {
                console.log('🚫 Not retrying due to auth/rate limit error');
                throw error;
            }
            
            // Don't retry on the last attempt
            if (attempt === maxRetries) {
                console.log(`💥 All ${maxRetries} attempts failed`);
                break;
            }
            
            // Exponential backoff with jitter
            const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
            console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

/**
 * Normalize URL for comparison
 * @param {string} url - URL to normalize
 * @returns {string} - Normalized URL
 */
export function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    
    try {
        const urlObj = new URL(url);
        return urlObj.origin + urlObj.pathname;
    } catch {
        return url.toLowerCase().trim();
    }
}

/**
 * Extract hostname from URL
 * @param {string} url - URL to extract hostname from
 * @returns {string} - Hostname or empty string
 */
export function extractHostname(url) {
    if (!url || typeof url !== 'string') return '';
    
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        // Fallback for invalid URLs
        const match = url.match(/^https?:\/\/([^\/]+)/);
        return match ? match[1].toLowerCase() : '';
    }
}

/**
 * Check if two URLs are from the same origin
 * @param {string} url1 - First URL
 * @param {string} url2 - Second URL
 * @returns {boolean} - True if same origin
 */
export function isSameOrigin(url1, url2) {
    if (!url1 || !url2) return false;
    
    try {
        const origin1 = new URL(url1).origin;
        const origin2 = new URL(url2).origin;
        return origin1 === origin2;
    } catch {
        return false;
    }
}

/**
 * Generate a cache key for URL analysis
 * @param {string} url - URL to analyze
 * @param {string} taskText - Current task text
 * @param {Array} recentUrls - Recent URLs for context
 * @returns {string} - Cache key
 */
export function generateCacheKey(url, taskText, recentUrls = []) {
    const contextKey = recentUrls.slice(0, 3).join('|');
    return `${url}||${taskText || ''}||${contextKey}`;
}

/**
 * Validate OpenAI API key format
 * @param {string} apiKey - API key to validate
 * @returns {boolean} - True if valid format
 */
export function isValidApiKeyFormat(apiKey) {
    return apiKey && typeof apiKey === 'string' && apiKey.startsWith('sk-');
}

/**
 * Mask sensitive data for logging
 * @param {string} data - Data to mask
 * @param {number} visibleChars - Number of characters to show at the end
 * @returns {string} - Masked data
 */
export function maskSensitiveData(data, visibleChars = 4) {
    if (!data || typeof data !== 'string') return '***';
    if (data.length <= visibleChars) return '***';
    return '***' + data.slice(-visibleChars);
}

/**
 * Clean data for storage to prevent quota issues
 * @param {Object} data - Data to clean
 * @param {Object} limits - Storage limits
 * @returns {Object} - Cleaned data
 */
export function cleanDataForStorage(data, limits = {}) {
    const cleaned = { ...data };
    
    // Limit blocked sites
    if (cleaned.blockedSites && Array.isArray(cleaned.blockedSites)) {
        const maxBlocked = limits.maxBlockedSites || 50;
        if (cleaned.blockedSites.length > maxBlocked) {
            cleaned.blockedSites = cleaned.blockedSites.slice(-maxBlocked);
        }
    }
    
    // Limit tasks
    if (cleaned.tasks && Array.isArray(cleaned.tasks)) {
        const maxTasks = limits.maxTasks || 20;
        if (cleaned.tasks.length > maxTasks) {
            cleaned.tasks = cleaned.tasks.slice(-maxTasks);
        }
    }
    
    // Limit feedback
    if (cleaned.feedback && Array.isArray(cleaned.feedback)) {
        const maxFeedback = limits.maxFeedback || 200;
        if (cleaned.feedback.length > maxFeedback) {
            cleaned.feedback = cleaned.feedback.slice(-maxFeedback);
        }
    }
    
    return cleaned;
}

/**
 * Calculate focus score based on blocked vs analyzed URLs
 * @param {number} blockedCount - Number of blocked URLs
 * @param {number} analyzedCount - Number of analyzed URLs
 * @returns {number} - Focus score percentage
 */
export function calculateFocusScore(blockedCount, analyzedCount) {
    if (!analyzedCount || analyzedCount === 0) return 0;
    return Math.min(100, Math.round((blockedCount / analyzedCount) * 100));
}

/**
 * Calculate estimated time saved
 * @param {number} blockedCount - Number of blocked URLs
 * @param {number} avgTimePerSite - Average time per site in minutes
 * @returns {number} - Estimated time saved in minutes
 */
export function calculateTimeSaved(blockedCount, avgTimePerSite = 2.5) {
    return Math.round(blockedCount * avgTimePerSite);
}
