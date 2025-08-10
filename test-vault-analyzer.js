#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

const VAULT_PATH = '/Users/bard/Code/claude-brain/data/BrainVault';

async function testOllama() {
    console.log('Testing Ollama connection...');
    try {
        const result = await execAsync('echo "Return JSON: {test: true}" | ollama run llama3.2');
        console.log('Ollama response:', result.stdout);
        return true;
    } catch (error) {
        console.error('Ollama test failed:', error);
        return false;
    }
}

async function scanVault() {
    console.log(`Scanning vault: ${VAULT_PATH}`);
    const files = [];
    
    async function scan(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
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
    
    await scan(VAULT_PATH);
    return files;
}

async function main() {
    console.log('🔍 Vault Analyzer - Simple Test');
    console.log('================================\n');
    
    // Test Ollama
    const ollamaOk = await testOllama();
    if (!ollamaOk) {
        console.error('❌ Ollama not working');
        process.exit(1);
    }
    
    console.log('✅ Ollama is working\n');
    
    // Scan vault
    const files = await scanVault();
    console.log(`\n✅ Found ${files.length} markdown files`);
    
    // Show first 5 files
    console.log('\nFirst 5 files:');
    files.slice(0, 5).forEach(f => {
        console.log(`  - ${path.basename(f)}`);
    });
    
    console.log('\n✨ Test complete!');
}

main().catch(console.error);