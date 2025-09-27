// Block modal component for content scripts

import { createModal, injectStyles, addEventListenerSafe, removeElementSafe, getExtensionResourceUrl } from '../utils/dom-utils.js';
import { escapeHtml } from '../../shared/utils.js';
import { TIMING_CONFIG, UI_CONFIG } from '../../shared/constants.js';

class BlockModal {
    constructor() {
        this.modalId = 'tunnl-block-modal';
        this.isVisible = false;
    }

    /**
     * Show block modal
     * @param {string} blockedUrl - URL that was blocked
     * @param {string} reasonMessage - Reason for blocking
     * @param {string} activityUnderstanding - AI's understanding of user activity
     * @param {string} currentTask - Current task text
     */
    show(blockedUrl, reasonMessage, activityUnderstanding, currentTask) {
        console.log('🚫 Creating block modal:', {
            blockedUrl,
            reasonMessage,
            activityUnderstanding,
            currentTask
        });

        try {
            // Remove any existing modals first
            this.hide();

            // Create modal content
            const content = this.createModalContent(blockedUrl, reasonMessage, activityUnderstanding);
            
            // Create modal element
            const modal = createModal(content, this.modalId);
            if (!modal) {
                console.error('Failed to create modal element');
                return;
            }

            // Inject styles
            this.injectModalStyles();

            // Setup event listeners
            this.setupEventListeners(modal, blockedUrl);

            this.isVisible = true;
            console.log('✅ Block modal shown successfully');

        } catch (error) {
            console.error('Failed to show block modal:', error);
        }
    }

    /**
     * Hide block modal
     */
    hide() {
        try {
            removeElementSafe(this.modalId);
            this.isVisible = false;
            console.log('✅ Block modal hidden');
        } catch (error) {
            console.error('Failed to hide modal:', error);
        }
    }

    /**
     * Create modal HTML content
     * @param {string} blockedUrl - Blocked URL
     * @param {string} reasonMessage - Reason message
     * @param {string} activityUnderstanding - Activity understanding
     * @returns {string} - HTML content
     */
    createModalContent(blockedUrl, reasonMessage, activityUnderstanding) {
        const accessDeniedUrl = getExtensionResourceUrl('assets/access_denied.png');
        
        return `
            <div class="tunnl-modal-overlay">
                <div class="tunnl-modal-content">
                    <img src="${accessDeniedUrl}" alt="Access Denied Banner" class="tunnl-access-denied-banner">
                    
                    <div class="tunnl-explanation-box">
                        <p class="tunnl-explanation-text">${escapeHtml(reasonMessage || 'This site may distract you from your current task.')}</p>
                    </div>
                    
                    <div class="tunnl-action-buttons">
                        <button class="tunnl-btn tunnl-btn-secondary" id="tunnl-go-back">You got me</button>
                        <button class="tunnl-btn tunnl-btn-primary" id="tunnl-continue">You're wrong, let me in</button>
                    </div>
                    
                    <p class="tunnl-bypass-link">
                        <a id="tunnl-continue-link" href="#">I dont care if its a distraction, allow now</a>
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Inject modal styles
     */
    injectModalStyles() {
        const styles = `
            /* Cache buster: ${Date.now()} */
            #${this.modalId} {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                z-index: ${UI_CONFIG.MODAL_Z_INDEX} !important;
                font-family: 'Excalifont', 'Kalam', cursive, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: block !important;
            }

