/**
 * MigrationManager - Smooth Transition from Legacy brain_init to BrainInitV5
 * 
 * Handles the gradual migration from current brain_init to the new unified
 * intelligent context loading system. Provides A/B testing, rollback mechanisms,
 * and performance comparison tools to ensure a seamless transition.
 * 
 * @author Second Reboot Project Team
 * @version 1.0.0
 * @since 2025-08-09
 */

import BrainInitV5 from '../brain-init-v5.js';

/**
 * MigrationManager - Handles System Migration and Validation
 * 
 * Features:
 * - Side-by-side comparison of legacy vs v5 systems
 * - A/B testing framework for gradual rollout
 * - Performance benchmarking and metrics collection
 * - Automatic fallback and rollback mechanisms
 * - Migration progress tracking and validation
 */
class MigrationManager {
  constructor(options = {}) {
    this.config = {
      // Migration strategy
      migrationMode: options.migrationMode || 'gradual', // 'immediate', 'gradual', 'ab_test'
      rolloutPercentage: options.rolloutPercentage || 10, // Start with 10% of sessions
      maxRolloutPercentage: options.maxRolloutPercentage || 100,
      rolloutIncrement: options.rolloutIncrement || 10, // Increase by 10% each phase
      
      // Performance thresholds for migration decisions
      performanceThresholds: {
        maxInitializationTime: options.maxInitializationTime || 20000, // 20s max
        minSuccessRate: options.minSuccessRate || 0.90, // 90% minimum
        maxContextUsage: options.maxContextUsage || 0.40, // 40% maximum
        maxErrorRate: options.maxErrorRate || 0.05 // 5% maximum
      },
      
      // A/B testing configuration
      abTestDuration: options.abTestDuration || 24 * 60 * 60 * 1000, // 24 hours
      minSampleSize: options.minSampleSize || 50,
      confidenceLevel: options.confidenceLevel || 0.95,
      
      // Safety and fallback
      automaticFallbackEnabled: options.automaticFallbackEnabled !== false,
      fallbackThreshold: options.fallbackThreshold || 0.20, // Fallback if 20% error rate
      rollbackOnFailure: options.rollbackOnFailure !== false,
      
      // Monitoring and logging
      metricsCollectionEnabled: options.metricsCollectionEnabled !== false,
      detailedLogging: options.detailedLogging || false,
      reportingInterval: options.reportingInterval || 60000 // 1 minute
    };
    
    // Migration state
    this.migrationState = {
      phase: 'not_started', // not_started, planning, testing, rolling_out, complete, rolled_back
      startTime: null,
      currentRolloutPercentage: this.config.rolloutPercentage,
      sessionsProcessed: 0,
      v5Sessions: 0,
      legacySessions: 0,
      migrationId: this.generateMigrationId()
    };
    
    // Performance tracking
    this.performanceMetrics = {
      v5: {
        initializationTimes: [],
        successRate: 0,
        contextUsage: [],
        errorRate: 0,
        totalSessions: 0,
        errors: []
      },
      legacy: {
        initializationTimes: [],
        successRate: 0,
        contextUsage: [],
        errorRate: 0,
        totalSessions: 0,
        errors: []
      }
    };
    
    // A/B testing state
    this.abTestState = {
      active: false,
      startTime: null,
      endTime: null,
      assignments: new Map(), // sessionId -> variant (v5 or legacy)
      results: {
        v5: { sessions: 0, successes: 0, failures: 0, metrics: [] },
        legacy: { sessions: 0, successes: 0, failures: 0, metrics: [] }
      }
    };
    
    if (this.config.detailedLogging) {
      console.error('🔄 MigrationManager: Initialized with strategy:', this.config.migrationMode);
      console.error(`   Initial Rollout: ${this.config.rolloutPercentage}%`);
      console.error(`   Automatic Fallback: ${this.config.automaticFallbackEnabled ? '✅' : '❌'}`);
    }
  }

