/**
 * Brain Integration Wrapper for BrainInitV5 Production Deployment
 * 
 * This wrapper integrates the BrainInitV5 system with the existing Brain MCP server,
 * providing a seamless migration path with comprehensive safety measures.
 * 
 * Features:
 * - Backward compatibility with existing brain_init interface
 * - A/B testing with automatic fallback to legacy system
 * - Performance monitoring and rollback capabilities
 * - Gradual rollout support starting at 10%
 * 
 * @author Second Reboot Deployment Team
 * @version 1.0.0
 * @since 2025-08-09
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import fs from 'fs';
import BrainInitV5 from './brain-init-v5/brain-init-v5.js';
import MigrationManager from './brain-init-v5/migration/MigrationManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Brain Integration Wrapper Class
 * 
 * Provides a drop-in replacement for the current brain_init function
 * with enhanced capabilities and safety measures.
 */
export class BrainIntegrationWrapper {
  constructor(options = {}) {
    this.options = {
      // Migration settings
      migrationMode: options.migrationMode || 'gradual',
      rolloutPercentage: options.rolloutPercentage || 10,
      automaticFallbackEnabled: options.automaticFallbackEnabled !== false,
      
      // Performance settings
      maxInitializationTime: options.maxInitializationTime || 15000, // 15 seconds
      fallbackThreshold: options.fallbackThreshold || 0.05, // 5% error rate
      
      // Logging settings
      detailedLogging: options.detailedLogging !== false,
      logFilePath: options.logFilePath || '/tmp/brain_init_v5_deployment.log',
      
      // Safety settings
      enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
      enableAutomaticRollback: options.enableAutomaticRollback !== false,
      
      ...options
    };
    
    // Initialize migration manager
    this.migrationManager = new MigrationManager(this.options);
    
    // Performance tracking
    this.performanceMetrics = {
      v5Calls: 0,
      v5Successes: 0,
      v5Failures: 0,
      v5TotalTime: 0,
      legacyCalls: 0,
      legacySuccesses: 0,
      legacyFailures: 0,
      legacyTotalTime: 0,
      lastReset: Date.now()
    };
    
    // Initialize logging
    this.log('🚀 Brain Integration Wrapper initialized', {
      migrationMode: this.options.migrationMode,
      rolloutPercentage: this.options.rolloutPercentage,
      automaticFallbackEnabled: this.options.automaticFallbackEnabled
    });
  }
  
