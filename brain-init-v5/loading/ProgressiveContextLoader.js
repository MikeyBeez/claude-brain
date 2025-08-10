/**
 * ProgressiveContextLoader - Adaptive Context Loading Engine
 * 
 * Executes intelligent context loading based on discovery manifests.
 * Implements tiered loading, budget management, and real-time optimization.
 */

class ProgressiveContextLoader {
  constructor(options = {}) {
    this.contextBudget = options.contextBudget || 0.30; // 30% default
    this.budgetManager = new BudgetManager(this.contextBudget);
    this.sessionContinuity = new SessionContinuity();
    
    // Loading state tracking
    this.loadedResources = new Map();
    this.loadingQueue = [];
    this.currentUsage = 0;
    this.loadingHistory = [];
    
    // Performance metrics
    this.metrics = {
      loadTimes: [],
      successRate: 0,
      budgetUtilization: 0,
      tierEfficiency: { tier1: 0, tier2: 0, tier3: 0 }
    };
    
    // Loading strategies
    this.loadingStrategies = this.initializeLoadingStrategies();
    
    console.error('🔄 ProgressiveContextLoader initialized with budget:', this.contextBudget);
  }

  /**
   * Main loading method - executes discovery manifest with progressive loading
   * @param {Object} discoveryResult - Result from ContextDiscoveryService
   * @param {Object} options - Loading options
   * @returns {Promise<Object>} Loading result with metrics
   */
  async executeLoading(discoveryResult, options = {}) {
    const loadingSession = {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      intent: discoveryResult.intent,
      manifest: discoveryResult.manifest,
      instructions: discoveryResult.instructions,
      options: options
    };

    console.error(`🎯 Starting loading session ${loadingSession.sessionId} for intent: ${discoveryResult.intent.taskType}`);

    try {
      // Step 1: Initialize budget and session
      await this.initializeSession(loadingSession);
      
      // Step 2: Load critical Tier 1 resources first
      const tier1Result = await this.loadTier('tier1', loadingSession);
      
      // Step 3: Load important Tier 2 resources if budget allows
      const tier2Result = await this.loadTier('tier2', loadingSession);
      
      // Step 4: Load supplementary Tier 3 resources if budget allows
      const tier3Result = await this.loadTier('tier3', loadingSession);
      
      // Step 5: Finalize session and generate report
      const finalResult = await this.finalizeSession(loadingSession, {
        tier1: tier1Result,
        tier2: tier2Result, 
        tier3: tier3Result
      });

      return finalResult;

    } catch (error) {
      console.error('❌ Loading session failed:', error);
      return this.handleLoadingFailure(loadingSession, error);
    }
  }

  /**
   * Initialize loading session with budget allocation
   */
  async initializeSession(session) {
    console.error('🏁 Initializing loading session...');
    
    // Reset budget manager for new session
    this.budgetManager.resetForSession(session.sessionId);
    
    // Check for existing session continuity
    const continuityData = await this.sessionContinuity.getSessionData(session.intent);
    if (continuityData) {
      console.error('🔗 Found session continuity data, applying optimizations');
      this.applySessionOptimizations(session, continuityData);
    }
    
    // Allocate budget per tier based on manifest
    this.allocateTierBudgets(session);
    
    // Initialize loading queue
    this.initializeLoadingQueue(session);
    
    session.initialized = true;
  }

