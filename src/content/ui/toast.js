// Toast notification component for content scripts

import { createToast, injectStyles, addEventListenerSafe, removeElementSafe } from '../utils/dom-utils.js';
import { escapeHtml } from '../../shared/utils.js';
import { TIMING_CONFIG, UI_CONFIG } from '../../shared/constants.js';

class ToastNotification {
    constructor() {
        this.toastId = 'tunnl-block-toast';
        this.isVisible = false;
    }

    /**
     * Show block toast notification
     * @param {string} blockedUrl - URL that was blocked
     * @param {string} reasonMessage - Reason for blocking
     * @param {string} activityUnderstanding - AI's understanding of user activity
     */
    show(blockedUrl, reasonMessage, activityUnderstanding) {
        console.log('🍞 Creating block toast:', {
            blockedUrl,
            reasonMessage,
            activityUnderstanding
        });

        try {
            // Avoid duplicate toasts
            if (this.isVisible) {
                console.log('⚠️ Toast already exists, skipping creation');
                return;
            }

            // Create toast content
            const content = this.createToastContent(reasonMessage, activityUnderstanding);
            
            // Create toast element
            const toast = createToast(content, this.toastId);
            if (!toast) {
                console.error('Failed to create toast element');
                return;
            }

            // Inject styles
            this.injectToastStyles();

            // Setup event listeners
            this.setupEventListeners(toast);

            this.isVisible = true;
            console.log('✅ Toast created and added to page');

            // Auto-dismiss after timeout
            setTimeout(() => {
                this.hide();
            }, TIMING_CONFIG.TOAST_AUTO_DISMISS);

        } catch (error) {
            console.error('Failed to create toast:', error);
        }
    }

    /**
     * Hide toast notification
     */
    hide() {
        try {
            removeElementSafe(this.toastId);
            this.isVisible = false;
            console.log('✅ Toast hidden');
        } catch (error) {
            console.error('Failed to hide toast:', error);
        }
    }

    /**
     * Create toast HTML content
     * @param {string} reasonMessage - Reason message
     * @param {string} activityUnderstanding - Activity understanding
     * @returns {string} - HTML content
     */
    createToastContent(reasonMessage, activityUnderstanding) {
        return `
            <div class="tunnl-toast">
                <div class="tunnl-toast-title">tunnl.ai blocked a distraction</div>
                <div class="tunnl-toast-activity">${escapeHtml(activityUnderstanding || 'Unable to understand your activities')}</div>
                <div class="tunnl-toast-body">${escapeHtml(reasonMessage || 'Not related to your current tasks')}</div>
                <div class="tunnl-toast-actions">
                    <button id="tunnl-dismiss-toast">Dismiss</button>
                </div>
            </div>
        `;
    }

    /**
     * Inject toast styles
     */
    injectToastStyles() {
        const styles = `
            #${this.toastId} {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: ${UI_CONFIG.TOAST_Z_INDEX};
                max-width: 360px;
                animation: tunnl-fade-in 0.2s ease-out;
            }

            @keyframes tunnl-fade-in {
                from {
                    opacity: 0;
                    transform: translateY(6px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .tunnl-toast {
                background: #111827;
                color: #e5e7eb;
                border: 1px solid #374151;
                border-radius: 10px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.25);
                padding: 14px 14px 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .tunnl-toast-title {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 6px;
            }

            .tunnl-toast-activity {
                font-size: 12px;
                color: #9ca3af;
                margin-bottom: 8px;
                font-style: italic;
                word-break: break-word;
            }

            .tunnl-toast-body {
                font-size: 13px;
                line-height: 1.4;
                margin-bottom: 10px;
                word-break: break-word;
            }

            .tunnl-toast-actions {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }

            .tunnl-toast-actions button {
                font-size: 12px;
                padding: 6px 10px;
                border-radius: 6px;
                border: 1px solid #4b5563;
                background: #1f2937;
                color: #e5e7eb;
                cursor: pointer;
                transition: background-color 0.2s ease;
            }

            .tunnl-toast-actions button:hover {
                background: #374151;
            }

            /* Responsive adjustments */
            @media (max-width: 480px) {
                #${this.toastId} {
                    left: 10px;
                    right: 10px;
                    max-width: none;
                }
            }
        `;

        injectStyles(styles, 'tunnl-toast-styles');
    }

    /**
     * Setup toast event listeners
     * @param {HTMLElement} toast - Toast element
     */
    setupEventListeners(toast) {
        // Dismiss button
        const dismissBtn = toast.querySelector('#tunnl-dismiss-toast');
        if (dismissBtn) {
            addEventListenerSafe(dismissBtn, 'click', () => {
                this.hide();
            });
        }
    }

    /**
     * Check if toast is currently visible
     * @returns {boolean} - True if toast is visible
     */
    isToastVisible() {
        return this.isVisible;
    }

    /**
     * Show temporary unblock message
     * @param {string} message - Message to show
     */
    showTemporaryUnblockMessage(message = '✅ Temporarily unblocked for 10 minutes') {
        const tempToastId = 'tunnl-temp-unblock-message';
        
        try {
            // Remove existing temp message
            removeElementSafe(tempToastId);

            const content = `
                <div class="tunnl-temp-message">
                    <span>${escapeHtml(message)}</span>
                    <button id="tunnl-close-temp-message">×</button>
                </div>
            `;

            const toast = createToast(content, tempToastId);
            if (!toast) {
                console.error('Failed to create temp message');
                return;
            }

            // Inject temp message styles
            const styles = `
                #${tempToastId} {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: ${UI_CONFIG.TOAST_Z_INDEX};
                    animation: tunnl-slideIn 0.3s ease-out;
                }

                @keyframes tunnl-slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }

                .tunnl-temp-message {
                    background: #d4edda;
                    color: #155724;
                    padding: 12px 20px;
                    border-radius: 8px;
                    border: 1px solid #c3e6cb;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }

                .tunnl-temp-message button {
                    background: none;
                    border: none;
                    color: #155724;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: background-color 0.2s ease;
                }

                .tunnl-temp-message button:hover {
                    background: rgba(21, 87, 36, 0.1);
                }
            `;

            injectStyles(styles, 'tunnl-temp-message-styles');

            // Setup close button
            const closeBtn = toast.querySelector('#tunnl-close-temp-message');
            if (closeBtn) {
                addEventListenerSafe(closeBtn, 'click', () => {
                    removeElementSafe(tempToastId);
                });
            }

            // Auto-remove after timeout
            setTimeout(() => {
                removeElementSafe(tempToastId);
            }, TIMING_CONFIG.TEMP_MESSAGE_DURATION);

        } catch (error) {
            console.error('Failed to show temp message:', error);
        }
    }
}

// Export singleton instance
export const toastNotification = new ToastNotification();
export default toastNotification;
