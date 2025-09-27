// Statistics Manager for Dam.AI Extension
// Handles tracking and calculation of extension statistics

class StatisticsManager {
    constructor() {
        this.stats = {
            urlsAnalyzedToday: 0,
            urlsBlockedToday: 0,
            focusScore: 0,
            lastResetDate: null
        };
        this.init();
    }

    async init() {
        await this.loadStats();
        this.checkDailyReset();
    }

    // Load statistics from storage
    async loadStats() {
        try {
            const result = await chrome.storage.local.get(['statistics']);
            if (result.statistics) {
                this.stats = { ...this.stats, ...result.statistics };
                console.log('📊 Statistics loaded:', this.stats);
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    // Save statistics to storage
    async saveStats() {
        try {
            await chrome.storage.local.set({ statistics: this.stats });
            console.log('💾 Statistics saved:', this.stats);
        } catch (error) {
            console.error('Error saving statistics:', error);
        }
    }

    // Check if we need to reset daily counters
    checkDailyReset() {
        const today = new Date().toDateString();
        if (this.stats.lastResetDate !== today) {
            console.log('🔄 Daily reset - new day detected');
            this.resetDailyCounters();
            this.stats.lastResetDate = today;
            this.saveStats();
        }
    }

    // Reset daily counters
    resetDailyCounters() {
        this.stats.urlsAnalyzedToday = 0;
        this.stats.urlsBlockedToday = 0;
        this.stats.focusScore = 0;
        console.log('🔄 Daily counters reset');
    }

    // Increment URLs analyzed counter
    async incrementUrlsAnalyzed() {
        this.stats.urlsAnalyzedToday++;
        this.calculateFocusScore();
        await this.saveStats();
        console.log('📈 URLs analyzed today:', this.stats.urlsAnalyzedToday);
        return this.stats.urlsAnalyzedToday;
    }

    // Increment URLs blocked counter
    async incrementUrlsBlocked() {
        this.stats.urlsBlockedToday++;
        this.calculateFocusScore();
        await this.saveStats();
        console.log('🚫 URLs blocked today:', this.stats.urlsBlockedToday);
        return this.stats.urlsBlockedToday;
    }

    // Calculate focus score as percentage of blocked vs analyzed URLs
    calculateFocusScore() {
        if (this.stats.urlsAnalyzedToday === 0) {
            this.stats.focusScore = 0;
        } else {
            this.stats.focusScore = Math.round(
                (this.stats.urlsBlockedToday / this.stats.urlsAnalyzedToday) * 100
            );
        }
        console.log('🎯 Focus score calculated:', this.stats.focusScore + '%');
        return this.stats.focusScore;
    }

    // Get current statistics
    getStats() {
        return {
            urlsAnalyzedToday: this.stats.urlsAnalyzedToday,
            urlsBlockedToday: this.stats.urlsBlockedToday,
            focusScore: this.stats.focusScore
        };
    }

    // Get formatted statistics for display
    getFormattedStats() {
        return {
            urlsAnalyzed: this.stats.urlsAnalyzedToday.toString(),
            focusScore: this.stats.focusScore + '%',
            urlsBlocked: this.stats.urlsBlockedToday.toString()
        };
    }

    // Reset all statistics (for testing or user request)
    async resetAllStats() {
        this.stats = {
            urlsAnalyzedToday: 0,
            urlsBlockedToday: 0,
            focusScore: 0,
            lastResetDate: new Date().toDateString()
        };
        await this.saveStats();
        console.log('🔄 All statistics reset');
    }

    // Get statistics summary for display
    getSummary() {
        return {
            totalAnalyzed: this.stats.urlsAnalyzedToday,
            totalBlocked: this.stats.urlsBlockedToday,
            focusPercentage: this.stats.focusScore,
            lastReset: this.stats.lastResetDate
        };
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatisticsManager;
} else {
    window.StatisticsManager = StatisticsManager;
}
