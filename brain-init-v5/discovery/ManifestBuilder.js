/**
 * ManifestBuilder - Context Manifest Construction System
 * 
 * Builds optimized context manifests based on intent analysis.
 * Organizes context into tiers and manages resource allocation.
 */

class ManifestBuilder {
  constructor() {
    this.resourceCatalog = this.buildResourceCatalog();
    this.tierConfiguration = this.buildTierConfiguration();
    this.dependencyGraph = this.buildDependencyGraph();
  }

  /**
   * Build comprehensive context manifest
   * @param {Object} intentAnalysis - Results from IntentAnalyzer
   * @param {Object} options - Build options and constraints
   * @returns {Object} Structured context manifest
   */
  async buildManifest(intentAnalysis, options = {}) {
    const manifest = {
      tiers: {
        tier1: [], // Critical: 5-10%
        tier2: [], // Important: 10-15%  
        tier3: []  // Supplementary: 5-10%
      },
      protocols: [],
      projects: [],
      memories: [],
      dependencies: {},
      summary: {},
      metadata: {
        intent: intentAnalysis.taskType,
        complexity: intentAnalysis.complexity,
        domain: intentAnalysis.domain,
        timestamp: new Date().toISOString(),
        builder_version: '1.0.0'
      }
    };

    try {
      // Step 1: Add critical tier 1 resources (always loaded)
      await this.addCriticalResources(manifest, intentAnalysis);

      // Step 2: Add intent-specific tier 2 resources
      await this.addIntentSpecificResources(manifest, intentAnalysis);

      // Step 3: Add supplementary tier 3 resources
      await this.addSupplementaryResources(manifest, intentAnalysis);

      // Step 4: Resolve dependencies
      await this.resolveDependencies(manifest);

      // Step 5: Generate summary statistics
      manifest.summary = this.generateSummary(manifest);

      return manifest;

    } catch (error) {
      console.error('Manifest building failed:', error);
      return this.getMinimalManifest(intentAnalysis);
    }
  }

  /**
   * Add critical tier 1 resources (always required)
   */
  async addCriticalResources(manifest, intentAnalysis) {
    // Essential system documents
    const criticalResources = [
      {
        type: 'document',
        id: 'bag_of_tricks',
        path: 'Bag of Tricks',
        priority: 1.0,
        reason: 'Essential operations and shortcuts',
        estimatedCost: 0.025,
        loadMethod: 'brain:obsidian_note'
      },
      {
        type: 'memory', 
        id: 'boot_loader_index',
        key: 'boot_loader_index',
        priority: 1.0,
        reason: 'System navigation and hierarchy',
        estimatedCost: 0.015,
        loadMethod: 'brain:brain_recall'
      }
    ];

    // Add active project context if relevant
    if (intentAnalysis.contextNeeds.active) {
      const activeProject = await this.getActiveProjectContext();
      if (activeProject) {
        criticalResources.push({
          type: 'project',
          id: 'active_project',
          path: activeProject.path,
          name: activeProject.name,
          priority: 0.95,
          reason: 'Current active project context',
          estimatedCost: 0.03,
          loadMethod: 'project-finder:project_info'
        });
      }
    }

    // Add system-critical protocols for system operations
    if (intentAnalysis.domain === 'system') {
      criticalResources.push({
        type: 'protocol',
        id: 'task_approach',
        name: 'task-approach',
        priority: 0.9,
        reason: 'System operation methodology',
        estimatedCost: 0.02,
        loadMethod: 'protocols:protocol_read'
      });
    }

    manifest.tiers.tier1.push(...criticalResources);
  }

