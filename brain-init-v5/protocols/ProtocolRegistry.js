/**
 * ProtocolRegistry - Centralized Protocol Metadata Management
 * 
 * Manages protocol metadata, trigger conditions, dependencies, and usage statistics.
 * Provides intelligent protocol discovery and recommendation based on context analysis.
 */

class ProtocolRegistry {
  constructor(options = {}) {
    this.config = {
      maxCacheSize: 200,
      metadataVersion: '1.0',
      autoDiscovery: true,
      validationEnabled: true
    };
    
    // Protocol storage
    this.protocols = new Map();
    this.protocolCategories = new Map();
    this.triggerIndex = new Map();
    this.dependencyGraph = new Map();
    
    // Usage and performance tracking
    this.usageStats = new Map();
    this.performanceMetrics = new Map();
    this.effectivenessScores = new Map();
    
    // Cache and optimization
    this.queryCache = new Map();
    this.lastUpdated = Date.now();
    
    console.error('📚 ProtocolRegistry initialized with metadata management');
    
    // Initialize with built-in protocols
    this.initializeBuiltInProtocols();
  }

  /**
   * Initialize registry with known built-in protocols
   */
  initializeBuiltInProtocols() {
    const builtInProtocols = [
      {
        id: 'error-recovery',
        name: 'Error Recovery Protocol',
        category: 'system',
        tier: 1,
        description: 'Systematic error detection, analysis, and recovery procedures',
        version: '2.1',
        triggers: [
          {
            type: 'error_condition',
            conditions: [
              'system_errors_detected',
              'operation_failures',
              'unexpected_results',
              'resource_unavailable'
            ],
            priority: 1.0,
            autoTrigger: true
          },
          {
            type: 'user_report',
            conditions: [
              'user_reports_error',
              'user_expresses_confusion',
              'unexpected_behavior_mentioned'
            ],
            priority: 0.8,
            autoTrigger: false
          }
        ],
        prerequisites: [],
        dependencies: [],
        conflictsWith: [],
        estimatedTime: '2-5 minutes',
        successRate: 0.92,
        effectiveness: 0.88,
        usageFrequency: 'high',
        lastUpdated: Date.now()
      },
      
      {
        id: 'user-communication',
        name: 'User Communication Protocol',
        category: 'interaction',
        tier: 1,
        description: 'Clear, effective communication strategies for user interaction',
        version: '1.8',
        triggers: [
          {
            type: 'communication_need',
            conditions: [
              'complex_explanation_needed',
              'user_confusion_detected',
              'clarification_required',
              'progress_update_due'
            ],
            priority: 0.9,
            autoTrigger: true
          },
          {
            type: 'proactive_communication',
            conditions: [
              'long_task_in_progress',
              'multiple_options_available',
              'user_preference_unclear'
            ],
            priority: 0.6,
            autoTrigger: false
          }
        ],
        prerequisites: [],
        dependencies: [],
        conflictsWith: [],
        estimatedTime: '1-3 minutes',
        successRate: 0.95,
        effectiveness: 0.91,
        usageFrequency: 'very_high',
        lastUpdated: Date.now()
      },
      
      {
        id: 'task-approach',
        name: 'Task Approach Protocol',
        category: 'methodology',
        tier: 2,
        description: 'Systematic approach to complex task planning and execution',
        version: '1.5',
        triggers: [
          {
            type: 'complexity_indicator',
            conditions: [
              'high_complexity_task',
              'multiple_subtasks_identified',
              'unclear_requirements',
              'resource_intensive_operation'
            ],
            priority: 0.8,
            autoTrigger: true
          },
          {
            type: 'planning_request',
            conditions: [
              'user_requests_planning',
              'strategic_thinking_needed',
              'step_by_step_approach_beneficial'
            ],
            priority: 0.7,
            autoTrigger: false
          }
        ],
        prerequisites: [],
        dependencies: [],
        conflictsWith: [],
        estimatedTime: '3-10 minutes',
        successRate: 0.87,
        effectiveness: 0.85,
        usageFrequency: 'medium',
        lastUpdated: Date.now()
      },
      
      {
        id: 'information-integration',
        name: 'Information Integration Protocol',
        category: 'analysis',
        tier: 2,
        description: 'Systematic integration and synthesis of multiple information sources',
        version: '1.3',
        triggers: [
          {
            type: 'multiple_sources',
            conditions: [
              'multiple_data_sources_available',
              'conflicting_information_detected',
              'synthesis_required',
              'comprehensive_analysis_needed'
            ],
            priority: 0.75,
            autoTrigger: true
          },
          {
            type: 'research_task',
            conditions: [
              'research_project_identified',
              'literature_review_needed',
              'cross_reference_analysis'
            ],
            priority: 0.6,
            autoTrigger: false
          }
        ],
        prerequisites: [],
        dependencies: [],
        conflictsWith: [],
        estimatedTime: '5-15 minutes',
        successRate: 0.82,
        effectiveness: 0.79,
        usageFrequency: 'medium',
        lastUpdated: Date.now()
      },
      
      {
        id: 'progress-communication',
        name: 'Progress Communication Protocol',
        category: 'interaction',
        tier: 3,
        description: 'Regular progress updates and milestone communication for long tasks',
        version: '1.2',
        triggers: [
          {
            type: 'long_running_task',
            conditions: [
              'task_duration_exceeds_threshold',
              'multiple_steps_remaining',
              'user_waiting_for_results',
              'milestone_reached'
            ],
            priority: 0.7,
            autoTrigger: true
          },
          {
            type: 'user_anxiety',
            conditions: [
              'user_expresses_impatience',
              'status_check_requested',
              'timeline_concerns_raised'
            ],
            priority: 0.8,
            autoTrigger: false
          }
        ],
        prerequisites: [],
        dependencies: ['user-communication'],
        conflictsWith: [],
        estimatedTime: '1-2 minutes',
        successRate: 0.89,
        effectiveness: 0.86,
        usageFrequency: 'low',
        lastUpdated: Date.now()
      }
    ];
    
    // Register built-in protocols
    for (const protocol of builtInProtocols) {
      this.registerProtocol(protocol);
    }
    
    console.error(`📚 Registered ${builtInProtocols.length} built-in protocols`);
  }

