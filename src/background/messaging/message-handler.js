// Message handling for tunnl.ai Chrome Extension

import { MESSAGE_TYPES } from '../../shared/message-types.js';
import { storageManager } from '../storage/storage.js';
import { urlAnalyzer } from '../analysis/analyzer.js';
import { taskValidator } from '../analysis/task-validator.js';
import { openaiClient } from '../api/openai.js';
import { STORAGE_AREAS, STORAGE_KEYS } from '../../shared/storage-keys.js';
import { isSameOrigin } from '../../shared/utils.js';

class MessageHandler {
    constructor() {
        this.settings = null;
    }

    /**
     * Handle incoming messages
     * @param {Object} message - Message object
     * @param {Object} sender - Message sender
     * @param {Function} sendResponse - Response callback
     * @returns {boolean} - True to keep message channel open
     */
    async handleMessage(message, sender, sendResponse) {
        try {
            console.log('📨 Received message:', message.type, message);
            
            switch (message.type) {
                case MESSAGE_TYPES.SET_CURRENT_TASK:
                    await this.handleSetCurrentTask(message, sendResponse);
                    break;
                    
                case MESSAGE_TYPES.CLEAR_CURRENT_TASK:
                    await this.handleClearCurrentTask(message, sendResponse);
                    break;
                    
                case MESSAGE_TYPES.TOGGLE_EXTENSION:
                    await this.handleToggleExtension(message, sendResponse);
                    break;
                    
                case MESSAGE_TYPES.ANALYZE_URL:
                    await this.handleAnalyzeUrl(message, sendResponse);
                    break;
                    
                case MESSAGE_TYPES.VALIDATE_TASK:
                    await this.handleValidateTask(message, sendResponse);
                    break;
                    
                case MESSAGE_TYPES.GET_SETTINGS:
                    await this.handleGetSettings(message, sendResponse);
                    break;
                    
                case MESSAGE_TYPES.UPDATE_SETTINGS:
                    await this.handleUpdateSettings(message, sendResponse);
                    break;
                    
                case MESSAGE_TYPES.OPEN_SETTINGS:
                    await this.handleOpenSettings(message, sendResponse);
                    break;
                    
                case MESSAGE_TYPES.BLOCK_FEEDBACK:
                    await this.handleBlockFeedback(message, sendResponse);
                    break;
                    
                case MESSAGE_TYPES.VALIDATE_API_KEY:
                    await this.handleValidateApiKey(message, sendResponse);
                    break;
                    
                case MESSAGE_TYPES.ADD_TO_ALLOWLIST:
                    await this.handleAddToAllowlist(message, sendResponse);
                    break;
                    
                case MESSAGE_TYPES.TEMPORARY_UNBLOCK:
                    await this.handleTemporaryUnblock(message, sendResponse);
                    break;
                    
                case MESSAGE_TYPES.ONE_TIME_BYPASS:
                    await this.handleOneTimeBypass(message, sendResponse);
                    break;
                    
                case MESSAGE_TYPES.GET_STATS:
                    await this.handleGetStats(message, sendResponse);
                    break;
                    
                default:
                    console.warn('Unknown message type:', message.type);
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
        
        return true; // Keep message channel open for async response
    }

    /**
     * Handle setting current task
     */
    async handleSetCurrentTask(message, sendResponse) {
        try {
            const { index, text } = message;
            let selected = null;
            
            if (typeof index === 'number' && this.settings.tasks[index]) {
                selected = { 
                    text: this.settings.tasks[index], 
                    index, 
                    setAt: Date.now() 
                };
            } else if (typeof text === 'string' && text.trim()) {
                selected = { 
                    text: text.trim(), 
                    setAt: Date.now() 
                };
            } else {
                throw new Error('Provide a valid task index or text');
            }
            
            this.settings.currentTask = selected;
            await storageManager.set({ [STORAGE_KEYS.CURRENT_TASK]: selected }, STORAGE_AREAS.LOCAL);
            
            sendResponse({ success: true, currentTask: this.settings.currentTask });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle clearing current task
     */
    async handleClearCurrentTask(message, sendResponse) {
        try {
            this.settings.currentTask = null;
            await storageManager.set({ [STORAGE_KEYS.CURRENT_TASK]: null }, STORAGE_AREAS.LOCAL);
            sendResponse({ success: true });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle toggling extension
     */
    async handleToggleExtension(message, sendResponse) {
        try {
            this.settings.extensionEnabled = message.enabled;
            await storageManager.set({ [STORAGE_KEYS.EXTENSION_ENABLED]: message.enabled }, STORAGE_AREAS.LOCAL);
            this.updateBadge(this.settings.extensionEnabled);
            sendResponse({ success: true });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle URL analysis
     */
    async handleAnalyzeUrl(message, sendResponse) {
        try {
            const result = await urlAnalyzer.analyzeUrl(
                message.url, 
                this.settings.currentTask?.text, 
                this.settings.openaiApiKey
            );
            sendResponse({ success: true, result });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle task validation
     */
    async handleValidateTask(message, sendResponse) {
        try {
            const result = await taskValidator.validateTask(
                message.taskText, 
                this.settings.openaiApiKey
            );
            sendResponse({ success: true, result });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle getting settings
     */
    async handleGetSettings(message, sendResponse) {
        try {
            await this.loadSettings();
            sendResponse({ success: true, settings: this.settings });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle updating settings
     */
    async handleUpdateSettings(message, sendResponse) {
        try {
            this.settings = { ...this.settings, ...message.settings };
            await this.saveSettings();
            sendResponse({ success: true });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle opening settings
     */
    async handleOpenSettings(message, sendResponse) {
        try {
            chrome.runtime.openOptionsPage();
            sendResponse({ success: true });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle block feedback
     */
    async handleBlockFeedback(message, sendResponse) {
        try {
            const { url, reason, correct } = message.data || {};
            if (!this.settings.feedback) this.settings.feedback = [];
            
            this.settings.feedback.push({ 
                url, 
                reason, 
                correct: !!correct, 
                timestamp: Date.now() 
            });
            
            // Keep last 200 feedback entries
            if (this.settings.feedback.length > 200) {
                this.settings.feedback = this.settings.feedback.slice(-200);
            }
            
            await this.saveSettings();
            sendResponse({ success: true });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle API key validation
     */
    async handleValidateApiKey(message, sendResponse) {
        try {
            const { apiKey } = message;
            const validation = await openaiClient.validateApiKey(apiKey);
            sendResponse({ success: true, validation });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle adding to allowlist
     */
    async handleAddToAllowlist(message, sendResponse) {
        try {
            let { host, url } = message;
            if (!host && url) {
                try { 
                    host = new URL(url).hostname; 
                } catch { }
            }
            if (!host) throw new Error('host is required');
            
            const normalized = String(host).toLowerCase().trim();
            if (!Array.isArray(this.settings.allowlist)) this.settings.allowlist = [];
            
            if (!this.settings.allowlist.some(h => String(h).toLowerCase().trim() === normalized)) {
                this.settings.allowlist.push(normalized);
                await this.saveSettings();
            }
            
            sendResponse({ success: true, allowlist: this.settings.allowlist });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle temporary unblock
     */
    async handleTemporaryUnblock(message, sendResponse) {
        try {
            const { url, duration } = message;
            if (!url) throw new Error('url is required');
            
            const durationMs = (duration || 10) * 60 * 1000; // Default 10 minutes
            await storageManager.set({
                [STORAGE_KEYS.TEMPORARY_UNBLOCK]: {
                    url: url,
                    until: Date.now() + durationMs
                }
            }, STORAGE_AREAS.LOCAL);
            
            sendResponse({ 
                success: true, 
                message: `Site temporarily unblocked for ${duration || 10} minutes` 
            });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle one-time bypass
     */
    async handleOneTimeBypass(message, sendResponse) {
        try {
            const { url } = message;
            if (!url) throw new Error('url is required');
            
            await storageManager.set({
                [STORAGE_KEYS.ONE_TIME_BYPASS]: {
                    url: url
                }
            }, STORAGE_AREAS.LOCAL);
            
            sendResponse({ success: true, message: 'One-time bypass set' });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle getting stats
     */
    async handleGetStats(message, sendResponse) {
        try {
            const stats = {
                blockedCount: this.settings.stats?.blockedCount || 0,
                analyzedCount: this.settings.stats?.analyzedCount || 0,
                focusScore: Math.min(100, Math.round((this.settings.stats?.blockedCount || 0) * 5)),
                timeSaved: Math.round((this.settings.stats?.blockedCount || 0) * 2.5)
            };
            sendResponse({ success: true, stats });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Load settings from storage
     */
    async loadSettings() {
        try {
            // Try local storage first (higher limits), fallback to sync
            let result = await storageManager.get([
                STORAGE_KEYS.OPENAI_API_KEY,
                STORAGE_KEYS.TASKS,
                STORAGE_KEYS.CURRENT_TASK,
                STORAGE_KEYS.EXTENSION_ENABLED,
                STORAGE_KEYS.BLOCKED_SITES,
                STORAGE_KEYS.STATS,
                STORAGE_KEYS.ALLOWLIST,
                STORAGE_KEYS.TASK_VALIDATION_ENABLED
            ], STORAGE_AREAS.LOCAL);
            
            // If no data in local, try sync storage
            if (!result[STORAGE_KEYS.OPENAI_API_KEY] && !result[STORAGE_KEYS.TASKS]?.length) {
                console.log('📦 No data in local storage, checking sync storage...');
                result = await storageManager.get([
                    STORAGE_KEYS.OPENAI_API_KEY,
                    STORAGE_KEYS.TASKS,
                    STORAGE_KEYS.CURRENT_TASK,
                    STORAGE_KEYS.EXTENSION_ENABLED,
                    STORAGE_KEYS.BLOCKED_SITES,
                    STORAGE_KEYS.STATS,
                    STORAGE_KEYS.ALLOWLIST,
                    STORAGE_KEYS.TASK_VALIDATION_ENABLED
                ], STORAGE_AREAS.SYNC);
                
                // Migrate from sync to local if we found data
                if (result[STORAGE_KEYS.OPENAI_API_KEY] || result[STORAGE_KEYS.TASKS]?.length) {
                    console.log('🔄 Migrating data from sync to local storage...');
                    await storageManager.set(result, STORAGE_AREAS.LOCAL);
                    await storageManager.clear(STORAGE_AREAS.SYNC);
                }
            }
            
            this.settings = {
                openaiApiKey: result[STORAGE_KEYS.OPENAI_API_KEY] || '',
                tasks: result[STORAGE_KEYS.TASKS] || [],
                currentTask: result[STORAGE_KEYS.CURRENT_TASK] || null,
                extensionEnabled: result[STORAGE_KEYS.EXTENSION_ENABLED] !== false,
                blockedSites: result[STORAGE_KEYS.BLOCKED_SITES] || [],
                stats: result[STORAGE_KEYS.STATS] || { blockedCount: 0, analyzedCount: 0 },
                allowlist: Array.isArray(result[STORAGE_KEYS.ALLOWLIST]) ? result[STORAGE_KEYS.ALLOWLIST] : [],
                taskValidationEnabled: result[STORAGE_KEYS.TASK_VALIDATION_ENABLED] !== false
            };
            
        } catch (error) {
            console.error('Error loading settings:', error);
            this.settings = {
                openaiApiKey: '',
                tasks: [],
                currentTask: null,
                extensionEnabled: true,
                blockedSites: [],
                stats: { blockedCount: 0, analyzedCount: 0 },
                allowlist: [],
                taskValidationEnabled: true
            };
        }
    }

    /**
     * Save settings to storage
     */
    async saveSettings() {
        try {
            await storageManager.set(this.settings, STORAGE_AREAS.LOCAL);
        } catch (error) {
            console.error('Error saving settings:', error);
            throw error;
        }
    }

    /**
     * Update extension badge
     */
    updateBadge(enabled) {
        const text = enabled ? 'ON' : 'OFF';
        const color = enabled ? '#6b46c1' : '#9ca3af';
        chrome.action.setBadgeText({ text });
        chrome.action.setBadgeBackgroundColor({ color });
    }
}

// Export singleton instance
export const messageHandler = new MessageHandler();
export default messageHandler;
