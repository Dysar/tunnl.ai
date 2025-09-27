// Main content script for tunnl.ai Chrome Extension

import { blockModal } from './ui/modal.js';
import { toastNotification } from './ui/toast.js';
import { waitForPageReady, isCSPBlocking } from './utils/dom-utils.js';
import { STORAGE_AREAS, STORAGE_KEYS } from '../shared/storage-keys.js';
import { MESSAGE_TYPES } from '../shared/message-types.js';

class TunnlContent {
    constructor() {
        this.init();
    }

    async init() {
        console.log('🧪 Tunnl content script loaded');

        // Check if this is a blocked page
        if (window.location.href.includes('blocked.html')) {
            console.log('🚫 This is a blocked page, skipping content script');
            return;
        }

        // Wait for page to be ready
        const pageReady = await waitForPageReady(5000);
        if (!pageReady) {
            console.warn('⚠️ Page not ready after timeout, continuing anyway');
        }

        // Check for CSP blocking
        if (isCSPBlocking()) {
            console.warn('⚠️ CSP might be blocking script execution');
        }

        // Check for temporary unblock status
        await this.checkTemporaryUnblock();

        // Setup message listeners
        this.setupMessageListeners();

        console.log('✅ Tunnl content script initialized');
    }

    /**
     * Setup message listeners for communication with background script
     */
    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (!message || !message.type) return;

            console.log('📨 Content script received message:', message.type);

            switch (message.type) {
                case MESSAGE_TYPES.SHOW_BLOCK_TOAST:
                    this.handleShowBlockToast(message);
                    break;

                case MESSAGE_TYPES.SHOW_BLOCK_MODAL:
                    this.handleShowBlockModal(message);
                    break;

                default:
                    console.log('🤷 Unknown message type:', message.type);
            }
        });
    }

    /**
     * Handle show block toast message
     * @param {Object} message - Message object
     */
    handleShowBlockToast(message) {
        console.log('📨 Content script received toast message:', {
            url: message.url,
            message: message.message,
            activityUnderstanding: message.activityUnderstanding
        });

        try {
            toastNotification.show(
                message.url,
                message.message,
                message.activityUnderstanding
            );
        } catch (error) {
            console.error('Failed to show block toast:', error);
        }
    }

    /**
     * Handle show block modal message
     * @param {Object} message - Message object
     */
    handleShowBlockModal(message) {
        console.log('📨 Content script received modal message:', {
            url: message.url,
            message: message.message,
            activityUnderstanding: message.activityUnderstanding,
            currentTask: message.currentTask
        });

        try {
            blockModal.show(
                message.url,
                message.message,
                message.activityUnderstanding,
                message.currentTask
            );
        } catch (error) {
            console.error('Failed to show block modal:', error);
        }
    }

    /**
     * Check for temporary unblock status
     */
    async checkTemporaryUnblock() {
        try {
            const result = await chrome.storage.local.get([STORAGE_KEYS.TEMPORARY_UNBLOCK]);
            const tempUnblock = result[STORAGE_KEYS.TEMPORARY_UNBLOCK];
            
            if (tempUnblock && tempUnblock.url === window.location.href) {
                if (Date.now() < tempUnblock.until) {
                    // Still within unblock period, show notification
                    toastNotification.showTemporaryUnblockMessage();
                } else {
                    // Unblock period expired, remove from storage
                    await chrome.storage.local.remove([STORAGE_KEYS.TEMPORARY_UNBLOCK]);
                }
            }
        } catch (error) {
            console.error('Error checking temporary unblock:', error);
        }
    }
}

// Initialize content script
const tunnlContent = new TunnlContent();

// Test functions for debugging (available in console)
window.testTunnlModal = function() {
    console.log('🧪 Testing Tunnl modal...');
    blockModal.show(
        'https://example.com',
        'This is a test reason for blocking',
        'Testing the modal functionality',
        'Test task: Debug modal display'
    );
    console.log('🧪 Modal test triggered - check if modal appears');
};

window.testTunnlToast = function() {
    console.log('🧪 Testing Tunnl toast...');
    toastNotification.show(
        'https://example.com',
        'This is a test toast notification',
        'Testing the toast functionality'
    );
    console.log('🧪 Toast test triggered - check if toast appears');
};

window.testTunnlTempMessage = function() {
    console.log('🧪 Testing Tunnl temp message...');
    toastNotification.showTemporaryUnblockMessage('🧪 Test temporary unblock message');
    console.log('🧪 Temp message test triggered - check if message appears');
};

// Log available test functions
console.log('🧪 Tunnl test functions available:');
console.log('  - window.testTunnlModal() - Test the modal');
console.log('  - window.testTunnlToast() - Test the toast');
console.log('  - window.testTunnlTempMessage() - Test the temp message');
