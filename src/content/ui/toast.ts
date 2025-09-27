// Toast notification component for content scripts

import { createToast, injectStyles, addEventListenerSafe, removeElementSafe } from '../utils/dom-utils';
import { escapeHtml } from '../../shared/utils';
import { TIMING_CONFIG, UI_CONFIG } from '../../shared/constants';

interface ToastOptions {
    message: string;
    activityUnderstanding: string;
    onContinue: () => void;
    onTemporaryUnblock: () => void;
    onOneTimeBypass: () => void;
    onAddToAllowlist: () => void;
}

class ToastNotification {
    private toastId: string = 'tunnl-block-toast';
    private isVisible: boolean = false;

    /**
     * Show block toast notification
     */
    show(options: ToastOptions): HTMLElement {
        console.log('🍞 Creating block toast:', options);
        
        // Remove any existing toast
        this.hide();
        
        // Create toast element
        const toast = this.createToastElement(options);
        
        // Inject styles
        this.injectToastStyles();
        
        // Add to page
        document.body.appendChild(toast);
        
        // Show toast with animation
        setTimeout(() => {
            toast.classList.add('tunnl-toast-visible');
        }, 10);
        
        this.isVisible = true;
        
        // Auto-hide after timeout
        setTimeout(() => {
            this.hide();
        }, TIMING_CONFIG.TOAST_AUTO_DISMISS);
        
        return toast;
    }

    /**
     * Hide toast notification
     */
    hide(): void {
        const toast = document.getElementById(this.toastId);
        if (toast) {
            toast.classList.remove('tunnl-toast-visible');
            setTimeout(() => {
                removeElementSafe(toast);
            }, 300);
            this.isVisible = false;
        }
    }

    /**
     * Create toast element
     */
    private createToastElement(options: ToastOptions): HTMLElement {
        const toast = document.createElement('div');
        toast.id = this.toastId;
        toast.className = 'tunnl-toast';
        
        toast.innerHTML = `
            <div class="tunnl-toast-content">
                <div class="tunnl-toast-header">
                    <div class="tunnl-toast-icon">🚫</div>
                    <div class="tunnl-toast-title">Site Blocked</div>
                    <button class="tunnl-toast-close" aria-label="Close">×</button>
                </div>
                
                <div class="tunnl-toast-body">
                    <div class="tunnl-toast-message">
                        ${escapeHtml(options.message)}
                    </div>
                    
                    <div class="tunnl-toast-details">
                        <div class="tunnl-toast-detail">
                            <strong>AI Understanding:</strong>
                            <span>${escapeHtml(options.activityUnderstanding)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="tunnl-toast-footer">
                    <button class="tunnl-toast-btn tunnl-toast-btn-primary" data-action="continue">
                        Continue
                    </button>
                    <button class="tunnl-toast-btn tunnl-toast-btn-secondary" data-action="temporary">
                        10 min
                    </button>
                    <button class="tunnl-toast-btn tunnl-toast-btn-secondary" data-action="bypass">
                        This time
                    </button>
                    <button class="tunnl-toast-btn tunnl-toast-btn-success" data-action="allowlist">
                        Always
                    </button>
                </div>
            </div>
        `;
        
        // Add event listeners
        this.addEventListeners(toast, options);
        
        return toast;
    }

