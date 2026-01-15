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
  name: 'mikey_init_v5_working',
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
      
      // SOLUTION TO MCP CONTEXT BLACK HOLE: Write structured output to file
      const fs = await import('fs');
      const path = await import('path');
      const outputDir = '/Users/bard/Code/Claude_Data/tool_outputs';
      
      // Ensure directory exists
      await fs.promises.mkdir(outputDir, { recursive: true });
      
      // Write latest results
      const outputPath = path.join(outputDir, 'latest_brain_init.json');
      await fs.promises.writeFile(outputPath, JSON.stringify(output, null, 2));
      
      // Write timestamped version
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const timestampedPath = path.join(outputDir, `${timestamp}_brain_init.json`);
      await fs.promises.writeFile(timestampedPath, JSON.stringify(output, null, 2));
      
      return {
        content: [{
          type: 'text',
          text: `🧠 Brain initialization complete! Structured results written to:\n\n📁 ${outputPath}\n🕐 ${timestampedPath}\n\n✨ Key results:\n- Context loaded: ${output.contextLoaded}\n- Protocols activated: ${output.protocolsActivated}\n- Intelligence features: ${Object.keys(output.enhancedFeatures).length}\n\n📖 Read the full JSON file above for complete structured data.`
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
