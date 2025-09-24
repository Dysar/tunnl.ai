// Background script for tunnl.ai Chrome Extension

class TunnlBackground {
    constructor() {
        this.settings = {
            openaiApiKey: '',
            tasks: [],
            extensionEnabled: true,
            blockedSites: [],
            stats: { blockedCount: 0, analyzedCount: 0 },
            taskValidationEnabled: true
        };
        this.urlCache = new Map(); // Cache for analyzed URLs
        this.lastSuggestionPopupMs = 0; // Debounce popup suggestions
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
            'allowlist',
            'taskValidationEnabled'
        ]);

        this.settings = {
            openaiApiKey: result.openaiApiKey || '',
            tasks: result.tasks || [],
            extensionEnabled: result.extensionEnabled !== false,
            blockedSites: result.blockedSites || [],
            stats: result.stats || { blockedCount: 0, analyzedCount: 0 },
            allowlist: Array.isArray(result.allowlist) ? result.allowlist : [],
            taskValidationEnabled: result.taskValidationEnabled !== false
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


            case 'ADD_TO_ALLOWLIST':
                try {
                    let { host, url } = message;
                    if (!host && url) {
                        try { host = new URL(url).hostname; } catch {}
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
        
        // Skip chrome://, devtools:// and extension URLs
        if (details.url.startsWith('chrome://') || details.url.startsWith('chrome-extension://') || details.url.startsWith('devtools://')) {
            return;
        }

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
                        return; // Do not analyze/block
                    }
                } catch {}
            }
        } catch {}

        // Honor one-time bypass (single navigation)
        try {
            const local = await chrome.storage.local.get(['oneTimeBypass']);
            const one = local.oneTimeBypass;
            if (one && one.url) {
                try {
                    const oneOrigin = new URL(one.url).origin;
                    const currentOrigin = new URL(details.url).origin;
                    if (details.url === one.url || oneOrigin === currentOrigin) {
                        // consume bypass
                        await chrome.storage.local.remove('oneTimeBypass');
                        return; // allow this navigation only
                    }
                } catch {}
            }
        } catch {}

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
                await this.notifyBlockSuggestion(url, analysis, tabId);
            }

        } catch (error) {
            console.error('Error analyzing URL:', error);
        }
    }

    async validateTask(taskText) {
        console.log('Validating task:', taskText);
        if (!this.settings.taskValidationEnabled) {
            console.log('Task validation disabled');
            return { isValid: true, reason: 'Validation disabled', suggestions: [], sampleBlockedSites: [] };
        }
        
        if (!this.settings.openaiApiKey) {
            console.log('Extension not configured - API key missing');
            return { isValid: false, reason: 'API key not configured', suggestions: [], sampleBlockedSites: [] };
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
                            content: `You are a productivity expert helping users write effective task descriptions for a website blocker.

Your job is to evaluate if a task description is well-written for efficient website blocking. A good task description should:
1. Be specific and actionable (not too broad or vague)
2. Clearly indicate what websites would be relevant
3. Be focused enough that the AI can distinguish relevant vs irrelevant sites
4. Not be so broad that it would allow distracting websites

Examples of GOOD task descriptions:
- "Research competitor pricing for SaaS tools"
- "Write blog post about React hooks"
- "Prepare presentation slides for Q4 sales meeting"
- "Debug authentication issues in the login module"

Examples of BAD task descriptions (too broad):
- "Work on project"
- "Be productive"
- "Do research"
- "Learn something new"

Respond with a JSON object containing:
- "isValid": boolean (true if the task is well-described for blocking)
- "reason": string (explanation of why it's valid/invalid)
- "suggestions": array of strings (specific suggestions to improve the task if invalid)
- "confidence": number (0-1, how confident you are in this assessment)
- "sampleBlockedSites": array of 5 strings (example websites that would be blocked for this task, like "facebook.com", "youtube.com", "reddit.com", etc.)`
                        },
                        {
                            role: 'user',
                            content: `Evaluate this task description: "${taskText}"`
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 300
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;
            console.log('Task validation response:', content);
            
            try {
                const result = JSON.parse(content);
                console.log('Parsed validation result:', result);
                return {
                    isValid: result.isValid || false,
                    reason: result.reason || 'No reason provided',
                    suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
                    confidence: result.confidence || 0.5,
                    sampleBlockedSites: Array.isArray(result.sampleBlockedSites) ? result.sampleBlockedSites : []
                };
            } catch (parseError) {
                console.log('JSON parse error, using fallback:', parseError);
                // Fallback if JSON parsing fails
                return {
                    isValid: !content.toLowerCase().includes('invalid') && !content.toLowerCase().includes('too broad'),
                    reason: 'AI analysis completed',
                    suggestions: [],
                    confidence: 0.5,
                    sampleBlockedSites: ['facebook.com', 'youtube.com', 'reddit.com', 'twitter.com', 'instagram.com']
                };
            }

        } catch (error) {
            console.error('Task validation API error:', error);
            return {
                isValid: true, // Default to allowing task if validation fails
                reason: `Validation error: ${error.message}`,
                suggestions: [],
                confidence: 0,
                sampleBlockedSites: []
            };
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
                            content: `You are a productivity assistant that helps users stay focused on their activities. 
                            Analyze the given URL and determine if it's related to the user's current activities.
                            
                            User's activities for today:
                            ${this.settings.tasks.map((task, i) => `${i + 1}. ${task}`).join('\n')}
                            
                            Respond with a JSON object containing:
                            - "shouldBlock": boolean (true if the website is not directly related to any activity and is likely distracting)
                            - "reason": string (brief explanation of why it should/shouldn't be blocked)
                            - "activityUnderstanding": string (brief explanation of how you understood the user's activities - what they're trying to accomplish)
                            - "confidence": number (0-1, how confident you are in this decision)
                            
                            Guidelines:
                            - Block games, gaming sites, social media, entertainment, news, shopping unless directly related to the activities
                            - Only allow sites that are clearly and directly relevant to the specific activities listed
                            - If the site is about a different topic/domain than the activities, block it
                            - Be moderately strict - only block clearly distracting sites that are obviously unrelated to your activities
                            - Examples: If developing a Chrome plugin, block game strategy sites, social media, entertainment unless they're about Chrome development`
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
                    shouldBlock = true;
                }

                return {
                    shouldBlock,
                    reason: reason || 'No reason provided',
                    activityUnderstanding: result.activityUnderstanding || 'No activity understanding provided',
                    confidence
                };
            } catch (parseError) {
                console.log('JSON parse error, using fallback:', parseError);
                // Fallback if JSON parsing fails
                return {
                    shouldBlock: content.toLowerCase().includes('block') && content.toLowerCase().includes('true'),
                    reason: 'AI analysis completed',
                    activityUnderstanding: 'Unable to parse activity understanding',
                    confidence: 0.5
                };
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
        try {
            const reason = analysis.reason || 'Potentially distracting';
            const activityUnderstanding = analysis.activityUnderstanding || 'Unable to understand activities';
            const confidence = typeof analysis.confidence === 'number' ? Math.round(analysis.confidence * 100) : undefined;
            const message = confidence != null ? `${reason} (confidence: ${confidence}%)` : reason;

            // Track as suggested block (not a strict block)
            this.settings.blockedSites.push({ url, timestamp: Date.now(), reason: `Suggest: ${reason}` });
            if (this.settings.blockedSites.length > 100) {
                this.settings.blockedSites = this.settings.blockedSites.slice(-100);
            }
            await this.saveSettings();

            // Debounce notifications to avoid spamming
            const now = Date.now();
            if (now - this.lastSuggestionPopupMs < 4000) {
                return;
            }
            this.lastSuggestionPopupMs = now;


            // Ask content script to show an in-page prompt that the user can click
            try {
                if (typeof tabId === 'number') {
                    await chrome.tabs.sendMessage(tabId, {
                        type: 'SHOW_BLOCK_TOAST',
                        url,
                        message,
                        activityUnderstanding
                    });
                }
            } catch (msgErr) {
                // Content script may not be ready or site CSP blocks injection; ignore
            }

            // Nudge user via badge to click the extension action
            const previousBadge = await chrome.action.getBadgeText({});
            const previousColor = await chrome.action.getBadgeBackgroundColor({});
            await chrome.action.setBadgeText({ text: '!' });
            await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
            setTimeout(() => {
                // Restore previous badge state
                chrome.action.setBadgeText({ text: previousBadge || (this.settings.extensionEnabled ? 'ON' : 'OFF') });
                chrome.action.setBadgeBackgroundColor({ color: previousColor || (this.settings.extensionEnabled ? '#6b46c1' : '#9ca3af') });
            }, 8000);
        } catch (error) {
            console.error('Error showing block suggestion toast:', error);
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