  /**
   * Register a new protocol in the registry
   * @param {Object} protocolData - Complete protocol metadata
   * @returns {boolean} Registration success
   */
  registerProtocol(protocolData) {
    try {
      // Validate protocol data
      if (!this.validateProtocolData(protocolData)) {
        throw new Error(`Invalid protocol data for ${protocolData.id}`);
      }
      
      // Create protocol entry
      const protocol = {
        ...protocolData,
        registeredAt: Date.now(),
        usageCount: 0,
        lastUsed: null,
        averageExecutionTime: null,
        cumulativeEffectiveness: 0
      };
      
      // Store protocol
      this.protocols.set(protocol.id, protocol);
      
      // Update category index
      if (!this.protocolCategories.has(protocol.category)) {
        this.protocolCategories.set(protocol.category, []);
      }
      this.protocolCategories.get(protocol.category).push(protocol.id);
      
      // Build trigger index
      this.buildTriggerIndex(protocol);
      
      // Build dependency graph
      this.updateDependencyGraph(protocol);
      
      // Initialize usage stats
      this.usageStats.set(protocol.id, {
        totalUsage: 0,
        successfulUsage: 0,
        averageExecutionTime: 0,
        lastUsed: null,
        contexts: new Map()
      });
      
      console.error(`📝 Registered protocol: ${protocol.id} (${protocol.category})`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to register protocol ${protocolData.id}:`, error);
      return false;
    }
  }

  /**
   * Get protocol metadata by ID
   * @param {string} protocolId - Protocol identifier
   * @returns {Object|null} Protocol metadata or null if not found
   */
  async getProtocolMetadata(protocolId) {
    const protocol = this.protocols.get(protocolId);
    
    if (!protocol) {
      console.warn(`⚠️  Protocol ${protocolId} not found in registry`);
      return null;
    }
    
    // Return enhanced metadata with current stats
    return {
      ...protocol,
      currentStats: this.usageStats.get(protocolId),
      performanceMetrics: this.performanceMetrics.get(protocolId),
      effectivenessScore: this.effectivenessScores.get(protocolId)
    };
  }

  /**
   * Get available protocols for a specific intent type
   * @param {string} intentType - Type of user intent
   * @returns {Array} Array of relevant protocol metadata
   */
  async getAvailableProtocols(intentType) {
    const cacheKey = `available_${intentType}`;
    
    // Check cache first
    if (this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
        return cached.data;
      }
    }
    
    const availableProtocols = [];
    
    for (const [protocolId, protocol] of this.protocols) {
      // Check if protocol is relevant for this intent type
      const relevanceScore = this.calculateProtocolRelevance(protocol, intentType);
      
      if (relevanceScore > 0.3) {
        availableProtocols.push({
          ...protocol,
          relevanceScore: relevanceScore,
          recommended: relevanceScore > 0.7
        });
      }
    }
    
    // Sort by relevance and tier
    availableProtocols.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier; // Lower tier = higher priority
      return b.relevanceScore - a.relevanceScore;
    });
    
    // Cache result
    this.queryCache.set(cacheKey, {
      data: availableProtocols,
      timestamp: Date.now()
    });
    
    return availableProtocols;
  }

  /**
   * Find protocols by trigger conditions
   * @param {Array} conditions - Array of trigger conditions
   * @returns {Array} Matching protocols with trigger confidence
   */
  async findProtocolsByTriggers(conditions) {
    const matchingProtocols = [];
    const conditionSet = new Set(conditions);
    
    for (const [protocolId, protocol] of this.protocols) {
      let bestMatch = { confidence: 0, trigger: null };
      
      for (const trigger of protocol.triggers) {
        const matchingConditions = trigger.conditions.filter(
          condition => conditionSet.has(condition)
        );
        
        if (matchingConditions.length > 0) {
          const confidence = (matchingConditions.length / trigger.conditions.length) * trigger.priority;
          
          if (confidence > bestMatch.confidence) {
            bestMatch = {
              confidence: confidence,
              trigger: trigger,
              matchingConditions: matchingConditions
            };
          }
        }
      }
      
      if (bestMatch.confidence > 0.3) {
        matchingProtocols.push({
          protocol: protocol,
          triggerMatch: bestMatch
        });
      }
    }
    
    return matchingProtocols.sort((a, b) => b.triggerMatch.confidence - a.triggerMatch.confidence);
  }

  /**
   * Get protocols by category
   * @param {string} category - Protocol category
   * @returns {Array} Protocols in the specified category
   */
  async getProtocolsByCategory(category) {
    const protocolIds = this.protocolCategories.get(category) || [];
    const protocols = [];
    
    for (const protocolId of protocolIds) {
      const protocol = await this.getProtocolMetadata(protocolId);
      if (protocol) {
        protocols.push(protocol);
      }
    }
    
    return protocols.sort((a, b) => a.tier - b.tier);
  }

  /**
   * Calculate protocol dependency chain
   * @param {string} protocolId - Starting protocol
   * @returns {Array} Ordered dependency chain
   */
  async getProtocolDependencies(protocolId) {
    const visited = new Set();
    const dependencies = [];
    
    const collectDependencies = (id) => {
      if (visited.has(id)) return; // Prevent circular dependencies
      visited.add(id);
      
      const protocol = this.protocols.get(id);
      if (!protocol) return;
      
      for (const depId of protocol.dependencies) {
        collectDependencies(depId);
        if (!dependencies.includes(depId)) {
          dependencies.push(depId);
        }
      }
    };
    
    collectDependencies(protocolId);
    
    // Add the main protocol at the end
    dependencies.push(protocolId);
    
    return dependencies;
  }

  /**
   * Record protocol usage for analytics
   * @param {string} protocolId - Protocol that was used
   * @param {Object} usageData - Usage statistics
   */
  recordProtocolUsage(protocolId, usageData) {
    const protocol = this.protocols.get(protocolId);
    if (!protocol) return;
    
    // Update protocol stats
    protocol.usageCount++;
    protocol.lastUsed = Date.now();
    
    if (usageData.executionTime) {
      protocol.averageExecutionTime = protocol.averageExecutionTime ?
        (protocol.averageExecutionTime + usageData.executionTime) / 2 :
        usageData.executionTime;
    }
    
    if (usageData.effectiveness !== undefined) {
      protocol.cumulativeEffectiveness = 
        (protocol.cumulativeEffectiveness + usageData.effectiveness) / 2;
    }
    
    // Update usage statistics
    const stats = this.usageStats.get(protocolId);
    stats.totalUsage++;
    
    if (usageData.success !== false) {
      stats.successfulUsage++;
    }
    
    if (usageData.executionTime) {
      stats.averageExecutionTime = stats.averageExecutionTime ?
        (stats.averageExecutionTime + usageData.executionTime) / 2 :
        usageData.executionTime;
    }
    
    stats.lastUsed = Date.now();
    
    // Record context usage
    if (usageData.context) {
      const contextKey = this.generateContextKey(usageData.context);
      const contextStats = stats.contexts.get(contextKey) || { count: 0, lastUsed: 0 };
      contextStats.count++;
      contextStats.lastUsed = Date.now();
      stats.contexts.set(contextKey, contextStats);
    }
    
    console.error(`📊 Recorded usage for protocol: ${protocolId}`);
  }

  /**
   * Get protocol usage analytics
   * @param {string} protocolId - Optional specific protocol
   * @returns {Object} Usage analytics data
   */
  getUsageAnalytics(protocolId = null) {
    if (protocolId) {
      const protocol = this.protocols.get(protocolId);
      const stats = this.usageStats.get(protocolId);
      
      if (!protocol || !stats) return null;
      
      return {
        protocolId: protocolId,
        metadata: protocol,
        usage: stats,
        performance: this.performanceMetrics.get(protocolId),
        effectiveness: this.effectivenessScores.get(protocolId),
        successRate: stats.totalUsage > 0 ? stats.successfulUsage / stats.totalUsage : 0
      };
    }
    
    // Return analytics for all protocols
    const analytics = {
      totalProtocols: this.protocols.size,
      categories: Array.from(this.protocolCategories.keys()),
      topUsedProtocols: [],
      overallStats: {
        totalUsage: 0,
        averageSuccessRate: 0,
        categoryCounts: {}
      }
    };
    
    // Calculate top used protocols
    const usageData = [];
    for (const [protocolId, stats] of this.usageStats) {
      usageData.push({
        protocolId: protocolId,
        usage: stats.totalUsage,
        successRate: stats.totalUsage > 0 ? stats.successfulUsage / stats.totalUsage : 0
      });
      analytics.overallStats.totalUsage += stats.totalUsage;
    }
    
    analytics.topUsedProtocols = usageData
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10);
    
    // Calculate average success rate
    const successRates = usageData.filter(d => d.usage > 0).map(d => d.successRate);
    analytics.overallStats.averageSuccessRate = successRates.length > 0 ?
      successRates.reduce((sum, rate) => sum + rate, 0) / successRates.length : 0;
    
    // Category counts
    for (const [category, protocolIds] of this.protocolCategories) {
      analytics.overallStats.categoryCounts[category] = protocolIds.length;
    }
    
    return analytics;
  }

  /**
   * Get protocol recommendations based on context
   * @param {Object} context - Current context data
   * @returns {Array} Recommended protocols with scores
   */
  async getProtocolRecommendations(context) {
    const recommendations = [];
    
    for (const [protocolId, protocol] of this.protocols) {
      const score = this.calculateRecommendationScore(protocol, context);
      
      if (score > 0.4) {
        recommendations.push({
          protocolId: protocolId,
          protocol: protocol,
          recommendationScore: score,
          reasons: this.generateRecommendationReasons(protocol, context, score)
        });
      }
    }
    
    return recommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);
  }

  /**
   * Helper methods
   */
  validateProtocolData(protocolData) {
    const required = ['id', 'name', 'category', 'tier', 'description', 'triggers'];
    
    for (const field of required) {
      if (!(field in protocolData)) {
        console.error(`Missing required field: ${field}`);
        return false;
      }
    }
    
    if (!Array.isArray(protocolData.triggers) || protocolData.triggers.length === 0) {
      console.error('Protocol must have at least one trigger');
      return false;
    }
    
    if (typeof protocolData.tier !== 'number' || protocolData.tier < 1 || protocolData.tier > 3) {
      console.error('Protocol tier must be 1, 2, or 3');
      return false;
    }
    
    return true;
  }

  buildTriggerIndex(protocol) {
    for (const trigger of protocol.triggers) {
      for (const condition of trigger.conditions) {
        if (!this.triggerIndex.has(condition)) {
          this.triggerIndex.set(condition, []);
        }
        this.triggerIndex.get(condition).push({
          protocolId: protocol.id,
          trigger: trigger,
          priority: trigger.priority
        });
      }
    }
  }

  updateDependencyGraph(protocol) {
    if (!this.dependencyGraph.has(protocol.id)) {
      this.dependencyGraph.set(protocol.id, {
        dependencies: protocol.dependencies || [],
        dependents: []
      });
    }
    
    // Update dependents for dependencies
    for (const depId of protocol.dependencies || []) {
      if (!this.dependencyGraph.has(depId)) {
        this.dependencyGraph.set(depId, { dependencies: [], dependents: [] });
      }
      this.dependencyGraph.get(depId).dependents.push(protocol.id);
    }
  }

  calculateProtocolRelevance(protocol, intentType) {
    // Basic relevance calculation - will be enhanced with ML
    let relevance = 0.5; // Base relevance
    
    // Intent-specific relevance mapping
    const intentRelevance = {
      'development': {
        'task-approach': 0.8,
        'error-recovery': 0.7,
        'progress-communication': 0.4
      },
      'debugging': {
        'error-recovery': 0.9,
        'information-integration': 0.6,
        'task-approach': 0.5
      },
      'research': {
        'information-integration': 0.8,
        'progress-communication': 0.6,
        'task-approach': 0.7
      },
      'communication': {
        'user-communication': 0.9,
        'progress-communication': 0.7
      }
    };
    
    if (intentRelevance[intentType] && intentRelevance[intentType][protocol.id]) {
      relevance = intentRelevance[intentType][protocol.id];
    }
    
    // Adjust for usage success rate
    const stats = this.usageStats.get(protocol.id);
    if (stats && stats.totalUsage > 0) {
      const successRate = stats.successfulUsage / stats.totalUsage;
      relevance *= (0.5 + successRate * 0.5); // Boost for successful protocols
    }
    
    // Adjust for effectiveness
    if (protocol.effectiveness) {
      relevance *= (0.7 + protocol.effectiveness * 0.3);
    }
    
    return Math.min(relevance, 1.0);
  }

  calculateRecommendationScore(protocol, context) {
    let score = 0;
    
    // Base score from protocol effectiveness
    score += (protocol.effectiveness || 0.5) * 0.3;
    
    // Usage-based score
    const stats = this.usageStats.get(protocol.id);
    if (stats && stats.totalUsage > 0) {
      const successRate = stats.successfulUsage / stats.totalUsage;
      score += successRate * 0.2;
      
      // Frequency bonus
      const usageFrequency = stats.totalUsage / Math.max(this.getTotalUsage(), 1);
      score += Math.min(usageFrequency * 2, 0.2);
    }
    
    // Context relevance
    const contextRelevance = this.calculateContextRelevance(protocol, context);
    score += contextRelevance * 0.3;
    
    return Math.min(score, 1.0);
  }

  calculateContextRelevance(protocol, context) {
    // Simplified context relevance - will be enhanced
    let relevance = 0.5;
    
    if (context.intent && context.intent.taskType) {
      relevance = this.calculateProtocolRelevance(protocol, context.intent.taskType);
    }
    
    return relevance;
  }

  generateRecommendationReasons(protocol, context, score) {
    const reasons = [];
    
    if (protocol.effectiveness > 0.8) {
      reasons.push(`High effectiveness score (${(protocol.effectiveness * 100).toFixed(0)}%)`);
    }
    
    const stats = this.usageStats.get(protocol.id);
    if (stats && stats.totalUsage > 5) {
      const successRate = stats.successfulUsage / stats.totalUsage;
      if (successRate > 0.8) {
        reasons.push(`High success rate in previous usage (${(successRate * 100).toFixed(0)}%)`);
      }
    }
    
    if (protocol.tier === 1) {
      reasons.push('High priority protocol for critical tasks');
    }
    
    if (score > 0.8) {
      reasons.push('Strong match for current context');
    }
    
    return reasons;
  }

  generateContextKey(context) {
    return JSON.stringify({
      taskType: context.intent?.taskType || 'unknown',
      complexity: context.complexity || 'medium',
      category: context.category || 'general'
    });
  }

  getTotalUsage() {
    let total = 0;
    for (const stats of this.usageStats.values()) {
      total += stats.totalUsage;
    }
    return total;
  }

  /**
   * Maintenance and optimization methods
   */
  cleanupCache() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    
    for (const [key, cached] of this.queryCache) {
      if (now - cached.timestamp > maxAge) {
        this.queryCache.delete(key);
      }
    }
    
    console.error(`🧹 Cleaned up ${this.queryCache.size} cached queries`);
  }

  exportRegistryData() {
    return {
      protocols: Array.from(this.protocols.entries()),
      categories: Array.from(this.protocolCategories.entries()),
      usageStats: Array.from(this.usageStats.entries()),
      config: this.config,
      lastUpdated: this.lastUpdated
    };
  }

  importRegistryData(data) {
    // Import protocols
    for (const [id, protocol] of data.protocols) {
      this.protocols.set(id, protocol);
    }
    
    // Import categories
    for (const [category, protocolIds] of data.categories) {
      this.protocolCategories.set(category, protocolIds);
    }
    
    // Import usage stats
    for (const [id, stats] of data.usageStats) {
      this.usageStats.set(id, stats);
    }
    
    // Rebuild indexes
    this.rebuildIndexes();
    
    console.error(`📥 Imported registry data: ${this.protocols.size} protocols`);
  }

  rebuildIndexes() {
    this.triggerIndex.clear();
    this.dependencyGraph.clear();
    
    for (const protocol of this.protocols.values()) {
      this.buildTriggerIndex(protocol);
      this.updateDependencyGraph(protocol);
    }
    
    console.error('🔄 Rebuilt protocol indexes');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProtocolRegistry;
}

// Global availability
if (typeof global !== 'undefined') {
  global.ProtocolRegistry = ProtocolRegistry;
}

export default ProtocolRegistry;