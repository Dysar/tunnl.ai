// Options page initialization script for tunnl.ai Chrome Extension
console.log('🔧 options-init.js file loaded');

// Load scripts dynamically to ensure proper loading order
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Load scripts in order
async function initializeOptions() {
    try {
        console.log('🔧 Loading statistics.js...');
        await loadScript('statistics.js');
        console.log('🔧 StatisticsManager available:', typeof StatisticsManager !== 'undefined');
        
        console.log('🔧 Loading options.js...');
        try {
            await loadScript('options.js');
            console.log('🔧 TunnlOptions available:', typeof TunnlOptions !== 'undefined');
        } catch (error) {
            console.error('🔧 Failed to load options.js, using inline fallback:', error);
            // Fallback: define TunnlOptions inline
            window.TunnlOptions = class TunnlOptions {
                constructor() {
                    this.settings = {
                        openaiApiKey: '',
                        tasks: [],
                        extensionEnabled: true,
                        blockedSites: [],
                        stats: { blockedCount: 0, analyzedCount: 0 },
                        allowlist: []
                    };
                    this.init();
                }

                async init() {
                    console.log('🔧 TunnlOptions init() called (inline)');
                    await this.loadSettings();
                    this.setupEventListeners();
                    this.updateUI();
                    console.log('🔧 TunnlOptions init() completed (inline)');
                }

                async loadSettings() {
                    try {
                        const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
                        if (response.success) {
                            this.settings = response.settings;
                        }
                    } catch (error) {
                        console.error('Error loading settings:', error);
                    }
                }

                async saveSettings() {
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
                    const saveApiKeyBtn = document.getElementById('save-api-key');
                    if (saveApiKeyBtn) {
                        saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
                    }

                    // Tasks save
                    const saveTasksBtn = document.getElementById('save-tasks');
                    if (saveTasksBtn) {
                        saveTasksBtn.addEventListener('click', () => this.saveTasks());
                    }

                    // Reset stats
                    const resetStatsBtn = document.getElementById('reset-stats');
                    if (resetStatsBtn) {
                        resetStatsBtn.addEventListener('click', () => this.resetStats());
                    }
                }

                async saveApiKey() {
                    const apiKey = document.getElementById('api-key').value.trim();
                    if (!apiKey) {
                        this.showMessage('Please enter your OpenAI API key', 'error');
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
                    const tasks = taskText.split('\n').map(task => task.trim()).filter(task => task.length > 0);
                    this.settings.tasks = tasks;
                    await this.saveSettings();
                    this.showMessage(`Saved ${tasks.length} tasks!`, 'success');
                }

                async resetStats() {
                    if (confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
                        try {
                            const response = await chrome.runtime.sendMessage({ type: 'RESET_STATISTICS' });
                            if (response.success) {
                                await this.updateStatistics();
                                this.showMessage('Statistics reset successfully!', 'success');
                            } else {
                                this.showMessage('Failed to reset statistics', 'error');
                            }
                        } catch (error) {
                            console.error('Error resetting statistics:', error);
                            this.showMessage('Error resetting statistics', 'error');
                        }
                    }
                }

                async updateUI() {
                    // Populate form fields
                    const apiKeyField = document.getElementById('api-key');
                    if (apiKeyField) apiKeyField.value = this.settings.openaiApiKey;
                    
                    const tasksField = document.getElementById('tasks');
                    if (tasksField) tasksField.value = this.settings.tasks.join('\n');
                    
                    // Update statistics
                    await this.updateStatistics();
                }

                async updateStatistics() {
                    let retries = 3;
                    let success = false;
                    
                    while (retries > 0 && !success) {
                        try {
                            console.log(`🔄 Requesting statistics from background script... (${4-retries}/3)`);
                            const response = await chrome.runtime.sendMessage({ type: 'GET_STATISTICS' });
                            console.log('📊 Statistics response:', response);
                            
                            if (response.success && response.statistics) {
                                const stats = response.statistics;
                                
                                // Update the statistics display
                                const totalAnalyzed = document.getElementById('total-analyzed');
                                const focusScore = document.getElementById('focus-score');
                                const todayBlocked = document.getElementById('today-blocked');
                                const totalBlocked = document.getElementById('total-blocked');
                                
                                if (totalAnalyzed) totalAnalyzed.textContent = stats.urlsAnalyzed;
                                if (focusScore) focusScore.textContent = stats.focusScore;
                                if (todayBlocked) todayBlocked.textContent = stats.urlsBlocked;
                                if (totalBlocked) totalBlocked.textContent = this.settings.blockedSites.length;
                                
                                console.log('📊 Statistics updated in settings page:', stats);
                                success = true;
                            } else {
                                console.error('Failed to load statistics:', response.error);
                                retries--;
                                if (retries > 0) {
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                }
                            }
                        } catch (error) {
                            console.error('Error loading statistics:', error);
                            retries--;
                            if (retries > 0) {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                        }
                    }
                    
                    if (!success) {
                        console.log('📊 Using fallback statistics values');
                        const totalAnalyzed = document.getElementById('total-analyzed');
                        const focusScore = document.getElementById('focus-score');
                        const todayBlocked = document.getElementById('today-blocked');
                        const totalBlocked = document.getElementById('total-blocked');
                        
                        if (totalAnalyzed) totalAnalyzed.textContent = '0';
                        if (focusScore) focusScore.textContent = '0%';
                        if (todayBlocked) todayBlocked.textContent = '0';
                        if (totalBlocked) totalBlocked.textContent = this.settings.blockedSites.length;
                    }
                }

                showMessage(text, type) {
                    const container = document.getElementById('message-container');
                    if (!container) return;
                    
                    container.innerHTML = '';
                    const message = document.createElement('div');
                    let className = 'message error';
                    if (type === 'success') className = 'message success';
                    else if (type === 'info') className = 'message info';
                    message.className = className;
                    message.textContent = text;
                    container.appendChild(message);
                    
                    setTimeout(() => {
                        message.remove();
                    }, 5000);
                }
            };
            console.log('🔧 TunnlOptions defined inline as fallback');
        }
        
        console.log('🔧 All scripts loaded successfully');
        
        // Test basic functionality
        console.log('🔧 Testing Chrome extension APIs...');
        console.log('🔧 chrome.runtime available:', typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined');
        console.log('🔧 chrome.storage available:', typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined');
        
    } catch (error) {
        console.error('🔧 Error loading scripts:', error);
    }
}

// Initialize when DOM is ready
console.log('🔧 Document ready state:', document.readyState);
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await initializeOptions();
        // Initialize TunnlOptions after scripts are loaded
        if (typeof TunnlOptions !== 'undefined') {
            console.log('🔧 Creating TunnlOptions instance...');
            new TunnlOptions();
        } else {
            console.error('🔧 TunnlOptions not available after script loading');
        }
    });
} else {
    initializeOptions().then(() => {
        // Initialize TunnlOptions after scripts are loaded
        if (typeof TunnlOptions !== 'undefined') {
            console.log('🔧 Creating TunnlOptions instance...');
            new TunnlOptions();
        } else {
            console.error('🔧 TunnlOptions not available after script loading');
        }
    });
}
