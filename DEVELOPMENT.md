# Development Guide for tunnl.ai Chrome Extension

## Project Structure

```
tunnl.ai/
├── src/                          # Source code
│   ├── background/               # Background script components
│   │   ├── background.js         # Main background script
│   │   ├── api/                  # API-related modules
│   │   │   └── openai.js         # OpenAI API client
│   │   ├── storage/              # Storage management
│   │   │   ├── storage.js        # Storage utilities
│   │   │   └── cache.js          # URL cache management
│   │   ├── analysis/             # URL analysis logic
│   │   │   ├── analyzer.js       # Main URL analyzer
│   │   │   └── task-validator.js # Task validation logic
│   │   └── messaging/            # Message handling
│   │       └── message-handler.js # Runtime message handling
│   ├── content/                  # Content script components
│   │   ├── content.js            # Main content script
│   │   ├── ui/                   # UI injection components
│   │   │   ├── modal.js          # Block modal component
│   │   │   └── toast.js          # Toast notifications
│   │   └── utils/                # Content script utilities
│   │       └── dom-utils.js      # DOM manipulation utilities
│   ├── popup/                    # Popup interface components
│   │   ├── popup.html            # Popup HTML
│   │   ├── popup.css             # Popup styles
│   │   ├── popup.js              # Main popup script
│   │   ├── components/           # Popup UI components
│   │   └── utils/                # Popup utilities
│   ├── options/                  # Options page components
│   │   ├── options.html          # Options page HTML
│   │   ├── options.css           # Options page styles
│   │   ├── options.js            # Main options script
│   │   ├── components/           # Options page components
│   │   └── utils/                # Options utilities
│   ├── shared/                   # Shared utilities and constants
│   │   ├── constants.js          # App constants and configuration
│   │   ├── utils.js              # Shared utility functions
│   │   ├── storage-keys.js       # Storage key constants
│   │   └── message-types.js      # Message type constants
│   └── blocked/                  # Blocked page components
│       ├── blocked.html          # Blocked page HTML
│       ├── blocked.css           # Blocked page styles
│       ├── blocked.js            # Blocked page script
│       └── components/           # Blocked page components
├── assets/                       # Static assets
│   ├── images/                   # Image assets
│   │   ├── icons/                # Extension icons
│   │   ├── beaver.png            # Beaver mascot
│   │   ├── access_denied.png     # Access denied banner
│   │   └── blocked_beaver.png    # Blocked page beaver
│   ├── fonts/                    # Font assets
│   │   └── Excalifont Regular.woff2
│   └── styles/                   # Global styles
├── scripts/                      # Build and utility scripts
│   ├── build.js                  # Build script
│   ├── test.js                   # Test runner
│   ├── lint.js                   # Linting script
│   └── package.js                # Package for distribution
├── tests/                        # Test files
├── docs/                         # Documentation
├── manifest.json                 # Extension configuration
├── package.json                  # Node.js dependencies and scripts
├── .eslintrc.js                  # ESLint configuration
├── .prettierrc                   # Prettier configuration
└── .gitignore                    # Git ignore rules
```

## Development Setup

### Prerequisites

- Node.js 16+ 
- npm or yarn
- Chrome browser for testing

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development Commands

```bash
# Build the extension
npm run build

# Run tests
npm run test

# Lint code
npm run lint

# Package for distribution
npm run package

# Full development build
npm run dev

# Clean build artifacts
npm run clean
```

### Loading the Extension

1. Run `npm run build` to create the `dist/` directory
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist/` directory

## Architecture

### Background Script (`src/background/`)

The background script is the core of the extension and handles:

- **API Communication**: OpenAI API integration for URL analysis
- **Storage Management**: Chrome storage operations with caching
- **URL Analysis**: AI-powered website blocking decisions
- **Message Handling**: Communication between different extension contexts
- **Navigation Monitoring**: Tracking user navigation for analysis

### Content Scripts (`src/content/`)

Content scripts run in the context of web pages and handle:

- **UI Injection**: Modal and toast notifications
- **DOM Manipulation**: Safe DOM operations with CSP handling
- **User Interaction**: Blocking feedback and bypass actions

### Popup Interface (`src/popup/`)

The popup provides the main user interface for:

- **Task Management**: Adding, editing, and selecting tasks
- **Settings Configuration**: API key setup and preferences
- **Statistics Display**: Focus metrics and blocked sites

### Options Page (`src/options/`)

The options page provides advanced configuration:

- **Data Management**: Export/import settings and data
- **Allowlist Management**: Configure allowed websites
- **Statistics**: Detailed analytics and blocked site history

### Shared Utilities (`src/shared/`)

Common utilities used across all contexts:

- **Constants**: App-wide configuration and constants
- **Utilities**: Helper functions for common operations
- **Storage Keys**: Centralized storage key management
- **Message Types**: Runtime message type definitions

## Key Features

### Modular Architecture

- **Separation of Concerns**: Each module has a specific responsibility
- **Reusable Components**: Shared utilities and components
- **Clear Interfaces**: Well-defined APIs between modules

### Error Handling

- **Graceful Degradation**: Extension continues working even if some features fail
- **Comprehensive Logging**: Detailed logging for debugging
- **User Feedback**: Clear error messages and recovery options

### Performance

- **Caching**: URL analysis results are cached to reduce API calls
- **Debouncing**: UI interactions are debounced to prevent spam
- **Efficient Storage**: Optimized storage usage with cleanup

### Security

- **CSP Handling**: Content Security Policy compliance
- **Input Validation**: All user inputs are validated and sanitized
- **Safe DOM Operations**: Protected against XSS attacks

## Testing

### Manual Testing

1. Load the extension in Chrome
2. Configure API key and tasks
3. Navigate to various websites
4. Verify blocking behavior and UI responses

### Automated Testing

```bash
# Run all tests
npm run test

# Run specific test categories
npm run test:unit
npm run test:integration
```

## Deployment

### Building for Production

```bash
# Create production build
npm run build

# Package for distribution
npm run package
```

### Chrome Web Store

1. Run `npm run package` to create the zip file
2. Upload to Chrome Web Store Developer Dashboard
3. Fill out store listing information
4. Submit for review

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Code Style

- Use ESLint and Prettier for consistent formatting
- Follow the existing code structure and patterns
- Add comments for complex logic
- Write tests for new features

## Troubleshooting

### Common Issues

1. **Extension not loading**: Check manifest.json paths
2. **API errors**: Verify OpenAI API key and quota
3. **Storage issues**: Check Chrome storage permissions
4. **UI not showing**: Verify CSP and content script injection

### Debug Mode

Enable debug logging by setting `localStorage.debug = 'tunnl:*'` in the browser console.

## License

MIT License - see LICENSE file for details.