  /**
   * Add intent-specific tier 2 resources
   */
  async addIntentSpecificResources(manifest, intentAnalysis) {
    const tier2Resources = [];

    // Protocol-based resources
    if (intentAnalysis.protocols && intentAnalysis.protocols.length > 0) {
      for (const protocolId of intentAnalysis.protocols) {
        if (!this.isProtocolInTier1(manifest, protocolId)) {
          tier2Resources.push({
            type: 'protocol',
            id: protocolId,
            name: protocolId,
            priority: 0.8,
            reason: `Required for ${intentAnalysis.taskType} tasks`,
            estimatedCost: 0.015,
            loadMethod: 'protocols:protocol_read'
          });
        }
      }
    }

    // Tool intelligence for development tasks
    if (intentAnalysis.contextNeeds.tools) {
      tier2Resources.push({
        type: 'memory',
        id: 'tool_intelligence',
        key: 'tool_intelligence',
        priority: 0.75,
        reason: 'Tool usage optimization and intelligence',
        estimatedCost: 0.02,
        loadMethod: 'brain:brain_recall'
      });
    }

    // Recent work context for complex tasks
    if (intentAnalysis.complexity === 'complex') {
      tier2Resources.push({
        type: 'memory',
        id: 'recent_work',
        key: 'recent_work_context',
        priority: 0.7,
        reason: 'Recent work patterns and context',
        estimatedCost: 0.025,
        loadMethod: 'brain:brain_recall'
      });
    }

    // Development-specific resources
    if (intentAnalysis.taskType === 'development') {
      tier2Resources.push(
        {
          type: 'document',
          id: 'development_patterns',
          path: 'Development Best Practices',
          priority: 0.65,
          reason: 'Development methodology and patterns',
          estimatedCost: 0.02,
          loadMethod: 'brain:obsidian_note'
        },
        {
          type: 'memory',
          id: 'error_patterns',
          key: 'common_error_patterns',
          priority: 0.6,
          reason: 'Error resolution knowledge',
          estimatedCost: 0.015,
          loadMethod: 'brain:brain_recall'
        }
      );
    }

    // Research-specific resources
    if (intentAnalysis.taskType === 'research') {
      tier2Resources.push({
        type: 'document',
        id: 'research_methodology',
        path: 'Research Methodology',
        priority: 0.65,
        reason: 'Research approaches and techniques',
        estimatedCost: 0.02,
        loadMethod: 'brain:obsidian_note'
      });
    }

    manifest.tiers.tier2.push(...tier2Resources);
  }

  /**
   * Add supplementary tier 3 resources
   */
  async addSupplementaryResources(manifest, intentAnalysis) {
    const tier3Resources = [];

    // Architecture documentation
    if (intentAnalysis.contextNeeds.architecture) {
      tier3Resources.push({
        type: 'document',
        id: 'master_architecture_index',
        path: 'Master Architecture Index',
        priority: 0.6,
        reason: 'System architecture reference',
        estimatedCost: 0.025,
        loadMethod: 'mcp-architecture:arch_get_document'
      });
    }

    // Historical context for research tasks
    if (intentAnalysis.contextNeeds.historical) {
      tier3Resources.push({
        type: 'memory',
        id: 'historical_context',
        key: 'project_history',
        priority: 0.55,
        reason: 'Historical project context and lessons',
        estimatedCost: 0.02,
        loadMethod: 'brain:brain_recall'
      });
    }

    // User preferences and customizations
    tier3Resources.push({
      type: 'memory',
      id: 'user_preferences',
      key: 'user_preferences',
      priority: 0.5,
      reason: 'User preferences and customizations',
      estimatedCost: 0.01,
      loadMethod: 'brain:state_get'
    });

    // Protocol usage patterns
    if (intentAnalysis.protocols.length > 1) {
      tier3Resources.push({
        type: 'memory',
        id: 'protocol_patterns',
        key: 'protocol_usage_patterns',
        priority: 0.45,
        reason: 'Protocol usage optimization',
        estimatedCost: 0.015,
        loadMethod: 'protocol-tracker:protocol_get_session_report'
      });
    }

    manifest.tiers.tier3.push(...tier3Resources);
  }

  /**
   * Resolve dependencies between resources
   */
  async resolveDependencies(manifest) {
    const dependencies = {};

    // Check each resource for dependencies
    for (const [tierName, resources] of Object.entries(manifest.tiers)) {
      for (const resource of resources) {
        const deps = this.getDependencies(resource);
        if (deps.length > 0) {
          dependencies[resource.id] = deps;
          
          // Add missing dependencies to appropriate tier
          for (const dep of deps) {
            if (!this.isResourceInManifest(manifest, dep.id)) {
              this.addDependencyToTier(manifest, dep, tierName);
            }
          }
        }
      }
    }

    manifest.dependencies = dependencies;
  }

