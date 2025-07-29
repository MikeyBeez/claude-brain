#!/bin/bash
# Setup script for Context Monitor

echo "Setting up Context Monitor..."

# Install rumps using pipx (recommended for macOS)
if ! command -v pipx &> /dev/null; then
    echo "Installing pipx..."
    brew install pipx
    pipx ensurepath
fi

# Install rumps in isolated environment
pipx install rumps || pip3 install --user rumps || pip3 install --break-system-packages rumps

# Make the script executable
chmod +x context_monitor.py

# Create launch agent
PLIST_PATH="$HOME/Library/LaunchAgents/com.claude.context-monitor.plist"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.claude.context-monitor</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$(pwd)/context_monitor.py</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

echo "Created launch agent at: $PLIST_PATH"

# Load the launch agent
launchctl load "$PLIST_PATH" 2>/dev/null || launchctl unload "$PLIST_PATH" && launchctl load "$PLIST_PATH"

echo "Context Monitor is now running in your menu bar!"
echo ""
echo "To update token count from Claude:"
echo "python3 context_monitor.py <token_count>"
echo ""
echo "To stop the monitor:"
echo "launchctl unload $PLIST_PATH"
