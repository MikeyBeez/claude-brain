/**
 * Brain Initiative v5.0 - Unified Intelligent Context Loading System
 * 
 * This is the culmination of the Second Reboot project: a unified initialization
 * system that integrates adaptive context discovery, progressive loading, and
 * intelligent protocol detection into a seamless, backward-compatible enhancement
 * to the existing Brain ecosystem.
 * 
 * Key Innovation: Transform from static "load everything" to intelligent 
 * "discover, adapt, optimize" based on actual user intent and context.
 * 
 * @author Second Reboot Project Team
 * @version 5.0.0
 * @since 2025-08-09
 */

// Import core subsystems
import ContextDiscoveryService from './discovery/ContextDiscoveryService.js';
import ProgressiveContextLoader from './loading/ProgressiveContextLoader.js';
import ProtocolDetector from './protocols/ProtocolDetector.js';
import ProtocolRegistry from './protocols/ProtocolRegistry.js';
import TriggerSystem from './protocols/TriggerSystem.js';
import BudgetManager from './loading/BudgetManager.js';
import SessionContinuity from './loading/SessionContinuity.js';

/**
 * BrainInitV5 - Unified Intelligent Context Loading System
 * 
 * Provides a single entry point for all Brain initialization with:
 * - Intelligent context discovery based on user intent
 * - Adaptive loading with budget management
 * - Automatic protocol detection and activation
 * - Cross-session learning and optimization
 * - Backward compatibility with existing brain_init
 */
class BrainInitV5 {
  constructor(options = {}) {
    // Configuration with intelligent defaults
    this.config = {
      // Context management
      contextBudget: options.contextBudget || 0.30, // 30% adaptive vs 35% fixed
      maxContextWindow: options.maxContextWindow || 200000,
      emergencyFallbackEnabled: options.emergencyFallbackEnabled !== false,
      
      // Performance tuning
      initializationTimeout: options.initializationTimeout || 15000, // 15s max
      protocolDetectionTimeout: options.protocolDetectionTimeout || 2000, // 2s
      loadingConcurrency: options.loadingConcurrency || 3,
      
      // Learning and optimization
      learningEnabled: options.learningEnabled !== false,
      sessionContinuityEnabled: options.sessionContinuityEnabled !== false,
      performanceMonitoringEnabled: options.performanceMonitoringEnabled !== false,
      
      // Backward compatibility
      fallbackToLegacyInit: options.fallbackToLegacyInit !== false,
      legacyCompatibilityMode: options.legacyCompatibilityMode || false,
      
      // Development and debugging
      verboseLogging: options.verboseLogging || false,
      metricsCollectionEnabled: options.metricsCollectionEnabled !== false
    };
    
    // Initialize core subsystems
    this.discoveryService = new ContextDiscoveryService();
    this.contextLoader = new ProgressiveContextLoader({
      contextBudget: this.config.contextBudget,
      maxConcurrency: this.config.loadingConcurrency
    });
    
    // Initialize protocol system
    this.protocolRegistry = new ProtocolRegistry();
    this.triggerSystem = new TriggerSystem();
    this.protocolDetector = new ProtocolDetector({
      protocolRegistry: this.protocolRegistry,
      triggerSystem: this.triggerSystem
    });
    
    // Performance and session management
    this.budgetManager = new BudgetManager(this.config.contextBudget);
    this.sessionContinuity = new SessionContinuity();
    
    // System state
    this.initialized = false;
    this.currentSession = null;
    this.initializationMetrics = {
      startTime: null,
      endTime: null,
      duration: null,
      contextUsage: 0,
      protocolsActivated: [],
      resourcesLoaded: [],
      errorCount: 0,
      successRate: 0
    };
    
    // Backward compatibility layer
    this.legacyInitResult = null;
    
    if (this.config.verboseLogging) {
      console.error('🧠 BrainInitV5: Intelligent Context System Initialized');
      console.error(`   Context Budget: ${(this.config.contextBudget * 100).toFixed(1)}%`);
      console.error(`   Learning: ${this.config.learningEnabled ? '✅' : '❌'}`);
      console.error(`   Session Continuity: ${this.config.sessionContinuityEnabled ? '✅' : '❌'}`);
    }
  }

