#!/usr/bin/env node

const OutputFilter = require('./output-filter.js');

// Test the filter with a large git output
const testGitOutput = `
commit abc123def456789
Author: Test User <test@example.com>
Date: Mon Jul 26 2025

    Fix critical bug in output filtering

 12437 files changed, 1546755 insertions(+), 234567 deletions(-)
 
 src/file1.js | 123 +++
 src/file2.js | 456 ---
 src/file3.js | 789 +++
 ... (and 12434 more files)
${Array(12000).fill(0).map((_, i) => ` src/generated/file${i}.js | ${Math.floor(Math.random() * 1000)} +++`).join('\n')}
`;

console.log('Testing OutputFilter with large git output...\n');

const filter = new OutputFilter({ maxLines: 50, maxChars: 5000 });
const result = filter.filter(testGitOutput, 'git');

console.log('Filtered result:');
console.log(result.result);
console.log('\nMetadata:');
console.log(JSON.stringify(result.metadata, null, 2));

// Test with verbose mode
console.log('\n\nTesting with verbose mode...');
const verboseFilter = new OutputFilter({ verbose: true });
const verboseResult = verboseFilter.filter(testGitOutput, 'git');
console.log('Verbose output length:', verboseResult.result.length);
console.log('Filtered:', verboseResult.metadata.filtered);
