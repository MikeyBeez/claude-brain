# MCP Server Human-Readable Names Solution

**Problem**: MCP servers show up as generic "node" processes in Activity Monitor and system processes, making them difficult to identify.

**Solution**: Create wrapper shell scripts with descriptive names that launch the actual MCP servers.

## Implementation

### 1. Wrapper Scripts Created

Location: `~/.local/bin/mcp-wrappers/`

Wrapper scripts created:
- `mcp-brain-manager` → `/Users/bard/Code/mcp-brain-manager/dist/index.js`
- `mcp-project-finder` → `/Users/bard/Code/mcp-project-finder/server.js`
- `mcp-tracked-search` → `/Users/bard/Code/mcp-tracked-search/build/index.js`
- `mcp-tools-registry` → `/Users/bard/Code/mcp-tools-registry/dist/index.js`
- `mcp-protocol-tracker` → `/Users/bard/Code/mcp-protocol-tracker/src/index.js`
- `mcp-smart-help` → `/Users/bard/Code/mcp-smart-help/dist/index.js`
- `mcp-reminders` → `/Users/bard/Code/mcp-reminders/dist/index.js`
- `mcp-elvis` → `/Users/bard/Code/mcp-elvis-simple/src/index.js`
- `mcp-contemplation` → `/Users/bard/Code/mcp-contemplation/build/index.js`
- `mcp-mercury-evolution` → `/Users/bard/Code/mcp-mercury-evolution/dist/index.js`

### 2. Wrapper Script Format

Each wrapper script follows this pattern:
```bash
#!/bin/bash
# MCP [Service Name] Server
exec node /path/to/actual/server.js "$@"
```

The `exec` command replaces the shell process with the node process, so the process appears with the wrapper's name.

### 3. Configuration Updates

Updated Claude Desktop configuration saved as:
`~/Library/Application Support/Claude/claude_desktop_config_with_wrappers.json`

**Before**:
```json
"brain-manager": {
  "command": "node",
  "args": ["/Users/bard/Code/mcp-brain-manager/dist/index.js"]
}
```

**After**:
```json
"brain-manager": {
  "command": "/Users/bard/.local/bin/mcp-wrappers/mcp-brain-manager"
}
```

## Benefits

1. **Process Identification**: Processes now appear as `mcp-brain-manager` instead of generic `node`
2. **Activity Monitor**: Clear identification in Activity Monitor and system tools
3. **Debugging**: Easier to identify which MCP server is causing issues
4. **System Administration**: Better process management and monitoring

## Deployment Steps

To activate this solution:

1. **Backup current config** (already done):
   ```bash
   cp ~/Library/Application\ Support/Claude/claude_desktop_config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json.backup
   ```

2. **Deploy new config**:
   ```bash
   cp ~/Library/Application\ Support/Claude/claude_desktop_config_with_wrappers.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

3. **Restart Claude Desktop** to load new configuration

4. **Verify** processes show with descriptive names:
   ```bash
   ps aux | grep mcp-
   ```

## Maintenance

When adding new MCP servers:
1. Create wrapper script in `~/.local/bin/mcp-wrappers/`
2. Update Claude Desktop configuration to use wrapper
3. Restart Claude Desktop

## Alternative Solutions Considered

1. **Python setproctitle**: Works for `ps` but not Activity Monitor on macOS
2. **PyInstaller/py2app**: Creates compiled executables (more complex)
3. **SMAppService API**: Requires proper app bundling (macOS 13+)
4. **LaunchAgent improvements**: Only affects plist metadata, not process names

The wrapper script approach is the simplest and most effective solution.

---
*Created: 2025-07-29*
*Status: Ready for deployment*
*Task: task-027*
