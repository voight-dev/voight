# Change Log

All notable changes to the Voight extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.0.1] - 2025-01-01

### Added
- **AI-Assisted Code Detection**: Automatically detects large code insertions and pastes
- **Multi-Provider AI Support**: Integration with Gemini, Anthropic Claude, and OpenAI
- **Visual Indicators**: Status bar, hover tooltips, and optional gutter icons for tracked code
- **Segments Panel**: Interactive webview displaying all detected AI-assisted code blocks
- **Semantic Expansion**: Configurable context expansion (none, minimal, balanced, maximum)
- **File Tracking**: Track most edited files and code changes over time
- **Statistics Dashboard**: View paste detection stats, block statistics, and file rankings
- **Context Management**: Add and view contextual notes for detected code blocks
- **Shadow GC**: Automatic cleanup of stale code blocks with configurable retention
- **Debug Mode**: Comprehensive debugging with JSON output for paste events and solutions
- **Customizable Detection**: Configure minimum characters, lines, and exclusion patterns
- **12 Commands**: Health checks, stats viewing, block management, and GC operations

### Configuration Options
- Status bar, hover, and gutter icon toggles
- Detection thresholds (min characters, min lines)
- Semantic expansion levels
- AI provider selection and API key configuration
- Debug mode with optional data persistence
- File exclusion patterns with glob and regex support

### Documentation
- Comprehensive README with setup guide
- API setup guide for all supported providers
- Architecture documentation
- Debug guide
- Design guidelines