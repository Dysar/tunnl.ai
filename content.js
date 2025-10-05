// Content script for tunnl.ai Chrome Extension
// Simplified - only handles temporary unblock notifications

// Prevent multiple script injections
if (window.tunnlContentScriptLoaded) {
    console.log('⚠️ Content script already loaded, preventing duplicate');
    // Exit early to prevent duplicate class declaration
    throw new Error('Content script already loaded');
}
window.tunnlContentScriptLoaded = true;

class TunnlContent {
    constructor() {
        this.init();
    }

    async init() {
        // Check if this is a blocked page
        if (window.location.href.includes('blocked.html')) {
            return; // Don't interfere with blocked page
        }

        // Prevent multiple initializations
        if (window.tunnlContentInitialized) {
            console.log('⚠️ Content script already initialized, skipping');
            return;
        }
        window.tunnlContentInitialized = true;

        console.log('🚀 Tunnl content script initializing...');

        // Check for temporary unblock status
        await this.checkTemporaryUnblock();

        // Listen for background prompts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('📨 Content script received message:', message?.type);
            
            if (message && message.type === 'SHOW_BLOCK_TOAST') {
                console.log('📨 Content script received toast message:', {
                    url: message.url,
                    message: message.message,
                    activityUnderstanding: message.activityUnderstanding
                });
                this.showBlockToast(message.url, message.message, message.activityUnderstanding);
                sendResponse({ success: true });
            } else if (message && message.type === 'SHOW_BLOCK_MODAL') {
                console.log('📨 Content script received modal message:', {
                    url: message.url,
                    message: message.message,
                    activityUnderstanding: message.activityUnderstanding,
                    currentTask: message.currentTask
                });
                console.log('🔍 About to call showBlockModal...');
                this.showBlockModal(message.url, message.message, message.activityUnderstanding, message.currentTask);
                sendResponse({ success: true });
            } else if (message && message.type === 'EXTRACT_CONTENT') {
                // Return rendered DOM content for analysis
                try {
                    const content = this.extractPageContent();
                    sendResponse({ success: true, content: content || '' });
                } catch (e) {
                    console.error('❌ DOM extraction failed:', e);
                    sendResponse({ success: false, error: e?.message || 'DOM extraction failed' });
                }
            }
            // Content extraction is now handled in background script via fetch
            
            return true; // Keep message channel open for async response
        });

        console.log('✅ Tunnl content script initialized successfully');
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
        console.log('🍞 Creating block toast:', {
            blockedUrl,
            reasonMessage,
            activityUnderstanding
        });

        try {
            // Avoid duplicate toasts
            if (document.getElementById('tunnl-block-toast')) {
                console.log('⚠️ Toast already exists, skipping creation');
                return;
            }

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

            console.log('✅ Toast created and added to page');

            const dismiss = () => {
                console.log('🗑️ Dismissing toast');
                wrapper.remove();
            };
            
            document.getElementById('tunnl-dismiss-toast').addEventListener('click', dismiss);

            // Auto-dismiss after 2 minutes
            setTimeout(() => { 
                try { 
                    console.log('⏰ Auto-dismissing toast after 2 minutes');
                    dismiss(); 
                } catch {} 
            }, 120000);
            
            console.log('⏰ Toast will auto-dismiss in 2 minutes');
        } catch (error) {
            console.log('❌ Failed to create toast (likely CSP blocking):', error.message);
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

    extractPageContent() {
        try {
            // Remove script and style elements
            const scripts = document.querySelectorAll('script, style, noscript, nav, header, footer, aside');
            scripts.forEach(el => el.remove());
            
            // Get main content areas
            const contentSelectors = [
                'main',
                'article',
                '[role="main"]',
                '.content',
                '.main-content',
                '.post-content',
                '.entry-content',
                '.article-content',
                '.page-content',
                'body'
            ];
            
            let mainContent = '';
            for (const selector of contentSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    mainContent = element.innerText || element.textContent || '';
                    if (mainContent.length > 100) break; // Use first substantial content
                }
            }
            
            // Fallback to body if no main content found
            if (!mainContent || mainContent.length < 50) {
                mainContent = document.body.innerText || document.body.textContent || '';
            }
            
            // Clean up the text
            const cleanedContent = mainContent
                .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
                .replace(/\n\s*\n/g, '\n') // Remove empty lines
                .trim();
            
            // Get page title and meta description for additional context
            const title = document.title || '';
            const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
            
            // Combine title, description, and content
            let fullContent = '';
            if (title) fullContent += `Title: ${title}\n\n`;
            if (metaDescription) fullContent += `Description: ${metaDescription}\n\n`;
            if (cleanedContent) fullContent += `Content: ${cleanedContent}`;
            
            // Limit content length (2000 characters max)
            const maxLength = 2000;
            if (fullContent.length > maxLength) {
                fullContent = fullContent.substring(0, maxLength) + '...';
            }
            
            console.log('📄 Content extracted:', {
                title: title,
                description: metaDescription,
                contentLength: cleanedContent.length,
                fullLength: fullContent.length
            });
            
            return fullContent;
            
        } catch (error) {
            console.error('❌ Content extraction failed:', error);
            return null;
        }
    }

    showBlockModal(blockedUrl, reasonMessage, activityUnderstanding, currentTask) {
        console.log('🚫 Creating block modal:', {
            blockedUrl,
            reasonMessage,
            activityUnderstanding,
            currentTask
        });
        console.log('🔍 Document ready state:', document.readyState);
        console.log('🔍 Document body exists:', !!document.body);

        try {
            // Remove any existing modals and styles first
            const existingModal = document.getElementById('tunnl-block-modal');
            if (existingModal) {
                console.log('⚠️ Removing existing modal');
                existingModal.remove();
            }
            
            // Remove any existing tunnl styles to prevent caching issues
            const existingStyles = document.querySelectorAll('style[data-tunnl]');
            existingStyles.forEach(style => style.remove());
            console.log(`🧹 Removed ${existingStyles.length} existing tunnl styles`);

            // Create modal overlay
            const modal = document.createElement('div');
            modal.id = 'tunnl-block-modal';
            modal.innerHTML = `
                <div class="tunnl-modal-overlay">
                    <div class="tunnl-modal-content">
                        <div class="tunnl-image-container">
                            <img src="${chrome.runtime.getURL('assets/access_denied.png')}" alt="Access Denied Banner" class="tunnl-access-denied-banner">
                        </div>
                        
                        <div class="tunnl-explanation-box">
                            <p class="tunnl-explanation-text">${this.escapeHtml(reasonMessage || 'This site may distract you from your current task.')}</p>
                        </div>
                        
                        <div class="tunnl-action-buttons">
                            <button class="tunnl-btn tunnl-btn-secondary" id="tunnl-go-back">You got me</button>
                            <button class="tunnl-btn tunnl-btn-primary" id="tunnl-continue">You're wrong, let me in</button>
                        </div>
                        
                        <p class="tunnl-bypass-link">
                            <a id="tunnl-continue-link" href="#">'I don't care if its a distraction, allow now</a>
                        </p>
                    </div>
                </div>
            `;

            const style = document.createElement('style');
            style.setAttribute('data-tunnl', 'main-styles');
            style.setAttribute('data-timestamp', Date.now());
            style.textContent = `
                /* Cache buster: ${Date.now()} */
                #tunnl-block-modal {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    z-index: 2147483647 !important;
                    font-family: 'Excalifont', 'Times New Roman', 'Georgia', 'Times', serif !important;
                    display: block !important;
                }

                .tunnl-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.6) 100%);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    box-sizing: border-box;
                    animation: overlayFadeIn 0.4s ease-out;
                }

                @keyframes overlayFadeIn {
                    from { opacity: 0; backdrop-filter: blur(0px); }
                    to { opacity: 1; backdrop-filter: blur(8px); }
                }

                .tunnl-modal-content {
                    background: linear-gradient(145deg, #67513a 0%, #5a4530 50%, #67513a 100%);
                    border: 6px solid #8b7355;
                    border-radius: 24px;
                    padding: 32px;
                    max-width: 580px;
                    width: 100%;
                    text-align: center;
                    box-shadow: 
                        0 25px 50px rgba(0, 0, 0, 0.7),
                        0 0 0 1px rgba(255, 255, 255, 0.1),
                        inset 0 2px 4px rgba(255, 255, 255, 0.15),
                        inset 0 -2px 4px rgba(0, 0, 0, 0.2);
                    animation: modalSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                    position: relative;
                    margin-top: 120px;
                    overflow: visible;
                }

                .tunnl-modal-content::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                }

                @keyframes modalSlideIn {
                    from {
                        opacity: 0;
                        transform: scale(0.8) translateY(-30px) rotateX(10deg);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0) rotateX(0deg);
                    }
                }

                .tunnl-image-container {
                    position: absolute;
                    top: -180px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 10;
                    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4));
                }

                .tunnl-access-denied-banner {
                    width: 300px;
                    height: auto;
                    display: block;
                    border-radius: 12px;
                    transition: transform 0.3s ease;
                }

                .tunnl-access-denied-banner:hover {
                    transform: scale(1.02);
                }

                .tunnl-explanation-box {
                    background: linear-gradient(145deg, #79804d 0%, #6a7342 50%, #79804d 100%);
                    border: 4px solid #8b9a5a;
                    border-radius: 20px;
                    padding: 24px 28px;
                    margin: 20px 0;
                    box-shadow: 
                        inset 0 3px 6px rgba(0, 0, 0, 0.25),
                        0 4px 8px rgba(0, 0, 0, 0.2);
                    position: relative;
                    overflow: hidden;
                }

                .tunnl-explanation-box::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                }

                .tunnl-explanation-text {
                    color: #f8f1ee;
                    font-size: 19px;
                    line-height: 1.6;
                    margin: 0;
                    font-weight: 400;
                    text-align: left;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                    letter-spacing: 0.3px;
                }

                .tunnl-action-buttons {
                    display: flex;
                    gap: 24px;
                    justify-content: center;
                    margin: 28px 0 20px 0;
                    flex-wrap: wrap;
                }

                .tunnl-btn {
                    padding: 20px 32px;
                    border-radius: 16px;
                    font-size: 17px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 3px solid;
                    font-family: inherit;
                    min-width: 180px;
                    min-height: 60px;
                    text-transform: none;
                    letter-spacing: 0.8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1.2;
                    position: relative;
                    overflow: hidden;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
                }

                .tunnl-btn::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                    transition: left 0.5s ease;
                }

                .tunnl-btn:hover::before {
                    left: 100%;
                }

                .tunnl-btn:hover {
                    transform: translateY(-3px) scale(1.02);
                    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
                }

                .tunnl-btn:active {
                    transform: translateY(-1px) scale(0.98);
                    transition: all 0.1s ease;
                }

                .tunnl-btn-secondary {
                    background: linear-gradient(145deg, #eaddd7 0%, #d4c4b8 50%, #eaddd7 100%) !important;
                    border-color: #8b7355 !important;
                    color: #2C1810 !important;
                    box-shadow: 
                        0 4px 12px rgba(0, 0, 0, 0.2),
                        inset 0 1px 2px rgba(255, 255, 255, 0.3);
                }

                .tunnl-btn-secondary:hover {
                    background: linear-gradient(145deg, #d2bab0 0%, #c4a89c 50%, #d2bab0 100%) !important;
                    border-color: #8b7355 !important;
                    color: #2C1810 !important;
                }

                .tunnl-btn-primary {
                    background: linear-gradient(145deg, #eaddd7 0%, #d4c4b8 50%, #eaddd7 100%) !important;
                    border-color: #8b7355 !important;
                    color: #2C1810 !important;
                    box-shadow: 
                        0 4px 12px rgba(0, 0, 0, 0.2),
                        inset 0 1px 2px rgba(255, 255, 255, 0.3);
                }

                .tunnl-btn-primary:hover {
                    background: linear-gradient(145deg, #d2bab0 0%, #c4a89c 50%, #d2bab0 100%) !important;
                    border-color: #8b7355 !important;
                    color: #2C1810 !important;
                }

                .tunnl-bypass-link {
                    margin: 20px 0 0 0;
                }

                .tunnl-bypass-link a {
                    color: #f8f1ee;
                    text-decoration: none;
                    font-size: 16px;
                    font-weight: 400;
                    letter-spacing: 0.5px;
                    transition: all 0.3s ease;
                    position: relative;
                    padding: 8px 16px;
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .tunnl-bypass-link a::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 50%;
                    width: 0;
                    height: 2px;
                    background: #eaddd7;
                    transition: all 0.3s ease;
                    transform: translateX(-50%);
                }

                .tunnl-bypass-link a:hover {
                    color: #eaddd7;
                    background: rgba(255, 255, 255, 0.1);
                    transform: translateY(-1px);
                }

                .tunnl-bypass-link a:hover::after {
                    width: 80%;
                }

                /* Responsive adjustments */
                @media (max-width: 420px) {
                    .tunnl-modal-content {
                        padding: 24px;
                        margin-top: 140px;
                        max-width: 90vw;
                    }
                    .tunnl-image-container {
                        top: -160px;
                    }
                    .tunnl-access-denied-banner {
                        width: 220px;
                    }
                    .tunnl-action-buttons {
                        flex-direction: column;
                        align-items: center;
                        gap: 16px;
                    }
                    .tunnl-btn {
                        width: 100%;
                        max-width: 240px;
                        min-width: auto;
                    }
                    .tunnl-explanation-text {
                        font-size: 17px;
                    }
                }
            `;

            // Add Excalifont with proper loading
            const fontStyle = document.createElement('style');
            fontStyle.setAttribute('data-tunnl', 'font-styles');
            fontStyle.setAttribute('data-timestamp', Date.now());
            fontStyle.textContent = `
                /* Font cache buster: ${Date.now()} */
                @font-face {
                    font-family: 'Excalifont';
                    src: url('${chrome.runtime.getURL('Excalifont Regular.woff2')}') format('woff2');
                    font-weight: normal;
                    font-style: normal;
                    font-display: swap;
                }
                
                #tunnl-block-modal,
                #tunnl-block-modal *,
                #tunnl-block-modal .tunnl-explanation-text,
                #tunnl-block-modal .tunnl-btn,
                #tunnl-block-modal .tunnl-bypass-link a {
                    font-family: 'Excalifont', 'Times New Roman', 'Georgia', 'Times', serif !important;
                }
            `;
            document.head.appendChild(fontStyle);
            document.head.appendChild(style);
            
            // Create modal and set up event listeners immediately
            document.body.appendChild(modal);
            this.setupModalEventListeners(modal, blockedUrl);
            
            console.log('✅ Modal created with Excalifont font loading');

        } catch (error) {
            console.log('❌ Failed to create modal (likely CSP blocking):', error.message);
        }
    }


    setupModalEventListeners(modal, blockedUrl) {
        // Go back button
        const goBackBtn = modal.querySelector('#tunnl-go-back');
        if (goBackBtn) {
            goBackBtn.addEventListener('click', () => {
                if (history.length > 1) {
                    history.back();
                } else {
                    window.location.href = 'chrome://new-tab-page/';
                }
                modal.remove();
            });
        }

        // Continue to site button (temporary unblock)
        const continueBtn = modal.querySelector('#tunnl-continue');
        if (continueBtn) {
            continueBtn.addEventListener('click', async () => {
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
            continueLink.addEventListener('click', async (e) => {
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
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Close on overlay click
        const overlay = modal.querySelector('.tunnl-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    modal.remove();
                }
            });
        }
    }

    async updateModalStats() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
            if (response && response.success) {
                const stats = response.stats;
                const blockedEl = document.getElementById('tunnl-urls-blocked');
                const scoreEl = document.getElementById('tunnl-focus-score');
                const timeEl = document.getElementById('tunnl-time-saved');
                
                if (blockedEl) blockedEl.textContent = stats.blockedCount || 0;
                if (scoreEl) scoreEl.textContent = `${stats.focusScore || 0}%`;
                if (timeEl) timeEl.textContent = `${stats.timeSaved || 0}m`;
            }
        } catch (error) {
            console.error('Error updating modal stats:', error);
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

// Initialize content script only if not already initialized
if (!window.tunnlContentInstance) {
    window.tunnlContentInstance = new TunnlContent();
    console.log('✅ TunnlContent instance created');
} else {
    console.log('⚠️ TunnlContent instance already exists, skipping');
}

// Test function to manually trigger modal (for debugging)
window.testTunnlModal = function() {
    console.log('🧪 Testing Tunnl modal...');
    const content = new TunnlContent();
    content.showBlockModal(
        'https://example.com',
        'This is a test reason for blocking',
        'Testing the modal functionality',
        'Test task: Debug modal display'
    );
    console.log('🧪 Modal test triggered - check if modal appears');
};

// Test function to check image URL
window.testTunnlImage = function() {
    console.log('🧪 Testing beaver image URL...');
    const imageUrl = chrome.runtime.getURL('assets/beaver.png');
    console.log('🔍 Image URL:', imageUrl);
    
    // Create a test image element
    const testImg = document.createElement('img');
    testImg.src = imageUrl;
    testImg.style.position = 'fixed';
    testImg.style.top = '10px';
    testImg.style.right = '10px';
    testImg.style.width = '100px';
    testImg.style.height = '100px';
    testImg.style.border = '3px solid red';
    testImg.style.zIndex = '999999';
    testImg.alt = 'Test Beaver Image';
    
    testImg.onload = function() {
        console.log('✅ Test image loaded successfully!');
        document.body.appendChild(testImg);
        setTimeout(() => {
            testImg.remove();
            console.log('🧹 Test image removed');
        }, 5000);
    };
    
    testImg.onerror = function() {
        console.log('❌ Test image failed to load!');
        console.log('🔍 Failed URL:', imageUrl);
    };
};

console.log('🧪 Test functions available:');
console.log('  - window.testTunnlModal() - Test the modal');
console.log('  - window.testTunnlImage() - Test the beaver image');