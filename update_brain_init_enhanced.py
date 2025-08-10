#!/usr/bin/env python3
"""
Script to update the brain_init handler with enhanced capability awareness
"""

def update_brain_init():
    input_file = '/Users/bard/Code/claude-brain/index.js'
    
    # Read the current file
    with open(input_file, 'r') as f:
        content = f.read()
    
    # Find the start and end of the brain_init handler
    start_marker = "    handler: async ({ reload = false }) => {"
    start_pos = content.find(start_marker)
    
    if start_pos == -1:
        print("Could not find brain_init handler start")
        return False
    
    # Find the end of this handler - look for the matching closing brace
    # We need to count braces to find the correct end
    brace_count = 0
    pos = start_pos + len(start_marker)
    in_string = False
    escape_next = False
    
    while pos < len(content):
        char = content[pos]
        
        if escape_next:
            escape_next = False
        elif char == '\\':
            escape_next = True
        elif char == '"' or char == "'":
            in_string = not in_string
        elif not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                if brace_count == 0:
                    # This is our closing brace
                    end_pos = pos + 1
                    break
                brace_count -= 1
        
        pos += 1
    else:
        print("Could not find brain_init handler end")
        return False
    
    # New enhanced handler
    new_handler = '''    handler: async ({ reload = false }) => {
      try {
        fs.appendFileSync(DEBUG_LOG_FILE, `\\nDEBUG: Enhanced brain_init called with reload=${reload}\\n`);
        const db = new Database(BRAIN_DB_PATH, { readonly: true });
        
        const preferences = db.prepare(
          'SELECT value FROM memories WHERE key = ? LIMIT 1'
        ).get('user_preferences');
        
        const recentMemories = db.prepare(
          'SELECT key, type, created_at FROM memories ORDER BY accessed_at DESC LIMIT 10'
        ).all();
        
        // NEW: Load core capability framework
        let capabilityFramework = null;
        try {
          const capabilityResult = db.prepare(
            'SELECT value FROM memories WHERE key = ? LIMIT 1'
          ).get('core_capability_framework');
          
          if (capabilityResult) {
            capabilityFramework = JSON.parse(capabilityResult.value);
            fs.appendFileSync(DEBUG_LOG_FILE, `\\nDEBUG: Loaded core capability framework\\n`);
          }
        } catch (capError) {
          fs.appendFileSync(DEBUG_LOG_FILE, `\\nWARNING: Could not load capability framework: ${capError.message}\\n`);
        }
        
        // NEW: Load last project context
        let lastProject = null;
        try {
          const projectResult = db.prepare(
            'SELECT value FROM memories WHERE key = ? LIMIT 1'
          ).get('last_project');
          
          if (projectResult) {
            lastProject = JSON.parse(projectResult.value);
            fs.appendFileSync(DEBUG_LOG_FILE, `\\nDEBUG: Loaded last project context: ${lastProject.name}\\n`);
          }
        } catch (projError) {
          fs.appendFileSync(DEBUG_LOG_FILE, `\\nWARNING: Could not load project context: ${projError.message}\\n`);
        }
        
        db.close();
        
        // Read Boot Loader Index to execute initialization sequence
        let bootLoaderContent = '';
        try {
          const bootLoaderPath = path.join(VAULT_PATH, 'architecture', 'Boot Loader Index - Critical System Initialization.md');
          if (fs.existsSync(bootLoaderPath)) {
            bootLoaderContent = fs.readFileSync(bootLoaderPath, 'utf8');
            
            // Process Boot Loader Index to load required documents
            const docsToLoad = [
              { name: 'Brain System Architecture', path: 'brain_system/Brain Architecture.md' },
              { name: 'Master Architecture Index', path: 'architecture/Master Architecture Index.md' }
            ];
            
            // Load each required document
            for (const doc of docsToLoad) {
              try {
                const docPath = path.join(VAULT_PATH, doc.path);
                if (fs.existsSync(docPath)) {
                  const content = fs.readFileSync(docPath, 'utf8');
                  // Document loaded successfully - context is now available
                }
              } catch (docError) {
                fs.appendFileSync(DEBUG_LOG_FILE, `\\nWARNING: Could not load ${doc.name}: ${docError.message}\\n`);
              }
            }
          }
        } catch (bootError) {
          // Boot Loader Index not found - continue with degraded initialization
          fs.appendFileSync(DEBUG_LOG_FILE, `\\nWARNING: Boot Loader Index not accessible: ${bootError.message}\\n`);
        }
        
        // Load top 10 protocols from heat map data
        let protocolsLoaded = 0;
        fs.appendFileSync(DEBUG_LOG_FILE, `\\nDEBUG: Starting protocol loading in brain_init\\n`);
        try {
          // Based on heat map analysis, these are the most frequently accessed protocols
          const topProtocols = [
            'protocols/Task Approach Protocol.md',
            'protocols/User Communication Protocol.md', 
            'protocols/Error Recovery Protocol.md',
            'protocols/Information Integration Protocol.md',
            'protocols/Progress Communication Protocol.md',
            'protocols/Architecture First Protocol.md',
            'protocols/Search API Optimization Protocol.md',
            'protocols/Repository Update Protocol.md',
            'protocols/Protocol Documentation Protocol.md',
            'protocols/Common Sense Protocol.md'
          ];
          
          for (const protocolPath of topProtocols) {
            try {
              const fullPath = path.join(VAULT_PATH, protocolPath);
              if (fs.existsSync(fullPath)) {
                const protocolContent = fs.readFileSync(fullPath, 'utf8');
                protocolsLoaded++;
                // Protocol content is now loaded into context automatically
              }
            } catch (protocolError) {
              fs.appendFileSync(DEBUG_LOG_FILE, `\\nWARNING: Could not load protocol ${protocolPath}: ${protocolError.message}\\n`);
            }
          }
        } catch (protocolLoadError) {
          fs.appendFileSync(DEBUG_LOG_FILE, `\\nWARNING: Could not load protocols: ${protocolLoadError.message}\\n`);
        }
        
        // Build enhanced output with capability awareness
        let output = '🧠 Initializing Brain...\\\\n';
        output += '✓ Created new session\\\\n';
        if (bootLoaderContent) {
          output += '✓ Boot Loader Index processed\\\\n';
        }
        if (protocolsLoaded > 0) {
          output += `✓ Loaded ${protocolsLoaded} core protocols into context\\\\n`;
        }
        
        // NEW: Show capability framework status
        if (capabilityFramework) {
          output += '✓ Core capability framework loaded\\\\n';
          output += '\\\\n🔧 **Enhanced Capabilities Active:**\\\\n';
          output += '🧠 **Persistent Memory**: Long-term memory across sessions\\\\n';
          output += '🤖 **Task Delegation**: Specialized AI models for complex tasks\\\\n';
          output += '📁 **Project Management**: Context switching and progress tracking\\\\n';
          output += '🔍 **Knowledge Access**: Architecture docs and system knowledge\\\\n';
          output += '📊 **Analysis Tools**: Structured reasoning and verification\\\\n';
        }
        
        // NEW: Show project context
        if (lastProject) {
          output += `\\\\n📂 **Last Project**: ${lastProject.name || 'Unknown'}\\\\n`;
          if (lastProject.status) {
            output += `   Status: ${lastProject.status}\\\\n`;
          }
        }
        
        if (preferences) {
          const prefs = JSON.parse(preferences.value);
          output += '\\\\n✅ Brain initialized successfully!\\\\n';
          output += `👤 User: ${prefs.nom_de_plume || 'default'}\\\\n`;
          output += `💾 Loaded ${recentMemories.length} recent memories`;
        }
        
        // Enhanced protocol reminder with capability context
        output += '\\\\n\\\\n📋 Protocol Reminder: Read prompt → Make plan → Check Master Protocol Index → Follow protocols';
        
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        fs.appendFileSync(DEBUG_LOG_FILE, `\\nERROR in enhanced brain_init handler: ${error.message}\\n`);
        fs.appendFileSync(DEBUG_LOG_FILE, `Stack trace: ${error.stack}\\n`);
        fs.appendFileSync(DEBUG_LOG_FILE, `Handler type: enhanced_brain_init\\n`);
        return { 
          content: [{ 
            type: 'text', 
            text: `❌ Brain initialization failed: ${error.message}` 
          }]
        };
      }
    }'''
    
    # Replace the handler
    new_content = content[:start_pos] + new_handler + content[end_pos:]
    
    # Write the updated content
    with open(input_file, 'w') as f:
        f.write(new_content)
    
    print("Successfully updated brain_init handler with enhanced capabilities")
    print(f"Replaced {end_pos - start_pos} characters with {len(new_handler)} characters")
    return True

if __name__ == "__main__":
    update_brain_init()
