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

    // Send a runtime message with retries to handle MV3 service worker spin-up
    async sendMessageWithRetry(message, maxRetries = 3, delayMs = 150) {
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const response = await chrome.runtime.sendMessage(message);
                return response;
            } catch (error) {
                lastError = error;
                // Known transient error when service worker isn't awake yet
                const msg = (error && (error.message || String(error))) || '';
                const isTransient = msg.includes('Receiving end does not exist') || msg.includes('Could not establish connection');
                if (!isTransient || attempt === maxRetries - 1) {
                    throw error;
                }
                // eslint-disable-next-line no-await-in-loop
                await new Promise(r => setTimeout(r, delayMs));
            }
        }
        throw lastError;
    }

    async loadSettings() {
        // Get settings from background script instead of reading storage directly
        try {
            const response = await this.sendMessageWithRetry({ type: 'GET_SETTINGS' }, 5, 200);
            if (response.success) {
                this.settings = response.settings;
            } else {
                console.error('Failed to load settings:', response.error);
                this.settings = {
                    openaiApiKey: '',
                    tasks: [],
                    extensionEnabled: true,
                    blockedSites: [],
                    stats: { blockedCount: 0, analyzedCount: 0 },
                    taskValidationEnabled: true
                };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.settings = {
                openaiApiKey: '',
                tasks: [],
                extensionEnabled: true,
                blockedSites: [],
                stats: { blockedCount: 0, analyzedCount: 0 },
                taskValidationEnabled: true
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

        // Task validation toggle
        document.getElementById('task-validation-toggle').addEventListener('change', (e) => {
            this.settings.taskValidationEnabled = e.target.checked;
            this.saveSettings();
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

        // Show loading state
        const addButton = document.getElementById('add-task-btn');
        const originalText = addButton.textContent;
        addButton.textContent = 'Validating...';
        addButton.disabled = true;

        try {
            // Validate task if validation is enabled
            if (this.settings.taskValidationEnabled) {
                const response = await this.sendMessageWithRetry({
                    type: 'VALIDATE_TASK',
                    taskText: taskText
                }, 5, 200);

                if (response.success) {
                    const validation = response.result;
                    if (!validation.isValid) {
                        // Show validation error with suggestions
                        let errorMessage = `Task needs improvement: ${validation.reason}`;
                        if (validation.suggestions && validation.suggestions.length > 0) {
                            errorMessage += '\n\nSuggestions:\n• ' + validation.suggestions.join('\n• ');
                        }
                        this.showMessage(errorMessage, 'error');
                        return;
                    } else {
                        // Show validation success
                        this.showMessage(`Task validated: ${validation.reason}`, 'success');
                        
                        // Show sample blocked sites if available
                        if (validation.sampleBlockedSites && validation.sampleBlockedSites.length > 0) {
                            this.showSampleBlockedSites(validation.sampleBlockedSites);
                        }
                    }
                } else {
                    console.error('Task validation failed:', response.error);
                    this.showMessage('Task validation failed, but adding anyway', 'warning');
                }
            }

            // Add the task
            this.settings.tasks.push(taskText);
            await this.saveSettings();
            
            taskInput.value = '';
            this.showMessage('Task added!', 'success');
            this.updateUI();

        } catch (error) {
            console.error('Error adding task:', error);
            this.showMessage('Error adding task', 'error');
        } finally {
            // Restore button state
            addButton.textContent = originalText;
            addButton.disabled = false;
        }
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
        document.getElementById('task-validation-toggle').checked = this.settings.taskValidationEnabled;
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
            
            const taskText = document.createElement('span');
            taskText.className = 'task-item-text';
            taskText.textContent = `${index + 1}. ${task}`;
            
            const removeButton = document.createElement('button');
            removeButton.className = 'task-item-remove';
            removeButton.textContent = '×';
            removeButton.title = 'Remove task';
            removeButton.addEventListener('click', () => {
                this.removeTask(index);
            });
            
            taskItem.appendChild(taskText);
            taskItem.appendChild(removeButton);
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
        const existingMessages = document.querySelectorAll('.success-message, .error-message, .warning-message');
        existingMessages.forEach(msg => msg.remove());

        const message = document.createElement('div');
        let className = 'error-message';
        if (type === 'success') className = 'success-message';
        else if (type === 'warning') className = 'warning-message';
        
        message.className = className;
        
        // Handle multi-line messages
        if (text.includes('\n')) {
            message.innerHTML = text.replace(/\n/g, '<br>');
        } else {
            message.textContent = text;
        }

        // Insert message after the current section
        const currentSection = document.querySelector('.section:not([style*="display: none"])');
        if (currentSection) {
            currentSection.appendChild(message);
        }

        // Auto-remove after longer time for validation errors with suggestions
        let timeout = 3000;
        if (type === 'error' && text.includes('Suggestions:')) {
            timeout = 30000; // 30 seconds for validation errors with suggestions
        } else if (text.length > 100) {
            timeout = 5000; // 5 seconds for other longer messages
        }
        setTimeout(() => {
            message.remove();
        }, timeout);
    }

    showSampleBlockedSites(sampleSites) {
        // Remove existing sample sites display
        const existingSample = document.querySelector('.sample-blocked-sites');
        if (existingSample) {
            existingSample.remove();
        }

        const sampleContainer = document.createElement('div');
        sampleContainer.className = 'sample-blocked-sites';
        
        const title = document.createElement('div');
        title.className = 'sample-title';
        title.textContent = 'Sample sites that would be blocked for latest task:';
        
        const sitesList = document.createElement('div');
        sitesList.className = 'sample-sites-list';
        
        sampleSites.forEach(site => {
            const siteItem = document.createElement('div');
            siteItem.className = 'sample-site-item';
            siteItem.textContent = site;
            sitesList.appendChild(siteItem);
        });
        
        sampleContainer.appendChild(title);
        sampleContainer.appendChild(sitesList);
        
        // Insert after the current section
        const currentSection = document.querySelector('.section:not([style*="display: none"])');
        if (currentSection) {
            currentSection.appendChild(sampleContainer);
        }
        // Do not auto-remove; keep visible until next validation or popup close
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
