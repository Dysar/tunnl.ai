// Background script for tunnl.ai Chrome Extension

// Import TaskValidator and StatisticsManager
importScripts('task-validator.js');
importScripts('statistics.js');

class TunnlBackground {
    constructor() {
        this.settings = {
            openaiApiKey: '',
            tasks: [],
            extensionEnabled: true,
            blockedSites: [],
            taskValidationEnabled: true,
            currentTask: null,
        };
        this.urlCache = new Map(); // Cache for analyzed URLs
        this.lastSuggestionPopupMs = 0; // Debounce popup suggestions
        this.recentUrls = []; // Track last 5 URLs for context

        this.taskValidator = null; // Will be initialized after settings are loaded
        this.statsManager = null; // Will be initialized after settings load
        this.init();
    }

    async init() {
        console.log('tunnl.ai background script loaded');
        
        // Clear any existing quota issues first
        await this.emergencyCleanup();
        
        await this.loadSettings();

        this.taskValidator = new TaskValidator(this.settings, this.retryRequest.bind(this));
        
        // Initialize statistics manager
        this.statsManager = new StatisticsManager();
        await this.statsManager.init();
        
        this.setupEventListeners();
        this.setupNavigationListener();
        this.setupStorageListener();
        this.updateBadge(this.settings.extensionEnabled);
        console.log('tunnl.ai initialized, extension enabled:', this.settings.extensionEnabled);
    }

    async emergencyCleanup() {
        try {
            // Aggressively clean up any problematic data
            const syncData = await chrome.storage.sync.get(null);
            const localData = await chrome.storage.local.get(null);
            
            // If sync storage has too much data, clear it
            const syncSize = JSON.stringify(syncData).length;
            if (syncSize > 50000) { // 50KB threshold
                console.log('🧹 Emergency cleanup: clearing oversized sync storage');
                await chrome.storage.sync.clear();
            }
            
            // If local storage has too much data, clean it
            const localSize = JSON.stringify(localData).length;
            if (localSize > 500000) { // 500KB threshold
                console.log('🧹 Emergency cleanup: clearing oversized local storage');
                await chrome.storage.local.clear();
            }
        } catch (error) {
            console.log('Emergency cleanup failed:', error);
        }
    }

