// Popup script for tunnl.ai Chrome Extension

class TunnlPopup {
    constructor() {
        this.currentView = 'main'; // 'main' or 'detail'
        this.selectedTaskId = null;
        this.lockEndTime = null;
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

        // Add task - open add task view
        const addBtn = document.getElementById('add-task');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddTaskView());
        }

        // Enter key for adding tasks
        const newTaskInput = document.getElementById('new-task-input');
        if (newTaskInput) {
            newTaskInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addTask();
            });
        }

        // Settings button
        const settingsBtn = document.getElementById('open-options');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }

        // New design event listeners
        // Back button in task detail view
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.showMainView());
        }

        // Add Task view buttons
        const addBackBtn = document.getElementById('add-back-btn');
        if (addBackBtn) {
            addBackBtn.addEventListener('click', () => this.showMainView());
        }
        const saveNewTaskBtn = document.getElementById('save-new-task');
        if (saveNewTaskBtn) {
            saveNewTaskBtn.addEventListener('click', () => this.addTaskFromEditor());
        }

        // Character counter for new task textarea
        const newTaskText = document.getElementById('new-task-text');
        if (newTaskText) {
            newTaskText.addEventListener('input', () => this.updateCharCounter());
        }

        // Timer buttons in add task view
        const addTimerBtns = document.querySelectorAll('#add-task-view .timer-btn');
        addTimerBtns.forEach(btn => {
            btn.addEventListener('click', () => this.selectAddTaskTimer(btn));
        });

        // Custom timer input in add task view
        const addCustomMinutes = document.getElementById('custom-minutes');
        if (addCustomMinutes) {
            addCustomMinutes.addEventListener('input', () => this.handleAddTaskCustomTimer());
        }

        // Timer buttons
        const timerBtns = document.querySelectorAll('.timer-btn');
        timerBtns.forEach(btn => {
            btn.addEventListener('click', () => this.selectTimer(btn));
        });

        // Delete task button
        const deleteBtn = document.getElementById('delete-task');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteTask());
        }

        // Custom minutes input
        const customMinutes = document.getElementById('custom-minutes');
        if (customMinutes) {
            customMinutes.addEventListener('input', () => this.handleCustomTimer());
        }

        // Enter key handlers
        const apiKeyInput = document.getElementById('api-key');
        if (apiKeyInput) {
            apiKeyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.saveApiKey();
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

        // Show validation message
        this.showMessage('Validating API key...', 'info');

        try {
            // Validate the API key
            const response = await this.sendMessageWithRetry({
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
                    this.updateUI();
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

    showAddTaskView() {
        document.getElementById('main-interface').classList.add('hidden');
        document.getElementById('task-detail').classList.add('hidden');
        document.getElementById('add-task-view').classList.remove('hidden');
        const editor = document.getElementById('new-task-text');
        if (editor) {
            editor.value = '';
            this.updateCharCounter();
        }
        // Clear timer selections
        document.querySelectorAll('#add-task-view .timer-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        const customInput = document.getElementById('custom-minutes');
        if (customInput) customInput.value = '';
    }

    updateCharCounter() {
        const textarea = document.getElementById('new-task-text');
        const counter = document.getElementById('char-count');
        if (textarea && counter) {
            counter.textContent = textarea.value.length;
        }
    }

    selectAddTaskTimer(button) {
        // Remove selection from other timer buttons in add task view
        document.querySelectorAll('#add-task-view .timer-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Select this button
        button.classList.add('selected');
        
        // Clear custom input if a preset is selected
        const customInput = document.getElementById('custom-minutes');
        if (customInput) {
            customInput.value = '';
        }
    }

    handleAddTaskCustomTimer() {
        const customInput = document.getElementById('custom-minutes');
        const minutes = parseInt(customInput.value);
        
        if (minutes && minutes > 0) {
            // Remove selection from preset buttons
            document.querySelectorAll('#add-task-view .timer-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
        }
    }

    async addTaskFromEditor() {
        const taskInput = document.getElementById('new-task-text');
        const taskText = (taskInput ? taskInput.value : '').trim();

        if (!taskText) {
            this.showMessage('Please enter a task', 'error');
            return;
        }
        if (this.settings.tasks.includes(taskText)) {
            this.showMessage('Task already exists', 'error');
            return;
        }

        // Show loading state
        const addButton = document.getElementById('save-new-task');
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
                    }
                } else {
                    console.error('Task validation failed:', response.error);
                    this.showMessage('Task validation failed, but adding anyway', 'warning');
                }
            }

            // Add the task
            this.settings.tasks.push(taskText);
            await this.saveSettings();

            if (taskInput) taskInput.value = '';
            this.showMessage('Task added!', 'success');
            this.showMainView();
            this.updateUI();

        } catch (error) {
            console.error('Error adding task:', error);
            this.showMessage('Error adding task', 'error');
        } finally {
            if (addButton) {
                addButton.textContent = originalText || 'Save Task';
                addButton.disabled = false;
            }
        }

        // If this is the first task and no current task is set, make it active
        if (this.settings.tasks.length === 1 && !this.settings.currentTask) {
            this.setCurrentTask(taskText);
        }
    }

    async removeTask(taskIndex) {
        const removed = this.settings.tasks[taskIndex];
        this.settings.tasks.splice(taskIndex, 1);
        await this.saveSettings();

        // If the removed task was the current one, set the first remaining task as active
        const cur = this.settings.currentTask;
        if (cur && (cur.index === taskIndex || cur.text === removed)) {
            if (this.settings.tasks.length > 0) {
                // Set the first remaining task as active
                this.setCurrentTask(this.settings.tasks[0]);
            } else {
                await this.clearCurrentTask(true); // silent = true
            }
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

        const apiSetup = document.getElementById('api-setup');
        if (apiSetup) {
            if (hasApiKey) {
                apiSetup.classList.add('hidden');
            } else {
                apiSetup.classList.remove('hidden');
            }
        }

        const mainInterface = document.getElementById('main-interface');
        if (mainInterface) {
            if (hasApiKey) {
                mainInterface.classList.remove('hidden');
            } else {
                mainInterface.classList.add('hidden');
            }
        }

        // Populate form fields
        const apiKeyEl = document.getElementById('api-key');
        if (apiKeyEl) apiKeyEl.value = this.settings.openaiApiKey || '';

        // Update task list
        this.updateTaskList();

        // Update switching notice
        this.updateSwitchingNotice();

        // Load lock time from storage
        chrome.storage.local.get(['lockEndTime'], (result) => {
            if (result.lockEndTime) {
                this.lockEndTime = result.lockEndTime;
                this.updateSwitchingNotice();
            }
        });
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
        const taskList = document.getElementById('task-items') || document.getElementById('task-list');
        const completedTasks = document.getElementById('completed-tasks');
        if (!taskList) return;

        // Clear both lists
        taskList.innerHTML = '';
        if (completedTasks) completedTasks.innerHTML = '';

        // Separate active and completed tasks
        const activeTasks = this.settings.tasks?.filter(task => !task.completed) || [];
        const completedTasksList = this.settings.tasks?.filter(task => task.completed) || [];

        // Ensure there's always an active task - set first task as active if none is set
        if (activeTasks.length > 0 && !this.settings.currentTask) {
            // Set the first task as active immediately
            const firstTask = activeTasks[0].text || activeTasks[0];
            this.settings.currentTask = { text: firstTask, index: 0, setAt: Date.now() };
            // Also save this to the background script
            this.setCurrentTask(firstTask);
        }

        const currentTaskText = this.settings.currentTask?.text;
        console.log('Current task text:', currentTaskText);
        console.log('Active tasks:', activeTasks);

        // Render active tasks
        activeTasks.forEach((task) => {
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            
            // Add active class if this is the current task
            const taskText = task.text || task;
            console.log('Comparing:', currentTaskText, '===', taskText, '?', currentTaskText === taskText);
            if (currentTaskText === taskText) {
                taskItem.classList.add('active');
                console.log('Added active class to task:', taskText);
            }

            // Create radio button
            const radio = document.createElement('div');
            radio.className = 'task-radio';

            // Create task text
            const taskTextElement = document.createElement('div');
            taskTextElement.className = 'task-text';
            taskTextElement.textContent = taskText;

            // Add click handler for the entire task item
            taskItem.addEventListener('click', () => {
                if (currentTaskText === taskText) {
                    // If clicking on current task, show detail view
                    this.showTaskDetail(task.id || taskText);
                } else {
                    // Otherwise, set as current task
                    this.setCurrentTask(taskText);
                }
            });

            taskItem.appendChild(radio);
            taskItem.appendChild(taskTextElement);
            taskList.appendChild(taskItem);
        });

        // Render completed tasks
        completedTasksList.forEach((task) => {
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item completed';

            // Create radio button with checkmark
            const radio = document.createElement('div');
            radio.className = 'task-radio';

            // Create task text
            const taskText = document.createElement('div');
            taskText.className = 'task-text';
            taskText.textContent = task.text || task;

            taskItem.appendChild(radio);
            taskItem.appendChild(taskText);
            if (completedTasks) completedTasks.appendChild(taskItem);
        });

        // Update stats
        this.updateStats();
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

    async setCurrentTask(taskText) {
        try {
            const taskIndex = this.settings.tasks.findIndex(task => (task.text || task) === taskText);
            const response = await this.sendMessageWithRetry({
                type: 'SET_CURRENT_TASK',
                index: taskIndex >= 0 ? taskIndex : 0
            }, 5, 200);

            if (response?.success) {
                this.settings.currentTask = response.currentTask || { text: taskText, index: taskIndex, setAt: Date.now() };
                this.updateUI();
            } else {
                console.error('Failed to set current task:', response?.error);
            }
        } catch (e) {
            console.error('SET_CURRENT_TASK error', e);
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
        const existingMessages = document.querySelectorAll('.success-message, .error-message, .warning-message, .info-message');
        existingMessages.forEach(msg => msg.remove());

        const message = document.createElement('div');
        let className = 'error-message';
        if (type === 'success') className = 'success-message';
        else if (type === 'warning') className = 'warning-message';
        else if (type === 'info') className = 'info-message';

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

    // New methods for the redesigned interface

    showTaskDetail(taskId) {
        this.selectedTaskId = taskId;
        this.currentView = 'detail';
        
        const task = this.settings.tasks?.find(t => t.id === taskId);
        if (!task) return;

        // Update task detail content
        document.getElementById('detail-task-title').textContent = task.text;
        document.getElementById('detail-task-description').textContent = task.description || task.text;

        // Show task detail view
        document.getElementById('main-interface').classList.add('hidden');
        document.getElementById('task-detail').classList.remove('hidden');
    }

    showMainView() {
        this.currentView = 'main';
        this.selectedTaskId = null;
        
        // Hide task detail view
        document.getElementById('task-detail').classList.add('hidden');
        document.getElementById('main-interface').classList.remove('hidden');
    }

    selectTimer(button) {
        // Remove selection from other timer buttons
        document.querySelectorAll('.timer-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Select this button
        button.classList.add('selected');
        
        // Clear custom input if a preset is selected
        const customInput = document.getElementById('custom-minutes');
        if (customInput) {
            customInput.value = '';
        }

        // Get minutes and potentially start timer
        const minutes = parseInt(button.getAttribute('data-minutes'));
        this.setLockTimer(minutes);
    }

    handleCustomTimer() {
        const customInput = document.getElementById('custom-minutes');
        const minutes = parseInt(customInput.value);
        
        if (minutes && minutes > 0) {
            // Remove selection from preset buttons
            document.querySelectorAll('.timer-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            this.setLockTimer(minutes);
        }
    }

    setLockTimer(minutes) {
        if (!minutes || minutes <= 0) return;
        
        this.lockEndTime = Date.now() + (minutes * 60 * 1000);
        
        // Save the lock time to storage
        chrome.storage.local.set({
            lockEndTime: this.lockEndTime,
            lockedTaskId: this.selectedTaskId
        });

        // Update the switching notice
        this.updateSwitchingNotice();
        
        // Go back to main view
        this.showMainView();
    }

    updateSwitchingNotice() {
        const notice = document.querySelector('.switching-notice');
        const noticeText = document.querySelector('.notice-text');
        
        if (this.lockEndTime && Date.now() < this.lockEndTime) {
            const remainingMs = this.lockEndTime - Date.now();
            const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
            const minutes = remainingMinutes % 60;
            const hours = Math.floor(remainingMinutes / 60);
            
            let timeText = '';
            if (hours > 0) {
                timeText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} hr`;
            } else {
                timeText = `${minutes.toString().padStart(2, '0')}:${(remainingMs % 60000 / 1000).toFixed(0).padStart(2, '0')} min`;
            }
            
            noticeText.textContent = `Switching tasks is locked for ${timeText}`;
            notice.style.display = 'flex';
        } else {
            notice.style.display = 'none';
            this.lockEndTime = null;
        }
    }

    async deleteTask() {
        if (!this.selectedTaskId) return;
        
        if (confirm('Are you sure you want to delete this task?')) {
            try {
                const response = await this.sendMessageWithRetry({
                    type: 'DELETE_TASK',
                    taskId: this.selectedTaskId
                });

                if (response.success) {
                    await this.loadSettings();
                    this.showMainView();
                    this.updateTaskList();
                }
            } catch (error) {
                console.error('Error deleting task:', error);
            }
        }
    }

    updateStats() {
        // Update with real data when available
        document.getElementById('urls-analyzed').textContent = '317';
        document.getElementById('focus-score').textContent = '97%';
        document.getElementById('urls-blocked').textContent = '16';
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
