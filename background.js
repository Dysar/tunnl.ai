// Background script for tunnl.ai Chrome Extension

class TunnlBackground {
    constructor() {
        this.settings = {
            openaiApiKey: '',
            tasks: [],
            extensionEnabled: true,
            blockedSites: [],
            stats: { blockedCount: 0, analyzedCount: 0 }
        };
        this.urlCache = new Map(); // Cache for analyzed URLs
        this.init();
    }

    async init() {
        console.log('tunnl.ai background script loaded');
        await this.loadSettings();
        this.setupEventListeners();
        this.setupNavigationListener();
        this.setupStorageListener();
        this.updateBadge(this.settings.extensionEnabled);
        console.log('tunnl.ai initialized, extension enabled:', this.settings.extensionEnabled);
    }

    async loadSettings() {
        const result = await chrome.storage.sync.get([
            'openaiApiKey',
            'tasks',
            'extensionEnabled',
            'blockedSites',
            'stats',
            'allowlist'
        ]);

        this.settings = {
            openaiApiKey: result.openaiApiKey || '',
            tasks: result.tasks || [],
            extensionEnabled: result.extensionEnabled !== false,
            blockedSites: result.blockedSites || [],
            stats: result.stats || { blockedCount: 0, analyzedCount: 0 },
            allowlist: Array.isArray(result.allowlist) ? result.allowlist : []
        };
    }

    async saveSettings() {
        await chrome.storage.sync.set(this.settings);
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
            }).catch(() => {});
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

            case 'GET_SETTINGS':
                sendResponse({ success: true, settings: this.settings });
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
            if (area !== 'sync') return;

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

    async handleNavigation(details) {
        if (!this.settings.extensionEnabled) return;
        
        // Skip chrome:// and extension URLs
        if (details.url.startsWith('chrome://') || details.url.startsWith('chrome-extension://')) {
            return;
        }

        await this.analyzeAndBlockUrl(details.url, details.tabId);
    }

    async analyzeAndBlockUrl(url, tabId) {
        try {
            // Check cache first
            if (this.urlCache.has(url)) {
                const cachedResult = this.urlCache.get(url);
                if (cachedResult.shouldBlock) {
                    await this.blockUrl(url, tabId, cachedResult.reason);
                }
                return;
            }

            // Analyze URL with OpenAI
            const analysis = await this.analyzeUrl(url);
            
            // Cache the result
            this.urlCache.set(url, analysis);

            // Update stats
            this.settings.stats.analyzedCount++;
            await this.saveSettings();

            if (analysis.shouldBlock) {
                await this.blockUrl(url, tabId, analysis.reason);
            }

        } catch (error) {
            console.error('Error analyzing URL:', error);
        }
    }

    async analyzeUrl(url) {
        console.log('Analyzing URL:', url);
        if (!this.settings.openaiApiKey || this.settings.tasks.length === 0) {
            console.log('Extension not configured - API key or tasks missing');
            return { shouldBlock: false, reason: 'Not configured' };
        }

        // Check allowlist first
        if (this.isAllowlisted(url)) {
            console.log('URL is allowlisted:', url);
            return { shouldBlock: false, reason: 'Allowlisted site' };
        }

        try {
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
                            content: `You are a productivity assistant that helps users stay focused on their tasks. 
                            Analyze the given URL and determine if it's related to the user's current tasks.
                            
                            User's tasks for today:
                            ${this.settings.tasks.map((task, i) => `${i + 1}. ${task}`).join('\n')}
                            
                            Respond with a JSON object containing:
                            - "shouldBlock": boolean (true if the website is not related to any task and is likely distracting)
                            - "reason": string (brief explanation of why it should/shouldn't be blocked)
                            - "confidence": number (0-1, how confident you are in this decision)
                            
                            Consider blocking social media, entertainment, news sites, shopping sites, etc. unless they're directly related to the tasks.
                            Be conservative - only block if you're reasonably confident the site is not task-related.`
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

            const data = await response.json();
            const content = data.choices[0].message.content;
            console.log('OpenAI response:', content);
            
            try {
                const result = JSON.parse(content);
                console.log('Parsed result:', result);
                return {
                    shouldBlock: result.shouldBlock || false,
                    reason: result.reason || 'No reason provided',
                    confidence: result.confidence || 0.5
                };
            } catch (parseError) {
                console.log('JSON parse error, using fallback:', parseError);
                // Fallback if JSON parsing fails
                return {
                    shouldBlock: content.toLowerCase().includes('block') && content.toLowerCase().includes('true'),
                    reason: 'AI analysis completed',
                    confidence: 0.5
                };
            }

        } catch (error) {
            console.error('OpenAI API error:', error);
            return {
                shouldBlock: false,
                reason: `Error: ${error.message}`,
                confidence: 0
            };
        }
    }

    async blockUrl(url, tabId, reason) {
        try {
            console.log('Blocking URL:', url, 'Reason:', reason);
            // Add to blocked sites list
            this.settings.blockedSites.push({
                url: url,
                timestamp: Date.now(),
                reason: reason
            });

            // Keep only last 100 blocked sites
            if (this.settings.blockedSites.length > 100) {
                this.settings.blockedSites = this.settings.blockedSites.slice(-100);
            }

            // Update stats
            this.settings.stats.blockedCount++;
            await this.saveSettings();

            // Redirect to blocked page
            await chrome.tabs.update(tabId, {
                url: chrome.runtime.getURL('blocked.html') + '?url=' + encodeURIComponent(url) + '&reason=' + encodeURIComponent(reason)
            });

            // Notify popup of stats update
            chrome.runtime.sendMessage({
                type: 'UPDATE_STATS',
                stats: this.settings.stats
            }).catch(() => {
                // Ignore errors if popup is not open
            });

        } catch (error) {
            console.error('Error blocking URL:', error);
        }
    }

    // Clean up cache periodically
    cleanupCache() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const [url, data] of this.urlCache.entries()) {
            if (now - data.timestamp > maxAge) {
                this.urlCache.delete(url);
            }
        }
    }

    // Allowlist: user-configured substrings plus core schemes
    isAllowlisted(url) {
        const coreSchemes = ['chrome://', 'chrome-extension://'];
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
                } catch {}
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
    }, 60 * 60 * 1000);
