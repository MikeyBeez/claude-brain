/**
 * ContextDiscoveryService - Core Discovery Engine for Second Reboot
 * 
 * This service implements intelligent context discovery by analyzing user intent
 * and building optimized context manifests for adaptive loading.
 * 
 * Key Innovation: Move from "load everything just in case" to 
 * "load what's needed when it's needed"
 */

class ContextDiscoveryService {
  constructor() {
    this.sources = {
      brain: '/Users/bard/Code/claude-brain/data/BrainVault/',
      projects: '/Users/bard/Code/',
      memory: 'brain:state_get',
      obsidian: 'brain:obsidian_note'
    };
    
    this.contextBudget = 0.30; // 30% default budget
    this.intentClassifier = new IntentAnalyzer();
    this.manifestBuilder = new ManifestBuilder();
    
    // Context categories with priority weights
    this.contextCategories = {
      critical: { weight: 1.0, maxBudget: 0.10 },    // Boot Loader, Bag of Tricks
      active: { weight: 0.9, maxBudget: 0.15 },      // Current project, recent work
      protocols: { weight: 0.8, maxBudget: 0.10 },   // Task-specific protocols
      architecture: { weight: 0.7, maxBudget: 0.08 }, // Architecture docs
      tools: { weight: 0.6, maxBudget: 0.07 },       // Tool intelligence
      historical: { weight: 0.5, maxBudget: 0.05 }   // Past context, preferences
    };
  }