    async loadSettings() {
        // Try local storage first (higher limits), fallback to sync
        let result;
        try {
            result = await chrome.storage.local.get([
                'openaiApiKey',
                'tasks',
                'currentTask',
                'extensionEnabled',
                'blockedSites',
                'stats',
                'allowlist',
                'taskValidationEnabled'
            ]);
            
            // If no data in local, try sync storage
            if (!result.openaiApiKey && !result.tasks?.length) {
                console.log('📦 No data in local storage, checking sync storage...');
                result = await chrome.storage.sync.get([
                    'openaiApiKey',
                    'tasks',
                    'currentTask',
                    'extensionEnabled',
                    'blockedSites',
                    'stats',
                    'allowlist',
                    'taskValidationEnabled'
                ]);
                
                // Migrate from sync to local if we found data
                if (result.openaiApiKey || result.tasks?.length) {
                    console.log('🔄 Migrating data from sync to local storage...');
                    await chrome.storage.local.set(result);
                    await chrome.storage.sync.clear();
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            result = {};
        }

        this.settings = {
            openaiApiKey: result.openaiApiKey || '',
            tasks: result.tasks || [],
            currentTask: result.currentTask || null,
            extensionEnabled: result.extensionEnabled !== false,
            blockedSites: result.blockedSites || [],
            stats: result.stats || { blockedCount: 0, analyzedCount: 0 },
            allowlist: Array.isArray(result.allowlist) ? result.allowlist : [],
            taskValidationEnabled: result.taskValidationEnabled !== false
        };
    }

    updateTaskValidator() {
        // Update TaskValidator with current settings
        if (this.taskValidator) {
            this.taskValidator.settings = this.settings;
        }
    }

    async saveSettings() {
        try {
            // Clean up large data before saving
            const cleanedSettings = this.cleanSettingsForStorage();
            // Use local storage (much higher limits than sync)
            await chrome.storage.local.set(cleanedSettings);
            // Update TaskValidator with new settings
            this.updateTaskValidator();
        } catch (error) {
            if (error.message.includes('quota')) {
                console.warn('Storage quota exceeded, cleaning up data...');
                await this.cleanupStorage();
                // Retry with cleaned data
                const cleanedSettings = this.cleanSettingsForStorage();
                await chrome.storage.local.set(cleanedSettings);
                // Update TaskValidator with new settings
                this.updateTaskValidator();
            } else {
                throw error;
            }
        }
    }

    cleanSettingsForStorage() {
        const cleaned = { ...this.settings };
        
        // Limit blocked sites to last 50 entries
        if (cleaned.blockedSites && cleaned.blockedSites.length > 50) {
            cleaned.blockedSites = cleaned.blockedSites.slice(-50);
        }
        
        // Limit tasks to last 20 entries
        if (cleaned.tasks && cleaned.tasks.length > 20) {
            cleaned.tasks = cleaned.tasks.slice(-20);
        }
        
        // Limit feedback to last 50 entries
        if (cleaned.feedback && cleaned.feedback.length > 50) {
            cleaned.feedback = cleaned.feedback.slice(-50);
        }
        
        // Remove large objects that aren't essential
        delete cleaned.urlCache; // This is stored in memory only
        
        return cleaned;
    }

    async cleanupStorage() {
        try {
            // Clear all storage and start fresh
            await chrome.storage.local.clear();
            await chrome.storage.sync.clear();
            console.log('🧹 Storage cleaned up due to quota exceeded');
        } catch (error) {
            console.error('Failed to cleanup storage:', error);
        }
    }

    setupEventListeners() {
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async response
        });

        // Removed tabs.onUpdated - using only webNavigation.onCommitted

        // Toggle on toolbar icon click
        chrome.action.onClicked.addListener(async () => {
            this.settings.extensionEnabled = !this.settings.extensionEnabled;
            console.log('Extension toggled to:', this.settings.extensionEnabled ? 'ON' : 'OFF');
            await this.saveSettings();
            this.updateBadge(this.settings.extensionEnabled);

            // Optional: notify popup/options if open
            chrome.runtime.sendMessage({
                type: 'TOGGLE_EXTENSION',
                enabled: this.settings.extensionEnabled
            }).catch(() => { });
        });
    }

    setupNavigationListener() {
        // Use webNavigation API to track navigation - single event
        chrome.webNavigation.onCommitted.addListener((details) => {
            if (details.frameId === 0) { // Main frame only
                this.handleNavigation(details);
            }
        });
    }

    async handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'CLEAR_CURRENT_TASK':
                this.settings.currentTask = null;
                await this.saveSettings();
                sendResponse({ success: true });
                break;

            case 'SET_CURRENT_TASK':
                try {
                    const { index, text } = message; // allow either index into tasks[] or raw text
                    let selected = null;
                    if (typeof index === 'number' && this.settings.tasks[index]) {
                        selected = { text: this.settings.tasks[index], index, setAt: Date.now() };
                    } else if (typeof text === 'string' && text.trim()) {
                        selected = { text: text.trim(), setAt: Date.now() };
                    } else {
                        throw new Error('Provide a valid task index or text');
                    }
                    this.settings.currentTask = selected;
                    await this.saveSettings();
                    sendResponse({ success: true, currentTask: this.settings.currentTask });
                } catch (e) {
                    sendResponse({ success: false, error: e.message });
                }
                break;
            case 'TOGGLE_EXTENSION':
                this.settings.extensionEnabled = message.enabled;
                await this.saveSettings();
                this.updateBadge(this.settings.extensionEnabled);
                sendResponse({ success: true });
                break;

            case 'ANALYZE_URL':
                try {
                    const result = await this.analyzeUrl(message.url);
                    sendResponse({ success: true, result });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
                break;

            case 'VALIDATE_TASK':
                try {
                    const result = await this.validateTask(message.taskText);
                    sendResponse({ success: true, result });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
                break;

            case 'GET_SETTINGS':
                sendResponse({ success: true, settings: this.settings });
                break;

            case 'GET_STATISTICS':
                console.log('📊 GET_STATISTICS requested, statsManager exists:', !!this.statsManager);
                if (this.statsManager) {
                    const stats = this.statsManager.getFormattedStats();
                    console.log('📊 Returning statistics:', stats);
                    sendResponse({ success: true, statistics: stats });
                } else {
                    console.error('📊 Statistics manager not initialized');
                    sendResponse({ success: false, error: 'Statistics manager not initialized' });
                }
                break;

            case 'RESET_STATISTICS':
                if (this.statsManager) {
                    await this.statsManager.resetAllStats();
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, error: 'Statistics manager not initialized' });
                }
                break;

