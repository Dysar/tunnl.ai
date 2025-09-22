// Popup script for tunnl.ai Chrome Extension

class TunnlPopup {
    constructor() {
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.updateUI();
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
        // API Key save
        document.getElementById('save-api-key').addEventListener('click', () => {
            this.saveApiKey();
        });

        // Tasks save
        document.getElementById('save-tasks').addEventListener('click', () => {
            this.saveTasks();
        });

        // Extension toggle
        document.getElementById('extension-toggle').addEventListener('change', (e) => {
            this.toggleExtension(e.target.checked);
        });

        // Clear blocked sites
        document.getElementById('clear-blocked').addEventListener('click', () => {
            this.clearBlockedSites();
        });

        // Settings button
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.openSettings();
        });

        // Enter key handlers
        document.getElementById('api-key').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveApiKey();
        });
    }

    async saveApiKey() {
        const apiKey = document.getElementById('api-key').value.trim();
        
        if (!apiKey) {
            this.showMessage('Please enter your OpenAI API key', 'error');
            return;
        }

        if (!apiKey.startsWith('sk-')) {
            this.showMessage('Invalid API key format. Should start with "sk-"', 'error');
            return;
        }

        this.settings.openaiApiKey = apiKey;
        await this.saveSettings();
        
        this.showMessage('API key saved successfully!', 'success');
        this.updateUI();
    }

    async saveTasks() {
        const taskText = document.getElementById('task-input').value.trim();
        
        if (!taskText) {
            this.showMessage('Please enter at least one task', 'error');
            return;
        }

        const tasks = taskText.split('\n')
            .map(task => task.trim())
            .filter(task => task.length > 0);

        this.settings.tasks = tasks;
        await this.saveSettings();
        
        this.showMessage(`Saved ${tasks.length} tasks!`, 'success');
        this.updateUI();
    }

    async toggleExtension(enabled) {
        this.settings.extensionEnabled = enabled;
        await this.saveSettings();
        
        // Notify background script
        chrome.runtime.sendMessage({
            type: 'TOGGLE_EXTENSION',
            enabled: enabled
        });

        this.showMessage(
            enabled ? 'Extension enabled' : 'Extension disabled',
            'success'
        );
    }

    async clearBlockedSites() {
        this.settings.blockedSites = [];
        this.settings.stats.blockedCount = 0;
        await this.saveSettings();
        
        this.showMessage('Blocked sites history cleared', 'success');
        this.updateUI();
    }

    openSettings() {
        // Open Chrome extension options page
        chrome.runtime.openOptionsPage();
    }

    updateUI() {
        // Show/hide sections based on setup status
        const hasApiKey = !!this.settings.openaiApiKey;
        const hasTasks = this.settings.tasks.length > 0;

        document.getElementById('setup-section').style.display = hasApiKey ? 'none' : 'block';
        document.getElementById('tasks-section').style.display = hasApiKey ? 'block' : 'none';
        document.getElementById('status-section').style.display = hasTasks ? 'block' : 'none';
        document.getElementById('blocked-sites-section').style.display = hasTasks ? 'block' : 'none';

        // Populate form fields
        document.getElementById('api-key').value = this.settings.openaiApiKey;
        document.getElementById('task-input').value = this.settings.tasks.join('\n');
        document.getElementById('extension-toggle').checked = this.settings.extensionEnabled;

        // Update stats
        document.getElementById('blocked-count').textContent = this.settings.stats.blockedCount;
        document.getElementById('analyzed-count').textContent = this.settings.stats.analyzedCount;

        // Update task list
        this.updateTaskList();
        
        // Update blocked sites list
        this.updateBlockedSitesList();
    }

    updateTaskList() {
        const taskList = document.getElementById('task-list');
        taskList.innerHTML = '';

        this.settings.tasks.forEach((task, index) => {
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            taskItem.textContent = `${index + 1}. ${task}`;
            taskList.appendChild(taskItem);
        });
    }

    updateBlockedSitesList() {
        const blockedList = document.getElementById('blocked-list');
        blockedList.innerHTML = '';

        const recentBlocked = this.settings.blockedSites.slice(-10).reverse();

        recentBlocked.forEach(site => {
            const blockedItem = document.createElement('div');
            blockedItem.className = 'blocked-item';
            
            const urlSpan = document.createElement('span');
            urlSpan.className = 'blocked-url';
            urlSpan.textContent = site.url;
            
            const timeSpan = document.createElement('span');
            timeSpan.className = 'blocked-time';
            timeSpan.textContent = this.formatTime(site.timestamp);
            
            blockedItem.appendChild(urlSpan);
            blockedItem.appendChild(timeSpan);
            blockedList.appendChild(blockedItem);
        });
    }

    formatTime(timestamp) {
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

    showMessage(text, type) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.success-message, .error-message');
        existingMessages.forEach(msg => msg.remove());

        const message = document.createElement('div');
        message.className = type === 'success' ? 'success-message' : 'error-message';
        message.textContent = text;

        // Insert message after the current section
        const currentSection = document.querySelector('.section:not([style*="display: none"])');
        if (currentSection) {
            currentSection.appendChild(message);
        }

        // Auto-remove after 3 seconds
        setTimeout(() => {
            message.remove();
        }, 3000);
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TunnlPopup();
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_STATS') {
        // Update stats in real-time
        document.getElementById('blocked-count').textContent = message.stats.blockedCount;
        document.getElementById('analyzed-count').textContent = message.stats.analyzedCount;
    }
});
