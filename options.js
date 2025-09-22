// Options page script for tunnl.ai Chrome Extension

class TunnlOptions {
    constructor() {
        this.settings = {
            openaiApiKey: '',
            tasks: [],
            extensionEnabled: true,
            blockingMode: 'moderate',
            blockedSites: [],
            stats: { blockedCount: 0, analyzedCount: 0 }
        };
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
            'blockingMode',
            'blockedSites',
            'stats'
        ]);

        this.settings = {
            openaiApiKey: result.openaiApiKey || '',
            tasks: result.tasks || [],
            extensionEnabled: result.extensionEnabled !== false,
            blockingMode: result.blockingMode || 'moderate',
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

        // Settings save
        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveExtensionSettings();
        });

        // Reset stats
        document.getElementById('reset-stats').addEventListener('click', () => {
            this.resetStats();
        });

        // Clear all data
        document.getElementById('clear-all-data').addEventListener('click', () => {
            this.clearAllData();
        });

        // Export data
        document.getElementById('export-data').addEventListener('click', () => {
            this.exportData();
        });

        // Import data
        document.getElementById('import-data').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });

        document.getElementById('import-file').addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
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
    }

    async saveTasks() {
        const taskText = document.getElementById('tasks').value.trim();
        
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
    }

    async saveExtensionSettings() {
        const extensionEnabled = document.getElementById('extension-enabled').value === 'true';
        const blockingMode = document.getElementById('blocking-mode').value;

        this.settings.extensionEnabled = extensionEnabled;
        this.settings.blockingMode = blockingMode;
        await this.saveSettings();

        // Notify background script
        chrome.runtime.sendMessage({
            type: 'TOGGLE_EXTENSION',
            enabled: extensionEnabled
        }).catch(() => {
            // Ignore errors if background script is not available
        });
        
        this.showMessage('Settings saved successfully!', 'success');
    }

    async resetStats() {
        if (confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
            this.settings.stats = { blockedCount: 0, analyzedCount: 0 };
            await this.saveSettings();
            this.updateUI();
            this.showMessage('Statistics reset successfully!', 'success');
        }
    }

    async clearAllData() {
        if (confirm('Are you sure you want to clear ALL data? This will remove your API key, tasks, and all statistics. This cannot be undone.')) {
            await chrome.storage.sync.clear();
            await chrome.storage.local.clear();
            this.settings = {
                openaiApiKey: '',
                tasks: [],
                extensionEnabled: true,
                blockingMode: 'moderate',
                blockedSites: [],
                stats: { blockedCount: 0, analyzedCount: 0 }
            };
            this.updateUI();
            this.showMessage('All data cleared successfully!', 'success');
        }
    }

    exportData() {
        const data = {
            settings: this.settings,
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `taskfocus-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showMessage('Data exported successfully!', 'success');
    }

    async importData(file) {
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.settings) {
                throw new Error('Invalid backup file format');
            }

            // Validate the data structure
            const requiredFields = ['openaiApiKey', 'tasks', 'extensionEnabled'];
            for (const field of requiredFields) {
                if (!(field in data.settings)) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }

            // Import the settings
            this.settings = { ...this.settings, ...data.settings };
            await this.saveSettings();
            this.updateUI();

            this.showMessage('Data imported successfully!', 'success');

        } catch (error) {
            this.showMessage(`Import failed: ${error.message}`, 'error');
        }
    }

    updateUI() {
        // Populate form fields
        document.getElementById('api-key').value = this.settings.openaiApiKey;
        document.getElementById('tasks').value = this.settings.tasks.join('\n');
        document.getElementById('extension-enabled').value = this.settings.extensionEnabled.toString();
        document.getElementById('blocking-mode').value = this.settings.blockingMode;

        // Update statistics
        document.getElementById('total-blocked').textContent = this.settings.stats.blockedCount;
        document.getElementById('total-analyzed').textContent = this.settings.stats.analyzedCount;
        
        // Calculate today's blocked count
        const today = new Date().toDateString();
        const todayBlocked = this.settings.blockedSites.filter(site => 
            new Date(site.timestamp).toDateString() === today
        ).length;
        document.getElementById('today-blocked').textContent = todayBlocked;

        // Calculate focus score
        const focusScore = this.settings.stats.analyzedCount > 0 
            ? Math.round((this.settings.stats.blockedCount / this.settings.stats.analyzedCount) * 100)
            : 0;
        document.getElementById('focus-score').textContent = `${focusScore}%`;
    }

    showMessage(text, type) {
        const container = document.getElementById('message-container');
        
        // Remove existing messages
        container.innerHTML = '';

        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.textContent = text;
        container.appendChild(message);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            message.remove();
        }, 5000);
    }
}

// Initialize options page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TunnlOptions();
});
