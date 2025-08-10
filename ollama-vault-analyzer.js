#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

const VAULT_PATH = '/Users/bard/Code/claude-brain/data/BrainVault';
const MODEL = 'llama3.2';
const BATCH_SIZE = 5; // Small batch for testing

// Analysis state
let analysisState = {
    vaultPath: VAULT_PATH,
    totalNotes: 0,
    analyzedNotes: 0,
    orphanedNotes: [],
    hubNotes: [],
    connections: [],
    startTime: null
};

/**
 * Call Ollama API directly using curl
 */
async function callOllama(prompt) {
    try {
        // Use the Ollama API directly with JSON mode
        const command = `curl -s http://localhost:11434/api/generate -d '${JSON.stringify({
            model: MODEL,
            prompt: prompt,
            stream: false,
            format: "json"
        })}'`;
        
        const { stdout } = await execAsync(command);
        const response = JSON.parse(stdout);
        
        // Try to parse the response as JSON
        try {
            return JSON.parse(response.response);
        } catch {
            // If not valid JSON, return as string
            return response.response;
        }
    } catch (error) {
        console.error('Ollama API error:', error.message);
        return null;
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
 * Analyze a single note
 */
async function analyzeNote(filePath) {
    const fileName = path.basename(filePath, '.md');
    const content = await fs.readFile(filePath, 'utf-8');
    const links = extractLinks(content);
    
    // Basic metadata
    const noteData = {
        path: filePath,
        name: fileName,
        links: links,
        incomingLinks: [], // Will be populated later
        wordCount: content.split(/\s+/).length,
        hasContent: content.length > 100
    };
    
    // For very short notes, skip AI analysis
    if (content.length < 50) {
        return {
            ...noteData,
            category: 'snippet',
            topics: []
        };
    }
    
    // Create a focused prompt for categorization
    const prompt = `Analyze this Obsidian note and return JSON with: category (one of: hub, reference, daily, project, archive, snippet, personal), and topics (array of 1-3 main topics).

Title: "${fileName}"
First 300 chars: "${content.substring(0, 300).replace(/"/g, '\\"').replace(/\n/g, ' ')}"

Return ONLY valid JSON like: {"category": "project", "topics": ["AI", "vault"]}`;

    const analysis = await callOllama(prompt);
    
    if (analysis && typeof analysis === 'object') {
        return {
            ...noteData,
            category: analysis.category || 'uncategorized',
            topics: analysis.topics || []
        };
    }
    
    return {
        ...noteData,
        category: 'uncategorized',
        topics: []
    };
}

/**
 * Find orphaned notes (no incoming links)
 */
function findOrphanedNotes(notes) {
    const allNoteNames = new Set(notes.map(n => n.name));
    const notesWithIncomingLinks = new Set();
    
    // Build incoming links
    for (const note of notes) {
        for (const link of note.links) {
            if (allNoteNames.has(link)) {
                notesWithIncomingLinks.add(link);
                // Also update the incoming links for the target note
                const targetNote = notes.find(n => n.name === link);
                if (targetNote) {
                    targetNote.incomingLinks.push(note.name);
                }
            }
        }
    }
    
    // Find orphans (no incoming links AND not a hub/index)
    return notes.filter(note => 
        !notesWithIncomingLinks.has(note.name) && 
        !note.name.toLowerCase().includes('index') &&
        !note.name.toLowerCase().includes('moc') &&
        !note.name.toLowerCase().includes('hub')
    );
}

/**
 * Find hub notes (many connections)
 */
function findHubNotes(notes) {
    return notes
        .map(note => ({
            name: note.name,
            connections: note.links.length + note.incomingLinks.length,
            outgoing: note.links.length,
            incoming: note.incomingLinks.length
        }))
        .filter(hub => hub.connections >= 10)
        .sort((a, b) => b.connections - a.connections);
}

/**
 * Generate simple connection suggestions
 */
async function generateConnectionSuggestions(orphans, hubs, allNotes) {
    const suggestions = [];
    
    // For each orphan, suggest connections based on shared topics
    for (const orphan of orphans.slice(0, 10)) { // Limit for testing
        if (!orphan.topics || orphan.topics.length === 0) continue;
        
        // Find notes with similar topics
        const similarNotes = allNotes.filter(note => 
            note.name !== orphan.name &&
            note.topics && 
            note.topics.some(topic => orphan.topics.includes(topic))
        );
        
        if (similarNotes.length > 0) {
            suggestions.push({
                orphan: orphan.name,
                suggestions: similarNotes.slice(0, 3).map(note => ({
                    target: note.name,
                    reason: `Shared topics: ${note.topics.filter(t => orphan.topics.includes(t)).join(', ')}`,
                    confidence: 0.7
                }))
            });
        }
    }
    
    return suggestions;
}

/**
 * Save analysis results
 */
async function saveResults(results) {
    const outputDir = path.join(VAULT_PATH, '.analysis');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Save JSON results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(outputDir, `analysis-${timestamp}.json`);
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    
    // Save markdown report
    const report = generateReport(results);
    const reportPath = path.join(outputDir, 'latest-report.md');
    await fs.writeFile(reportPath, report);
    
    console.log(`\n✅ Results saved to: ${outputPath}`);
    console.log(`📊 Report saved to: ${reportPath}`);
}

/**
 * Generate markdown report
 */
function generateReport(results) {
    const { notes, orphans, hubs, suggestions, duration } = results;
    
    // Count categories
    const categories = {};
    for (const note of notes) {
        categories[note.category] = (categories[note.category] || 0) + 1;
    }
    
    return `# Vault Analysis Report

**Date**: ${new Date().toISOString()}
**Vault**: ${VAULT_PATH}
**Model**: ${MODEL}

## Summary
- **Total Notes**: ${notes.length}
- **Orphaned Notes**: ${orphans.length} (${Math.round(orphans.length / notes.length * 100)}%)
- **Hub Notes**: ${hubs.length}
- **Analysis Time**: ${(duration / 1000).toFixed(1)}s

## Categories
${Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => `- ${cat}: ${count} notes`)
    .join('\n')}

## Top Hub Notes
${hubs.slice(0, 10)
    .map(h => `- **${h.name}**: ${h.connections} connections (${h.incoming} in, ${h.outgoing} out)`)
    .join('\n')}

## Sample Orphaned Notes
${orphans.slice(0, 20)
    .map(o => `- ${o.name} (${o.category})`)
    .join('\n')}

## Connection Suggestions
${suggestions.slice(0, 10)
    .map(s => `### ${s.orphan}\n${s.suggestions
        .map(sugg => `  - Connect to: **${sugg.target}** - ${sugg.reason}`)
        .join('\n')}`)
    .join('\n\n')}

## Next Steps
1. Review connection suggestions above
2. Connect orphaned notes to relevant hubs
3. Consider creating new hub notes for emerging clusters
4. Re-run analysis after implementing changes
`;
}

/**
 * Main analysis function
 */
async function main() {
    console.log('🔍 Ollama Vault Analysis System');
    console.log(`📁 Vault: ${VAULT_PATH}`);
    console.log(`🤖 Model: ${MODEL}`);
    console.log('================================\n');
    
    analysisState.startTime = Date.now();
    
    try {
        // Test Ollama
        console.log('Testing Ollama...');
        const testResult = await callOllama('Return JSON: {"status": "ok"}');
        if (!testResult || testResult.status !== 'ok') {
            throw new Error('Ollama test failed - make sure Ollama is running');
        }
        console.log('✅ Ollama is working\n');
        
        // Scan vault
        console.log('Scanning vault...');
        const files = await scanVault(VAULT_PATH);
        analysisState.totalNotes = files.length;
        console.log(`Found ${files.length} notes\n`);
        
        // Analyze a sample of notes (for testing)
        console.log('Analyzing notes (sample of 50 for testing)...');
        const sampleFiles = files.slice(0, 50); // Just analyze first 50 for testing
        
        const notes = [];
        for (let i = 0; i < sampleFiles.length; i++) {
            process.stdout.write(`\rAnalyzing: ${i + 1}/${sampleFiles.length}`);
            const noteData = await analyzeNote(sampleFiles[i]);
            notes.push(noteData);
        }
        console.log('\n');
        
        // Find orphans and hubs
        console.log('Identifying orphans and hubs...');
        const orphans = findOrphanedNotes(notes);
        const hubs = findHubNotes(notes);
        
        console.log(`Found ${orphans.length} orphans and ${hubs.length} hubs\n`);
        
        // Generate suggestions
        console.log('Generating connection suggestions...');
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
            suggestions: suggestions
        };
        
        // Save results
        await saveResults(results);
        
        // Print summary
        console.log('\n' + '='.repeat(50));
        console.log('✨ ANALYSIS COMPLETE');
        console.log('='.repeat(50));
        console.log(`Notes Analyzed: ${notes.length}`);
        console.log(`Orphans Found: ${orphans.length}`);
        console.log(`Hubs Identified: ${hubs.length}`);
        console.log(`Suggestions Generated: ${suggestions.length}`);
        console.log(`Time: ${(duration / 1000).toFixed(1)}s`);
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('\n❌ Analysis failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the analysis
main().catch(console.error);