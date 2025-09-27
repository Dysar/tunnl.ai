// DOM manipulation utilities for content scripts

import { escapeHtml } from '../../shared/utils.js';

/**
 * Safely create and inject styles into the page
 * @param {string} css - CSS content to inject
 * @param {string} id - Unique ID for the style element
 * @returns {HTMLStyleElement|null} - Created style element or null if failed
 */
export function injectStyles(css, id = 'tunnl-styles') {
    try {
        // Remove existing styles with the same ID
        const existing = document.getElementById(id);
        if (existing) {
            existing.remove();
        }

        const style = document.createElement('style');
        style.id = id;
        style.setAttribute('data-tunnl', 'true');
        style.setAttribute('data-timestamp', Date.now().toString());
        style.textContent = css;

        document.head.appendChild(style);
        console.log(`✅ Styles injected with ID: ${id}`);
        return style;
    } catch (error) {
        console.error('Failed to inject styles:', error);
        return null;
    }
}

/**
 * Create a modal overlay element
 * @param {string} content - HTML content for the modal
 * @param {string} id - Unique ID for the modal
 * @returns {HTMLElement|null} - Created modal element or null if failed
 */
export function createModal(content, id = 'tunnl-modal') {
    try {
        // Remove existing modal with the same ID
        const existing = document.getElementById(id);
        if (existing) {
            existing.remove();
        }

        const modal = document.createElement('div');
        modal.id = id;
        modal.setAttribute('data-tunnl', 'true');
        modal.innerHTML = content;

        document.body.appendChild(modal);
        console.log(`✅ Modal created with ID: ${id}`);
        return modal;
    } catch (error) {
        console.error('Failed to create modal:', error);
        return null;
    }
}

/**
 * Create a toast notification element
 * @param {string} content - HTML content for the toast
 * @param {string} id - Unique ID for the toast
 * @returns {HTMLElement|null} - Created toast element or null if failed
 */
export function createToast(content, id = 'tunnl-toast') {
    try {
        // Remove existing toast with the same ID
        const existing = document.getElementById(id);
        if (existing) {
            existing.remove();
        }

        const toast = document.createElement('div');
        toast.id = id;
        toast.setAttribute('data-tunnl', 'true');
        toast.innerHTML = content;

        document.body.appendChild(toast);
        console.log(`✅ Toast created with ID: ${id}`);
        return toast;
    } catch (error) {
        console.error('Failed to create toast:', error);
        return null;
    }
}

/**
 * Add event listener with error handling
 * @param {HTMLElement} element - Element to add listener to
 * @param {string} event - Event type
 * @param {Function} handler - Event handler function
 * @param {Object} options - Event listener options
 */
export function addEventListenerSafe(element, event, handler, options = {}) {
    try {
        if (element && typeof element.addEventListener === 'function') {
            element.addEventListener(event, handler, options);
            console.log(`✅ Event listener added for ${event} on element:`, element.id || element.tagName);
        } else {
            console.warn('Invalid element for event listener:', element);
        }
    } catch (error) {
        console.error('Failed to add event listener:', error);
    }
}

/**
 * Remove element safely
 * @param {HTMLElement|string} element - Element or element ID to remove
 */
export function removeElementSafe(element) {
    try {
        let el = element;
        if (typeof element === 'string') {
            el = document.getElementById(element);
        }
        
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
            console.log(`✅ Element removed:`, el.id || el.tagName);
        }
    } catch (error) {
        console.error('Failed to remove element:', error);
    }
}

/**
 * Check if element exists and is visible
 * @param {string} id - Element ID to check
 * @returns {boolean} - True if element exists and is visible
 */
export function isElementVisible(id) {
    try {
        const element = document.getElementById(id);
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    } catch (error) {
        console.error('Failed to check element visibility:', error);
        return false;
    }
}

/**
 * Wait for element to be available in DOM
 * @param {string} selector - CSS selector or element ID
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<HTMLElement|null>} - Element when found or null if timeout
 */
export function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        const checkElement = () => {
            const element = typeof selector === 'string' && selector.startsWith('#') 
                ? document.getElementById(selector.slice(1))
                : document.querySelector(selector);
                
            if (element) {
                resolve(element);
                return;
            }
            
            if (Date.now() - startTime > timeout) {
                resolve(null);
                return;
            }
            
            requestAnimationFrame(checkElement);
        };
        
        checkElement();
    });
}

/**
 * Get safe text content from element
 * @param {HTMLElement} element - Element to get text from
 * @param {number} maxLength - Maximum length of text
 * @returns {string} - Safe text content
 */
export function getSafeTextContent(element, maxLength = 1000) {
    try {
        if (!element) return '';
        
        let text = element.textContent || element.innerText || '';
        text = text.trim();
        
        if (text.length > maxLength) {
            text = text.substring(0, maxLength) + '...';
        }
        
        return escapeHtml(text);
    } catch (error) {
        console.error('Failed to get safe text content:', error);
        return '';
    }
}

/**
 * Create a debounced function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Check if page is ready for DOM manipulation
 * @returns {boolean} - True if page is ready
 */
export function isPageReady() {
    return document.readyState === 'complete' || 
           document.readyState === 'interactive' ||
           document.body !== null;
}

/**
 * Wait for page to be ready
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} - True if page becomes ready, false if timeout
 */
export function waitForPageReady(timeout = 10000) {
    return new Promise((resolve) => {
        if (isPageReady()) {
            resolve(true);
            return;
        }
        
        const startTime = Date.now();
        
        const checkReady = () => {
            if (isPageReady()) {
                resolve(true);
                return;
            }
            
            if (Date.now() - startTime > timeout) {
                resolve(false);
                return;
            }
            
            requestAnimationFrame(checkReady);
        };
        
        checkReady();
    });
}

/**
 * Get extension resource URL
 * @param {string} path - Resource path
 * @returns {string} - Full resource URL
 */
export function getExtensionResourceUrl(path) {
    try {
        return chrome.runtime.getURL(path);
    } catch (error) {
        console.error('Failed to get extension resource URL:', error);
        return path;
    }
}

/**
 * Check if CSP (Content Security Policy) is blocking script execution
 * @returns {boolean} - True if CSP is likely blocking
 */
export function isCSPBlocking() {
    try {
        // Try to create a script element - if CSP is blocking, this might fail
        const script = document.createElement('script');
        script.textContent = 'console.log("CSP test");';
        document.head.appendChild(script);
        document.head.removeChild(script);
        return false;
    } catch (error) {
        console.warn('CSP might be blocking script execution:', error);
        return true;
    }
}
