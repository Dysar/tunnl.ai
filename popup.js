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
                this.settings = this.defaultSettings();
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            this.settings = this.defaultSettings();
        }
    }

    defaultSettings() {
        return {
            openaiApiKey: '',
            tasks: [],
            currentTask: null, // { text, index?, setAt }
            extensionEnabled: true,
            blockedSites: [],
            stats: { blockedCount: 0, analyzedCount: 0 },
            taskValidationEnabled: true
        };
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
        // NOTE: Your original code tried: document.getElementById('.task-item') — that's invalid ('.' implies a selector).
        // We add per-item listeners in updateTaskList() when rendering tasks.

        // API Key save
        const saveBtn = document.getElementById('save-api-key');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveApiKey());
        }

        // Add task
        const addBtn = document.getElementById('add-task-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addTask());
        }

        // Enter key for adding tasks
        const newTaskInput = document.getElementById('new-task-input');
        if (newTaskInput) {
            newTaskInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addTask();
            });
        }

        // Settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }

        // Enter key handlers
        const apiKeyInput = document.getElementById('api-key');
        if (apiKeyInput) {
            apiKeyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.saveApiKey();
            });
        }

        // Task validation toggle
        const toggle = document.getElementById('task-validation-toggle');
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                this.settings.taskValidationEnabled = e.target.checked;
                this.saveSettings();
            });
        }

        // Clear current task button (created dynamically, but support if it exists initially)
        const clearBtn = document.getElementById('clear-current-task');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearCurrentTask());
        }
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
        const originalText = addButton ? addButton.textContent : '';
        if (addButton) {
            addButton.textContent = 'Validating...';
            addButton.disabled = true;
        }

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
                        let errorMessage = `Task needs improvement: ${validation.reason}`;
                        if (validation.suggestions && validation.suggestions.length > 0) {
                            errorMessage += '\n\nSuggestions:\n• ' + validation.suggestions.join('\n• ');
                        }
                        this.showMessage(errorMessage, 'error');
                        return;
                    } else {
                        this.showMessage(`Task validated: ${validation.reason}`, 'success');
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
            if (addButton) {
                addButton.textContent = originalText;
                addButton.disabled = false;
            }
        }
    }

    async removeTask(taskIndex) {
        const removed = this.settings.tasks[taskIndex];
        this.settings.tasks.splice(taskIndex, 1);
        await this.saveSettings();

        // If the removed task was the current one, clear currentTask in background
        const cur = this.settings.currentTask;
        if (cur && (cur.index === taskIndex || cur.text === removed)) {
            await this.clearCurrentTask(true); // silent = true
        }

        this.showMessage('Task removed!', 'success');
        this.updateUI();
    }

    openSettings() {
        chrome.runtime.openOptionsPage();
    }

    updateUI() {
        // Show/hide sections based on setup status
        const hasApiKey = !!this.settings.openaiApiKey;

        const setupSection = document.getElementById('setup-section');
        if (setupSection) setupSection.style.display = hasApiKey ? 'none' : 'block';

        const tasksSection = document.getElementById('tasks-section');
        if (tasksSection) tasksSection.style.display = hasApiKey ? 'block' : 'none';

        // Populate form fields
        const apiKeyEl = document.getElementById('api-key');
        if (apiKeyEl) apiKeyEl.value = this.settings.openaiApiKey || '';

        const valToggle = document.getElementById('task-validation-toggle');
        if (valToggle) valToggle.checked = !!this.settings.taskValidationEnabled;

        // Render current task banner
        this.renderCurrentTaskBanner();

        // Update task list
        this.updateTaskList();
    }

    renderCurrentTaskBanner() {
        let banner = document.getElementById('current-task-banner');

        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'current-task-banner';
            banner.className = 'current-task-banner';
            // Basic styles (optional)
            banner.style.margin = '8px 0';
            banner.style.padding = '8px';
            banner.style.border = '1px solid #ddd';
            banner.style.borderRadius = '6px';

            const tasksSection = document.getElementById('tasks-section') || document.body;
            tasksSection.prepend(banner);
        }

        const cur = this.settings.currentTask;
        banner.innerHTML = '';

        const label = document.createElement('div');
        label.style.fontWeight = '600';
        label.textContent = 'Current task:';

        const value = document.createElement('div');
        value.id = 'current-task';
        value.style.marginTop = '4px';
        value.textContent = cur?.text ? cur.text : '— none selected —';

        const btnWrap = document.createElement('div');
        btnWrap.style.marginTop = '6px';

        const clearBtn = document.createElement('button');
        clearBtn.id = 'clear-current-task';
        clearBtn.textContent = 'Clear current task';
        clearBtn.disabled = !cur?.text;
        clearBtn.addEventListener('click', () => this.clearCurrentTask());
        clearBtn.style.cursor = clearBtn.disabled ? 'not-allowed' : 'pointer';

        btnWrap.appendChild(clearBtn);
        banner.appendChild(label);
        banner.appendChild(value);
        banner.appendChild(btnWrap);
    }

    updateTaskList() {
        const taskList = document.getElementById('task-list');
        if (!taskList) return;

        taskList.innerHTML = '';
        const curText = this.settings.currentTask?.text;

        this.settings.tasks.forEach((task, index) => {
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            taskItem.style.display = 'flex';
            taskItem.style.alignItems = 'center';
            taskItem.style.gap = '8px';
            taskItem.style.padding = '4px 0';

            // "Select" button / radio-like
            const selectBtn = document.createElement('button');
            selectBtn.className = 'task-item-select';
            selectBtn.title = 'Set as current task';
            selectBtn.textContent = curText === task ? '✓' : '○';
            selectBtn.addEventListener('click', () => {
                this.setCurrentTaskByIndex(index);
            });

            const taskText = document.createElement('span');
            taskText.className = 'task-item-text';
            taskText.textContent = `${index + 1}. ${task}`;
            taskText.style.flex = '1';
            taskText.style.cursor = 'pointer';

            // Clicking the text also selects
            taskText.addEventListener('click', () => {
                this.setCurrentTaskByIndex(index);
            });

            const removeButton = document.createElement('button');
            removeButton.className = 'task-item-remove';
            removeButton.textContent = '×';
            removeButton.title = 'Remove task';
            removeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeTask(index);
            });

            // Highlight current
            if (curText === task) {
                taskItem.style.background = '#f3f0ff';
                taskItem.style.borderRadius = '6px';
                taskItem.style.padding = '6px 8px';
            }

            taskItem.appendChild(selectBtn);
            taskItem.appendChild(taskText);
            taskItem.appendChild(removeButton);
            taskList.appendChild(taskItem);
        });
    }

    async setCurrentTaskByIndex(index) {
        try {
            const response = await this.sendMessageWithRetry({
                type: 'SET_CURRENT_TASK',
                index
            }, 5, 200);

            if (response?.success) {
                // Trust background as source of truth
                this.settings.currentTask = response.currentTask || { text: this.settings.tasks[index], index, setAt: Date.now() };
                this.showMessage('Current task set.', 'success');
                this.updateUI();
            } else {
                this.showMessage(response?.error || 'Failed to set current task', 'error');
            }
        } catch (e) {
            console.error('SET_CURRENT_TASK error', e);
            this.showMessage('Error setting current task', 'error');
        }
    }

    async clearCurrentTask(silent = false) {
        try {
            const response = await this.sendMessageWithRetry({ type: 'CLEAR_CURRENT_TASK' }, 5, 200);
            if (response?.success) {
                this.settings.currentTask = null;
                if (!silent) this.showMessage('Cleared current task.', 'success');
                this.updateUI();
            } else if (!silent) {
                this.showMessage(response?.error || 'Failed to clear current task', 'error');
            }
        } catch (e) {
            console.error('CLEAR_CURRENT_TASK error', e);
            if (!silent) this.showMessage('Error clearing current task', 'error');
        }
    }

    // --- helpers below (unchanged from your version except minor guards) ---

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

        if (text.includes('\n')) {
            message.innerHTML = text.replace(/\n/g, '<br>');
        } else {
            message.textContent = text;
        }

        const currentSection = document.querySelector('.section:not([style*="display: none"])') || document.getElementById('tasks-section') || document.body;
        currentSection.appendChild(message);

        let timeout = 3000;
        if (type === 'error' && text.includes('Suggestions:')) {
            timeout = 30000;
        } else if (text.length > 100) {
            timeout = 5000;
        }
        setTimeout(() => {
            message.remove();
        }, timeout);
    }

    showSampleBlockedSites(sampleSites) {
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

        const currentSection = document.querySelector('.section:not([style*="display: none"])') || document.getElementById('tasks-section') || document.body;
        currentSection.appendChild(sampleContainer);
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TunnlPopup();
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_STATS') {
        const blocked = document.getElementById('blocked-count');
        const analyzed = document.getElementById('analyzed-count');
        if (blocked) blocked.textContent = message.stats.blockedCount;
        if (analyzed) analyzed.textContent = message.stats.analyzedCount;
    }
});
