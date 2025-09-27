// Message handling for tunnl.ai Chrome Extension

import { MESSAGE_TYPES } from '../../shared/message-types.js';
import { storageManager } from '../storage/storage.js';
import { urlAnalyzer } from '../analysis/analyzer.js';
import { taskValidator } from '../analysis/task-validator.js';
import { openaiClient } from '../api/openai.js';
import { STORAGE_AREAS, STORAGE_KEYS } from '../../shared/storage-keys.js';
import { isSameOrigin } from '../../shared/utils.js';
import { TunnlSettings, AnalysisResult, TaskValidationResult, ApiKeyValidationResult } from '../../shared/constants.js';
import { TunnlMessage, MessageResponse } from '../../shared/message-types.js';

class MessageHandler {
    public settings: TunnlSettings | null = null;

    /**
     * Handle incoming messages
     */
    async handleMessage(message: TunnlMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void): Promise<boolean> {
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
        } catch (error: any) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
        
        return true; // Keep message channel open for async response
    }

    /**
     * Handle setting current task
     */
    private async handleSetCurrentTask(message: any, sendResponse: (response: MessageResponse) => void): Promise<void> {
        try {
            const { index, text } = message;
            let selected = null;
            
            if (typeof index === 'number' && this.settings?.tasks[index]) {
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
            
            if (this.settings) {
                this.settings.currentTask = selected;
                await storageManager.set({ [STORAGE_KEYS.CURRENT_TASK]: selected }, STORAGE_AREAS.LOCAL);
                sendResponse({ success: true, data: this.settings.currentTask });
            } else {
                throw new Error('Settings not loaded');
            }
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle clearing current task
     */
    private async handleClearCurrentTask(message: any, sendResponse: (response: MessageResponse) => void): Promise<void> {
        try {
            if (this.settings) {
                this.settings.currentTask = null;
                await storageManager.set({ [STORAGE_KEYS.CURRENT_TASK]: null }, STORAGE_AREAS.LOCAL);
                sendResponse({ success: true });
            } else {
                throw new Error('Settings not loaded');
            }
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle toggling extension
     */
    private async handleToggleExtension(message: any, sendResponse: (response: MessageResponse) => void): Promise<void> {
        try {
            if (this.settings) {
                this.settings.extensionEnabled = message.enabled;
                await storageManager.set({ [STORAGE_KEYS.EXTENSION_ENABLED]: message.enabled }, STORAGE_AREAS.LOCAL);
                this.updateBadge(this.settings.extensionEnabled);
                sendResponse({ success: true });
            } else {
                throw new Error('Settings not loaded');
            }
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle URL analysis
     */
    private async handleAnalyzeUrl(message: any, sendResponse: (response: MessageResponse<AnalysisResult>) => void): Promise<void> {
        try {
            if (!this.settings) {
                throw new Error('Settings not loaded');
            }
            
            const result = await urlAnalyzer.analyzeUrl(
                message.url, 
                this.settings.currentTask?.text, 
                this.settings.openaiApiKey
            );
            sendResponse({ success: true, data: result });
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle task validation
     */
    private async handleValidateTask(message: any, sendResponse: (response: MessageResponse<TaskValidationResult>) => void): Promise<void> {
        try {
            if (!this.settings) {
                throw new Error('Settings not loaded');
            }
            
            const result = await taskValidator.validateTask(
                message.taskText, 
                this.settings.openaiApiKey
            );
            sendResponse({ success: true, data: result });
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle getting settings
     */
    private async handleGetSettings(message: any, sendResponse: (response: MessageResponse<TunnlSettings>) => void): Promise<void> {
        try {
            await this.loadSettings();
            sendResponse({ success: true, data: this.settings! });
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle updating settings
     */
    private async handleUpdateSettings(message: any, sendResponse: (response: MessageResponse) => void): Promise<void> {
        try {
            if (this.settings) {
                this.settings = { ...this.settings, ...message.settings };
                await this.saveSettings();
                sendResponse({ success: true });
            } else {
                throw new Error('Settings not loaded');
            }
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle opening settings
     */
    private async handleOpenSettings(message: any, sendResponse: (response: MessageResponse) => void): Promise<void> {
        try {
            chrome.runtime.openOptionsPage();
            sendResponse({ success: true });
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle block feedback
     */
    private async handleBlockFeedback(message: any, sendResponse: (response: MessageResponse) => void): Promise<void> {
        try {
            if (!this.settings) {
                throw new Error('Settings not loaded');
            }
            
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
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle API key validation
     */
    private async handleValidateApiKey(message: any, sendResponse: (response: MessageResponse<ApiKeyValidationResult>) => void): Promise<void> {
        try {
            const { apiKey } = message;
            const validation = await openaiClient.validateApiKey(apiKey);
            sendResponse({ success: true, data: validation });
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle adding to allowlist
     */
    private async handleAddToAllowlist(message: any, sendResponse: (response: MessageResponse<string[]>) => void): Promise<void> {
        try {
            if (!this.settings) {
                throw new Error('Settings not loaded');
            }
            
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
            
            sendResponse({ success: true, data: this.settings.allowlist });
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle temporary unblock
     */
    private async handleTemporaryUnblock(message: any, sendResponse: (response: MessageResponse) => void): Promise<void> {
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
                data: `Site temporarily unblocked for ${duration || 10} minutes` 
            });
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle one-time bypass
     */
    private async handleOneTimeBypass(message: any, sendResponse: (response: MessageResponse) => void): Promise<void> {
        try {
            const { url } = message;
            if (!url) throw new Error('url is required');
            
            await storageManager.set({
                [STORAGE_KEYS.ONE_TIME_BYPASS]: {
                    url: url
                }
            }, STORAGE_AREAS.LOCAL);
            
            sendResponse({ success: true, data: 'One-time bypass set' });
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle getting stats
     */
    private async handleGetStats(message: any, sendResponse: (response: MessageResponse) => void): Promise<void> {
        try {
            if (!this.settings) {
                throw new Error('Settings not loaded');
            }
            
            const stats = {
                blockedCount: this.settings.stats?.blockedCount || 0,
                analyzedCount: this.settings.stats?.analyzedCount || 0,
                focusScore: Math.min(100, Math.round((this.settings.stats?.blockedCount || 0) * 5)),
                timeSaved: Math.round((this.settings.stats?.blockedCount || 0) * 2.5)
            };
            sendResponse({ success: true, data: stats });
        } catch (error: any) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Load settings from storage
     */
    async loadSettings(): Promise<void> {
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
                taskValidationEnabled: result[STORAGE_KEYS.TASK_VALIDATION_ENABLED] !== false,
                feedback: result[STORAGE_KEYS.FEEDBACK] || []
            };
            
        } catch (error: any) {
            console.error('Error loading settings:', error);
            this.settings = {
                openaiApiKey: '',
                tasks: [],
                currentTask: null,
                extensionEnabled: true,
                blockedSites: [],
                stats: { blockedCount: 0, analyzedCount: 0 },
                allowlist: [],
                taskValidationEnabled: true,
                feedback: []
            };
        }
    }

    /**
     * Save settings to storage
     */
    async saveSettings(): Promise<void> {
        try {
            if (this.settings) {
                await storageManager.set(this.settings, STORAGE_AREAS.LOCAL);
            }
        } catch (error: any) {
            console.error('Error saving settings:', error);
            throw error;
        }
    }

    /**
     * Update extension badge
     */
    updateBadge(enabled: boolean): void {
        const text = enabled ? 'ON' : 'OFF';
        const color = enabled ? '#6b46c1' : '#9ca3af';
        chrome.action.setBadgeText({ text });
        chrome.action.setBadgeBackgroundColor({ color });
    }
}

// Export singleton instance
export const messageHandler = new MessageHandler();
export default messageHandler;
