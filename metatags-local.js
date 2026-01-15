/**
 * Local ES module version of metatags for Brain compatibility
 * Source attribution utility functions
 */

/**
 * Wrap content in source attribution metatags
 */
export function wrapInMetatag(content, options) {
    const attrs = [
        `origin="${options.origin || 'unknown'}"`,
        `confidence="${options.confidence || 0.5}"`
    ];
    
    if (options.timestamp) {
        attrs.push(`timestamp="${options.timestamp}"`);
    } else {
        attrs.push(`timestamp="${new Date().toISOString()}"`);
    }
    
    if (options.verification) {
        attrs.push(`verification="${options.verification}"`);
    }
    
    if (options.tool) {
        attrs.push(`tool="${options.tool}"`);
    }
    
    // Add specific details based on origin
    if (options.seeds && options.origin === 'generated') {
        attrs.push(`seeds="${JSON.stringify(options.seeds)}"`);
    }
    
    if (options.query && options.origin === 'search') {
        attrs.push(`query="${options.query}"`);
    }
    
    if (options.path && options.origin === 'file') {
        attrs.push(`path="${options.path}"`);
    }
    
    if (options.memoryId && options.origin === 'memory') {
        attrs.push(`memory_id="${options.memoryId}"`);
    }
    
    if (options.details) {
        attrs.push(`details="${options.details}"`);
    }
    
    return `<source_meta ${attrs.join(' ')}>
${content}
</source_meta>`;
}

/**
 * Create a metatag for analysis/computation results
 */
export function analysisMetatag(content, tool = 'analysis') {
    return wrapInMetatag(content, {
        origin: 'generated',
        confidence: 0.9,
        tool: tool,
        details: 'computed'
    });
}

/**
 * Create a metatag for random thoughts
 */
export function randomThoughtMetatag(content, seeds) {
    return wrapInMetatag(content, {
        origin: 'generated',
        confidence: 0.7,
        tool: 'ema_random_thought',
        seeds: seeds
    });
}

/**
 * Create a metatag for surfaced memories
 */
export function memoryMetatag(content, memory) {
    return wrapInMetatag(content, {
        origin: 'memory',
        confidence: memory.source.confidence,
        tool: 'ema_memory',
        memoryId: memory.id,
        details: `tier:${memory.tier}, salience:${memory.salienceScore}`
    });
}

/**
 * Create a metatag for file content
 */
export function fileMetatag(content, filePath) {
    return wrapInMetatag(content, {
        origin: 'file',
        confidence: 1.0,
        tool: 'filesystem',
        path: filePath
    });
}

/**
 * Create a metatag for search results
 */
export function searchMetatag(content, query, url) {
    return wrapInMetatag(content, {
        origin: 'search',
        confidence: 0.85,
        tool: 'web_search',
        query: query,
        details: url || undefined
    });
}

/**
 * Create a metatag for human input
 */
export function humanMetatag(content) {
    return wrapInMetatag(content, {
        origin: 'human',
        confidence: 1.0
    });
}

/**
 * Parse metatags from text (for filtering/visualization)
 */
export function parseMetatags(text) {
    const regex = /<source_meta\s+([^>]+)>([\s\S]*?)<\/source_meta>/g;
    const results = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        const attributeString = match[1];
        const content = match[2].trim();
        const fullMatch = match[0];
        
        // Parse attributes
        const metadata = {};
        const attrRegex = /(\w+)="([^"]*)"/g;
        let attrMatch;
        
        while ((attrMatch = attrRegex.exec(attributeString)) !== null) {
            const key = attrMatch[1];
            const value = attrMatch[2];
            
            // Parse JSON values
            if (key === 'seeds') {
                try {
                    metadata[key] = JSON.parse(value);
                } catch {
                    metadata[key] = value;
                }
            } else if (key === 'confidence') {
                metadata[key] = parseFloat(value);
            } else {
                metadata[key] = value;
            }
        }
        
        results.push({ content, metadata, fullMatch });
    }
    
    return results;
}
