# TaskFocus Installation Guide

## Quick Start

### 1. Download the Extension

1. Download or clone this repository to your computer
2. Extract the files to a folder (e.g., `taskfocus-extension`)

### 2. Install in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right corner)
3. Click "Load unpacked"
4. Select the folder containing the extension files
5. The TaskFocus extension should now appear in your extensions list

### 3. Pin the Extension

1. Click the puzzle piece icon in Chrome's toolbar
2. Find TaskFocus and click the pin icon
3. The TaskFocus icon should now appear in your toolbar

### 4. Get Your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (it starts with `sk-`)
5. **Important**: Keep this key secure and don't share it

### 5. Configure TaskFocus

1. Click the TaskFocus icon in your toolbar
2. Enter your OpenAI API key in the setup section
3. Click "Save"
4. Enter your tasks for today (one per line)
5. Click "Save Tasks"

### 6. Start Using

The extension will now:
- Monitor websites you visit
- Analyze them using AI
- Block distracting sites automatically
- Show you why sites were blocked

## Troubleshooting

### Extension Not Loading

- Make sure you extracted all files to a folder
- Check that all files are present (manifest.json, popup.html, etc.)
- Try reloading the extension in `chrome://extensions/`

### API Key Issues

- Ensure your API key starts with `sk-`
- Check that you have credits in your OpenAI account
- Verify the key is valid at [OpenAI Platform](https://platform.openai.com/api-keys)

### Sites Not Being Blocked

- Make sure the extension is enabled
- Check that you've entered tasks for the day
- Verify your API key is working
- Try visiting a clearly distracting site (like social media)

### Performance Issues

- OpenAI API calls may take 1-3 seconds
- Free accounts have rate limits
- Results are cached for 24 hours to improve performance

## Need Help?

- Check the main README.md for detailed documentation
- Open the extension options page for advanced settings
- Report issues on the project's GitHub page

## Security Note

- Your API key is stored locally in Chrome
- Only URLs are sent to OpenAI for analysis
- No personal data is collected or shared
- All communication uses secure HTTPS

---

**Ready to focus? Start by setting your daily tasks! 🎯**