  /**
   * Main Migration Control Method
   * Decides whether to use v5 or legacy system for a given session
   */
  async executeInitialization(userMessage = '', options = {}) {
    const sessionId = this.generateSessionId();
    const startTime = Date.now();
    
    try {
      // Determine which system to use
      const variant = this.determineVariant(sessionId, options);
      
      if (this.config.detailedLogging) {
        console.error(`🔄 Migration Session ${sessionId}: Using ${variant} variant`);
      }
      
      let result;
      
      if (variant === 'v5') {
        result = await this.executeV5Initialization(userMessage, options, sessionId);
      } else {
        result = await this.executeLegacyInitialization(userMessage, options, sessionId);
      }
      
      // Record performance metrics
      await this.recordSessionMetrics(variant, result, startTime, sessionId);
      
      // Check for automatic decisions (fallback, rollout progression)
      await this.evaluateAutomaticActions();
      
      return result;
      
    } catch (error) {
      console.error(`🚨 Migration error for session ${sessionId}:`, error);
      
      // Emergency fallback to legacy system
      if (variant === 'v5' && this.config.automaticFallbackEnabled) {
        console.error('🔄 Falling back to legacy system due to error');
        return await this.executeLegacyInitialization(userMessage, options, sessionId);
      }
      
      throw error;
    }
  }

  /**
   * Variant Selection Logic
   * Determines whether to use v5 or legacy system based on migration strategy
   */
  determineVariant(sessionId, options = {}) {
    // Override options
    if (options.forceVariant) {
      return options.forceVariant;
    }
    
    // Migration mode logic
    switch (this.config.migrationMode) {
      case 'immediate':
        return 'v5';
        
      case 'gradual':
        return this.shouldUseV5ForGradualRollout(sessionId) ? 'v5' : 'legacy';
        
      case 'ab_test':
        return this.assignVariantForABTest(sessionId);
        
      default:
        return 'legacy';
    }
  }

  /**
   * Gradual Rollout Logic
   */
  shouldUseV5ForGradualRollout(sessionId) {
    // Use session ID hash for consistent assignment
    const hash = this.hashString(sessionId);
    const percentage = (hash % 100) + 1; // 1-100
    
    return percentage <= this.migrationState.currentRolloutPercentage;
  }

  /**
   * A/B Test Assignment Logic
   */
  assignVariantForABTest(sessionId) {
    if (!this.abTestState.active) {
      this.startABTest();
    }
    
    // Check if session already assigned
    if (this.abTestState.assignments.has(sessionId)) {
      return this.abTestState.assignments.get(sessionId);
    }
    
    // Assign variant (50/50 split)
    const hash = this.hashString(sessionId);
    const variant = (hash % 2) === 0 ? 'v5' : 'legacy';
    
    this.abTestState.assignments.set(sessionId, variant);
    return variant;
  }

  /**
   * Execute V5 Initialization
   */
  async executeV5Initialization(userMessage, options, sessionId) {
    const brainInit = new BrainInitV5({
      ...options,
      verboseLogging: this.config.detailedLogging
    });
    
    const result = await brainInit.initialize(userMessage, options);
    
    // Add migration metadata
    result.migrationMetadata = {
      variant: 'v5',
      sessionId,
      migrationId: this.migrationState.migrationId,
      migrationMode: this.config.migrationMode
    };
    
    return result;
  }

  /**
   * Execute Legacy Initialization
   */
  async executeLegacyInitialization(userMessage, options, sessionId) {
    // Attempt to call existing brain_init if available
    let result;
    
    if (typeof global !== 'undefined' && global.brain_init && typeof global.brain_init === 'function') {
      result = await global.brain_init(options);
    } else if (typeof brain_init === 'function') {
      result = await brain_init(options);
    } else {
      // Simulate legacy result structure
      result = {
        mode: 'legacy_simulated',
        success: true,
        initialized: true,
        timestamp: Date.now(),
        metrics: { duration: 500, contextUsage: 0.35 }
      };
    }
    
    // Normalize legacy result to match v5 structure
    if (!result.migrationMetadata) {
      result.migrationMetadata = {
        variant: 'legacy',
        sessionId,
        migrationId: this.migrationState.migrationId,
        migrationMode: this.config.migrationMode,
        normalized: true
      };
    }
    
    return result;
  }