  /**
   * Main initialization method - The unified entry point
   * 
   * @param {string} userMessage - Initial user message to analyze intent
   * @param {Object} options - Override configuration options
   * @returns {Promise<Object>} Comprehensive initialization result
   */
  async initialize(userMessage = '', options = {}) {
    const startTime = Date.now();
    this.initializationMetrics.startTime = startTime;
    
    try {
      if (this.config.verboseLogging) {
        console.error('🧠 BrainInitV5: Starting intelligent initialization...');
        console.error(`   User Message: "${userMessage.slice(0, 100)}${userMessage.length > 100 ? '...' : ''}"`);
      }
      
      // Phase 1: Intent Analysis & Context Discovery
      const discoveryResult = await this.discoverContext(userMessage, options);
      
      // Phase 2: Protocol Detection & Activation
      const protocolResult = await this.detectAndActivateProtocols(discoveryResult, options);
      
      // Phase 3: Progressive Context Loading
      const loadingResult = await this.executeProgressiveLoading(discoveryResult, protocolResult, options);
      
      // Phase 4: Session Finalization & Learning
      const sessionResult = await this.finalizeSession(loadingResult, protocolResult, options);
      
      // Generate comprehensive result
      const result = this.generateInitializationResult(discoveryResult, protocolResult, loadingResult, sessionResult);
      
      // Update metrics and state
      this.updateInitializationMetrics(result, startTime);
      this.initialized = true;
      this.currentSession = result.session;
      
      if (this.config.verboseLogging) {
        console.error(`🧠 BrainInitV5: Initialization complete in ${result.metrics.duration}ms`);
        console.error(`   Context Usage: ${(result.metrics.contextUsage * 100).toFixed(1)}%`);
        console.error(`   Protocols Activated: ${result.protocols.length}`);
        console.error(`   Resources Loaded: ${result.resources.length}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('🚨 BrainInitV5: Initialization failed:', error);
      
      // Emergency fallback handling
      if (this.config.emergencyFallbackEnabled) {
        return await this.executeEmergencyFallback(userMessage, error, options);
      }
      
      throw error;
    }
  }

  /**
   * Phase 1: Intelligent Context Discovery
   * Analyzes user intent and builds optimized context manifest
   */
  async discoverContext(userMessage, options = {}) {
    try {
      const discoveryOptions = {
        ...options,
        contextBudget: this.config.contextBudget,
        timeout: this.config.initializationTimeout * 0.3 // 30% of total timeout
      };
      
      const result = await this.discoveryService.discoverContext(userMessage, discoveryOptions);
      
      if (this.config.verboseLogging) {
        console.error('📋 Context Discovery Complete:');
        console.error(`   Intent: ${result.intent.taskType} (${result.intent.complexity})`);
        console.error(`   Estimated Usage: ${(result.estimated_usage * 100).toFixed(1)}%`);
        console.error(`   Resources Identified: ${this.countManifestResources(result.manifest)}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('🚨 Context Discovery failed:', error);
      
      // Return emergency discovery result
      return this.discoveryService.getEmergencyContext();
    }
  }

  /**
   * Phase 2: Protocol Detection & Activation
   * Automatically detects and prepares required protocols
   */
  async detectAndActivateProtocols(discoveryResult, options = {}) {
    try {
      const protocolContext = {
        intent: discoveryResult.intent,
        manifest: discoveryResult.manifest,
        userMessage: options.userMessage || '',
        projectContext: discoveryResult.context?.project,
        timestamp: Date.now()
      };
      
      const protocolOptions = {
        ...options,
        timeout: this.config.protocolDetectionTimeout,
        maxProtocols: 8,
        confidenceThreshold: 0.7
      };
      
      const protocols = await this.protocolDetector.detectRequiredProtocols(protocolContext, protocolOptions);
      
      if (this.config.verboseLogging && protocols.length > 0) {
        console.error('🛡️ Protocol Detection Complete:');
        protocols.forEach(protocol => {
          console.error(`   ${protocol.name} (confidence: ${(protocol.confidence * 100).toFixed(1)}%)`);
        });
      }
      
      return {
        protocols,
        triggerAnalysis: this.protocolDetector.getLastTriggerAnalysis(),
        activationTime: Date.now(),
        success: true
      };
      
    } catch (error) {
      console.error('🚨 Protocol Detection failed:', error);
      
      // Return minimal protocol set for emergency operation
      return {
        protocols: await this.protocolRegistry.getEmergencyProtocols(),
        triggerAnalysis: null,
        activationTime: Date.now(),
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Phase 3: Progressive Context Loading
   * Executes intelligent, tiered resource loading based on discovery results
   */
  async executeProgressiveLoading(discoveryResult, protocolResult, options = {}) {
    try {
      // Prepare loading session with protocol context
      const loadingOptions = {
        ...options,
        protocols: protocolResult.protocols,
        timeout: this.config.initializationTimeout * 0.5, // 50% of total timeout
        concurrency: this.config.loadingConcurrency
      };
      
      const result = await this.contextLoader.executeLoading(discoveryResult, loadingOptions);
      
      if (this.config.verboseLogging) {
        console.error('⚡ Context Loading Complete:');
        console.error(`   Budget Utilized: ${(result.metrics.budgetUtilization * 100).toFixed(1)}%`);
        console.error(`   Resources Loaded: ${result.loadedResources.size}`);
        console.error(`   Success Rate: ${(result.metrics.successRate * 100).toFixed(1)}%`);
      }
      
      return result;
      
    } catch (error) {
      console.error('🚨 Context Loading failed:', error);
      
      // Execute emergency fallback loading
      return await this.contextLoader.executeEmergencyFallback({
        discoveryResult,
        error,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Phase 4: Session Finalization & Learning
   * Finalizes session state and applies learning optimizations
   */
  async finalizeSession(loadingResult, protocolResult, options = {}) {
    try {
      const sessionData = {
        id: this.generateSessionId(),
        timestamp: Date.now(),
        loadingResult,
        protocolResult,
        config: this.config,
        performance: this.calculateSessionPerformance(loadingResult, protocolResult)
      };
      
      // Apply session continuity learning
      if (this.config.sessionContinuityEnabled) {
        await this.sessionContinuity.recordSession(sessionData);
        await this.sessionContinuity.applyLearning(sessionData);
      }
      
      // Update protocol learning
      if (this.config.learningEnabled && protocolResult.success) {
        await this.protocolDetector.updateLearningModel(sessionData);
      }
      
      if (this.config.verboseLogging) {
        console.error('🎓 Session Learning Applied:');
        console.error(`   Session ID: ${sessionData.id}`);
        console.error(`   Performance Score: ${sessionData.performance.score.toFixed(2)}`);
      }
      
      return sessionData;
      
    } catch (error) {
      console.error('🚨 Session Finalization failed:', error);
      
      // Return minimal session data
      return {
        id: this.generateSessionId(),
        timestamp: Date.now(),
        error: error.message,
        fallback: true
      };
    }
  }

  /**
   * Emergency Fallback System
   * Provides graceful degradation to basic functionality
   */
  async executeEmergencyFallback(userMessage, originalError, options = {}) {
    console.error('🚨 BrainInitV5: Executing emergency fallback...');
    
    try {
      // Attempt backward compatibility with legacy brain_init
      if (this.config.fallbackToLegacyInit && typeof brain_init === 'function') {
        console.error('🔄 Falling back to legacy brain_init...');
        this.legacyInitResult = await brain_init();
        
        return {
          mode: 'legacy_fallback',
          success: true,
          legacyResult: this.legacyInitResult,
          originalError: originalError.message,
          timestamp: Date.now(),
          metrics: { duration: 0, contextUsage: 0.35 } // Assume 35% legacy usage
        };
      }
      
      // Minimal emergency initialization
      const emergencyContext = this.discoveryService.getEmergencyContext();
      const emergencyProtocols = await this.protocolRegistry.getEmergencyProtocols();
      
      return {
        mode: 'emergency_minimal',
        success: true,
        intent: emergencyContext.intent,
        protocols: emergencyProtocols,
        resources: [{ type: 'document', path: 'Bag of Tricks', loaded: true }],
        originalError: originalError.message,
        timestamp: Date.now(),
        metrics: { duration: 100, contextUsage: 0.02 }
      };
      
    } catch (fallbackError) {
      console.error('🚨 Emergency fallback also failed:', fallbackError);
      
      // Absolute minimal initialization
      return {
        mode: 'absolute_minimal',
        success: false,
        error: fallbackError.message,
        originalError: originalError.message,
        timestamp: Date.now(),
        metrics: { duration: 0, contextUsage: 0 }
      };
    }
  }

  /**
   * Generate comprehensive initialization result
   */
  generateInitializationResult(discoveryResult, protocolResult, loadingResult, sessionResult) {
    return {
      // Core results
      mode: 'intelligent_adaptive',
      success: true,
      version: '5.0.0',
      
      // Intent and context
      intent: discoveryResult.intent,
      context: discoveryResult.context,
      
      // Protocols
      protocols: protocolResult.protocols || [],
      protocolsActivated: protocolResult.protocols?.map(p => p.name) || [],
      
      // Resources
      resources: Array.from(loadingResult.loadedResources.values()),
      resourcesLoaded: Array.from(loadingResult.loadedResources.keys()),
      
      // Session management
      session: sessionResult,
      sessionId: sessionResult.id,
      
      // Performance metrics
      metrics: {
        duration: Date.now() - this.initializationMetrics.startTime,
        contextUsage: loadingResult.currentUsage || 0,
        budgetUtilization: loadingResult.metrics?.budgetUtilization || 0,
        successRate: loadingResult.metrics?.successRate || 0,
        protocolDetectionTime: protocolResult.activationTime - this.initializationMetrics.startTime,
        resourceLoadingTime: loadingResult.metrics?.totalLoadTime || 0
      },
      
      // System state
      initialized: true,
      timestamp: Date.now(),
      
      // Backward compatibility
      legacyCompatible: true,
      legacyResult: this.legacyInitResult
    };
  }

  /**
   * Utility Methods
   */
  
  countManifestResources(manifest) {
    return Object.values(manifest.tiers || {}).reduce((total, tier) => total + tier.length, 0);
  }
  
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  calculateSessionPerformance(loadingResult, protocolResult) {
    const budgetEfficiency = (loadingResult.metrics?.budgetUtilization || 0) <= 1.0 ? 1.0 : 0.5;
    const loadingSuccess = loadingResult.metrics?.successRate || 0;
    const protocolSuccess = protocolResult.success ? 1.0 : 0.3;
    
    return {
      score: (budgetEfficiency * 0.3 + loadingSuccess * 0.4 + protocolSuccess * 0.3),
      budgetEfficiency,
      loadingSuccess,
      protocolSuccess
    };
  }
  
  updateInitializationMetrics(result, startTime) {
    this.initializationMetrics = {
      ...this.initializationMetrics,
      endTime: Date.now(),
      duration: Date.now() - startTime,
      contextUsage: result.metrics.contextUsage,
      protocolsActivated: result.protocolsActivated,
      resourcesLoaded: result.resourcesLoaded,
      errorCount: result.success ? 0 : 1,
      successRate: result.success ? 1.0 : 0.0
    };
  }

  /**
   * Status and Monitoring Methods
   */
  
  getStatus() {
    return {
      initialized: this.initialized,
      version: '5.0.0',
      config: this.config,
      currentSession: this.currentSession?.id || null,
      metrics: this.initializationMetrics,
      subsystemStatus: {
        discovery: this.discoveryService ? 'ready' : 'not_initialized',
        loading: this.contextLoader ? 'ready' : 'not_initialized',
        protocols: this.protocolDetector ? 'ready' : 'not_initialized'
      }
    };
  }
  
  getMetrics() {
    return {
      initialization: this.initializationMetrics,
      discovery: this.discoveryService.getMetrics?.() || null,
      loading: this.contextLoader.getMetrics?.() || null,
      protocols: this.protocolDetector.getMetrics?.() || null
    };
  }

  /**
   * Backward Compatibility Interface
   * Provides seamless integration with existing Brain ecosystem
   */
  
  // Legacy brain_init compatible interface
  async brain_init(options = {}) {
    return await this.initialize('', { ...options, legacyCompatibilityMode: true });
  }
  
  // Direct replacement for current brain_init calls
  static async initialize(userMessage = '', options = {}) {
    const brainInit = new BrainInitV5(options);
    return await brainInit.initialize(userMessage, options);
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BrainInitV5;
}

// Global availability for Brain integration
if (typeof global !== 'undefined') {
  global.BrainInitV5 = BrainInitV5;
}

// Auto-initialization helper for backward compatibility
if (typeof global !== 'undefined') {
  global.brain_init_v5 = async (userMessage = '', options = {}) => {
    return await BrainInitV5.initialize(userMessage, options);
  };
}

/**
 * Export Configuration
 * 
 * This module can be used in multiple ways:
 * 
 * 1. Direct instantiation:
 *    const brainInit = new BrainInitV5(options);
 *    const result = await brainInit.initialize(userMessage);
 * 
 * 2. Static method (recommended):
 *    const result = await BrainInitV5.initialize(userMessage, options);
 * 
 * 3. Legacy compatibility:
 *    const result = await brain_init_v5(userMessage, options);
 * 
 * 4. Backward compatibility:
 *    const brainInit = new BrainInitV5();
 *    const result = await brainInit.brain_init(options);
 */

export default BrainInitV5;
export { BrainInitV5 };
