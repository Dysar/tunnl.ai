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
                    blockedSites: [],
                    stats: { blockedCount: 0, analyzedCount: 0 }
                };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.settings = {
                openaiApiKey: '',
                tasks: [],
                extensionEnabled: true,
                blockedSites: [],
                stats: { blockedCount: 0, analyzedCount: 0 }
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

        // Add task
        document.getElementById('add-task-btn').addEventListener('click', () => {
            this.addTask();
        });

        // Enter key for adding tasks
        document.getElementById('new-task-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });

        // Removed toggle; Chrome handles enable/disable

        // Removed clear blocked sites from popup; managed in Settings

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

    async addTask() {
        const taskInput = document.getElementById('new-task-input');
        const taskText = taskInput.value.trim();
        
        if (!taskText) {
            this.showMessage('Please enter a task', 'error');
            return;
        }

        if (this.settings.tasks.includes(taskText)) {
            this.showMessage('Task already exists', 'error');
            return;
        }

        this.settings.tasks.push(taskText);
        await this.saveSettings();
        
        taskInput.value = '';
        this.showMessage('Task added!', 'success');
        this.updateUI();
    }

    async removeTask(taskIndex) {
        this.settings.tasks.splice(taskIndex, 1);
        await this.saveSettings();
        this.showMessage('Task removed!', 'success');
        this.updateUI();
    }

    // Removed toggleExtension; use Chrome extension controls instead

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
        // Removed status/history sections from popup

        // Populate form fields
        document.getElementById('api-key').value = this.settings.openaiApiKey;
        // Task input is now individual, no need to populate

        // Stats are shown in Settings only

        // Update task list
        this.updateTaskList();
        
        // Recently blocked is shown in Settings only
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

    // Removed blocked sites list rendering from popup

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
