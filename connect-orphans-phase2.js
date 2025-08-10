#!/usr/bin/env node
// Phase 2: Connect remaining orphaned notes with expanded rules
// This handles the 185 notes that didn't match Phase 1 rules

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_PATH = '/Users/bard/Code/claude-brain/data/BrainVault';

// Load the remaining orphans from Phase 1 report
const phase1Report = JSON.parse(
  fs.readFileSync('/Users/bard/Code/claude-brain/phase1-connections-report-v2.json', 'utf8')
);

const remainingOrphans = phase1Report.orphansRemaining;

console.log(`Phase 2: Processing ${remainingOrphans.length} remaining orphans\n`);

// Expanded connection rules for Phase 2
const phase2Rules = [
  // Date-based notes
  {
    pattern: /^2025-\d{2}-\d{2}/,
    hub: 'System Updates & Changelogs',
    description: 'Date-stamped system updates'
  },
  // Emoji-prefixed notes (these are actually group/hub notes)
  {
    pattern: /^[🔧📋🧠🤖📁📊🗺️🚨🔔🔗🏷️🌟]/,
    hub: '🔗 Cross-Group Navigation & Relationship Map',
    description: 'Group hub notes'
  },
  // Implementation and planning notes
  {
    pattern: /implementation|plan|design|architecture|specification|roadmap/i,
    hub: 'Technical Documentation Hub',
    description: 'Technical implementation docs'
  },
  // Story and creative content
  {
    pattern: /story|donghua|hanli|trickster|wolfram/i,
    hub: 'Creative Writing & Stories',
    description: 'Creative and story content'
  },
  // Monitoring and execution notes
  {
    pattern: /monitex|execution|monitor/i,
    hub: 'System Monitoring & Execution',
    description: 'Monitoring and execution notes'
  },
  // System and configuration notes
  {
    pattern: /system|config|setup|inventory|registry/i,
    hub: 'System Configuration & Setup',
    description: 'System configuration notes'
  },
  // Analysis and reports
  {
    pattern: /analysis|report|audit|findings|analyzer/i,
    hub: 'Analysis & Reports Hub',
    description: 'Analysis and report documents'
  },
  // Personal and philosophical notes
  {
    pattern: /personal|mikey|human|trust|philosophy/i,
    hub: 'Philosophy & Consciousness Hub',
    description: 'Personal and philosophical notes'
  },
  // Error and maintenance notes
  {
    pattern: /error|maintenance|alert|fix/i,
    hub: 'Maintenance & Error Logs',
    description: 'Error and maintenance logs'
  },
  // Project overview notes
  {
    pattern: /overview|summary|index|catalogue/i,
    hub: 'Master Note Index',
    description: 'Overview and index notes'
  },
  // Development and code notes
  {
    pattern: /code|usage|rtx|gpu/i,
    hub: 'Development & Code Resources',
    description: 'Development resources'
  },
  // Identity and insights
  {
    pattern: /identity|insight|discovery|vision/i,
    hub: 'Insights & Identity Notes',
    description: 'Identity and insight notes'
  },
  // Test and validation notes
  {
    pattern: /test|accuracy|check/i,
    hub: 'Testing & Validation',
    description: 'Test and validation notes'
  },
  // Generic catch-all for remaining investigation/doc notes
  {
    pattern: /investigation|documentation|docs|guide/i,
    hub: 'Documentation & Guides',
    description: 'Documentation and guides'
  }
];

// Function to find a note file in the vault
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

// Create hub notes that don't exist
const hubsToCreate = [
  { name: 'System Updates & Changelogs', description: 'Central hub for date-stamped system updates and changelogs' },
  { name: 'Technical Documentation Hub', description: 'Hub for technical implementation documentation' },
  { name: 'Creative Writing & Stories', description: 'Hub for creative writing and story content' },
  { name: 'System Monitoring & Execution', description: 'Hub for system monitoring and execution notes' },
  { name: 'System Configuration & Setup', description: 'Hub for system configuration and setup notes' },
  { name: 'Analysis & Reports Hub', description: 'Hub for analysis results and reports' },
  { name: 'Maintenance & Error Logs', description: 'Hub for error logs and maintenance notes' },
  { name: 'Development & Code Resources', description: 'Hub for development and code-related resources' },
  { name: 'Insights & Identity Notes', description: 'Hub for insights and identity-related notes' },
  { name: 'Testing & Validation', description: 'Hub for testing and validation notes' },
  { name: 'Documentation & Guides', description: 'Hub for general documentation and guides' }
];

console.log('Creating new hub notes if needed...\n');
for (const hub of hubsToCreate) {
  const hubPath = path.join(VAULT_PATH, `${hub.name}.md`);
  if (!fs.existsSync(hubPath)) {
    const hubContent = `# ${hub.name}

${hub.description}

## Connected Notes

This hub was created by the automated organization system (Phase 2) to connect related orphaned notes.

---
## Links
- [[Master Note Index]]
- [[🗺️ Vault Organization Map (MOC)]]
- [[🔗 Cross-Group Navigation & Relationship Map]]
`;
    fs.writeFileSync(hubPath, hubContent);
    console.log(`✅ Created new hub: ${hub.name}`);
  }
}

