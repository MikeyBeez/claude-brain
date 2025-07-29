#!/bin/bash
# Script to restart the brain service and test output filtering

echo "🔄 Brain Service Restart & Test Script"
echo "======================================"
echo

echo "📋 Current Status:"
echo "- Phase 3 changes are in /Users/bard/Code/claude-brain/index.js"
echo "- OutputFilter added to obsidian_note and unified_search tools"
echo "- Brain service needs restart to load changes"
echo

echo "⚠️  To activate the output filtering changes:"
echo "1. Restart Claude Desktop app"
echo "   (This will reload all MCP servers with the updated code)"
echo

echo "📝 After restart, you can test with these commands:"
echo

echo "Test 1 - Create a long note:"
echo 'obsidian_note {'
echo '  "action": "create",'
echo '  "title": "Test Long Note",'
echo '  "content": "<paste long content here>"'
echo '}'
echo

echo "Test 2 - Read WITHOUT filtering (verbose):"
echo 'obsidian_note {'
echo '  "action": "read",'
echo '  "identifier": "Test Long Note",'
echo '  "verbose": true'
echo '}'
echo

echo "Test 3 - Read WITH filtering (default):"
echo 'obsidian_note {'
echo '  "action": "read",'
echo '  "identifier": "Test Long Note"'
echo '}'
echo

echo "Test 4 - Search with filtering:"
echo 'unified_search {'
echo '  "query": "test",'
echo '  "limit": 50'
echo '}'
echo

echo "Expected behavior:"
echo "- Without verbose: Shows first 100 lines / 10k chars with filtering info"
echo "- With verbose: Shows complete content"
echo "- Search: Shows first 10 results by default"
