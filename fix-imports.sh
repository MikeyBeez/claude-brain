#!/bin/bash
cd /Users/bard/Code/claude-brain

# Fix the import line
sed -i '' '34s|.*|import crypto from '"'"'crypto'"'"';|' index.js

# Add the OutputFilter import on the next line
sed -i '' '34a\
import { OutputFilter, detectCommandType } from '"'"'./output-filter-esm.js'"'"';' index.js

echo "Fixed imports in index.js"
