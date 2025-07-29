
import { CONFIG } from "./config.js";
/**
 * Brain Unified MCP Server
 * 
 * Combines all Brain tools and Obsidian integration tools in one server.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

// Debug logging
const DEBUG_LOG_FILE = '/tmp/mcp_debug.log';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BRAIN_DB_PATH = CONFIG.BRAIN_DB_PATH;
const VAULT_PATH = CONFIG.VAULT_PATH;
const BRAIN_NOTES_PATH = __dirname;  // Use current directory
const PYTHON_PATH = '/usr/local/bin/python3';
const LOG_DIR = CONFIG.LOG_DIR;

// Import crypto for future enhancements
import crypto from 'crypto';

// Helper function to execute Python code via spawn, avoiding shell escaping issues
function executePythonViaSpawn(pythonCode, pythonPath = PYTHON_PATH) {
  return new Promise((resolve, reject) => {
    // Set CWD to the project root where obsidian_integration lives
    const options = {
      cwd: BRAIN_NOTES_PATH || __dirname
    };
    
    const python = spawn(pythonPath, ['-'], options); // Pass options with CWD

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Python process exited with code ${code}: ${stderr}`));
      }
      // Return both stdout and stderr for compatibility
      resolve({ stdout, stderr });
    });
    
    python.on('error', (err) => {
      reject(err);
    });

    // Write the Python code to the process's standard input
    python.stdin.write(pythonCode);
    python.stdin.end();
  });
}



// State table configuration
const STATE_TABLE_NAME = 'brain_state';
const STATE_SCHEMA = `
CREATE TABLE IF NOT EXISTS ${STATE_TABLE_NAME} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT DEFAULT '{}',
  UNIQUE(namespace, key)
);

CREATE INDEX IF NOT EXISTS idx_state_namespace ON ${STATE_TABLE_NAME}(namespace);
CREATE INDEX IF NOT EXISTS idx_state_key ON ${STATE_TABLE_NAME}(key);
CREATE INDEX IF NOT EXISTS idx_state_updated ON ${STATE_TABLE_NAME}(updated_at DESC);
`;

// Initialize state table on startup
function initializeStateTable() {
  try {
    const db = new Database(BRAIN_DB_PATH);
    db.exec(STATE_SCHEMA);
    
    // Create update trigger
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_state_timestamp 
      AFTER UPDATE ON ${STATE_TABLE_NAME}
      BEGIN
        UPDATE ${STATE_TABLE_NAME} 
        SET updated_at = CURRENT_TIMESTAMP, version = version + 1
        WHERE id = NEW.id;
      END;
    `);
    
    db.close();
    console.error('[Brain Unified] State table initialized');
  } catch (error) {
    console.error('[Brain Unified] Error initializing state table:', error);
  }
}

// Tool definitions

// Helper functions for execution logging
function createExecutionLog(code, language, description, status = 'running') {
  const timestamp = new Date();
  const execId = `exec-${timestamp.toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;
  
  const logEntry = {
    id: execId,
    execution_id: execId,  // For monitoring compatibility
    timestamp: timestamp.toISOString(),
    type: language,
    language: language,  // For monitoring compatibility
    description: description || `Execute ${language} code`,
    code: code,
    status: status,
    output: '',
    error: '',
    execution_time: 0
  };
  
  return { execId, logEntry };
}

function saveExecutionLog(execId, logEntry) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    
    const logFile = path.join(LOG_DIR, `${execId}.json`);
    fs.writeFileSync(logFile, JSON.stringify(logEntry, null, 2));
  } catch (error) {
    console.error('[Brain Unified] Error saving execution log:', error);
  }
}

const tools = [
  // ===== STATE MANAGEMENT TOOLS =====
  {
    name: 'state_migrate',
    description: 'Migrate existing memories to state table',
    inputSchema: {
      type: 'object',
      properties: {
        dryRun: { type: 'boolean', description: 'Preview migration without changes', default: true },
        filter: { type: 'string', description: 'Filter pattern for keys to migrate' }
      }
    },
    handler: async ({ dryRun = true, filter }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);
        
        let query = `SELECT key, value, type, metadata FROM memories`;
        const params = [];
        
        if (filter) {
          query += ` WHERE key LIKE ?`;
          params.push(`%${filter}%`);
        }
        
        const memories = db.prepare(query).all(...params);
        
        let output = `🔄 State Migration ${dryRun ? '(DRY RUN)' : ''}\\n\\n`;
        output += `Found ${memories.length} memories to process\\n\\n`;
        
        let migrated = 0;
        
        for (const memory of memories) {
          // Determine namespace from type or key pattern
          let namespace = memory.type || 'general';
          if (memory.key.includes('_')) {
            const parts = memory.key.split('_');
            if (parts[0] === 'project' || parts[0] === 'config' || parts[0] === 'session') {
              namespace = parts[0];
            }
          }
          
          if (!dryRun) {
            try {
              db.prepare(`
                INSERT OR REPLACE INTO ${STATE_TABLE_NAME} 
                (namespace, key, value, metadata) 
                VALUES (?, ?, ?, ?)
              `).run(namespace, memory.key, memory.value, memory.metadata || '{}');
              migrated++;
            } catch (e) {
              output += `  ❌ Failed: ${memory.key} - ${e.message}\\n`;
            }
          } else {
            output += `  • ${namespace}/${memory.key}\\n`;
            migrated++;
          }
        }
        
        db.close();
        
        output += `\\n✅ ${dryRun ? 'Would migrate' : 'Migrated'} ${migrated} items`;
        
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        fs.appendFileSync(DEBUG_LOG_FILE, `\nERROR in brain_analyze: ${error.message}\n`);
        fs.appendFileSync(DEBUG_LOG_FILE, `Stack: ${error.stack}\n`);
        return { 
          content: [{ 
            type: 'text', 
            text: `❌ Error in migration: ${error.message}` 
          }] 
        };
      }
    }
  },
  
  // ===== BRAIN CORE TOOLS =====
  // ===== BRAIN CORE TOOLS =====
  {
    name: 'brain_init',
    description: 'Initialize Brain session and load context',
    inputSchema: {
      type: 'object',
      properties: {
        reload: { type: 'boolean', description: 'Force reload' }
      }
    },
    handler: async ({ reload = false }) => {
      try {
        const db = new Database(BRAIN_DB_PATH, { readonly: true });
        
        const preferences = db.prepare(
          'SELECT value FROM memories WHERE key = ? LIMIT 1'
        ).get('user_preferences');
        
        const recentMemories = db.prepare(
          'SELECT key, type, created_at FROM memories ORDER BY accessed_at DESC LIMIT 10'
        ).all();
        
        db.close();
        
        let output = '🧠 Initializing Brain...\\n';
        output += '✓ Created new session\\n';
        
        if (preferences) {
          const prefs = JSON.parse(preferences.value);
          output += '✅ Brain initialized successfully!\\n';
          output += `👤 User: ${prefs.nom_de_plume || 'default'}\\n`;
          output += `💾 Loaded ${recentMemories.length} recent memories`;
        }
        
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        fs.appendFileSync(DEBUG_LOG_FILE, `\nERROR in brain_analyze handler: ${error.message}\n`);
        fs.appendFileSync(DEBUG_LOG_FILE, `Stack: ${error.stack}\n`);
        fs.appendFileSync(DEBUG_LOG_FILE, `Handler type: SPAWN-BASED\n`);
        return { 
          content: [{ 
            type: 'text', 
            text: `❌ Error initializing Brain: ${error.message}` 
          }] 
        };
      }
    }
  },
  
  {
    name: 'brain_remember',
    description: 'Store information in Brain memory',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Memory key' },
        value: { description: 'Value to remember' },
        type: { type: 'string', description: 'Memory type', default: 'general' }
      },
      required: ['key', 'value']
    },
    handler: async ({ key, value, type = 'general' }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);
        
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        const timestamp = new Date().toISOString();
        
        db.prepare(
          `INSERT OR REPLACE INTO memories 
           (key, value, type, created_at, updated_at, accessed_at) 
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(key, valueStr, type, timestamp, timestamp, timestamp);
        
        db.close();
        
        let output = `💾 Storing memory: ${key}...\\n`;
        output += `✓ Stored ${type} memory: ${key}`;
        
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        fs.appendFileSync(DEBUG_LOG_FILE, `\nERROR in brain_analyze handler: ${error.message}\n`);
        fs.appendFileSync(DEBUG_LOG_FILE, `Stack: ${error.stack}\n`);
        fs.appendFileSync(DEBUG_LOG_FILE, `Analysis type was: ${analysis_type}\n`);
        return { 
          content: [{ 
            type: 'text', 
            text: `❌ Error storing memory: ${error.message}` 
          }] 
        };
      }
    }
  },
  
  {
    name: 'brain_recall',
    description: 'Search through Brain memories',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results', default: 10 }
      },
      required: ['query']
    },
    handler: async ({ query, limit = 10 }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);
        
        const results = db.prepare(
          `SELECT key, value, type, created_at 
           FROM memories 
           WHERE key LIKE ? OR value LIKE ?
           ORDER BY accessed_at DESC
           LIMIT ?`
        ).all(`%${query}%`, `%${query}%`, limit);
        
        // Update access time
        if (results.length > 0) {
          const keys = results.map(r => r.key);
          const placeholders = keys.map(() => '?').join(',');
          db.prepare(
            `UPDATE memories SET accessed_at = CURRENT_TIMESTAMP 
             WHERE key IN (${placeholders})`
          ).run(...keys);
        }
        
        db.close();
        
        let output = `🔍 Searching memories for: "${query}"...\\n`;
        output += `✓ Found ${results.length} matching memories:\\n`;
        
        for (const result of results) {
          output += `\\n📌 ${result.key} (${result.type})\\n`;
          try {
            const value = JSON.parse(result.value);
            output += `   ${JSON.stringify(value, null, 2).substring(0, 200)}...\\n`;
          } catch {
            output += `   ${result.value.substring(0, 200)}...\\n`;
          }
        }
        
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { 
          content: [{ 
            type: 'text', 
            text: `❌ Error searching memories: ${error.message}` 
          }] 
        };
      }
    }
  },
  
  {
    name: 'brain_status',
    description: 'Check Brain system status',
    inputSchema: {
      type: 'object',
      properties: {
        detailed: { type: 'boolean', default: false }
      }
    },
    handler: async ({ detailed = false }) => {
      try {
        const db = new Database(BRAIN_DB_PATH, { readonly: true });
        
        const stats = db.prepare(
          `SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN type = 'project' THEN 1 END) as projects,
            COUNT(CASE WHEN type = 'pattern' THEN 1 END) as patterns,
            COUNT(CASE WHEN type = 'general' THEN 1 END) as general
           FROM memories`
        ).get();
        
        const recent = detailed ? db.prepare(
          `SELECT key, updated_at FROM memories 
           ORDER BY updated_at DESC LIMIT 5`
        ).all() : [];
        
        db.close();
        
        let output = '🧠 Brain System Status\\n';
        output += '═══════════════════════\\n\\n';
        output += '📊 Memory Statistics:\\n';
        output += `  • Total memories: ${stats.total}\\n`;
        output += `  • Projects: ${stats.projects}\\n`;
        output += `  • Patterns: ${stats.patterns}\\n`;
        output += `  • General: ${stats.general}\\n`;
        
        if (detailed) {
          output += '\\n📅 Recent Activity:\\n';
          for (const item of recent) {
            output += `  • ${item.key} (${item.updated_at})\\n`;
          }
        }
        
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { 
          content: [{ 
            type: 'text', 
            text: `❌ Error checking status: ${error.message}` 
          }] 
        };
      }
    }
  },
  
  {
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
        description: { type: 'string', description: 'What this code does' }
      },
      required: ['code']
    },
    handler: async ({ code, language = 'auto', description }) => {
      let execId, logEntry, startTime;
      try {
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
        startTime = Date.now();
        
        if (language === 'python') {
          output += `🐍 Executing python code: ${description || 'No description provided'}\\n`;
          
          const { stdout, stderr } = await execAsync(
            `python3 -c '${code.replace(/'/g, "'\"'\"'")}'`,
            { maxBuffer: 10 * 1024 * 1024 }
          );
          
          if (stdout) output += `📤 Output:${stdout}`;
          if (stderr) output += `⚠️ Errors:${stderr}`;
          
        } else {
          output += `🖥️ Executing shell command: ${description || 'No description provided'}\\n`;
          
          const { stdout, stderr } = await execAsync(code, {
            shell: true,
            maxBuffer: 10 * 1024 * 1024
          });
          
          if (stdout) output += `📤 Output:\\n${stdout}`;
          if (stderr) output += `⚠️ Errors:\\n${stderr}`;
        }
        
        const executionTime = Date.now() - startTime;
        output += `⏱️ Execution time: ${executionTime}ms`;
        
        // Save execution log
        if (execId && logEntry) {
          logEntry.status = 'completed';
          logEntry.output = output;
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
  },
  
  
  // ===== STATE MANAGEMENT TOOLS =====
  {
    name: 'state_set',
    description: 'Set a state value in the state table',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'State key' },
        value: { description: 'State value (will be JSON stringified)' },
        category: { 
          type: 'string', 
          description: 'State category',
          enum: ['system', 'project', 'config', 'cache', 'session'],
          default: 'system'
        }
      },
      required: ['key', 'value']
    },
    handler: async ({ key, value, category = 'system' }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);
        
        const stateKey = `state_${category}_${key}`;
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        const timestamp = new Date().toISOString();
        
        const metadata = {
          category,
          original_key: key,
          updated_by: 'brain_unified_mcp',
          version: 1
        };
        
        const existing = db.prepare(
          'SELECT metadata FROM memories WHERE key = ?'
        ).get(stateKey);
        
        if (existing) {
          const existingMeta = JSON.parse(existing.metadata);
          metadata.version = (existingMeta.version || 0) + 1;
        }
        
        db.prepare(
          `INSERT OR REPLACE INTO memories 
           (key, value, type, created_at, updated_at, accessed_at, metadata) 
           VALUES (?, ?, 'state', 
                   COALESCE((SELECT created_at FROM memories WHERE key = ?), ?), 
                   ?, ?, ?)`
        ).run(
          stateKey, 
          valueStr, 
          stateKey,
          timestamp, 
          timestamp, 
          timestamp,
          JSON.stringify(metadata)
        );
        
        db.close();
        
        let output = `📊 State Updated\\n`;
        output += `🔑 Key: ${key}\\n`;
        output += `📁 Category: ${category}\\n`;
        output += `🔢 Version: ${metadata.version}\\n`;
        output += `✅ State set successfully`;
        
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { 
          content: [{ 
            type: 'text', 
            text: `❌ Error setting state: ${error.message}` 
          }] 
        };
      }
    }
  },
  
  {
    name: 'state_get',
    description: 'Get a state value from the state table',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'State key' },
        category: { 
          type: 'string', 
          description: 'State category',
          enum: ['system', 'project', 'config', 'cache', 'session', 'any'],
          default: 'any'
        }
      },
      required: ['key']
    },
    handler: async ({ key, category = 'any' }) => {
      try {
        const db = new Database(BRAIN_DB_PATH, { readonly: true });
        
        let result;
        if (category === 'any') {
          result = db.prepare(
            `SELECT * FROM memories 
             WHERE key LIKE ? AND type = 'state'
             ORDER BY updated_at DESC LIMIT 1`
          ).get(`state_%_${key}`);
        } else {
          const stateKey = `state_${category}_${key}`;
          result = db.prepare(
            'SELECT * FROM memories WHERE key = ? AND type = ?'
          ).get(stateKey, 'state');
        }
        
        db.close();
        
        if (!result) {
          return { 
            content: [{ 
              type: 'text', 
              text: `❌ State not found: ${key}` 
            }] 
          };
        }
        
        const metadata = JSON.parse(result.metadata || '{}');
        let value;
        try {
          value = JSON.parse(result.value);
        } catch {
          value = result.value;
        }
        
        let output = `📊 State Retrieved\\n`;
        output += `🔑 Key: ${metadata.original_key || key}\\n`;
        output += `📁 Category: ${metadata.category || 'unknown'}\\n`;
        output += `🔢 Version: ${metadata.version || 1}\\n`;
        output += `📅 Updated: ${result.updated_at}\\n\\n`;
        output += `📄 Value:\\n${JSON.stringify(value, null, 2)}`;
        
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { 
          content: [{ 
            type: 'text', 
            text: `❌ Error getting state: ${error.message}` 
          }] 
        };
      }
    }
  },
  
  {
    name: 'state_list',
    description: 'List all state entries or filter by category',
    inputSchema: {
      type: 'object',
      properties: {
        category: { 
          type: 'string', 
          description: 'Filter by category',
          enum: ['system', 'project', 'config', 'cache', 'session', 'all'],
          default: 'all'
        },
        limit: { type: 'number', description: 'Maximum results', default: 20 }
      }
    },
    handler: async ({ category = 'all', limit = 20 }) => {
      try {
        const db = new Database(BRAIN_DB_PATH, { readonly: true });
        
        let query = `
          SELECT key, value, metadata, updated_at 
          FROM memories 
          WHERE type = 'state'
        `;
        
        if (category !== 'all') {
          query += ` AND key LIKE 'state_${category}_%'`;
        }
        
        query += ' ORDER BY updated_at DESC LIMIT ?';
        
        const results = db.prepare(query).all(limit);
        db.close();
        
        let output = `📊 State Entries`;
        output += category !== 'all' ? ` (${category})` : '';
        output += `\\n`;
        output += `═══════════════════════\\n\\n`;
        
        if (results.length === 0) {
          output += '❌ No state entries found';
        } else {
          output += `Found ${results.length} entries:\\n\\n`;
          
          for (const entry of results) {
            const metadata = JSON.parse(entry.metadata || '{}');
            const originalKey = metadata.original_key || entry.key.replace(/^state_[^_]+_/, '');
            
            output += `🔑 ${originalKey}\\n`;
            output += `   📁 Category: ${metadata.category || 'unknown'}\\n`;
            output += `   🔢 Version: ${metadata.version || 1}\\n`;
            output += `   📅 Updated: ${entry.updated_at}\\n`;
            
            try {
              const value = JSON.parse(entry.value);
              const preview = JSON.stringify(value, null, 2).substring(0, 100);
              output += `   📄 Value: ${preview}${preview.length >= 100 ? '...' : ''}\\n`;
            } catch {
              output += `   📄 Value: ${entry.value.substring(0, 100)}...\\n`;
            }
            output += '\\n';
          }
        }
        
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { 
          content: [{ 
            type: 'text', 
            text: `❌ Error listing state: ${error.message}` 
          }] 
        };
      }
    }
  },
  
  {
    name: 'state_delete',
    description: 'Delete a state entry',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'State key to delete' },
        category: { 
          type: 'string', 
          description: 'State category',
          enum: ['system', 'project', 'config', 'cache', 'session'],
          default: 'system'
        }
      },
      required: ['key']
    },
    handler: async ({ key, category = 'system' }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);
        
        const stateKey = `state_${category}_${key}`;
        
        const existing = db.prepare(
          'SELECT value, metadata FROM memories WHERE key = ?'
        ).get(stateKey);
        
        if (!existing) {
          db.close();
          return { 
            content: [{ 
              type: 'text', 
              text: `❌ State not found: ${key}` 
            }] 
          };
        }
        
        const result = db.prepare(
          'DELETE FROM memories WHERE key = ?'
        ).run(stateKey);
        
        db.close();
        
        let output = `🗑️ State Deleted\\n`;
        output += `🔑 Key: ${key}\\n`;
        output += `📁 Category: ${category}\\n`;
        output += `✅ Successfully deleted state entry`;
        
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { 
          content: [{ 
            type: 'text', 
            text: `❌ Error deleting state: ${error.message}` 
          }] 
        };
      }
    }
  },
  
  {
    name: 'state_clear',
    description: 'Clear all state entries in a category',
    inputSchema: {
      type: 'object',
      properties: {
        category: { 
          type: 'string', 
          description: 'Category to clear',
          enum: ['cache', 'session'],
          default: 'cache'
        },
        confirm: { 
          type: 'boolean', 
          description: 'Confirm deletion',
          default: false
        }
      },
      required: ['confirm']
    },
    handler: async ({ category = 'cache', confirm = false }) => {
      if (!confirm) {
        return { 
          content: [{ 
            type: 'text', 
            text: '⚠️ Please set confirm: true to clear state entries' 
          }] 
        };
      }
      
      if (!['cache', 'session'].includes(category)) {
        return { 
          content: [{ 
            type: 'text', 
            text: '❌ Only cache and session categories can be cleared' 
          }] 
        };
      }
      
      try {
        const db = new Database(BRAIN_DB_PATH);
        
        const result = db.prepare(
          `DELETE FROM memories 
           WHERE type = 'state' AND key LIKE ?`
        ).run(`state_${category}_%`);
        
        db.close();
        
        let output = `🗑️ State Cleared\\n`;
        output += `📁 Category: ${category}\\n`;
        output += `📊 Entries deleted: ${result.changes}\\n`;
        output += `✅ Successfully cleared ${category} state`;
        
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { 
          content: [{ 
            type: 'text', 
            text: `❌ Error clearing state: ${error.message}` 
          }] 
        };
      }
    }
  },

  {
    name: 'state_transaction',
    description: 'Perform multiple state operations atomically',
    inputSchema: {
      type: 'object',
      properties: {
        operations: {
          type: 'array',
          description: 'Array of state operations',
          items: {
            type: 'object',
            properties: {
              action: { 
                type: 'string', 
                enum: ['set', 'delete'],
                description: 'Operation type'
              },
              key: { type: 'string', description: 'State key' },
              value: { description: 'State value (for set operations)' },
              category: { 
                type: 'string',
                enum: ['system', 'project', 'config', 'cache', 'session'],
                default: 'system'
              }
            },
            required: ['action', 'key']
          }
        }
      },
      required: ['operations']
    },
    handler: async ({ operations }) => {
      if (!operations || operations.length === 0) {
        return { 
          content: [{ 
            type: 'text', 
            text: '❌ No operations provided' 
          }] 
        };
      }
      
      const db = new Database(BRAIN_DB_PATH);
      const timestamp = new Date().toISOString();
      const results = [];
      
      try {
        db.prepare('BEGIN').run();
        
        for (const op of operations) {
          const stateKey = `state_${op.category || 'system'}_${op.key}`;
          
          if (op.action === 'set') {
            const valueStr = typeof op.value === 'string' ? op.value : JSON.stringify(op.value);
            
            const existing = db.prepare(
              'SELECT metadata FROM memories WHERE key = ?'
            ).get(stateKey);
            
            const metadata = {
              category: op.category || 'system',
              original_key: op.key,
              updated_by: 'brain_unified_mcp',
              version: 1
            };
            
            if (existing) {
              const existingMeta = JSON.parse(existing.metadata);
              metadata.version = (existingMeta.version || 0) + 1;
            }
            
            db.prepare(
              `INSERT OR REPLACE INTO memories 
               (key, value, type, created_at, updated_at, accessed_at, metadata) 
               VALUES (?, ?, 'state', 
                       COALESCE((SELECT created_at FROM memories WHERE key = ?), ?), 
                       ?, ?, ?)`
            ).run(
              stateKey, 
              valueStr, 
              stateKey,
              timestamp, 
              timestamp, 
              timestamp,
              JSON.stringify(metadata)
            );
            
            results.push({ action: 'set', key: op.key, success: true });
            
          } else if (op.action === 'delete') {
            const result = db.prepare(
              'DELETE FROM memories WHERE key = ?'
            ).run(stateKey);
            
            results.push({ 
              action: 'delete', 
              key: op.key, 
              success: result.changes > 0 
            });
          }
        }
        
        db.prepare('COMMIT').run();
        db.close();
        
        let output = `🔄 State Transaction Complete\\n`;
        output += `═══════════════════════\\n\\n`;
        output += `📊 Operations: ${operations.length}\\n`;
        output += `✅ Successful: ${results.filter(r => r.success).length}\\n`;
        output += `❌ Failed: ${results.filter(r => !r.success).length}\\n\\n`;
        
        output += `📋 Results:\\n`;
        for (const result of results) {
          output += `  ${result.success ? '✅' : '❌'} ${result.action}: ${result.key}\\n`;
        }
        
        return { content: [{ type: 'text', text: output }] };
        
      } catch (error) {
        try {
          db.prepare('ROLLBACK').run();
        } catch {}
        db.close();
        
        return { 
          content: [{ 
            type: 'text', 
            text: `❌ Transaction error: ${error.message}` 
          }] 
        };
      }
    }
  },
  
// ===== OBSIDIAN TOOLS =====
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
        folder: { type: 'string' }
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
        // Debug: Log the Python code being executed
        // console.log("=== BRAIN ANALYZE PYTHON CODE ===");
        // console.log(pythonCode);
        // console.log("==================================");
        
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
                output += result.content;
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
              output += `📚 Found ${notesList.length} notes:\\n`;
              for (const note of notesList.slice(0, 20)) {
                output += `  • ${note.identifier} (${note.path})\\n`;
              }
              if (notesList.length > 20) {
                output += `  ... and ${notesList.length - 20} more`;
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
  },
  
  {
    name: 'unified_search',
    description: 'Search across both Brain memory and Obsidian notes',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number', default: 20 },
        source: { type: 'string', enum: ['all', 'brain', 'obsidian'], default: 'all' }
      },
      required: ['query']
    },
    handler: async ({ query, limit = 20, source = 'all' }) => {
      // Escape query to prevent Python injection
      const escapedQuery = query.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      
      const pythonCode = `
import sys
import json
import warnings
warnings.filterwarnings('ignore')

sys.path.insert(0, '${BRAIN_NOTES_PATH}')

try:
    from obsidian_integration.unified_search import UnifiedSearch
    searcher = UnifiedSearch(brain_db_path="${BRAIN_DB_PATH}", vault_path="${VAULT_PATH}")
    
    # Debug: log the query being executed
    print(f"Executing search with query: ${escapedQuery}, limit: ${limit}, source: ${source}", file=sys.stderr)
    
    results = searcher.search("${escapedQuery}", limit=${limit}, source="${source}")
    
    # Debug: log what we got back
    print(f"Search returned: {results}", file=sys.stderr)
    
    # Process results by source
    all_results = results.get("results", [])
    brain_results = [r for r in all_results if r.get("source") == "brain"]
    obsidian_results = [r for r in all_results if r.get("source") == "obsidian"]
    
    output = {
        "brain_count": len(brain_results),
        "obsidian_count": len(obsidian_results),
        "merged": all_results[:10]
    }
    
    print(json.dumps(output))
except Exception as e:
    output = {
        "error": str(e),
        "brain_count": 0,
        "obsidian_count": 0,
        "merged": []
    }
    print(json.dumps(output))
`;

      try {
        // Debug: Log the Python code being executed
        // console.log("=== BRAIN ANALYZE PYTHON CODE (1) ===");
        // console.log(pythonCode);
        // console.log("=====================================");
        
        const { stdout, stderr } = await executePythonViaSpawn(pythonCode);
        
        // Only log stderr if it's not just warnings
        if (stderr) {
          console.error(`Brain analyze stderr: ${stderr}`);
        }
        
        // Debug: Log raw stdout
        // console.log("=== RAW STDOUT ===");
        // console.log(stdout);
        // console.log("==================");

        
        // Try to extract JSON from stdout even if there's extra output
        let results;
        try {
          // Find the last valid JSON in the output
          const jsonMatch = stdout.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
          if (jsonMatch) {
            results = JSON.parse(jsonMatch[jsonMatch.length - 1]);
          } else {
            throw new Error('No valid JSON found in output');
          }
        } catch (parseError) {
          console.error('Failed to parse output:', stdout);
          results = { error: 'Failed to parse search results', brain_count: 0, obsidian_count: 0, merged: [] };
        }
        
        let output = `🔍 Searching for: "${query}"\\n\\n`;
        
        if (results.error) {
          output += `❌ Error: ${results.error}\\n`;
        } else {
          output += `📊 Found: ${results.brain_count} Brain | ${results.obsidian_count} Obsidian\\n\\n`;
          
          if (results.merged && results.merged.length > 0) {
            output += '🔝 Top Results:\\n';
            for (const [i, result] of results.merged.entries()) {
              if (result.source === 'brain') {
                output += `\\n${i+1}. 🧠 ${result.key}\\n`;
                output += `   Type: ${result.type}\\n`;
              } else {
                output += `\\n${i+1}. 📝 ${result.title}\\n`;
                output += `   Path: ${result.path}\\n`;
              }
              output += `   Score: ${result.final_score?.toFixed(3) || 'N/A'}\\n`;
            }
          } else {
            output += '❌ No results found';
          }
        }
        
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { 
          content: [{ 
            type: 'text', 
            text: `❌ Search error: ${error.message}` 
          }] 
        };
      }
    }
  },
  
  {
    name: 'brain_analyze',
    description: 'Analyze Obsidian vault for insights, connections, and patterns',
    inputSchema: {
      type: 'object',
      properties: {
        analysis_type: { 
          type: 'string', 
          enum: ['full', 'connections', 'orphans', 'patterns', 'insights'],
          default: 'full'
        },
        save_report: { type: 'boolean', default: false }
      }
    },
    handler: async ({ analysis_type = 'full', save_report = false }) => {
      // DEBUG: Proof of life logging
      fs.appendFileSync(DEBUG_LOG_FILE, `\n=== BRAIN_ANALYZE HANDLER CALLED ===\n`);
      fs.appendFileSync(DEBUG_LOG_FILE, `Time: ${new Date().toISOString()}\n`);
      fs.appendFileSync(DEBUG_LOG_FILE, `Analysis type: ${analysis_type}\n`);
      fs.appendFileSync(DEBUG_LOG_FILE, `Handler location: NEW SPAWN-BASED HANDLER\n`);
      
      const pythonCode = `
import sys
import json
import warnings
import traceback

warnings.filterwarnings('ignore')

sys.path.insert(0, '${BRAIN_NOTES_PATH}')

try:
    from obsidian_integration.brain_analyzer import BrainAnalyzer
    analyzer = BrainAnalyzer(vault_path="${VAULT_PATH}")
    results = analyzer.full_analysis()
    
    if "${analysis_type}" == "full":
        # Get connections dict first
        connections_dict = results.get("connections", {}).get("connections", {})
        top_hubs_list = list(connections_dict.items())[:5]
        
        output = {
            "stats": results.get("patterns", {}),
            "insights": results.get("insights", {}).get("insights", [])[:3],
            "orphan_count": len(results.get("orphans", {}).get("orphans", [])),
            "hub_count": len(connections_dict),
            "top_hubs": top_hubs_list
        }
    elif "${analysis_type}" == "connections":
        output = {"connections": results.get("connections", {})}
    elif "${analysis_type}" == "orphans":
        orphans_list = results.get("orphans", {}).get("orphans", [])
        output = {"orphans": orphans_list[:20]}
    elif "${analysis_type}" == "patterns":
        output = results.get("patterns", {})
    elif "${analysis_type}" == "insights":
        output = {"insights": results.get("insights", {}).get("insights", [])}
    else:
        output = {"error": "Unknown analysis type"}
    
    print(json.dumps(output))
except Exception as e:
    error_report = {
        "error": "Python execution failed",
        "exception_type": str(type(e).__name__),
        "exception_message": str(e),
        "traceback": traceback.format_exc()
    }
    print(json.dumps(error_report))
    sys.exit(1)
`;

      try {
        // Debug: Log the Python code being executed
        // console.log("=== BRAIN ANALYZE PYTHON CODE (2) ===");
        // console.log(pythonCode);
        // console.log("=====================================");
        
        const { stdout, stderr } = await executePythonViaSpawn(pythonCode);
        
        // Only log stderr if it's not just warnings
        if (stderr) {
          console.error(`Brain analyze stderr: ${stderr}`);
        }
        
        // Debug: Log raw stdout
        // console.log("=== RAW STDOUT ===");
        // console.log(stdout);
        // console.log("==================");
        
        // Try to extract JSON from stdout
        let results;
        try {
          // Find the last valid JSON in the output
          const jsonMatch = stdout.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
          if (jsonMatch) {
            results = JSON.parse(jsonMatch[jsonMatch.length - 1]);
          } else {
            throw new Error('No valid JSON found in output');
          }
        } catch (parseError) {
          console.error('Failed to parse output:', stdout);
          results = { error: 'Failed to parse analysis results' };
        }
        
        let output = `🧠 Vault Analysis (${analysis_type})\\n\\n`;
        
        if (results.error) {
          output += `❌ Error: ${results.error}`;
        } else {
          switch (analysis_type) {
            case 'full':
              output += '📊 Statistics:\\n';
              if (results.stats) {
                output += `  • Total notes: ${results.stats.total_notes || 0}\\n`;
                output += `  • Total words: ${(results.stats.total_words || 0).toLocaleString()}\\n`;
                output += `  • Avg links/note: ${(results.stats.avg_links_per_note || 0).toFixed(1)}\\n`;
              }
              output += `  • Orphan notes: ${results.orphan_count || 0}\\n`;
              output += `  • Hub notes: ${results.hub_count || 0}\\n\\n`;
              
              if (results.insights && results.insights.length > 0) {
                output += '💡 Insights:\\n';
                for (const insight of results.insights) {
                  output += `  • ${insight}\\n`;
                }
              }
              
              if (results.top_hubs && results.top_hubs.length > 0) {
                output += '\\n🔗 Top Hub Notes:\\n';
                for (const hub of results.top_hubs) {
                  output += `  • ${hub.note}: ${hub.connections} connections\\n`;
                }
              }
              break;
              
            case 'connections':
              if (results.suggestions && results.suggestions.length > 0) {
                output += '🔗 Connection Suggestions:\\n';
                for (const suggestion of results.suggestions) {
                  output += `  • ${suggestion}\\n`;
                }
              } else {
                output += '❌ No connection suggestions found';
              }
              break;
              
            case 'orphans':
              if (results.orphans && results.orphans.length > 0) {
                output += `📝 Orphan Notes (${results.orphans.length}):\\n`;
                for (const orphan of results.orphans) {
                  output += `  • ${orphan}\\n`;
                }
              } else {
                output += '✅ No orphan notes found!';
              }
              break;
              
            case 'patterns':
              output += '🔍 Patterns Found:\\n';
              output += JSON.stringify(results, null, 2);
              break;
              
            case 'insights':
              if (results.insights && results.insights.length > 0) {
                output += '💡 All Insights:\\n';
                for (const insight of results.insights) {
                  output += `  • ${insight}\\n`;
                }
              } else {
                output += '❌ No insights generated';
              }
              break;
          }
        }
        
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        fs.appendFileSync(DEBUG_LOG_FILE, `\nERROR in brain_analyze: ${error.message}\n`);
        fs.appendFileSync(DEBUG_LOG_FILE, `Stack: ${error.stack}\n`);
        fs.appendFileSync(DEBUG_LOG_FILE, `Time: ${new Date().toISOString()}\n`);
        return {
          content: [{ 
            type: 'text', 
            text: `❌ Analysis error: ${error.message}` 
          }] 
        };
      }
    }
  },
  
  {
    name: 'brain_help',
    description: 'Get help on using Brain tools',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Specific command to get help for (or "all" for overview)'
        }
      }
    },
    handler: async ({ command }) => {
      let helpText = '';
      
      if (!command || command === 'all') {
        helpText = `🧠 Brain Unified Server Help
============================

The Brain provides persistent memory, state management, code execution, and Obsidian integration.

Available commands:

📊 STATE MANAGEMENT
  state_set - Store state values with versioning
  state_get - Retrieve state values by key/category
  state_list - List all state entries
  state_delete - Delete specific state entry
  state_clear - Clear cache/session state
  state_transaction - Atomic multi-operation updates
  state_migrate - Migrate memories to state table

🧠 CORE BRAIN TOOLS  
  brain_init - Initialize session and load context
  brain_remember - Store information in memory
  brain_recall - Search through memories
  brain_status - Check system status
  brain_execute - Execute Python/Shell code

📝 OBSIDIAN INTEGRATION
  obsidian_note - Create/read/update/delete notes
  unified_search - Search Brain + Obsidian
  brain_analyze - Analyze vault patterns/insights

❓ brain_help - Show this help
  Optional: command (specific command for details)

Use 'brain_help' with a specific command for detailed information.`;
      } else {
        switch (command) {
          case 'brain_init':
            helpText = `🧠 brain_init - Initialize Brain session

Loads user preferences and recent memories to start a session.

Parameters:
- reload: Force reload (default: false)

Example:
brain_init { "reload": false }

Returns:
- Session status
- User preferences
- Recent memory count`;
            break;
            
          case 'brain_remember':
            helpText = `💾 brain_remember - Store information in memory

Saves data to Brain's persistent memory with categorization.

Parameters:
- key (required): Unique identifier for the memory
- value (required): Data to store (string or JSON)
- type: Category (default: "general")
  Options: "general", "project", "pattern", "config"

Example:
brain_remember {
  "key": "project_api_notes",
  "value": { "status": "in progress", "tasks": [...] },
  "type": "project"
}`;
            break;
            
          case 'brain_recall':
            helpText = `🔍 brain_recall - Search through memories

Searches both keys and values for matching content.

Parameters:
- query (required): Search term
- limit: Max results (default: 10)

Example:
brain_recall { "query": "API project", "limit": 5 }

Notes:
- Searches are case-insensitive
- Updates access time for found memories
- Returns key, type, and content preview`;
            break;
            
          case 'brain_execute':
            helpText = `🖥️ brain_execute - Execute code with system access

Runs Python or Shell code with full system permissions.

Parameters:
- code (required): Code to execute
- language: "python", "shell", or "auto" (default: "auto")
- description: What this code does

Examples:
// Python
brain_execute {
  "code": "import os\\nprint(os.getcwd())",
  "language": "python",
  "description": "Get current directory"
}

// Shell
brain_execute {
  "code": "ls -la | grep .json",
  "language": "shell",
  "description": "List JSON files"
}

Notes:
- Auto-detects language from code patterns
- Logs all executions with timestamps
- Returns output, errors, and execution time`;
            break;
            
          case 'state_set':
            helpText = `📊 state_set - Store state with versioning

Saves state values with automatic versioning and metadata.

Parameters:
- key (required): State key
- value (required): Value to store (auto-stringified)
- category: State category (default: "system")
  Options: "system", "project", "config", "cache", "session"

Example:
state_set {
  "key": "current_project",
  "value": { "name": "api-server", "phase": "testing" },
  "category": "session"
}

Notes:
- Automatically increments version on updates
- Preserves creation timestamp
- Stores metadata about updates`;
            break;
            
          case 'state_transaction':
            helpText = `🔄 state_transaction - Atomic state operations

Perform multiple state operations as a single transaction.

Parameters:
- operations (required): Array of operations
  Each operation:
  - action: "set" or "delete"
  - key: State key
  - value: Value (for set operations)
  - category: Category (default: "system")

Example:
state_transaction {
  "operations": [
    {
      "action": "set",
      "key": "project_status",
      "value": "completed",
      "category": "project"
    },
    {
      "action": "delete",
      "key": "temp_data",
      "category": "cache"
    }
  ]
}

Notes:
- All operations succeed or all fail
- Automatic rollback on error`;
            break;
            
          case 'obsidian_note':
            helpText = `📝 obsidian_note - Manage Obsidian notes

Create, read, update, delete, or list notes in your vault.

Parameters:
- action (required): Operation to perform
  Options: "create", "read", "update", "delete", "list"
- title: Note title (for create)
- content: Note content (for create/update)
- identifier: Note ID or path (for read/update/delete)
- metadata: Frontmatter metadata object
- folder: Folder to list notes from

Examples:
// Create
obsidian_note {
  "action": "create",
  "title": "Project Meeting Notes",
  "content": "## Agenda\\n- Review progress",
  "metadata": { "tags": ["meeting", "project"] }
}

// Read
obsidian_note {
  "action": "read",
  "identifier": "Project Meeting Notes"
}

// List
obsidian_note {
  "action": "list",
  "folder": "Projects"
}`;
            break;
            
          case 'unified_search':
            helpText = `🔍 unified_search - Search Brain + Obsidian

Search across both Brain memories and Obsidian notes.

Parameters:
- query (required): Search term
- limit: Max results (default: 20)
- source: Where to search
  Options: "all", "brain", "obsidian"

Example:
unified_search {
  "query": "API authentication",
  "limit": 10,
  "source": "all"
}

Returns:
- Merged results ranked by relevance
- Source indication for each result
- Relevance scores`;
            break;
            
          case 'brain_analyze':
            helpText = `🔬 brain_analyze - Analyze vault patterns

Analyze your Obsidian vault for insights and patterns.

Parameters:
- analysis_type: Type of analysis (default: "full")
  Options:
  - "full": Complete analysis with all metrics
  - "connections": Note linking patterns
  - "orphans": Unlinked notes
  - "patterns": Content patterns
  - "insights": AI-generated insights
- save_report: Save results as note (default: false)

Example:
brain_analyze {
  "analysis_type": "connections",
  "save_report": true
}

Returns:
- Statistics (word count, link density)
- Orphan notes list
- Hub notes (most connected)
- Actionable insights`;
            break;
            
          default:
            helpText = `Command '${command}' not found. Use 'brain_help' without arguments to see all commands.`;
        }
      }
      
      return { content: [{ type: 'text', text: helpText }] };
    }
  }
];

// Create and configure server
const server = new Server(
  {
    name: 'brain-unified',
    version: '1.1.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Set up handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }))
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = tools.find(t => t.name === name);
  
  if (!tool) {
    return {
      content: [{
        type: 'text',
        text: `Unknown tool: ${name}`
      }]
    };
  }
  
  try {
    return await tool.handler(args || {});
  } catch (error) {
    console.error(`Error in tool ${name}:`, error);
    return {
      content: [{
        type: 'text',
        text: `⚠️ Error: ${error.message}`
      }]
    };
  }
});

// Start server
async function main() {
  console.error('[Brain Unified] Starting server v1.1.0...');
  console.error(`[Brain Unified] Working directory: ${__dirname}`);
  console.error(`[Brain Unified] Python path: ${PYTHON_PATH}`);
  console.error(`[Brain Unified] Vault path: ${VAULT_PATH}`);
  
  // Initialize state table
  initializeStateTable();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('[Brain Unified] Server ready with tools:', tools.map(t => t.name).join(', '));
}

main().catch(error => {
  console.error('[Brain Unified] Fatal error:', error);
  process.exit(1);
});
