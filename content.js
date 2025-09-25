// Content script for tunnl.ai Chrome Extension
// Simplified - only handles temporary unblock notifications

class TunnlContent {
    constructor() {
        this.init();
    }

    async init() {
        // Check if this is a blocked page
        if (window.location.href.includes('blocked.html')) {
            return; // Don't interfere with blocked page
        }

        // Check for temporary unblock status
        await this.checkTemporaryUnblock();

        // Listen for background prompts
        chrome.runtime.onMessage.addListener((message) => {
            if (message && message.type === 'SHOW_BLOCK_TOAST') {
                this.showBlockToast(message.url, message.message, message.activityUnderstanding);
            }
        });
    }

    async checkTemporaryUnblock() {
        try {
            const result = await chrome.storage.local.get(['temporaryUnblock']);
            const tempUnblock = result.temporaryUnblock;
            
            if (tempUnblock && tempUnblock.url === window.location.href) {
                if (Date.now() < tempUnblock.until) {
                    // Still within unblock period, show notification
                    this.showTemporaryUnblockMessage();
                } else {
                    // Unblock period expired, remove from storage
                    await chrome.storage.local.remove(['temporaryUnblock']);
                }
            }
        } catch (error) {
            console.error('Error checking temporary unblock:', error);
        }
    }

    showBlockToast(blockedUrl, reasonMessage, activityUnderstanding) {
        try {
            // Avoid duplicate toasts
            if (document.getElementById('tunnl-block-toast')) return;

            const wrapper = document.createElement('div');
            wrapper.id = 'tunnl-block-toast';
            wrapper.innerHTML = `
                <div class="tunnl-toast">
                    <div class="tunnl-toast-title">tunnl.ai blocked a distraction</div>
                    <div class="tunnl-toast-activity">${this.escapeHtml(activityUnderstanding || 'Unable to understand your activities')}</div>
                    <div class="tunnl-toast-body">${this.escapeHtml(reasonMessage || 'Not related to your current tasks')}</div>
                    <div class="tunnl-toast-actions">
                        <button id="tunnl-dismiss-toast">Dismiss</button>
                    </div>
                </div>
            `;

            const style = document.createElement('style');
            style.textContent = `
                #tunnl-block-toast { position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; max-width: 360px; animation: tunnl-fade-in .2s ease-out; }
                @keyframes tunnl-fade-in { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
                .tunnl-toast { background: #111827; color: #e5e7eb; border: 1px solid #374151; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); padding: 14px 14px 12px; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
                .tunnl-toast-title { font-weight: 600; font-size: 14px; margin-bottom: 6px; }
                .tunnl-toast-activity { font-size: 12px; color: #9ca3af; margin-bottom: 8px; font-style: italic; word-break: break-word; }
                .tunnl-toast-body { font-size: 13px; line-height: 1.4; margin-bottom: 10px; word-break: break-word; }
                .tunnl-toast-actions { display: flex; gap: 8px; justify-content: flex-end; }
                .tunnl-toast-actions button { font-size: 12px; padding: 6px 10px; border-radius: 6px; border: 1px solid #4b5563; background: #1f2937; color: #e5e7eb; cursor: pointer; }
                .tunnl-toast-actions button:hover { background: #374151; }
            `;

            document.head.appendChild(style);
            document.body.appendChild(wrapper);

            const dismiss = () => wrapper.remove();
            document.getElementById('tunnl-dismiss-toast').addEventListener('click', dismiss);


            // Auto-dismiss after 2 minutes
            setTimeout(() => { try { dismiss(); } catch {} }, 120000);
        } catch (error) {
            // If CSP prevents injection, quietly give up
        }
    }

    escapeHtml(text) {
        try {
            return String(text).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
        } catch {
            return text;
        }
    }

    showTemporaryUnblockMessage() {
        const message = document.createElement('div');
        message.id = 'tunnl-temp-unblock-message';
        message.innerHTML = `
            <div class="tunnl-temp-message">
                <span>✅ Temporarily unblocked for 10 minutes</span>
                <button id="tunnl-close-temp-message">×</button>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #tunnl-temp-unblock-message {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 999999;
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
            }

            .tunnl-temp-message button:hover {
                background: rgba(21, 87, 36, 0.1);
                border-radius: 50%;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(message);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            message.remove();
        }, 5000);

        // Close button
        document.getElementById('tunnl-close-temp-message').addEventListener('click', () => {
            message.remove();
        });
    }
}

// Initialize content script
new TunnlContent();