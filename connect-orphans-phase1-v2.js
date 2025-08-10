#!/usr/bin/env node
// Phase 1 V2: Connect orphaned notes to their obvious hubs
// Enhanced to find notes in subdirectories

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_PATH = '/Users/bard/Code/claude-brain/data/BrainVault';

// Connection rules for Phase 1 (easy wins)
const connectionRules = [
  {
    pattern: /^arc[_\s-]/i,
    hub: 'ARC Project Hub',
    description: 'ARC Project notes'
  },
  {
    pattern: /^brain[_\s-]/i,
    hub: 'Brain System MOC',
    description: 'Brain system notes'
  },
  {
    pattern: /protocol/i,
    hub: 'Protocols MOC',
    description: 'Protocol-related notes'
  },
  {
    pattern: /^medical[_\s-]|health[_\s-]|thyro|cancer/i,
    hub: 'Health & Medical Notes Index',
    description: 'Medical and health notes'
  },
  {
    pattern: /^mcp[_\s-]/i,
    hub: 'MCP Infrastructure Group',
    description: 'MCP tool notes'
  },
  {
    pattern: /^project[_\s-]/i,
    hub: 'Projects MOC',
    description: 'Project notes'
  },
  {
    pattern: /diary|captain.*log/i,
    hub: 'Personal Diary Hub',
    description: 'Personal diary entries'
  },
  {
    pattern: /philosophy|consciousness|theory|dimensional|centrum/i,
    hub: 'Philosophy & Consciousness Hub',
    description: 'Philosophy and consciousness notes'
  },
  {
    pattern: /^claude[_\s-]/i,
    hub: 'Claude Identity & Development',
    description: 'Claude-related notes'
  },
  {
    pattern: /^mikey[_\s-]|dr[_\s]b/i,
    hub: 'Personal Diary Hub',
    description: 'Personal notes'
  },
  {
    pattern: /^ai[_\s-]/i,
    hub: 'AI_Perspectives_Index',
    description: 'AI perspectives and discussions'
  }
];

// Function to find a note file in the vault (checks subdirectories)
function findNoteFile(noteName) {
  try {
    const result = execSync(
      `find "${VAULT_PATH}" -name "${noteName}.md" -type f 2>/dev/null | head -1`,
      { encoding: 'utf8' }
    ).trim();
    return result || null;
  } catch (error) {
    return null;
  }
}

// Read the latest analysis file
const analysisFile = '/Users/bard/Code/claude-brain/vault-analysis-20250809-142600.txt';
const analysisContent = fs.readFileSync(analysisFile, 'utf8');

// Better parsing of orphaned notes
const lines = analysisContent.split('\n');
let orphanedNotes = [];
let inOrphanSection = false;

for (const line of lines) {
  if (line.includes('=== ORPHANED NOTES')) {
    inOrphanSection = true;
    continue;
  }
  
  if (inOrphanSection) {
    if (line.includes('=== HUB NOTES') || line.includes('=== ANALYSIS COMPLETE')) {
      break;
    }
    
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('===')) {
      orphanedNotes.push(trimmed);
    }
  }
}

console.log(`Found ${orphanedNotes.length} orphaned notes to process\n`);

let connectionsAdded = 0;
let processedNotes = [];
let skippedNotes = [];
let notFoundNotes = [];

// First, ensure hub notes exist or create them
const hubsToCreate = [
  { name: 'Personal Diary Hub', description: 'Central hub for personal diary entries and captains logs' },
  { name: 'Philosophy & Consciousness Hub', description: 'Central hub for philosophy, consciousness, and theory discussions' },
  { name: 'Claude Identity & Development', description: 'Hub for Claude-related notes and development' }
];