  /**
   * Load resources for a specific tier
   */
  async loadTier(tierName, session) {
    const tierResources = session.manifest.tiers[tierName] || [];
    const tierBudget = this.budgetManager.getTierBudget(tierName);
    
    console.error(`📚 Loading ${tierName}: ${tierResources.length} resources, budget: ${tierBudget}`);
    
    const tierResult = {
      tier: tierName,
      attempted: 0,
      loaded: 0,
      failed: 0,
      budgetUsed: 0,
      resources: [],
      startTime: Date.now()
    };

    // Sort resources by priority
    const sortedResources = tierResources.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    for (const resource of sortedResources) {
      if (!this.budgetManager.canAfford(resource.estimatedCost, tierName)) {
        console.error(`💸 Skipping ${resource.id}: insufficient budget`);
        continue;
      }

      tierResult.attempted++;
      
      try {
        const loadResult = await this.loadResource(resource, session);
        
        if (loadResult.success) {
          tierResult.loaded++;
          tierResult.budgetUsed += loadResult.actualCost;
          tierResult.resources.push({
            ...resource,
            loadResult: loadResult,
            loadTime: loadResult.loadTime
          });
          
          this.budgetManager.recordUsage(loadResult.actualCost, tierName);
          this.trackResourceLoad(resource, loadResult);
          
        } else {
          tierResult.failed++;
          console.error(`❌ Failed to load ${resource.id}:`, loadResult.error);
        }

      } catch (error) {
        tierResult.failed++;
        console.error(`💥 Error loading ${resource.id}:`, error);
      }
    }

    tierResult.endTime = Date.now();
    tierResult.totalTime = tierResult.endTime - tierResult.startTime;
    
    console.error(`✅ ${tierName} complete: ${tierResult.loaded}/${tierResult.attempted} loaded (${tierResult.budgetUsed.toFixed(3)} budget used)`);
    
    return tierResult;
  }

