// Environment configuration for Tunnl.ai Extension
// This file handles environment variables for both development and production

let ENV_CONFIG = {};

try {
    // Try to access process.env (available in Node.js environments)
    if (typeof process !== 'undefined' && process.env) {
        ENV_CONFIG = {
            OPENAI_API_KEY: process.env.OPENAI_API_KEY || process.env.OPENAPIKEY || ''
        };
        
        if (ENV_CONFIG.OPENAI_API_KEY) {
            console.log('🔑 Environment API key loaded from process.env');
        }
    }
} catch (error) {
    // process.env not available (browser environment)
    console.log('🔧 Running in browser environment, process.env not available');
}

// For development, you can also manually set the API key here
// Uncomment and modify the line below to set your API key directly
// ENV_CONFIG.OPENAI_API_KEY = 'sk-your-api-key-here';

// Export the configuration
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = ENV_CONFIG;
} else if (typeof window !== 'undefined') {
    // Browser environment (popup, content scripts)
    window.ENV_CONFIG = ENV_CONFIG;
} else {
    // Service worker environment (background script)
    // Make it globally available in the service worker scope
    self.ENV_CONFIG = ENV_CONFIG;
}
