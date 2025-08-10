#!/usr/bin/env node
// System Documentation Audit - Find outdated and critical notes

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_PATH = '/Users/bard/Code/claude-brain/data/BrainVault';

// Critical system documentation patterns
const CRITICAL_PATTERNS = [
  // Core Brain System
  { pattern: /brain.*init/i, category: 'Brain Initialization' },
  { pattern: /brain.*manual/i, category: 'Brain Documentation' },
  { pattern: /brain.*architect/i, category: 'Brain Architecture' },
  { pattern: /brain.*state/i, category: 'Brain State Management' },
  
  // Boot and Startup
  { pattern: /boot.*loader/i, category: 'Boot Sequence' },
  { pattern: /boot.*sequence/i, category: 'Boot Sequence' },
  { pattern: /startup/i, category: 'Startup' },
  
  // Architecture
  { pattern: /master.*architect/i, category: 'Master Architecture' },
  { pattern: /system.*architect/i, category: 'System Architecture' },
  { pattern: /protocol.*index/i, category: 'Protocol Index' },
  
  // MCP and Tools
  { pattern: /mcp.*config/i, category: 'MCP Configuration' },
  { pattern: /tool.*registry/i, category: 'Tool Registry' },
  
  // Critical Instructions
  { pattern: /critical|important|mandatory/i, category: 'Critical Notes' },
  { pattern: /user.*preferences/i, category: 'User Configuration' },
  
  // Protocols
  { pattern: /protocol.*moc/i, category: 'Protocol Management' },
  { pattern: /master.*protocol/i, category: 'Protocol Management' }
];

// Find all markdown files
function getAllMarkdownFiles() {
  const result = execSync(
    `find "${VAULT_PATH}" -name "*.md" -type f`,
    { encoding: 'utf8' }
  ).trim().split('\n');
  return result.filter(f => f);
}

// Get file metadata
function getFileMetadata(filePath) {
  const stats = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Extract metadata from frontmatter if present
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let metadata = {};
  if (frontmatterMatch) {
    const lines = frontmatterMatch[1].split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        metadata[key.trim()] = valueParts.join(':').trim();
      }
    }
  }
  
  // Check for outdated markers
  const hasOutdatedMarker = /outdated|deprecated|obsolete|old|superseded/i.test(content);
  const hasCurrentMarker = /current|updated|active|latest/i.test(content);
  
  // Check for duplicate indicators
  const fileName = path.basename(filePath, '.md');
  const isDuplicate = fileName.includes('CORRECTED') || 
                     fileName.includes('OLD') || 
                     fileName.includes('COPY') ||
                     fileName.includes('backup') ||
                     filePath.includes('.bak');
  
  return {
    path: filePath,
    name: fileName,
    relativePath: filePath.replace(VAULT_PATH + '/', ''),
    created: stats.birthtime,
    modified: stats.mtime,
    size: stats.size,
    daysSinceModified: Math.floor((Date.now() - stats.mtime) / (1000 * 60 * 60 * 24)),
    metadata,
    hasOutdatedMarker,
    hasCurrentMarker,
    isDuplicate
  };
}

// Categorize file
function categorizeFile(fileInfo) {
  for (const rule of CRITICAL_PATTERNS) {
    if (rule.pattern.test(fileInfo.name)) {
      return rule.category;
    }
  }
  return null;
}

console.log('=== SYSTEM DOCUMENTATION AUDIT ===');
console.log(`Date: ${new Date().toISOString()}\n`);

// Get all files
const allFiles = getAllMarkdownFiles();
const systemDocs = [];
const duplicates = [];
const outdated = [];
const stale = []; // Not modified in 30+ days

// Analyze each file
for (const filePath of allFiles) {
  const fileInfo = getFileMetadata(filePath);
  const category = categorizeFile(fileInfo);
  
  if (category) {
    fileInfo.category = category;
    systemDocs.push(fileInfo);
    
    if (fileInfo.isDuplicate) {
      duplicates.push(fileInfo);
    }
    
    if (fileInfo.hasOutdatedMarker && !fileInfo.hasCurrentMarker) {
      outdated.push(fileInfo);
    }
    
    if (fileInfo.daysSinceModified > 30) {
      stale.push(fileInfo);
    }
  }
}

// Group by category
const byCategory = {};
for (const doc of systemDocs) {
  if (!byCategory[doc.category]) {
    byCategory[doc.category] = [];
  }
  byCategory[doc.category].push(doc);
}

// Sort each category by modified date (newest first)
for (const category in byCategory) {
  byCategory[category].sort((a, b) => b.modified - a.modified);
}

// Output results
console.log('=== CRITICAL SYSTEM DOCUMENTATION ===\n');

for (const [category, docs] of Object.entries(byCategory)) {
  console.log(`\n## ${category} (${docs.length} files)`);
  console.log('─'.repeat(50));
  
  for (const doc of docs) {
    const status = [];
    if (doc.isDuplicate) status.push('⚠️ DUPLICATE');
    if (doc.hasOutdatedMarker) status.push('⚠️ OUTDATED');
    if (doc.daysSinceModified > 30) status.push(`📅 ${doc.daysSinceModified}d old`);
    if (doc.daysSinceModified <= 7) status.push('✅ Recent');
    
    console.log(`  ${doc.name}`);
    console.log(`    Path: ${doc.relativePath}`);
    console.log(`    Modified: ${doc.modified.toISOString().split('T')[0]}`);
    if (status.length) {
      console.log(`    Status: ${status.join(', ')}`);
    }
  }
}

// Duplicates report
if (duplicates.length > 0) {
  console.log('\n\n=== ⚠️ DUPLICATE FILES DETECTED ===');
  console.log('These files appear to be duplicates or old versions:\n');
  for (const dup of duplicates) {
    console.log(`  - ${dup.relativePath}`);
  }
}

// Outdated report
if (outdated.length > 0) {
  console.log('\n\n=== ⚠️ OUTDATED FILES ===');
  console.log('These files contain outdated markers:\n');
  for (const old of outdated) {
    console.log(`  - ${old.relativePath}`);
  }
}

// Stale report
if (stale.length > 0) {
  console.log('\n\n=== 📅 STALE FILES (30+ days) ===');
  console.log('These critical files haven\'t been updated in over 30 days:\n');
  for (const s of stale) {
    console.log(`  - ${s.name} (${s.daysSinceModified} days)`);
  }
}

// Recommendations
console.log('\n\n=== RECOMMENDATIONS ===');
console.log('1. Review and update stale critical documentation');
console.log('2. Resolve duplicate files (keep most recent, archive others)');
console.log('3. Mark outdated files clearly or move to archive');
console.log('4. Ensure all critical paths are documented in Boot Loader Index');

// Save report
const report = {
  timestamp: new Date().toISOString(),
  stats: {
    totalSystemDocs: systemDocs.length,
    duplicates: duplicates.length,
    outdated: outdated.length,
    stale: stale.length
  },
  byCategory,
  duplicates: duplicates.map(d => d.relativePath),
  outdated: outdated.map(o => o.relativePath),
  stale: stale.map(s => ({ path: s.relativePath, days: s.daysSinceModified }))
};

const reportPath = `/Users/bard/Code/claude-brain/system-docs-audit-${Date.now()}.json`;
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nDetailed report saved to: ${reportPath}`);
