#!/usr/bin/env python3
"""
Fix the brain_init handler to properly handle text-based capability framework
"""

def fix_brain_init_capability_loading():
    input_file = '/Users/bard/Code/claude-brain/index.js'
    
    # Read the current file
    with open(input_file, 'r') as f:
        content = f.read()
    
    # Find and replace the JSON.parse line for capability framework
    old_capability_code = '''          if (capabilityResult) {
            capabilityFramework = JSON.parse(capabilityResult.value);
            fs.appendFileSync(DEBUG_LOG_FILE, `\\nDEBUG: Loaded core capability framework\\n`);
          }'''
    
    new_capability_code = '''          if (capabilityResult) {
            capabilityFramework = capabilityResult.value; // Store as text, not JSON
            fs.appendFileSync(DEBUG_LOG_FILE, `\\nDEBUG: Loaded core capability framework\\n`);
          }'''
    
    # Also fix the project loading to handle non-JSON data gracefully
    old_project_code = '''          if (projectResult) {
            lastProject = JSON.parse(projectResult.value);
            fs.appendFileSync(DEBUG_LOG_FILE, `\\nDEBUG: Loaded last project context: ${lastProject.name}\\n`);
          }'''
    
    new_project_code = '''          if (projectResult) {
            try {
              lastProject = JSON.parse(projectResult.value);
              fs.appendFileSync(DEBUG_LOG_FILE, `\\nDEBUG: Loaded last project context: ${lastProject.name}\\n`);
            } catch (parseError) {
              // Handle text-based project data
              lastProject = { name: projectResult.value, status: 'loaded' };
              fs.appendFileSync(DEBUG_LOG_FILE, `\\nDEBUG: Loaded text project context: ${projectResult.value}\\n`);
            }
          }'''
    
    if old_capability_code in content:
        content = content.replace(old_capability_code, new_capability_code)
        print("✓ Fixed capability framework loading")
    else:
        print("⚠️ Could not find capability framework code to fix")
    
    if old_project_code in content:
        content = content.replace(old_project_code, new_project_code)
        print("✓ Enhanced project loading with error handling")
    else:
        print("⚠️ Could not find project loading code to enhance")
    
    # Write the updated content
    with open(input_file, 'w') as f:
        f.write(content)
    
    print("✅ brain_init capability loading fixed!")

if __name__ == "__main__":
    fix_brain_init_capability_loading()
