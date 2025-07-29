#!/usr/bin/env python3
"""
Test Phase 3 Output Filtering Implementation
"""
import sys
import json
sys.path.insert(0, '/Users/bard/Code/claude-brain')

from obsidian_integration.obsidian_note import ObsidianNote

# Initialize the tool
vault_path = "/Users/bard/Code/claude-brain/data/BrainVault"
note_tool = ObsidianNote(vault_path=vault_path)

print("🧪 Testing Phase 3 Output Filtering")
print("===================================\n")

# Test 1: List notes to see our test note
print("Test 1: List notes")
print("-----------------")
try:
    result = note_tool.list_notes()
    notes = result.get('notes', [])
    test_notes = [n for n in notes if 'Test' in n['identifier']]
    print(f"Found {len(test_notes)} test notes")
    for note in test_notes[:5]:
        print(f"  - {note['identifier']}")
except Exception as e:
    print(f"Error listing notes: {e}")

print("\n")

# Test 2: Read the long test note
print("Test 2: Read long test note")
print("---------------------------")
try:
    result = note_tool.read("Test Output Filter Long Note")
    if result:
        content = result.get('content', '')
        lines = content.split('\n')
        print(f"✅ Read successful!")
        print(f"  - Title: {result.get('title', 'N/A')}")
        print(f"  - Total lines: {len(lines)}")
        print(f"  - Total characters: {len(content)}")
        print(f"  - First 3 lines:")
        for i, line in enumerate(lines[:3]):
            print(f"    {i+1}: {line[:80]}...")
    else:
        print("❌ Note not found")
except Exception as e:
    print(f"Error reading note: {e}")

print("\n")

# Test 3: Create a short note for comparison
print("Test 3: Create short test note")
print("------------------------------")
try:
    short_content = """# Short Test Note

This is a short note that should not trigger filtering.

## Content
- Line 1
- Line 2
- Line 3
- Line 4
- Line 5

## Summary
This note has less than 20 lines total."""

    result = note_tool.create(
        title="Test Short Note for Filtering",
        content=short_content
    )
    print(f"✅ Created short note: {result.get('title', 'N/A')}")
    print(f"  - Path: {result.get('path', 'N/A')}")
except Exception as e:
    print(f"Error creating short note: {e}")

print("\n")
print("✅ Tests complete!")
print("\nNote: The actual filtering happens in the MCP handler,")
print("not in the Python code. These tests verify the notes exist")
print("and can be accessed for the filtering tests.")
