// Phase 3: Add OutputFilter to obsidian_note tool
// This patch adds verbose parameter and output filtering to the obsidian_note tool

// Updated obsidian_note tool definition:
{
  name: 'obsidian_note',
  description: 'Create, read, update, or delete notes in Obsidian vault',
  inputSchema: {
    type: 'object',
    properties: {
      action: { 
        type: 'string', 
        enum: ['create', 'read', 'update', 'delete', 'list'] 
      },
      title: { type: 'string' },
      content: { type: 'string' },
      identifier: { type: 'string' },
      metadata: { type: 'object' },
      folder: { type: 'string' },
      verbose: { 
        type: 'boolean', 
        description: 'Return full content without filtering',
        default: false
      }
    },
    required: ['action']
  },
  handler: async (args) => {
    const pythonCode = `
import sys
sys.path.insert(0, '${BRAIN_NOTES_PATH}')
from obsidian_integration.obsidian_note import ObsidianNote
import json

note_tool = ObsidianNote(vault_path="${VAULT_PATH}")
args = ${JSON.stringify(args)}
action = args.get('action')

try:
    if action == 'create':
        result = note_tool.create(
            title=args.get('title'),
            content=args.get('content'),
            metadata=args.get('metadata', {})
        )
    elif action == 'read':
        result = note_tool.read(args.get('identifier'))
    elif action == 'update':
        result = note_tool.update(
            args.get('identifier'),
            content=args.get('content'),
            metadata_updates=args.get('metadata')
        )
    elif action == 'delete':
        result = note_tool.delete(args.get('identifier'))
    elif action == 'list':
        result = note_tool.list_notes(folder=args.get('folder'))
    else:
        result = {"error": f"Unknown action: {action}"}
    
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

    try {
      const { stdout, stderr } = await executePythonViaSpawn(pythonCode);
      
      if (stderr && !stderr.includes('Warning')) {
        console.error(`Obsidian tool stderr: ${stderr}`);
      }
      
      const result = JSON.parse(stdout);
      let output = `📝 Obsidian ${args.action} action\\n\\n`;
      
      if (result.error) {
        output += `❌ Error: ${result.error}`;
      } else {
        switch (args.action) {
          case 'create':
            output += `✅ Created note: ${result.title}\\n`;
            output += `📍 Path: ${result.path}\\n`;
            output += `🔑 ID: ${result.id}`;
            break;
            
          case 'read':
            if (result) {
              output += `📖 ${result.title}\\n\\n`;
              
              // Apply output filtering for large notes
              if (!args.verbose && result.content) {
                const filter = new OutputFilter({
                  verbose: false,
                  maxLines: 100,
                  maxChars: 10000
                });
                
                const filtered = filter.filter(result.content, 'file');
                output += filtered.result;
                
                if (filtered.metadata.truncated) {
                  output += `\\n\\n📊 Note filtering:\\n`;
                  output += `  • Original: ${filtered.metadata.originalLines} lines, ${filtered.metadata.originalSize}\\n`;
                  output += `  • Displayed: ${filtered.metadata.displayedLines || filtered.metadata.displayedChars} ${filtered.metadata.truncatedAt === 'lines' ? 'lines' : 'chars'}\\n`;
                  output += `  • Use verbose: true for full content`;
                }
              } else {
                output += result.content;
              }
            } else {
              output += '❌ Note not found';
            }
            break;
            
          case 'update':
            output += `✅ Updated: ${result.path}`;
            break;
            
          case 'delete':
            output += `🗑️ Deleted: ${result.path}`;
            break;
            
          case 'list':
            const notesList = result.notes || [];
            
            if (!args.verbose && notesList.length > 50) {
              output += `📚 Found ${notesList.length} notes (showing first 50):\\n`;
              for (const note of notesList.slice(0, 50)) {
                output += `  • ${note.identifier} (${note.path})\\n`;
              }
              output += `\\n📊 List filtering:\\n`;
              output += `  • Total notes: ${notesList.length}\\n`;
              output += `  • Displayed: 50\\n`;
              output += `  • Use verbose: true for full list`;
            } else {
              output += `📚 Found ${notesList.length} notes:\\n`;
              for (const note of notesList) {
                output += `  • ${note.identifier} (${note.path})\\n`;
              }
            }
            break;
        }
      }
      
      return { content: [{ type: 'text', text: output }] };
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `❌ Error: ${error.message}` 
        }] 
      };
    }
  }
}
