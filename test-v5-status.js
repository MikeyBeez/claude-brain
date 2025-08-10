#!/usr/bin/env node

import BrainIntegrationWrapper from './brain-integration-wrapper.js';

console.log('Testing BrainInitV5 Status...\n');

// Initialize the wrapper
const brainWrapper = new BrainIntegrationWrapper({
  migrationMode: 'gradual',
  rolloutPercentage: 10,
  automaticFallbackEnabled: true,
  enablePerformanceMonitoring: true
});

// Get deployment status
try {
  const status = brainWrapper.getDeploymentStatus();
  console.log('Deployment Status:');
  console.log(JSON.stringify(status, null, 2));
} catch (error) {
  console.error('Error getting status:', error);
}