// Process remaining orphans
let connectionsAdded = 0;
let processedNotes = [];
let stillUnmatched = [];
let notFoundNotes = [];

console.log('\nProcessing remaining orphans with Phase 2 rules...\n');

for (const noteName of remainingOrphans) {
  // Try each rule in order
  let matched = false;
  
  for (const rule of phase2Rules) {
    if (rule.pattern.test(noteName)) {
      const notePath = findNoteFile(noteName);
      
      if (notePath) {
        try {
          let content = fs.readFileSync(notePath, 'utf8');
          
          // Check if the hub link already exists
          if (!content.includes(`[[${rule.hub}]]`)) {
            // Add the hub link
            let linkSection = '';
            
            if (content.includes('## Connections')) {
              linkSection = `\n- [[${rule.hub}]] - Connected via Phase 2 organization`;
              content = content.replace(/(## Connections[\s\S]*?)(\n##|\n---|$)/, `$1${linkSection}$2`);
            } else {
              linkSection = `\n\n---\n## Connections\n- [[${rule.hub}]] - Connected via Phase 2 organization\n`;
              content += linkSection;
            }
            
            fs.writeFileSync(notePath, content);
            
            console.log(`✓ Connected "${noteName}" → [[${rule.hub}]]`);
            connectionsAdded++;
            processedNotes.push({ 
              note: noteName, 
              hub: rule.hub,
              rule: rule.description
            });
            matched = true;
            break; // Stop checking rules once matched
          } else {
            console.log(`⚠ "${noteName}" already linked to ${rule.hub}`);
            matched = true;
            break;
          }
        } catch (error) {
          console.error(`✗ Error processing "${noteName}": ${error.message}`);
        }
      } else {
        notFoundNotes.push(noteName);
        matched = true;
        break;
      }
    }
  }
  
  if (!matched) {
    stillUnmatched.push(noteName);
    console.log(`❓ No Phase 2 rule matches: "${noteName}"`);
  }
}

// Summary
console.log(`\n=== PHASE 2 COMPLETE ===`);
console.log(`Orphans to process: ${remainingOrphans.length}`);
console.log(`Connections added: ${connectionsAdded}`);
console.log(`Notes processed: ${processedNotes.length}`);
console.log(`Still unmatched: ${stillUnmatched.length}`);
console.log(`Not found on disk: ${notFoundNotes.length}`);

// Group by hub
const byHub = {};
processedNotes.forEach(p => {
  if (!byHub[p.hub]) byHub[p.hub] = [];
  byHub[p.hub].push(p.note);
});

console.log('\n=== PHASE 2 CONNECTIONS BY HUB ===');
Object.entries(byHub).forEach(([hub, notes]) => {
  console.log(`${hub}: ${notes.length} notes`);
});

if (stillUnmatched.length > 0) {
  console.log('\n=== STILL UNMATCHED (Need manual review) ===');
  stillUnmatched.forEach(note => console.log(`  - ${note}`));
}

// Save Phase 2 report
const reportPath = '/Users/bard/Code/claude-brain/phase2-connections-report.json';
fs.writeFileSync(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  phase: 2,
  stats: {
    inputOrphans: remainingOrphans.length,
    connectionsAdded,
    processedCount: processedNotes.length,
    stillUnmatched: stillUnmatched.length,
    notFoundCount: notFoundNotes.length
  },
  processedNotes,
  stillUnmatched,
  notFoundNotes,
  byHub
}, null, 2));

console.log(`\nPhase 2 report saved to: ${reportPath}`);

// Calculate final stats
const phase1Stats = phase1Report.stats;
const totalOrphansOriginal = phase1Stats.totalOrphans;
const totalConnected = phase1Stats.skippedCount + connectionsAdded;
const finalOrphanCount = stillUnmatched.length;
const finalOrphanRate = (finalOrphanCount / 683) * 100;

console.log('\n=== FINAL VAULT ORGANIZATION STATS ===');
console.log(`Original orphans: ${totalOrphansOriginal}`);
console.log(`Already connected (Phase 1): ${phase1Stats.skippedCount}`);
console.log(`Connected in Phase 2: ${connectionsAdded}`);
console.log(`Total connected: ${totalConnected}`);
console.log(`Remaining orphans: ${finalOrphanCount}`);
console.log(`Final orphan rate: ${finalOrphanRate.toFixed(1)}%`);
console.log(`Target orphan rate: 30%`);
console.log(`SUCCESS: ${finalOrphanRate < 30 ? '✅ Target achieved!' : '❌ More work needed'}`);
