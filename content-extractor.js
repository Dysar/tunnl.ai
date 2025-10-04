// Content extraction module for website analysis
// This module uses Puppeteer to extract text content from websites

const puppeteer = require('puppeteer');

class ContentExtractor {
    constructor() {
        this.browser = null;
        this.isInitialized = false;
        this.maxContentLength = 2000; // Limit content length for LLM
        this.timeout = 10000; // 10 second timeout
    }

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            console.log('🚀 Initializing Puppeteer browser...');
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            });
            this.isInitialized = true;
            console.log('✅ Puppeteer browser initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Puppeteer:', error);
            throw error;
        }
    }

    async extractContent(url) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        let page = null;
        try {
            console.log('🔍 Extracting content from:', url);
            
            page = await this.browser.newPage();
            
            // Set user agent to avoid blocking
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            // Set viewport
            await page.setViewport({ width: 1280, height: 720 });
            
            // Navigate to the page with timeout
            await page.goto(url, { 
                waitUntil: 'domcontentloaded', 
                timeout: this.timeout 
            });
            
            // Wait a bit for dynamic content to load
            await page.waitForTimeout(2000);
            
            // Extract text content
            const content = await page.evaluate(() => {
                // Remove script and style elements
                const scripts = document.querySelectorAll('script, style, noscript');
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
                return mainContent
                    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
                    .replace(/\n\s*\n/g, '\n') // Remove empty lines
                    .trim();
            });
            
            // Truncate content if too long
            const truncatedContent = content.length > this.maxContentLength 
                ? content.substring(0, this.maxContentLength) + '...'
                : content;
            
            console.log('✅ Content extracted:', {
                url,
                contentLength: content.length,
                truncatedLength: truncatedContent.length
            });
            
            return {
                success: true,
                content: truncatedContent,
                fullLength: content.length,
                truncated: content.length > this.maxContentLength
            };
            
        } catch (error) {
            console.error('❌ Content extraction failed:', error.message);
            return {
                success: false,
                error: error.message,
                content: null
            };
        } finally {
            if (page) {
                await page.close();
            }
        }
    }

    async extractTitle(url) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        let page = null;
        try {
            page = await this.browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            await page.goto(url, { 
                waitUntil: 'domcontentloaded', 
                timeout: this.timeout 
            });
            
            const title = await page.title();
            return {
                success: true,
                title: title || 'Untitled'
            };
            
        } catch (error) {
            console.error('❌ Title extraction failed:', error.message);
            return {
                success: false,
                error: error.message,
                title: null
            };
        } finally {
            if (page) {
                await page.close();
            }
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.isInitialized = false;
            console.log('🔒 Puppeteer browser closed');
        }
    }

    // Clean up text content for LLM analysis
    cleanText(text) {
        if (!text) return '';
        
        return text
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/[^\w\s.,!?;:()\-'"]/g, '') // Remove special characters but keep punctuation
            .trim();
    }

    // Check if URL is suitable for content extraction
    isExtractableUrl(url) {
        try {
            const urlObj = new URL(url);
            const protocol = urlObj.protocol;
            const hostname = urlObj.hostname;
            
            // Only extract from HTTP/HTTPS
            if (!['http:', 'https:'].includes(protocol)) {
                return false;
            }
            
            // Skip certain domains that might cause issues
            const skipDomains = [
                'localhost',
                '127.0.0.1',
                'chrome://',
                'chrome-extension://',
                'file://'
            ];
            
            return !skipDomains.some(domain => hostname.includes(domain));
            
        } catch (error) {
            return false;
        }
    }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContentExtractor;
}

// For browser environment (if needed)
if (typeof window !== 'undefined') {
    window.ContentExtractor = ContentExtractor;
}
