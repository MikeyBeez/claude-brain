// Add this after the result is obtained but before returning the output
// This integrates Mercury Evolution with Brain's obsidian_note tool

// Track the note access in Mercury Evolution
const trackInMercury = async (action, identifier, title) => {
  try {
    // Only track if Mercury Evolution is available
    const mercuryCode = `
import os
import sys
import json
import subprocess

# Check if Mercury Evolution MCP server is running
try:
    # Try to connect to Mercury Evolution
    result = subprocess.run([
        'node', 
        '/Users/bard/Code/mcp-mercury-evolution/dist/cli-track.js',
        '${action}',
        '${identifier || title || 'unknown'}'
    ], capture_output=True, text=True, timeout=1)
    
    if result.returncode == 0:
        print(json.dumps({"tracked": True}))
    else:
        print(json.dumps({"tracked": False, "error": result.stderr}))
except Exception as e:
    print(json.dumps({"tracked": False, "error": str(e)}))
`;

    const { stdout } = await executePythonViaSpawn(mercuryCode);
    const trackResult = JSON.parse(stdout);
    
    if (trackResult.tracked) {
      console.error(`Mercury tracked: ${action} ${identifier || title}`);
    }
  } catch (error) {
    // Silently fail - Mercury tracking is optional
    console.error(`Mercury tracking failed: ${error.message}`);
  }
};

// Add to the obsidian_note handler after getting the result:
// await trackInMercury(args.action, args.identifier || args.title || result.identifier);