  /**
   * Generate summary statistics for the manifest
   */
  generateSummary(manifest) {
    const summary = {
      tier1_items: manifest.tiers.tier1.length,
      tier2_items: manifest.tiers.tier2.length,
      tier3_items: manifest.tiers.tier3.length,
      total_items: 0,
      estimated_total_cost: 0,
      resource_types: {},
      protocols: manifest.tiers.tier1.concat(manifest.tiers.tier2, manifest.tiers.tier3)
                    .filter(r => r.type === 'protocol').length,
      dependencies: Object.keys(manifest.dependencies).length
    };

    // Calculate totals and type distribution
    for (const [tierName, resources] of Object.entries(manifest.tiers)) {
      summary.total_items += resources.length;
      
      for (const resource of resources) {
        summary.estimated_total_cost += resource.estimatedCost || 0;
        summary.resource_types[resource.type] = (summary.resource_types[resource.type] || 0) + 1;
      }
    }

    return summary;
  }

  /**
   * Helper methods
   */
  buildResourceCatalog() {
    return {
      documents: {
        'bag_of_tricks': { path: 'Bag of Tricks', cost: 0.025 },
        'master_architecture_index': { path: 'Master Architecture Index', cost: 0.025 },
        'development_patterns': { path: 'Development Best Practices', cost: 0.02 },
        'research_methodology': { path: 'Research Methodology', cost: 0.02 }
      },
      protocols: {
        'task-approach': { cost: 0.015 },
        'error-recovery': { cost: 0.015 },
        'user-communication': { cost: 0.01 },
        'information-integration': { cost: 0.015 },
        'progress-communication': { cost: 0.01 }
      },
      memories: {
        'boot_loader_index': { cost: 0.015 },
        'tool_intelligence': { cost: 0.02 },
        'recent_work': { cost: 0.025 },
        'user_preferences': { cost: 0.01 }
      }
    };
  }

  buildTierConfiguration() {
    return {
      tier1: { maxCost: 0.10, priority: 'critical' },
      tier2: { maxCost: 0.15, priority: 'important' },
      tier3: { maxCost: 0.10, priority: 'supplementary' }
    };
  }

  buildDependencyGraph() {
    return {
      'development_patterns': ['error_patterns'],
      'master_architecture_index': ['protocol_patterns'],
      'task-approach': ['user_preferences']
    };
  }

  async getActiveProjectContext() {
    // In real implementation, this would query brain memory
    return {
      path: '/Users/bard/Code/second-reboot',
      name: 'second-reboot',
      status: 'active'
    };
  }

  isProtocolInTier1(manifest, protocolId) {
    return manifest.tiers.tier1.some(resource => 
      resource.type === 'protocol' && resource.id === protocolId
    );
  }

  getDependencies(resource) {
    const deps = this.dependencyGraph[resource.id] || [];
    return deps.map(depId => ({
      id: depId,
      type: 'memory',
      priority: 0.3,
      reason: `Dependency of ${resource.id}`
    }));
  }

  isResourceInManifest(manifest, resourceId) {
    for (const resources of Object.values(manifest.tiers)) {
      if (resources.some(r => r.id === resourceId)) {
        return true;
      }
    }
    return false;
  }

  addDependencyToTier(manifest, dependency, sourceTier) {
    // Add dependency to tier 3 by default
    manifest.tiers.tier3.push({
      ...dependency,
      estimatedCost: 0.01,
      loadMethod: 'brain:brain_recall'
    });
  }

  getMinimalManifest(intentAnalysis) {
    return {
      tiers: {
        tier1: [{
          type: 'document',
          id: 'bag_of_tricks',
          path: 'Bag of Tricks',
          priority: 1.0,
          reason: 'Emergency minimal context',
          estimatedCost: 0.025
        }],
        tier2: [],
        tier3: []
      },
      protocols: [],
      projects: [],
      memories: [],
      dependencies: {},
      summary: {
        tier1_items: 1,
        tier2_items: 0,
        tier3_items: 0,
        total_items: 1,
        estimated_total_cost: 0.025
      },
      metadata: {
        intent: intentAnalysis.taskType,
        fallback: true,
        timestamp: new Date().toISOString()
      }
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ManifestBuilder;
}

// Global availability
if (typeof global !== 'undefined') {
  global.ManifestBuilder = ManifestBuilder;
}

export default ManifestBuilder;