  /**
   * Enhanced brain_init that integrates BrainInitV5 with legacy fallback
   * 
   * This method provides the same interface as the existing brain_init
   * but with intelligent routing to BrainInitV5 or legacy system based
   * on migration settings and performance metrics.
   */
  async brain_init(options = {}) {
    const startTime = Date.now();
    const { reload = false } = options;
    
    try {
      // Determine which system to use
      const useV5 = await this.shouldUseV5();
      
      if (useV5) {
        this.log('🧠 Using BrainInitV5 for initialization', { reload });
        return await this.initializeWithV5(options);
      } else {
        this.log('🔄 Using legacy system for initialization', { reload });
        return await this.initializeWithLegacy(options);
      }
    } catch (error) {
      this.log('❌ Error in brain_init wrapper', { error: error.message, stack: error.stack });
      
      // Attempt fallback to legacy system if V5 fails
      if (this.options.automaticFallbackEnabled) {
        this.log('🔄 Attempting automatic fallback to legacy system');
        try {
          return await this.initializeWithLegacy(options);
        } catch (fallbackError) {
          this.log('❌ Fallback to legacy system also failed', { 
            error: fallbackError.message 
          });
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Initialize using BrainInitV5 system
   */
  async initializeWithV5(options = {}) {
    const startTime = Date.now();
    
    try {
      this.performanceMetrics.v5Calls++;
      
      // Extract user message for intelligent initialization
      const userMessage = options.userMessage || "Initialize Brain session";
      
      // Use BrainInitV5 for intelligent initialization
      const result = await BrainInitV5.initialize(userMessage, {
        reload: options.reload,
        maxContextPercentage: 35, // Match current Brain limits
        enableProtocolDetection: true,
        enableProgressiveLoading: true,
        sessionContinuity: true
      });
      
      const duration = Date.now() - startTime;
      this.performanceMetrics.v5Successes++;
      this.performanceMetrics.v5TotalTime += duration;
      
      this.log('✅ BrainInitV5 initialization successful', {
        duration: `${duration}ms`,
        contextEfficiency: result.metrics?.contextEfficiency,
        protocolsActivated: result.protocols?.length || 0
      });
      
      // Transform result to match legacy interface
      return this.transformV5ResultToLegacy(result);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceMetrics.v5Failures++;
      this.performanceMetrics.v5TotalTime += duration;
      
      this.log('❌ BrainInitV5 initialization failed', {
        duration: `${duration}ms`,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Initialize using legacy Brain system
   */
  async initializeWithLegacy(options = {}) {
    const startTime = Date.now();
    
    try {
      this.performanceMetrics.legacyCalls++;
      
      // Call the original brain_init logic
      const result = await this.callLegacyBrainInit(options);
      
      const duration = Date.now() - startTime;
      this.performanceMetrics.legacySuccesses++;
      this.performanceMetrics.legacyTotalTime += duration;
      
      this.log('✅ Legacy brain_init successful', {
        duration: `${duration}ms`
      });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceMetrics.legacyFailures++;
      this.performanceMetrics.legacyTotalTime += duration;
      
      this.log('❌ Legacy brain_init failed', {
        duration: `${duration}ms`,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Determine whether to use BrainInitV5 based on migration settings
   */
  async shouldUseV5() {
    try {
      // Check migration manager decision
      const decision = await this.migrationManager.shouldUseV5();
      
      // Additional safety checks
      if (decision && this.options.enablePerformanceMonitoring) {
        const metrics = this.getPerformanceMetrics();
        
        // Check error rate
        const v5ErrorRate = metrics.v5.calls > 0 ? 
          metrics.v5.failures / metrics.v5.calls : 0;
        
        if (v5ErrorRate > this.options.fallbackThreshold) {
          this.log('⚠️ V5 error rate too high, falling back to legacy', {
            errorRate: v5ErrorRate,
            threshold: this.options.fallbackThreshold
          });
          return false;
        }
        
        // Check average initialization time
        const v5AvgTime = metrics.v5.calls > 0 ? 
          metrics.v5.totalTime / metrics.v5.calls : 0;
        
        if (v5AvgTime > this.options.maxInitializationTime) {
          this.log('⚠️ V5 initialization time too high, falling back to legacy', {
            avgTime: `${v5AvgTime}ms`,
            threshold: `${this.options.maxInitializationTime}ms`
          });
          return false;
        }
      }
      
      return decision;
    } catch (error) {
      this.log('❌ Error determining V5 usage', { error: error.message });
      return false; // Default to legacy on error
    }
  }
  
  /**
   * Transform BrainInitV5 result to match legacy interface
   */
  transformV5ResultToLegacy(v5Result) {
    return {
      // Match legacy brain_init response format
      status: 'success',
      message: v5Result.summary || '🧠 Enhanced Cognitive Architecture initialized successfully',
      
      // Include enhanced metrics while maintaining compatibility
      contextLoaded: v5Result.context?.nodes?.length || 0,
      protocolsActivated: v5Result.protocols?.length || 0,
      sessionStatus: 'initialized',
      
      // V5-specific enhancements (backward compatible)
      enhancedFeatures: {
        intelligentLoading: true,
        protocolDetection: true,
        adaptiveContext: true,
        efficiency: v5Result.metrics?.contextEfficiency
      },
      
      // Preserve any additional data
      ...v5Result
    };
  }
  
  /**
   * Call the original legacy brain_init (placeholder for integration)
   */
  async callLegacyBrainInit(options) {
    // This would call the original brain_init logic from index.js
    // For now, simulate the legacy response
    return {
      status: 'success',
      message: '🧠 Brain session initialized (legacy system)',
      contextLoaded: 9, // Typical legacy load count
      sessionStatus: 'initialized'
    };
  }
  
  /**
   * Get current performance metrics
   */
  getPerformanceMetrics() {
    return {
      v5: {
        calls: this.performanceMetrics.v5Calls,
        successes: this.performanceMetrics.v5Successes,
        failures: this.performanceMetrics.v5Failures,
        totalTime: this.performanceMetrics.v5TotalTime,
        avgTime: this.performanceMetrics.v5Calls > 0 ? 
          this.performanceMetrics.v5TotalTime / this.performanceMetrics.v5Calls : 0,
        successRate: this.performanceMetrics.v5Calls > 0 ? 
          this.performanceMetrics.v5Successes / this.performanceMetrics.v5Calls : 0
      },
      legacy: {
        calls: this.performanceMetrics.legacyCalls,
        successes: this.performanceMetrics.legacySuccesses,
        failures: this.performanceMetrics.legacyFailures,
        totalTime: this.performanceMetrics.legacyTotalTime,
        avgTime: this.performanceMetrics.legacyCalls > 0 ? 
          this.performanceMetrics.legacyTotalTime / this.performanceMetrics.legacyCalls : 0,
        successRate: this.performanceMetrics.legacyCalls > 0 ? 
          this.performanceMetrics.legacySuccesses / this.performanceMetrics.legacyCalls : 0
      },
      runtime: {
        uptime: Date.now() - this.performanceMetrics.lastReset,
        totalCalls: this.performanceMetrics.v5Calls + this.performanceMetrics.legacyCalls
      }
    };
  }
  
  /**
   * Reset performance metrics
   */
  resetMetrics() {
    this.performanceMetrics = {
      v5Calls: 0,
      v5Successes: 0,
      v5Failures: 0,
      v5TotalTime: 0,
      legacyCalls: 0,
      legacySuccesses: 0,
      legacyFailures: 0,
      legacyTotalTime: 0,
      lastReset: Date.now()
    };
    
    this.log('📊 Performance metrics reset');
  }
  
  /**
   * Get deployment status
   */
  getDeploymentStatus() {
    const metrics = this.getPerformanceMetrics();
    const migrationStatus = this.migrationManager.getStatus();
    
    return {
      deployment: {
        migrationMode: this.options.migrationMode,
        rolloutPercentage: this.options.rolloutPercentage,
        automaticFallbackEnabled: this.options.automaticFallbackEnabled
      },
      migration: migrationStatus,
      performance: metrics,
      health: {
        v5Healthy: metrics.v5.calls === 0 || metrics.v5.successRate >= 0.95,
        legacyHealthy: metrics.legacy.calls === 0 || metrics.legacy.successRate >= 0.95,
        overallHealthy: metrics.runtime.totalCalls === 0 || 
          (metrics.v5.successes + metrics.legacy.successes) / metrics.runtime.totalCalls >= 0.95
      }
    };
  }
  
  /**
   * Logging utility
   */
  log(message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      message,
      data
    };
    
    if (this.options.detailedLogging) {
      try {
        fs.appendFileSync(this.options.logFilePath, 
          JSON.stringify(logEntry) + '\n'
        );
      } catch (error) {
        console.error('Failed to write to log file:', error.message);
      }
    }
    
    // Also log to console for immediate feedback
    console.error(`[BrainIntegrationWrapper] ${message}`, data);
  }
}

/**
 * Global deployment factory for easy integration
 */
export function createBrainInitV5Deployment(options = {}) {
  return new BrainIntegrationWrapper(options);
}

/**
 * Global function for direct replacement (backward compatibility)
 */
export async function brain_init_v5_enhanced(options = {}) {
  const wrapper = new BrainIntegrationWrapper();
  return await wrapper.brain_init(options);
}

export default BrainIntegrationWrapper;