  /**
   * Record Session Performance Metrics
   */
  async recordSessionMetrics(variant, result, startTime, sessionId) {
    const duration = Date.now() - startTime;
    const success = result.success !== false;
    const contextUsage = result.metrics?.contextUsage || 0;
    
    const metrics = this.performanceMetrics[variant];
    
    // Update basic counters
    metrics.totalSessions++;
    this.migrationState.sessionsProcessed++;
    
    if (variant === 'v5') {
      this.migrationState.v5Sessions++;
    } else {
      this.migrationState.legacySessions++;
    }
    
    // Record performance data
    metrics.initializationTimes.push(duration);
    metrics.contextUsage.push(contextUsage);
    
    if (success) {
      metrics.successRate = this.calculateSuccessRate(variant);
    } else {
      metrics.errors.push({
        sessionId,
        timestamp: Date.now(),
        error: result.error || 'Unknown error',
        duration
      });
      metrics.errorRate = this.calculateErrorRate(variant);
    }
    
    // A/B test recording
    if (this.abTestState.active) {
      this.recordABTestResult(variant, { success, duration, contextUsage, sessionId });
    }
    
    // Store in Brain state for persistence
    if (this.config.metricsCollectionEnabled) {
      await this.persistMigrationMetrics();
    }
  }

  /**
   * Evaluate Automatic Actions (Fallback, Rollout Progression)
   */
  async evaluateAutomaticActions() {
    // Check for automatic fallback
    if (this.config.automaticFallbackEnabled && this.shouldTriggerFallback()) {
      await this.triggerAutomaticFallback();
      return;
    }
    
    // Check for rollout progression
    if (this.config.migrationMode === 'gradual' && this.shouldProgressRollout()) {
      await this.progressGradualRollout();
    }
    
    // Check for A/B test completion
    if (this.abTestState.active && this.shouldCompleteABTest()) {
      await this.completeABTest();
    }
  }

  /**
   * Fallback Logic
   */
  shouldTriggerFallback() {
    const v5Metrics = this.performanceMetrics.v5;
    
    if (v5Metrics.totalSessions < 10) return false; // Need minimum sample
    
    return (
      v5Metrics.errorRate > this.config.fallbackThreshold ||
      v5Metrics.successRate < this.config.performanceThresholds.minSuccessRate ||
      this.getAverageInitTime('v5') > this.config.performanceThresholds.maxInitializationTime
    );
  }

  async triggerAutomaticFallback() {
    console.error('🚨 MigrationManager: Triggering automatic fallback to legacy system');
    
    this.migrationState.phase = 'rolled_back';
    this.config.migrationMode = 'legacy_only';
    
    // Persist fallback decision
    await this.persistMigrationState();
    
    // Generate fallback report
    await this.generateFallbackReport();
  }

  /**
   * Gradual Rollout Progression
   */
  shouldProgressRollout() {
    const v5Metrics = this.performanceMetrics.v5;
    const minSessions = Math.max(20, this.config.minSampleSize);
    
    if (v5Metrics.totalSessions < minSessions) return false;
    
    // Check if current percentage is performing well
    return (
      v5Metrics.errorRate < this.config.performanceThresholds.maxErrorRate &&
      v5Metrics.successRate >= this.config.performanceThresholds.minSuccessRate &&
      this.getAverageInitTime('v5') <= this.config.performanceThresholds.maxInitializationTime &&
      this.migrationState.currentRolloutPercentage < this.config.maxRolloutPercentage
    );
  }

  async progressGradualRollout() {
    const newPercentage = Math.min(
      this.migrationState.currentRolloutPercentage + this.config.rolloutIncrement,
      this.config.maxRolloutPercentage
    );
    
    console.error(`🚀 MigrationManager: Progressing rollout from ${this.migrationState.currentRolloutPercentage}% to ${newPercentage}%`);
    
    this.migrationState.currentRolloutPercentage = newPercentage;
    
    if (newPercentage >= this.config.maxRolloutPercentage) {
      this.migrationState.phase = 'complete';
      console.error('🎉 MigrationManager: Migration complete! V5 system now at 100%');
    }
    
    await this.persistMigrationState();
  }

  /**
   * A/B Testing Methods
   */
  startABTest() {
    console.error('🧪 MigrationManager: Starting A/B test');
    
    this.abTestState = {
      active: true,
      startTime: Date.now(),
      endTime: Date.now() + this.config.abTestDuration,
      assignments: new Map(),
      results: {
        v5: { sessions: 0, successes: 0, failures: 0, metrics: [] },
        legacy: { sessions: 0, successes: 0, failures: 0, metrics: [] }
      }
    };
    
    this.migrationState.phase = 'testing';
  }

