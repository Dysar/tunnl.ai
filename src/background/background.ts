// Main background script for tunnl.ai Chrome Extension

import { messageHandler } from './messaging/message-handler.js';
import { urlAnalyzer } from './analysis/analyzer.js';
import { storageManager } from './storage/storage.js';
import { STORAGE_AREAS, STORAGE_KEYS } from '../shared/storage-keys.js';
import { TIMING_CONFIG } from '../shared/constants.js';
import { isSystemUrl, isSameOrigin } from '../shared/utils.js';
import { TunnlSettings, AnalysisResult } from '../shared/constants.js';

class TunnlBackground {
    private settings: TunnlSettings | null = null;
    private lastSuggestionPopupMs: number = 0;

    constructor() {
        this.init();
    }

    async init(): Promise<void> {
        console.log('tunnl.ai background script loaded');
        
        // Clear any existing quota issues first
        await this.emergencyCleanup();
        
        // Load settings
        await messageHandler.loadSettings();
        this.settings = messageHandler.settings;
        
        // Setup event listeners
        this.setupEventListeners();
        this.setupNavigationListener();
        this.setupStorageListener();
        
        // Update badge
        this.updateBadge(this.settings?.extensionEnabled || false);
        
        console.log('tunnl.ai initialized, extension enabled:', this.settings?.extensionEnabled);
    }

    private async emergencyCleanup(): Promise<void> {
        try {
            // Aggressively clean up any problematic data
            const syncData = await storageManager.getAll(STORAGE_AREAS.SYNC);
            const localData = await storageManager.getAll(STORAGE_AREAS.LOCAL);
            
            // If sync storage has too much data, clear it
            const syncSize = JSON.stringify(syncData).length;
            if (syncSize > 50000) { // 50KB threshold
                console.log('🧹 Emergency cleanup: clearing oversized sync storage');
                await storageManager.clear(STORAGE_AREAS.SYNC);
            }
            
            // If local storage has too much data, clean it
            const localSize = JSON.stringify(localData).length;
            if (localSize > 500000) { // 500KB threshold
                console.log('🧹 Emergency cleanup: clearing oversized local storage');
                await storageManager.clear(STORAGE_AREAS.LOCAL);
            }
        } catch (error) {
            console.log('Emergency cleanup failed:', error);
        }
    }

