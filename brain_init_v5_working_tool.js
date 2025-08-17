/**
 * BrainInitV5 Working Tool - Direct Implementation
 * 
 * This provides a working demonstration of what BrainInitV5 should do,
 * bypassing the rollout system to show actual enhanced capabilities.
 */

import { brain_init_v5_working } from './brain_init_v5_working.js';

/**
 * Working BrainInitV5 Tool Definition
 */
export const brainInitV5WorkingTool = {
  name: 'brain_init_v5_working',
  description: 'Working demonstration of BrainInitV5 with intelligent context discovery, protocol detection, and enhanced features',
  inputSchema: {
    type: 'object',
    properties: {
      userMessage: {
        type: 'string',
        description: 'User message for intelligent context discovery',
        default: 'Initialize enhanced brain session'
      },
      maxContextPercentage: {
        type: 'number',
        description: 'Maximum context percentage to use (default: 30)',
        default: 30
      },
      demonstrationMode: {
        type: 'boolean',
        description: 'Enable enhanced demonstration features',
        default: true
      }
    }
  },
  handler: async ({ 
    userMessage = 'Initialize enhanced brain session',
    maxContextPercentage = 30,
    demonstrationMode = true
  }) => {
    try {
      const result = await brain_init_v5_working(userMessage, {
        maxContextPercentage: maxContextPercentage / 100,
        demonstrationMode
      });
      
      // Format for MCP
      const output = {
        ...result,
        toolUsed: 'brain_init_v5_working',
        version: '5.0-working'
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(output, null, 2)
        }]
      };
      
    } catch (error) {
      console.error('[BrainInitV5Working] Tool error:', error);
      return {
        content: [{
          type: 'text',
          text: `⚠️ BrainInitV5Working failed: ${error.message}`
        }]
      };
    }
  }
};

export default brainInitV5WorkingTool;
