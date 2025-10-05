# Environment Configuration for Tunnl.ai Extension

This guide explains how to set up environment variables for the Tunnl.ai Chrome extension, allowing you to automatically configure your OpenAI API key without manual setup.

## Quick Setup

### Option 1: Using the Setup Script (Recommended)

1. Run the setup script:
   ```bash
   node setup-env.js
   ```

2. Enter your OpenAI API key when prompted

3. The extension will automatically use this API key

### Option 2: Manual .env File Creation

1. Create a `.env` file in the extension root directory:
   ```bash
   touch .env
   ```

2. Add your OpenAI API key to the file:
   ```
   OPENAI_API_KEY=sk-your-openai-api-key-here
   ```

### Option 3: Direct Configuration

1. Edit `env-config.js`
2. Uncomment and modify this line:
   ```javascript
   ENV_CONFIG.OPENAI_API_KEY = 'sk-your-api-key-here';
   ```

## How It Works

The extension checks for API keys in this order:

1. **Environment Configuration** (`env-config.js`) - Highest priority
2. **Chrome Storage** (user-configured) - Fallback
3. **Manual Setup** (popup interface) - Last resort

### Environment Compatibility

The `env-config.js` file works in multiple contexts:
- **Service Worker** (background script): Uses `self.ENV_CONFIG`
- **Browser Context** (popup, content scripts): Uses `window.ENV_CONFIG`
- **Node.js** (development/testing): Uses `module.exports`

## Development vs Production

### Development
- Use `.env` file or `setup-env.js` script
- API key is loaded from environment variables
- No manual configuration needed

### Production
- Users still need to configure API key through the popup
- Environment configuration is ignored for security
- Ensures users provide their own API keys

## Security Notes

- ✅ `.env` files are automatically ignored by git
- ✅ API keys are not committed to version control
- ✅ Environment configuration only works in development
- ⚠️ Never commit API keys to public repositories

## Troubleshooting

### API Key Not Working
1. Check that your API key starts with `sk-`
2. Verify the key is valid at [OpenAI Platform](https://platform.openai.com/api-keys)
3. Ensure you have credits in your OpenAI account

### Environment Not Loading
1. Check that `.env` file exists in the extension root
2. Verify the file format: `OPENAI_API_KEY=sk-your-key`
3. Restart the extension after making changes

### Service Worker Errors
If you see `window is not defined` errors:
1. This is fixed in the current version
2. The extension now properly handles service worker context
3. Environment variables work in all extension contexts

### Still Asking for API Key
1. Check browser console for environment loading messages
2. Verify `env-config.js` is being imported
3. Try the manual configuration method

## File Structure

```
tunnl.ai/
├── .env                    # Your API key (not committed)
├── env-config.js          # Environment configuration
├── setup-env.js           # Setup script
├── background.js          # Extension background script
└── ENV-SETUP.md          # This guide
```

## Console Messages

When working correctly, you should see these console messages:

- `🔑 Environment API key loaded from process.env` - Environment loaded
- `🔑 Using API key from environment configuration` - Using env key
- `🔑 Using API key from storage` - Using stored key
- `⚠️ No API key found - user will need to configure one` - No key found
