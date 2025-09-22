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