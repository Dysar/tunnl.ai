// Popup script for tunnl.ai Chrome Extension

class TunnlPopup {
    constructor() {
        this.currentView = 'main'; // 'main' or 'detail'
        this.selectedTaskId = null;
        this.pendingTaskText = null; // For task confirmation
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.updateUI();
        await this.updateStats();
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

        // Task confirmation button
        const confirmTaskBtn = document.getElementById('confirm-task');
        if (confirmTaskBtn) {
            confirmTaskBtn.addEventListener('click', () => this.confirmTask());
        }


        // Delete task button
        const deleteBtn = document.getElementById('delete-task');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteTask());
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
                    // Check if this is a new user (no existing tasks)
                    const isNewUser = this.settings.tasks.length === 0;
                    
                    // Save the API key
                    this.settings.openaiApiKey = apiKey;
                    
                    // Add a sample task for new users
                    if (isNewUser) {
                        this.settings.tasks.push("Research competitor pricing for SaaS tools");
                    }
                    
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
        // Clear validation message
        this.clearAddTaskValidationMessage();
    }

    updateCharCounter() {
        const textarea = document.getElementById('new-task-text');
        const counter = document.getElementById('char-count');
        if (textarea && counter) {
            counter.textContent = textarea.value.length;
        }
    }


    clearAddTaskValidationMessage() {
        const messageEl = document.getElementById('add-task-validation-message');
        if (messageEl) {
            messageEl.classList.add('hidden');
            messageEl.textContent = '';
            messageEl.className = 'validation-message-inline hidden';
        }
    }

    showAddTaskValidationMessage(text, type) {
        const messageEl = document.getElementById('add-task-validation-message');
        if (messageEl) {
            messageEl.classList.remove('hidden');
            messageEl.className = `validation-message-inline ${type}`;
            
            // Show full message since it's now scrollable
            if (text.includes('\n')) {
                messageEl.innerHTML = text.replace(/\n/g, '<br>');
            } else {
                messageEl.textContent = text;
            }
        }
    }

    showTaskConfirmation(taskText, validation) {
        // Hide validation message
        this.clearAddTaskValidationMessage();
        
        // Show confirmation section
        const confirmationEl = document.getElementById('task-confirmation');
        if (confirmationEl) {
            confirmationEl.classList.remove('hidden');
        }
        
        // Populate topic, action, and effectiveness
        const topicEl = document.getElementById('confirmation-topic');
        const actionEl = document.getElementById('confirmation-action');
        const effectivenessEl = document.getElementById('confirmation-effectiveness');
        if (topicEl) topicEl.textContent = validation.topic || 'Unknown topic';
        if (actionEl) actionEl.textContent = validation.action || 'Unknown action';
        if (effectivenessEl) effectivenessEl.textContent = validation.effectiveness || 'Effectiveness not assessed';
        
        // Store current task text for confirmation
        this.pendingTaskText = taskText;
    }

    hideTaskConfirmation() {
        const confirmationEl = document.getElementById('task-confirmation');
        if (confirmationEl) {
            confirmationEl.classList.add('hidden');
        }
        
        this.pendingTaskText = null;
    }

    async confirmTask() {
        if (!this.pendingTaskText) return;
        
        // Create task object
        const taskObject = {
            text: this.pendingTaskText,
            completed: false,
            createdAt: Date.now()
        };
        
        // Add the task
        this.settings.tasks.push(taskObject);
        await this.saveSettings();

        // If this is the first task or no current task is set, make it active
        if (this.settings.tasks.length === 1 && !this.settings.currentTask) {
            this.settings.currentTask = { text: taskObject.text, index: 0, setAt: Date.now() };
            await this.saveSettings();
        }

        // Clear input and hide confirmation
        const taskInput = document.getElementById('new-task-text');
        if (taskInput) taskInput.value = '';
        
        this.hideTaskConfirmation();
        this.showAddTaskValidationMessage('✅ Task added successfully!', 'success');
        
        // Auto-return to main view after a short delay
        setTimeout(() => {
            this.showMainView();
            this.updateUI();
        }, 1500);
    }


    async addTaskFromEditor() {
        const taskInput = document.getElementById('new-task-text');
        const taskText = (taskInput ? taskInput.value : '').trim();

        if (!taskText) {
            this.showAddTaskValidationMessage('Please enter a task', 'error');
            return;
        }
        if (this.settings.tasks.includes(taskText)) {
            this.showAddTaskValidationMessage('Task already exists', 'error');
            return;
        }

        // Clear previous validation message
        this.clearAddTaskValidationMessage();

        // Show loading state
        const addButton = document.getElementById('save-new-task');
        const originalText = addButton ? addButton.textContent : '';
        if (addButton) {
            addButton.textContent = 'Analyzing...';
            addButton.disabled = true;
        }

        try {
            // Get task understanding from LLM
                const response = await this.sendMessageWithRetry({
                    type: 'VALIDATE_TASK',
                    taskText: taskText
                }, 5, 200);

                if (response.success) {
                const understanding = response.result;
                // Always show confirmation step with task understanding
                this.showTaskConfirmation(taskText, understanding);
                        return;
                    } else {
                console.error('Task understanding failed:', response.error);
                // Fallback to basic understanding
                this.showTaskConfirmation(taskText, { 
                    topic: 'General task', 
                    action: 'Work on task',
                    effectiveness: 'Moderately effective - analysis failed'
                });
                return;
            }
            
            // Auto-return to main view after a short delay
            setTimeout(() => {
                this.showMainView();
            this.updateUI();
            }, 1500);

        } catch (error) {
            console.error('Error adding task:', error);
            this.showAddTaskValidationMessage('Error adding task', 'error');
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

        // Check if there's an active lock and show the display
        this.checkAndShowLockDisplay();
    }

    checkAndShowLockDisplay() {
        if (this.settings.currentTask && this.settings.currentTask.setAt) {
            const elapsedMs = Date.now() - this.settings.currentTask.setAt;
            const elapsedMinutes = elapsedMs / (1000 * 60);
            
            if (elapsedMinutes < 5) {
                this.showTaskSwitchLocked();
            }
        }
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
        const activeTasks = this.settings.tasks?.filter(task => {
            // Handle both old string format and new object format
            if (typeof task === 'string') return true;
            return !task.completed;
        }) || [];
        const completedTasksList = this.settings.tasks?.filter(task => {
            // Handle both old string format and new object format
            if (typeof task === 'string') return false;
            return task.completed;
        }) || [];

        // Ensure there's always an active task - set first task as active if none is set
        if (activeTasks.length > 0 && !this.settings.currentTask) {
            // Set the first task as active immediately
            const firstTask = activeTasks[0].text || activeTasks[0];
            this.settings.currentTask = { text: firstTask, index: 0, setAt: Date.now() };
            // Also save this to the background script
            this.setCurrentTask(firstTask);
        }

        const currentTaskText = this.settings.currentTask?.text?.text || this.settings.currentTask?.text;
        console.log('🔍 Current task text:', currentTaskText);
        console.log('🔍 Active tasks:', activeTasks);
        console.log('🔍 Settings currentTask:', this.settings.currentTask);

        // Reorder active tasks: current task first, then others
        const currentTask = activeTasks.find(task => {
            const taskTextToCompare = task.text || task;
            return taskTextToCompare === currentTaskText;
        });
        const otherTasks = activeTasks.filter(task => {
            const taskTextToCompare = task.text || task;
            return taskTextToCompare !== currentTaskText;
        });
        const reorderedTasks = currentTask ? [currentTask, ...otherTasks] : activeTasks;

        // Render active tasks in reordered sequence
        reorderedTasks.forEach((task, index) => {
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            
            // Add active class if this is the current task
            const taskText = task.text || task;
            const normalizedCurrentTask = typeof currentTaskText === 'object' ? currentTaskText.text : currentTaskText;
            const normalizedTaskText = typeof taskText === 'object' ? taskText.text : taskText;
            console.log('🔍 Comparing:', normalizedCurrentTask, '===', normalizedTaskText, '?', normalizedCurrentTask === normalizedTaskText);
            if (normalizedCurrentTask === normalizedTaskText) {
                taskItem.classList.add('active');
                console.log('✅ Added active class to task:', normalizedTaskText);
                
                // Add move-to-top animation if this task moved to the top
                if (index === 0) {
                    taskItem.classList.add('moving-to-top');
                    setTimeout(() => {
                        taskItem.classList.remove('moving-to-top');
                    }, 800); // Match the CSS animation duration
                }
            } else {
                console.log('❌ No active class for task:', normalizedTaskText);
            }

            // Create radio button
            const radio = document.createElement('div');
            radio.className = 'task-radio';

            // Create task text
            const taskTextElement = document.createElement('div');
            taskTextElement.className = 'task-text';
            taskTextElement.textContent = normalizedTaskText;

            // Create delete button
            const deleteButton = document.createElement('button');
            deleteButton.className = 'task-delete-btn';
            deleteButton.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M10 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M14 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            deleteButton.title = 'Delete task';
            
            // Add click handler for delete button (stop propagation to prevent task selection)
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent task selection when clicking delete
                this.deleteTaskFromList(normalizedTaskText);
            });

            // Add click handler for radio button (completion for all tasks)
            radio.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent task selection when clicking radio
                // Complete the task regardless of whether it's current or not
                this.completeTask(normalizedTaskText);
            });

            // Add click handler for the entire task item (except buttons)
            taskItem.addEventListener('click', (e) => {
                // Don't trigger if clicking on buttons
                if (e.target.closest('.task-delete-btn') || e.target.closest('.task-radio')) {
                    return;
                }
                
                if (normalizedCurrentTask === normalizedTaskText) {
                    // If clicking on current task, show detail view
                    this.showTaskDetail(task.id || normalizedTaskText);
                } else {
                    // Otherwise, set as current task
                    this.setCurrentTask(normalizedTaskText);
                }
            });

            taskItem.appendChild(radio);
            taskItem.appendChild(taskTextElement);
            taskItem.appendChild(deleteButton);
            taskList.appendChild(taskItem);
        });

        // Render completed tasks
        completedTasksList.forEach((task) => {
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item completed';

            // Create radio button with checkmark
            const radio = document.createElement('div');
            radio.className = 'task-radio completed';
            radio.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;

            // Create task text
            const taskText = document.createElement('div');
            taskText.className = 'task-text';
            taskText.textContent = task.text || task;

            // Create delete button for completed tasks too
            const deleteButton = document.createElement('button');
            deleteButton.className = 'task-delete-btn';
            deleteButton.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M10 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M14 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            deleteButton.title = 'Delete task';
            
            // Add click handler for delete button
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteTaskFromList(task.text || task);
            });

            // Add click handler for radio button (unselect to move back to active)
            radio.addEventListener('click', (e) => {
                e.stopPropagation();
                this.reverseTask(task.text || task);
            });

            taskItem.appendChild(radio);
            taskItem.appendChild(taskText);
            taskItem.appendChild(deleteButton);
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
            // Check if there's a 5-minute lock since last task switch
            if (this.settings.currentTask && this.settings.currentTask.setAt) {
                const elapsedMs = Date.now() - this.settings.currentTask.setAt;
                const elapsedMinutes = elapsedMs / (1000 * 60);
                
                if (elapsedMinutes < 5) {
                    const remainingMinutes = Math.ceil(5 - elapsedMinutes);
                    this.showMessage(`⏰ Task switching locked for ${remainingMinutes} more minutes.`, 'warning');
                    this.showTaskSwitchLocked();
                    return;
                }
            }
            
            const taskIndex = this.settings.tasks.findIndex(task => (task.text || task) === taskText);
            const response = await this.sendMessageWithRetry({
                type: 'SET_CURRENT_TASK',
                index: taskIndex >= 0 ? taskIndex : 0
            }, 5, 200);

            if (response?.success) {
                this.settings.currentTask = response.currentTask || { text: taskText, index: taskIndex, setAt: Date.now() };
                console.log('✅ Current task set to:', this.settings.currentTask);
                
                // Update UI first to get the new DOM structure
                this.updateUI();
                
                // Then add animation to the newly rendered current task
                setTimeout(() => {
                    this.animateTaskSelection(taskText);
                }, 50);
            } else {
                console.error('Failed to set current task:', response?.error);
            }
        } catch (e) {
            console.error('SET_CURRENT_TASK error', e);
        }
    }

    showTaskSwitchLocked() {
        // Create or update the lock display
        let lockDisplay = document.getElementById('task-switch-lock');
        if (!lockDisplay) {
            lockDisplay = document.createElement('div');
            lockDisplay.id = 'task-switch-lock';
            lockDisplay.className = 'task-switch-lock';
            document.body.appendChild(lockDisplay);
        }

        // Update the display with current remaining time
        this.updateTaskSwitchLockDisplay();
        
        // Show the lock display
        lockDisplay.style.display = 'block';
        
        // Start pulsing animation
        lockDisplay.classList.add('pulsing');
        
        // Update every second
        this.lockUpdateInterval = setInterval(() => {
            this.updateTaskSwitchLockDisplay();
        }, 1000);
    }

    updateTaskSwitchLockDisplay() {
        const lockDisplay = document.getElementById('task-switch-lock');
        if (!lockDisplay || !this.settings.currentTask || !this.settings.currentTask.setAt) {
            return;
        }

        const elapsedMs = Date.now() - this.settings.currentTask.setAt;
        const elapsedMinutes = elapsedMs / (1000 * 60);
        
        if (elapsedMinutes >= 5) {
            // Lock period is over
            this.hideTaskSwitchLocked();
            return;
        }

        const remainingMinutes = Math.ceil(5 - elapsedMinutes);
        const remainingSeconds = Math.ceil((5 * 60) - (elapsedMs / 1000));
        
        lockDisplay.innerHTML = `
            <div class="lock-content">
                <div class="lock-icon">🔒</div>
                <div class="lock-text">Task switching locked</div>
                <div class="lock-timer">${remainingMinutes}:${(remainingSeconds % 60).toString().padStart(2, '0')}</div>
                <div class="lock-subtext">You can still complete or delete tasks</div>
            </div>
        `;
    }

    hideTaskSwitchLocked() {
        const lockDisplay = document.getElementById('task-switch-lock');
        if (lockDisplay) {
            lockDisplay.style.display = 'none';
            lockDisplay.classList.remove('pulsing');
        }
        
        if (this.lockUpdateInterval) {
            clearInterval(this.lockUpdateInterval);
            this.lockUpdateInterval = null;
        }
    }

    animateTaskSelection(taskText) {
        // Find the task element that's becoming current
        const taskItems = document.querySelectorAll('.task-item');
        taskItems.forEach(item => {
            const textElement = item.querySelector('.task-text');
            if (textElement && textElement.textContent === taskText) {
                // Add animation classes
                item.classList.add('becoming-active');
                
                // Remove animation classes after animation completes
                setTimeout(() => {
                    item.classList.remove('becoming-active');
                }, 600); // Match the CSS animation duration
            }
        });
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
        
        // Hide all views
        document.getElementById('task-detail').classList.add('hidden');
        document.getElementById('add-task-view').classList.add('hidden');
        document.getElementById('main-interface').classList.remove('hidden');
        
        // Clear any confirmation state
        this.hideTaskConfirmation();
        this.clearAddTaskValidationMessage();
        
        // Reset the add task form
        const taskInput = document.getElementById('new-task-text');
        if (taskInput) {
            taskInput.value = '';
        }
        this.updateCharCounter();
        
        // Reset save button
        const saveButton = document.getElementById('save-new-task');
        if (saveButton) {
            saveButton.textContent = 'Save Task';
            saveButton.disabled = false;
            saveButton.style.display = 'block';
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


    async deleteTaskFromList(taskText) {
        if (confirm('Are you sure you want to delete this task?')) {
            try {
                // Remove task from local settings
                this.settings.tasks = this.settings.tasks.filter(task => {
                    const taskTextToCompare = task.text || task;
                    return taskTextToCompare !== taskText;
                });

                // If this was the current task, clear it
                if (this.settings.currentTask?.text === taskText) {
                    this.settings.currentTask = null;
                    // Also clear it in the background script
                    await this.sendMessageWithRetry({
                        type: 'CLEAR_CURRENT_TASK'
                    });
                }

                // Save settings
                await this.saveSettings();

                // Update the UI
                this.updateTaskList();
                this.updateUI();
            } catch (error) {
                console.error('Error deleting task:', error);
            }
        }
    }

    async completeTask(taskText) {
        try {
            // Find the task and mark it as completed
            const taskIndex = this.settings.tasks.findIndex(task => {
                const taskTextToCompare = task.text || task;
                return taskTextToCompare === taskText;
            });

            if (taskIndex !== -1) {
                // Convert string task to object if needed
                if (typeof this.settings.tasks[taskIndex] === 'string') {
                    this.settings.tasks[taskIndex] = {
                        text: this.settings.tasks[taskIndex],
                        completed: true,
                        completedAt: Date.now()
                    };
            } else {
                    this.settings.tasks[taskIndex].completed = true;
                    this.settings.tasks[taskIndex].completedAt = Date.now();
                }

                // If this was the current task, clear it (this works even if task is locked)
                const currentTaskText = this.settings.currentTask?.text?.text || this.settings.currentTask?.text;
                if (currentTaskText === taskText) {
                    this.settings.currentTask = null;
                    // Hide the lock display since current task is cleared
                    this.hideTaskSwitchLocked();
                    // Also clear it in the background script
                    await this.sendMessageWithRetry({
                        type: 'CLEAR_CURRENT_TASK'
                    });
                }

                // Save settings
                await this.saveSettings();

                // Update the UI
                this.updateTaskList();
                this.updateUI();

                console.log('✅ Task completed:', taskText);
            }
        } catch (error) {
            console.error('Error completing task:', error);
        }
    }

    async reverseTask(taskText) {
        try {
            // Find the task and mark it as not completed
            const taskIndex = this.settings.tasks.findIndex(task => {
                const taskTextToCompare = task.text || task;
                return taskTextToCompare === taskText;
            });

            if (taskIndex !== -1) {
                // Convert string task to object if needed
                if (typeof this.settings.tasks[taskIndex] === 'string') {
                    this.settings.tasks[taskIndex] = {
                        text: this.settings.tasks[taskIndex],
                        completed: false
                    };
                } else {
                    this.settings.tasks[taskIndex].completed = false;
                    delete this.settings.tasks[taskIndex].completedAt;
                }

                // Save settings
                await this.saveSettings();

                // Update the UI
                    this.updateTaskList();
                this.updateUI();

                console.log('🔄 Task moved back to active:', taskText);
                }
            } catch (error) {
            console.error('Error reversing task:', error);
        }
    }



    async updateStats() {
        try {
            const response = await this.sendMessageWithRetry({ type: 'GET_STATISTICS' });
            if (response.success && response.statistics) {
                const stats = response.statistics;
                document.getElementById('urls-analyzed').textContent = stats.urlsAnalyzed;
                document.getElementById('focus-score').textContent = stats.focusScore;
                document.getElementById('urls-blocked').textContent = stats.urlsBlocked;
                console.log('📊 Statistics updated:', stats);
            } else {
                console.error('Failed to load statistics:', response.error);
                // Fallback to default values
                document.getElementById('urls-analyzed').textContent = '0';
                document.getElementById('focus-score').textContent = '0%';
                document.getElementById('urls-blocked').textContent = '0';
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
            // Fallback to default values
            document.getElementById('urls-analyzed').textContent = '0';
            document.getElementById('focus-score').textContent = '0%';
            document.getElementById('urls-blocked').textContent = '0';
        }
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
