// Content script for tunnl.ai Chrome Extension

class TunnlContent {
    constructor() {
        this.init();
    }

    async init() {
        // Check if this is a blocked page
        if (window.location.href.includes('blocked.html')) {
            return; // Don't interfere with blocked page
        }

        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });

        // Check if we should block this page
        await this.checkIfShouldBlock();
    }

    async handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'BLOCK_PAGE':
                this.blockPage(message.reason);
                sendResponse({ success: true });
                break;
            
            case 'UNBLOCK_PAGE':
                this.unblockPage();
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ success: false, error: 'Unknown message type' });
        }
    }

    async checkIfShouldBlock() {
        try {
            // Get current URL
            const currentUrl = window.location.href;
            
            // Skip if it's a blocked page or extension page
            if (currentUrl.includes('blocked.html') || 
                currentUrl.startsWith('chrome://') || 
                currentUrl.startsWith('chrome-extension://')) {
                return;
            }

            // Ask background script to analyze this URL
            const response = await chrome.runtime.sendMessage({
                type: 'ANALYZE_URL',
                url: currentUrl
            });

            if (response.success && response.result.shouldBlock) {
                this.blockPage(response.result.reason);
            }

        } catch (error) {
            console.error('Error checking if should block:', error);
        }
    }

    blockPage(reason) {
        // Create blocking overlay
        const overlay = document.createElement('div');
        overlay.id = 'tunnl-block-overlay';
        overlay.innerHTML = `
            <div class="tunnl-block-content">
                <div class="tunnl-block-icon">🚫</div>
                <h1>Website Blocked by tunnl.ai</h1>
                <p class="taskfocus-block-reason">${reason}</p>
                <p class="taskfocus-block-message">
                    This website has been blocked because it's not related to your current tasks.
                </p>
                <div class="tunnl-block-actions">
                    <button id="tunnl-unblock-btn" class="tunnl-btn tunnl-btn-primary">
                        Unblock for 10 minutes
                    </button>
                    <button id="tunnl-go-back-btn" class="tunnl-btn tunnl-btn-secondary">
                        Go Back
                    </button>
                </div>
                <div class="tunnl-block-footer">
                    <a href="#" id="tunnl-settings-link">Open tunnl.ai Settings</a>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #tunnl-block-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .tunnl-block-content {
                background: white;
                padding: 40px;
                border-radius: 20px;
                text-align: center;
                max-width: 500px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                animation: tunnl-fadeIn 0.5s ease-out;
            }

            @keyframes tunnl-fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .tunnl-block-icon {
                font-size: 64px;
                margin-bottom: 20px;
            }

            .tunnl-block-content h1 {
                color: #333;
                margin-bottom: 15px;
                font-size: 28px;
                font-weight: 600;
            }

            .tunnl-block-reason {
                color: #e53e3e;
                font-size: 16px;
                font-weight: 500;
                margin-bottom: 20px;
                padding: 10px;
                background: #fff5f5;
                border-radius: 8px;
                border-left: 4px solid #e53e3e;
            }

            .tunnl-block-message {
                color: #666;
                font-size: 16px;
                margin-bottom: 30px;
                line-height: 1.5;
            }

            .tunnl-block-actions {
                display: flex;
                gap: 15px;
                justify-content: center;
                margin-bottom: 30px;
            }

            .tunnl-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-decoration: none;
                display: inline-block;
            }

            .tunnl-btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            .tunnl-btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }

            .tunnl-btn-secondary {
                background: #f8f9fa;
                color: #6c757d;
                border: 1px solid #dee2e6;
            }

            .tunnl-btn-secondary:hover {
                background: #e9ecef;
            }

            .tunnl-block-footer {
                border-top: 1px solid #eee;
                padding-top: 20px;
            }

            .tunnl-block-footer a {
                color: #667eea;
                text-decoration: none;
                font-size: 14px;
            }

            .tunnl-block-footer a:hover {
                text-decoration: underline;
            }
        `;

        // Add to page
        document.head.appendChild(style);
        document.body.appendChild(overlay);

        // Add event listeners
        document.getElementById('tunnl-unblock-btn').addEventListener('click', () => {
            this.unblockTemporarily();
        });

        document.getElementById('tunnl-go-back-btn').addEventListener('click', () => {
            window.history.back();
        });

        document.getElementById('tunnl-settings-link').addEventListener('click', (e) => {
            e.preventDefault();
            chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
        });

        // Prevent interaction with the page
        this.disablePageInteraction();
    }

    unblockPage() {
        const overlay = document.getElementById('tunnl-block-overlay');
        if (overlay) {
            overlay.remove();
        }
        this.enablePageInteraction();
    }

    async unblockTemporarily() {
        // Remove overlay
        this.unblockPage();

        // Set temporary unblock for 10 minutes
        const unblockUntil = Date.now() + (10 * 60 * 1000);
        await chrome.storage.local.set({
            temporaryUnblock: {
                url: window.location.href,
                until: unblockUntil
            }
        });

        // Show temporary unblock message
        this.showTemporaryUnblockMessage();
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

            .taskfocus-temp-message button {
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

            .taskfocus-temp-message button:hover {
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

    disablePageInteraction() {
        // Disable scrolling
        document.body.style.overflow = 'hidden';
        
        // Disable all links and buttons
        const interactiveElements = document.querySelectorAll('a, button, input, select, textarea');
        interactiveElements.forEach(element => {
            element.style.pointerEvents = 'none';
        });
    }

    enablePageInteraction() {
        // Re-enable scrolling
        document.body.style.overflow = '';
        
        // Re-enable all links and buttons
        const interactiveElements = document.querySelectorAll('a, button, input, select, textarea');
        interactiveElements.forEach(element => {
            element.style.pointerEvents = '';
        });
    }
}

// Initialize content script
new TunnlContent();
