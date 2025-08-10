#!/usr/bin/env node
// Enhanced vault analysis that checks both incoming and outgoing connections

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_PATH = '/Users/bard/Code/claude-brain/data/BrainVault';

console.log('=== ENHANCED VAULT ANALYSIS ===');
console.log(`Vault: ${VAULT_PATH}`);
console.log(`Date: ${new Date().toISOString()}\n`);

// Get all markdown files
const getAllMarkdownFiles = () => {
  const result = execSync(
    `find "${VAULT_PATH}" -name "*.md" -type f`,
    { encoding: 'utf8' }
  ).trim().split('\n');
  return result.filter(f => f);
};

// Extract note name from path
const getNoteNameFromPath = (filePath) => {
  return path.basename(filePath, '.md');
};

// Extract all links from a file
const extractLinks = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const linkPattern = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;
    const links = [];
    let match;
    while ((match = linkPattern.exec(content)) !== null) {
      links.push(match[1].trim());
    }
    return links;
  } catch (error) {
    return [];
  }
};

// Analyze the vault
console.log('Scanning all notes...');
const allFiles = getAllMarkdownFiles();
console.log(`Total markdown files: ${allFiles.length}\n`);

// Build connection maps
const outgoingLinks = {}; // note -> [notes it links to]
const incomingLinks = {}; // note -> [notes that link to it]
const noteExists = new Set();

// Process all files
for (const filePath of allFiles) {
  const noteName = getNoteNameFromPath(filePath);
  noteExists.add(noteName);
  
  const links = extractLinks(filePath);
  outgoingLinks[noteName] = links;
  
  // Update incoming links for linked notes
  for (const linkedNote of links) {
    if (!incomingLinks[linkedNote]) {
      incomingLinks[linkedNote] = [];
    }
    incomingLinks[linkedNote].push(noteName);
  }
}

// Find true orphans (no incoming OR outgoing links)
const trueOrphans = [];
const noIncomingLinks = [];
const noOutgoingLinks = [];
const wellConnected = [];

for (const noteName of noteExists) {
  const hasIncoming = incomingLinks[noteName] && incomingLinks[noteName].length > 0;
  const hasOutgoing = outgoingLinks[noteName] && outgoingLinks[noteName].length > 0;
  
  if (!hasIncoming && !hasOutgoing) {
    trueOrphans.push(noteName);
  } else if (!hasIncoming) {
    noIncomingLinks.push(noteName);
  } else if (!hasOutgoing) {
    noOutgoingLinks.push(noteName);
  } else {
    wellConnected.push(noteName);
  }
}

// Find hub notes (many incoming or outgoing links)
const hubNotes = [];
for (const noteName of noteExists) {
  const inCount = (incomingLinks[noteName] || []).length;
  const outCount = (outgoingLinks[noteName] || []).length;
  const totalConnections = inCount + outCount;
  
  if (totalConnections >= 10) {
    hubNotes.push({
      name: noteName,
      incoming: inCount,
      outgoing: outCount,
      total: totalConnections
    });
  }
}

// Sort hubs by total connections
hubNotes.sort((a, b) => b.total - a.total);

// Output results
console.log('=== CONNECTION STATISTICS ===');
console.log(`Well connected (both in & out): ${wellConnected.length} (${(wellConnected.length/allFiles.length*100).toFixed(1)}%)`);
console.log(`Only outgoing links: ${noIncomingLinks.length} (${(noIncomingLinks.length/allFiles.length*100).toFixed(1)}%)`);
console.log(`Only incoming links: ${noOutgoingLinks.length} (${(noOutgoingLinks.length/allFiles.length*100).toFixed(1)}%)`);
console.log(`TRUE ORPHANS (no links): ${trueOrphans.length} (${(trueOrphans.length/allFiles.length*100).toFixed(1)}%)`);

console.log('\n=== TRUE ORPHANS (No connections at all) ===');
if (trueOrphans.length === 0) {
  console.log('None! Every note has at least one connection.');
} else {
  trueOrphans.slice(0, 50).forEach(note => console.log(`  - ${note}`));
  if (trueOrphans.length > 50) {
    console.log(`  ... and ${trueOrphans.length - 50} more`);
  }
}

console.log('\n=== TOP 20 HUB NOTES ===');
hubNotes.slice(0, 20).forEach(hub => {
  console.log(`  ${hub.name}: ${hub.total} connections (${hub.incoming} in, ${hub.outgoing} out)`);
});

// Save detailed report
const report = {
  timestamp: new Date().toISOString(),
  stats: {
    totalNotes: allFiles.length,
    wellConnected: wellConnected.length,
    onlyOutgoing: noIncomingLinks.length,
    onlyIncoming: noOutgoingLinks.length,
    trueOrphans: trueOrphans.length,
    trueOrphanRate: (trueOrphans.length/allFiles.length*100).toFixed(1) + '%'
  },
  trueOrphans,
  noIncomingLinks: noIncomingLinks.slice(0, 20),
  hubNotes: hubNotes.slice(0, 20)
};

const reportPath = `/Users/bard/Code/claude-brain/enhanced-vault-analysis-${Date.now()}.json`;
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`\n=== ANALYSIS COMPLETE ===`);
console.log(`Detailed report saved to: ${reportPath}`);

// Final summary
console.log('\n📊 VAULT HEALTH SUMMARY:');
if (trueOrphans.length === 0) {
  console.log('✅ PERFECT! No true orphans in the vault!');
} else if (trueOrphans.length < 50) {
  console.log(`✅ EXCELLENT! Only ${trueOrphans.length} true orphans (${report.stats.trueOrphanRate})`);
} else {
  console.log(`⚠️ ${trueOrphans.length} true orphans need attention (${report.stats.trueOrphanRate})`);
}