  /**
   * Main discovery method - analyzes intent and returns optimized context manifest
   * @param {string} userMessage - The user's message to analyze
   * @param {Object} options - Additional context options
   * @returns {Promise<Object>} Context manifest with loading instructions
   */
  async discoverContext(userMessage, options = {}) {
    console.error('🔍 Starting context discovery for user intent...');
    
    try {
      // Step 1: Analyze user intent
      const intentAnalysis = await this.analyzeIntent(userMessage, options);
      console.error('📊 Intent analysis:', intentAnalysis);
      
      // Step 2: Build context manifest based on intent
      const manifest = await this.buildContextManifest(intentAnalysis);
      console.error('📋 Context manifest built:', manifest.summary);
      
      // Step 3: Prioritize and optimize loading instructions
      const loadingInstructions = await this.prioritizeLoading(manifest);
      console.error('🎯 Loading instructions optimized');
      
      return {
        intent: intentAnalysis,
        manifest: manifest,
        instructions: loadingInstructions,
        estimated_usage: this.calculateEstimatedUsage(loadingInstructions),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Context discovery failed:', error);
      // Fallback to minimal critical context
      return this.getEmergencyContext();
    }
  }

  /**
   * Analyzes user intent to determine task type and requirements
   */
  async analyzeIntent(userMessage, options) {
    const analysis = {
      taskType: 'unknown',
      complexity: 'medium',
      domain: 'general',
      protocols: [],
      contextNeeds: {},
      confidence: 0.0
    };

    // Quick intent classification patterns
    const intentPatterns = {
      development: {
        patterns: [/code/, /implement/, /build/, /create/, /fix/, /debug/, /program/i],
        protocols: ['error-recovery', 'task-approach'],
        contextNeeds: { critical: true, active: true, tools: true }
      },
      research: {
        patterns: [/research/, /analyze/, /investigate/, /study/, /explore/i],
        protocols: ['information-integration', 'task-approach'],
        contextNeeds: { critical: true, architecture: true, historical: true }
      },
      project_management: {
        patterns: [/project/, /plan/, /organize/, /manage/, /track/i],
        protocols: ['progress-communication', 'task-approach'],
        contextNeeds: { critical: true, active: true, protocols: true }
      },
      communication: {
        patterns: [/explain/, /tell/, /show/, /describe/, /help/i],
        protocols: ['user-communication'],
        contextNeeds: { critical: true, tools: false }
      },
      system_operation: {
        patterns: [/brain/, /init/, /load/, /memory/, /state/i],
        protocols: ['task-approach', 'error-recovery'],
        contextNeeds: { critical: true, protocols: true, tools: true }
      }
    };

    // Classify based on patterns
    for (const [type, config] of Object.entries(intentPatterns)) {
      const matches = config.patterns.filter(pattern => pattern.test(userMessage));
      if (matches.length > 0) {
        analysis.taskType = type;
        analysis.protocols = config.protocols;
        analysis.contextNeeds = config.contextNeeds;
        analysis.confidence = Math.min(0.9, matches.length * 0.3);
        break;
      }
    }

    // Assess complexity based on message length and keywords
    const complexityIndicators = {
      simple: userMessage.length < 50,
      medium: userMessage.length < 200,
      complex: userMessage.length >= 200 || /comprehensive|detailed|thorough/i.test(userMessage)
    };

    if (complexityIndicators.simple) analysis.complexity = 'simple';
    else if (complexityIndicators.complex) analysis.complexity = 'complex';

    // Check for specific project references
    const projectMentions = userMessage.match(/second-reboot|fuzzy[- ]?os|brain|claude/gi);
    if (projectMentions) {
      analysis.domain = 'system';
      analysis.contextNeeds.active = true;
    }

    return analysis;
  }

  /**
   * Builds comprehensive context manifest based on intent analysis
   */
  async buildContextManifest(intentAnalysis) {
    const manifest = {
      tiers: {
        tier1: [], // Critical: 5-10%
        tier2: [], // Important: 10-15%  
        tier3: []  // Supplementary: 5-10%
      },
      protocols: [],
      projects: [],
      memories: [],
      summary: {},
      metadata: {
        intent: intentAnalysis.taskType,
        complexity: intentAnalysis.complexity,
        timestamp: new Date().toISOString()
      }
    };

    // Always include critical tier 1 items
    manifest.tiers.tier1.push(
      { type: 'document', path: 'Bag of Tricks', priority: 1.0, reason: 'Essential operations' },
      { type: 'memory', key: 'boot_loader_index', priority: 1.0, reason: 'System navigation' }
    );

    // Add intent-specific context
    if (intentAnalysis.contextNeeds.active) {
      // Get current project context
      const activeProject = await this.getActiveProjectContext();
      if (activeProject) {
        manifest.tiers.tier1.push({
          type: 'project',
          path: activeProject.path,
          priority: 0.9,
          reason: 'Active project context'
        });
      }
    }

    if (intentAnalysis.contextNeeds.protocols) {
      // Add relevant protocols to tier 2
      for (const protocol of intentAnalysis.protocols) {
        manifest.tiers.tier2.push({
          type: 'protocol',
          id: protocol,
          priority: 0.8,
          reason: `Required for ${intentAnalysis.taskType} tasks`
        });
      }
    }

    if (intentAnalysis.contextNeeds.tools) {
      // Add tool intelligence
      manifest.tiers.tier2.push({
        type: 'memory',
        key: 'tool_intelligence',
        priority: 0.7,
        reason: 'Tool usage optimization'
      });
    }

    if (intentAnalysis.contextNeeds.architecture) {
      // Add architecture documentation
      manifest.tiers.tier3.push({
        type: 'document',
        path: 'Master Architecture Index',
        priority: 0.6,
        reason: 'System architecture reference'
      });
    }

    // Calculate summary statistics
    manifest.summary = {
      tier1_items: manifest.tiers.tier1.length,
      tier2_items: manifest.tiers.tier2.length,
      tier3_items: manifest.tiers.tier3.length,
      total_items: manifest.tiers.tier1.length + manifest.tiers.tier2.length + manifest.tiers.tier3.length,
      protocols: intentAnalysis.protocols.length,
      estimated_complexity: intentAnalysis.complexity
    };

    return manifest;
  }

  /**
   * Creates optimized loading instructions with budget management
   */
  async prioritizeLoading(manifest) {
    const instructions = {
      loadOrder: [],
      budgetAllocation: {},
      alternatives: [],
      fallbacks: [],
      metadata: {
        totalEstimatedUsage: 0,
        budgetRemaining: this.contextBudget,
        optimizations: []
      }
    };

    let budgetUsed = 0;
    const maxBudget = this.contextBudget;

    // Process each tier with budget constraints
    for (const [tierName, items] of Object.entries(manifest.tiers)) {
      const tierBudget = this.getTierBudget(tierName);
      let tierUsed = 0;

      for (const item of items.sort((a, b) => b.priority - a.priority)) {
        const estimatedCost = this.estimateItemCost(item);
        
        if (budgetUsed + estimatedCost <= maxBudget && tierUsed + estimatedCost <= tierBudget) {
          instructions.loadOrder.push({
            ...item,
            tier: tierName,
            estimatedCost: estimatedCost,
            loadMethod: this.getOptimalLoadMethod(item)
          });
          
          budgetUsed += estimatedCost;
          tierUsed += estimatedCost;
        } else {
          // Add to alternatives if budget exceeded
          instructions.alternatives.push({
            ...item,
            reason: 'Budget exceeded',
            estimatedCost: estimatedCost
          });
        }
      }

      instructions.budgetAllocation[tierName] = tierUsed;
    }

    instructions.metadata.totalEstimatedUsage = budgetUsed;
    instructions.metadata.budgetRemaining = maxBudget - budgetUsed;

    // Add fallback options
    if (budgetUsed < 0.05) {
      instructions.fallbacks.push({
        type: 'minimal',
        items: ['Bag of Tricks'],
        reason: 'Emergency minimal context'
      });
    }

    return instructions;
  }

  /**
   * Helper methods
   */
  getTierBudget(tierName) {
    const budgets = {
      tier1: 0.10, // 10% max
      tier2: 0.15, // 15% max
      tier3: 0.10  // 10% max
    };
    return budgets[tierName] || 0.05;
  }

  estimateItemCost(item) {
    const baseCosts = {
      document: 0.02,
      protocol: 0.015,
      project: 0.03,
      memory: 0.01,
      tool: 0.005
    };
    return baseCosts[item.type] || 0.02;
  }

  getOptimalLoadMethod(item) {
    const methods = {
      document: 'brain:obsidian_note',
      protocol: 'protocols:protocol_read',
      project: 'filesystem-enhanced:read_text_file',
      memory: 'brain:brain_recall',
      tool: 'tools-registry:registry_info'
    };
    return methods[item.type] || 'brain:brain_recall';
  }

  async getActiveProjectContext() {
    try {
      // Try to get last project from brain memory
      const lastProject = await this.queryBrainMemory('last_project');
      if (lastProject) {
        return {
          path: lastProject.path || '/Users/bard/Code/second-reboot',
          name: lastProject.name || 'second-reboot',
          status: lastProject.status || 'active'
        };
      }
    } catch (error) {
      console.error('No active project context found, using default');
    }
    
    return {
      path: '/Users/bard/Code/second-reboot',
      name: 'second-reboot', 
      status: 'active'
    };
  }

  async queryBrainMemory(key) {
    // Placeholder for brain memory integration
    // In real implementation, this would call brain:brain_recall
    return null;
  }

  calculateEstimatedUsage(instructions) {
    return instructions.metadata.totalEstimatedUsage;
  }

  getEmergencyContext() {
    return {
      intent: { taskType: 'emergency', complexity: 'simple' },
      manifest: {
        tiers: {
          tier1: [{ type: 'document', path: 'Bag of Tricks', priority: 1.0 }],
          tier2: [],
          tier3: []
        }
      },
      instructions: {
        loadOrder: [{ type: 'document', path: 'Bag of Tricks', tier: 'tier1' }],
        metadata: { totalEstimatedUsage: 0.02 }
      },
      estimated_usage: 0.02
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContextDiscoveryService;
}

// Global availability for brain integration
if (typeof global !== 'undefined') {
  global.ContextDiscoveryService = ContextDiscoveryService;
}

export default ContextDiscoveryService;
