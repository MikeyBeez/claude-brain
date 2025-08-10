#!/usr/bin/env node

/**
 * Ollama-Based Vault Analysis System
 * Semantic analysis of Obsidian vault using local LLMs
 */

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// Configuration
const VAULT_PATH = process.env.BRAIN_VAULT_PATH || '/Users/bard/Code/claude-brain/data/BrainVault';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const BATCH_SIZE = 10;
const OUTPUT_DIR = path.join(VAULT_PATH, '.analysis');

// Analysis state
let analysisState = {
    vaultPath: VAULT_PATH,
    totalNotes: 0,
    analyzedNotes: 0,
    orphanedNotes: [],
    hubNotes: [],
    connections: [],
    categories: {},
    progress: 0,
    startTime: null,
    errors: []
};

/**
 * Call Ollama API with a prompt
 */
async function callOllama(prompt, system = "You are a knowledge graph analyst.") {
    try {
        const fullPrompt = `${system}\n\n${prompt}`;
        const escapedPrompt = fullPrompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
        
        const { stdout } = await execAsync(
            `curl -s http://localhost:11434/api/generate -d '{"model": "${MODEL}", "prompt": "${escapedPrompt}", "stream": false, "format": "json"}'`
        );
        
        const response = JSON.parse(stdout);
        const content = response.response;
        
        // Try to parse as JSON if it looks like JSON
        if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
            try {
                return JSON.parse(content);
            } catch {
                return content;
            }
        }
        return content;
    } catch (error) {
        console.error('Ollama API error:', error.message);
        throw error;
    }
}

/**
 * Scan vault for markdown files
 */
async function scanVault(vaultPath) {
    const files = [];
    
    async function scan(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            // Skip hidden directories and special folders
            if (entry.name.startsWith('.') || entry.name === 'node_modules') {
                continue;
            }
            
            if (entry.isDirectory()) {
                await scan(fullPath);
            } else if (entry.name.endsWith('.md')) {
                files.push(fullPath);
            }
        }
    }
    
    await scan(vaultPath);
    return files;
}

/**
 * Extract links from markdown content
 */
function extractLinks(content) {
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    const links = [];
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
        const linkText = match[1].split('|')[0].trim();
        links.push(linkText);
    }
    
    return [...new Set(links)];
}

/**
 * Analyze a single note with Ollama
 */
async function analyzeNote(filePath, content) {
    const fileName = path.basename(filePath, '.md');
    const links = extractLinks(content);
    
    // Skip very short notes
    if (content.length < 50) {
        return {
            path: filePath,
            name: fileName,
            links: links,
            category: 'snippet',
            topics: [],
            suggestedConnections: []
        };
    }
    
    const prompt = `Analyze this note and return JSON with: category (string), topics (array), and suggestedConnections (array of note titles it should link to).

Note title: "${fileName}"
Content (first 500 chars): "${content.substring(0, 500).replace(/"/g, '\\"')}"

Return ONLY valid JSON, no explanation.`;

    try {
        const analysis = await callOllama(prompt);
        
        return {
            path: filePath,
            name: fileName,
            links: links,
            category: analysis.category || 'uncategorized',
            topics: analysis.topics || [],
            suggestedConnections: analysis.suggestedConnections || []
        };
    } catch (error) {
        console.error(`Failed to analyze ${fileName}:`, error.message);
        return {
            path: filePath,
            name: fileName,
            links: links,
            category: 'error',
            topics: [],
            suggestedConnections: []
        };
    }
}

/**
 * Process notes in batches
 */
async function processNotes(files) {
    const results = [];
    
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(async (file) => {
                const content = await fs.readFile(file, 'utf-8');
                return analyzeNote(file, content);
            })
        );
        
        results.push(...batchResults);
        
        // Update progress
        analysisState.analyzedNotes = Math.min(i + BATCH_SIZE, files.length);
        analysisState.progress = Math.round((analysisState.analyzedNotes / analysisState.totalNotes) * 100);
        
        console.log(`Progress: ${analysisState.progress}% (${analysisState.analyzedNotes}/${analysisState.totalNotes})`);
    }
    
    return results;
}

/**
 * Identify orphaned notes (no incoming links)
 */
function findOrphanedNotes(notes) {
    const allNoteNames = new Set(notes.map(n => n.name));
    const notesWithIncomingLinks = new Set();
    
    // Find all notes that are linked to
    for (const note of notes) {
        for (const link of note.links) {
            if (allNoteNames.has(link)) {
                notesWithIncomingLinks.add(link);
            }
        }
    }
    
    // Find orphans
    return notes.filter(note => !notesWithIncomingLinks.has(note.name));
}

/**
 * Identify hub notes (many connections)
 */
function findHubNotes(notes) {
    const connectionCounts = new Map();
    
    // Count incoming links
    for (const note of notes) {
        for (const link of note.links) {
            connectionCounts.set(link, (connectionCounts.get(link) || 0) + 1);
        }
    }
    
    // Add outgoing link counts
    for (const note of notes) {
        const incomingCount = connectionCounts.get(note.name) || 0;
        const outgoingCount = note.links.length;
        connectionCounts.set(note.name, incomingCount + outgoingCount);
    }
    
    // Find hubs (notes with 10+ connections)
    return Array.from(connectionCounts.entries())
        .filter(([_, count]) => count >= 10)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, connections: count }));
}

/**
 * Generate connection suggestions using Ollama
 */
