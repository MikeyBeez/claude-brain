# Background Vault Analyzer - User Guide

**Intelligent, continuous vault organization using Ollama**

## Overview

The Background Vault Analyzer is an intelligent system that continuously monitors your Obsidian vault, analyzes content using Ollama, discovers semantic relationships, and automatically applies high-confidence connections. It transforms vault organization from manual work into intelligent automation.

## Quick Start

### Prerequisites
- Python 3.8+ installed
- Ollama installed and running with llama3.2 model
- Obsidian vault with markdown files

### Installation
No installation required - just use the Python script directly:

```bash
# Make executable (already done)
chmod +x /Users/bard/Code/claude-brain/background_vault_analyzer.py

# Test the system
python /Users/bard/Code/claude-brain/background_vault_analyzer.py test
```

### Basic Usage

**Test Mode** (recommended first run):
```bash
python background_vault_analyzer.py test
```
- Analyzes a few files to verify Ollama integration
- Runs for 2 minutes then shows results
- Safe way to test the system

**Interactive Mode**:
```bash
python background_vault_analyzer.py start
```
- Starts the service in interactive mode
- Provides command prompt for control
- Shows real-time status and activity

**Background Service Mode**:
```bash
python background_vault_analyzer.py start --daemon
```
- Runs continuously in the background
- Monitors and processes files automatically
- Logs activity to console

**Force Analysis**:
```bash
python background_vault_analyzer.py force-analysis
```
- Forces immediate analysis of all vault files
- Useful for initial vault processing
- Exits when complete

## Configuration

### Default Configuration
The system uses sensible defaults, but can be customized via config file:

```json
{
  "processing": {
    "ollama_model": "llama3.2",
    "rate_limit_per_minute": 8,
    "analysis_timeout": 90
  },
  "auto_apply": {
    "enabled": true,
    "confidence_threshold": 0.75,
    "strength_threshold": 7.0,
    "max_per_hour": 10
  },
  "monitoring": {
    "scan_interval_seconds": 60
  },
  "safety": {
    "max_file_size_mb": 5,
    "backup_before_modify": true
  }
}
```

### Using Custom Configuration
```bash
python background_vault_analyzer.py start --config vault_analyzer_config.json
```

## How It Works

### 1. File Monitoring
- Continuously scans vault for new or modified markdown files
- Uses file hashing to detect actual content changes
- Ignores temporary files and system directories

### 2. Content Analysis
- Sends file content to Ollama for semantic analysis
- Extracts topics, concepts, and relationship hints
- Stores results in local SQLite database

### 3. Connection Discovery
- Compares analyzed files to find relationships
- Scores connection strength (0-10) and confidence
- Identifies connection types (thematic, temporal, project, etc.)

### 4. Automatic Application
- Applies high-confidence connections automatically
- Adds "Related Notes" sections to files
- Respects rate limits and safety thresholds

### 5. Continuous Learning
- Tracks which connections are useful
- Adapts scoring over time
- Improves suggestion quality

## Safety Features

### Rate Limiting
- Maximum 8 Ollama calls per minute
- Maximum 10 auto-applied connections per hour
- Prevents system overload

### File Safety
- Creates backups before modifying files
- Skips files larger than 5MB
- Ignores system and temporary directories

### Quality Control
- Only applies connections with >75% confidence
- Requires connection strength >7/10
- Human review for uncertain connections

## Monitoring and Control

### Interactive Commands
When running in interactive mode:
- `status` - Show current service status
- `force` - Force analysis of all files
- `stop` - Stop the service
- `quit` - Exit

### Status Information
The system tracks and reports:
- Files processed per hour
- Connections found and applied
- Queue size and processing status
- Error counts and uptime

### Database Location
Analysis results stored in: `/Users/bard/Code/claude-brain/vault_analysis.db`

## Troubleshooting

### Common Issues

**Ollama Connection Failed**
- Ensure Ollama is running: `ollama serve`
- Check model availability: `ollama list`
- Verify llama3.2 is installed: `ollama pull llama3.2`

**No Files Being Processed**
- Check vault path is correct
- Verify markdown files exist and are readable
- Check skip patterns in configuration

**High CPU Usage**
- Reduce rate_limit_per_minute in config
- Increase scan_interval_seconds
- Check for very large files being processed

**Connections Not Being Applied**
- Check confidence_threshold and strength_threshold settings
- Verify auto_apply is enabled
- Check hourly rate limits (max_per_hour)

### Logging
The system logs all activity with timestamps:
- INFO: Normal operations and status
- WARNING: Issues that don't stop processing
- ERROR: Failures and exceptions

Increase logging detail with:
```bash
python background_vault_analyzer.py start --log-level DEBUG
```

## Performance Optimization

### For Large Vaults (1000+ files)
- Increase scan_interval_seconds to 120
- Reduce rate_limit_per_minute to 5
- Set max_concurrent_tasks to 1

### For Fast Processing
- Increase rate_limit_per_minute to 15
- Reduce scan_interval_seconds to 30
- Set max_concurrent_tasks to 3

### Resource Usage
- Memory: ~50-100MB for database and caching
- CPU: Moderate during analysis, minimal during monitoring
- Disk: Database grows ~1KB per analyzed file

## Advanced Usage

### Running as System Service (macOS)
Create a Launch Agent for automatic startup:

```xml
<!-- ~/Library/LaunchAgents/com.vault.analyzer.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vault.analyzer</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/bard/Code/claude-brain/background_vault_analyzer.py</string>
        <string>start</string>
        <string>--daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

Load with: `launchctl load ~/Library/LaunchAgents/com.vault.analyzer.plist`

### Custom Ollama Models
To use different models, update configuration:
```json
{
  "processing": {
    "ollama_model": "deepseek-r1"
  }
}
```

### Batch Processing
For one-time analysis of entire vault:
```bash
# Process all files then exit
python background_vault_analyzer.py force-analysis

# Check results
sqlite3 /Users/bard/Code/claude-brain/vault_analysis.db "SELECT COUNT(*) FROM file_analysis;"
```

## Expected Results

### Initial Run (673 files)
- Processing time: 6-10 hours
- Connections found: 100-300
- Auto-applied: 50-150
- Manual review needed: 50-100

### Ongoing Operation
- New files: Analyzed within 2-5 minutes
- Modified files: Re-analyzed within 5-10 minutes
- Connections: Discovered and applied hourly
- Maintenance: Automatic cleanup weekly

## Success Metrics

The system is working well when you see:
- ✅ Files processed consistently (>90% success rate)
- ✅ Connections being discovered and applied
- ✅ Improved vault navigation and discoverability
- ✅ Reduced manual organization effort
- ✅ Stable operation without errors

## Getting Help

### Check Status
```bash
python background_vault_analyzer.py status
```

### View Database Contents
```bash
sqlite3 /Users/bard/Code/claude-brain/vault_analysis.db
.tables
SELECT * FROM file_analysis LIMIT 5;
SELECT * FROM connections WHERE auto_applied = 1 LIMIT 5;
```

### Reset System
To start fresh:
```bash
rm /Users/bard/Code/claude-brain/vault_analysis.db
python background_vault_analyzer.py force-analysis
```

---

**The Background Vault Analyzer transforms your vault from static storage into an intelligent, self-organizing knowledge system that continuously improves through automated analysis and connection discovery.**
