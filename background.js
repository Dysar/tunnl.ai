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
        await this.loadSettings();
        this.setupEventListeners();
        this.setupNavigationListener();
    }

    async loadSettings() {
        const result = await chrome.storage.sync.get([
            'openaiApiKey',
            'tasks',
            'extensionEnabled',
            'blockedSites',
            'stats'
        ]);

        this.settings = {
            openaiApiKey: result.openaiApiKey || '',
            tasks: result.tasks || [],
            extensionEnabled: result.extensionEnabled !== false,
            blockedSites: result.blockedSites || [],
            stats: result.stats || { blockedCount: 0, analyzedCount: 0 }
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

        // Listen for tab updates
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                this.handleTabUpdate(tabId, tab);
            }
        });
    }

    setupNavigationListener() {
        // Use webNavigation API to track navigation
        chrome.webNavigation.onBeforeNavigate.addListener((details) => {
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

            case 'OPEN_SETTINGS':
                chrome.runtime.openOptionsPage();
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ success: false, error: 'Unknown message type' });
        }
    }

    async handleTabUpdate(tabId, tab) {
        if (!this.settings.extensionEnabled || !tab.url) return;
        
        // Skip chrome:// and extension URLs
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            return;
        }

        await this.analyzeAndBlockUrl(tab.url, tabId);
    }

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
        if (!this.settings.openaiApiKey || this.settings.tasks.length === 0) {
            return { shouldBlock: false, reason: 'Not configured' };
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
            
            try {
                const result = JSON.parse(content);
                return {
                    shouldBlock: result.shouldBlock || false,
                    reason: result.reason || 'No reason provided',
                    confidence: result.confidence || 0.5
                };
            } catch (parseError) {
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
}

// Initialize background script
const tunnl = new TunnlBackground();

// Clean up cache every hour
setInterval(() => {
    tunnl.cleanupCache();
}, 60 * 60 * 1000);
