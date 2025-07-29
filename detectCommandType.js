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