async function generateConnectionSuggestions(orphans, hubs, allNotes) {
    const suggestions = [];
    
    // For each orphan, find potential connections
    for (const orphan of orphans.slice(0, 20)) { // Limit to first 20 orphans for now
        const prompt = `Given this orphaned note, suggest which hub notes it should connect to.

Orphan: "${orphan.name}"
Topics: ${orphan.topics.join(', ')}
Category: ${orphan.category}

Available hubs: ${hubs.slice(0, 10).map(h => h.name).join(', ')}

Return JSON array of suggested connections with confidence scores (0-1).`;

        try {
            const result = await callOllama(prompt);
            if (Array.isArray(result)) {
                suggestions.push({
                    orphan: orphan.name,
                    suggestions: result
                });
            }
        } catch (error) {
            console.error(`Failed to generate suggestions for ${orphan.name}`);
        }
    }
    
    return suggestions;
}

/**
 * Save analysis results
 */
async function saveResults(results) {
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Save main analysis
    const outputPath = path.join(OUTPUT_DIR, `analysis-${Date.now()}.json`);
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    
    // Save summary report
    const reportPath = path.join(OUTPUT_DIR, 'latest-report.md');
    const report = generateReport(results);
    await fs.writeFile(reportPath, report);
    
    console.log(`\n✅ Results saved to: ${outputPath}`);
    console.log(`📊 Report saved to: ${reportPath}`);
}

/**
 * Generate markdown report
 */
function generateReport(results) {
    const { notes, orphans, hubs, suggestions, categories, duration } = results;
    
    return `# Vault Analysis Report

**Date**: ${new Date().toISOString()}
**Vault**: ${VAULT_PATH}
**Model**: ${MODEL}

## Summary
- **Total Notes**: ${notes.length}
- **Orphaned Notes**: ${orphans.length} (${Math.round(orphans.length / notes.length * 100)}%)
- **Hub Notes**: ${hubs.length}
- **Analysis Time**: ${duration}ms

## Categories
${Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => `- ${cat}: ${count} notes`)
    .join('\n')}

## Top Hub Notes
${hubs.slice(0, 10)
    .map(h => `- **${h.name}**: ${h.connections} connections`)
    .join('\n')}

## Orphaned Notes (Sample)
${orphans.slice(0, 20)
    .map(o => `- ${o.name} (${o.category})`)
    .join('\n')}

## Connection Suggestions
${suggestions.slice(0, 10)
    .map(s => `### ${s.orphan}\n${s.suggestions
        .map(sugg => `  - Connect to: ${sugg.hub || sugg.target || 'Unknown'} (confidence: ${sugg.confidence || 'N/A'})`)
        .join('\n')}`)
    .join('\n\n')}

## Next Steps
1. Review connection suggestions
2. Implement high-confidence connections (>0.8)
3. Create new hub notes for emerging clusters
4. Re-run analysis after changes
`;
}

/**
 * Main analysis function
 */
async function analyzeVault() {
    console.log('🔍 Ollama Vault Analysis System');
    console.log(`📁 Vault: ${VAULT_PATH}`);
    console.log(`🤖 Model: ${MODEL}`);
    console.log('-----------------------------------\n');
    
    analysisState.startTime = Date.now();
    
    try {
        // Check Ollama is running
        console.log('Checking Ollama status...');
        await execAsync('ollama list');
        console.log('✅ Ollama is running\n');
        
        // Scan vault
        console.log('Scanning vault for markdown files...');
        const files = await scanVault(VAULT_PATH);
        analysisState.totalNotes = files.length;
        console.log(`Found ${files.length} notes\n`);
        
        // Analyze notes
        console.log('Analyzing notes with Ollama...');
        const notes = await processNotes(files);
        
        // Find orphans and hubs
        console.log('\nIdentifying orphans and hubs...');
        const orphans = findOrphanedNotes(notes);
        const hubs = findHubNotes(notes);
        
        analysisState.orphanedNotes = orphans;
        analysisState.hubNotes = hubs;
        
        // Count categories
        const categories = {};
        for (const note of notes) {
            categories[note.category] = (categories[note.category] || 0) + 1;
        }
        analysisState.categories = categories;
        
        // Generate connection suggestions
        console.log('\nGenerating connection suggestions...');
        const suggestions = await generateConnectionSuggestions(orphans, hubs, notes);
        
        // Calculate duration
        const duration = Date.now() - analysisState.startTime;
        
        // Compile results
        const results = {
            vaultPath: VAULT_PATH,
            timestamp: new Date().toISOString(),
            duration: duration,
            notes: notes,
            orphans: orphans,
            hubs: hubs,
            suggestions: suggestions,
            categories: categories,
            summary: {
                totalNotes: notes.length,
                orphanCount: orphans.length,
                orphanRate: Math.round(orphans.length / notes.length * 100),
                hubCount: hubs.length,
                avgConnections: Math.round(notes.reduce((sum, n) => sum + n.links.length, 0) / notes.length)
            }
        };
        
        // Save results
        await saveResults(results);
        
        // Print summary
        console.log('\n' + '='.repeat(50));
        console.log('✨ ANALYSIS COMPLETE');
        console.log('='.repeat(50));
        console.log(`Total Notes: ${notes.length}`);
        console.log(`Orphaned: ${orphans.length} (${results.summary.orphanRate}%)`);
        console.log(`Hub Notes: ${hubs.length}`);
        console.log(`Time: ${(duration / 1000).toFixed(1)}s`);
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
analyzeVault();

export { analyzeVault, callOllama, scanVault };