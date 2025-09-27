// Shared utility functions for tunnl.ai Chrome Extension

import { SYSTEM_URLS, TIMING_CONFIG, type AnalysisResult, type TunnlSettings } from './constants.js';

/**
 * Check if a URL is a system URL that should be skipped
 */
export function isSystemUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    return SYSTEM_URLS.some(systemUrl => url.toLowerCase().startsWith(systemUrl));
}

/**
 * Escape HTML characters to prevent XSS
 */
export function escapeHtml(text: string): string {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/[&<>"]/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;'
    }[c] || c));
}

/**
 * Format timestamp to human-readable format
 */
export function formatTime(timestamp: number): string {
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
 */
export function formatDuration(ms: number): string {
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
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T, 
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: Parameters<T>) {
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
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>, 
    maxRetries: number = 3, 
    baseDelay: number = 1000
): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await fn();
            if (attempt > 1) {
                console.log(`✅ Request succeeded on attempt ${attempt}`);
            }
            return result;
        } catch (error) {
            lastError = error as Error;
            console.log(`❌ Attempt ${attempt} failed:`, lastError.message);
            
            // Don't retry on certain errors
            if (lastError.message.includes('401') || 
                lastError.message.includes('403') || 
                lastError.message.includes('429')) {
                console.log('🚫 Not retrying due to auth/rate limit error');
                throw lastError;
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
    
    throw lastError!;
}

/**
 * Normalize URL for comparison
 */
export function normalizeUrl(url: string): string {
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
 */
export function extractHostname(url: string): string {
    if (!url || typeof url !== 'string') return '';
    
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        // Fallback for invalid URLs
        const match = url.match(/^https?:\/\/([^\/]+)/);
        return match && match[1] ? match[1].toLowerCase() : '';
    }
}

/**
 * Check if two URLs are from the same origin
 */
export function isSameOrigin(url1: string, url2: string): boolean {
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
 */
export function generateCacheKey(url: string, taskText: string, recentUrls: string[] = []): string {
    const contextKey = recentUrls.slice(0, 3).join('|');
    return `${url}||${taskText || ''}||${contextKey}`;
}

/**
 * Validate OpenAI API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
    return Boolean(apiKey && typeof apiKey === 'string' && apiKey.startsWith('sk-'));
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (!data || typeof data !== 'string') return '***';
    if (data.length <= visibleChars) return '***';
    return '***' + data.slice(-visibleChars);
}

/**
 * Clean data for storage to prevent quota issues
 */
export function cleanDataForStorage(data: TunnlSettings, limits: Partial<typeof import('./constants.js').STORAGE_LIMITS> = {}): TunnlSettings {
    const cleaned = { ...data };
    
    // Limit blocked sites
    if (cleaned.blockedSites && Array.isArray(cleaned.blockedSites)) {
        const maxBlocked = limits.MAX_BLOCKED_SITES || 50;
        if (cleaned.blockedSites.length > maxBlocked) {
            cleaned.blockedSites = cleaned.blockedSites.slice(-maxBlocked);
        }
    }
    
    // Limit tasks
    if (cleaned.tasks && Array.isArray(cleaned.tasks)) {
        const maxTasks = limits.MAX_TASKS || 20;
        if (cleaned.tasks.length > maxTasks) {
            cleaned.tasks = cleaned.tasks.slice(-maxTasks);
        }
    }
    
    // Limit feedback
    if (cleaned.feedback && Array.isArray(cleaned.feedback)) {
        const maxFeedback = limits.MAX_FEEDBACK || 200;
        if (cleaned.feedback.length > maxFeedback) {
            cleaned.feedback = cleaned.feedback.slice(-maxFeedback);
        }
    }
    
    return cleaned;
}

/**
 * Calculate focus score based on blocked vs analyzed URLs
 */
export function calculateFocusScore(blockedCount: number, analyzedCount: number): number {
    if (!analyzedCount || analyzedCount === 0) return 0;
    return Math.min(100, Math.round((blockedCount / analyzedCount) * 100));
}

/**
 * Calculate estimated time saved
 */
export function calculateTimeSaved(blockedCount: number, avgTimePerSite: number = 2.5): number {
    return Math.round(blockedCount * avgTimePerSite);
}

/**
 * Type guard to check if a value is a valid AnalysisResult
 */
export function isAnalysisResult(value: any): value is AnalysisResult {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof value.shouldBlock === 'boolean' &&
        typeof value.reason === 'string' &&
        typeof value.activityUnderstanding === 'string' &&
        typeof value.confidence === 'number'
    );
}

/**
 * Type guard to check if a value is a valid TunnlSettings
 */
export function isTunnlSettings(value: any): value is TunnlSettings {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof value.openaiApiKey === 'string' &&
        Array.isArray(value.tasks) &&
        typeof value.extensionEnabled === 'boolean' &&
        Array.isArray(value.blockedSites) &&
        typeof value.stats === 'object' &&
        Array.isArray(value.allowlist) &&
        typeof value.taskValidationEnabled === 'boolean' &&
        Array.isArray(value.feedback)
    );
}