    private setupEventListeners(): void {
        // Listen for messages from popup and content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            return messageHandler.handleMessage(message, sender, sendResponse);
        });

        // Toggle on toolbar icon click
        chrome.action.onClicked.addListener(async () => {
            if (this.settings) {
                this.settings.extensionEnabled = !this.settings.extensionEnabled;
                console.log('Extension toggled to:', this.settings.extensionEnabled ? 'ON' : 'OFF');
                await messageHandler.saveSettings();
                this.updateBadge(this.settings.extensionEnabled);

                // Optional: notify popup/options if open
                chrome.runtime.sendMessage({
                    type: 'TOGGLE_EXTENSION',
                    enabled: this.settings.extensionEnabled
                }).catch(() => { });
            }
        });
    }

    private setupNavigationListener(): void {
        // Use webNavigation API to track navigation - single event
        chrome.webNavigation.onCommitted.addListener((details) => {
            if (details.frameId === 0) { // Main frame only
                this.handleNavigation(details);
            }
        });
    }

    private setupStorageListener(): void {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== STORAGE_AREAS.LOCAL || !this.settings) return;

            if (changes[STORAGE_KEYS.CURRENT_TASK]) {
                this.settings.currentTask = changes[STORAGE_KEYS.CURRENT_TASK]?.newValue || null;
                console.log('Current task updated:', this.settings.currentTask);
            }

            if (changes[STORAGE_KEYS.OPENAI_API_KEY]) {
                this.settings.openaiApiKey = changes[STORAGE_KEYS.OPENAI_API_KEY]?.newValue || '';
                console.log('API key updated (masked):', this.settings.openaiApiKey ? '***' : '(empty)');
            }

            if (changes[STORAGE_KEYS.TASKS]) {
                this.settings.tasks = Array.isArray(changes[STORAGE_KEYS.TASKS]?.newValue) ? changes[STORAGE_KEYS.TASKS]?.newValue : [];
                console.log('Tasks updated, count:', this.settings.tasks.length);
            }

            if (changes[STORAGE_KEYS.EXTENSION_ENABLED]) {
                this.settings.extensionEnabled = changes[STORAGE_KEYS.EXTENSION_ENABLED]?.newValue !== false;
                this.updateBadge(this.settings.extensionEnabled);
                console.log('Extension enabled updated via storage:', this.settings.extensionEnabled);
            }

            if (changes[STORAGE_KEYS.STATS]) {
                this.settings.stats = changes[STORAGE_KEYS.STATS]?.newValue || this.settings.stats;
            }

            if (changes[STORAGE_KEYS.BLOCKED_SITES]) {
                this.settings.blockedSites = changes[STORAGE_KEYS.BLOCKED_SITES]?.newValue || this.settings.blockedSites;
            }

            if (changes[STORAGE_KEYS.ALLOWLIST]) {
                this.settings.allowlist = Array.isArray(changes[STORAGE_KEYS.ALLOWLIST]?.newValue) ? changes[STORAGE_KEYS.ALLOWLIST]?.newValue : [];
                console.log('Allowlist updated, count:', this.settings.allowlist.length);
            }
        });
    }

    private async handleNavigation(details: chrome.webNavigation.WebNavigationFramedCallbackDetails): Promise<void> {
        console.log('🚀 Navigation detected:', {
            url: details.url,
            tabId: details.tabId,
            frameId: details.frameId,
            extensionEnabled: this.settings?.extensionEnabled
        });

        if (!this.settings?.extensionEnabled) {
            console.log('⏸️ Extension disabled, skipping analysis');
            return;
        }

        // Skip system URLs
        if (isSystemUrl(details.url)) {
            console.log('🔒 Skipping system URL:', details.url);
            return;
        }

        // Track this URL for context
        urlAnalyzer.addToRecentUrls(details.url);

        // Honor temporary bypass from blocked page (10 minutes)
        try {
            const local = await storageManager.get([STORAGE_KEYS.TEMPORARY_UNBLOCK], STORAGE_AREAS.LOCAL);
            const bypass = local[STORAGE_KEYS.TEMPORARY_UNBLOCK];
            if (bypass && bypass.url && bypass.until && Date.now() < bypass.until) {
                // If current URL matches bypassed URL's origin or exact URL, allow
                try {
                    if (details.url === bypass.url || isSameOrigin(details.url, bypass.url)) {
                        console.log('⏰ Temporary bypass active:', {
                            bypassUrl: bypass.url,
                            currentUrl: details.url,
                            until: new Date(bypass.until).toISOString()
                        });
                        return; // Do not analyze/block
                    }
                } catch { }
            }
        } catch { }

        // Honor one-time bypass (single navigation)
        try {
            const local = await storageManager.get([STORAGE_KEYS.ONE_TIME_BYPASS], STORAGE_AREAS.LOCAL);
            const one = local[STORAGE_KEYS.ONE_TIME_BYPASS];
            if (one && one.url) {
                try {
                    if (details.url === one.url || isSameOrigin(details.url, one.url)) {
                        console.log('🎯 One-time bypass used:', {
                            bypassUrl: one.url,
                            currentUrl: details.url
                        });
                        // consume bypass
                        await storageManager.remove([STORAGE_KEYS.ONE_TIME_BYPASS], STORAGE_AREAS.LOCAL);
                        return; // allow this navigation only
                    }
                } catch { }
            }
        } catch { }

        await this.analyzeAndBlockUrl(details.url, details.tabId);
    }

    private async analyzeAndBlockUrl(url: string, tabId: number): Promise<void> {
        if (!this.settings) {
            console.log('⚠️ Settings not loaded, skipping analysis');
            return;
        }

        console.log('🔍 Starting URL analysis:', {
            url,
            tabId,
            currentTask: this.settings.currentTask?.text || 'No current task',
            recentUrls: urlAnalyzer.getRecentUrls().length
        });

        try {
            // Check if URL is allowlisted
            if (urlAnalyzer.isAllowlisted(url, this.settings.allowlist)) {
                console.log('✅ URL is allowlisted:', url);
                return;
            }

            // Analyze URL
            const analysis = await urlAnalyzer.analyzeUrl(url, this.settings.currentTask?.text, this.settings.openaiApiKey);
            
            console.log('🧠 AI Analysis result:', {
                shouldBlock: analysis.shouldBlock,
                reason: analysis.reason,
                activityUnderstanding: analysis.activityUnderstanding,
                confidence: analysis.confidence
            });

            // Update stats (batch saves to reduce storage calls)
            this.settings.stats.analyzedCount++;
            
            // Only save settings every 10 analyses to reduce storage pressure
            if (this.settings.stats.analyzedCount % 10 === 0) {
                await messageHandler.saveSettings();
            }
            console.log('📊 Stats updated - analyzed count:', this.settings.stats.analyzedCount);

            if (analysis.shouldBlock) {
                console.log('🚫 URL should be blocked, showing notification...');
                await this.notifyBlockSuggestion(url, analysis, tabId);
            } else {
                console.log('✅ URL allowed, no action needed');
            }

        } catch (error: any) {
            console.error('Error analyzing URL:', error);
        }
    }

    private async notifyBlockSuggestion(url: string, analysis: AnalysisResult, tabId: number): Promise<void> {
        if (!this.settings) {
            console.log('⚠️ Settings not loaded, cannot show block suggestion');
            return;
        }

        console.log('🚨 Preparing block notification:', {
            url,
            analysis,
            tabId
        });

        try {
            const reason = analysis.reason || 'Potentially distracting';
            const activityUnderstanding = analysis.activityUnderstanding || 'Unable to understand activities';
            const confidence = typeof analysis.confidence === 'number' ? Math.round(analysis.confidence * 100) : undefined;
            const message = confidence != null ? `${reason} (confidence: ${confidence}%)` : reason;

            console.log('📝 Block notification details:', {
                reason,
                activityUnderstanding,
                confidence,
                message
            });

            // Track as suggested block (not a strict block) - limit data size
            const shortReason = reason.substring(0, 50); // Limit reason length
            this.settings.blockedSites.push({ 
                url: url.substring(0, 100), // Limit URL length
                timestamp: Date.now(), 
                reason: `Suggest: ${shortReason}` 
            });
            
            // Keep only last 30 blocked sites to save storage space
            if (this.settings.blockedSites.length > 30) {
                this.settings.blockedSites = this.settings.blockedSites.slice(-30);
            }
            
            // Update stats
            this.settings.stats.blockedCount++;
            
            await messageHandler.saveSettings();
            console.log('💾 Blocked sites updated, total count:', this.settings.blockedSites.length);

            // Debounce notifications to avoid spamming
            const now = Date.now();
            if (now - this.lastSuggestionPopupMs < TIMING_CONFIG.NOTIFICATION_DEBOUNCE) {
                console.log('⏱️ Debouncing notification (too soon since last one)');
                return;
            }
            this.lastSuggestionPopupMs = now;

            // Ask content script to show modal overlay
            try {
                if (typeof tabId === 'number') {
                    console.log('📤 Sending modal message to content script:', {
                        tabId,
                        url,
                        message,
                        activityUnderstanding
                    });
                    
                    await chrome.tabs.sendMessage(tabId, {
                        type: 'SHOW_BLOCK_MODAL',
                        url: url,
                        message: reason,
                        activityUnderstanding: activityUnderstanding,
                        currentTask: this.settings.currentTask?.text || 'No active task'
                    });
                    
                    console.log('✅ Modal message sent successfully');
                } else {
                    console.log('⚠️ Invalid tabId, cannot send modal message');
                }
            } catch (msgErr: any) {
                console.log('❌ Failed to send modal message:', msgErr.message);
                // Content script may not be ready or site CSP blocks injection; ignore
            }

            // Nudge user via badge to click the extension action
            try {
                const previousBadge = await chrome.action.getBadgeText({});
                const previousColor = await chrome.action.getBadgeBackgroundColor({});
                
                console.log('🔔 Setting notification badge:', {
                    previousBadge,
                    previousColor
                });
                
                await chrome.action.setBadgeText({ text: '!' });
                await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
                
                setTimeout(() => {
                    // Restore previous badge state
                    chrome.action.setBadgeText({ text: previousBadge || (this.settings?.extensionEnabled ? 'ON' : 'OFF') });
                    chrome.action.setBadgeBackgroundColor({ color: previousColor || (this.settings?.extensionEnabled ? '#6b46c1' : '#9ca3af') });
                    console.log('🔄 Badge restored to previous state');
                }, TIMING_CONFIG.BADGE_NOTIFICATION_DURATION);
            } catch (badgeErr: any) {
                console.log('❌ Failed to set badge:', badgeErr.message);
            }
        } catch (error: any) {
            console.error('Error showing block suggestion toast:', error);
        }
    }

    private updateBadge(enabled: boolean): void {
        const text = enabled ? 'ON' : 'OFF';
        const color = enabled ? '#6b46c1' : '#9ca3af';
        chrome.action.setBadgeText({ text });
        chrome.action.setBadgeBackgroundColor({ color });
    }
}

// Initialize background script
const tunnl = new TunnlBackground();