            case 'UPDATE_SETTINGS':
                this.settings = { ...this.settings, ...message.settings };
                await this.saveSettings();
                sendResponse({ success: true });
                break;

            case 'OPEN_SETTINGS':
                chrome.runtime.openOptionsPage();
                sendResponse({ success: true });
                break;

            case 'BLOCK_FEEDBACK':
                try {
                    const { url, reason, correct } = message.data || {};
                    if (!this.settings.feedback) this.settings.feedback = [];
                    this.settings.feedback.push({ url, reason, correct, timestamp: Date.now() });
                    // Keep last 200 feedback entries
                    if (this.settings.feedback.length > 200) {
                        this.settings.feedback = this.settings.feedback.slice(-200);
                    }
                    await this.saveSettings();
                    sendResponse({ success: true });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
                break;

            case 'VALIDATE_API_KEY':
                try {
                    const { apiKey } = message;
                    const validation = await this.validateApiKey(apiKey);
                    sendResponse({ success: true, validation });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
                break;

            case 'ADD_TO_ALLOWLIST':
                try {
                    let { host, url } = message;
                    if (!host && url) {
                        try { host = new URL(url).hostname; } catch { }
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
                break;

            case 'TEMPORARY_UNBLOCK':
                try {
                    const { url, duration } = message;
                    if (!url) throw new Error('url is required');
                    const durationMs = (duration || 10) * 60 * 1000; // Default 10 minutes
                    await chrome.storage.local.set({
                        temporaryUnblock: {
                            url: url,
                            until: Date.now() + durationMs
                        }
                    });
                    sendResponse({ success: true, message: `Site temporarily unblocked for ${duration || 10} minutes` });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
                break;

            case 'GET_STATS':
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
                break;

            case 'ONE_TIME_BYPASS':
                try {
                    const { url } = message;
                    if (!url) throw new Error('url is required');
                    await chrome.storage.local.set({
                        oneTimeBypass: {
                            url: url
                        }
                    });
                    sendResponse({ success: true, message: 'One-time bypass set' });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
                break;

            default:
                sendResponse({ success: false, error: 'Unknown message type' });
        }
    }

    updateBadge(enabled) {
        const text = enabled ? 'ON' : 'OFF';
        const color = enabled ? '#6b46c1' /* purple-ish */ : '#9ca3af' /* gray */;
        chrome.action.setBadgeText({ text });
        chrome.action.setBadgeBackgroundColor({ color });
    }

    setupStorageListener() {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;

            if (changes.currentTask) {
                this.settings.currentTask = changes.currentTask.newValue || null;
                +               console.log('Current task updated:', this.settings.currentTask);
            }

            if (changes.openaiApiKey) {
                this.settings.openaiApiKey = changes.openaiApiKey.newValue || '';
                console.log('API key updated (masked):', this.settings.openaiApiKey ? '***' : '(empty)');
            }

            if (changes.tasks) {
                this.settings.tasks = Array.isArray(changes.tasks.newValue) ? changes.tasks.newValue : [];
                console.log('Tasks updated, count:', this.settings.tasks.length);
            }

            if (changes.extensionEnabled) {
                this.settings.extensionEnabled = changes.extensionEnabled.newValue !== false;
                this.updateBadge(this.settings.extensionEnabled);
                console.log('Extension enabled updated via storage:', this.settings.extensionEnabled);
            }

            if (changes.stats) {
                this.settings.stats = changes.stats.newValue || this.settings.stats;
            }

            if (changes.blockedSites) {
                this.settings.blockedSites = changes.blockedSites.newValue || this.settings.blockedSites;
            }

            if (changes.allowlist) {
                this.settings.allowlist = Array.isArray(changes.allowlist.newValue) ? changes.allowlist.newValue : [];
                console.log('Allowlist updated, count:', this.settings.allowlist.length);
            }
        });
    }

    // Removed handleTabUpdate - using only handleNavigation

    // Track recent URLs for context
    addToRecentUrls(url) {
        // Skip chrome://, devtools:// and extension URLs
        if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('devtools://')) {
            console.log('🔒 Skipping system URL:', url);
            return;
        }
        
        const wasAlreadyTracked = this.recentUrls.includes(url);
        
        // Remove if already exists to avoid duplicates
        this.recentUrls = this.recentUrls.filter(u => u !== url);
        
        // Add to beginning of array
        this.recentUrls.unshift(url);
        
        // Keep only last 5 URLs
        if (this.recentUrls.length > 5) {
            this.recentUrls = this.recentUrls.slice(0, 5);
        }
        
        console.log(`📝 URL History ${wasAlreadyTracked ? 'updated' : 'added'}:`, {
            newUrl: url,
            totalUrls: this.recentUrls.length,
            recentUrls: this.recentUrls
        });
    }

    async handleNavigation(details) {
        console.log('🚀 Navigation detected:', {
            url: details.url,
            tabId: details.tabId,
            frameId: details.frameId,
            extensionEnabled: this.settings.extensionEnabled
        });

        if (!this.settings.extensionEnabled) {
            console.log('⏸️ Extension disabled, skipping analysis');
            return;
        }

        // Skip chrome://, devtools:// and extension URLs
        if (details.url.startsWith('chrome://') || details.url.startsWith('chrome-extension://') || details.url.startsWith('devtools://')) {
            console.log('🔒 Skipping system URL:', details.url);
            return;
        }

        // Track this URL for context
        this.addToRecentUrls(details.url);

        // Honor temporary bypass from blocked page (10 minutes)
        try {
            const local = await chrome.storage.local.get(['temporaryUnblock']);
            const bypass = local.temporaryUnblock;
            if (bypass && bypass.url && bypass.until && Date.now() < bypass.until) {
                // If current URL matches bypassed URL's origin or exact URL, allow
                try {
                    const bypassOrigin = new URL(bypass.url).origin;
                    const currentOrigin = new URL(details.url).origin;
                    if (details.url === bypass.url || bypassOrigin === currentOrigin) {
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
            const local = await chrome.storage.local.get(['oneTimeBypass']);
            const one = local.oneTimeBypass;
            if (one && one.url) {
                try {
                    const oneOrigin = new URL(one.url).origin;
                    const currentOrigin = new URL(details.url).origin;
                    if (details.url === one.url || oneOrigin === currentOrigin) {
                        console.log('🎯 One-time bypass used:', {
                            bypassUrl: one.url,
                            currentUrl: details.url
                        });
                        // consume bypass
                        await chrome.storage.local.remove('oneTimeBypass');
                        return; // allow this navigation only
                    }
                } catch { }
            }
        } catch { }

        await this.analyzeAndBlockUrl(details.url, details.tabId);
    }

    async analyzeAndBlockUrl(url, tabId) {
        console.log('🔍 Starting URL analysis:', {
            url,
            tabId,
            currentTask: this.settings.currentTask?.text || 'No current task',
            recentUrls: this.recentUrls.length
        });

        try {
            const taskKey = this.settings.currentTask?.text || '';
            const contextKey = this.recentUrls.slice(0, 3).join('|'); // Use first 3 URLs for context
            const cacheKey = `${url}||${taskKey}||${contextKey}`;
            
            console.log('💾 Cache check:', {
                cacheKey: cacheKey.substring(0, 100) + '...',
                hasCache: this.urlCache.has(cacheKey)
            });

            if (this.urlCache.has(cacheKey)) {
                const cachedResult = this.urlCache.get(cacheKey);
                console.log('✅ Cache hit:', {
                    shouldBlock: cachedResult.shouldBlock,
                    reason: cachedResult.reason,
                    timestamp: new Date(cachedResult.timestamp).toISOString()
                });
                
                // Check cache first
                if (cachedResult.shouldBlock) {
                    const analysis = {
                        shouldBlock: true,
                        reason: "From Cache: " + (cachedResult.reason || 'Potentially distracting'),
                        activityUnderstanding: cachedResult.activityUnderstanding || 'Cached analysis',
                        confidence: cachedResult.confidence || 0.8
                    };
                    await this.notifyBlockSuggestion(url, analysis, tabId);
                }
                return;
            }

            // Analyze URL with OpenAI
            console.log('🤖 Calling OpenAI API for analysis...');
            const analysis = await this.analyzeUrl(url);
            
            console.log('🧠 AI Analysis result:', {
                shouldBlock: analysis.shouldBlock,
                reason: analysis.reason,
                activityUnderstanding: analysis.activityUnderstanding,
                confidence: analysis.confidence
            });

            // Cache the result
            this.urlCache.set(cacheKey, { ...analysis, timestamp: Date.now() });
            console.log('💾 Cached analysis result');

            // Update statistics
            if (this.statsManager) {
                await this.statsManager.incrementUrlsAnalyzed();
            }
            console.log('📊 Stats updated - analyzed count:', this.statsManager?.getStats().urlsAnalyzedToday || 0);

            if (analysis.shouldBlock) {
                console.log('🚫 URL should be blocked, showing notification...');
                await this.notifyBlockSuggestion(url, analysis, tabId);
            } else {
                console.log('✅ URL allowed, no action needed');
            }

        } catch (error) {
            console.error('Error analyzing URL:', error);
        }
    }

    async sendMessageWithRetry(tabId, message, maxRetries = 3) {
        console.log('📤 Sending message to content script:', {
            tabId,
            messageType: message.type,
            maxRetries
        });

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Check if tab still exists
                const tab = await chrome.tabs.get(tabId);
                if (!tab) {
                    console.log('❌ Tab no longer exists:', tabId);
                    return;
                }

                // Try to send message
                await chrome.tabs.sendMessage(tabId, message);
                console.log('✅ Message sent successfully on attempt', attempt);
                return;

            } catch (error) {
                console.log(`❌ Attempt ${attempt} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    // Wait before retry (exponential backoff)
                    const delay = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms
                    console.log(`⏳ Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    // Try to inject content script if it's not loaded
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            files: ['content.js']
                        });
                        console.log('📄 Content script injected on retry attempt', attempt);
                    } catch (injectError) {
                        console.log('⚠️ Failed to inject content script:', injectError.message);
                    }
                } else {
                    console.log('❌ All retry attempts failed, giving up');
                    console.log('🔍 Final error:', error.message);
                }
            }
        }
    }

    async validateTask(taskText) {
        // Delegate to TaskValidator
        return await this.taskValidator.validateTask(taskText);
    }

    async analyzeUrl(url) {
        console.log('🔍 Analyzing URL:', url);
        
        if (!this.settings.openaiApiKey) {
            console.log('❌ Extension not configured - API key missing');
            return { shouldBlock: false, reason: 'Not configured', activityUnderstanding: 'No API key', confidence: 0 };
        }

        // Check allowlist first
        if (this.isAllowlisted(url)) {
            console.log('✅ URL is allowlisted:', url);
            return { shouldBlock: false, reason: 'Allowlisted site', activityUnderstanding: 'Site is in allowlist', confidence: 1.0 };
        }

        const currentTaskText = this.settings.currentTask?.text?.text || this.settings.currentTask?.text;
        const normalizedCurrentTaskText = typeof currentTaskText === 'string' ? currentTaskText.trim() : '';
        if (!normalizedCurrentTaskText) {
            console.log('⚠️ No current task selected - allowing URL to avoid overblocking');
            return { shouldBlock: false, reason: 'No current task selected', activityUnderstanding: 'No active task', confidence: 0.5 };
        }

        console.log('📋 Analysis context:', {
            currentTask: normalizedCurrentTaskText,
            recentUrls: this.recentUrls,
            urlToAnalyze: url
        });

        try {
            const response = await this.retryRequest(async () => {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.settings.openaiApiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-3.5-turbo',
                        messages: [
                            {
                                role: 'system',
                                 content: `
                                 You are a productivity assistant that helps users stay focused on their tasks. 
             Analyze the given URL and determine if it's related to the user's current task by understanding the PURPOSE and CONTEXT of the task.

             Current activities/tasks: "${normalizedCurrentTaskText}"

             Recent browsing context (last 5 URLs visited):
             ${this.recentUrls.length > 0 ? this.recentUrls.map((url, i) => `${i + 1}. ${url}`).join('\n') : 'No recent URLs available'}

             Current URL to analyze: ${url}

 Respond with a JSON object containing:
- "shouldBlock": boolean (true if the url is not related to the task and would keep the user from completing it)
- "reason": string (brief explanation of why it should/shouldn't be blocked)
- "activityUnderstanding": string (brief explanation of how you understood the user's activities - what they're trying to accomplish)
- "confidence": number (0-1, how confident you are in this decision)

 Guidelines:
 - Parse tasks to understand the ACTION (researching, buying, learning, etc.) and SUBJECT (bananas, laptops, etc.)
 - Look at each aspect of the URL (domain, path, query) to assess relevance to BOTH the action and subject
 - Use the recent browsing context to understand the user's workflow and intent
 - Consider browsing patterns: if user is researching a topic, allow related sites even if not directly mentioned in task
 - Allow sites that are TOOLS or PLATFORMS for completing the task action, even if they're not topically about the subject
 - Examples of task-relevant platforms:
   * Research tasks: Allow search engines, Wikipedia, academic sites, news sites, AND e-commerce sites (for product research)
   * Shopping tasks: Allow e-commerce sites, price comparison sites, review sites
   * Learning tasks: Allow educational platforms, documentation sites, tutorial sites
 - If a task mentions researching/buying/comparing a product, allow major platforms (Amazon, Google, eBay, etc.) even if the URL doesn't explicitly mention the product
 - Block sites that are clearly unrelated entertainment, social media (unless task-relevant), or different topic domains
 - Tie-break rule: When task mentions a specific domain or exact URL, always allow
 - Always allow: search engines, productivity tools, reference sites
 - If unsure about relevance, lean towards allowing (productivity over restriction)
 - Consider that users often need to navigate through general platform pages to reach specific content
 - Use recent URL context to detect if user is following a logical research/shopping/learning workflow
 - If you cant associate websites with the current task, get the overall topic the user is working on from the current task and recent URLs, and only block sites that are clearly unrelated to that topic
 - Do not block localhost, intranet, or internal company URLs
 `
                        },
                        {
                            role: 'user',
                            content: `Analyze this URL: ${url}`
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 200
                })
                });

                if (!response.ok) {
                    throw new Error(`OpenAI API error: ${response.status}`);
                }

                return response;
            }, 3, 1000);

            const data = await response.json();
            const content = data.choices[0].message.content;

            try {
                const result = JSON.parse(content);
                
                const reason = (result.reason || '').toString();
                let confidence = typeof result.confidence === 'number' ? result.confidence : 0.5;
                let shouldBlock = !!result.shouldBlock;

                // Normalize contradictions: if reason clearly says unrelated/not relevant, prefer blocking
                const lower = reason.toLowerCase();
                const unrelatedSignals = [
                    'not related', 'not relevant', 'unrelated', 'irrelevant',
                    'distracting', 'off-topic', 'different topic', 'different domain'
                ];
                const hasUnrelatedSignal = unrelatedSignals.some(s => lower.includes(s));
                if (!shouldBlock && hasUnrelatedSignal && confidence >= 0.6) {
                    console.log('🔄 Overriding decision based on reason analysis - blocking due to unrelated signals');
                    shouldBlock = true;
                }

                const finalResult = {
                    shouldBlock,
                    reason: reason || 'No reason provided',
                    activityUnderstanding: result.activityUnderstanding || 'No activity understanding provided',
                    confidence
                };
                
                return finalResult;
                
            } catch (parseError) {
                console.log('❌ JSON parse error, using fallback:', parseError);
                // Fallback if JSON parsing fails
                const fallbackResult = {
                    shouldBlock: content.toLowerCase().includes('block') && content.toLowerCase().includes('true'),
                    reason: 'AI analysis completed (fallback)',
                    activityUnderstanding: 'Unable to parse activity understanding',
                    confidence: 0.5
                };
                console.log('🔄 Using fallback result:', fallbackResult);
                return fallbackResult;
            }

        } catch (error) {
            console.error('OpenAI API error:', error);
            return {
                shouldBlock: false,
                reason: `Error: ${error.message}`,
                activityUnderstanding: 'Error occurred during analysis',
                confidence: 0
            };
        }
    }

    async notifyBlockSuggestion(url, analysis, tabId) {
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
            
            // Update statistics
            if (this.statsManager) {
                await this.statsManager.incrementUrlsBlocked();
            }
            
            await this.saveSettings();
            console.log('💾 Blocked sites updated, total count:', this.settings.blockedSites.length);

            // Debounce notifications to avoid spamming
            const now = Date.now();
            if (now - this.lastSuggestionPopupMs < 4000) {
                console.log('⏱️ Debouncing notification (too soon since last one)');
                return;
            }
            this.lastSuggestionPopupMs = now;


            // Ask content script to show modal overlay with retry logic
            if (typeof tabId === 'number') {
                await this.sendMessageWithRetry(tabId, {
                    type: 'SHOW_BLOCK_MODAL',
                    url: url,
                    message: reason,
                    activityUnderstanding: activityUnderstanding,
                    currentTask: this.settings.currentTask?.text || 'No active task'
                });
            } else {
                console.log('⚠️ Invalid tabId, cannot send modal message');
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
                    chrome.action.setBadgeText({ text: previousBadge || (this.settings.extensionEnabled ? 'ON' : 'OFF') });
                    chrome.action.setBadgeBackgroundColor({ color: previousColor || (this.settings.extensionEnabled ? '#6b46c1' : '#9ca3af') });
                    console.log('🔄 Badge restored to previous state');
                }, 8000);
            } catch (badgeErr) {
                console.log('❌ Failed to set badge:', badgeErr.message);
            }
        } catch (error) {
            console.error('Error showing block suggestion toast:', error);
        }
    }


    // Validate OpenAI API key
    async validateApiKey(apiKey) {
        console.log('🔑 Validating API key...');
        
        if (!apiKey || !apiKey.startsWith('sk-')) {
            return { valid: false, error: 'Invalid API key format. Must start with "sk-"' };
        }

        try {
            const response = await this.retryRequest(async () => {
                const response = await fetch('https://api.openai.com/v1/models', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    }
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error('Invalid API key - authentication failed');
                    } else if (response.status === 429) {
                        throw new Error('Rate limit exceeded - API key is valid but temporarily limited');
                    } else if (response.status === 403) {
                        throw new Error('API key lacks required permissions');
                    } else {
                        throw new Error(`API error: ${response.status}`);
                    }
                }

                return response;
            }, 2, 1000); // Fewer retries for validation

            const data = await response.json();
            console.log('✅ API key validation successful');
            
            return { 
                valid: true, 
                models: data.data?.length || 0,
                message: `API key is valid. Found ${data.data?.length || 0} available models.`
            };

        } catch (error) {
            console.log('❌ API key validation failed:', error.message);
            return { 
                valid: false, 
                error: error.message 
            };
        }
    }

    // Retry utility for network requests
    async retryRequest(requestFn, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 Attempt ${attempt}/${maxRetries} for network request`);
                const result = await requestFn();
                if (attempt > 1) {
                    console.log(`✅ Request succeeded on attempt ${attempt}`);
                }
                return result;
            } catch (error) {
                lastError = error;
                console.log(`❌ Attempt ${attempt} failed:`, error.message);
                
                // Don't retry on certain errors
                if (error.message.includes('401') || error.message.includes('403') || error.message.includes('429')) {
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

    // Clean up cache periodically
    cleanupCache() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        let deletedCount = 0;

        console.log('🧹 Starting cache cleanup...', {
            cacheSize: this.urlCache.size,
            maxAge: '24 hours'
        });

        for (const [cacheKey, data] of this.urlCache.entries()) {
            if (now - data.timestamp > maxAge) {
                this.urlCache.delete(cacheKey);
                deletedCount++;
            }
        }

        console.log('🧹 Cache cleanup completed:', {
            deletedEntries: deletedCount,
            remainingEntries: this.urlCache.size
        });
    }

    // Allowlist: user-configured substrings plus core schemes
    isAllowlisted(url) {
        const coreSchemes = ['chrome://', 'chrome-extension://', 'devtools://'];
        try {
            const lowerUrl = url.toLowerCase();
            if (coreSchemes.some(s => lowerUrl.startsWith(s))) return true;

            const list = Array.isArray(this.settings.allowlist) ? this.settings.allowlist : [];
            return list.some(entry => {
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
}

// Initialize background script
const tunnl = new TunnlBackground();

// Clean up cache every hour
setInterval(() => {
    tunnl.cleanupCache();
}, 60 * 60 * 1000 * 24);
