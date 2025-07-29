// Import the OutputFilter - adjust path as needed
const OutputFilter = require('./output-filter.js');

// Helper function to detect command type for better filtering
function detectCommandType(code) {
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

// Enhanced brain_execute handler with output filtering
const enhancedBrainExecute = {
  name: 'brain_execute',
  description: 'Execute Python or Shell code with full system access',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Code to execute' },
      language: { 
        type: 'string', 
        enum: ['python', 'shell', 'auto'], 
        default: 'auto' 
      },
      description: { type: 'string', description: 'What this code does' },
      verbose: { 
        type: 'boolean', 
        description: 'Return full output without filtering',
        default: false
      }
    },
    required: ['code']
  },
  handler: async ({ code, language = 'auto', description, verbose = false }, execAsync, createExecutionLog, saveExecutionLog) => {
    let execId, logEntry, startTime;
    try {
      // Initialize output filter
      const filter = new OutputFilter({ 
        verbose: verbose,
        maxLines: 50,
        maxChars: 5000
      });
      
      // Detect language
      if (language === 'auto') {
        language = code.includes('import ') || code.includes('def ') || code.includes('print(') 
          ? 'python' 
          : 'shell';
      }
      
      // Create execution log
      const logResult = createExecutionLog(code, language, description);
      execId = logResult.execId;
      logEntry = logResult.logEntry;
      
      let output = '';
      let rawOutput = '';
      startTime = Date.now();
      
      if (language === 'python') {
        output += `🐍 Executing python code: ${description || 'No description provided'}\\n`;
        
        const { stdout, stderr } = await execAsync(
          `python3 -c '${code.replace(/'/g, "'\"'\"'")}'`,
          { maxBuffer: 10 * 1024 * 1024 }
        );
        
        rawOutput = stdout || '';
        if (stderr) rawOutput += `\\n⚠️ Errors:\\n${stderr}`;
        
      } else {
        output += `🖥️ Executing shell command: ${description || 'No description provided'}\\n`;
        
        const { stdout, stderr } = await execAsync(code, {
          shell: true,
          maxBuffer: 10 * 1024 * 1024
        });
        
        rawOutput = stdout || '';
        if (stderr) rawOutput += `\\n⚠️ Errors:\\n${stderr}`;
      }
      
      // Detect command type for better filtering
      const commandType = detectCommandType(code);
      
      // Filter output
      const filtered = filter.filter(rawOutput, commandType);
      
      if (filtered.metadata.filtered) {
        output += `📤 Output (filtered):\\n${filtered.result}`;
        
        // Add metadata about filtering
        if (filtered.metadata.truncated) {
          output += `\\n\\n📊 Filtering info:\\n`;
          output += `  • Original: ${filtered.metadata.originalLines} lines, ${filtered.metadata.originalSize}\\n`;
          output += `  • Displayed: ${filtered.metadata.displayedLines || filtered.metadata.displayedChars} ${filtered.metadata.truncatedAt === 'lines' ? 'lines' : 'chars'}\\n`;
          if (filtered.metadata.gitStats) {
            output += `  • Git stats: ${filtered.metadata.summary}\\n`;
          }
          output += `  • Use verbose: true for full output`;
        }
      } else {
        output += `📤 Output:\\n${filtered.result}`;
      }
      
      const executionTime = Date.now() - startTime;
      output += `\\n⏱️ Execution time: ${executionTime}ms`;
      
      // Save execution log
      if (execId && logEntry) {
        logEntry.status = 'completed';
        logEntry.output = rawOutput; // Store full output in log
        logEntry.execution_time = executionTime / 1000;
        saveExecutionLog(execId, logEntry);
      }
      
      return { content: [{ type: 'text', text: output }] };
    } catch (error) {
      // Save error in execution log
      if (execId && logEntry) {
        logEntry.status = 'error';
        logEntry.error = error.message;
        logEntry.execution_time = (Date.now() - (startTime || Date.now())) / 1000;
        saveExecutionLog(execId, logEntry);
      }
      
      return { 
        content: [{ 
          type: 'text', 
          text: `❌ Execution error: ${error.message}` 
        }] 
      };
    }
  }
};

module.exports = { enhancedBrainExecute, detectCommandType };