  recordABTestResult(variant, result) {
    const testResults = this.abTestState.results[variant];
    
    testResults.sessions++;
    if (result.success) {
      testResults.successes++;
    } else {
      testResults.failures++;
    }
    
    testResults.metrics.push({
      duration: result.duration,
      contextUsage: result.contextUsage,
      success: result.success,
      timestamp: Date.now()
    });
  }

  shouldCompleteABTest() {
    const now = Date.now();
    const totalSessions = this.abTestState.results.v5.sessions + this.abTestState.results.legacy.sessions;
    
    return (
      now >= this.abTestState.endTime ||
      totalSessions >= this.config.minSampleSize * 2
    );
  }

  async completeABTest() {
    console.error('🧪 MigrationManager: Completing A/B test');
    
    this.abTestState.active = false;
    const analysis = this.analyzeABTestResults();
    
    if (analysis.recommendation === 'v5') {
      console.error('✅ A/B Test Result: V5 system recommended, switching to gradual rollout');
      this.config.migrationMode = 'gradual';
      this.migrationState.phase = 'rolling_out';
    } else {
      console.error('❌ A/B Test Result: Legacy system recommended, rolling back');
      this.config.migrationMode = 'legacy_only';
      this.migrationState.phase = 'rolled_back';
    }
    
    await this.generateABTestReport(analysis);
    await this.persistMigrationState();
  }

  /**
   * Utility Methods
   */
  
  calculateSuccessRate(variant) {
    const metrics = this.performanceMetrics[variant];
    return metrics.totalSessions > 0 ? (metrics.totalSessions - metrics.errors.length) / metrics.totalSessions : 0;
  }
  
  calculateErrorRate(variant) {
    const metrics = this.performanceMetrics[variant];
    return metrics.totalSessions > 0 ? metrics.errors.length / metrics.totalSessions : 0;
  }
  
  getAverageInitTime(variant) {
    const times = this.performanceMetrics[variant].initializationTimes;
    return times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;
  }
  
  getAverageContextUsage(variant) {
    const usage = this.performanceMetrics[variant].contextUsage;
    return usage.length > 0 ? usage.reduce((sum, u) => sum + u, 0) / usage.length : 0;
  }
  
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
  