            .tunnl-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                box-sizing: border-box;
            }

            .tunnl-modal-content {
                background: #67513a;
                border: 8px solid #67513a;
                border-radius: 20px;
                padding: 25px;
                max-width: 520px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.1);
                animation: modalSlideIn 0.3s ease-out;
                position: relative;
            }

            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }

            .tunnl-access-denied-banner {
                width: 100%;
                max-width: 400px;
                height: auto;
                margin-bottom: 15px;
                display: block;
                border-radius: 8px;
            }

            .tunnl-explanation-box {
                background: #79804d;
                border: 4px solid #67513a;
                border-radius: 15px;
                padding: 18px 20px;
                margin: 15px 0;
                box-shadow: inset 0 3px 6px rgba(0, 0, 0, 0.2);
                position: relative;
            }

            .tunnl-explanation-text {
                color: #f8f1ee;
                font-size: 18px;
                line-height: 1.5;
                margin: 0;
                font-weight: 400;
                text-align: left;
                font-style: italic;
            }

            .tunnl-action-buttons {
                display: flex;
                gap: 20px;
                justify-content: center;
                margin: 20px 0 15px 0;
                flex-wrap: wrap;
            }

            .tunnl-btn {
                padding: 14px 24px;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 400;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 3px solid;
                font-family: inherit;
                min-width: 160px;
                text-transform: none;
                letter-spacing: 0.5px;
            }

            .tunnl-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            }

            .tunnl-btn-secondary {
                background: #eaddd7 !important;
                border-color: #67513a !important;
                color: #67513a !important;
            }

            .tunnl-btn-secondary:hover {
                background: #d2bab0 !important;
            }

            .tunnl-btn-primary {
                background: #eaddd7 !important;
                border-color: #67513a !important;
                color: #67513a !important;
            }

            .tunnl-btn-primary:hover {
                background: #d2bab0 !important;
            }

            .tunnl-bypass-link {
                margin: 15px 0 0 0;
            }

            .tunnl-bypass-link a {
                color: #f8f1ee;
                text-decoration: underline;
                font-size: 16px;
                font-weight: 400;
                font-style: italic;
                letter-spacing: 0.3px;
                transition: all 0.2s ease;
            }

            .tunnl-bypass-link a:hover {
                color: #eaddd7;
                text-decoration-thickness: 2px;
            }

            /* Responsive adjustments */
            @media (max-width: 420px) {
                .tunnl-modal-content {
                    padding: 20px;
                }
                .tunnl-action-buttons {
                    flex-direction: column;
                    align-items: center;
                }
                .tunnl-btn {
                    width: 100%;
                    max-width: 200px;
                }
            }
        `;

        injectStyles(styles, 'tunnl-modal-styles');
    }

    /**
     * Setup modal event listeners
     * @param {HTMLElement} modal - Modal element
     * @param {string} blockedUrl - Blocked URL
     */
    setupEventListeners(modal, blockedUrl) {
        // Go back button
        const goBackBtn = modal.querySelector('#tunnl-go-back');
        if (goBackBtn) {
            addEventListenerSafe(goBackBtn, 'click', () => {
                if (history.length > 1) {
                    history.back();
                } else {
                    window.location.href = 'chrome://new-tab-page/';
                }
                this.hide();
            });
        }

        // Continue to site button (temporary unblock)
        const continueBtn = modal.querySelector('#tunnl-continue');
        if (continueBtn) {
            addEventListenerSafe(continueBtn, 'click', async () => {
                try {
                    await chrome.runtime.sendMessage({
                        type: 'TEMPORARY_UNBLOCK',
                        url: blockedUrl,
                        duration: 10
                    });
                    window.location.href = blockedUrl;
                } catch (error) {
                    console.error('Error temporarily unblocking:', error);
                    window.location.href = blockedUrl;
                }
            });
        }

        // Continue link (one-time bypass)
        const continueLink = modal.querySelector('#tunnl-continue-link');
        if (continueLink) {
            addEventListenerSafe(continueLink, 'click', async (e) => {
                e.preventDefault();
                try {
                    await chrome.runtime.sendMessage({
                        type: 'ONE_TIME_BYPASS',
                        url: blockedUrl
                    });
                    window.location.href = blockedUrl;
                } catch (error) {
                    console.error('Error setting one-time bypass:', error);
                    window.location.href = blockedUrl;
                }
            });
        }

        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.hide();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Close on overlay click
        const overlay = modal.querySelector('.tunnl-modal-overlay');
        if (overlay) {
            addEventListenerSafe(overlay, 'click', (e) => {
                if (e.target === overlay) {
                    this.hide();
                }
            });
        }
    }

    /**
     * Check if modal is currently visible
     * @returns {boolean} - True if modal is visible
     */
    isModalVisible() {
        return this.isVisible;
    }
}

// Export singleton instance
export const blockModal = new BlockModal();
export default blockModal;
