#!/bin/bash
# Test script for Phase 3 output filtering

echo "🧪 Testing Output Filter Phase 3 Implementation"
echo "============================================="
echo

# Create a test note with lots of content
cat > /tmp/test_long_note.md << 'EOF'
# Test Long Note

This is a test note with many lines to test the output filtering.

## Section 1
Line 1
Line 2
Line 3
Line 4
Line 5
Line 6
Line 7
Line 8
Line 9
Line 10

## Section 2
EOF

# Add 100 more lines
for i in {1..100}; do
  echo "This is line $i of additional content to make the note very long." >> /tmp/test_long_note.md
done

echo "✅ Created test note with ~115 lines"
echo

echo "📋 Test Plan:"
echo "1. Test obsidian_note read with large content"
echo "2. Test obsidian_note list with many notes"
echo "3. Test unified_search with many results"
echo
echo "After restarting the brain service, run these commands:"
echo
echo "# Test 1: Read large note without verbose"
echo 'obsidian_note { "action": "read", "identifier": "test_long_note" }'
echo
echo "# Test 2: Read large note WITH verbose"
echo 'obsidian_note { "action": "read", "identifier": "test_long_note", "verbose": true }'
echo
echo "# Test 3: List notes (if you have >50)"
echo 'obsidian_note { "action": "list" }'
echo
echo "# Test 4: Search with many results"
echo 'unified_search { "query": "the", "limit": 50 }'
echo
echo "# Test 5: Search with verbose"
echo 'unified_search { "query": "the", "limit": 50, "verbose": true }'
