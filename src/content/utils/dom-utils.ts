// DOM manipulation utilities for content scripts

import { escapeHtml } from '../../shared/utils';

/**
 * Safely create and inject styles into the page
 */
export function injectStyles(css: string, id: string = 'tunnl-styles'): HTMLStyleElement | null {
    try {
        // Remove existing styles with the same ID
        const existing = document.getElementById(id);
        if (existing) {
            existing.remove();
        }

        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        
        // Try to inject into head first, fallback to body
        const target = document.head || document.body;
        if (target) {
            target.appendChild(style);
            return style;
        }
        
        return null;
    } catch (error) {
        console.warn('Failed to inject styles:', error);
        return null;
    }
}

/**
 * Safely add event listener with error handling
 */
export function addEventListenerSafe(element: HTMLElement, event: string, handler: EventListener): void {
    try {
        element.addEventListener(event, handler);
    } catch (error) {
        console.warn('Failed to add event listener:', error);
    }
}

/**
 * Safely remove element from DOM
 */
export function removeElementSafe(element: HTMLElement | null): void {
    try {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    } catch (error) {
        console.warn('Failed to remove element:', error);
    }
}

/**
 * Create a modal element
 */
export function createModal(content: string, className: string = 'tunnl-modal'): HTMLElement {
    const modal = document.createElement('div');
    modal.className = className;
    modal.innerHTML = content;
    return modal;
}

/**
 * Create a toast element
 */
export function createToast(content: string, className: string = 'tunnl-toast'): HTMLElement {
    const toast = document.createElement('div');
    toast.className = className;
    toast.innerHTML = content;
    return toast;
}

/**
 * Wait for page to be ready
 */
export function waitForPageReady(): Promise<void> {
    return new Promise((resolve) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => resolve());
        } else {
            resolve();
        }
    });
}

/**
 * Check if Content Security Policy is blocking script injection
 */
export function isCSPBlocking(): boolean {
    try {
        // Try to create a script element and check if it's blocked
        const script = document.createElement('script');
        script.textContent = 'console.log("CSP test");';
        document.head.appendChild(script);
        document.head.removeChild(script);
        return false;
    } catch (error) {
        return true;
    }
}

/**
 * Get extension resource URL
 */
export function getExtensionResourceUrl(path: string): string {
    try {
        return chrome.runtime.getURL(path);
    } catch (error) {
        console.warn('Failed to get extension resource URL:', error);
        return path;
    }
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => func(...args), wait);
    };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean = false;
    
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Check if element is visible in viewport
 */
export function isElementVisible(element: HTMLElement): boolean {
    try {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    } catch (error) {
        return false;
    }
}

/**
 * Scroll element into view
 */
export function scrollIntoView(element: HTMLElement, options: ScrollIntoViewOptions = {}): void {
    try {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
            ...options
        });
    } catch (error) {
        console.warn('Failed to scroll element into view:', error);
    }
}

/**
 * Get computed style property
 */
export function getComputedStyleProperty(element: HTMLElement, property: string): string {
    try {
        return window.getComputedStyle(element).getPropertyValue(property);
    } catch (error) {
        console.warn('Failed to get computed style:', error);
        return '';
    }
}

/**
 * Check if element has class
 */
export function hasClass(element: HTMLElement, className: string): boolean {
    try {
        return element.classList.contains(className);
    } catch (error) {
        return false;
    }
}

/**
 * Add class to element
 */
export function addClass(element: HTMLElement, className: string): void {
    try {
        element.classList.add(className);
    } catch (error) {
        console.warn('Failed to add class:', error);
    }
}

/**
 * Remove class from element
 */
export function removeClass(element: HTMLElement, className: string): void {
    try {
        element.classList.remove(className);
    } catch (error) {
        console.warn('Failed to remove class:', error);
    }
}

/**
 * Toggle class on element
 */
export function toggleClass(element: HTMLElement, className: string): void {
    try {
        element.classList.toggle(className);
    } catch (error) {
        console.warn('Failed to toggle class:', error);
    }
}

/**
 * Set element attribute safely
 */
export function setAttribute(element: HTMLElement, name: string, value: string): void {
    try {
        element.setAttribute(name, value);
    } catch (error) {
        console.warn('Failed to set attribute:', error);
    }
}

/**
 * Get element attribute safely
 */
export function getAttribute(element: HTMLElement, name: string): string | null {
    try {
        return element.getAttribute(name);
    } catch (error) {
        console.warn('Failed to get attribute:', error);
        return null;
    }
}

/**
 * Remove element attribute safely
 */
export function removeAttribute(element: HTMLElement, name: string): void {
    try {
        element.removeAttribute(name);
    } catch (error) {
        console.warn('Failed to remove attribute:', error);
    }
}
