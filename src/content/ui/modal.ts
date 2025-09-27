// Block modal component for content scripts

import { createModal, injectStyles, addEventListenerSafe, removeElementSafe, getExtensionResourceUrl } from '../utils/dom-utils';
import { escapeHtml } from '../../shared/utils';
import { TIMING_CONFIG, UI_CONFIG } from '../../shared/constants';

interface ModalOptions {
    url: string;
    message: string;
    activityUnderstanding: string;
    currentTask: string;
    onContinue: () => void;
    onTemporaryUnblock: () => void;
    onOneTimeBypass: () => void;
    onAddToAllowlist: () => void;
}

class BlockModal {
    private modalId: string = 'tunnl-block-modal';
    private isVisible: boolean = false;

    /**
     * Show block modal
     */
    show(options: ModalOptions): HTMLElement {
        console.log('🚫 Showing block modal for:', options.url);
        
        // Remove any existing modal
        this.hide();
        
        // Create modal element
        const modal = this.createModalElement(options);
        
        // Inject styles
        this.injectModalStyles();
        
        // Add to page
        document.body.appendChild(modal);
        
        // Show modal with animation
        setTimeout(() => {
            modal.classList.add('tunnl-modal-visible');
        }, 10);
        
        this.isVisible = true;
        
        // Auto-hide after timeout
        setTimeout(() => {
            this.hide();
        }, TIMING_CONFIG.TOAST_AUTO_DISMISS);
        
        return modal;
    }

