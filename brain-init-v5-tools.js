/**
 * BrainInitV5 Tool Definition for Brain MCP Server - FIXED VERSION
 * 
 * This file adds the brain_init_v5 tool to the existing Brain system
 * without modifying the original brain_init functionality.
 * 
 * FIXED: Return format for MCP compatibility
 */

import BrainIntegrationWrapper from './brain-integration-wrapper.js';

// Initialize the BrainInitV5 wrapper
const brainWrapper = new BrainIntegrationWrapper({
  migrationMode: 'gradual',
  rolloutPercentage: 10,
  automaticFallbackEnabled: true,
  enablePerformanceMonitoring: true
});

/**
 * BrainInitV5 Tool Definition
 * 
 * Add this to the tools array in index.js:
 */
export const brainInitV5Tool = {
  name: 'mikey_init_v5',
  description: 'Initialize Brain session with BrainInitV5 - Enhanced intelligent context loading with adaptive protocols',
  inputSchema: {
    type: 'object',
    properties: {
      reload: { 
        type: 'boolean', 
        description: 'Force reload (default: false)' 
      },
      userMessage: { 
        type: 'string', 
        description: 'User message for intelligent context discovery (optional)' 
      },
      maxContextPercentage: { 
        type: 'number', 
        description: 'Maximum context percentage to use (default: 35)' 
      },
      enableProtocolDetection: { 
        type: 'boolean', 
        description: 'Enable intelligent protocol detection (default: true)' 
      }
    }
  },
  handler: async ({ 
    reload = false, 
    userMessage = "Initialize Brain session", 
    maxContextPercentage = 35,
    enableProtocolDetection = true 
  }) => {
    try {
      const result = await brainWrapper.brain_init({ 
        reload, 
        userMessage,
        maxContextPercentage,
        enableProtocolDetection
      });
      
      const output = {
        ...result,
        toolUsed: 'brain_init_v5',
        enhancedFeatures: {
          intelligentLoading: true,
          protocolDetection: enableProtocolDetection,
          adaptiveContext: true,
          version: '5.0.0'
        }
      };
      
      // Format for MCP
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(output, null, 2)
        }]
      };
    } catch (error) {
      console.error('[Brain] BrainInitV5 error:', error);
      return {
        content: [{
          type: 'text',
          text: `⚠️ BrainInitV5 initialization failed: ${error.message}`
        }]
      };
    }
  }
};

/**
 * Deployment Status Tool - FIXED
 */
export const brainInitV5StatusTool = {
  name: 'mikey_init_v5_status',
  description: 'Get BrainInitV5 deployment status and performance metrics',
  inputSchema: {
    type: 'object',
    properties: {
      includeMetrics: { 
        type: 'boolean', 
        description: 'Include detailed performance metrics (default: true)' 
      }
    }
  },
  handler: async ({ includeMetrics = true }) => {
    try {
      const status = brainWrapper.getDeploymentStatus();
      
      if (!includeMetrics) {
        delete status.performance;
      }
      
      const result = {
        status: 'success',
        deployment: status,
        timestamp: new Date().toISOString()
      };
      
      // Format the output nicely
      let output = '🚀 BrainInitV5 Deployment Status\\n';
      output += '================================\\n\\n';
      
      // Deployment config
      output += '📋 Configuration:\\n';
      output += `  • Migration Mode: ${status.deployment.migrationMode}\\n`;
      output += `  • Rollout: ${status.deployment.rolloutPercentage}%\\n`;
      output += `  • Auto Fallback: ${status.deployment.automaticFallbackEnabled ? '✅' : '❌'}\\n\\n`;
      
      // Migration status
      output += '🔄 Migration Status:\\n';
      output += `  • Phase: ${status.migration.migrationState.phase}\\n`;
      output += `  • Sessions Processed: ${status.migration.migrationState.sessionsProcessed}\\n`;
      output += `  • V5 Sessions: ${status.migration.migrationState.v5Sessions}\\n`;
      output += `  • Legacy Sessions: ${status.migration.migrationState.legacySessions}\\n\\n`;
      
      // Health status
      output += '💚 Health Status:\\n';
      output += `  • V5 System: ${status.health.v5Healthy ? '✅ Healthy' : '⚠️ Issues Detected'}\\n`;
      output += `  • Legacy System: ${status.health.legacyHealthy ? '✅ Healthy' : '⚠️ Issues Detected'}\\n`;
      output += `  • Overall: ${status.health.overallHealthy ? '✅ Healthy' : '⚠️ Issues Detected'}\\n`;
      
      if (includeMetrics && status.performance) {
        output += '\\n📊 Performance Metrics:\\n';
        output += `  • V5 Calls: ${status.performance.v5.calls}\\n`;
        output += `  • V5 Success Rate: ${(status.performance.v5.successRate * 100).toFixed(1)}%\\n`;
        output += `  • Legacy Calls: ${status.performance.legacy.calls}\\n`;
        output += `  • Legacy Success Rate: ${(status.performance.legacy.successRate * 100).toFixed(1)}%\\n`;
        output += `  • Total Calls: ${status.performance.runtime.totalCalls}\\n`;
        output += `  • Uptime: ${Math.floor(status.performance.runtime.uptime / 1000)}s\\n`;
      }
      
      output += '\\n✨ Status: BrainInitV5 is ACTIVE and monitoring';
      
      // Return formatted for MCP
      return {
        content: [{
          type: 'text',
          text: output
        }]
      };
    } catch (error) {
      console.error('[Brain] BrainInitV5 status error:', error);
      return {
        content: [{
          type: 'text',
          text: `⚠️ Failed to get deployment status: ${error.message}`
        }]
      };
    }
  }
};

export default { brainInitV5Tool, brainInitV5StatusTool };
