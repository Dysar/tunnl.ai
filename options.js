// Options page script for tunnl.ai Chrome Extension

class TunnlOptions {
    constructor() {
        this.settings = {
            openaiApiKey: '',
            tasks: [],
            extensionEnabled: true,
            // blockingMode removed
            blockedSites: [],
            stats: { blockedCount: 0, analyzedCount: 0 },
            allowlist: []
        };
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.updateUI();
    }

    async loadSettings() {
        // Get settings from background script instead of reading storage directly
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
            if (response.success) {
                this.settings = response.settings;
            } else {
                console.error('Failed to load settings:', response.error);
                this.settings = {
                    openaiApiKey: '',
                    tasks: [],
                    extensionEnabled: true,
                    // blockingMode removed
                    blockedSites: [],
                    stats: { blockedCount: 0, analyzedCount: 0 },
                    allowlist: []
                };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.settings = {
                openaiApiKey: '',
                tasks: [],
                extensionEnabled: true,
                // blockingMode removed
                blockedSites: [],
                stats: { blockedCount: 0, analyzedCount: 0 },
                allowlist: []
            };
        }
    }

    async saveSettings() {
        // Send settings to background script instead of writing storage directly
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'UPDATE_SETTINGS',
                settings: this.settings
            });
            if (!response.success) {
                console.error('Failed to save settings:', response.error);
            }
        } catch (error) {
            console.error('Error saving settings:', error);
        }
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

        // Extension settings section removed

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

        // Show validation message
        this.showMessage('Validating API key...', 'info');

        try {
            // Validate the API key
            const response = await chrome.runtime.sendMessage({
                type: 'VALIDATE_API_KEY',
                apiKey: apiKey
            });

            if (response.success && response.validation) {
                const validation = response.validation;
                
                if (validation.valid) {
                    // Save the API key
                    this.settings.openaiApiKey = apiKey;
                    await this.saveSettings();
                    
                    this.showMessage(`✅ ${validation.message}`, 'success');
                } else {
                    this.showMessage(`❌ API key validation failed: ${validation.error}`, 'error');
                }
            } else {
                this.showMessage('❌ Failed to validate API key. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error validating API key:', error);
            this.showMessage('❌ Error validating API key. Please check your connection and try again.', 'error');
        }
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

    // saveExtensionSettings removed

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
        // extension-enabled removed from UI
        this.renderAllowlist();

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

        // Render recently blocked
        this.renderBlockedHistory();
    }

    // Allowlist UI
    renderAllowlist() {
        const container = document.getElementById('allowlist-list');
        if (!container) return;
        container.innerHTML = '';

        const list = document.createElement('div');
        this.settings.allowlist = Array.isArray(this.settings.allowlist) ? this.settings.allowlist : [];
        this.settings.allowlist.forEach((domain, idx) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '8px 0';
            
            const text = document.createElement('div');
            text.textContent = domain;
            text.style.fontFamily = 'monospace';
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn btn-danger';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', async () => {
                this.settings.allowlist.splice(idx, 1);
                await this.saveSettings();
                this.renderAllowlist();
            });
            
            row.appendChild(text);
            row.appendChild(removeBtn);
            list.appendChild(row);
        });

        container.appendChild(list);

        const addBtn = document.getElementById('allowlist-add');
        if (addBtn) {
            addBtn.onclick = async () => {
                const input = document.getElementById('allowlist-input');
                let domain = (input.value || '').trim().toLowerCase();
                if (!domain) return;
                // Normalize: remove scheme and path
                try {
                    if (domain.includes('://')) domain = new URL(domain).hostname.toLowerCase();
                } catch {}
                domain = domain.replace(/^\*\.?/, '').replace(/^\./, '');
                if (!this.settings.allowlist.includes(domain)) {
                    this.settings.allowlist.push(domain);
                    await this.saveSettings();
                    input.value = '';
                    this.renderAllowlist();
                }
            };
        }
    }

    renderBlockedHistory() {
        const container = document.getElementById('options-blocked-list');
        if (!container) return;
        container.innerHTML = '';

        const recentBlocked = (this.settings.blockedSites || []).slice(-50).reverse();
        recentBlocked.forEach(site => {
            const row = document.createElement('div');
            row.className = 'blocked-item';

            const urlSpan = document.createElement('span');
            urlSpan.className = 'blocked-url';
            urlSpan.textContent = site.url;

            const timeSpan = document.createElement('span');
            timeSpan.className = 'blocked-time';
            timeSpan.textContent = new Date(site.timestamp).toLocaleString();

            row.appendChild(urlSpan);
            row.appendChild(timeSpan);
            container.appendChild(row);
        });

        const clearBtn = document.getElementById('options-clear-blocked');
        if (clearBtn) {
            clearBtn.onclick = async () => {
                this.settings.blockedSites = [];
                this.settings.stats.blockedCount = 0;
                await this.saveSettings();
                this.updateUI();
                this.showMessage('Blocked history cleared', 'success');
            };
        }
    }

    showMessage(text, type) {
        const container = document.getElementById('message-container');
        
        // Remove existing messages
        container.innerHTML = '';

        const message = document.createElement('div');
        let className = 'message error';
        if (type === 'success') className = 'message success';
        else if (type === 'info') className = 'message info';
        message.className = className;
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