    /**
     * Hide block modal
     */
    hide(): void {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.classList.remove('tunnl-modal-visible');
            setTimeout(() => {
                removeElementSafe(modal);
            }, 300);
            this.isVisible = false;
        }
    }

    /**
     * Create modal element
     */
    private createModalElement(options: ModalOptions): HTMLElement {
        const modal = document.createElement('div');
        modal.id = this.modalId;
        modal.className = 'tunnl-modal';
        
        modal.innerHTML = `
            <div class="tunnl-modal-backdrop"></div>
            <div class="tunnl-modal-content">
                <div class="tunnl-modal-header">
                    <div class="tunnl-modal-icon">🚫</div>
                    <div class="tunnl-modal-title">Site Blocked</div>
                    <button class="tunnl-modal-close" aria-label="Close">×</button>
                </div>
                
                <div class="tunnl-modal-body">
                    <div class="tunnl-modal-message">
                        ${escapeHtml(options.message)}
                    </div>
                    
                    <div class="tunnl-modal-details">
                        <div class="tunnl-modal-detail">
                            <strong>Current Task:</strong>
                            <span>${escapeHtml(options.currentTask)}</span>
                        </div>
                        
                        <div class="tunnl-modal-detail">
                            <strong>AI Understanding:</strong>
                            <span>${escapeHtml(options.activityUnderstanding)}</span>
                        </div>
                        
                        <div class="tunnl-modal-detail">
                            <strong>Blocked URL:</strong>
                            <span class="tunnl-modal-url">${escapeHtml(options.url)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="tunnl-modal-footer">
                    <button class="tunnl-btn tunnl-btn-primary" data-action="continue">
                        Continue Anyway
                    </button>
                    <button class="tunnl-btn tunnl-btn-secondary" data-action="temporary">
                        Allow for 10 min
                    </button>
                    <button class="tunnl-btn tunnl-btn-secondary" data-action="bypass">
                        Allow This Time
                    </button>
                    <button class="tunnl-btn tunnl-btn-success" data-action="allowlist">
                        Always Allow
                    </button>
                </div>
            </div>
        `;
        
        // Add event listeners
        this.addEventListeners(modal, options);
        
        return modal;
    }

    /**
     * Add event listeners to modal
     */
    private addEventListeners(modal: HTMLElement, options: ModalOptions): void {
        // Close button
        const closeBtn = modal.querySelector('.tunnl-modal-close') as HTMLElement;
        if (closeBtn) {
            addEventListenerSafe(closeBtn, 'click', () => {
                this.hide();
            });
        }
        
        // Backdrop click
        const backdrop = modal.querySelector('.tunnl-modal-backdrop') as HTMLElement;
        if (backdrop) {
            addEventListenerSafe(backdrop, 'click', () => {
                this.hide();
            });
        }
        
        // Action buttons
        const buttons = modal.querySelectorAll('[data-action]');
        buttons.forEach(button => {
            addEventListenerSafe(button as HTMLElement, 'click', () => {
                const action = button.getAttribute('data-action');
                this.handleAction(action, options);
            });
        });
        
        // Escape key
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.hide();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Handle action button clicks
     */
    private handleAction(action: string | null, options: ModalOptions): void {
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
     * Inject modal styles
     */
    private injectModalStyles(): void {
        if (document.getElementById('tunnl-modal-styles')) {
            return; // Styles already injected
        }
        
        const styles = `
            .tunnl-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: ${UI_CONFIG.MODAL_Z_INDEX};
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s ease, visibility 0.3s ease;
            }
            
            .tunnl-modal-visible {
                opacity: 1;
                visibility: visible;
            }
            
            .tunnl-modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
            }
            
            .tunnl-modal-content {
                position: relative;
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow: hidden;
                transform: scale(0.9);
                transition: transform 0.3s ease;
            }
            
            .tunnl-modal-visible .tunnl-modal-content {
                transform: scale(1);
            }
            
            .tunnl-modal-header {
                display: flex;
                align-items: center;
                padding: 20px 24px 16px;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .tunnl-modal-icon {
                font-size: 24px;
                margin-right: 12px;
            }
            
            .tunnl-modal-title {
                font-size: 18px;
                font-weight: 600;
                color: #111827;
                flex: 1;
            }
            
            .tunnl-modal-close {
                background: none;
                border: none;
                font-size: 24px;
                color: #6b7280;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: background-color 0.2s;
            }
            
            .tunnl-modal-close:hover {
                background-color: #f3f4f6;
            }
            
            .tunnl-modal-body {
                padding: 20px 24px;
            }
            
            .tunnl-modal-message {
                font-size: 16px;
                color: #374151;
                margin-bottom: 20px;
                line-height: 1.5;
            }
            
            .tunnl-modal-details {
                background: #f9fafb;
                border-radius: 8px;
                padding: 16px;
            }
            
            .tunnl-modal-detail {
                margin-bottom: 12px;
                font-size: 14px;
            }
            
            .tunnl-modal-detail:last-child {
                margin-bottom: 0;
            }
            
            .tunnl-modal-detail strong {
                color: #374151;
                display: block;
                margin-bottom: 4px;
            }
            
            .tunnl-modal-detail span {
                color: #6b7280;
            }
            
            .tunnl-modal-url {
                word-break: break-all;
                font-family: monospace;
                background: #e5e7eb;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 12px;
            }
            
            .tunnl-modal-footer {
                display: flex;
                gap: 12px;
                padding: 16px 24px 20px;
                border-top: 1px solid #e5e7eb;
                flex-wrap: wrap;
            }
            
            .tunnl-btn {
                padding: 10px 16px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                border: none;
                transition: all 0.2s;
                flex: 1;
                min-width: 120px;
            }
            
            .tunnl-btn-primary {
                background: #ef4444;
                color: white;
            }
            
            .tunnl-btn-primary:hover {
                background: #dc2626;
            }
            
            .tunnl-btn-secondary {
                background: #6b7280;
                color: white;
            }
            
            .tunnl-btn-secondary:hover {
                background: #4b5563;
            }
            
            .tunnl-btn-success {
                background: #10b981;
                color: white;
            }
            
            .tunnl-btn-success:hover {
                background: #059669;
            }
            
            @media (max-width: 640px) {
                .tunnl-modal-content {
                    width: 95%;
                    margin: 20px;
                }
                
                .tunnl-modal-footer {
                    flex-direction: column;
                }
                
                .tunnl-btn {
                    min-width: auto;
                }
            }
        `;
        
        injectStyles(styles, 'tunnl-modal-styles');
    }
}

// Export function for creating modal
export function blockModal(options: ModalOptions): HTMLElement {
    const modal = new BlockModal();
    return modal.show(options);
}

export default BlockModal;
