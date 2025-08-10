#!/bin/bash
# Simple vault analysis script that ELVIS can run

VAULT_PATH="/Users/bard/Code/claude-brain/data/BrainVault"
OUTPUT_FILE="/Users/bard/Code/claude-brain/vault-analysis-$(date +%Y%m%d-%H%M%S).txt"

echo "=== OBSIDIAN VAULT ANALYSIS ===" > $OUTPUT_FILE
echo "Vault: $VAULT_PATH" >> $OUTPUT_FILE
echo "Date: $(date)" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Count total notes
echo "=== STATISTICS ===" >> $OUTPUT_FILE
TOTAL_NOTES=$(find "$VAULT_PATH" -name "*.md" | wc -l)
echo "Total markdown files: $TOTAL_NOTES" >> $OUTPUT_FILE

# Find orphaned notes (simplified - notes not referenced in any other note)
echo "" >> $OUTPUT_FILE
echo "=== FINDING ORPHANED NOTES ===" >> $OUTPUT_FILE
echo "Checking which notes have no incoming links..." >> $OUTPUT_FILE

# Create a list of all note names
find "$VAULT_PATH" -name "*.md" | while read file; do
    basename "$file" .md
done > /tmp/all_notes.txt

# Find which notes are linked to
grep -r "\[\[" "$VAULT_PATH" --include="*.md" | grep -o '\[\[[^]]*\]\]' | sed 's/\[\[\([^]|]*\).*/\1/' | sort | uniq > /tmp/linked_notes.txt

# Find orphans
echo "" >> $OUTPUT_FILE
echo "=== ORPHANED NOTES (no incoming links) ===" >> $OUTPUT_FILE
comm -23 <(sort /tmp/all_notes.txt) <(sort /tmp/linked_notes.txt) >> $OUTPUT_FILE

# Find hub notes (notes with many outgoing links)
echo "" >> $OUTPUT_FILE
echo "=== HUB NOTES (10+ outgoing links) ===" >> $OUTPUT_FILE
find "$VAULT_PATH" -name "*.md" | while read file; do
    count=$(grep -o '\[\[' "$file" | wc -l)
    if [ $count -ge 10 ]; then
        echo "$(basename "$file" .md): $count links" >> $OUTPUT_FILE
    fi
done

echo "" >> $OUTPUT_FILE
echo "=== ANALYSIS COMPLETE ===" >> $OUTPUT_FILE
echo "Output saved to: $OUTPUT_FILE" >> $OUTPUT_FILE

# Also print the location
echo "Analysis complete! Results saved to:"
echo "$OUTPUT_FILE"