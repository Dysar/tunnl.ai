// Blocked page script for tunnl.ai Chrome Extension

class TunnlBlockedPage {
    constructor() {
        this.init();
    }

    async init() {
        this.parseUrlParams();
        this.setupEventListeners();
        await this.loadStats();
    }

    parseUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const blockedUrl = urlParams.get('url');
        const reason = urlParams.get('reason');

        document.getElementById('blocked-url').textContent = blockedUrl || 'Unknown URL';
        document.getElementById('blocked-reason').textContent = reason || 'Not related to your current tasks';
    }

    setupEventListeners() {
        document.getElementById('unblock-temp-btn').addEventListener('click', () => {
            this.unblockTemporarily();
        });

        document.getElementById('go-back-btn').addEventListener('click', () => {
            window.history.back();
        });

        document.getElementById('open-settings-btn').addEventListener('click', () => {
            this.openSettings();
        });

        document.getElementById('view-tasks-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.openSettings();
        });

        document.getElementById('blocked-history-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.openSettings();
        });

        document.getElementById('help-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.openHelp();
        });

        // Feedback buttons
        document.getElementById('feedback-correct-btn').addEventListener('click', () => {
            this.sendFeedback(true);
        });
        document.getElementById('feedback-incorrect-btn').addEventListener('click', () => {
            this.sendFeedback(false, { bypassOneTime: true });
        });
    }

    async unblockTemporarily() {
        const urlParams = new URLSearchParams(window.location.search);
        const blockedUrl = urlParams.get('url');

        if (blockedUrl) {
            // Set temporary unblock for 10 minutes
            const unblockUntil = Date.now() + (10 * 60 * 1000);
            await chrome.storage.local.set({
                temporaryUnblock: {
                    url: blockedUrl,
                    until: unblockUntil
                }
            });

            // Redirect to the original URL
            window.location.href = blockedUrl;
        }
    }

    async sendFeedback(correct, options = {}) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const blockedUrl = urlParams.get('url');
            const reason = urlParams.get('reason');

            await chrome.runtime.sendMessage({
                type: 'BLOCK_FEEDBACK',
                data: { url: blockedUrl, reason, correct: !!correct }
            });

            if (options.bypassOneTime) {
                // Store a one-time bypass and redirect immediately
                await chrome.storage.local.set({ oneTimeBypass: { url: blockedUrl } });
                window.location.href = blockedUrl;
            }
        } catch (error) {
            console.error('Error sending feedback:', error);
            if (options.bypassOneTime) {
                await chrome.storage.local.set({ oneTimeBypass: { url: blockedUrl } });
                window.location.href = blockedUrl;
            }
        }
    }

    openSettings() {
        chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
    }

    openHelp() {
        // Open help documentation or support page
        window.open('https://github.com/your-repo/tunnl-extension', '_blank');
    }

    async loadStats() {
        try {
            const result = await chrome.storage.sync.get(['stats']);
            const stats = result.stats || { blockedCount: 0, analyzedCount: 0 };

            document.getElementById('blocked-count').textContent = stats.blockedCount;
            document.getElementById('analyzed-count').textContent = stats.analyzedCount;
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
}

// Initialize blocked page
new TunnlBlockedPage();