    /**
     * Add event listeners to toast
     */
    private addEventListeners(toast: HTMLElement, options: ToastOptions): void {
        // Close button
        const closeBtn = toast.querySelector('.tunnl-toast-close') as HTMLElement;
        if (closeBtn) {
            addEventListenerSafe(closeBtn, 'click', () => {
                this.hide();
            });
        }
        
        // Action buttons
        const buttons = toast.querySelectorAll('[data-action]');
        buttons.forEach(button => {
            addEventListenerSafe(button as HTMLElement, 'click', () => {
                const action = button.getAttribute('data-action');
                this.handleAction(action, options);
            });
        });
        
        // Auto-hide on click outside
        const handleClickOutside = (e: MouseEvent) => {
            if (!toast.contains(e.target as Node)) {
                this.hide();
                document.removeEventListener('click', handleClickOutside);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 100);
    }

    /**
     * Handle action button clicks
     */
    private handleAction(action: string | null, options: ToastOptions): void {
        switch (action) {
            case 'continue':
                options.onContinue();
                break;
            case 'temporary':
                options.onTemporaryUnblock();
                break;
            case 'bypass':
                options.onOneTimeBypass();
                break;
            case 'allowlist':
                options.onAddToAllowlist();
                break;
        }
        this.hide();
    }

    /**
     * Inject toast styles
     */
    private injectToastStyles(): void {
        if (document.getElementById('tunnl-toast-styles')) {
            return; // Styles already injected
        }
        
        const styles = `
            .tunnl-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: ${UI_CONFIG.TOAST_Z_INDEX};
                max-width: 400px;
                opacity: 0;
                visibility: hidden;
                transform: translateX(100%);
                transition: opacity 0.3s ease, visibility 0.3s ease, transform 0.3s ease;
            }
            
            .tunnl-toast-visible {
                opacity: 1;
                visibility: visible;
                transform: translateX(0);
            }
            
            .tunnl-toast-content {
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                border: 1px solid #e5e7eb;
                overflow: hidden;
            }
            
            .tunnl-toast-header {
                display: flex;
                align-items: center;
                padding: 16px 20px 12px;
                background: #fef2f2;
                border-bottom: 1px solid #fecaca;
            }
            
            .tunnl-toast-icon {
                font-size: 20px;
                margin-right: 10px;
            }
            
            .tunnl-toast-title {
                font-size: 16px;
                font-weight: 600;
                color: #dc2626;
                flex: 1;
            }
            
            .tunnl-toast-close {
                background: none;
                border: none;
                font-size: 18px;
                color: #6b7280;
                cursor: pointer;
                padding: 2px;
                border-radius: 4px;
                transition: background-color 0.2s;
            }
            
            .tunnl-toast-close:hover {
                background-color: #f3f4f6;
            }
            
            .tunnl-toast-body {
                padding: 16px 20px;
            }
            
            .tunnl-toast-message {
                font-size: 14px;
                color: #374151;
                margin-bottom: 12px;
                line-height: 1.4;
            }
            
            .tunnl-toast-details {
                background: #f9fafb;
                border-radius: 6px;
                padding: 12px;
            }
            
            .tunnl-toast-detail {
                font-size: 13px;
            }
            
            .tunnl-toast-detail strong {
                color: #374151;
                display: block;
                margin-bottom: 4px;
            }
            
            .tunnl-toast-detail span {
                color: #6b7280;
            }
            
            .tunnl-toast-footer {
                display: flex;
                gap: 8px;
                padding: 12px 20px 16px;
                background: #f9fafb;
                border-top: 1px solid #e5e7eb;
            }
            
            .tunnl-toast-btn {
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                border: none;
                transition: all 0.2s;
                flex: 1;
            }
            
            .tunnl-toast-btn-primary {
                background: #ef4444;
                color: white;
            }
            
            .tunnl-toast-btn-primary:hover {
                background: #dc2626;
            }
            
            .tunnl-toast-btn-secondary {
                background: #6b7280;
                color: white;
            }
            
            .tunnl-toast-btn-secondary:hover {
                background: #4b5563;
            }
            
            .tunnl-toast-btn-success {
                background: #10b981;
                color: white;
            }
            
            .tunnl-toast-btn-success:hover {
                background: #059669;
            }
            
            @media (max-width: 640px) {
                .tunnl-toast {
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }
                
                .tunnl-toast-footer {
                    flex-direction: column;
                }
            }
        `;
        
        injectStyles(styles, 'tunnl-toast-styles');
    }
}

// Export function for creating toast
export function toastNotification(options: ToastOptions): HTMLElement {
    const toast = new ToastNotification();
    return toast.show(options);
}

export default ToastNotification;
