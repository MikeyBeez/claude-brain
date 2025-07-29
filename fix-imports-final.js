#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the file
const indexPath = path.join(__dirname, 'index.js');
let content = fs.readFileSync(indexPath, 'utf8');

// Fix the malformed import line
const badLine = "import { OutputFilter, detectCommandType } from ./output-filter-esm.js;import crypto from 'crypto';";
const goodLines = `import crypto from 'crypto';
import { OutputFilter, detectCommandType } from './output-filter-esm.js';`;

content = content.replace(badLine, goodLines);

// Write back
fs.writeFileSync(indexPath, content);
console.log('Fixed the import statements in index.js');
