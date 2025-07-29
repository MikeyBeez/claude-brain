#!/bin/bash
cd /Users/bard/Code/claude-brain

# Create a temporary file with the fixed line 34
echo "import crypto from 'crypto';" > temp_line34.txt
echo "import { OutputFilter, detectCommandType } from './output-filter-esm.js';" >> temp_line34.txt

# Extract the file in parts
head -33 index.js > index_fixed.js
cat temp_line34.txt >> index_fixed.js
tail -n +35 index.js >> index_fixed.js

# Replace the original
mv index.js index.js.broken-imports
mv index_fixed.js index.js

# Clean up
rm temp_line34.txt

echo "Fixed imports in index.js"
