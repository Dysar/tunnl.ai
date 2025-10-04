# tunnl.ai - AI-Powered Website Blocker

A Chrome extension that uses AI to analyze websites and block distracting content based on your daily tasks. Stay focused and productive with intelligent website filtering powered by OpenAI's GPT models.

## Features

- 🤖 **AI-Powered Analysis**: Uses OpenAI's GPT to analyze websites and determine if they're related to your tasks
- 📝 **Daily Task Management**: Set your tasks each day to help the AI understand what's relevant
- ✅ **Smart Task Validation**: AI validates your task descriptions to ensure they're specific enough for effective blocking
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
2. **Task Validation**: AI validates your task descriptions to ensure they're specific enough for effective blocking
3. **Automatic Protection**: The extension works in the background
4. **Smart Blocking**: Distracting sites are blocked with explanations
5. **Temporary Access**: Unblock sites for 10 minutes when needed

### Writing Effective Tasks

For the best blocking results, write specific and actionable tasks:

**✅ Good Examples:**
- "Research competitor pricing for SaaS tools"
- "Write blog post about React hooks"
- "Prepare presentation slides for Q4 sales meeting"
- "Debug authentication issues in the login module"

**❌ Avoid These (Too Broad):**
- "Work on project"
- "Be productive"
- "Do research"
- "Learn something new"

The AI will validate your tasks and provide suggestions if they're too vague to enable effective website blocking.

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

Short privacy note:

- Storage: Your OpenAI API key, daily tasks, stats, and blocked history are saved in Chrome storage.
  - chrome.storage.sync: API key, tasks, stats, blocked history
  - chrome.storage.local: temporary unblocks (e.g., 10‑minute bypass)
- Data sent to OpenAI: Only the URL being analyzed. No page content, cookies, or personal data is sent to us.
- No server: tunnl.ai has no backend; everything runs in your browser.
- Secure: All network communication uses HTTPS.

## Cost

- Model used by default: `gpt-3.5-turbo` (set in `background.js`).
- Cost formula per request: `(prompt_tokens/1000 × input_price) + (completion_tokens/1000 × output_price)`.
- Rough token sizes per analysis: ~700 prompt tokens (system + tasks + URL) and ~80 completion tokens.
- Task validation + sample sites: ~450 prompt tokens and ~80 completion tokens per task validation.
- Example pricing (verify your OpenAI plan): input $0.0005/1K tok, output $0.0015/1K tok.

Estimated cost per request:
- URL Analysis: (0.7 × $0.0005) + (0.08 × $0.0015) ≈ $0.00035 + $0.00012 ≈ $0.00047
- Task Validation + Samples: (0.45 × $0.0005) + (0.08 × $0.0015) ≈ $0.00023 + $0.00012 ≈ $0.00035

Estimated cost per hour (by browsing intensity):
- 60 URLs/hour ≈ 60 × $0.00047 ≈ $0.028/hour
- 80 URLs/hour ≈ ~$0.038/hour
- 120 URLs/hour ≈ ~$0.056/hour

Per Week = $0.028 * 40 = $1.2 
$5 per month

Note: Task validation only occurs when adding new tasks, so it adds minimal cost to your usage.

Notes:
- Your actual cost depends on how often pages are analyzed (caching reduces calls), model choice, and response length.
- You can switch models and adjust pricing assumptions in code or in settings as needed.

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