/**
 * Smart output filtering for MCP tools to prevent context window flooding
 * ES Module version
 */

export class OutputFilter {
  constructor(options = {}) {
    this.maxLines = options.maxLines || 50;
    this.maxChars = options.maxChars || 5000;
    this.verbose = options.verbose || false;
    this.preserveErrors = options.preserveErrors !== false;
  }

  /**
   * Main filtering method that delegates to specific filters based on type
   */
  filter(output, type = 'generic') {
    if (!output) return { result: '', metadata: { empty: true } };
    if (this.verbose) return { result: output, metadata: { filtered: false } };

    const originalStats = this.getStats(output);
    let filtered;

    switch(type) {
      case 'git':
        filtered = this.filterGitOutput(output);
        break;
      case 'file':
        filtered = this.filterFileOutput(output);
        break;
      case 'command':
        filtered = this.filterCommandOutput(output);
        break;
      case 'json':
        filtered = this.filterJsonOutput(output);
        break;
      default:
        filtered = this.genericFilter(output);
    }

    return {
      result: filtered.content,
      metadata: {
        ...originalStats,
        ...filtered.metadata,
        filtered: true,
        type
      }
    };
  }

  getStats(output) {
    const lines = output.split('\n');
    return {
      originalLines: lines.length,
      originalChars: output.length,
      originalSize: this.formatSize(output.length)
    };
  }

  formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  /**
   * Git-specific output filtering
   */
  filterGitOutput(output) {
    const lines = output.split('\n');
    const stats = {
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
      commits: 0
    };

    // Look for git status patterns
    const fileMatches = output.match(/(\d+) files? changed/);
    const insertMatches = output.match(/(\d+) insertions?\(\+\)/);
    const deleteMatches = output.match(/(\d+) deletions?\(-\)/);
    
    if (fileMatches) stats.filesChanged = parseInt(fileMatches[1]);
    if (insertMatches) stats.insertions = parseInt(insertMatches[1]);
    if (deleteMatches) stats.deletions = parseInt(deleteMatches[1]);

    // For git log, count commits
    const commitMatches = output.match(/^commit [a-f0-9]{40}/gm);
    if (commitMatches) stats.commits = commitMatches.length;

    // Build summary
    let summary = [];
    if (stats.commits > 0) {
      summary.push(`${stats.commits} commits`);
    }
    if (stats.filesChanged > 0) {
      summary.push(`${stats.filesChanged} files changed`);
      summary.push(`+${stats.insertions}/-${stats.deletions}`);
    }

    // Include first few meaningful lines
    const meaningfulLines = lines
      .filter(line => line.trim() && !line.startsWith(' '))
      .slice(0, 10);

    return {
      content: summary.length > 0 
        ? `Git operation completed: ${summary.join(', ')}\n\n${meaningfulLines.join('\n')}`
        : this.genericFilter(output).content,
      metadata: { 
        gitStats: stats,
        summary: summary.join(', ')
      }
    };
  }

  /**
   * File content filtering
   */
  filterFileOutput(output) {
    const lines = output.split('\n');
    const truncated = lines.length > this.maxLines;
    
    if (!truncated) {
      return { content: output, metadata: { truncated: false } };
    }

    const head = Math.floor(this.maxLines * 0.7);
    const tail = Math.floor(this.maxLines * 0.3);
    
    const result = [
      ...lines.slice(0, head),
      `\n... (${lines.length - this.maxLines} lines omitted) ...\n`,
      ...lines.slice(-tail)
    ].join('\n');

    return {
      content: result,
      metadata: {
        truncated: true,
        displayedLines: this.maxLines,
        omittedLines: lines.length - this.maxLines
      }
    };
  }

  /**
   * Command output filtering
   */
  filterCommandOutput(output) {
    const lines = output.split('\n');
    
    // Preserve error messages
    if (this.preserveErrors) {
      const errorLines = lines.filter(line => 
        /error|fail|exception|warning/i.test(line)
      );
      if (errorLines.length > 0 && errorLines.length < 20) {
        return {
          content: errorLines.join('\n'),
          metadata: { 
            filteredType: 'errors-only',
            errorCount: errorLines.length 
          }
        };
      }
    }

    return this.genericFilter(output);
  }

  /**
   * JSON output filtering - pretty print and truncate if needed
   */
  filterJsonOutput(output) {
    try {
      const parsed = JSON.parse(output);
      const pretty = JSON.stringify(parsed, null, 2);
      
      if (pretty.length <= this.maxChars) {
        return { 
          content: pretty, 
          metadata: { formatted: true } 
        };
      }

      // For large JSON, show structure
      const summary = this.summarizeJson(parsed);
      return {
        content: summary,
        metadata: { 
          summarized: true,
          originalSize: pretty.length
        }
      };
    } catch (e) {
      // Not valid JSON, treat as generic
      return this.genericFilter(output);
    }
  }

  summarizeJson(obj, depth = 0, maxDepth = 3) {
    if (depth > maxDepth) return '...';
    
    if (Array.isArray(obj)) {
      return `Array[${obj.length}]`;
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const keys = Object.keys(obj);
      if (keys.length > 5) {
        return `Object{${keys.slice(0, 5).join(', ')}, ... (${keys.length} keys total)}`;
      }
      return `Object{${keys.join(', ')}}`;
    }
    
    return JSON.stringify(obj);
  }

  /**
   * Generic output filtering for any content type
   */
  genericFilter(output) {
    const lines = output.split('\n');
    
    // Character limit takes precedence
    if (output.length > this.maxChars) {
      const truncated = output.slice(0, this.maxChars);
      const lastNewline = truncated.lastIndexOf('\n');
      const result = lastNewline > 0 ? truncated.slice(0, lastNewline) : truncated;
      
      return {
        content: result + '\n... (output truncated) ...',
        metadata: {
          truncated: true,
          truncatedAt: 'chars',
          displayedChars: result.length
        }
      };
    }

    // Then line limit
    if (lines.length > this.maxLines) {
      return {
        content: lines.slice(0, this.maxLines).join('\n') + '\n... (more lines omitted) ...',
        metadata: {
          truncated: true,
          truncatedAt: 'lines',
          displayedLines: this.maxLines,
          omittedLines: lines.length - this.maxLines
        }
      };
    }

    return { 
      content: output, 
      metadata: { truncated: false } 
    };
  }
}

// Helper function to detect command type for better filtering
export function detectCommandType(code) {
  const lowerCode = code.toLowerCase();
  
  // Git commands
  if (lowerCode.includes('git ')) return 'git';
  
  // File operations
  if (lowerCode.includes('cat ') || lowerCode.includes('less ') || 
      lowerCode.includes('head ') || lowerCode.includes('tail ') ||
      lowerCode.includes('read_file') || lowerCode.includes('open(')) {
    return 'file';
  }
  
  // JSON operations
  if (lowerCode.includes('json.dumps') || lowerCode.includes('json.stringify') ||
      lowerCode.includes('.json')) {
    return 'json';
  }
  
  // General commands
  if (lowerCode.includes('npm ') || lowerCode.includes('node ') ||
      lowerCode.includes('python') || lowerCode.includes('pip ')) {
    return 'command';
  }
  
  return 'generic';
}
