// Content extraction module for website analysis
// This module provides content extraction functionality for service workers

class ContentExtractor {
    constructor() {
        this.maxContentLength = 2000; // Limit content length for LLM
        this.timeout = 10000; // 10 second timeout
    }

    async extractContent(url) {
        try {
            console.log('🔍 Extracting content from:', url);
            
            // Use fetch to get the HTML content
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            
            // Extract text content using regex (service worker compatible)
            const content = this.extractTextFromHtml(html, url);
            
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
        }
    }

    async extractTitle(url) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            const title = this.extractTitleFromHtml(html);
            
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
        }
    }

    // Extract text content from HTML using regex (service worker compatible)
    extractTextFromHtml(html, url) {
        try {
            // Extract title
            const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
            const title = titleMatch ? titleMatch[1].trim() : '';
            
            // Extract meta description
            const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
            const description = descMatch ? descMatch[1].trim() : '';
            
            // Remove script and style tags
            let cleanHtml = html
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
            
            // Extract main content areas
            const contentSelectors = [
                /<main[^>]*>([\s\S]*?)<\/main>/gi,
                /<article[^>]*>([\s\S]*?)<\/article>/gi,
                /<div[^>]*role=["']main["'][^>]*>([\s\S]*?)<\/div>/gi,
                /<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
                /<div[^>]*class=["'][^"']*main-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
                /<div[^>]*class=["'][^"']*post-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
                /<div[^>]*class=["'][^"']*entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi
            ];
            
            let mainContent = '';
            for (const selector of contentSelectors) {
                const match = cleanHtml.match(selector);
                if (match && match[1]) {
                    mainContent = match[1];
                    if (mainContent.length > 100) break; // Use first substantial content
                }
            }
            
            // Fallback to body content
            if (!mainContent || mainContent.length < 50) {
                const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/gi);
                if (bodyMatch && bodyMatch[1]) {
                    mainContent = bodyMatch[1];
                }
            }
            
            // Remove HTML tags and clean up text
            let text = mainContent
                .replace(/<[^>]*>/g, ' ') // Remove HTML tags
                .replace(/&[^;]+;/g, ' ') // Remove HTML entities
                .replace(/\s+/g, ' ') // Normalize whitespace
                .replace(/\n\s*\n/g, '\n') // Remove empty lines
                .trim();
            
            // Build final content
            let finalContent = '';
            if (title) finalContent += `Title: ${title}\n\n`;
            if (description) finalContent += `Description: ${description}\n\n`;
            if (text) finalContent += `Content: ${text}`;
            
            return finalContent.trim();
            
        } catch (error) {
            console.error('Error extracting text from HTML:', error);
            return '';
        }
    }
    
    // Extract title from HTML
    extractTitleFromHtml(html) {
        try {
            const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
            return titleMatch ? titleMatch[1].trim() : '';
        } catch (error) {
            console.error('Error extracting title from HTML:', error);
            return '';
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

// Make ContentExtractor globally available for service worker
if (typeof self !== 'undefined') {
    self.ContentExtractor = ContentExtractor;
}