  generateMigrationId() {
    return `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Reporting and Analysis
   */
  
  generateMigrationReport() {
    const v5Avg = this.getAverageInitTime('v5');
    const legacyAvg = this.getAverageInitTime('legacy');
    const v5Usage = this.getAverageContextUsage('v5');
    const legacyUsage = this.getAverageContextUsage('legacy');
    
    return {
      migrationState: this.migrationState,
      performanceComparison: {
        initializationTime: {
          v5: v5Avg,
          legacy: legacyAvg,
          improvement: legacyAvg > 0 ? ((legacyAvg - v5Avg) / legacyAvg * 100).toFixed(2) + '%' : 'N/A'
        },
        contextUsage: {
          v5: v5Usage,
          legacy: legacyUsage,
          improvement: legacyUsage > 0 ? ((legacyUsage - v5Usage) / legacyUsage * 100).toFixed(2) + '%' : 'N/A'
        },
        successRate: {
          v5: (this.performanceMetrics.v5.successRate * 100).toFixed(2) + '%',
          legacy: (this.performanceMetrics.legacy.successRate * 100).toFixed(2) + '%'
        },
        errorRate: {
          v5: (this.performanceMetrics.v5.errorRate * 100).toFixed(2) + '%',
          legacy: (this.performanceMetrics.legacy.errorRate * 100).toFixed(2) + '%'
        }
      },
      sessionCounts: {
        total: this.migrationState.sessionsProcessed,
        v5: this.migrationState.v5Sessions,
        legacy: this.migrationState.legacySessions,
        v5Percentage: this.migrationState.sessionsProcessed > 0 ? 
          (this.migrationState.v5Sessions / this.migrationState.sessionsProcessed * 100).toFixed(2) + '%' : '0%'
      },
      recommendation: this.generateMigrationRecommendation(),
      timestamp: Date.now()
    };
  }
  
  generateMigrationRecommendation() {
    const v5Metrics = this.performanceMetrics.v5;
    const legacyMetrics = this.performanceMetrics.legacy;
    
    if (v5Metrics.totalSessions < 10) {
      return 'Need more data - continue testing';
    }
    
    const v5Better = (
      v5Metrics.errorRate <= legacyMetrics.errorRate &&
      v5Metrics.successRate >= legacyMetrics.successRate &&
      this.getAverageInitTime('v5') <= this.getAverageInitTime('legacy') * 1.2 // 20% tolerance
    );
    
    return v5Better ? 'Proceed with V5 migration' : 'Consider rollback to legacy';
  }

  analyzeABTestResults() {
    const v5Results = this.abTestState.results.v5;
    const legacyResults = this.abTestState.results.legacy;
    
    const v5SuccessRate = v5Results.sessions > 0 ? v5Results.successes / v5Results.sessions : 0;
    const legacySuccessRate = legacyResults.sessions > 0 ? legacyResults.successes / legacyResults.sessions : 0;
    
    const v5AvgTime = v5Results.metrics.length > 0 ? 
      v5Results.metrics.reduce((sum, m) => sum + m.duration, 0) / v5Results.metrics.length : 0;
    const legacyAvgTime = legacyResults.metrics.length > 0 ?
      legacyResults.metrics.reduce((sum, m) => sum + m.duration, 0) / legacyResults.metrics.length : 0;
    
    // Simple recommendation logic
    const v5Recommended = (
      v5SuccessRate >= legacySuccessRate &&
      (legacyAvgTime === 0 || v5AvgTime <= legacyAvgTime * 1.2)
    );
    
    return {
      recommendation: v5Recommended ? 'v5' : 'legacy',
      confidence: Math.abs(v5SuccessRate - legacySuccessRate),
      details: {
        v5: { successRate: v5SuccessRate, avgTime: v5AvgTime, sessions: v5Results.sessions },
        legacy: { successRate: legacySuccessRate, avgTime: legacyAvgTime, sessions: legacyResults.sessions }
      }
    };
  }

  /**
   * Persistence Methods
   */
  
  async persistMigrationState() {
    if (typeof brain !== 'undefined' && brain.state_set) {
      await brain.state_set('migration_state', this.migrationState, 'system');
      await brain.state_set('migration_metrics', this.performanceMetrics, 'system');
    }
  }
  
  async persistMigrationMetrics() {
    if (typeof brain !== 'undefined' && brain.state_set) {
      await brain.state_set('migration_metrics', this.performanceMetrics, 'system');
    }
  }

  async generateFallbackReport() {
    const report = {
      type: 'automatic_fallback',
      timestamp: Date.now(),
      reason: 'Performance thresholds exceeded',
      metrics: this.performanceMetrics.v5,
      thresholds: this.config.performanceThresholds,
      migrationId: this.migrationState.migrationId
    };
    
    console.error('📊 Fallback Report Generated:', report);
    return report;
  }

  async generateABTestReport(analysis) {
    const report = {
      type: 'ab_test_complete',
      timestamp: Date.now(),
      duration: Date.now() - this.abTestState.startTime,
      analysis,
      results: this.abTestState.results,
      recommendation: analysis.recommendation,
      migrationId: this.migrationState.migrationId
    };
    
    console.error('📊 A/B Test Report Generated:', report);
    return report;
  }

  /**
   * Status and Management Interface
   */
  
  getStatus() {
    return {
      migrationState: this.migrationState,
      config: this.config,
      performanceMetrics: this.performanceMetrics,
      abTestState: this.abTestState.active ? {
        active: this.abTestState.active,
        progress: (Date.now() - this.abTestState.startTime) / this.config.abTestDuration,
        sessions: this.abTestState.results.v5.sessions + this.abTestState.results.legacy.sessions
      } : { active: false }
    };
  }
  
  async pauseMigration() {
    this.config.migrationMode = 'legacy_only';
    this.migrationState.phase = 'paused';
    await this.persistMigrationState();
  }
  
  async resumeMigration() {
    this.config.migrationMode = 'gradual';
    this.migrationState.phase = 'rolling_out';
    await this.persistMigrationState();
  }
  
  async forceMigration() {
    this.config.migrationMode = 'immediate';
    this.migrationState.phase = 'complete';
    this.migrationState.currentRolloutPercentage = 100;
    await this.persistMigrationState();
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MigrationManager;
}

// Global availability
if (typeof global !== 'undefined') {
  global.MigrationManager = MigrationManager;
}

export default MigrationManager;
export { MigrationManager };
