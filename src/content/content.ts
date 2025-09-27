// Main content script for tunnl.ai Chrome Extension

import { blockModal } from './ui/modal';
import { toastNotification } from './ui/toast';
import { waitForPageReady, isCSPBlocking } from './utils/dom-utils';
import { STORAGE_AREAS, STORAGE_KEYS } from '../shared/storage-keys';
import { MESSAGE_TYPES } from '../shared/message-types';

class TunnlContent {
    private isModalVisible: boolean = false;
    private currentModal: HTMLElement | null = null;

    constructor() {
        this.init();
    }

    private async init(): Promise<void> {
        console.log('tunnl.ai content script loaded');
        
        // Wait for page to be ready
        await waitForPageReady();
        
        // Setup message listener
        this.setupMessageListener();
        
        console.log('tunnl.ai content script initialized');
    }

    private setupMessageListener(): void {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async response
        });
    }

    private async handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void): Promise<void> {
        try {
            console.log('📨 Content script received message:', message.type);
            
            switch (message.type) {
                case MESSAGE_TYPES.SHOW_BLOCK_MODAL:
                    await this.showBlockModal(message);
                    sendResponse({ success: true });
                    break;
                    
                case MESSAGE_TYPES.SHOW_BLOCK_TOAST:
                    this.showBlockToast(message);
                    sendResponse({ success: true });
                    break;
                    
                default:
                    console.log('Unknown message type:', message.type);
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error: any) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    private async showBlockModal(message: any): Promise<void> {
        try {
            console.log('🚫 Showing block modal:', message);
            
            // Hide any existing modal first
            this.hideModal();
            
            // Check if CSP is blocking script injection
            if (isCSPBlocking()) {
                console.log('⚠️ CSP blocking detected, showing fallback notification');
                this.showFallbackNotification(message);
                return;
            }
            
            // Create and show modal
            this.currentModal = blockModal({
                url: message.url,
                message: message.message,
                activityUnderstanding: message.activityUnderstanding,
                currentTask: message.currentTask,
                onContinue: () => this.handleContinue(message.url),
                onTemporaryUnblock: () => this.handleTemporaryUnblock(message.url),
                onOneTimeBypass: () => this.handleOneTimeBypass(message.url),
                onAddToAllowlist: () => this.handleAddToAllowlist(message.url)
            });
            
            this.isModalVisible = true;
            
            // Auto-hide after 2 minutes
            setTimeout(() => {
                this.hideModal();
            }, 120000);
            
        } catch (error: any) {
            console.error('Error showing block modal:', error);
            this.showFallbackNotification(message);
        }
    }

    private showBlockToast(message: any): void {
        try {
            console.log('🍞 Showing block toast:', message);
            
            // Check if CSP is blocking script injection
            if (isCSPBlocking()) {
                console.log('⚠️ CSP blocking detected, showing fallback notification');
                this.showFallbackNotification(message);
                return;
            }
            
            const toast = toastNotification({
                message: message.message,
                activityUnderstanding: message.activityUnderstanding,
                onContinue: () => this.handleContinue(message.url),
                onTemporaryUnblock: () => this.handleTemporaryUnblock(message.url),
                onOneTimeBypass: () => this.handleOneTimeBypass(message.url),
                onAddToAllowlist: () => this.handleAddToAllowlist(message.url)
            });
            
        } catch (error: any) {
            console.error('Error showing block toast:', error);
            this.showFallbackNotification(message);
        }
    }

    private showFallbackNotification(message: any): void {
        // Fallback for when CSP blocks script injection
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 16px;
            border-radius: 8px;
            z-index: 2147483647;
            max-width: 300px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        
        notification.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">🚫 Site Blocked</div>
            <div style="margin-bottom: 12px;">${message.message}</div>
            <div style="display: flex; gap: 8px;">
                <button id="continue-btn" style="
                    background: white;
                    color: #ef4444;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                ">Continue Anyway</button>
                <button id="allowlist-btn" style="
                    background: #6b46c1;
                    color: white;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                ">Allow This Site</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Add event listeners
        const continueBtn = notification.querySelector('#continue-btn');
        const allowlistBtn = notification.querySelector('#allowlist-btn');
        
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                this.handleContinue(message.url);
                notification.remove();
            });
        }
        
        if (allowlistBtn) {
            allowlistBtn.addEventListener('click', () => {
                this.handleAddToAllowlist(message.url);
                notification.remove();
            });
        }
        
        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 30000);
    }

    private hideModal(): void {
        if (this.currentModal && this.currentModal.parentNode) {
            this.currentModal.remove();
            this.currentModal = null;
            this.isModalVisible = false;
        }
    }

    private async handleContinue(url: string): Promise<void> {
        try {
            console.log('🔄 User chose to continue to:', url);
            
            // Send message to background script to allow this navigation
            await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.ONE_TIME_BYPASS,
                url: url
            });
            
            // Navigate to the URL
            window.location.href = url;
            
        } catch (error: any) {
            console.error('Error handling continue:', error);
        }
    }

    private async handleTemporaryUnblock(url: string): Promise<void> {
        try {
            console.log('⏰ User chose temporary unblock for:', url);
            
            await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.TEMPORARY_UNBLOCK,
                url: url,
                duration: 10 // 10 minutes
            });
            
            // Navigate to the URL
            window.location.href = url;
            
        } catch (error: any) {
            console.error('Error handling temporary unblock:', error);
        }
    }

    private async handleOneTimeBypass(url: string): Promise<void> {
        try {
            console.log('🎯 User chose one-time bypass for:', url);
            
            await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.ONE_TIME_BYPASS,
                url: url
            });
            
            // Navigate to the URL
            window.location.href = url;
            
        } catch (error: any) {
            console.error('Error handling one-time bypass:', error);
        }
    }

    private async handleAddToAllowlist(url: string): Promise<void> {
        try {
            console.log('✅ User chose to add to allowlist:', url);
            
            await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.ADD_TO_ALLOWLIST,
                url: url
            });
            
            // Navigate to the URL
            window.location.href = url;
            
        } catch (error: any) {
            console.error('Error handling add to allowlist:', error);
        }
    }
}

// Initialize content script
const tunnlContent = new TunnlContent();