for (const hub of hubsToCreate) {
  const hubPath = path.join(VAULT_PATH, `${hub.name}.md`);
  if (!fs.existsSync(hubPath)) {
    const hubContent = `# ${hub.name}

${hub.description}

## Connected Notes

This hub was created by the automated organization system to connect related orphaned notes.

---
## Links
- [[Master Note Index]]
- [[🗺️ Vault Organization Map (MOC)]]
`;
    fs.writeFileSync(hubPath, hubContent);
    console.log(`✅ Created new hub: ${hub.name}`);
  }
}

// Process each orphaned note
console.log('\nProcessing orphaned notes...\n');
for (const noteName of orphanedNotes) {
  // Find matching rule
  const matchingRule = connectionRules.find(rule => rule.pattern.test(noteName));
  
  if (matchingRule) {
    // Try to find the note file (could be in a subdirectory)
    const notePath = findNoteFile(noteName);
    
    if (notePath) {
      try {
        let content = fs.readFileSync(notePath, 'utf8');
        
        // Check if the hub link already exists
        if (!content.includes(`[[${matchingRule.hub}]]`)) {
          // Add the hub link at the bottom of the file
          let linkSection = '';
          
          // Check if there's already a Connections section
          if (content.includes('## Connections')) {
            // Add to existing connections section
            linkSection = `\n- [[${matchingRule.hub}]] - Connected via automated organization`;
            content = content.replace(/(## Connections[\s\S]*?)(\n##|\n---|$)/, `$1${linkSection}$2`);
          } else {
            // Add new connections section
            linkSection = `\n\n---\n## Connections\n- [[${matchingRule.hub}]] - Connected via automated organization\n`;
            content += linkSection;
          }
          
          fs.writeFileSync(notePath, content);
          
          console.log(`✓ Connected "${noteName}" → [[${matchingRule.hub}]]`);
          connectionsAdded++;
          processedNotes.push({ 
            note: noteName, 
            hub: matchingRule.hub,
            path: notePath.replace(VAULT_PATH + '/', '')
          });
        } else {
          skippedNotes.push(noteName);
        }
      } catch (error) {
        console.error(`✗ Error processing "${noteName}": ${error.message}`);
      }
    } else {
      notFoundNotes.push(noteName);
    }
  } else {
    // No matching rule for this note
    console.log(`⚠ No rule matches: "${noteName}"`);
  }
}

console.log(`\n=== PHASE 1 COMPLETE ===`);
console.log(`Total orphaned notes: ${orphanedNotes.length}`);
console.log(`Connections added: ${connectionsAdded}`);
console.log(`Notes processed: ${processedNotes.length}`);
console.log(`Notes skipped (already linked): ${skippedNotes.length}`);
console.log(`Notes not found on disk: ${notFoundNotes.length}`);
console.log(`Orphans with no matching rule: ${orphanedNotes.length - processedNotes.length - skippedNotes.length - notFoundNotes.length}`);

// Group processed notes by hub for summary
const byHub = {};
processedNotes.forEach(p => {
  if (!byHub[p.hub]) byHub[p.hub] = [];
  byHub[p.hub].push(p.note);
});

console.log('\n=== CONNECTIONS BY HUB ===');
Object.entries(byHub).forEach(([hub, notes]) => {
  console.log(`${hub}: ${notes.length} notes connected`);
});

// Save a detailed report
const reportPath = '/Users/bard/Code/claude-brain/phase1-connections-report-v2.json';
fs.writeFileSync(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  stats: {
    totalOrphans: orphanedNotes.length,
    connectionsAdded,
    processedCount: processedNotes.length,
    skippedCount: skippedNotes.length,
    notFoundCount: notFoundNotes.length
  },
  processedNotes,
  skippedNotes,
  notFoundNotes,
  orphansRemaining: orphanedNotes.filter(n => 
    !processedNotes.find(p => p.note === n) && 
    !skippedNotes.includes(n) && 
    !notFoundNotes.includes(n)
  ),
  byHub
}, null, 2));

console.log(`\nReport saved to: ${reportPath}`);

// Save progress to Brain state
console.log('\n📊 Saving progress to Brain state...');
