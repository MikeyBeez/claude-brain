
import { CONFIG } from "./config.js";
/**
 * Brain Unified MCP Server
 * 
 * MAIN SERVER: /Users/bard/Code/claude-brain/index.js
 * 
 * KEY COMPONENTS:
 * - brain_init_v5_working.js: Enhanced brain initialization (V5 implementation)
 * - config.js: Path configuration and settings
 * - data/brain/brain.db: SQLite database
 * - /Users/bard/Documents/Obsidian: Actual Obsidian vault location
 * - data/logs/execution: Execution logs
 * 
 * Combines all Brain tools and Obsidian integration tools in one server.
 * The brain_init_v5_working function provides enhanced cognitive architecture.
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
import { OutputFilter, detectCommandType } from './output-filter-esm.js';
import { analysisMetatag, wrapInMetatag } from './metatags-local.js';
import { formatTimestampChicago } from './timezone-fix.js';
import { brainInitV5Tool, brainInitV5StatusTool } from './brain-init-v5-tools.js';
import { brainInitV5WorkingTool } from './brain_init_v5_working_tool.js';

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
    name: 'mikey_state_migrate',
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
    name: 'mikey_init',
    description: 'Initialize Brain session and load context',
    inputSchema: {
      type: 'object',
      properties: {
        reload: { type: 'boolean', description: 'Force reload' }
      }
    },
    handler: async ({ reload = false }) => {
      try {
        fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: Enhanced Cognitive Architecture brain_init called with reload=${reload}\n`);

        // Get current timestamp for session
        const now = new Date();
        const timestamp = now.toLocaleString('en-US', {
          timeZone: 'America/Chicago',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).replace(',', '') + ' CST';

        // Phase 0.1: Read session working files (FIFO - last 50 lines)
        let sessionStatus = '';
        let scratchpad = '';
        const SESSION_STATUS_PATH = '/Users/bard/Code/docs/session-status.md';
        const SCRATCHPAD_PATH = '/Users/bard/Code/docs/scratchpad.md';

        try {
          if (fs.existsSync(SESSION_STATUS_PATH)) {
            const content = fs.readFileSync(SESSION_STATUS_PATH, 'utf8');
            const lines = content.split('\n').slice(-50);
            sessionStatus = lines.join('\n').trim();
            fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: Loaded session-status.md (${lines.length} lines)\n`);
          }
        } catch (e) {
          fs.appendFileSync(DEBUG_LOG_FILE, `\nWARNING: Could not load session-status.md: ${e.message}\n`);
        }

        try {
          if (fs.existsSync(SCRATCHPAD_PATH)) {
            const content = fs.readFileSync(SCRATCHPAD_PATH, 'utf8');
            const lines = content.split('\n').slice(-50);
            scratchpad = lines.join('\n').trim();
            fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: Loaded scratchpad.md (${lines.length} lines)\n`);
          }
        } catch (e) {
          fs.appendFileSync(DEBUG_LOG_FILE, `\nWARNING: Could not load scratchpad.md: ${e.message}\n`);
        }

        // Phase 0.2: Read System State Note (solves chicken/egg problem)
        let systemState = null;
        try {
          const systemStatePath = path.join(VAULT_PATH, 'System State.md');
          fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: Attempting to load System State from: ${systemStatePath}\n`);
          
          if (fs.existsSync(systemStatePath)) {
            fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: System State file exists, reading content\n`);
            const stateContent = fs.readFileSync(systemStatePath, 'utf8');
            fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: System State content length: ${stateContent.length}\n`);
            
            // Parse the markdown to extract key information
            const projectMatch = stateContent.match(/\*\*Active Project\*\*: (.+)/);  
            const statusMatch = stateContent.match(/\*\*Status\*\*: (.+)/);
            const continuationMatch = stateContent.match(/\*\*Continuation Note\*\*: (.+)/);
            
            fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: Project match: ${projectMatch}\n`);
            fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: Status match: ${statusMatch}\n`);
            
            systemState = {
              activeProject: projectMatch ? projectMatch[1].trim() : null,
              status: statusMatch ? statusMatch[1].trim() : null,
              continuationNote: continuationMatch ? continuationMatch[1].trim() : null,
              loaded: true
            };
            
            fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: System State loaded from Obsidian note - Project: ${systemState.activeProject}, Status: ${systemState.status}\n`);
          } else {
            fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: System State note not found at ${systemStatePath}, using database state\n`);
          }
        } catch (stateError) {
          fs.appendFileSync(DEBUG_LOG_FILE, `\nWARNING: Could not load System State note: ${stateError.message}\n`);
          fs.appendFileSync(DEBUG_LOG_FILE, `\nWARNING: Stack trace: ${stateError.stack}\n`);
        }
        
        // Phase 1: Basic Initialization (existing functionality)
        const db = new Database(BRAIN_DB_PATH, { readonly: true });
        
        const preferences = db.prepare(
          'SELECT value FROM memories WHERE key = ? LIMIT 1'
        ).get('user_preferences');
        
        const recentMemories = db.prepare(
          'SELECT key, type, created_at FROM memories ORDER BY accessed_at DESC LIMIT 10'
        ).all();
        
        // Load capability framework (text-based)
        let capabilityFramework = null;
        try {
          const capabilityResult = db.prepare(
            'SELECT value FROM memories WHERE key = ? LIMIT 1'
          ).get('core_capability_framework');
          
          if (capabilityResult) {
            capabilityFramework = capabilityResult.value;
            fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: Loaded core capability framework\n`);
          }
        } catch (capError) {
          fs.appendFileSync(DEBUG_LOG_FILE, `\nWARNING: Could not load capability framework: ${capError.message}\n`);
        }
        
        // Load last project context
        let lastProject = null;
        try {
          const projectResult = db.prepare(
            'SELECT value FROM memories WHERE key = ? LIMIT 1'
          ).get('last_project');
          
          if (projectResult) {
            try {
              lastProject = JSON.parse(projectResult.value);
              fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: Loaded last project context: ${lastProject.name}\n`);
            } catch (parseError) {
              lastProject = { name: projectResult.value, status: 'loaded' };
              fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: Loaded text project context: ${projectResult.value}\n`);
            }
          }
        } catch (projError) {
          fs.appendFileSync(DEBUG_LOG_FILE, `\nWARNING: Could not load project context: ${projError.message}\n`);
        }
        
        db.close();
        
        // Phase 2: Load Boot Loader Index and Protocols (existing)
        let bootLoaderContent = '';
        try {
          const bootLoaderPath = path.join(VAULT_PATH, 'architecture', 'Boot Loader Index - Critical System Initialization.md');
          if (fs.existsSync(bootLoaderPath)) {
            bootLoaderContent = fs.readFileSync(bootLoaderPath, 'utf8');
            
            const docsToLoad = [
              { name: 'Brain System Architecture', path: 'brain_system/Brain Architecture.md' },
              { name: 'Master Architecture Index', path: 'architecture/Master Architecture Index.md' }
            ];
            
            for (const doc of docsToLoad) {
              try {
                const docPath = path.join(VAULT_PATH, doc.path);
                if (fs.existsSync(docPath)) {
                  const content = fs.readFileSync(docPath, 'utf8');
                }
              } catch (docError) {
                fs.appendFileSync(DEBUG_LOG_FILE, `\nWARNING: Could not load ${doc.name}: ${docError.message}\n`);
              }
            }
          }
        } catch (bootError) {
          fs.appendFileSync(DEBUG_LOG_FILE, `\nWARNING: Boot Loader Index not accessible: ${bootError.message}\n`);
        }
        
        // Load protocols
        let protocolsLoaded = 0;
        fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: Starting protocol loading in enhanced brain_init\n`);
        try {
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
              }
            } catch (protocolError) {
              fs.appendFileSync(DEBUG_LOG_FILE, `\nWARNING: Could not load protocol ${protocolPath}: ${protocolError.message}\n`);
            }
          }
        } catch (protocolLoadError) {
          fs.appendFileSync(DEBUG_LOG_FILE, `\nWARNING: Could not load protocols: ${protocolLoadError.message}\n`);
        }
        
        // Phase 3: Load Comprehensive Tool Intelligence (NEW - 35% context target)
        fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: Loading comprehensive tool intelligence\n`);
        
        // Comprehensive Tool Matrix Intelligence
        const COMPREHENSIVE_TOOL_MATRIX = {
          totalTools: 202,
          cognitiveCategories: 6,
          categories: {
            memory: { 
              tools: 44, 
              primary: ["brain-manager", "memory-ema", "mercury-evolution", "brain"],
              description: "Long-term memory, context preservation, knowledge storage" 
            },
            analysis: { 
              tools: 25, 
              primary: ["reasoning-tools", "sequential-thinking", "advanced-math-tools", "bullshit-detector"],
              description: "Systematic thinking, verification, problem-solving" 
            },
            discovery: { 
              tools: 23, 
              primary: ["mcp-architecture", "project-finder", "smart-help", "tracked-search"],
              description: "Finding information, understanding systems, navigation" 
            },
            creation: { 
              tools: 39, 
              primary: ["filesystem-enhanced", "git", "smalledit", "system"],
              description: "Building, editing, version control, system management" 
            },
            workflow: { 
              tools: 38, 
              primary: ["protocols", "protocol-engine", "protocol-tracker", "todo-manager"],
              description: "Protocols, task management, coordination, monitoring" 
            },
            utilities: { 
              tools: 33, 
              primary: ["database", "random", "vision", "subconscious"],
              description: "Data operations, randomization, external services" 
            }
          }
        };
        
        // Integration Pathway Intelligence
        const INTEGRATION_PATHWAYS = {
          coreIntelligence: {
            name: "Memory→Analysis→Action",
            description: "Core intelligence loop for all significant tasks",
            tools: ["brain_recall", "reasoning_tools", "brain_remember", "git_commit"],
            usage: "Every significant task follows this pattern"
          },
          architectureFirst: {
            name: "Discovery→Context→Execution", 
            description: "Architecture-first approach to work",
            tools: ["arch_find_document", "brain_init", "protocol_engine"],
            usage: "Session initialization and complex task planning"
          },
          projectCentric: {
            name: "Project→Memory→Workflow",
            description: "Project-centric work management",
            tools: ["project_finder", "brain_manager", "protocol_tracker"],
            usage: "All development and analysis projects"
          },
          qualityAssured: {
            name: "Creation→Validation→Integration",
            description: "Quality-assured development workflow", 
            tools: ["filesystem", "bullshit_detector", "git", "brain_remember"],
            usage: "All content creation and code development"
          }
        };
        
        // Session Optimization Intelligence
        const SESSION_OPTIMIZATION = {
          contextTarget: 35,
          intelligenceLevel: "comprehensive",
          primaryFocus: "tool_awareness_and_integration",
          optimizations: [
            "Immediate access to all 202 tools across 6 cognitive domains",
            "4 primary integration pathways for optimal workflow",
            "Enhanced protocol execution with tool awareness",
            "Project context preservation across sessions"
          ]
        };
        
        fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: Comprehensive tool intelligence loaded - 202 tools, 6 categories, 4 pathways\n`);
        
        // Phase 4: Build Enhanced Output with Comprehensive Intelligence
        let output = `🧠 Initializing Enhanced Cognitive Architecture...\\n`;
        output += `⏰ **[${timestamp}]**\\n`;
        output += '✓ Created new session\\n';
        if (bootLoaderContent) {
          output += '✓ Boot Loader Index processed\\n';
        }
        if (protocolsLoaded > 0) {
          output += `✓ Loaded ${protocolsLoaded} core protocols into context\\n`;
        }
        
        // NEW: Comprehensive Tool Intelligence Display
        output += '\\n🧠 COMPREHENSIVE TOOL INTELLIGENCE LOADED:\\n';
        output += `✓ ${COMPREHENSIVE_TOOL_MATRIX.totalTools} tools across ${COMPREHENSIVE_TOOL_MATRIX.cognitiveCategories} cognitive domains analyzed\\n`;
        output += `✓ ${Object.keys(INTEGRATION_PATHWAYS).length} primary integration pathways mapped\\n`;
        output += '✓ Memory→Analysis→Action pipeline ready\\n';
        output += '✓ Discovery→Context→Execution pathway active\\n';
        
        // NEW: Cognitive Capabilities Display
        output += '\\n🔧 COGNITIVE CAPABILITIES ACTIVE:\\n';
        for (const [category, details] of Object.entries(COMPREHENSIVE_TOOL_MATRIX.categories)) {
          const primaryTools = details.primary.slice(0, 3).join(', ');
          output += `✓ ${category.charAt(0).toUpperCase() + category.slice(1)} & ${details.description.split(',')[0]} (${details.tools} tools): ${primaryTools}\\n`;
        }
        
        // NEW: Integration Intelligence Display
        output += '\\n🔗 INTEGRATION INTELLIGENCE READY:\\n';
        for (const [key, pathway] of Object.entries(INTEGRATION_PATHWAYS)) {
          output += `✓ ${pathway.name} (${pathway.description.split(' ')[0].toLowerCase()})\\n`;
        }
        
        // Enhanced Project Context (prioritize System State)
        if (systemState && systemState.loaded) {
          output += `\\n📂 PROJECT CONTEXT: ${systemState.activeProject || 'Unknown'} - ${systemState.status || 'Active'}`;
          if (systemState.continuationNote) {
            output += `\\n📄 Continuation: ${systemState.continuationNote.split('/').pop()}`;
          }
          output += '\\n';
        } else if (lastProject) {
          output += `\\n📂 PROJECT CONTEXT: ${lastProject.name || 'Unknown'}`;
          if (lastProject.status) {
            output += ` - ${lastProject.status}`;
          }
          output += '\\n';
        }
        
        // NEW: Session Optimization Status
        output += `\\n🎯 SESSION OPTIMIZATION: ${SESSION_OPTIMIZATION.contextTarget}% context loaded with ${SESSION_OPTIMIZATION.intelligenceLevel} intelligence\\n`;
        
        if (preferences) {
          const prefs = JSON.parse(preferences.value);
          output += '\\n✅ Enhanced Cognitive Architecture initialized successfully!\\n';
          output += `👤 User: ${prefs.nom_de_plume || 'default'}\\n`;
          output += `💾 Loaded ${recentMemories.length} recent memories`;
        }
        
        // Enhanced Protocol Reminder
        output += '\\n\\n📋 Enhanced Protocol Reminder: Architecture First → Tool Awareness → Smart Execution';

        // Session Working Files (FIFO - most recent context)
        if (sessionStatus) {
          output += '\\n\\n📄 SESSION STATUS (recent):\\n';
          output += sessionStatus;
        }
        if (scratchpad) {
          output += '\\n\\n📝 SCRATCHPAD (working notes):\\n';
          output += scratchpad;
        }

        // Search Hierarchy Reminder
        output += '\\n\\n🔍 SEARCH REMINDER: Check MIKEY_AGENT_ARCHITECTURE.md → locate → find (last resort)';

        // Write full output to file for debugging (Option A workaround for truncated outputs)
        const INIT_OUTPUT_FILE = '/tmp/mikey_init_output.txt';
        try {
          fs.writeFileSync(INIT_OUTPUT_FILE, output.replace(/\\\\n/g, '\\n'));
          output += `\\n\\n📁 Full output written to: ${INIT_OUTPUT_FILE}`;
        } catch (writeErr) {
          fs.appendFileSync(DEBUG_LOG_FILE, `\nWARNING: Could not write init output file: ${writeErr.message}\n`);
        }

        fs.appendFileSync(DEBUG_LOG_FILE, `\nDEBUG: Enhanced brain_init completed successfully - comprehensive intelligence loaded\n`);

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        fs.appendFileSync(DEBUG_LOG_FILE, `\nERROR in enhanced brain_init handler: ${error.message}\n`);
        fs.appendFileSync(DEBUG_LOG_FILE, `Stack trace: ${error.stack}\n`);
        fs.appendFileSync(DEBUG_LOG_FILE, `Handler type: enhanced_cognitive_architecture_brain_init\n`);
        
        // Fallback to basic initialization if enhanced loading fails
        return { 
          content: [{ 
            type: 'text', 
            text: `🧠 Initializing Brain (fallback mode)...\\n❌ Enhanced cognitive architecture failed: ${error.message}\\n✓ Basic initialization successful` 
          }]
        };
      }
    }
  },
  
  {
    name: 'mikey_remember',
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
    name: 'mikey_recall',
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
        
        // Wrap memory results in metatag for source attribution
        const wrappedOutput = wrapInMetatag(output, {
          origin: 'memory',
          confidence: 0.9,
          tool: 'brain_recall',
          query: query,
          details: `Found ${results.length} results`
        });
        
        return { content: [{ type: 'text', text: wrappedOutput }] };
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
    name: 'mikey_status',
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
        
        // Add gentle workflow reminder
        output += '\\n\\n📋 Protocol Reminder: Read prompt → Make plan → Check Master Protocol Index → Follow protocols\\n🔧 MODIFIED VERSION ACTIVE';
        
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
    name: 'mikey_execute',
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
    handler: async ({ code, language = 'auto', description, verbose = false }) => {
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
          output += `🐍 Executing python code: ${description || 'No description provided'}\n`;
          
          const { stdout, stderr } = await execAsync(
            `python3 -c '${code.replace(/'/g, "'\"'\"'")}'`,
            { maxBuffer: 10 * 1024 * 1024 }
          );
          
          rawOutput = stdout || '';
          if (stderr && !stderr.includes('Warning')) {
            rawOutput += `\n⚠️ Errors:\n${stderr}`;
          }
          
        } else {
          output += `🖥️ Executing shell command: ${description || 'No description provided'}\n`;
          
          const { stdout, stderr } = await execAsync(code, {
            shell: true,
            maxBuffer: 10 * 1024 * 1024
          });
          
          rawOutput = stdout || '';
          if (stderr) {
            rawOutput += `\n⚠️ Errors:\n${stderr}`;
          }
        }
        
        // Detect command type for better filtering
        const commandType = detectCommandType(code);
        
        // Filter output
        const filtered = filter.filter(rawOutput, commandType);
        
        if (filtered.metadata.filtered) {
          output += `📤 Output${filtered.metadata.truncated ? ' (filtered)' : ''}:\n${filtered.result}`;
          
          // Add metadata about filtering
          if (filtered.metadata.truncated) {
            output += `\n\n📊 Filtering info:\n`;
            output += `  • Original: ${filtered.metadata.originalLines} lines, ${filtered.metadata.originalSize}\n`;
            output += `  • Displayed: ${filtered.metadata.displayedLines || filtered.metadata.displayedChars} ${filtered.metadata.truncatedAt === 'lines' ? 'lines' : 'chars'}\n`;
            if (filtered.metadata.gitStats) {
              output += `  • Git stats: ${filtered.metadata.summary}\n`;
            }
            output += `  • Use verbose: true for full output`;
          }
        } else {
          output += `📤 Output:\n${filtered.result}`;
        }
        
        const executionTime = Date.now() - startTime;
        output += `\n⏱️ Execution time: ${executionTime}ms`;
        
        // Save execution log
        if (execId && logEntry) {
          logEntry.status = 'completed';
          logEntry.output = rawOutput; // Store full output in log
          logEntry.execution_time = executionTime / 1000;
          saveExecutionLog(execId, logEntry);
        }
        
        // Wrap output in metatag for source attribution
        const wrappedOutput = analysisMetatag(output, 'brain_execute');
        
        return { content: [{ type: 'text', text: wrappedOutput }] };
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
    name: 'mikey_state_set',
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
    name: 'mikey_state_get',
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
        output += `📅 Updated: ${formatTimestampChicago(result.updated_at)}\\n\\n`;
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
    name: 'mikey_state_list',
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
            output += `   📅 Updated: ${formatTimestampChicago(entry.updated_at)}\\n`;
            
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
    name: 'mikey_state_delete',
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
    name: 'mikey_state_clear',
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
    name: 'mikey_state_transaction',
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
    name: 'mikey_obsidian_note',
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
    name: 'mikey_search',
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
    name: 'mikey_analyze',
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
    name: 'mikey_help',
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
  mikey_state_set - Store state values with versioning
  mikey_state_get - Retrieve state values by key/category
  mikey_state_list - List all state entries
  mikey_state_delete - Delete specific state entry
  mikey_state_clear - Clear cache/session state
  mikey_state_transaction - Atomic multi-operation updates
  mikey_state_migrate - Migrate memories to state table

🧠 CORE BRAIN TOOLS
  mikey_init - Initialize session and load context
  mikey_remember - Store information in memory
  mikey_recall - Search through memories
  mikey_status - Check system status
  mikey_execute - Execute Python/Shell code

🗂️ MEMORY MANAGEMENT
  mikey_forget - Remove memories by key or pattern
  mikey_pin - Mark memories as important
  mikey_recent - Show recently accessed memories
  mikey_stats - Detailed brain statistics

📝 OBSIDIAN INTEGRATION
  mikey_obsidian_note - Create/read/update/delete notes
  mikey_search - Search Brain + Obsidian
  mikey_analyze - Analyze vault patterns/insights

❓ mikey_help - Show this help
  Optional: command (specific command for details)

Use 'mikey_help' with a specific command for detailed information.`;
      } else {
        switch (command) {
          case 'mikey_init':
            helpText = `🧠 mikey_init - Initialize Brain session

Loads user preferences and recent memories to start a session.

Parameters:
- reload: Force reload (default: false)

Example:
mikey_init { "reload": false }

Returns:
- Session status
- User preferences
- Recent memory count`;
            break;
            
          case 'mikey_remember':
            helpText = `💾 mikey_remember - Store information in memory

Saves data to Brain's persistent memory with categorization.

Parameters:
- key (required): Unique identifier for the memory
- value (required): Data to store (string or JSON)
- type: Category (default: "general")
  Options: "general", "project", "pattern", "config"

Example:
mikey_remember {
  "key": "project_api_notes",
  "value": { "status": "in progress", "tasks": [...] },
  "type": "project"
}`;
            break;
            
          case 'mikey_recall':
            helpText = `🔍 mikey_recall - Search through memories

Searches both keys and values for matching content.

Parameters:
- query (required): Search term
- limit: Max results (default: 10)

Example:
mikey_recall { "query": "API project", "limit": 5 }

Notes:
- Searches are case-insensitive
- Updates access time for found memories
- Returns key, type, and content preview`;
            break;
            
          case 'mikey_execute':
            helpText = `🖥️ mikey_execute - Execute code with system access

Runs Python or Shell code with full system permissions.

Parameters:
- code (required): Code to execute
- language: "python", "shell", or "auto" (default: "auto")
- description: What this code does

Examples:
// Python
mikey_execute {
  "code": "import os\\nprint(os.getcwd())",
  "language": "python",
  "description": "Get current directory"
}

// Shell
mikey_execute {
  "code": "ls -la | grep .json",
  "language": "shell",
  "description": "List JSON files"
}

Notes:
- Auto-detects language from code patterns
- Logs all executions with timestamps
- Returns output, errors, and execution time`;
            break;
            
          case 'mikey_state_set':
            helpText = `📊 mikey_mikey_state_set - Store state with versioning

Saves state values with automatic versioning and metadata.

Parameters:
- key (required): State key
- value (required): Value to store (auto-stringified)
- category: State category (default: "system")
  Options: "system", "project", "config", "cache", "session"

Example:
mikey_mikey_state_set {
  "key": "current_project",
  "value": { "name": "api-server", "phase": "testing" },
  "category": "session"
}

Notes:
- Automatically increments version on updates
- Preserves creation timestamp
- Stores metadata about updates`;
            break;
            
          case 'mikey_state_transaction':
            helpText = `🔄 mikey_mikey_state_transaction - Atomic state operations

Perform multiple state operations as a single transaction.

Parameters:
- operations (required): Array of operations
  Each operation:
  - action: "set" or "delete"
  - key: State key
  - value: Value (for set operations)
  - category: Category (default: "system")

Example:
mikey_mikey_state_transaction {
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
            
          case 'mikey_obsidian_note':
            helpText = `📝 mikey_mikey_obsidian_note - Manage Obsidian notes

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
mikey_mikey_obsidian_note {
  "action": "create",
  "title": "Project Meeting Notes",
  "content": "## Agenda\\n- Review progress",
  "metadata": { "tags": ["meeting", "project"] }
}

// Read
mikey_mikey_obsidian_note {
  "action": "read",
  "identifier": "Project Meeting Notes"
}

// List
mikey_mikey_obsidian_note {
  "action": "list",
  "folder": "Projects"
}`;
            break;
            
          case 'mikey_search':
            helpText = `🔍 mikey_search - Search Brain + Obsidian

Search across both Brain memories and Obsidian notes.

Parameters:
- query (required): Search term
- limit: Max results (default: 20)
- source: Where to search
  Options: "all", "brain", "obsidian"

Example:
mikey_search {
  "query": "API authentication",
  "limit": 10,
  "source": "all"
}

Returns:
- Merged results ranked by relevance
- Source indication for each result
- Relevance scores`;
            break;
            
          case 'mikey_analyze':
            helpText = `🔬 mikey_analyze - Analyze vault patterns

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
mikey_analyze {
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
  },
  
  // ===== MEMORY MANAGEMENT TOOLS =====
  {
    name: 'mikey_forget',
    description: 'Remove a memory by key or pattern',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Exact key to delete' },
        pattern: { type: 'string', description: 'Pattern to match (uses LIKE %pattern%)' },
        confirm: { type: 'boolean', description: 'Must be true to actually delete', default: false }
      }
    },
    handler: async ({ key, pattern, confirm = false }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);

        if (!key && !pattern) {
          db.close();
          return { content: [{ type: 'text', text: '❌ Must provide either key or pattern' }] };
        }

        // Find matching memories first
        let query, params;
        if (key) {
          query = `SELECT key, type FROM memories WHERE key = ?`;
          params = [key];
        } else {
          query = `SELECT key, type FROM memories WHERE key LIKE ?`;
          params = [`%${pattern}%`];
        }

        const matches = db.prepare(query).all(...params);

        if (matches.length === 0) {
          db.close();
          return { content: [{ type: 'text', text: `🔍 No memories found matching ${key || pattern}` }] };
        }

        if (!confirm) {
          db.close();
          let output = `⚠️ Would delete ${matches.length} memories:\n`;
          for (const m of matches.slice(0, 10)) {
            output += `  • ${m.key} (${m.type})\n`;
          }
          if (matches.length > 10) {
            output += `  ... and ${matches.length - 10} more\n`;
          }
          output += `\nSet confirm: true to proceed.`;
          return { content: [{ type: 'text', text: output }] };
        }

        // Actually delete
        let deleteQuery, deleteParams;
        if (key) {
          deleteQuery = `DELETE FROM memories WHERE key = ?`;
          deleteParams = [key];
        } else {
          deleteQuery = `DELETE FROM memories WHERE key LIKE ?`;
          deleteParams = [`%${pattern}%`];
        }

        const result = db.prepare(deleteQuery).run(...deleteParams);
        db.close();

        return { content: [{ type: 'text', text: `🗑️ Deleted ${result.changes} memories` }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  {
    name: 'mikey_pin',
    description: 'Mark a memory as important (pinned)',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Memory key to pin/unpin' },
        pinned: { type: 'boolean', description: 'Pin (true) or unpin (false)', default: true }
      },
      required: ['key']
    },
    handler: async ({ key, pinned = true }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);

        // Check if memory exists
        const memory = db.prepare('SELECT key, metadata FROM memories WHERE key = ?').get(key);
        if (!memory) {
          db.close();
          return { content: [{ type: 'text', text: `❌ Memory not found: ${key}` }] };
        }

        // Update metadata with pinned flag
        let metadata = {};
        try { metadata = JSON.parse(memory.metadata || '{}'); } catch {}
        metadata.pinned = pinned;
        metadata.pinnedAt = pinned ? new Date().toISOString() : null;

        db.prepare('UPDATE memories SET metadata = ? WHERE key = ?').run(JSON.stringify(metadata), key);
        db.close();

        return { content: [{ type: 'text', text: pinned ? `📌 Pinned: ${key}` : `📍 Unpinned: ${key}` }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  {
    name: 'mikey_recent',
    description: 'Show recently accessed or modified memories',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of memories to show', default: 10 },
        type: { type: 'string', description: 'Filter by type (project, pattern, general)' },
        pinned_only: { type: 'boolean', description: 'Show only pinned memories', default: false }
      }
    },
    handler: async ({ limit = 10, type, pinned_only = false }) => {
      try {
        const db = new Database(BRAIN_DB_PATH, { readonly: true });

        let query = `SELECT key, type, value, metadata, accessed_at, updated_at
                     FROM memories WHERE 1=1`;
        const params = [];

        if (type) {
          query += ` AND type = ?`;
          params.push(type);
        }

        if (pinned_only) {
          query += ` AND json_extract(metadata, '$.pinned') = true`;
        }

        query += ` ORDER BY accessed_at DESC LIMIT ?`;
        params.push(limit);

        const memories = db.prepare(query).all(...params);
        db.close();

        let output = `📚 Recent Memories${type ? ` (${type})` : ''}${pinned_only ? ' 📌' : ''}\n`;
        output += `═══════════════════════\n\n`;

        if (memories.length === 0) {
          output += 'No memories found.\n';
        } else {
          for (const m of memories) {
            let metadata = {};
            try { metadata = JSON.parse(m.metadata || '{}'); } catch {}
            const pin = metadata.pinned ? '📌 ' : '';
            const preview = (m.value || '').substring(0, 60).replace(/\n/g, ' ');
            output += `${pin}${m.key} (${m.type})\n`;
            output += `   ${preview}${m.value?.length > 60 ? '...' : ''}\n`;
            output += `   Last accessed: ${m.accessed_at}\n\n`;
          }
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  {
    name: 'mikey_stats',
    description: 'Detailed statistics about the brain system',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      try {
        const db = new Database(BRAIN_DB_PATH, { readonly: true });

        // Get counts by type
        const byType = db.prepare(`
          SELECT type, COUNT(*) as count
          FROM memories
          GROUP BY type
          ORDER BY count DESC
        `).all();

        // Get total and averages
        const totals = db.prepare(`
          SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN json_extract(metadata, '$.pinned') = true THEN 1 END) as pinned,
            AVG(LENGTH(value)) as avg_size,
            MIN(created_at) as oldest,
            MAX(updated_at) as newest
          FROM memories
        `).get();

        // Get state stats
        const stateStats = db.prepare(`
          SELECT COUNT(*) as count, COUNT(DISTINCT namespace) as namespaces
          FROM ${STATE_TABLE_NAME}
        `).get();

        // Most accessed
        const topAccessed = db.prepare(`
          SELECT key, type FROM memories
          ORDER BY accessed_at DESC LIMIT 5
        `).all();

        db.close();

        let output = `📊 Brain Statistics\n`;
        output += `═══════════════════════\n\n`;
        output += `📦 Total Memories: ${totals.total}\n`;
        output += `📌 Pinned: ${totals.pinned || 0}\n`;
        output += `📏 Avg Size: ${Math.round(totals.avg_size || 0)} bytes\n\n`;

        output += `📂 By Type:\n`;
        for (const t of byType) {
          output += `   ${t.type}: ${t.count}\n`;
        }

        output += `\n🗄️ State Table:\n`;
        output += `   Entries: ${stateStats.count}\n`;
        output += `   Namespaces: ${stateStats.namespaces}\n`;

        output += `\n📅 Timeline:\n`;
        output += `   Oldest: ${totals.oldest || 'N/A'}\n`;
        output += `   Newest: ${totals.newest || 'N/A'}\n`;

        output += `\n🔥 Recently Accessed:\n`;
        for (const m of topAccessed) {
          output += `   • ${m.key}\n`;
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  // ===== ACTIVE INFERENCE / REFLECTION TOOLS =====
  {
    name: 'mikey_reflect',
    description: 'Evaluate task outcome, score surprise, diagnose failures, propose protocol updates',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'What was the task?' },
        outcome: { type: 'string', description: 'What happened? (success/failure/partial)' },
        details: { type: 'string', description: 'Details of what occurred' },
        error_messages: { type: 'string', description: 'Any error messages encountered' },
        tools_used: {
          type: 'array',
          items: { type: 'string' },
          description: 'Which tools were used'
        }
      },
      required: ['task', 'outcome']
    },
    handler: async ({ task, outcome, details = '', error_messages = '', tools_used = [] }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);
        const timestamp = new Date().toISOString();

        // Calculate surprise score based on outcome
        let surpriseScore = 1;
        let failureClass = null;

        if (outcome === 'failure' || outcome === 'error') {
          surpriseScore = 8;
        } else if (outcome === 'partial') {
          surpriseScore = 5;
        } else if (outcome === 'success') {
          surpriseScore = 1;
        }

        // Adjust based on error presence
        if (error_messages && error_messages.length > 0) {
          surpriseScore = Math.min(10, surpriseScore + 2);
        }

        // Classify failure type
        if (surpriseScore >= 5) {
          if (error_messages.includes('not found') ||
              error_messages.includes('permission denied') ||
              error_messages.includes('timeout') ||
              error_messages.includes('connection')) {
            failureClass = 'EXECUTION';
          } else if (error_messages.includes('unclear') ||
                     error_messages.includes('ambiguous') ||
                     details.includes('wrong result')) {
            failureClass = 'SPECIFICATION';
          } else if (error_messages.includes('too complex') ||
                     error_messages.includes('context') ||
                     tools_used.length > 10) {
            failureClass = 'CAPABILITY';
          } else {
            failureClass = 'UNKNOWN';
          }
        }

        // Build reflection record
        const reflection = {
          task,
          outcome,
          details,
          error_messages,
          tools_used,
          surprise_score: surpriseScore,
          failure_class: failureClass,
          timestamp,
          requires_review: surpriseScore >= 7
        };

        // Store in memories
        const reflectionKey = `reflection_${timestamp.replace(/[:.]/g, '-')}`;
        db.prepare(`
          INSERT OR REPLACE INTO memories (key, value, type, metadata, created_at, updated_at, accessed_at)
          VALUES (?, ?, 'reflection', '{}', ?, ?, ?)
        `).run(reflectionKey, JSON.stringify(reflection), timestamp, timestamp, timestamp);

        let output = `🔍 Reflection Analysis\n`;
        output += `═══════════════════════\n\n`;
        output += `📋 Task: ${task}\n`;
        output += `📊 Outcome: ${outcome}\n`;
        output += `⚡ Surprise Score: ${surpriseScore}/10\n`;

        if (failureClass) {
          output += `\n🏷️ Failure Classification: ${failureClass}\n`;

          if (failureClass === 'EXECUTION') {
            output += `   → World didn't cooperate (retry, check prerequisites)\n`;
          } else if (failureClass === 'SPECIFICATION') {
            output += `   → Protocol unclear or incomplete (revise protocol)\n`;
          } else if (failureClass === 'CAPABILITY') {
            output += `   → Task too complex for current approach (graduate to tool)\n`;
          }
        }

        // If high surprise, suggest protocol review
        if (surpriseScore >= 7) {
          output += `\n⚠️ HIGH SURPRISE - Protocol review recommended\n`;
          output += `   Use mikey_propose to suggest protocol changes\n`;

          // Log to proposals directory indicator
          const proposalNeeded = {
            reflection_key: reflectionKey,
            task,
            failure_class: failureClass,
            suggested_action: failureClass === 'SPECIFICATION' ? 'MODIFY_PROTOCOL' :
                             failureClass === 'CAPABILITY' ? 'GRADUATE_TO_TOOL' : 'RETRY'
          };

          db.prepare(`
            INSERT OR REPLACE INTO memories (key, value, type, metadata, created_at, updated_at, accessed_at)
            VALUES (?, ?, 'proposal_needed', '{}', ?, ?, ?)
          `).run(`proposal_needed_${reflectionKey}`, JSON.stringify(proposalNeeded), timestamp, timestamp, timestamp);
        }

        db.close();

        output += `\n✅ Reflection stored as: ${reflectionKey}`;

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  {
    name: 'mikey_propose',
    description: 'Propose a protocol change based on reflection',
    inputSchema: {
      type: 'object',
      properties: {
        protocol_id: { type: 'string', description: 'Which protocol to modify (or "new" for new protocol)' },
        change_type: {
          type: 'string',
          enum: ['add_step', 'clarify_step', 'add_trigger', 'add_failure_mode', 'new_protocol', 'graduate_to_tool'],
          description: 'Type of change'
        },
        description: { type: 'string', description: 'What change is being proposed' },
        reason: { type: 'string', description: 'Why this change is needed (reference reflection)' },
        proposed_content: { type: 'string', description: 'The actual content to add/change' }
      },
      required: ['protocol_id', 'change_type', 'description', 'reason']
    },
    handler: async ({ protocol_id, change_type, description, reason, proposed_content = '' }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);
        const timestamp = new Date().toISOString();

        const proposal = {
          protocol_id,
          change_type,
          description,
          reason,
          proposed_content,
          status: 'pending',
          created_at: timestamp,
          reviewed: false
        };

        const proposalKey = `proposal_${protocol_id}_${timestamp.replace(/[:.]/g, '-')}`;

        db.prepare(`
          INSERT OR REPLACE INTO memories (key, value, type, metadata, created_at, updated_at, accessed_at)
          VALUES (?, ?, 'proposal', '{"status": "pending"}', ?, ?, ?)
        `).run(proposalKey, JSON.stringify(proposal), timestamp, timestamp, timestamp);

        db.close();

        let output = `📝 Protocol Proposal Created\n`;
        output += `═══════════════════════\n\n`;
        output += `🆔 Proposal: ${proposalKey}\n`;
        output += `📋 Protocol: ${protocol_id}\n`;
        output += `🔧 Change Type: ${change_type}\n`;
        output += `📖 Description: ${description}\n`;
        output += `💡 Reason: ${reason}\n`;

        if (proposed_content) {
          output += `\n📄 Proposed Content:\n${proposed_content}\n`;
        }

        output += `\n⏳ Status: PENDING REVIEW\n`;
        output += `\nUse mikey_review_proposals to see all pending proposals.\n`;
        output += `Use mikey_apply_proposal to apply after review.`;

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  {
    name: 'mikey_review_proposals',
    description: 'List all pending protocol proposals',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected', 'all'],
          default: 'pending'
        }
      }
    },
    handler: async ({ status = 'pending' }) => {
      try {
        const db = new Database(BRAIN_DB_PATH, { readonly: true });

        let query = `SELECT key, value, created_at FROM memories WHERE type = 'proposal'`;
        if (status !== 'all') {
          query += ` AND json_extract(metadata, '$.status') = '${status}'`;
        }
        query += ` ORDER BY created_at DESC`;

        const proposals = db.prepare(query).all();
        db.close();

        let output = `📋 Protocol Proposals (${status})\n`;
        output += `═══════════════════════\n\n`;

        if (proposals.length === 0) {
          output += `No ${status} proposals found.\n`;
        } else {
          for (const p of proposals) {
            const data = JSON.parse(p.value);
            output += `🆔 ${p.key}\n`;
            output += `   Protocol: ${data.protocol_id}\n`;
            output += `   Type: ${data.change_type}\n`;
            output += `   Description: ${data.description}\n`;
            output += `   Created: ${data.created_at}\n\n`;
          }
        }

        output += `\nTotal: ${proposals.length} proposals`;

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  {
    name: 'mikey_apply_proposal',
    description: 'Apply or reject a protocol proposal (requires human approval)',
    inputSchema: {
      type: 'object',
      properties: {
        proposal_key: { type: 'string', description: 'The proposal key to apply' },
        action: {
          type: 'string',
          enum: ['approve', 'reject'],
          description: 'Approve or reject the proposal'
        },
        notes: { type: 'string', description: 'Notes about the decision' }
      },
      required: ['proposal_key', 'action']
    },
    handler: async ({ proposal_key, action, notes = '' }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);
        const timestamp = new Date().toISOString();

        // Get the proposal
        const proposal = db.prepare('SELECT value FROM memories WHERE key = ?').get(proposal_key);
        if (!proposal) {
          db.close();
          return { content: [{ type: 'text', text: `❌ Proposal not found: ${proposal_key}` }] };
        }

        const data = JSON.parse(proposal.value);
        data.status = action === 'approve' ? 'approved' : 'rejected';
        data.reviewed_at = timestamp;
        data.review_notes = notes;

        // Update the proposal
        db.prepare(`
          UPDATE memories
          SET value = ?, metadata = ?, updated_at = ?
          WHERE key = ?
        `).run(JSON.stringify(data), JSON.stringify({ status: data.status }), timestamp, proposal_key);

        let output = '';

        if (action === 'approve') {
          output = `✅ Proposal APPROVED\n`;
          output += `═══════════════════════\n\n`;
          output += `🆔 ${proposal_key}\n`;
          output += `📋 Protocol: ${data.protocol_id}\n`;
          output += `🔧 Change: ${data.change_type}\n\n`;

          if (data.proposed_content) {
            output += `📄 Content to apply:\n${data.proposed_content}\n\n`;
          }

          output += `⚠️ MANUAL STEP REQUIRED:\n`;
          output += `   Edit the protocol file to apply this change.\n`;
          output += `   Protocol: ${data.protocol_id}\n`;

          if (notes) {
            output += `\n📝 Notes: ${notes}`;
          }
        } else {
          output = `❌ Proposal REJECTED\n`;
          output += `═══════════════════════\n\n`;
          output += `🆔 ${proposal_key}\n`;
          if (notes) {
            output += `📝 Reason: ${notes}`;
          }
        }

        db.close();

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  {
    name: 'mikey_reflections',
    description: 'View past reflections and patterns',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 10 },
        high_surprise_only: { type: 'boolean', default: false },
        failure_class: { type: 'string', enum: ['EXECUTION', 'SPECIFICATION', 'CAPABILITY', 'UNKNOWN'] }
      }
    },
    handler: async ({ limit = 10, high_surprise_only = false, failure_class }) => {
      try {
        const db = new Database(BRAIN_DB_PATH, { readonly: true });

        let query = `SELECT key, value, created_at FROM memories WHERE type = 'reflection'`;
        const conditions = [];

        if (high_surprise_only) {
          conditions.push(`json_extract(value, '$.surprise_score') >= 7`);
        }

        if (failure_class) {
          conditions.push(`json_extract(value, '$.failure_class') = '${failure_class}'`);
        }

        if (conditions.length > 0) {
          query += ` AND ${conditions.join(' AND ')}`;
        }

        query += ` ORDER BY created_at DESC LIMIT ?`;

        const reflections = db.prepare(query).all(limit);

        // Get summary stats
        const stats = db.prepare(`
          SELECT
            COUNT(*) as total,
            AVG(json_extract(value, '$.surprise_score')) as avg_surprise,
            COUNT(CASE WHEN json_extract(value, '$.failure_class') = 'EXECUTION' THEN 1 END) as execution_failures,
            COUNT(CASE WHEN json_extract(value, '$.failure_class') = 'SPECIFICATION' THEN 1 END) as spec_failures,
            COUNT(CASE WHEN json_extract(value, '$.failure_class') = 'CAPABILITY' THEN 1 END) as capability_failures
          FROM memories WHERE type = 'reflection'
        `).get();

        db.close();

        let output = `🔍 Reflections Summary\n`;
        output += `═══════════════════════\n\n`;
        output += `📊 Stats:\n`;
        output += `   Total reflections: ${stats.total}\n`;
        output += `   Avg surprise: ${(stats.avg_surprise || 0).toFixed(1)}/10\n`;
        output += `   Execution failures: ${stats.execution_failures}\n`;
        output += `   Specification failures: ${stats.spec_failures}\n`;
        output += `   Capability failures: ${stats.capability_failures}\n\n`;

        output += `📋 Recent Reflections:\n`;
        for (const r of reflections) {
          const data = JSON.parse(r.value);
          output += `\n• ${data.task.substring(0, 50)}${data.task.length > 50 ? '...' : ''}\n`;
          output += `  Outcome: ${data.outcome} | Surprise: ${data.surprise_score}/10`;
          if (data.failure_class) {
            output += ` | Class: ${data.failure_class}`;
          }
          output += `\n`;
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  // ===== PROTOCOL GRADUATION TRACKING =====
  {
    name: 'mikey_graduation_track',
    description: 'Track protocol usage to determine graduation readiness (text → chunked → tool)',
    inputSchema: {
      type: 'object',
      properties: {
        protocol_id: { type: 'string', description: 'Protocol being used' },
        execution_type: { type: 'string', enum: ['text', 'chunked', 'tool'], description: 'How was it executed?' },
        success: { type: 'boolean', description: 'Was execution successful?' },
        execution_time_ms: { type: 'number', description: 'How long did execution take?' },
        complexity_score: { type: 'number', description: 'Estimated complexity (1-10)' },
        notes: { type: 'string', description: 'Any relevant observations' }
      },
      required: ['protocol_id', 'execution_type', 'success']
    },
    handler: async ({ protocol_id, execution_type, success, execution_time_ms = 0, complexity_score = 5, notes = '' }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);

        const key = `graduation_${protocol_id}_${Date.now()}`;
        const value = JSON.stringify({
          protocol_id,
          execution_type,
          success,
          execution_time_ms,
          complexity_score,
          notes,
          recorded_at: new Date().toISOString()
        });

        db.prepare(`
          INSERT INTO memories (key, type, value, created_at, accessed_at)
          VALUES (?, 'graduation', ?, datetime('now'), datetime('now'))
        `).run(key, value);

        // Calculate graduation metrics
        const metrics = db.prepare(`
          SELECT
            COUNT(*) as total_uses,
            SUM(CASE WHEN json_extract(value, '$.success') = 1 THEN 1 ELSE 0 END) as successes,
            AVG(json_extract(value, '$.execution_time_ms')) as avg_time,
            AVG(json_extract(value, '$.complexity_score')) as avg_complexity,
            json_extract(value, '$.execution_type') as exec_type
          FROM memories
          WHERE type = 'graduation'
            AND json_extract(value, '$.protocol_id') = ?
          GROUP BY exec_type
        `).all(protocol_id);

        db.close();

        let output = `📊 Graduation Tracking Updated\n`;
        output += `═══════════════════════════════\n\n`;
        output += `📋 Protocol: ${protocol_id}\n`;
        output += `🔧 Execution: ${execution_type} | ${success ? '✅ Success' : '❌ Failed'}\n\n`;

        output += `📈 Usage Metrics by Execution Type:\n`;
        for (const m of metrics) {
          const successRate = m.total_uses > 0 ? (m.successes / m.total_uses * 100).toFixed(0) : 0;
          output += `\n   ${m.exec_type.toUpperCase()}:\n`;
          output += `      Uses: ${m.total_uses} | Success: ${successRate}%\n`;
          output += `      Avg time: ${Math.round(m.avg_time || 0)}ms | Avg complexity: ${(m.avg_complexity || 0).toFixed(1)}/10\n`;
        }

        // Graduation recommendation logic
        const textMetrics = metrics.find(m => m.exec_type === 'text');
        const chunkedMetrics = metrics.find(m => m.exec_type === 'chunked');

        output += `\n🎓 Graduation Analysis:\n`;

        if (textMetrics && textMetrics.total_uses >= 5) {
          const successRate = textMetrics.successes / textMetrics.total_uses;
          if (successRate < 0.7 || textMetrics.avg_complexity > 6) {
            output += `   ⬆️ RECOMMEND: Graduate to CHUNKED execution\n`;
            output += `      Reason: ${successRate < 0.7 ? 'Low success rate' : 'High complexity'}\n`;
          } else if (successRate > 0.9 && textMetrics.avg_time > 60000) {
            output += `   ⬆️ CONSIDER: Graduate to CHUNKED for long-running tasks\n`;
          } else {
            output += `   ✅ Text execution working well\n`;
          }
        }

        if (chunkedMetrics && chunkedMetrics.total_uses >= 5) {
          const successRate = chunkedMetrics.successes / chunkedMetrics.total_uses;
          if (successRate > 0.9 && chunkedMetrics.avg_complexity > 7) {
            output += `   ⬆️ RECOMMEND: Graduate to TOOL implementation\n`;
            output += `      Reason: High complexity protocol with good success - worth hardcoding\n`;
          }
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  {
    name: 'mikey_graduation_status',
    description: 'View graduation status and recommendations for all protocols',
    inputSchema: {
      type: 'object',
      properties: {
        protocol_id: { type: 'string', description: 'Specific protocol (omit for all)' },
        recommend_only: { type: 'boolean', description: 'Only show protocols needing graduation', default: false }
      }
    },
    handler: async ({ protocol_id, recommend_only = false }) => {
      try {
        const db = new Database(BRAIN_DB_PATH, { readonly: true });

        let query = `
          SELECT
            json_extract(value, '$.protocol_id') as protocol_id,
            json_extract(value, '$.execution_type') as exec_type,
            COUNT(*) as total_uses,
            SUM(CASE WHEN json_extract(value, '$.success') = 1 THEN 1 ELSE 0 END) as successes,
            AVG(json_extract(value, '$.execution_time_ms')) as avg_time,
            AVG(json_extract(value, '$.complexity_score')) as avg_complexity
          FROM memories
          WHERE type = 'graduation'
        `;

        if (protocol_id) {
          query += ` AND json_extract(value, '$.protocol_id') = '${protocol_id}'`;
        }

        query += ` GROUP BY protocol_id, exec_type ORDER BY protocol_id, exec_type`;

        const rows = db.prepare(query).all();
        db.close();

        if (rows.length === 0) {
          return { content: [{ type: 'text', text: `📊 No graduation data found.\n\nUse mikey_graduation_track to record protocol usage.` }] };
        }

        // Group by protocol
        const byProtocol = {};
        for (const row of rows) {
          if (!byProtocol[row.protocol_id]) {
            byProtocol[row.protocol_id] = { text: null, chunked: null, tool: null };
          }
          byProtocol[row.protocol_id][row.exec_type] = row;
        }

        let output = `🎓 Protocol Graduation Status\n`;
        output += `══════════════════════════════\n\n`;

        for (const [pid, data] of Object.entries(byProtocol)) {
          let recommendation = null;
          let currentStage = 'text';

          // Determine current stage and recommendation
          if (data.tool) currentStage = 'tool';
          else if (data.chunked) currentStage = 'chunked';

          // Check if graduation recommended
          if (data.text && data.text.total_uses >= 5) {
            const successRate = data.text.successes / data.text.total_uses;
            if (successRate < 0.7 || data.text.avg_complexity > 6) {
              recommendation = { to: 'chunked', reason: successRate < 0.7 ? 'Low success rate' : 'High complexity' };
            }
          }

          if (data.chunked && data.chunked.total_uses >= 5) {
            const successRate = data.chunked.successes / data.chunked.total_uses;
            if (successRate > 0.9 && data.chunked.avg_complexity > 7) {
              recommendation = { to: 'tool', reason: 'High complexity, consistent success' };
            }
          }

          if (recommend_only && !recommendation) continue;

          output += `📋 ${pid}\n`;
          output += `   Current Stage: ${currentStage.toUpperCase()}\n`;

          for (const stage of ['text', 'chunked', 'tool']) {
            if (data[stage]) {
              const m = data[stage];
              const sr = (m.successes / m.total_uses * 100).toFixed(0);
              output += `   ${stage}: ${m.total_uses} uses, ${sr}% success, ~${Math.round(m.avg_time || 0)}ms\n`;
            }
          }

          if (recommendation) {
            output += `   ⬆️ RECOMMEND: Graduate to ${recommendation.to.toUpperCase()}\n`;
            output += `      Reason: ${recommendation.reason}\n`;
          }
          output += `\n`;
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  // ===== AUTOMATIC TRIGGER REFINEMENT =====
  {
    name: 'mikey_trigger_analyze',
    description: 'Analyze reflection data to suggest trigger refinements for protocols',
    inputSchema: {
      type: 'object',
      properties: {
        protocol_id: { type: 'string', description: 'Specific protocol to analyze (omit for all)' },
        min_reflections: { type: 'number', description: 'Minimum reflections to consider', default: 3 }
      }
    },
    handler: async ({ protocol_id, min_reflections = 3 }) => {
      try {
        const db = new Database(BRAIN_DB_PATH, { readonly: true });

        // Get reflections with tool usage patterns
        let query = `
          SELECT
            key,
            value,
            json_extract(value, '$.task') as task,
            json_extract(value, '$.outcome') as outcome,
            json_extract(value, '$.surprise_score') as surprise,
            json_extract(value, '$.failure_class') as failure_class,
            json_extract(value, '$.tools_used') as tools_used
          FROM memories
          WHERE type = 'reflection'
          ORDER BY created_at DESC
          LIMIT 100
        `;

        const reflections = db.prepare(query).all();

        // Get existing proposals
        const proposals = db.prepare(`
          SELECT value FROM memories WHERE type = 'proposal'
        `).all().map(p => JSON.parse(p.value));

        db.close();

        if (reflections.length < min_reflections) {
          return { content: [{ type: 'text', text: `📊 Not enough reflection data (${reflections.length}/${min_reflections} minimum).\n\nUse mikey_reflect after tasks to build up data.` }] };
        }

        // Analyze patterns
        const patterns = {
          high_surprise_tasks: [],
          common_failures: {},
          task_patterns: {},
          tool_correlations: {}
        };

        for (const r of reflections) {
          const data = JSON.parse(r.value);

          // Track high surprise events
          if (data.surprise_score >= 7) {
            patterns.high_surprise_tasks.push({
              task: data.task,
              surprise: data.surprise_score,
              outcome: data.outcome,
              failure_class: data.failure_class
            });
          }

          // Track failure classes
          if (data.failure_class && data.failure_class !== 'UNKNOWN') {
            patterns.common_failures[data.failure_class] = (patterns.common_failures[data.failure_class] || 0) + 1;
          }

          // Extract task keywords
          const keywords = data.task.toLowerCase().match(/\b\w{4,}\b/g) || [];
          for (const kw of keywords) {
            if (!patterns.task_patterns[kw]) {
              patterns.task_patterns[kw] = { count: 0, successes: 0, failures: 0 };
            }
            patterns.task_patterns[kw].count++;
            if (data.outcome === 'success') {
              patterns.task_patterns[kw].successes++;
            } else {
              patterns.task_patterns[kw].failures++;
            }
          }
        }

        // Generate recommendations
        let output = `🔍 Trigger Refinement Analysis\n`;
        output += `══════════════════════════════\n\n`;

        output += `📊 Reflection Summary:\n`;
        output += `   Total analyzed: ${reflections.length}\n`;
        output += `   High surprise (≥7): ${patterns.high_surprise_tasks.length}\n\n`;

        output += `📈 Failure Class Distribution:\n`;
        for (const [cls, count] of Object.entries(patterns.common_failures)) {
          const pct = (count / reflections.length * 100).toFixed(0);
          output += `   ${cls}: ${count} (${pct}%)\n`;
        }

        // Find problematic task patterns
        const problematicPatterns = Object.entries(patterns.task_patterns)
          .filter(([kw, data]) => data.count >= 3 && data.failures / data.count > 0.5)
          .sort((a, b) => b[1].failures - a[1].failures)
          .slice(0, 5);

        if (problematicPatterns.length > 0) {
          output += `\n⚠️ Task Patterns with High Failure Rates:\n`;
          for (const [kw, data] of problematicPatterns) {
            const failRate = (data.failures / data.count * 100).toFixed(0);
            output += `   "${kw}": ${failRate}% failure rate (${data.failures}/${data.count})\n`;
          }
        }

        // Generate trigger suggestions
        output += `\n💡 Trigger Refinement Suggestions:\n`;

        if (patterns.common_failures['SPECIFICATION'] > patterns.common_failures['EXECUTION']) {
          output += `\n1. 📝 Add more specific triggers for protocol selection\n`;
          output += `   Issue: High SPECIFICATION failures suggest protocols aren't being selected appropriately\n`;
          output += `   Action: Use mikey_propose to add trigger conditions that match failing task patterns\n`;
        }

        if (patterns.common_failures['EXECUTION'] > 2) {
          output += `\n2. 🔄 Add retry/prerequisite check steps\n`;
          output += `   Issue: EXECUTION failures indicate external dependencies failing\n`;
          output += `   Action: Add prerequisite validation steps to relevant protocols\n`;
        }

        if (patterns.high_surprise_tasks.length > 3) {
          output += `\n3. 🎯 Create new protocols for surprising task types\n`;
          output += `   High-surprise tasks that may need dedicated protocols:\n`;
          for (const t of patterns.high_surprise_tasks.slice(0, 3)) {
            output += `   - "${t.task.substring(0, 50)}..." (surprise: ${t.surprise}/10)\n`;
          }
        }

        // Check for existing proposals that address these
        const pendingProposals = proposals.filter(p => p.status === 'pending');
        if (pendingProposals.length > 0) {
          output += `\n📋 Pending Proposals (${pendingProposals.length}):\n`;
          for (const p of pendingProposals.slice(0, 3)) {
            output += `   - ${p.change_type}: ${p.description.substring(0, 50)}...\n`;
          }
          output += `   Use mikey_review_proposals to review and apply.\n`;
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  {
    name: 'mikey_trigger_suggest',
    description: 'Generate specific trigger condition suggestions based on task patterns',
    inputSchema: {
      type: 'object',
      properties: {
        protocol_id: { type: 'string', description: 'Protocol to suggest triggers for' },
        based_on: { type: 'string', enum: ['failures', 'successes', 'high_surprise'], description: 'What to base suggestions on', default: 'failures' }
      },
      required: ['protocol_id']
    },
    handler: async ({ protocol_id, based_on = 'failures' }) => {
      try {
        const db = new Database(BRAIN_DB_PATH, { readonly: true });

        // Get reflections that mention this protocol or related tools
        const reflections = db.prepare(`
          SELECT value FROM memories
          WHERE type = 'reflection'
          ORDER BY created_at DESC
          LIMIT 50
        `).all().map(r => JSON.parse(r.value));

        db.close();

        // Filter based on criteria
        let filtered = [];
        switch (based_on) {
          case 'failures':
            filtered = reflections.filter(r => r.outcome !== 'success');
            break;
          case 'successes':
            filtered = reflections.filter(r => r.outcome === 'success' && r.surprise_score <= 3);
            break;
          case 'high_surprise':
            filtered = reflections.filter(r => r.surprise_score >= 7);
            break;
        }

        if (filtered.length === 0) {
          return { content: [{ type: 'text', text: `📊 No ${based_on} reflections found to analyze.\n\nBuild up more reflection data with mikey_reflect.` }] };
        }

        // Extract common patterns
        const taskWords = {};
        const toolPatterns = {};

        for (const r of filtered) {
          // Extract significant words from tasks
          const words = r.task.toLowerCase().match(/\b\w{4,}\b/g) || [];
          for (const w of words) {
            taskWords[w] = (taskWords[w] || 0) + 1;
          }

          // Track tool usage
          if (r.tools_used) {
            for (const tool of r.tools_used) {
              toolPatterns[tool] = (toolPatterns[tool] || 0) + 1;
            }
          }
        }

        // Find most common patterns
        const topWords = Object.entries(taskWords)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .filter(([w, c]) => c >= 2);

        const topTools = Object.entries(toolPatterns)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        let output = `💡 Trigger Suggestions for "${protocol_id}"\n`;
        output += `═══════════════════════════════════════════\n\n`;
        output += `Based on: ${based_on} (${filtered.length} reflections)\n\n`;

        output += `🎯 Suggested Trigger Conditions:\n\n`;

        // Generate trigger suggestions from patterns
        let triggerNum = 1;

        if (topWords.length > 0) {
          output += `Based on common task patterns:\n`;
          for (const [word, count] of topWords.slice(0, 5)) {
            output += `   ${triggerNum}. When task involves "${word}"\n`;
            triggerNum++;
          }
          output += `\n`;
        }

        if (topTools.length > 0) {
          output += `Based on tool usage patterns:\n`;
          for (const [tool, count] of topTools) {
            output += `   ${triggerNum}. When using ${tool} tool\n`;
            triggerNum++;
          }
          output += `\n`;
        }

        // Specific suggestions based on failure classes
        const failureClasses = {};
        for (const r of filtered) {
          if (r.failure_class) {
            failureClasses[r.failure_class] = (failureClasses[r.failure_class] || 0) + 1;
          }
        }

        if (Object.keys(failureClasses).length > 0) {
          output += `Based on failure patterns:\n`;
          for (const [cls, count] of Object.entries(failureClasses)) {
            switch (cls) {
              case 'EXECUTION':
                output += `   ${triggerNum}. Add: "When external service/API calls are involved"\n`;
                break;
              case 'SPECIFICATION':
                output += `   ${triggerNum}. Add: "When task requirements seem ambiguous"\n`;
                break;
              case 'CAPABILITY':
                output += `   ${triggerNum}. Add: "When task requires multi-step complex operations"\n`;
                break;
            }
            triggerNum++;
          }
        }

        output += `\n📝 To apply these suggestions, use:\n`;
        output += `   mikey_propose protocol_id="${protocol_id}" change_type="add_trigger" description="..." reason="..."\n`;

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  // ===== HIERARCHICAL PLANNING =====
  {
    name: 'mikey_plan_create',
    description: 'Create a hierarchical plan for a complex task. Decomposes into sub-tasks with preconditions, expected outcomes, and verification steps.',
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'The high-level goal to achieve' },
        context: { type: 'string', description: 'Relevant context or constraints' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Step ID (e.g., "1", "1.1", "1.2")' },
              action: { type: 'string', description: 'What to do' },
              preconditions: { type: 'array', items: { type: 'string' } },
              expected_outcome: { type: 'string' },
              tools: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      },
      required: ['goal', 'steps']
    },
    handler: async ({ goal, context = '', steps }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);
        const planId = `plan_${Date.now()}`;

        db.exec(`
          CREATE TABLE IF NOT EXISTS plans (
            id TEXT PRIMARY KEY, goal TEXT NOT NULL, context TEXT,
            status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME, current_step TEXT
          )
        `);

        db.exec(`
          CREATE TABLE IF NOT EXISTS plan_steps (
            id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id TEXT NOT NULL,
            step_id TEXT NOT NULL, action TEXT NOT NULL, preconditions TEXT,
            expected_outcome TEXT, tools TEXT, parent_step TEXT,
            status TEXT DEFAULT 'pending', actual_outcome TEXT,
            started_at DATETIME, completed_at DATETIME
          )
        `);

        db.prepare(`INSERT INTO plans (id, goal, context, current_step) VALUES (?, ?, ?, ?)`).run(planId, goal, context, steps[0]?.id || null);

        const insertStep = db.prepare(`INSERT INTO plan_steps (plan_id, step_id, action, preconditions, expected_outcome, tools, parent_step) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        for (const step of steps) {
          const parentId = step.id.includes('.') ? step.id.split('.').slice(0, -1).join('.') : null;
          insertStep.run(planId, step.id, step.action, JSON.stringify(step.preconditions || []), step.expected_outcome || '', JSON.stringify(step.tools || []), parentId);
        }

        let output = `📋 Plan Created: ${planId}\n═══════════════════════════════════════════════════\n\n`;
        output += `🎯 Goal: ${goal}\n`;
        if (context) output += `📝 Context: ${context}\n`;
        output += `\n📊 Steps (${steps.length}):\n\n`;

        for (const step of steps) {
          const indent = (step.id.match(/\./g) || []).length;
          const prefix = '  '.repeat(indent);
          output += `${prefix}${step.id}. ${step.action}\n`;
          if (step.preconditions?.length) output += `${prefix}   ⚡ Pre: ${step.preconditions.join(', ')}\n`;
          if (step.expected_outcome) output += `${prefix}   ✓ Expected: ${step.expected_outcome}\n`;
          if (step.tools?.length) output += `${prefix}   🔧 Tools: ${step.tools.join(', ')}\n`;
        }

        output += `\n💡 Use mikey_plan_step to execute steps`;
        db.close();
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  {
    name: 'mikey_plan_step',
    description: 'Execute and verify a step in an active plan. Checks preconditions, records outcome, validates against expected result.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'The plan ID' },
        step_id: { type: 'string', description: 'The step ID (e.g., "1.2")' },
        action: { type: 'string', enum: ['start', 'complete', 'skip', 'fail'], description: 'Action to take' },
        actual_outcome: { type: 'string', description: 'What actually happened (for complete/fail)' },
        notes: { type: 'string', description: 'Additional notes' }
      },
      required: ['plan_id', 'step_id', 'action']
    },
    handler: async ({ plan_id, step_id, action, actual_outcome = '', notes = '' }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);
        const timestamp = new Date().toISOString();

        const step = db.prepare(`SELECT * FROM plan_steps WHERE plan_id = ? AND step_id = ?`).get(plan_id, step_id);
        if (!step) { db.close(); return { content: [{ type: 'text', text: `❌ Step ${step_id} not found in plan ${plan_id}` }] }; }

        let output = `📋 Plan Step: ${step_id}\n═══════════════════════════════════════════════════\n\n`;
        output += `📌 Action: ${step.action}\n\n`;

        if (action === 'start') {
          const preconditions = JSON.parse(step.preconditions || '[]');
          if (preconditions.length > 0) {
            output += `⚡ Preconditions:\n`;
            for (const pre of preconditions) output += `   • ${pre}\n`;
            output += `\n⚠️ Verify these are met before proceeding!\n\n`;
          }
          db.prepare(`UPDATE plan_steps SET status = 'in_progress', started_at = ? WHERE plan_id = ? AND step_id = ?`).run(timestamp, plan_id, step_id);
          db.prepare(`UPDATE plans SET current_step = ? WHERE id = ?`).run(step_id, plan_id);
          output += `✅ Step marked as IN PROGRESS\n🔧 Tools: ${step.tools || 'none'}\n✓ Expected: ${step.expected_outcome || 'not specified'}`;

        } else if (action === 'complete') {
          db.prepare(`UPDATE plan_steps SET status = 'completed', actual_outcome = ?, completed_at = ? WHERE plan_id = ? AND step_id = ?`).run(actual_outcome || 'Completed', timestamp, plan_id, step_id);
          output += `✅ Step COMPLETED\n📊 Expected: ${step.expected_outcome || 'n/a'}\n📊 Actual: ${actual_outcome || 'n/a'}\n`;

          const nextStep = db.prepare(`SELECT step_id, action FROM plan_steps WHERE plan_id = ? AND status = 'pending' ORDER BY step_id LIMIT 1`).get(plan_id);
          if (nextStep) {
            output += `\n➡️ Next: ${nextStep.step_id} - ${nextStep.action}`;
            db.prepare(`UPDATE plans SET current_step = ? WHERE id = ?`).run(nextStep.step_id, plan_id);
          } else {
            output += `\n🎉 All steps completed!`;
            db.prepare(`UPDATE plans SET status = 'completed', completed_at = ? WHERE id = ?`).run(timestamp, plan_id);
          }

        } else if (action === 'skip') {
          db.prepare(`UPDATE plan_steps SET status = 'skipped', actual_outcome = ? WHERE plan_id = ? AND step_id = ?`).run(notes || 'Skipped', plan_id, step_id);
          output += `⏭️ Step SKIPPED${notes ? ': ' + notes : ''}`;

        } else if (action === 'fail') {
          db.prepare(`UPDATE plan_steps SET status = 'failed', actual_outcome = ? WHERE plan_id = ? AND step_id = ?`).run(actual_outcome || 'Failed', plan_id, step_id);
          output += `❌ Step FAILED: ${actual_outcome || notes || 'unknown reason'}`;
        }

        db.close();
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  {
    name: 'mikey_plan_status',
    description: 'Check the status of plans, including completed/pending steps and current position.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'The plan ID (omit to list all active plans)' }
      }
    },
    handler: async ({ plan_id = null }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);
        const tableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='plans'`).get();
        if (!tableExists) { db.close(); return { content: [{ type: 'text', text: `📋 No plans found. Use mikey_plan_create to create one.` }] }; }

        let output = '';

        if (!plan_id) {
          const plans = db.prepare(`SELECT id, goal, status, current_step FROM plans ORDER BY created_at DESC LIMIT 10`).all();
          if (plans.length === 0) {
            output = `📋 No plans found.`;
          } else {
            output = `📋 Plans\n═══════════════════════════════════════════════════\n\n`;
            for (const p of plans) {
              const stepCounts = db.prepare(`SELECT status, COUNT(*) as count FROM plan_steps WHERE plan_id = ? GROUP BY status`).all(p.id);
              const counts = {}; for (const s of stepCounts) counts[s.status] = s.count;
              output += `📌 ${p.id} [${p.status}]\n   ${p.goal.substring(0, 50)}${p.goal.length > 50 ? '...' : ''}\n`;
              output += `   ✅${counts.completed || 0} ⏳${counts.in_progress || 0} ⏸️${counts.pending || 0} ❌${counts.failed || 0}\n\n`;
            }
          }
        } else {
          const plan = db.prepare(`SELECT * FROM plans WHERE id = ?`).get(plan_id);
          if (!plan) { db.close(); return { content: [{ type: 'text', text: `❌ Plan ${plan_id} not found` }] }; }

          const steps = db.prepare(`SELECT * FROM plan_steps WHERE plan_id = ? ORDER BY step_id`).all(plan_id);
          output = `📋 Plan: ${plan_id}\n═══════════════════════════════════════════════════\n\n`;
          output += `🎯 ${plan.goal}\n📊 Status: ${plan.status} | Current: ${plan.current_step || 'none'}\n\n`;

          for (const s of steps) {
            const icon = s.status === 'completed' ? '✅' : s.status === 'in_progress' ? '⏳' : s.status === 'failed' ? '❌' : s.status === 'skipped' ? '⏭️' : '⏸️';
            output += `${icon} ${s.step_id}. ${s.action}\n`;
          }

          const completed = steps.filter(s => s.status === 'completed').length;
          output += `\n📈 Progress: ${completed}/${steps.length} (${Math.round(completed/steps.length*100)}%)`;
        }

        db.close();
        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  // ===== TOOL DISCOVERY =====
  {
    name: 'mikey_tool_catalog',
    description: 'Search and discover available MCP tools. Helps find tools you\'ve forgotten about or didn\'t know existed. Uses keyword matching on tool names and descriptions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query - keywords to find relevant tools (e.g., "file", "memory", "git")'
        },
        action: {
          type: 'string',
          enum: ['search', 'list', 'stats', 'rebuild'],
          description: 'search=find tools, list=show all tools, stats=usage statistics, rebuild=refresh catalog from MCP servers',
          default: 'search'
        },
        server: {
          type: 'string',
          description: 'Filter by MCP server name (optional)'
        },
        limit: {
          type: 'number',
          description: 'Max results to return',
          default: 10
        }
      }
    },
    handler: async ({ query = '', action = 'search', server = null, limit = 10 }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);

        // Ensure tool_catalog table exists
        db.exec(`
          CREATE TABLE IF NOT EXISTS tool_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tool_name TEXT UNIQUE NOT NULL,
            server_name TEXT,
            description TEXT,
            parameters TEXT,
            category TEXT,
            use_count INTEGER DEFAULT 0,
            last_used DATETIME,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            keywords TEXT
          )
        `);

        let output = '';

        if (action === 'rebuild') {
          // This would ideally query MCP servers, but we'll build from known tools
          // For now, populate with known tools from our ecosystem
          const knownTools = [
            // mikey-brain tools
            { name: 'mikey_init', server: 'mikey-brain', desc: 'Initialize Brain session and load context', category: 'memory', keywords: 'init startup load context' },
            { name: 'mikey_remember', server: 'mikey-brain', desc: 'Store information in Brain memory', category: 'memory', keywords: 'store save remember persist' },
            { name: 'mikey_recall', server: 'mikey-brain', desc: 'Search through Brain memories', category: 'memory', keywords: 'search find recall query' },
            { name: 'mikey_forget', server: 'mikey-brain', desc: 'Remove a memory by key or pattern', category: 'memory', keywords: 'delete remove forget' },
            { name: 'mikey_status', server: 'mikey-brain', desc: 'Check Brain system status', category: 'system', keywords: 'status health check' },
            { name: 'mikey_execute', server: 'mikey-brain', desc: 'Execute Python or Shell code', category: 'execution', keywords: 'run execute code python shell' },
            { name: 'mikey_reflect', server: 'mikey-brain', desc: 'Evaluate task outcome, diagnose failures', category: 'reflection', keywords: 'reflect evaluate outcome failure' },
            { name: 'mikey_reflect_mar', server: 'mikey-brain', desc: 'Multi-Agent Reflexion with 4 personas', category: 'reflection', keywords: 'reflect mar multi-agent critique' },
            { name: 'mikey_propose', server: 'mikey-brain', desc: 'Propose a protocol change', category: 'protocol', keywords: 'propose change protocol improvement' },
            { name: 'mikey_consolidate', server: 'mikey-brain', desc: 'Analyze memories for consolidation', category: 'memory', keywords: 'consolidate merge compress archive' },
            { name: 'mikey_consolidate_merge', server: 'mikey-brain', desc: 'Manually merge related memories', category: 'memory', keywords: 'merge consolidate combine' },
            { name: 'mikey_search', server: 'mikey-brain', desc: 'Search Brain memory and Obsidian notes', category: 'search', keywords: 'search find obsidian notes' },
            { name: 'mikey_obsidian_note', server: 'mikey-brain', desc: 'Create/read/update Obsidian notes', category: 'obsidian', keywords: 'obsidian note create read update' },
            { name: 'mikey_analyze', server: 'mikey-brain', desc: 'Analyze Obsidian vault for insights', category: 'obsidian', keywords: 'analyze vault patterns insights' },
            { name: 'mikey_state_get', server: 'mikey-brain', desc: 'Get a state value', category: 'state', keywords: 'state get value' },
            { name: 'mikey_state_set', server: 'mikey-brain', desc: 'Set a state value', category: 'state', keywords: 'state set value' },
            { name: 'mikey_recent', server: 'mikey-brain', desc: 'Show recently accessed memories', category: 'memory', keywords: 'recent memories accessed' },
            { name: 'mikey_stats', server: 'mikey-brain', desc: 'Detailed brain system statistics', category: 'system', keywords: 'stats statistics metrics' },
            { name: 'mikey_pin', server: 'mikey-brain', desc: 'Mark a memory as important', category: 'memory', keywords: 'pin important favorite' },

            // file-opener tools
            { name: 'mikey_open', server: 'file-opener', desc: 'Open a file or directory in default app', category: 'files', keywords: 'open file directory app' },
            { name: 'mikey_reveal', server: 'file-opener', desc: 'Reveal file in Finder', category: 'files', keywords: 'reveal finder show' },

            // Built-in Claude Code tools
            { name: 'Read', server: 'claude-code', desc: 'Read file contents', category: 'files', keywords: 'read file contents' },
            { name: 'Write', server: 'claude-code', desc: 'Write content to file', category: 'files', keywords: 'write file create' },
            { name: 'Edit', server: 'claude-code', desc: 'Edit file with string replacement', category: 'files', keywords: 'edit modify replace' },
            { name: 'Bash', server: 'claude-code', desc: 'Execute bash commands', category: 'execution', keywords: 'bash shell command terminal' },
            { name: 'Glob', server: 'claude-code', desc: 'Find files by pattern', category: 'search', keywords: 'glob find files pattern' },
            { name: 'Grep', server: 'claude-code', desc: 'Search file contents', category: 'search', keywords: 'grep search content' },
            { name: 'Task', server: 'claude-code', desc: 'Launch specialized agents', category: 'agents', keywords: 'task agent spawn' },
            { name: 'WebSearch', server: 'claude-code', desc: 'Search the web', category: 'web', keywords: 'web search internet' },
            { name: 'WebFetch', server: 'claude-code', desc: 'Fetch and process web content', category: 'web', keywords: 'web fetch url' },
            { name: 'TodoWrite', server: 'claude-code', desc: 'Manage task list', category: 'planning', keywords: 'todo task list planning' },
            { name: 'AskUserQuestion', server: 'claude-code', desc: 'Ask user for input', category: 'interaction', keywords: 'ask question user input' },
          ];

          const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO tool_catalog (tool_name, server_name, description, category, keywords)
            VALUES (?, ?, ?, ?, ?)
          `);

          for (const tool of knownTools) {
            insertStmt.run(tool.name, tool.server, tool.desc, tool.category, tool.keywords);
          }

          output = `🔧 Tool Catalog Rebuilt\n`;
          output += `═══════════════════════════════════════════════════\n\n`;
          output += `✅ Added/updated ${knownTools.length} tools\n`;
          output += `\nCategories:\n`;

          const categories = {};
          for (const tool of knownTools) {
            categories[tool.category] = (categories[tool.category] || 0) + 1;
          }
          for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
            output += `  ${cat}: ${count}\n`;
          }

        } else if (action === 'list') {
          let sql = `SELECT tool_name, server_name, description, category, use_count FROM tool_catalog`;
          const params = [];

          if (server) {
            sql += ` WHERE server_name = ?`;
            params.push(server);
          }
          sql += ` ORDER BY category, tool_name`;

          const tools = db.prepare(sql).all(...params);

          output = `🔧 Tool Catalog\n`;
          output += `═══════════════════════════════════════════════════\n\n`;
          output += `Total tools: ${tools.length}\n\n`;

          // Group by category
          const byCategory = {};
          for (const t of tools) {
            byCategory[t.category] = byCategory[t.category] || [];
            byCategory[t.category].push(t);
          }

          for (const [cat, catTools] of Object.entries(byCategory).sort()) {
            output += `📁 ${cat.toUpperCase()}\n`;
            for (const t of catTools) {
              output += `  • ${t.tool_name} (${t.server_name})\n`;
              output += `    ${t.description}\n`;
            }
            output += `\n`;
          }

        } else if (action === 'stats') {
          const stats = db.prepare(`
            SELECT
              COUNT(*) as total_tools,
              COUNT(DISTINCT server_name) as servers,
              COUNT(DISTINCT category) as categories,
              SUM(use_count) as total_uses
            FROM tool_catalog
          `).get();

          const topUsed = db.prepare(`
            SELECT tool_name, use_count FROM tool_catalog
            WHERE use_count > 0
            ORDER BY use_count DESC LIMIT 10
          `).all();

          const byServer = db.prepare(`
            SELECT server_name, COUNT(*) as count FROM tool_catalog
            GROUP BY server_name ORDER BY count DESC
          `).all();

          output = `📊 Tool Catalog Statistics\n`;
          output += `═══════════════════════════════════════════════════\n\n`;
          output += `Total tools: ${stats.total_tools}\n`;
          output += `MCP servers: ${stats.servers}\n`;
          output += `Categories: ${stats.categories}\n`;
          output += `Total invocations tracked: ${stats.total_uses || 0}\n\n`;

          if (topUsed.length > 0) {
            output += `🏆 Most Used Tools:\n`;
            for (const t of topUsed) {
              output += `  ${t.tool_name}: ${t.use_count} uses\n`;
            }
            output += `\n`;
          }

          output += `📦 Tools by Server:\n`;
          for (const s of byServer) {
            output += `  ${s.server_name}: ${s.count} tools\n`;
          }

        } else if (action === 'search') {
          if (!query) {
            output = `❌ Search requires a query. Example: mikey_tool_catalog query="file" action="search"`;
          } else {
            // Simple keyword search
            const searchTerms = query.toLowerCase().split(/\s+/);
            const tools = db.prepare(`
              SELECT tool_name, server_name, description, category, keywords, use_count
              FROM tool_catalog
            `).all();

            // Score each tool
            const scored = tools.map(t => {
              let score = 0;
              const searchable = `${t.tool_name} ${t.description} ${t.keywords} ${t.category}`.toLowerCase();

              for (const term of searchTerms) {
                if (t.tool_name.toLowerCase().includes(term)) score += 10;
                if (t.description.toLowerCase().includes(term)) score += 5;
                if (t.keywords && t.keywords.toLowerCase().includes(term)) score += 3;
                if (t.category.toLowerCase().includes(term)) score += 2;
              }

              return { ...t, score };
            }).filter(t => t.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, limit);

            output = `🔍 Tool Search: "${query}"\n`;
            output += `═══════════════════════════════════════════════════\n\n`;

            if (scored.length === 0) {
              output += `No tools found matching "${query}"\n`;
              output += `\nTry broader terms like: file, memory, search, execute, web\n`;
            } else {
              output += `Found ${scored.length} matching tools:\n\n`;

              for (const t of scored) {
                output += `📌 ${t.tool_name} (${t.server_name})\n`;
                output += `   ${t.description}\n`;
                output += `   Category: ${t.category} | Score: ${t.score}\n\n`;
              }
            }
          }
        }

        db.close();

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  {
    name: 'mikey_tool_track',
    description: 'Track tool usage for analytics. Call this after using a tool to record its usage.',
    inputSchema: {
      type: 'object',
      properties: {
        tool_name: {
          type: 'string',
          description: 'Name of the tool that was used'
        }
      },
      required: ['tool_name']
    },
    handler: async ({ tool_name }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);

        db.exec(`
          CREATE TABLE IF NOT EXISTS tool_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tool_name TEXT UNIQUE NOT NULL,
            server_name TEXT,
            description TEXT,
            parameters TEXT,
            category TEXT,
            use_count INTEGER DEFAULT 0,
            last_used DATETIME,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            keywords TEXT
          )
        `);

        const result = db.prepare(`
          UPDATE tool_catalog
          SET use_count = use_count + 1, last_used = CURRENT_TIMESTAMP
          WHERE tool_name = ?
        `).run(tool_name);

        db.close();

        if (result.changes > 0) {
          return { content: [{ type: 'text', text: `✓ Tracked usage of ${tool_name}` }] };
        } else {
          return { content: [{ type: 'text', text: `Tool ${tool_name} not in catalog (use mikey_tool_catalog action="rebuild" first)` }] };
        }
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  // ===== MULTI-AGENT REFLEXION (MAR) =====
  {
    name: 'mikey_reflect_mar',
    description: 'Multi-Agent Reflexion: Evaluate task outcome through multiple critique personas (Verifier, Skeptic, Architect, Pragmatist) then synthesize into unified insight. Better at catching blind spots than single-agent reflection.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'What was the task?' },
        outcome: { type: 'string', enum: ['success', 'partial', 'failure'], description: 'What happened?' },
        details: { type: 'string', description: 'Details of what occurred' },
        error_messages: { type: 'string', description: 'Any error messages encountered' },
        tools_used: {
          type: 'array',
          items: { type: 'string' },
          description: 'Which tools were used'
        },
        code_or_output: { type: 'string', description: 'Optional: code written or output produced' }
      },
      required: ['task', 'outcome']
    },
    handler: async ({ task, outcome, details = '', error_messages = '', tools_used = [], code_or_output = '' }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);
        const timestamp = new Date().toISOString();

        let output = `🎭 Multi-Agent Reflexion (MAR)\n`;
        output += `═══════════════════════════════════════════════════\n\n`;
        output += `📋 Task: ${task}\n`;
        output += `📊 Outcome: ${outcome}\n\n`;

        // Define the personas
        const personas = [
          {
            name: 'Verifier',
            emoji: '✓',
            focus: 'factual correctness and logical consistency',
            questions: [
              'Did the approach actually solve what was asked?',
              'Are there logical gaps in the reasoning?',
              'Did any assumptions turn out to be wrong?'
            ]
          },
          {
            name: 'Skeptic',
            emoji: '🔍',
            focus: 'questioning assumptions and finding failure modes',
            questions: [
              'What could go wrong that wasn\'t considered?',
              'What edge cases were missed?',
              'Is there a simpler explanation for the outcome?'
            ]
          },
          {
            name: 'Architect',
            emoji: '🏗️',
            focus: 'structural issues and design patterns',
            questions: [
              'Was the overall approach well-structured?',
              'Did the solution follow good patterns?',
              'What architectural decisions led to this outcome?'
            ]
          },
          {
            name: 'Pragmatist',
            emoji: '⚡',
            focus: 'efficiency and practical concerns',
            questions: [
              'Was this the most efficient approach?',
              'Were there unnecessary steps or complexity?',
              'What would make this faster/easier next time?'
            ]
          }
        ];

        // Generate critiques from each persona
        const critiques = [];

        output += `🎭 PERSONA CRITIQUES\n`;
        output += `─────────────────────────────────────────────────\n\n`;

        for (const persona of personas) {
          const critique = {
            persona: persona.name,
            focus: persona.focus,
            analysis: [],
            severity: 'low' // Will be upgraded based on findings
          };

          output += `${persona.emoji} ${persona.name.toUpperCase()} (${persona.focus}):\n`;

          // Analyze based on outcome and persona perspective
          if (outcome === 'failure') {
            critique.severity = 'high';

            if (persona.name === 'Verifier') {
              if (error_messages) {
                critique.analysis.push(`Error indicates: ${error_messages.substring(0, 100)}`);
              }
              critique.analysis.push('The task requirements were not met');
            } else if (persona.name === 'Skeptic') {
              critique.analysis.push('What assumption failed? Review preconditions.');
              if (tools_used.length > 5) {
                critique.analysis.push(`Used ${tools_used.length} tools - was this approach too complex?`);
              }
            } else if (persona.name === 'Architect') {
              critique.analysis.push('Consider if the overall approach was flawed');
              critique.analysis.push('Should a different pattern have been used?');
            } else if (persona.name === 'Pragmatist') {
              critique.analysis.push('Failure after effort is costly - identify prevention');
              critique.analysis.push('Could earlier validation have caught this?');
            }
          } else if (outcome === 'partial') {
            critique.severity = 'medium';

            if (persona.name === 'Verifier') {
              critique.analysis.push('Partial success - what specifically was missing?');
            } else if (persona.name === 'Skeptic') {
              critique.analysis.push('What prevented full completion?');
            } else if (persona.name === 'Architect') {
              critique.analysis.push('Was the scope properly estimated?');
            } else if (persona.name === 'Pragmatist') {
              critique.analysis.push('Is completion worth the additional effort?');
            }
          } else { // success
            critique.severity = 'low';

            if (persona.name === 'Verifier') {
              critique.analysis.push('Task completed as specified ✓');
            } else if (persona.name === 'Skeptic') {
              critique.analysis.push('Success is good, but what could still go wrong later?');
            } else if (persona.name === 'Architect') {
              critique.analysis.push('Good outcome - is this approach reusable?');
            } else if (persona.name === 'Pragmatist') {
              critique.analysis.push('Success achieved - can it be done faster next time?');
            }
          }

          // Add persona's questions for consideration
          critique.questions = persona.questions;

          for (const point of critique.analysis) {
            output += `   • ${point}\n`;
          }
          output += `\n`;

          critiques.push(critique);
        }

        // Synthesize critiques into unified reflection (Judge role)
        output += `⚖️ SYNTHESIS (Judge)\n`;
        output += `─────────────────────────────────────────────────\n\n`;

        const highSeverity = critiques.filter(c => c.severity === 'high');
        const mediumSeverity = critiques.filter(c => c.severity === 'medium');

        // Calculate consensus severity
        let consensusSeverity = 'low';
        let surpriseScore = 1;

        if (highSeverity.length >= 2) {
          consensusSeverity = 'high';
          surpriseScore = 9;
        } else if (highSeverity.length >= 1 || mediumSeverity.length >= 2) {
          consensusSeverity = 'medium';
          surpriseScore = 6;
        } else if (mediumSeverity.length >= 1) {
          consensusSeverity = 'low-medium';
          surpriseScore = 4;
        }

        // Classify the root cause
        let rootCause = 'UNKNOWN';
        let recommendation = '';

        if (outcome === 'failure') {
          if (error_messages.includes('not found') || error_messages.includes('permission') || error_messages.includes('timeout')) {
            rootCause = 'EXECUTION';
            recommendation = 'Add prerequisite checks or retry logic';
          } else if (details.includes('wrong') || details.includes('misunderstood') || details.includes('unclear')) {
            rootCause = 'SPECIFICATION';
            recommendation = 'Clarify requirements before starting; update protocol with clearer triggers';
          } else if (tools_used.length > 10 || details.includes('complex') || details.includes('too many')) {
            rootCause = 'CAPABILITY';
            recommendation = 'Break into smaller tasks or graduate to dedicated tool';
          } else {
            rootCause = 'NEEDS_INVESTIGATION';
            recommendation = 'Review the full context to understand what went wrong';
          }
        } else if (outcome === 'partial') {
          rootCause = 'SCOPE';
          recommendation = 'Better scope estimation; consider incremental delivery';
        } else {
          rootCause = 'NONE';
          recommendation = 'Capture successful pattern for reuse';
        }

        output += `📊 Consensus Severity: ${consensusSeverity.toUpperCase()}\n`;
        output += `⚡ Surprise Score: ${surpriseScore}/10\n`;
        output += `🏷️ Root Cause: ${rootCause}\n`;
        output += `💡 Recommendation: ${recommendation}\n\n`;

        // Actionable next steps
        output += `📝 ACTIONABLE INSIGHTS\n`;
        output += `─────────────────────────────────────────────────\n`;

        if (surpriseScore >= 7) {
          output += `   ⚠️ HIGH SURPRISE - Consider protocol update:\n`;
          output += `   → mikey_propose protocol_id="..." change_type="..." description="..."\n\n`;
        }

        if (rootCause === 'SPECIFICATION') {
          output += `   📋 Specification issue detected:\n`;
          output += `   → Review protocol triggers and preconditions\n`;
          output += `   → Add clarifying questions to task-approach protocol\n\n`;
        }

        if (rootCause === 'CAPABILITY') {
          output += `   🔧 Capability gap detected:\n`;
          output += `   → Consider mikey_graduation_track for tool promotion\n`;
          output += `   → Break complex operations into protocol chunks\n\n`;
        }

        // Store the MAR reflection
        const marReflection = {
          task,
          outcome,
          details,
          error_messages,
          tools_used,
          code_or_output: code_or_output.substring(0, 500), // Truncate for storage
          critiques: critiques.map(c => ({
            persona: c.persona,
            severity: c.severity,
            analysis: c.analysis
          })),
          synthesis: {
            consensus_severity: consensusSeverity,
            surprise_score: surpriseScore,
            root_cause: rootCause,
            recommendation
          },
          timestamp,
          reflection_type: 'MAR'
        };

        const reflectionKey = `mar_reflection_${timestamp.replace(/[:.]/g, '-')}`;
        db.prepare(`
          INSERT OR REPLACE INTO memories (key, value, type, metadata, created_at, updated_at, accessed_at)
          VALUES (?, ?, 'reflection', '{"reflection_type": "MAR"}', ?, ?, ?)
        `).run(reflectionKey, JSON.stringify(marReflection), timestamp, timestamp, timestamp);

        db.close();

        output += `\n✅ MAR Reflection stored as: ${reflectionKey}`;

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}\n${error.stack}` }] };
      }
    }
  },

  // ===== MEMORY CONSOLIDATION =====
  {
    name: 'mikey_consolidate',
    description: 'Analyze memories for consolidation opportunities - find redundant, outdated, or related memories that can be merged into higher-level patterns',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['analyze', 'preview', 'execute'],
          description: 'analyze=find opportunities, preview=show what would change, execute=perform consolidation',
          default: 'analyze'
        },
        target: {
          type: 'string',
          enum: ['duplicates', 'stale', 'related', 'all'],
          description: 'What to consolidate: duplicates, stale (>3 months unused), related (similar topics), or all',
          default: 'all'
        },
        prefix: {
          type: 'string',
          description: 'Optional: only consolidate memories with this key prefix (e.g., "brain_init")'
        },
        dry_run: {
          type: 'boolean',
          description: 'If true, show what would happen without making changes',
          default: true
        }
      }
    },
    handler: async ({ mode = 'analyze', target = 'all', prefix = null, dry_run = true }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);

        let output = `🧠 Memory Consolidation - ${mode.toUpperCase()} mode\n`;
        output += `═══════════════════════════════════════════════════\n\n`;

        // Get all memories
        let memories;
        if (prefix) {
          memories = db.prepare(`
            SELECT id, key, value, type, created_at, updated_at, accessed_at
            FROM memories
            WHERE key LIKE ?
            ORDER BY key
          `).all(prefix + '%');
          output += `📁 Scope: memories with prefix "${prefix}" (${memories.length} found)\n\n`;
        } else {
          memories = db.prepare(`
            SELECT id, key, value, type, created_at, updated_at, accessed_at
            FROM memories
            ORDER BY key
          `).all();
          output += `📁 Scope: all memories (${memories.length} total)\n\n`;
        }

        const consolidationOps = [];

        // === FIND STALE MEMORIES ===
        if (target === 'stale' || target === 'all') {
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          const threshold = threeMonthsAgo.toISOString();

          const stale = memories.filter(m => {
            const lastAccess = m.accessed_at || m.updated_at || m.created_at;
            return lastAccess < threshold;
          });

          if (stale.length > 0) {
            output += `📅 STALE MEMORIES (not accessed in 3+ months): ${stale.length}\n`;
            output += `─────────────────────────────────────────────────\n`;

            // Group by type
            const byType = {};
            for (const m of stale) {
              byType[m.type] = byType[m.type] || [];
              byType[m.type].push(m);
            }

            for (const [type, mems] of Object.entries(byType).sort((a, b) => b[1].length - a[1].length)) {
              output += `  ${type}: ${mems.length} memories\n`;
              for (const m of mems.slice(0, 3)) {
                output += `    - ${m.key}\n`;
              }
              if (mems.length > 3) {
                output += `    ... and ${mems.length - 3} more\n`;
              }

              consolidationOps.push({
                action: 'archive_stale',
                type: type,
                keys: mems.map(m => m.key),
                reason: `${mems.length} stale ${type} memories`
              });
            }
            output += `\n`;
          }
        }

        // === FIND RELATED MEMORIES (same prefix) ===
        if (target === 'related' || target === 'all') {
          // Find memories with common prefixes
          const prefixes = {};
          for (const m of memories) {
            // Extract prefix (everything before last underscore or first significant word)
            const parts = m.key.split('_');
            if (parts.length >= 2) {
              const pfx = parts.slice(0, 2).join('_');
              prefixes[pfx] = prefixes[pfx] || [];
              prefixes[pfx].push(m);
            }
          }

          // Find prefixes with multiple related memories
          const relatedGroups = Object.entries(prefixes)
            .filter(([pfx, mems]) => mems.length >= 3)
            .sort((a, b) => b[1].length - a[1].length);

          if (relatedGroups.length > 0) {
            output += `🔗 RELATED MEMORY GROUPS (3+ with same prefix):\n`;
            output += `─────────────────────────────────────────────────\n`;

            for (const [pfx, mems] of relatedGroups.slice(0, 10)) {
              output += `  "${pfx}_*": ${mems.length} memories\n`;
              for (const m of mems.slice(0, 5)) {
                const preview = typeof m.value === 'string' ? m.value.substring(0, 50) : JSON.stringify(m.value).substring(0, 50);
                output += `    - ${m.key}: ${preview}...\n`;
              }
              if (mems.length > 5) {
                output += `    ... and ${mems.length - 5} more\n`;
              }

              consolidationOps.push({
                action: 'merge_related',
                prefix: pfx,
                keys: mems.map(m => m.key),
                reason: `${mems.length} related memories could become 1 comprehensive memory`
              });

              output += `\n`;
            }
          }
        }

        // === FIND DUPLICATES (similar values) ===
        if (target === 'duplicates' || target === 'all') {
          // Simple duplicate detection based on value similarity
          const valueHashes = {};
          for (const m of memories) {
            // Create a simple hash of the value
            const valStr = typeof m.value === 'string' ? m.value : JSON.stringify(m.value);
            const shortHash = valStr.substring(0, 100).toLowerCase().replace(/\s+/g, ' ');
            valueHashes[shortHash] = valueHashes[shortHash] || [];
            valueHashes[shortHash].push(m);
          }

          const duplicates = Object.entries(valueHashes)
            .filter(([hash, mems]) => mems.length > 1);

          if (duplicates.length > 0) {
            output += `📋 POTENTIAL DUPLICATES (similar content): ${duplicates.length} groups\n`;
            output += `─────────────────────────────────────────────────\n`;

            for (const [hash, mems] of duplicates.slice(0, 5)) {
              output += `  Group (${mems.length} similar):\n`;
              for (const m of mems) {
                output += `    - ${m.key} (${m.type})\n`;
              }

              consolidationOps.push({
                action: 'deduplicate',
                keys: mems.map(m => m.key),
                keep: mems[mems.length - 1].key, // Keep most recent
                reason: `${mems.length} memories with similar content`
              });

              output += `\n`;
            }
          }
        }

        // === SUMMARY ===
        output += `\n📊 CONSOLIDATION SUMMARY\n`;
        output += `═══════════════════════════════════════════════════\n`;
        output += `Total memories: ${memories.length}\n`;
        output += `Consolidation opportunities found: ${consolidationOps.length}\n\n`;

        if (consolidationOps.length > 0) {
          const archiveOps = consolidationOps.filter(o => o.action === 'archive_stale');
          const mergeOps = consolidationOps.filter(o => o.action === 'merge_related');
          const dedupeOps = consolidationOps.filter(o => o.action === 'deduplicate');

          if (archiveOps.length > 0) {
            const totalStale = archiveOps.reduce((sum, o) => sum + o.keys.length, 0);
            output += `  📅 Stale memories to archive: ${totalStale}\n`;
          }
          if (mergeOps.length > 0) {
            const totalMerge = mergeOps.reduce((sum, o) => sum + o.keys.length, 0);
            output += `  🔗 Related memories to merge: ${totalMerge} → ${mergeOps.length}\n`;
          }
          if (dedupeOps.length > 0) {
            const totalDupe = dedupeOps.reduce((sum, o) => sum + o.keys.length, 0);
            output += `  📋 Duplicate memories to dedupe: ${totalDupe} → ${dedupeOps.length}\n`;
          }

          if (mode === 'analyze') {
            output += `\n💡 Next steps:\n`;
            output += `  1. Run with mode="preview" to see detailed changes\n`;
            output += `  2. Run with mode="execute" dry_run=false to apply\n`;
          }
        }

        // === EXECUTE MODE ===
        if (mode === 'execute' && !dry_run) {
          output += `\n⚠️ EXECUTING CONSOLIDATION...\n`;
          output += `─────────────────────────────────────────────────\n`;

          let archived = 0;
          let merged = 0;
          let deduped = 0;

          // Create archive table if not exists
          db.exec(`
            CREATE TABLE IF NOT EXISTS memories_archive (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              original_key TEXT NOT NULL,
              original_value TEXT NOT NULL,
              original_type TEXT,
              archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              archive_reason TEXT,
              consolidated_into TEXT
            )
          `);

          const archiveStmt = db.prepare(`
            INSERT INTO memories_archive (original_key, original_value, original_type, archive_reason, consolidated_into)
            SELECT key, value, type, ?, ?
            FROM memories WHERE key = ?
          `);

          const deleteStmt = db.prepare(`DELETE FROM memories WHERE key = ?`);

          for (const op of consolidationOps) {
            if (op.action === 'archive_stale') {
              for (const key of op.keys) {
                archiveStmt.run(op.reason, null, key);
                deleteStmt.run(key);
                archived++;
              }
            } else if (op.action === 'deduplicate') {
              // Keep the designated one, archive the rest
              for (const key of op.keys) {
                if (key !== op.keep) {
                  archiveStmt.run(op.reason, op.keep, key);
                  deleteStmt.run(key);
                  deduped++;
                }
              }
            }
            // Note: merge_related requires human review to create summary - not auto-executed
          }

          output += `  ✅ Archived: ${archived} stale memories\n`;
          output += `  ✅ Deduplicated: ${deduped} duplicate memories\n`;
          output += `  ⏳ Merge operations require manual review (use mikey_consolidate_merge)\n`;

          // Get new total
          const newTotal = db.prepare(`SELECT COUNT(*) as count FROM memories`).get().count;
          output += `\n📊 New memory count: ${newTotal} (was ${memories.length})\n`;
        } else if (mode === 'execute') {
          output += `\n⚠️ dry_run=true - no changes made. Set dry_run=false to execute.\n`;
        }

        db.close();

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}\n${error.stack}` }] };
      }
    }
  },

  {
    name: 'mikey_consolidate_merge',
    description: 'Manually merge a group of related memories into a single consolidated memory with your summary',
    inputSchema: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of memory keys to merge'
        },
        new_key: {
          type: 'string',
          description: 'Key for the new consolidated memory'
        },
        new_value: {
          type: 'string',
          description: 'The consolidated summary/value for the new memory'
        },
        new_type: {
          type: 'string',
          description: 'Type for the new memory (e.g., "pattern", "consolidated")',
          default: 'consolidated'
        },
        archive_originals: {
          type: 'boolean',
          description: 'Whether to archive the original memories',
          default: true
        }
      },
      required: ['keys', 'new_key', 'new_value']
    },
    handler: async ({ keys, new_key, new_value, new_type = 'consolidated', archive_originals = true }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);

        let output = `🔗 Memory Merge Operation\n`;
        output += `═══════════════════════════════════════════════════\n\n`;

        // Get the original memories
        const placeholders = keys.map(() => '?').join(',');
        const originals = db.prepare(`
          SELECT key, value, type, created_at FROM memories WHERE key IN (${placeholders})
        `).all(...keys);

        output += `📥 Source memories: ${originals.length}\n`;
        for (const m of originals) {
          output += `  - ${m.key} (${m.type})\n`;
        }
        output += `\n`;

        if (archive_originals) {
          // Create archive table if not exists
          db.exec(`
            CREATE TABLE IF NOT EXISTS memories_archive (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              original_key TEXT NOT NULL,
              original_value TEXT NOT NULL,
              original_type TEXT,
              archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              archive_reason TEXT,
              consolidated_into TEXT
            )
          `);

          // Archive originals
          const archiveStmt = db.prepare(`
            INSERT INTO memories_archive (original_key, original_value, original_type, archive_reason, consolidated_into)
            VALUES (?, ?, ?, 'manual_consolidation', ?)
          `);

          for (const m of originals) {
            archiveStmt.run(m.key, m.value, m.type, new_key);
          }

          // Delete originals
          const deleteStmt = db.prepare(`DELETE FROM memories WHERE key = ?`);
          for (const m of originals) {
            deleteStmt.run(m.key);
          }

          output += `📦 Archived ${originals.length} original memories\n`;
        }

        // Create new consolidated memory
        const insertStmt = db.prepare(`
          INSERT OR REPLACE INTO memories (key, value, type, metadata)
          VALUES (?, ?, ?, ?)
        `);

        const metadata = JSON.stringify({
          consolidated_from: keys,
          consolidated_at: new Date().toISOString(),
          original_count: originals.length
        });

        insertStmt.run(new_key, new_value, new_type, metadata);

        output += `\n✅ Created consolidated memory:\n`;
        output += `  Key: ${new_key}\n`;
        output += `  Type: ${new_type}\n`;
        output += `  Value preview: ${new_value.substring(0, 200)}...\n`;

        db.close();

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  // ===== EXPERIENCE-DRIVEN PROCEDURAL LEARNING =====
  {
    name: 'mikey_pattern_detect',
    description: 'Analyze action sequences to detect repeated patterns that could become procedures. Looks at reflections, tool usage, and memory access patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        min_occurrences: { type: 'number', description: 'Minimum times a pattern must appear (default: 3)', default: 3 },
        time_window_days: { type: 'number', description: 'Look back this many days (default: 30)', default: 30 },
        pattern_type: {
          type: 'string',
          enum: ['tool_sequence', 'task_pattern', 'error_recovery', 'all'],
          description: 'Type of pattern to detect',
          default: 'all'
        }
      }
    },
    handler: async ({ min_occurrences = 3, time_window_days = 30, pattern_type = 'all' }) => {
      try {
        const db = new Database(BRAIN_DB_PATH, { readonly: true });

        let output = `🔍 Pattern Detection Analysis\n`;
        output += `════════════════════════════════\n`;
        output += `Looking back ${time_window_days} days, min occurrences: ${min_occurrences}\n\n`;

        const patterns = [];

        // 1. Detect tool sequence patterns from reflections
        if (pattern_type === 'all' || pattern_type === 'tool_sequence') {
          const reflections = db.prepare(`
            SELECT key, value FROM memories
            WHERE type = 'reflection'
            AND created_at > datetime('now', '-${time_window_days} days')
            ORDER BY created_at DESC
          `).all();

          // Extract tool sequences
          const toolSequences = {};
          for (const r of reflections) {
            try {
              const data = JSON.parse(r.value);
              if (data.tools_used && data.tools_used.length >= 2) {
                const seq = data.tools_used.slice(0, 4).join(' → ');
                if (!toolSequences[seq]) {
                  toolSequences[seq] = { count: 0, outcomes: [], tasks: [] };
                }
                toolSequences[seq].count++;
                toolSequences[seq].outcomes.push(data.outcome);
                if (data.task) toolSequences[seq].tasks.push(data.task.substring(0, 50));
              }
            } catch (e) { /* skip invalid JSON */ }
          }

          // Filter by min occurrences
          const frequentSeqs = Object.entries(toolSequences)
            .filter(([_, v]) => v.count >= min_occurrences)
            .sort((a, b) => b[1].count - a[1].count);

          if (frequentSeqs.length > 0) {
            output += `📊 TOOL SEQUENCE PATTERNS:\n`;
            for (const [seq, data] of frequentSeqs.slice(0, 5)) {
              const successRate = data.outcomes.filter(o => o === 'success').length / data.outcomes.length;
              patterns.push({
                type: 'tool_sequence',
                pattern: seq,
                occurrences: data.count,
                success_rate: successRate,
                sample_tasks: [...new Set(data.tasks)].slice(0, 3)
              });
              output += `\n   ${seq}\n`;
              output += `   Occurrences: ${data.count} | Success: ${(successRate * 100).toFixed(0)}%\n`;
              output += `   Sample tasks: ${[...new Set(data.tasks)].slice(0, 2).join(', ')}\n`;
            }
            output += `\n`;
          }
        }

        // 2. Detect task patterns (similar task descriptions with similar approaches)
        if (pattern_type === 'all' || pattern_type === 'task_pattern') {
          const reflections = db.prepare(`
            SELECT key, value FROM memories
            WHERE type = 'reflection'
            AND created_at > datetime('now', '-${time_window_days} days')
          `).all();

          // Extract keywords from tasks
          const taskKeywords = {};
          for (const r of reflections) {
            try {
              const data = JSON.parse(r.value);
              if (data.task) {
                // Extract meaningful words
                const words = data.task.toLowerCase()
                  .replace(/[^a-z\s]/g, '')
                  .split(/\s+/)
                  .filter(w => w.length > 4 && !['about', 'after', 'before', 'could', 'should', 'would', 'their', 'there', 'where', 'which'].includes(w));

                for (const word of words) {
                  if (!taskKeywords[word]) {
                    taskKeywords[word] = { count: 0, tools: [], outcomes: [] };
                  }
                  taskKeywords[word].count++;
                  if (data.tools_used) taskKeywords[word].tools.push(...data.tools_used);
                  taskKeywords[word].outcomes.push(data.outcome);
                }
              }
            } catch (e) { /* skip */ }
          }

          // Find task clusters
          const taskClusters = Object.entries(taskKeywords)
            .filter(([_, v]) => v.count >= min_occurrences)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5);

          if (taskClusters.length > 0) {
            output += `📋 TASK PATTERN CLUSTERS:\n`;
            for (const [keyword, data] of taskClusters) {
              const commonTools = [...new Set(data.tools)].slice(0, 3);
              const successRate = data.outcomes.filter(o => o === 'success').length / data.outcomes.length;
              patterns.push({
                type: 'task_pattern',
                keyword,
                occurrences: data.count,
                common_tools: commonTools,
                success_rate: successRate
              });
              output += `\n   "${keyword}" tasks (${data.count}x)\n`;
              output += `   Common tools: ${commonTools.join(', ')}\n`;
              output += `   Success rate: ${(successRate * 100).toFixed(0)}%\n`;
            }
            output += `\n`;
          }
        }

        // 3. Detect error recovery patterns
        if (pattern_type === 'all' || pattern_type === 'error_recovery') {
          const reflections = db.prepare(`
            SELECT key, value FROM memories
            WHERE type = 'reflection'
            AND json_extract(value, '$.outcome') != 'success'
            AND created_at > datetime('now', '-${time_window_days} days')
          `).all();

          // Group by failure class
          const recoveryPatterns = {};
          for (const r of reflections) {
            try {
              const data = JSON.parse(r.value);
              const failClass = data.failure_class || 'UNKNOWN';
              if (!recoveryPatterns[failClass]) {
                recoveryPatterns[failClass] = { count: 0, errors: [], suggestions: [] };
              }
              recoveryPatterns[failClass].count++;
              if (data.error_messages) recoveryPatterns[failClass].errors.push(data.error_messages.substring(0, 100));
              if (data.diagnosis) recoveryPatterns[failClass].suggestions.push(data.diagnosis);
            } catch (e) { /* skip */ }
          }

          const frequentFailures = Object.entries(recoveryPatterns)
            .filter(([_, v]) => v.count >= min_occurrences)
            .sort((a, b) => b[1].count - a[1].count);

          if (frequentFailures.length > 0) {
            output += `⚠️ ERROR RECOVERY PATTERNS:\n`;
            for (const [failClass, data] of frequentFailures) {
              patterns.push({
                type: 'error_recovery',
                failure_class: failClass,
                occurrences: data.count,
                sample_errors: [...new Set(data.errors)].slice(0, 2)
              });
              output += `\n   ${failClass} failures (${data.count}x)\n`;
              output += `   Sample errors: ${[...new Set(data.errors)].slice(0, 2).join('; ').substring(0, 100)}...\n`;
            }
            output += `\n`;
          }
        }

        db.close();

        // Summary and recommendations
        output += `═══════════════════════════════\n`;
        output += `📈 SUMMARY: Found ${patterns.length} recurring patterns\n\n`;

        if (patterns.length > 0) {
          output += `💡 RECOMMENDATIONS:\n`;
          for (const p of patterns.slice(0, 3)) {
            if (p.type === 'tool_sequence' && p.success_rate > 0.8) {
              output += `   → Consider procedure for: "${p.pattern}"\n`;
              output += `     High success rate (${(p.success_rate * 100).toFixed(0)}%) across ${p.occurrences} uses\n`;
            } else if (p.type === 'task_pattern') {
              output += `   → "${p.keyword}" tasks could use a dedicated workflow\n`;
            } else if (p.type === 'error_recovery' && p.occurrences >= 5) {
              output += `   → Add error handling for ${p.failure_class} failures\n`;
            }
          }
          output += `\n🔧 Use mikey_procedure_propose to formalize a pattern`;
        } else {
          output += `No strong patterns detected. Continue working to build more data.`;
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  {
    name: 'mikey_procedure_propose',
    description: 'Propose a new procedure based on detected patterns. Creates a formal procedure spec that can become a protocol.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Procedure name (e.g., "debug-mcp-connection")' },
        trigger: { type: 'string', description: 'When this procedure should activate' },
        steps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ordered list of steps'
        },
        based_on: { type: 'string', description: 'Pattern or observation this is based on' },
        expected_outcome: { type: 'string', description: 'What success looks like' }
      },
      required: ['name', 'trigger', 'steps', 'based_on']
    },
    handler: async ({ name, trigger, steps, based_on, expected_outcome = 'Task completed successfully' }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);

        // Create procedures table if needed
        db.exec(`
          CREATE TABLE IF NOT EXISTS procedures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            trigger TEXT NOT NULL,
            steps TEXT NOT NULL,
            based_on TEXT,
            expected_outcome TEXT,
            status TEXT DEFAULT 'proposed',
            usage_count INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_used TEXT
          )
        `);

        // Insert procedure
        const stmt = db.prepare(`
          INSERT INTO procedures (name, trigger, steps, based_on, expected_outcome)
          VALUES (?, ?, ?, ?, ?)
        `);

        stmt.run(name, trigger, JSON.stringify(steps), based_on, expected_outcome);

        // Also store as memory for discoverability
        const memKey = `procedure_${name}`;
        const memValue = JSON.stringify({
          name,
          trigger,
          steps,
          based_on,
          expected_outcome,
          proposed_at: new Date().toISOString()
        });

        db.prepare(`
          INSERT OR REPLACE INTO memories (key, value, type, created_at, accessed_at)
          VALUES (?, ?, 'procedure', datetime('now'), datetime('now'))
        `).run(memKey, memValue);

        db.close();

        let output = `📝 Procedure Proposed\n`;
        output += `═══════════════════════\n\n`;
        output += `📋 Name: ${name}\n`;
        output += `⚡ Trigger: ${trigger}\n`;
        output += `📊 Based on: ${based_on}\n\n`;
        output += `📑 Steps:\n`;
        steps.forEach((step, i) => {
          output += `   ${i + 1}. ${step}\n`;
        });
        output += `\n✅ Expected outcome: ${expected_outcome}\n\n`;
        output += `🔄 Status: PROPOSED\n`;
        output += `   Use mikey_procedure_use when following this procedure\n`;
        output += `   After 5+ successful uses, consider protocol graduation`;

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
          return { content: [{ type: 'text', text: `⚠️ Procedure "${name}" already exists. Use a different name or update existing.` }] };
        }
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  {
    name: 'mikey_procedure_use',
    description: 'Record that a procedure was used and track its outcome. Builds data for graduation decisions.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Procedure name' },
        outcome: { type: 'string', enum: ['success', 'partial', 'failure'], description: 'How it went' },
        notes: { type: 'string', description: 'Any observations or deviations' }
      },
      required: ['name', 'outcome']
    },
    handler: async ({ name, outcome, notes = '' }) => {
      try {
        const db = new Database(BRAIN_DB_PATH);

        // Update procedure stats
        const updateStmt = db.prepare(`
          UPDATE procedures
          SET usage_count = usage_count + 1,
              success_count = success_count + CASE WHEN ? = 'success' THEN 1 ELSE 0 END,
              last_used = datetime('now')
          WHERE name = ?
        `);

        const result = updateStmt.run(outcome, name);

        if (result.changes === 0) {
          db.close();
          return { content: [{ type: 'text', text: `⚠️ Procedure "${name}" not found. Use mikey_procedure_list to see available procedures.` }] };
        }

        // Get updated stats
        const proc = db.prepare(`SELECT * FROM procedures WHERE name = ?`).get(name);

        // Log usage in memories
        db.prepare(`
          INSERT INTO memories (key, value, type, created_at, accessed_at)
          VALUES (?, ?, 'procedure_use', datetime('now'), datetime('now'))
        `).run(
          `procedure_use_${name}_${Date.now()}`,
          JSON.stringify({ name, outcome, notes, used_at: new Date().toISOString() })
        );

        db.close();

        const successRate = proc.usage_count > 0 ? (proc.success_count / proc.usage_count * 100).toFixed(0) : 0;

        let output = `📊 Procedure Usage Recorded\n`;
        output += `═══════════════════════════\n\n`;
        output += `📋 ${name}: ${outcome === 'success' ? '✅' : outcome === 'partial' ? '⚠️' : '❌'} ${outcome.toUpperCase()}\n`;
        if (notes) output += `📝 Notes: ${notes}\n`;
        output += `\n📈 Stats:\n`;
        output += `   Total uses: ${proc.usage_count}\n`;
        output += `   Success rate: ${successRate}%\n`;

        // Graduation recommendation
        if (proc.usage_count >= 5) {
          if (parseFloat(successRate) >= 80) {
            output += `\n🎓 GRADUATION READY!\n`;
            output += `   High success rate with sufficient usage.\n`;
            output += `   Consider converting to formal protocol.`;
          } else if (parseFloat(successRate) < 50) {
            output += `\n⚠️ LOW SUCCESS RATE\n`;
            output += `   Consider revising procedure steps.`;
          }
        } else {
          output += `\n📊 ${5 - proc.usage_count} more uses until graduation evaluation`;
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  {
    name: 'mikey_procedure_list',
    description: 'List all procedures with their usage stats and graduation status',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['all', 'proposed', 'active', 'graduated'],
          description: 'Filter by status',
          default: 'all'
        },
        ready_for_graduation: {
          type: 'boolean',
          description: 'Only show procedures ready for graduation',
          default: false
        }
      }
    },
    handler: async ({ status = 'all', ready_for_graduation = false }) => {
      try {
        const db = new Database(BRAIN_DB_PATH, { readonly: true });

        // Check if table exists
        const tableExists = db.prepare(`
          SELECT name FROM sqlite_master WHERE type='table' AND name='procedures'
        `).get();

        if (!tableExists) {
          db.close();
          return { content: [{ type: 'text', text: `📋 No procedures found.\n\nUse mikey_pattern_detect to find patterns, then mikey_procedure_propose to create procedures.` }] };
        }

        let query = `SELECT * FROM procedures`;
        if (status !== 'all') {
          query += ` WHERE status = '${status}'`;
        }
        query += ` ORDER BY usage_count DESC`;

        const procedures = db.prepare(query).all();
        db.close();

        if (procedures.length === 0) {
          return { content: [{ type: 'text', text: `📋 No procedures found matching criteria.` }] };
        }

        let output = `📚 Procedures Library\n`;
        output += `════════════════════════\n\n`;

        let graduationReady = [];

        for (const proc of procedures) {
          const successRate = proc.usage_count > 0 ? (proc.success_count / proc.usage_count * 100).toFixed(0) : 0;
          const isReady = proc.usage_count >= 5 && parseFloat(successRate) >= 80;

          if (ready_for_graduation && !isReady) continue;
          if (isReady) graduationReady.push(proc.name);

          const statusIcon = proc.status === 'graduated' ? '🎓' : proc.status === 'active' ? '✅' : '📝';
          output += `${statusIcon} ${proc.name}\n`;
          output += `   Trigger: ${proc.trigger.substring(0, 60)}${proc.trigger.length > 60 ? '...' : ''}\n`;
          output += `   Uses: ${proc.usage_count} | Success: ${successRate}% | Status: ${proc.status}\n`;

          if (isReady && proc.status !== 'graduated') {
            output += `   🎓 READY FOR GRADUATION\n`;
          }
          output += `\n`;
        }

        if (graduationReady.length > 0 && !ready_for_graduation) {
          output += `═══════════════════════════\n`;
          output += `🎓 ${graduationReady.length} procedure(s) ready for graduation:\n`;
          output += `   ${graduationReady.join(', ')}\n`;
        }

        return { content: [{ type: 'text', text: output }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `❌ Error: ${error.message}` }] };
      }
    }
  },

  // ===== BRAIN INIT V5 TOOLS =====
  brainInitV5Tool,
  brainInitV5StatusTool,
  brainInitV5WorkingTool
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