  /**
   * Load individual resource using appropriate method
   */
  async loadResource(resource, session) {
    const startTime = Date.now();
    
    try {
      console.error(`🔄 Loading ${resource.type}:${resource.id}...`);
      
      // Check if already loaded
      if (this.loadedResources.has(resource.id)) {
        console.error(`♻️  Resource ${resource.id} already loaded, reusing`);
        return {
          success: true,
          actualCost: 0, // No additional cost for reuse
          loadTime: 0,
          cached: true,
          data: this.loadedResources.get(resource.id)
        };
      }

      // Select loading strategy
      const strategy = this.getLoadingStrategy(resource);
      const loadResult = await strategy.load(resource, session);
      
      if (loadResult.success) {
        // Cache the loaded resource
        this.loadedResources.set(resource.id, loadResult.data);
        
        return {
          success: true,
          actualCost: loadResult.estimatedCost || resource.estimatedCost || 0.02,
          loadTime: Date.now() - startTime,
          cached: false,
          data: loadResult.data,
          method: resource.loadMethod
        };
      } else {
        return {
          success: false,
          error: loadResult.error,
          loadTime: Date.now() - startTime
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        loadTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get appropriate loading strategy for resource type
   */
  getLoadingStrategy(resource) {
    const strategies = this.loadingStrategies;
    
    switch (resource.type) {
      case 'document':
        return strategies.document;
      case 'protocol': 
        return strategies.protocol;
      case 'memory':
        return strategies.memory;
      case 'project':
        return strategies.project;
      case 'tool':
        return strategies.tool;
      default:
        return strategies.default;
    }
  }

  /**
   * Initialize loading strategies for different resource types
   */
  initializeLoadingStrategies() {
    return {
      document: {
        async load(resource, session) {
          // Mock implementation - in real system would call brain:obsidian_note
          console.error(`📖 Loading document: ${resource.path}`);
          return {
            success: true,
            data: { type: 'document', path: resource.path, content: 'Document content...' },
            estimatedCost: 0.025
          };
        }
      },
      
      protocol: {
        async load(resource, session) {
          // Mock implementation - in real system would call protocols:protocol_read
          console.error(`⚙️  Loading protocol: ${resource.name}`);
          return {
            success: true,
            data: { type: 'protocol', name: resource.name, steps: ['Step 1', 'Step 2'] },
            estimatedCost: 0.015
          };
        }
      },
      
      memory: {
        async load(resource, session) {
          // Mock implementation - in real system would call brain:brain_recall
          console.error(`🧠 Loading memory: ${resource.key}`);
          return {
            success: true,
            data: { type: 'memory', key: resource.key, data: 'Memory data...' },
            estimatedCost: 0.01
          };
        }
      },
      
      project: {
        async load(resource, session) {
          // Mock implementation - in real system would call project-finder:project_info
          console.error(`📁 Loading project: ${resource.name}`);
          return {
            success: true,
            data: { type: 'project', name: resource.name, status: 'active' },
            estimatedCost: 0.03
          };
        }
      },
      
      tool: {
        async load(resource, session) {
          // Mock implementation - in real system would call tools-registry:registry_info
          console.error(`🔧 Loading tool info: ${resource.name}`);
          return {
            success: true,
            data: { type: 'tool', name: resource.name, functions: [] },
            estimatedCost: 0.005
          };
        }
      },
      
      default: {
        async load(resource, session) {
          console.error(`❓ Loading unknown resource type: ${resource.type}`);
          return {
            success: false,
            error: `Unknown resource type: ${resource.type}`
          };
        }
      }
    };
  }

  /**
   * Finalize loading session and generate comprehensive report
   */
  async finalizeSession(session, tierResults) {
    const endTime = Date.now();
    const totalTime = endTime - session.startTime;
    
    // Calculate final metrics
    const finalMetrics = this.calculateSessionMetrics(session, tierResults, totalTime);
    
    // Update session continuity
    await this.sessionContinuity.updateSessionData(session, finalMetrics);
    
    // Store loading history
    this.loadingHistory.push({
      sessionId: session.sessionId,
      intent: session.intent.taskType,
      metrics: finalMetrics,
      timestamp: new Date().toISOString()
    });

    const finalResult = {
      sessionId: session.sessionId,
      success: true,
      metrics: finalMetrics,
      tierResults: tierResults,
      loadedResources: Array.from(this.loadedResources.keys()),
      totalLoadTime: totalTime,
      budgetUtilization: this.budgetManager.getUtilization(),
      optimizations: this.getOptimizationSuggestions(finalMetrics),
      timestamp: new Date().toISOString()
    };

    console.error(`🎉 Loading session ${session.sessionId} completed successfully!`);
    console.error(`📊 Final metrics: ${finalMetrics.totalResourcesLoaded} resources, ${finalMetrics.budgetUsed.toFixed(3)} budget used`);
    
    return finalResult;
  }

  /**
   * Handle loading failures with graceful degradation
   */
  async handleLoadingFailure(session, error) {
    console.error('🚨 Loading session failed, implementing emergency fallback');
    
    // Attempt emergency fallback loading
    try {
      const emergencyResult = await this.executeEmergencyFallback(session);
      return {
        sessionId: session.sessionId,
        success: false,
        error: error.message,
        fallback: emergencyResult,
        timestamp: new Date().toISOString()
      };
    } catch (fallbackError) {
      console.error('💥 Emergency fallback also failed:', fallbackError);
      return {
        sessionId: session.sessionId,
        success: false,
        error: error.message,
        fallbackError: fallbackError.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Emergency fallback - load minimal critical context
   */
  async executeEmergencyFallback(session) {
    console.error('🆘 Executing emergency fallback loading...');
    
    const emergencyResources = [
      {
        type: 'document',
        id: 'bag_of_tricks',
        path: 'Bag of Tricks',
        priority: 1.0,
        estimatedCost: 0.025
      }
    ];
    
    const fallbackResult = {
      loaded: 0,
      budgetUsed: 0,
      resources: []
    };
    
    for (const resource of emergencyResources) {
      try {
        const loadResult = await this.loadResource(resource, session);
        if (loadResult.success) {
          fallbackResult.loaded++;
          fallbackResult.budgetUsed += loadResult.actualCost;
          fallbackResult.resources.push(resource);
        }
      } catch (error) {
        console.error('Emergency resource load failed:', error);
      }
    }
    
    return fallbackResult;
  }

  /**
   * Helper methods
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  allocateTierBudgets(session) {
    const tierBudgets = {
      tier1: 0.10, // 10% for critical
      tier2: 0.15, // 15% for important  
      tier3: 0.10  // 10% for supplementary
    };
    
    this.budgetManager.setTierBudgets(tierBudgets);
  }

  initializeLoadingQueue(session) {
    this.loadingQueue = [];
    
    // Add all resources to queue with priorities
    for (const [tierName, resources] of Object.entries(session.manifest.tiers)) {
      for (const resource of resources) {
        this.loadingQueue.push({
          ...resource,
          tier: tierName,
          queuePriority: this.calculateQueuePriority(resource, tierName)
        });
      }
    }
    
    // Sort queue by priority
    this.loadingQueue.sort((a, b) => b.queuePriority - a.queuePriority);
  }

  calculateQueuePriority(resource, tierName) {
    const tierWeights = { tier1: 100, tier2: 50, tier3: 25 };
    return (tierWeights[tierName] || 0) + (resource.priority || 0) * 10;
  }

  trackResourceLoad(resource, loadResult) {
    // Track metrics for optimization
    this.metrics.loadTimes.push(loadResult.loadTime);
    
    if (loadResult.success) {
      this.metrics.successRate = this.calculateSuccessRate();
    }
  }

  calculateSuccessRate() {
    const totalAttempts = this.loadingHistory.reduce((sum, session) => 
      sum + (session.metrics?.totalResourcesAttempted || 0), 0);
    const totalSuccess = this.loadingHistory.reduce((sum, session) => 
      sum + (session.metrics?.totalResourcesLoaded || 0), 0);
    
    return totalAttempts > 0 ? totalSuccess / totalAttempts : 0;
  }

  calculateSessionMetrics(session, tierResults, totalTime) {
    const totalAttempted = Object.values(tierResults).reduce((sum, tier) => sum + (tier?.attempted || 0), 0);
    const totalLoaded = Object.values(tierResults).reduce((sum, tier) => sum + (tier?.loaded || 0), 0);
    const totalFailed = Object.values(tierResults).reduce((sum, tier) => sum + (tier?.failed || 0), 0);
    const budgetUsed = Object.values(tierResults).reduce((sum, tier) => sum + (tier?.budgetUsed || 0), 0);
    
    return {
      totalResourcesAttempted: totalAttempted,
      totalResourcesLoaded: totalLoaded,
      totalResourcesFailed: totalFailed,
      successRate: totalAttempted > 0 ? totalLoaded / totalAttempted : 0,
      budgetUsed: budgetUsed,
      budgetUtilization: budgetUsed / this.contextBudget,
      totalLoadTime: totalTime,
      averageLoadTime: this.metrics.loadTimes.length > 0 ? 
        this.metrics.loadTimes.reduce((a, b) => a + b, 0) / this.metrics.loadTimes.length : 0,
      tierBreakdown: {
        tier1: tierResults.tier1 || {},
        tier2: tierResults.tier2 || {},
        tier3: tierResults.tier3 || {}
      }
    };
  }

  getOptimizationSuggestions(metrics) {
    const suggestions = [];
    
    if (metrics.budgetUtilization < 0.5) {
      suggestions.push('Budget underutilized - consider loading more tier 3 resources');
    }
    
    if (metrics.successRate < 0.9) {
      suggestions.push('Low success rate - review resource availability');
    }
    
    if (metrics.averageLoadTime > 1000) {
      suggestions.push('High load times - consider caching or optimization');
    }
    
    return suggestions;
  }

  applySessionOptimizations(session, continuityData) {
    // Apply optimizations based on historical data
    if (continuityData.frequentResources) {
      console.error('⚡ Applying session optimizations based on usage patterns');
      // Boost priority of frequently used resources
      // This would be implemented based on the continuity data structure
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressiveContextLoader;
}

// Global availability
if (typeof global !== 'undefined') {
  global.ProgressiveContextLoader = ProgressiveContextLoader;
}

export default ProgressiveContextLoader;
