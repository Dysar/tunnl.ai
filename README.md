# tunnl.ai - AI-Powered Website Blocker

A Chrome extension that uses AI to analyze websites and block distracting content based on your daily tasks. Stay focused and productive with intelligent website filtering powered by OpenAI's GPT models.

## Features

- 🤖 **AI-Powered Analysis**: Uses OpenAI's GPT to analyze websites and determine if they're related to your tasks
- 📝 **Daily Task Management**: Set your tasks each day to help the AI understand what's relevant
- 🚫 **Smart Blocking**: Automatically blocks distracting websites while allowing task-related content
- ⏰ **Temporary Unblocking**: Unblock sites for 10 minutes when needed
- 📊 **Focus Statistics**: Track how many sites have been blocked and analyzed
- 🎨 **Beautiful UI**: Modern, intuitive interface for managing your focus

## Installation

### From Source (Developer Mode)

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd tunnl-extension
   ```

2. **Open Chrome Extensions page**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" in the top right

3. **Load the extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files

4. **Pin the extension**
   - Click the puzzle piece icon in Chrome toolbar
   - Pin tunnl.ai for easy access

## Setup

### 1. Get OpenAI API Key

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (starts with `sk-`)

### 2. Configure tunnl.ai

1. **Click the tunnl.ai icon** in your Chrome toolbar
2. **Enter your OpenAI API key** in the setup section
3. **Add your daily tasks** (one per line)
4. **Click "Save Tasks"** to activate the extension

### 3. Start Focusing

The extension will now:
- Monitor websites you visit
- Analyze them using AI
- Block distracting sites automatically
- Allow task-related websites

## Usage

### Daily Workflow

1. **Morning Setup**: Open tunnl.ai and enter your tasks for the day
2. **Automatic Protection**: The extension works in the background
3. **Smart Blocking**: Distracting sites are blocked with explanations
4. **Temporary Access**: Unblock sites for 10 minutes when needed

### Managing Blocked Sites

- **View blocked history** in the extension popup
- **Clear blocked history** to start fresh
- **Temporarily unblock** any site for 10 minutes
- **Disable extension** if you need unrestricted access

### Settings

- **Toggle extension** on/off
- **Update tasks** throughout the day
- **View statistics** on blocked and analyzed sites
- **Clear data** to reset everything

## How It Works

1. **URL Monitoring**: The extension tracks all websites you visit
2. **AI Analysis**: Each URL is sent to OpenAI's GPT model for analysis
3. **Task Comparison**: The AI compares the website against your daily tasks
4. **Smart Decision**: Sites unrelated to your tasks are blocked
5. **User Feedback**: Clear explanations for why sites were blocked

## Privacy & Security

- **Local Storage**: Your API key and tasks are stored locally in Chrome
- **No Data Collection**: We don't collect or store your browsing data
- **OpenAI API**: Only URLs are sent to OpenAI for analysis
- **Secure**: All communication uses HTTPS

## Troubleshooting

### Extension Not Working

1. **Check API Key**: Ensure your OpenAI API key is valid and has credits
2. **Verify Tasks**: Make sure you've entered tasks for the day
3. **Check Permissions**: Ensure the extension has necessary permissions
4. **Reload Extension**: Try reloading the extension in `chrome://extensions/`

### Sites Not Being Blocked

1. **Check Extension Status**: Ensure the extension is enabled
2. **Verify Tasks**: Make sure your tasks are relevant and specific
3. **API Limits**: Check if you've hit OpenAI API rate limits
4. **Cache**: The extension caches results for 24 hours

### Performance Issues

1. **API Delays**: OpenAI API calls may take 1-3 seconds
2. **Rate Limits**: Free OpenAI accounts have usage limits
3. **Cache**: Results are cached to improve performance

## Development

### File Structure

```
tunnl-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Main UI
├── popup.css             # UI styles
├── popup.js              # UI logic
├── background.js         # Background service worker
├── content.js            # Content script
├── blocked.html          # Blocked page
└── rules.json            # Declarative net request rules
```

### Key Components

- **Background Script**: Handles URL analysis and OpenAI API calls
- **Content Script**: Manages page blocking and user interactions
- **Popup**: Main interface for configuration and statistics
- **Blocked Page**: Custom page shown when sites are blocked

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- **Issues**: Report bugs and request features on GitHub
- **Documentation**: Check this README for common questions
- **API Issues**: Contact OpenAI support for API-related problems

---

**Stay focused, stay productive! 🎯**
AI Distraction Tracker
