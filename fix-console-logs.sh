#!/bin/bash

# Fix script for BrainInitV5 console.log issues
# Changes all console.log to console.error to prevent MCP protocol interference

echo "🔧 Fixing console.log statements in BrainInitV5 system..."
echo "================================================"

# Backup first
echo "📦 Creating backups..."
cp -r /Users/bard/Code/claude-brain/brain-init-v5 /Users/bard/Code/claude-brain/brain-init-v5.backup-console-fix
cp /Users/bard/Code/claude-brain/brain-integration-wrapper.js /Users/bard/Code/claude-brain/brain-integration-wrapper.js.backup-console-fix

# Fix brain-integration-wrapper.js
echo "✏️  Fixing brain-integration-wrapper.js..."
sed -i '' 's/console\.log(/console.error(/g' /Users/bard/Code/claude-brain/brain-integration-wrapper.js

# Fix all files in brain-init-v5 directory
echo "✏️  Fixing brain-init-v5 directory files..."
find /Users/bard/Code/claude-brain/brain-init-v5 -name "*.js" -exec sed -i '' 's/console\.log(/console.error(/g' {} \;

# Count changes
echo ""
echo "📊 Summary of changes:"
echo "-------------------"
WRAPPER_COUNT=$(grep -c "console.error" /Users/bard/Code/claude-brain/brain-integration-wrapper.js)
V5_COUNT=$(grep -r "console.error" /Users/bard/Code/claude-brain/brain-init-v5/ --include="*.js" | wc -l)

echo "  • brain-integration-wrapper.js: $WRAPPER_COUNT console.error statements"
echo "  • brain-init-v5 directory: $V5_COUNT console.error statements"

echo ""
echo "✅ Fix complete! All console.log statements have been converted to console.error"
echo "   This prevents stdout pollution that breaks MCP JSON protocol."
echo ""
echo "📝 Backups created:"
echo "  • brain-init-v5.backup-console-fix/"
echo "  • brain-integration-wrapper.js.backup-console-fix"
echo ""
echo "⚠️  IMPORTANT: Restart Claude Desktop to apply changes!"
